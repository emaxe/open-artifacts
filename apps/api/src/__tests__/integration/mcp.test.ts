import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serve, type ServerType } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { buildTestApp, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

function authedHeaders(sessionCookie: string) {
  return { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` };
}

let server: ServerType | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
});

/** Starts the real app on an OS-assigned port — an MCP client transport does real `fetch()` calls, so in-process `app.request()` won't do here. */
async function startServer(): Promise<number> {
  const app = buildTestApp();
  return new Promise((resolve) => {
    server = serve({ fetch: app.fetch, port: 0 }, (info) => resolve(info.port));
  });
}

async function connectClient(port: number, apiKey: string): Promise<Client> {
  const client = new Client({ name: "test-client", version: "0.0.1" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://localhost:${port}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${apiKey}` } },
  });
  await client.connect(transport);
  return client;
}

async function issueKey(app: ReturnType<typeof buildTestApp>, orgId: string, sessionCookie: string, scopes: string[]) {
  const agentRes = await app.request(`/api/v1/agents?orgId=${orgId}`, {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify({ name: "mcp-test-agent" }),
  });
  const agent = (await agentRes.json()) as { id: string };
  const keyRes = await app.request(`/api/v1/agents/${agent.id}/keys`, {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify({ scopes }),
  });
  const key = (await keyRes.json()) as { token: string };
  return key.token;
}

function toolJson(result: Awaited<ReturnType<Client["callTool"]>>): any {
  const first = (result.content as Array<{ type: string; text?: string }>)[0];
  if (first?.type !== "text") throw new Error("expected a text content block");
  return JSON.parse(first.text!);
}

describe("MCP server", () => {
  it("lists all 9 tools and exercises the full publish/share flow", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const apiKey = await issueKey(app, orgId, sessionCookie, ["artifacts:read", "artifacts:write", "artifacts:delete", "shares:write"]);

    const port = await startServer();
    const client = await connectClient(port, apiKey);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["whoami", "list_artifacts", "get_artifact", "create_artifact", "update_artifact", "delete_artifact", "create_share", "list_shares", "revoke_share"].sort(),
    );

    const who = toolJson(await client.callTool({ name: "whoami", arguments: {} }));
    expect(who).toEqual({ kind: "agent", agentId: expect.any(String), orgId, scopes: expect.arrayContaining(["artifacts:write"]) });

    const created = toolJson(
      await client.callTool({ name: "create_artifact", arguments: { title: "MCP test", kind: "html", content: "<h1>via mcp</h1>" } }),
    );
    expect(created.versionNo).toBe(1);
    const artifactId = created.id as string;

    const fetched = toolJson(await client.callTool({ name: "get_artifact", arguments: { id: artifactId } }));
    expect(fetched.content).toBe("<h1>via mcp</h1>");

    const updated = toolJson(
      await client.callTool({ name: "update_artifact", arguments: { id: artifactId, content: "<h1>v2</h1>", message: "bump" } }),
    );
    expect(updated.newVersionNo).toBe(2);

    const listed = toolJson(await client.callTool({ name: "list_artifacts", arguments: {} }));
    expect(listed.artifacts.some((a: { id: string }) => a.id === artifactId)).toBe(true);

    const share = toolJson(await client.callTool({ name: "create_share", arguments: { artifactId, mode: "public" } }));
    expect(share.url).toContain("/s/");

    const shares = toolJson(await client.callTool({ name: "list_shares", arguments: { artifactId } }));
    expect(shares.shares).toHaveLength(1);

    const revoked = toolJson(await client.callTool({ name: "revoke_share", arguments: { shareId: shares.shares[0].id } }));
    expect(revoked.revoked).toBe(true);

    const deleted = toolJson(await client.callTool({ name: "delete_artifact", arguments: { id: artifactId } }));
    expect(deleted.deleted).toBe(true);

    await client.close();
  });

  it("enforces API-key scopes on write tools (read-only key can't create)", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const readOnlyKey = await issueKey(app, orgId, sessionCookie, ["artifacts:read"]);

    const port = await startServer();
    const client = await connectClient(port, readOnlyKey);

    const result = await client.callTool({ name: "create_artifact", arguments: { title: "nope", kind: "html", content: "<p>x</p>" } });
    expect(result.isError).toBe(true);
    expect((result.content as Array<{ text: string }>)[0]!.text).toContain("Missing scope: artifacts:write");

    await client.close();
  });

  it("rejects a request with no Authorization header before the MCP protocol even starts", async () => {
    const port = await startServer();
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("unauthorized");
  });
});
