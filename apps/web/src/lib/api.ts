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

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
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
  storageQuotaBytes: number;
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
}
