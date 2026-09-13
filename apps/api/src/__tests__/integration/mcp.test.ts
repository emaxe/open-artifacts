import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { serve, type ServerType } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { artifacts, users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

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

async function connectClient(port: number, apiKey: string, opts: { orgId?: string } = {}): Promise<Client> {
  const client = new Client({ name: "test-client", version: "0.0.1" });
  const url = new URL(`http://localhost:${port}/mcp`);
  if (opts.orgId) url.searchParams.set("orgId", opts.orgId);
  const transport = new StreamableHTTPClientTransport(url, {
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

async function issueUserKey(app: ReturnType<typeof buildTestApp>, sessionCookie: string, scopes: string[]) {
  const res = await app.request("/api/v1/me/keys", {
    method: "POST",
    headers: authedHeaders(sessionCookie),
    body: JSON.stringify({ name: "mcp-test-key", scopes }),
  });
  const key = (await res.json()) as { token: string };
  return key.token;
}

function toolJson(result: Awaited<ReturnType<Client["callTool"]>>): any {
  const first = (result.content as Array<{ type: string; text?: string }>)[0];
  if (first?.type !== "text") throw new Error("expected a text content block");
  return JSON.parse(first.text!);
}

describe("MCP server", () => {
  it("lists all 10 tools and exercises the full publish/share flow", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const apiKey = await issueKey(app, orgId, sessionCookie, ["artifacts:read", "artifacts:write", "artifacts:delete", "shares:write"]);

    const port = await startServer();
    const client = await connectClient(port, apiKey);

    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ["whoami", "list_orgs", "list_artifacts", "get_artifact", "create_artifact", "update_artifact", "delete_artifact", "create_share", "list_shares", "revoke_share"].sort(),
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

  it("a personal key spans every team: org_required without orgId, success with ?orgId= on the connection URL", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app); // main org + one team org
    const key = await issueUserKey(app, user.sessionCookie, ["artifacts:read", "artifacts:write"]);

    const port = await startServer();

    const clientNoOrg = await connectClient(port, key);
    const who = toolJson(await clientNoOrg.callTool({ name: "whoami", arguments: {} }));
    expect(who.kind).toBe("user_key");
    expect(who.orgs.map((o: { orgId: string }) => o.orgId).sort()).toEqual([user.mainOrgId, user.orgId].sort());

    const orgsListed = toolJson(await clientNoOrg.callTool({ name: "list_orgs", arguments: {} }));
    expect(orgsListed.orgs).toHaveLength(2);

    const ambiguous = await clientNoOrg.callTool({ name: "create_artifact", arguments: { title: "no team", kind: "html", content: "<p>x</p>" } });
    expect(ambiguous.isError).toBe(true);
    const ambiguousBody = JSON.parse((ambiguous.content as Array<{ text: string }>)[0]!.text);
    expect(ambiguousBody.code).toBe("org_required");
    expect(ambiguousBody.orgs).toHaveLength(2);
    await clientNoOrg.close();

    // A project's .mcp.json sets the default team via ?orgId= on the connection URL.
    const clientWithOrg = await connectClient(port, key, { orgId: user.orgId });
    const created = toolJson(await clientWithOrg.callTool({ name: "create_artifact", arguments: { title: "scoped", kind: "html", content: "<p>x</p>" } }));
    expect(created.id).toEqual(expect.any(String));

    const listed = toolJson(await clientWithOrg.callTool({ name: "list_artifacts", arguments: {} }));
    expect(listed.artifacts.some((a: { id: string }) => a.id === created.id)).toBe(true);

    // A call-level orgId argument still overrides the connection default.
    const createdInOther = toolJson(
      await clientWithOrg.callTool({ name: "create_artifact", arguments: { title: "other team", kind: "html", content: "<p>y</p>", orgId: user.mainOrgId } }),
    );
    expect(createdInOther.id).toEqual(expect.any(String));

    await clientWithOrg.close();
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

  it("create_artifact accepts a lifetime within the team's maximum and rejects one over it", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie, userId } = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));
    await app.request("/api/v1/admin/settings", {
      method: "PATCH",
      headers: authedHeaders(sessionCookie),
      body: JSON.stringify({ maxArtifactLifetimeMinutes: 60 }),
    });
    const apiKey = await issueKey(app, orgId, sessionCookie, ["artifacts:read", "artifacts:write"]);

    const port = await startServer();
    const client = await connectClient(port, apiKey);

    const created = toolJson(
      await client.callTool({ name: "create_artifact", arguments: { title: "short-lived", kind: "html", content: "<p>x</p>", lifetime: "30m" } }),
    );
    expect(created.expiresAt).toEqual(expect.any(String));
    const deltaMs = new Date(created.expiresAt).getTime() - Date.now();
    expect(deltaMs).toBeGreaterThan(25 * 60_000);
    expect(deltaMs).toBeLessThan(31 * 60_000);

    const tooLong = await client.callTool({ name: "create_artifact", arguments: { title: "too long", kind: "html", content: "<p>x</p>", lifetime: "7d" } });
    expect(tooLong.isError).toBe(true);
    const errorText = (tooLong.content as Array<{ text: string }>)[0]!.text;
    expect(errorText).toContain("lifetime_exceeds_max");

    await client.close();
  });

  it("create_share defaults to the team's configured mode and can be refused by policy", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const apiKey = await issueKey(app, orgId, sessionCookie, ["artifacts:read", "artifacts:write", "shares:write"]);

    const port = await startServer();
    const client = await connectClient(port, apiKey);

    const created = toolJson(await client.callTool({ name: "create_artifact", arguments: { title: "mcp share", kind: "html", content: "<p>x</p>" } }));

    const defaulted = toolJson(await client.callTool({ name: "create_share", arguments: { artifactId: created.id } }));
    expect(defaulted.mode).toBe("team");

    await app.request(`/api/v1/orgs/${orgId}`, {
      method: "PATCH",
      headers: authedHeaders(sessionCookie),
      body: JSON.stringify({ allowPublicShares: false }),
    });

    const forbidden = await client.callTool({ name: "create_share", arguments: { artifactId: created.id, mode: "public" } });
    expect(forbidden.isError).toBe(true);
    const forbiddenBody = JSON.parse((forbidden.content as Array<{ text: string }>)[0]!.text);
    expect(forbiddenBody.code).toBe("public_shares_forbidden");
    expect(forbiddenBody.allowedModes).toEqual(["team", "password"]);

    await client.close();
  });

  it("hides an expired artifact from get_artifact and list_artifacts", async () => {
    const app = buildTestApp();
    const { orgId, sessionCookie } = await registerAndLogin(app);
    const apiKey = await issueKey(app, orgId, sessionCookie, ["artifacts:read", "artifacts:write"]);

    const port = await startServer();
    const client = await connectClient(port, apiKey);

    const created = toolJson(await client.callTool({ name: "create_artifact", arguments: { title: "will expire", kind: "html", content: "<p>x</p>" } }));
    const artifactId = created.id as string;

    await getTestDb()
      .update(artifacts)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(artifacts.id, artifactId));

    const fetched = await client.callTool({ name: "get_artifact", arguments: { id: artifactId } });
    expect(fetched.isError).toBe(true);

    const listed = toolJson(await client.callTool({ name: "list_artifacts", arguments: {} }));
    expect(listed.artifacts.some((a: { id: string }) => a.id === artifactId)).toBe(false);

    await client.close();
  });
});
