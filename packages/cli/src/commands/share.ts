import { requireCredentials } from "../config.js";
import { makeClient } from "../client.js";
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
  console.log(`Server:  ${creds.server}`);
  console.log(`Org:     ${creds.orgId}`);
  console.log(`Agent:   ${creds.agentId}`);
  console.log(`Expires: ${creds.expiresAt ?? "never"}`);
  try {
    await client.get(`/artifacts?orgId=${creds.orgId}`);
    console.log("Token is valid.");
  } catch (err) {
    handleError(err);
  }
}
