-- Hand-written: drizzle-kit generates `ALTER TYPE "share_mode" ADD VALUE 'team';` here, but that
-- cannot be used in this project. The node-postgres migrator (drizzle-orm's PgDialect.migrate)
-- runs every pending migration inside ONE transaction, and Postgres forbids USING a newly added
-- enum value inside the same transaction that added it (error 55P04) — which the
-- orgs_default_share_mode_check constraint below would trigger immediately. Splitting the ADD
-- VALUE into its own migration file would not help either, since all pending migrations still
-- share that one transaction on a fresh install. Recreating the type instead is fully
-- transaction-safe: a type CREATEd earlier in the same transaction can be used right away.
ALTER TABLE "shares" ALTER COLUMN "mode" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."share_mode" RENAME TO "share_mode_old";--> statement-breakpoint
CREATE TYPE "public"."share_mode" AS ENUM('public', 'password', 'team');--> statement-breakpoint
ALTER TABLE "shares" ALTER COLUMN "mode" TYPE "public"."share_mode" USING "mode"::text::"public"."share_mode";--> statement-breakpoint
ALTER TABLE "shares" ALTER COLUMN "mode" SET DEFAULT 'public';--> statement-breakpoint
DROP TYPE "public"."share_mode_old";--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "default_share_mode" "public"."share_mode";--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "allow_public_shares" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD CONSTRAINT "orgs_default_share_mode_check" CHECK ("orgs"."default_share_mode" is null or "orgs"."default_share_mode" <> 'password');
