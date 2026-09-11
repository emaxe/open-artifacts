import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
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
export const userStatusEnum = pgEnum("user_status", ["active", "blocked", "deleted"]);
export const orgKindEnum = pgEnum("org_kind", ["main", "team"]);
export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted", "declined", "revoked"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  status: userStatusEnum("status").notNull().default("active"),
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
  kind: orgKindEnum("kind").notNull().default("team"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("orgs_slug_idx").on(table.slug),
  index("orgs_kind_idx").on(table.kind),
  // At most one "main" (auto-provisioned personal) workspace per user.
  uniqueIndex("orgs_main_owner_idx").on(table.createdBy).where(sql`kind = 'main'`),
]);

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
  // Always lowercased by services/invites.ts before insert/update — normalizeEmail() is the one chokepoint.
  email: text("email").notNull(),
  role: orgRoleEnum("role").notNull().default("member"),
  token: text("token").notNull(),
  status: inviteStatusEnum("status").notNull().default("pending"),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  // Denormalized convenience only — never an authorization input. Accept/decline always re-check
  // invites.email against the live user's current email (see services/invites.ts).
  invitedUserId: uuid("invited_user_id").references(() => users.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  respondedAt: timestamp("responded_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("invites_token_idx").on(table.token),
  // At most one live invite per (org, email) at a time; re-inviting reissues the same row.
  uniqueIndex("invites_pending_org_email_idx").on(table.orgId, table.email).where(sql`status = 'pending'`),
  index("invites_email_idx").on(table.email),
  index("invites_org_id_idx").on(table.orgId),
  check("invites_email_lower_check", sql`${table.email} = lower(${table.email})`),
]);

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
  // Exactly one of agentId/userId is set (see api_keys_owner_check below): agent-scoped keys are
  // locked to one org via agents.orgId; user-scoped ("personal") keys act across every org the
  // user is a member of, resolved fresh per request — see services/org-scope.ts.
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  // Device label for personal keys (e.g. "MacBook CLI"); null for agent keys, which are named via agents.name.
  name: text("name"),
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
  index("api_keys_user_id_idx").on(table.userId),
  check("api_keys_owner_check", sql`num_nonnulls(${table.agentId}, ${table.userId}) = 1`),
]);

export const deviceAuthRequests = pgTable("device_auth_requests", {
  deviceCode: text("device_code").primaryKey(),
  userCode: text("user_code").notNull(),
  agentName: text("agent_name").notNull(),
  requestedScopes: text("requested_scopes").array().notNull(),
  status: deviceAuthStatusEnum("status").notNull().default("pending"),
  // "agent": locked to orgId at approval time (unchanged behavior). "user": personal key spanning
  // all the approver's orgs — orgId stays null. Old clients never send this, so it defaults to "agent".
  grantKind: text("grant_kind").notNull().default("agent"),
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
  // Null for personal (user-scoped) key traffic — those keys aren't tied to an agent. keyId alone
  // (not in the PK's uniqueness the way orgId is) is enough to attribute usage either way.
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
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

export const orgMembersRelations = relations(orgMembers, ({ one }) => ({
  org: one(orgs, { fields: [orgMembers.orgId], references: [orgs.id] }),
  user: one(users, { fields: [orgMembers.userId], references: [users.id] }),
}));

export const invitesRelations = relations(invites, ({ one }) => ({
  org: one(orgs, { fields: [invites.orgId], references: [orgs.id] }),
  inviter: one(users, { fields: [invites.invitedBy], references: [users.id], relationName: "invite_inviter" }),
  invitedUser: one(users, { fields: [invites.invitedUserId], references: [users.id], relationName: "invite_invitee" }),
}));
