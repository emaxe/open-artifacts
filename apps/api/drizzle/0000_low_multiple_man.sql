CREATE TYPE "public"."artifact_kind" AS ENUM('html', 'markdown', 'mermaid', 'svg');--> statement-breakpoint
CREATE TYPE "public"."artifact_visibility" AS ENUM('private', 'org');--> statement-breakpoint
CREATE TYPE "public"."device_auth_status" AS ENUM('pending', 'approved', 'denied', 'expired', 'consumed');--> statement-breakpoint
CREATE TYPE "public"."org_role" AS ENUM('owner', 'admin', 'member', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."owner_type" AS ENUM('user', 'agent');--> statement-breakpoint
CREATE TYPE "public"."registration_mode" AS ENUM('open', 'invite_only', 'closed');--> statement-breakpoint
CREATE TYPE "public"."share_mode" AS ENUM('public', 'password');--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"scopes" text[] NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_usage_hourly" (
	"org_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"key_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"method" text NOT NULL,
	"status_class" text NOT NULL,
	"hour" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"total_duration_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_hourly_org_id_endpoint_method_status_class_hour_key_id_pk" PRIMARY KEY("org_id","endpoint","method","status_class","hour","key_id")
);
--> statement-breakpoint
CREATE TABLE "artifact_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"version_no" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_by_type" "owner_type" NOT NULL,
	"created_by_id" uuid NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "artifact_view_daily" (
	"artifact_id" uuid NOT NULL,
	"day" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"uniques" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "artifact_view_daily_artifact_id_day_pk" PRIMARY KEY("artifact_id","day")
);
--> statement-breakpoint
CREATE TABLE "artifact_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"share_id" uuid,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_hash" text,
	"ua_hash" text,
	"referer" text
);
--> statement-breakpoint
CREATE TABLE "artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"owner_type" "owner_type" NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"kind" "artifact_kind" NOT NULL,
	"current_version_id" uuid,
	"visibility" "artifact_visibility" DEFAULT 'private' NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_type" text,
	"target_id" text,
	"meta" jsonb,
	"ip" text,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_auth_requests" (
	"device_code" text PRIMARY KEY NOT NULL,
	"user_code" text NOT NULL,
	"agent_name" text NOT NULL,
	"requested_scopes" text[] NOT NULL,
	"status" "device_auth_status" DEFAULT 'pending' NOT NULL,
	"org_id" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"last_polled_at" timestamp with time zone,
	"approved_by" uuid,
	"issued_key_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_members" (
	"org_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "org_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "org_members_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"storage_quota_bytes" integer DEFAULT 1073741824 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"token" text NOT NULL,
	"mode" "share_mode" DEFAULT 'public' NOT NULL,
	"password_hash" text,
	"expires_at" timestamp with time zone,
	"pinned_version_id" uuid,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_by" uuid NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"is_superadmin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_hourly" ADD CONSTRAINT "api_usage_hourly_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_hourly" ADD CONSTRAINT "api_usage_hourly_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_usage_hourly" ADD CONSTRAINT "api_usage_hourly_key_id_api_keys_id_fk" FOREIGN KEY ("key_id") REFERENCES "public"."api_keys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_versions" ADD CONSTRAINT "artifact_versions_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_view_daily" ADD CONSTRAINT "artifact_view_daily_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_views" ADD CONSTRAINT "artifact_views_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifact_views" ADD CONSTRAINT "artifact_views_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "artifacts" ADD CONSTRAINT "artifacts_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_auth_requests" ADD CONSTRAINT "device_auth_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_auth_requests" ADD CONSTRAINT "device_auth_requests_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_auth_requests" ADD CONSTRAINT "device_auth_requests_issued_key_id_api_keys_id_fk" FOREIGN KEY ("issued_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_members" ADD CONSTRAINT "org_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_pinned_version_id_artifact_versions_id_fk" FOREIGN KEY ("pinned_version_id") REFERENCES "public"."artifact_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agents_org_id_idx" ON "agents" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_prefix_idx" ON "api_keys" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "api_keys_agent_id_idx" ON "api_keys" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "api_usage_hourly_org_id_idx" ON "api_usage_hourly" USING btree ("org_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_versions_artifact_version_idx" ON "artifact_versions" USING btree ("artifact_id","version_no");--> statement-breakpoint
CREATE INDEX "artifact_views_artifact_id_idx" ON "artifact_views" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX "artifacts_org_id_idx" ON "artifacts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "artifacts_owner_idx" ON "artifacts" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "audit_log_org_id_idx" ON "audit_log" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "device_auth_requests_user_code_idx" ON "device_auth_requests" USING btree ("user_code");--> statement-breakpoint
CREATE UNIQUE INDEX "invites_token_idx" ON "invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "org_members_user_id_idx" ON "org_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_slug_idx" ON "orgs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shares_token_idx" ON "shares" USING btree ("token");--> statement-breakpoint
CREATE INDEX "shares_artifact_id_idx" ON "shares" USING btree ("artifact_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");