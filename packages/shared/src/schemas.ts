import { z } from "zod";
import { API_KEY_SCOPES } from "./scopes.js";

export const artifactKindSchema = z.enum(["html", "markdown", "mermaid", "svg"]);
export type ArtifactKind = z.infer<typeof artifactKindSchema>;

export const artifactVisibilitySchema = z.enum(["private", "org"]);
export type ArtifactVisibilitySchema = z.infer<typeof artifactVisibilitySchema>;

export const orgRoleSchema = z.enum(["owner", "admin", "member", "viewer"]);

export const apiKeyScopeSchema = z.enum(API_KEY_SCOPES);

export const createArtifactSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  kind: artifactKindSchema,
  content: z.string().min(1),
  visibility: artifactVisibilitySchema.default("private"),
});
export type CreateArtifactInput = z.infer<typeof createArtifactSchema>;

export const updateArtifactSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  visibility: artifactVisibilitySchema.optional(),
  content: z.string().min(1).optional(),
  message: z.string().max(500).optional(),
});
export type UpdateArtifactInput = z.infer<typeof updateArtifactSchema>;

export const createShareSchema = z.object({
  mode: z.enum(["public", "password"]),
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

export const deviceCodeRequestSchema = z.object({
  agentName: z.string().min(1).max(100),
  scopes: z.array(apiKeyScopeSchema).min(1),
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
