ALTER TABLE "shares" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "shares" ADD COLUMN "manager_view_count" integer DEFAULT 0 NOT NULL;