CREATE TABLE "artifact_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"token" text NOT NULL,
	"storage_key" text NOT NULL,
	"name" text NOT NULL,
	"content_type" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"checksum" text,
	"created_by_type" "owner_type" NOT NULL,
	"created_by_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_gc_queue" (
	"storage_key" text PRIMARY KEY NOT NULL,
	"size_bytes" bigint NOT NULL,
	"enqueued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text
);
--> statement-breakpoint
ALTER TABLE "orgs" ALTER COLUMN "storage_quota_bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "orgs" ALTER COLUMN "storage_quota_bytes" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "orgs" ALTER COLUMN "storage_quota_bytes" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "artifacts" ADD COLUMN "files_bytes" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orgs" ADD COLUMN "artifact_quota_bytes" bigint;--> statement-breakpoint
ALTER TABLE "artifact_files" ADD CONSTRAINT "artifact_files_artifact_id_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_files_token_idx" ON "artifact_files" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "artifact_files_storage_key_idx" ON "artifact_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "artifact_files_artifact_id_idx" ON "artifact_files" USING btree ("artifact_id");--> statement-breakpoint
-- Hand-written from here down: the "default = unlimited" behavior change, and the GC trigger.
--
-- Every team created before this migration got storageQuotaBytes = 1073741824 (1 GiB) from the
-- old NOT NULL DEFAULT — either genuinely accepted as-is, or never touched because the old API
-- rejected 0 (`positive()`), so there was no way to ask for "unlimited". Since NULL now means
-- "inherit the instance quota" (which itself defaults to unlimited, see InstanceSettings), rows
-- still sitting at exactly the old default become NULL — i.e. they get the new "no limit by
-- default" behavior this feature asks for. Any team an admin deliberately pinned to a DIFFERENT
-- number keeps that number untouched; only the indistinguishable "never configured" population
-- moves. Idempotent: running this twice touches nothing the second time (no row is left at
-- exactly 1073741824 with an operator-intended meaning after the first run).
UPDATE "orgs" SET "storage_quota_bytes" = NULL WHERE "storage_quota_bytes" = 1073741824;--> statement-breakpoint
-- Structural guarantee for "files are deleted with their artifact, and orphan files can't exist":
-- fires on every row removed from artifact_files for ANY reason — an explicit DELETE, the
-- artifact_files -> artifacts ON DELETE CASCADE above, or an org's own cascade all the way down
-- (orgs -> artifacts -> artifact_files), which runs entirely in the database with no application
-- code involved. Enqueuing here means no call site can forget to schedule the S3 object for
-- removal; storage-gc.ts (application code) only ever drains this queue.
CREATE FUNCTION "artifact_files_gc_enqueue"() RETURNS trigger AS $$
BEGIN
  INSERT INTO "storage_gc_queue" ("storage_key", "size_bytes")
  VALUES (OLD."storage_key", OLD."size_bytes")
  ON CONFLICT ("storage_key") DO NOTHING;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint
CREATE TRIGGER "artifact_files_gc_trigger"
  AFTER DELETE ON "artifact_files"
  FOR EACH ROW
  EXECUTE FUNCTION "artifact_files_gc_enqueue"();