import { and, eq } from "drizzle-orm";
import type { ApiKeyScope } from "@open-artifacts/shared";
import type { Database } from "../db/client.js";
import { deviceAuthRequests } from "../db/schema.js";
import { generateDeviceCode, generateUserCode } from "./crypto.js";
import { createAgent, issueApiKey } from "./agents.js";

const DEVICE_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const DEVICE_POLL_INTERVAL_SECONDS = 5;

export async function createDeviceAuthRequest(db: Database, agentName: string, scopes: ApiKeyScope[]) {
  const deviceCode = generateDeviceCode();
  const userCode = generateUserCode();
  const expiresAt = new Date(Date.now() + DEVICE_CODE_TTL_MS);

  await db.insert(deviceAuthRequests).values({
    deviceCode,
    userCode,
    agentName,
    requestedScopes: scopes,
    status: "pending",
    expiresAt,
  });

  return {
    deviceCode,
    userCode,
    expiresIn: DEVICE_CODE_TTL_MS / 1000,
    interval: DEVICE_POLL_INTERVAL_SECONDS,
  };
}

export async function findPendingByUserCode(db: Database, userCode: string) {
  return db.query.deviceAuthRequests.findFirst({
    where: and(eq(deviceAuthRequests.userCode, userCode.toUpperCase()), eq(deviceAuthRequests.status, "pending")),
  });
}

export type ApproveResult =
  | { ok: true }
  | { ok: false; error: "not_found" | "expired" | "already_resolved" };

export async function approveDeviceAuthRequest(
  db: Database,
  userCode: string,
  approverId: string,
  orgId: string,
): Promise<ApproveResult> {
  const request = await findPendingByUserCode(db, userCode);
  if (!request) return { ok: false, error: "not_found" };
  if (request.expiresAt.getTime() <= Date.now()) return { ok: false, error: "expired" };

  await db
    .update(deviceAuthRequests)
    .set({ status: "approved", approvedBy: approverId, orgId })
    .where(eq(deviceAuthRequests.deviceCode, request.deviceCode));
  return { ok: true };
}

export async function denyDeviceAuthRequest(db: Database, userCode: string): Promise<ApproveResult> {
  const request = await findPendingByUserCode(db, userCode);
  if (!request) return { ok: false, error: "not_found" };
  await db.update(deviceAuthRequests).set({ status: "denied" }).where(eq(deviceAuthRequests.deviceCode, request.deviceCode));
  return { ok: true };
}

export type PollResult =
  | { status: "authorization_pending" }
  | { status: "slow_down" }
  | { status: "expired_token" }
  | { status: "access_denied" }
  | { status: "ok"; apiKey: string; expiresAt: Date | null; orgId: string; agentId: string };

/**
 * Polled by the CLI. On first successful poll after approval, provisions the agent + API key
 * and marks the request "consumed" so a stolen device_code can't be replayed for a second key.
 */
export async function pollDeviceAuthRequest(
  db: Database,
  deviceCode: string,
  defaultKeyTtlDays: number,
): Promise<PollResult> {
  const request = await db.query.deviceAuthRequests.findFirst({ where: eq(deviceAuthRequests.deviceCode, deviceCode) });
  if (!request) return { status: "expired_token" };
  if (request.expiresAt.getTime() <= Date.now() && request.status === "pending") {
    await db.update(deviceAuthRequests).set({ status: "expired" }).where(eq(deviceAuthRequests.deviceCode, deviceCode));
    return { status: "expired_token" };
  }

  if (request.status === "pending") {
    if (request.lastPolledAt && Date.now() - request.lastPolledAt.getTime() < DEVICE_POLL_INTERVAL_SECONDS * 1000) {
      return { status: "slow_down" };
    }
    await db.update(deviceAuthRequests).set({ lastPolledAt: new Date() }).where(eq(deviceAuthRequests.deviceCode, deviceCode));
    return { status: "authorization_pending" };
  }
  if (request.status === "denied") return { status: "access_denied" };
  if (request.status === "expired") return { status: "expired_token" };
  if (request.status === "consumed") return { status: "expired_token" }; // one-time use only

  // approved
  const orgId = request.orgId;
  if (!orgId || !request.approvedBy) return { status: "expired_token" };

  const agent = await createAgent(db, orgId, request.approvedBy, request.agentName);
  const key = await issueApiKey(db, agent.id, request.requestedScopes as ApiKeyScope[], undefined, defaultKeyTtlDays);

  await db
    .update(deviceAuthRequests)
    .set({ status: "consumed", issuedKeyId: key.id })
    .where(eq(deviceAuthRequests.deviceCode, deviceCode));

  return { status: "ok", apiKey: key.token, expiresAt: key.expiresAt, orgId, agentId: agent.id };
}
