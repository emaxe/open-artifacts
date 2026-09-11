const BASE = "/api/v1";

export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) {
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
    throw new ApiError(body?.error?.code ?? "unknown_error", body?.error?.message ?? res.statusText, res.status);
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
  orgs: { orgId: string; name: string; role: string | null }[];
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
