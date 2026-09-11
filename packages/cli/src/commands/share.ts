import { requireCredentials } from "../config.js";
import { makeClient } from "../client.js";
import { resolveOrg } from "../org.js";
import { handleError } from "./artifacts.js";

export async function shareCommand(id: string, opts: { password?: string; expires?: string; version?: string }) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  try {
    const res = await client.post<{ url: string; token: string }>(`/artifacts/${id}/shares`, {
      mode: opts.password ? "password" : "public",
      password: opts.password,
      expires: opts.expires,
      versionNo: opts.version ? Number(opts.version) : undefined,
    });
    console.log(res.url);
  } catch (err) {
    handleError(err);
  }
}

export async function unshareCommand(shareId: string) {
  const creds = requireCredentials();
  const client = makeClient(creds);
  try {
    await client.delete(`/shares/${shareId}`);
    console.log(`Revoked share ${shareId}`);
  } catch (err) {
    handleError(err);
  }
}

export async function whoamiCommand() {
  const creds = requireCredentials();
  const client = makeClient(creds);
  const kind = creds.kind ?? "agent"; // pre-0.3.0 credentials files never recorded kind — always an agent grant
  const org = resolveOrg({ creds });

  console.log(`Server:  ${creds.server}`);
  console.log(`Auth:    ${kind === "user" ? "personal key (all your teams)" : "agent key"}`);
  if (kind === "agent" && creds.agentId) console.log(`Agent:   ${creds.agentId}`);
  console.log(`Expires: ${creds.expiresAt ?? "never"}`);
  console.log(`Team:    ${org.orgId ? `${org.orgId} (from ${org.source})` : "not selected — run `oa orgs` / `oa use <team>`"}`);

  try {
    await client.get(`/artifacts${org.orgId ? `?orgId=${org.orgId}` : ""}`);
    console.log("Token is valid.");
  } catch (err) {
    handleError(err);
  }
}
