export const API_KEY_SCOPES = [
  "artifacts:read",
  "artifacts:write",
  "artifacts:delete",
  "shares:write",
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number];

export function isValidScope(value: string): value is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(value);
}

export function hasScope(granted: readonly string[], required: ApiKeyScope): boolean {
  return granted.includes(required);
}
