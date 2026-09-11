import type { Credentials } from "./config.js";

export interface OrgChoice {
  orgId: string;
  name: string;
  slug: string;
  kind: "main" | "team";
  role: string;
}

export class CliApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    /** The parsed error body, e.g. `{ error: { code, message, orgs } }` for `org_required`. */
    public body?: { error?: { code?: string; message?: string; orgs?: OrgChoice[]; maxLifetimeMinutes?: number } },
  ) {
    super(message);
  }
}

export function makeClient(creds: Credentials) {
  const base = `${creds.server.replace(/\/$/, "")}/api/v1`;

  async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.token}`,
        ...options.headers,
      },
    });
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; orgs?: OrgChoice[] } };
    if (!res.ok) {
      throw new CliApiError(body?.error?.code ?? "unknown_error", body?.error?.message ?? res.statusText, res.status, body);
    }
    return body as T;
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>(path, { method: "PATCH", body: JSON.stringify(body), headers }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}

export type Client = ReturnType<typeof makeClient>;
