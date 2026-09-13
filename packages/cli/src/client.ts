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
    public body?: {
      error?: {
        code?: string;
        message?: string;
        orgs?: OrgChoice[];
        maxLifetimeMinutes?: number;
        // public_shares_forbidden
        allowedModes?: string[];
        defaultShareMode?: string;
        // quota_exceeded
        scope?: "org" | "artifact";
        limitBytes?: number;
        usedBytes?: number;
        // file_too_large
        maxFileBytes?: number;
      };
    },
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

  /**
   * Multipart upload — the one request shape `request()`'s hardcoded `Content-Type:
   * application/json` can't send. Passing a `FormData` body to `fetch` sets its own
   * `multipart/form-data; boundary=...` header, so this bypasses `request()` and builds the
   * fetch call directly rather than fighting that default.
   */
  async function postForm<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`${base}${path}`, { method: "POST", headers: { Authorization: `Bearer ${creds.token}` }, body: form });
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string } };
    if (!res.ok) {
      throw new CliApiError(body?.error?.code ?? "unknown_error", body?.error?.message ?? res.statusText, res.status, body);
    }
    return body as T;
  }

  return {
    get: <T>(path: string) => request<T>(path),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    postForm,
    patch: <T>(path: string, body?: unknown, headers?: Record<string, string>) =>
      request<T>(path, { method: "PATCH", body: JSON.stringify(body), headers }),
    delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  };
}

export type Client = ReturnType<typeof makeClient>;
