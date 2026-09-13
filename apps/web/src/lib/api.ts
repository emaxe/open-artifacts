// Hand-declared rather than imported from @open-artifacts/shared: that package's "types" field
// points straight at its TS source (see its package.json), and pulling it into web's type-check
// graph drags in server-only modules (e.g. content-hash.ts's `node:crypto`) that web's tsconfig
// has no ambient Node types for. Every other server-shaped type on this page (OrgDetail,
// ArtifactSummary, ...) is declared the same way, for the same reason.
export type ShareMode = "public" | "password" | "team";
export type DefaultShareMode = "public" | "team";

const BASE = "/api/v1";

export class ApiError extends Error {
  /** The full parsed response body, when there was one — e.g. `email_taken`'s `{ inviteToken }` field lives here. */
  constructor(public code: string, message: string, public status: number, public body?: Record<string, unknown>) {
    super(message);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body?.error?.code ?? "unknown_error", body?.error?.message ?? res.statusText, res.status, body);
  }
  return body as T;
}

/**
 * Multipart upload — bypasses `request()`'s hardcoded `Content-Type: application/json` (a
 * `FormData` body needs the browser to set its own `multipart/form-data; boundary=...` header).
 */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", credentials: "include", body: form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(body?.error?.code ?? "unknown_error", body?.error?.message ?? res.statusText, res.status, body);
  }
  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  postForm,
  patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body), headers }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export interface Me {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
  // Own memberships only — for everyone, including superadmins. A superadmin reaches orgs they
  // don't belong to through GET /orgs?search= instead of finding them listed here.
  orgs: { orgId: string; name: string; slug: string; kind: "main" | "team"; role: string | null }[];
  mainOrgId: string | null;
  pendingInviteCount: number;
}

export interface OrgOwnerRef {
  id: string;
  name: string;
  email: string;
}

export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  kind: "main" | "team";
  role: string | null;
  memberCount: number;
  artifactCount: number;
  owner: OrgOwnerRef | null;
  createdAt: string;
}

export interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  kind: "main" | "team";
  /** This team's own override, in bytes. `null` = inherits the instance quota (which itself defaults to unlimited). */
  storageQuotaBytes: number | null;
  /** This team's own per-artifact override, in bytes. `null` = inherits the instance quota. */
  artifactQuotaBytes: number | null;
  /** The instance-wide team quota, in bytes. `null` = unlimited. */
  globalOrgQuotaBytes: number | null;
  /** The instance-wide per-artifact quota, in bytes. `null` = unlimited. */
  globalArtifactQuotaBytes: number | null;
  /** The stricter of the two team-quota values above — what this team is actually held to. `null` = unlimited. */
  effectiveOrgQuotaBytes: number | null;
  /** The stricter of the two per-artifact-quota values above. `null` = unlimited. */
  effectiveArtifactQuotaBytes: number | null;
  /** Bytes currently used by this team (artifact source + uploaded files, live artifacts only). */
  usedBytes: number;
  /** This team's own override, in minutes. `null` = inherits the instance maximum. */
  maxArtifactLifetimeMinutes: number | null;
  /** The instance-wide maximum, in minutes. `null` = unlimited. */
  globalMaxArtifactLifetimeMinutes: number | null;
  /** The stricter of the two above — what new artifacts in this team actually get. `null` = unlimited. */
  effectiveMaxArtifactLifetimeMinutes: number | null;
  /** This team's own default link mode. `null` = inherits the instance default. */
  defaultShareMode: DefaultShareMode | null;
  /** Whether this team itself allows `public` links (it may still be overridden by the instance — see effectiveAllowPublicShares). */
  allowPublicShares: boolean;
  /** The instance-wide default link mode. */
  globalDefaultShareMode: DefaultShareMode;
  /** Whether the instance allows `public` links at all. */
  globalAllowPublicShares: boolean;
  /** The mode actually used when a share is created without naming one. */
  effectiveDefaultShareMode: DefaultShareMode;
  /** Whether a `public` link can actually be created right now (team AND instance both allow it). */
  effectiveAllowPublicShares: boolean;
  createdAt: string;
  memberCount: number;
  artifactCount: number;
  owner: OrgOwnerRef | null;
  myRole: string | null;
}

export interface OrgMember {
  userId: string;
  email?: string;
  name?: string;
  role: string;
}

export type InviteStatus = "pending" | "accepted" | "declined" | "revoked";

export interface OrgInvite {
  id: string;
  orgId: string;
  email: string;
  role: string;
  token: string;
  status: InviteStatus;
  expiresAt: string;
  expired: boolean;
  inviterName: string | null;
  inviterEmail: string | null;
}

export interface CreateInviteResult {
  id: string;
  token: string;
  acceptUrl: string;
  email: string;
  role: string;
  status: InviteStatus;
  expiresAt: string;
  accountExists: boolean;
  reissued: boolean;
}

export interface InvitePreview {
  orgId: string;
  orgName: string;
  orgKind: "main" | "team";
  inviterName: string | null;
  role: string;
  emailMasked: string;
  status: InviteStatus;
  expired: boolean;
}

export interface PendingInviteForUser {
  id: string;
  token: string;
  orgId: string;
  orgName: string;
  orgKind: "main" | "team";
  role: string;
  inviterName: string | null;
  expiresAt: string;
  expired: boolean;
}

export interface AuditActorRef {
  id: string;
  name: string;
  email: string;
}

export interface AuditEntryView {
  id: string;
  orgId: string | null;
  orgName: string | null;
  actorType: string;
  actorId: string | null;
  actor: AuditActorRef | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: unknown;
  at: string;
}

export interface AdminUserListItem {
  id: string;
  email: string;
  name: string;
  isSuperadmin: boolean;
  status: "active" | "blocked" | "deleted";
  createdAt: string;
  orgs: { orgId: string; name: string; kind: "main" | "team"; role: string }[];
  orgCount: number;
}

export interface ArtifactSummary {
  id: string;
  orgId: string;
  title: string;
  description: string | null;
  kind: "html" | "markdown" | "mermaid" | "svg";
  visibility: "private" | "org";
  ownerType: "user" | "agent";
  ownerId: string;
  sizeBytes: number;
  createdAt: string;
  updatedAt: string;
  /** `null` = never expires. */
  expiresAt: string | null;
}
