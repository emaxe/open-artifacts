ALTER TABLE "artifacts" ADD COLUMN "expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "max_artifact_lifetime_minutes" integer;--> statement-breakpoint
CREATE INDEX "artifacts_expiry_idx" ON "artifacts" USING btree ("expires_at") WHERE "artifacts"."expires_at" is not null and "artifacts"."purged_at" is null;