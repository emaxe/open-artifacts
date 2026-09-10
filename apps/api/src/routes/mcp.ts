import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type { AppBindings, Identity } from "../types.js";
import type { Database } from "../db/client.js";
import type { Env } from "../env.js";
import { requiresScope } from "../services/scopes.js";
import { recordAudit } from "../services/audit.js";
import {
  ArtifactTooLargeError,
  QuotaExceededError,
  VersionConflictError,
  createArtifact,
  getArtifact,
  getCurrentVersion,
  getVersionByNumber,
  listArtifactsForOrg,
  resolveAccessForIdentity,
  softDeleteArtifact,
  updateArtifact,
} from "../services/artifacts.js";
import { createShare, listSharesForArtifact, revokeShare } from "../services/shares.js";

export const mcpRoutes = new Hono<AppBindings>();

function ok(payload: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

const artifactKindSchema = z.enum(["html", "markdown", "mermaid", "svg"]);
const visibilitySchema = z.enum(["private", "org"]);

/**
 * Builds a fresh McpServer per request, with every tool closing over the identity resolved for
 * *that* request. Cheap (just registrations, no I/O), and avoids any risk of one agent's request
 * reusing state left over from a concurrent request on a shared server instance.
 */
function createMcpServer(db: Database, env: Env, identity: Identity): McpServer {
  const server = new McpServer({ name: "open-artifacts", version: "0.1.0" });

  server.registerTool(
    "whoami",
    { description: "Identify the current agent: which org it's acting in and what scopes its key carries." },
    async (): Promise<CallToolResult> => {
      if (identity.kind !== "agent") return ok({ kind: identity.kind, userId: identity.userId });
      return ok({ kind: "agent", agentId: identity.agentId, orgId: identity.orgId, scopes: identity.scopes });
    },
  );

  server.registerTool(
    "list_artifacts",
    { description: "List artifacts you can read in your organization." },
    async (): Promise<CallToolResult> => {
      if (!requiresScope(identity, "artifacts:read")) return toolError("Missing scope: artifacts:read");
      const orgId = identity.kind === "agent" ? identity.orgId : undefined;
      if (!orgId) return toolError("This tool requires an agent (API key) identity.");

      const all = await listArtifactsForOrg(db, orgId);
      const visible = [];
      for (const artifact of all) {
        const access = await resolveAccessForIdentity(db, identity, artifact);
        if (access.read) {
          visible.push({ id: artifact.id, title: artifact.title, kind: artifact.kind, visibility: artifact.visibility, updatedAt: artifact.updatedAt });
        }
      }
      return ok({ artifacts: visible });
    },
  );

  server.registerTool(
    "get_artifact",
    {
      description: "Fetch an artifact's metadata and current content by id.",
      inputSchema: { id: z.string().uuid().describe("Artifact id") },
    },
    async ({ id }): Promise<CallToolResult> => {
      if (!requiresScope(identity, "artifacts:read")) return toolError("Missing scope: artifacts:read");
      const artifact = await getArtifact(db, id);
      if (!artifact) return toolError("Artifact not found");
      const access = await resolveAccessForIdentity(db, identity, artifact);
      if (!access.read) return toolError("Forbidden: no read access to this artifact");

      const version = await getCurrentVersion(db, artifact);
      return ok({
        id: artifact.id,
        title: artifact.title,
        description: artifact.description,
        kind: artifact.kind,
        visibility: artifact.visibility,
        versionNo: version?.versionNo,
        contentHash: version?.contentHash,
        content: version?.content,
      });
    },
  );

  server.registerTool(
    "create_artifact",
    {
      description: "Publish a new artifact (HTML/Markdown/Mermaid/SVG). Returns its id — pass that to create_share to get a link a human can open.",
      inputSchema: {
        title: z.string().min(1).max(200),
        kind: artifactKindSchema,
        content: z.string().min(1).describe("Full content, e.g. a self-contained HTML document"),
        description: z.string().max(2000).optional(),
        visibility: visibilitySchema.default("private").describe("'org' makes it readable by everyone in your org"),
      },
    },
    async ({ title, kind, content, description, visibility }): Promise<CallToolResult> => {
      if (!requiresScope(identity, "artifacts:write")) return toolError("Missing scope: artifacts:write");
      const orgId = identity.kind === "agent" ? identity.orgId : undefined;
      if (!orgId) return toolError("This tool requires an agent (API key) identity.");

      try {
        const { artifact, version } = await createArtifact(db, { orgId, identity, title, kind, content, description, visibility });
        await recordAudit(db, { orgId, identity, action: "artifact.create", targetType: "artifact", targetId: artifact.id });
        return ok({ id: artifact.id, versionNo: version.versionNo });
      } catch (err) {
        if (err instanceof ArtifactTooLargeError || err instanceof QuotaExceededError) return toolError(err.message);
        throw err;
      }
    },
  );

  server.registerTool(
    "update_artifact",
    {
      description: "Update an artifact's content (creates a new version, keeps history) and/or its metadata.",
      inputSchema: {
        id: z.string().uuid(),
        content: z.string().min(1).optional(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        visibility: visibilitySchema.optional(),
        message: z.string().max(500).optional().describe("Short version note, e.g. 'fixed the Q3 numbers'"),
        ifMatchContentHash: z.string().optional().describe("Pass the contentHash from get_artifact to fail instead of clobbering a concurrent edit"),
      },
    },
    async ({ id, content, title, description, visibility, message, ifMatchContentHash }): Promise<CallToolResult> => {
      if (!requiresScope(identity, "artifacts:write")) return toolError("Missing scope: artifacts:write");
      const artifact = await getArtifact(db, id);
      if (!artifact) return toolError("Artifact not found");
      const access = await resolveAccessForIdentity(db, identity, artifact);
      if (!access.write) return toolError("Forbidden: no write access to this artifact");

      try {
        const result = await updateArtifact(db, id, { content, title, description, visibility, message, identity, ifMatchContentHash });
        await recordAudit(db, { orgId: artifact.orgId, identity, action: "artifact.update", targetType: "artifact", targetId: id });
        return ok({ id, newVersionNo: result.version?.versionNo });
      } catch (err) {
        if (err instanceof VersionConflictError) return toolError(`Version conflict: ${err.message}. Call get_artifact again to see the latest content.`);
        if (err instanceof ArtifactTooLargeError || err instanceof QuotaExceededError) return toolError(err.message);
        throw err;
      }
    },
  );

  server.registerTool(
    "delete_artifact",
    { description: "Delete an artifact.", inputSchema: { id: z.string().uuid() } },
    async ({ id }): Promise<CallToolResult> => {
      if (!requiresScope(identity, "artifacts:delete")) return toolError("Missing scope: artifacts:delete");
      const artifact = await getArtifact(db, id);
      if (!artifact) return toolError("Artifact not found");
      const access = await resolveAccessForIdentity(db, identity, artifact);
      if (!access.delete) return toolError("Forbidden: no delete access to this artifact");

      await softDeleteArtifact(db, id);
      await recordAudit(db, { orgId: artifact.orgId, identity, action: "artifact.delete", targetType: "artifact", targetId: id });
      return ok({ deleted: true });
    },
  );

  server.registerTool(
    "create_share",
    {
      description: "Create a link to an artifact that a human can open in a browser, without needing an account.",
      inputSchema: {
        artifactId: z.string().uuid(),
        mode: z.enum(["public", "password"]).default("public"),
        password: z.string().min(4).max(200).optional(),
        expires: z.union([z.string(), z.number()]).optional().describe("e.g. '7d', '12h', or omit for never"),
        versionNo: z.number().int().positive().optional().describe("Pin the link to a specific version instead of always showing the latest"),
      },
    },
    async ({ artifactId, mode, password, expires, versionNo }): Promise<CallToolResult> => {
      if (!requiresScope(identity, "shares:write")) return toolError("Missing scope: shares:write");
      const artifact = await getArtifact(db, artifactId);
      if (!artifact) return toolError("Artifact not found");
      const access = await resolveAccessForIdentity(db, identity, artifact);
      if (!access.write) return toolError("Forbidden: no write access to this artifact");
      if (mode === "password" && !password) return toolError("password is required when mode is 'password'");

      let pinnedVersionId: string | undefined;
      if (versionNo) {
        const version = await getVersionByNumber(db, artifactId, versionNo);
        if (!version) return toolError(`Version ${versionNo} not found`);
        pinnedVersionId = version.id;
      }

      const createdBy = identity.kind === "user" ? identity.userId : identity.agentId;
      const share = await createShare(db, { artifactId, mode, password, expires, pinnedVersionId, createdBy });
      await recordAudit(db, { orgId: artifact.orgId, identity, action: "share.create", targetType: "share", targetId: share.id });
      return ok({ id: share.id, url: `${env.APP_ORIGIN}/s/${share.token}`, mode: share.mode, expiresAt: share.expiresAt });
    },
  );

  server.registerTool(
    "list_shares",
    { description: "List share links created for an artifact.", inputSchema: { artifactId: z.string().uuid() } },
    async ({ artifactId }): Promise<CallToolResult> => {
      const artifact = await getArtifact(db, artifactId);
      if (!artifact) return toolError("Artifact not found");
      const access = await resolveAccessForIdentity(db, identity, artifact);
      if (!access.write) return toolError("Forbidden: no write access to this artifact");

      const list = await listSharesForArtifact(db, artifactId);
      return ok({
        shares: list.map((s) => ({ id: s.id, mode: s.mode, url: `${env.APP_ORIGIN}/s/${s.token}`, viewCount: s.viewCount, expiresAt: s.expiresAt, revokedAt: s.revokedAt })),
      });
    },
  );

  server.registerTool(
    "revoke_share",
    { description: "Revoke a share link so it stops working.", inputSchema: { shareId: z.string().uuid() } },
    async ({ shareId }): Promise<CallToolResult> => {
      if (!requiresScope(identity, "shares:write")) return toolError("Missing scope: shares:write");
      const share = await db.query.shares.findFirst({ where: (s, { eq }) => eq(s.id, shareId) });
      if (!share) return toolError("Share not found");
      const artifact = await getArtifact(db, share.artifactId);
      if (!artifact) return toolError("Artifact not found");
      const access = await resolveAccessForIdentity(db, identity, artifact);
      if (!access.write) return toolError("Forbidden: no write access to this artifact");

      await revokeShare(db, shareId);
      await recordAudit(db, { orgId: artifact.orgId, identity, action: "share.revoke", targetType: "share", targetId: shareId });
      return ok({ revoked: true });
    },
  );

  return server;
}

/**
 * Identity is resolved by the shared `resolveIdentity` middleware (same Bearer-key verification
 * the REST API uses), which also means MCP traffic gets rate-limited and shows up in the admin
 * dashboard's API-activity stats for free. MCP servers speak agent-to-agent, not browser-to-
 * server, so point any MCP client's remote server config at `<APP_ORIGIN>/mcp` with
 * `Authorization: Bearer oa_live_...` — a session cookie won't do anything useful here, since
 * every tool below expects an agent identity.
 */
mcpRoutes.all("/mcp", async (c) => {
  const identity = c.get("identity");
  if (!identity) {
    const keyError = c.get("apiKeyError");
    const code = keyError === "expired" ? "key_expired" : keyError === "revoked" ? "key_revoked" : "unauthorized";
    return c.json({ error: { code, message: "Authorization: Bearer <api key> is required" } }, 401);
  }

  const server = createMcpServer(c.get("db"), c.get("env"), identity);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless: no session to track across requests
    enableJsonResponse: true, // plain JSON responses over SSE — every tool call here is quick
  });
  await server.connect(transport);
  return transport.handleRequest(c.req.raw);
});
