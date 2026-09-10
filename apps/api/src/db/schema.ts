import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const orgRoleEnum = pgEnum("org_role", ["owner", "admin", "member", "viewer"]);
export const artifactKindEnum = pgEnum("artifact_kind", ["html", "markdown", "mermaid", "svg"]);
export const artifactVisibilityEnum = pgEnum("artifact_visibility", ["private", "org"]);
export const ownerTypeEnum = pgEnum("owner_type", ["user", "agent"]);
export const shareModeEnum = pgEnum("share_mode", ["public", "password"]);
export const deviceAuthStatusEnum = pgEnum("device_auth_status", [
  "pending",
  "approved",
  "denied",
  "expired",
  "consumed",
]);
export const registrationModeEnum = pgEnum("registration_mode", ["open", "invite_only", "closed"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("sessions_user_id_idx").on(table.userId)]);

export const orgs = pgTable("orgs", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  storageQuotaBytes: integer("storage_quota_bytes").notNull().default(1_073_741_824), // 1 GiB
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("orgs_slug_idx").on(table.slug)]);

export const orgMembers = pgTable("org_members", {
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: orgRoleEnum("role").notNull().default("member"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.orgId, table.userId] }),
  index("org_members_user_id_idx").on(table.userId),
]);

export const invites = pgTable("invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: orgRoleEnum("role").notNull().default("member"),
  token: text("token").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("invites_token_idx").on(table.token)]);

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index("agents_org_id_idx").on(table.orgId)]);

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull(),
  scopes: text("scopes").array().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("api_keys_prefix_idx").on(table.prefix),
  index("api_keys_agent_id_idx").on(table.agentId),
]);

export const deviceAuthRequests = pgTable("device_auth_requests", {
  deviceCode: text("device_code").primaryKey(),
  userCode: text("user_code").notNull(),
  agentName: text("agent_name").notNull(),
  requestedScopes: text("requested_scopes").array().notNull(),
  status: deviceAuthStatusEnum("status").notNull().default("pending"),
  orgId: uuid("org_id").references(() => orgs.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
  approvedBy: uuid("approved_by").references(() => users.id),
  issuedKeyId: uuid("issued_key_id").references((): any => apiKeys.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("device_auth_requests_user_code_idx").on(table.userCode)]);

export const artifacts = pgTable("artifacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  ownerType: ownerTypeEnum("owner_type").notNull(),
  ownerId: uuid("owner_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  kind: artifactKindEnum("kind").notNull(),
  currentVersionId: uuid("current_version_id"),
  visibility: artifactVisibilityEnum("visibility").notNull().default("private"),
  sizeBytes: integer("size_bytes").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [
  index("artifacts_org_id_idx").on(table.orgId),
  index("artifacts_owner_idx").on(table.ownerType, table.ownerId),
]);

export const artifactVersions = pgTable("artifact_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  artifactId: uuid("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  versionNo: integer("version_no").notNull(),
  content: text("content").notNull(),
  contentHash: text("content_hash").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdByType: ownerTypeEnum("created_by_type").notNull(),
  createdById: uuid("created_by_id").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("artifact_versions_artifact_version_idx").on(table.artifactId, table.versionNo),
]);

export const shares = pgTable("shares", {
  id: uuid("id").primaryKey().defaultRandom(),
  artifactId: uuid("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  mode: shareModeEnum("mode").notNull().default("public"),
  passwordHash: text("password_hash"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  pinnedVersionId: uuid("pinned_version_id").references(() => artifactVersions.id),
  viewCount: integer("view_count").notNull().default(0),
  createdBy: uuid("created_by").notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("shares_token_idx").on(table.token),
  index("shares_artifact_id_idx").on(table.artifactId),
]);

export const artifactViews = pgTable("artifact_views", {
  id: uuid("id").primaryKey().defaultRandom(),
  artifactId: uuid("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  shareId: uuid("share_id").references(() => shares.id, { onDelete: "set null" }),
  viewedAt: timestamp("viewed_at", { withTimezone: true }).notNull().defaultNow(),
  ipHash: text("ip_hash"),
  uaHash: text("ua_hash"),
  referer: text("referer"),
}, (table) => [index("artifact_views_artifact_id_idx").on(table.artifactId)]);

export const artifactViewDaily = pgTable("artifact_view_daily", {
  artifactId: uuid("artifact_id").notNull().references(() => artifacts.id, { onDelete: "cascade" }),
  day: text("day").notNull(), // YYYY-MM-DD
  views: integer("views").notNull().default(0),
  uniques: integer("uniques").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.artifactId, table.day] })]);

export const apiUsageHourly = pgTable("api_usage_hourly", {
  orgId: uuid("org_id").notNull().references(() => orgs.id, { onDelete: "cascade" }),
  // Non-null in practice: usage metering only tracks agent/API-key traffic (see services/analytics.ts),
  // and both columns participate in the composite primary key below, which Postgres requires NOT NULL.
  agentId: uuid("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  keyId: uuid("key_id").notNull().references(() => apiKeys.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  method: text("method").notNull(),
  statusClass: text("status_class").notNull(), // "2xx" | "4xx" | "5xx"
  hour: text("hour").notNull(), // YYYY-MM-DDTHH
  count: integer("count").notNull().default(0),
  totalDurationMs: integer("total_duration_ms").notNull().default(0),
}, (table) => [
  primaryKey({ columns: [table.orgId, table.endpoint, table.method, table.statusClass, table.hour, table.keyId] }),
  index("api_usage_hourly_org_id_idx").on(table.orgId),
]);

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").references(() => orgs.id, { onDelete: "cascade" }),
  actorType: text("actor_type").notNull(), // "user" | "agent" | "system"
  actorId: text("actor_id"),
  action: text("action").notNull(),
  targetType: text("target_type"),
  targetId: text("target_id"),
  meta: jsonb("meta"),
  ip: text("ip"),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("audit_log_org_id_idx").on(table.orgId),
  index("audit_log_at_idx").on(table.at),
]);

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  orgMemberships: many(orgMembers),
  sessions: many(sessions),
}));

export const orgsRelations = relations(orgs, ({ many }) => ({
  members: many(orgMembers),
  agents: many(agents),
  artifacts: many(artifacts),
}));

export const artifactsRelations = relations(artifacts, ({ many }) => ({
  versions: many(artifactVersions),
  shares: many(shares),
}));

export const artifactVersionsRelations = relations(artifactVersions, ({ one }) => ({
  artifact: one(artifacts, { fields: [artifactVersions.artifactId], references: [artifacts.id] }),
}));

export const agentsRelations = relations(agents, ({ many, one }) => ({
  apiKeys: many(apiKeys),
  org: one(orgs, { fields: [agents.orgId], references: [orgs.id] }),
}));
