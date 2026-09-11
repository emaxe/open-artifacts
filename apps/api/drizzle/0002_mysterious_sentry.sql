CREATE TYPE "public"."invite_status" AS ENUM('pending', 'accepted', 'declined', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."org_kind" AS ENUM('main', 'team');--> statement-breakpoint

-- orgs: kind + creator. Every org created before this migration was created explicitly via
-- POST /orgs, so the "team" default is correct for all of them without a separate UPDATE.
ALTER TABLE "orgs" ADD COLUMN "kind" "org_kind" DEFAULT 'team' NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "created_by" uuid;--> statement-breakpoint

-- Backfill created_by from the earliest owner on record. Orgs with no owner (shouldn't happen,
-- but nothing enforced it before this release) are deliberately left NULL rather than guessed.
UPDATE "orgs" o SET "created_by" = (
  SELECT m.user_id FROM "org_members" m
  WHERE m.org_id = o.id AND m.role = 'owner'
  ORDER BY m.created_at ASC
  LIMIT 1
) WHERE o."created_by" IS NULL;--> statement-breakpoint

ALTER TABLE "orgs" ADD CONSTRAINT "orgs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orgs_kind_idx" ON "orgs" USING btree ("kind");--> statement-breakpoint
CREATE UNIQUE INDEX "orgs_main_owner_idx" ON "orgs" USING btree ("created_by") WHERE kind = 'main';--> statement-breakpoint

-- invites: status machine replaces the accepted_at-only model, plus inviter/invitee tracking.
ALTER TABLE "invites" ADD COLUMN "status" "invite_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "invited_by" uuid;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "invited_user_id" uuid;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "responded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "revoked_at" timestamp with time zone;--> statement-breakpoint

-- Normalize existing emails to lowercase before the check constraint below enforces it going
-- forward (normalizeEmail() in services/invites.ts is the one chokepoint for new writes).
UPDATE "invites" SET "email" = lower("email") WHERE "email" <> lower("email");--> statement-breakpoint

-- Backfill status/responded_at from the column being retired. invited_user_id is left NULL here —
-- it's a denormalized UI convenience only, never an authorization input (see schema.ts), and
-- backfilling it would require guessing at email->user matches for historical data.
UPDATE "invites" SET "status" = 'accepted', "responded_at" = "accepted_at" WHERE "accepted_at" IS NOT NULL;--> statement-breakpoint

ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_invited_user_id_users_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invites_pending_org_email_idx" ON "invites" USING btree ("org_id","email") WHERE status = 'pending';--> statement-breakpoint
CREATE INDEX "invites_email_idx" ON "invites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "invites_org_id_idx" ON "invites" USING btree ("org_id");--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_email_lower_check" CHECK ("invites"."email" = lower("invites"."email"));
