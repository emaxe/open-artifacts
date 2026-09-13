import { z } from "zod";
import { API_KEY_SCOPES } from "./scopes.js";
import { DEFAULT_SHARE_MODES, SHARE_MODES } from "./share-policy.js";

export const artifactKindSchema = z.enum(["html", "markdown", "mermaid", "svg"]);
export type ArtifactKind = z.infer<typeof artifactKindSchema>;

export const artifactVisibilitySchema = z.enum(["private", "org"]);
export type ArtifactVisibilitySchema = z.infer<typeof artifactVisibilitySchema>;

export const orgRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);

// Deliberately not named `expires` like `createShareSchema.expires` below: a bare number there
// means DAYS, while here (artifact lifetime) a bare number means MINUTES. Same name, different
// unit, would be a trap. Accepts a number of minutes, a duration string ("30m"/"2h"/"7d"), or
// "0"/null for "no lifetime chosen" (falls back to the org's effective default/max). See
// `parseLifetimeMinutes` in `./lifetime.ts`.
const lifetimeSchema = z.union([z.string(), z.number()]).nullable().optional();

export const createArtifactSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  kind: artifactKindSchema,
  content: z.string().min(1),
  visibility: artifactVisibilitySchema.default("private"),
  lifetime: lifetimeSchema,
});
export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;

export const updateArtifactSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  visibility: artifactVisibilitySchema.optional(),
  content: z.string().min(1).optional(),
  message: z.string().max(500).optional(),
  lifetime: lifetimeSchema,
});
export type UpdateArtifactInput = z.infer<typeof updateArtifactSchema>;

export const shareModeSchema = z.enum(SHARE_MODES);
export type ShareModeSchema = z.infer<typeof shareModeSchema>;

export const defaultShareModeSchema = z.enum(DEFAULT_SHARE_MODES);
export type DefaultShareModeSchema = z.infer<typeof defaultShareModeSchema>;

export const createShareSchema = z.object({
  // Optional: omitting it means "use the team's configured default link mode" — see
  // resolveRequestedShareMode in ./share-policy.ts. `mode` used to be required, so no existing
  // caller omits it; this is purely additive.
  mode: shareModeSchema.optional(),
  password: z.string().min(4).max(200).optional(),
  expires: z.union([z.string(), z.number()]).optional(),
  versionNo: z.number().int().positive().optional(),
});
export type CreateShareInput = z.infer<typeof createShareSchema>;

export const unlockShareSchema = z.object({
  password: z.string().min(1),
});

export const createAgentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});
export type CreateAgentInput = z.infer<typeof createAgentSchema>;

export const createApiKeySchema = z.object({
  scopes: z.array(apiKeyScopeSchema).min(1),
  expires: z.union([z.string(), z.number()]).optional(),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

/** For POST /me/keys — a personal key isn't tied to an agent, so it carries its own device label instead. */
export const createUserApiKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  scopes: z.array(apiKeyScopeSchema).min(1),
  expires: z.union([z.string(), z.number()]).optional(),
});
export type CreateUserApiKeyInput = z.infer<typeof createUserApiKeySchema>;

export const deviceGrantKindSchema = z.enum(["agent", "user"]);
export type DeviceGrantKind = z.infer<typeof deviceGrantKindSchema>;

export const deviceCodeRequestSchema = z.object({
  // Device/agent display name either way: an agent locked to one team, or the label for a
  // personal key's issuing device (e.g. "MacBook CLI"). Old clients never send grantKind, so it
  // defaults to "agent" — the only grant kind that ever existed before personal keys.
  agentName: z.string().min(1).max(100),
  scopes: z.array(apiKeyScopeSchema).min(1),
  grantKind: deviceGrantKindSchema.default("agent"),
});
export type DeviceCodeRequestInput = z.infer<typeof deviceCodeRequestSchema>;

export const deviceTokenRequestSchema = z.object({
  deviceCode: z.string().min(1),
  grantType: z.literal("urn:ietf:params:oauth:grant-type:device_code"),
});
export type DeviceTokenRequestInput = z.infer<typeof deviceTokenRequestSchema>;

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const inviteStatusSchema = z.enum(["pending", "accepted", "declined", "revoked"]);
export type InviteStatus = z.infer<typeof inviteStatusSchema>;

export const createInviteSchema = z.object({
  email: z.string().email(),
  role: orgRoleSchema.default("member"),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
