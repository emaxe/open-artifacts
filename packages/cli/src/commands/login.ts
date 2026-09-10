import { hostname } from "node:os";
import { saveCredentials } from "../config.js";

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

type TokenResponse =
  | { error: "authorization_pending" | "slow_down" | "expired_token" | "access_denied" }
  | { api_key: string; expires_at: string | null; org_id: string; agent_id: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function login(opts: { server: string; name?: string; scopes: string[] }) {
  const server = opts.server.replace(/\/$/, "");
  const agentName = opts.name ?? `cli-${hostname()}`;

  const codeRes = await fetch(`${server}/api/v1/oauth/device/code`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentName, scopes: opts.scopes }),
  });
  if (!codeRes.ok) {
    console.error(`Failed to start device authorization: ${codeRes.status} ${await codeRes.text()}`);
    process.exit(1);
  }
  const device = (await codeRes.json()) as DeviceCodeResponse;

  console.log(`\nTo authorize this device, open:\n\n  ${device.verification_uri_complete}\n`);
  console.log(`If prompted, enter code: ${device.user_code}\n`);
  console.log("Waiting for approval...");

  const deadline = Date.now() + device.expires_in * 1000;
  let interval = device.interval * 1000;

  while (Date.now() < deadline) {
    await sleep(interval);
    const tokenRes = await fetch(`${server}/api/v1/oauth/device/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceCode: device.device_code, grantType: "urn:ietf:params:oauth:grant-type:device_code" }),
    });
    const body = (await tokenRes.json()) as TokenResponse;

    if ("api_key" in body) {
      saveCredentials({ server, token: body.api_key, agentId: body.agent_id, orgId: body.org_id, expiresAt: body.expires_at });
      console.log(`\nLogged in. Credentials saved to ~/.config/open-artifacts/credentials.json`);
      return;
    }

    if (body.error === "slow_down") {
      interval += 5000;
      continue;
    }
    if (body.error === "authorization_pending") continue;
    if (body.error === "access_denied") {
      console.error("Authorization was denied.");
      process.exit(1);
    }
    if (body.error === "expired_token") {
      console.error("Device code expired. Run `oa login` again.");
      process.exit(1);
    }
  }

  console.error("Timed out waiting for approval.");
  process.exit(1);
}
