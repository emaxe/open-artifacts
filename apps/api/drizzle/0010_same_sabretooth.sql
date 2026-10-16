ALTER TABLE "artifacts" ALTER COLUMN "visibility" SET DEFAULT 'org';
UPDATE "artifacts" SET "visibility" = 'org' WHERE "visibility" = 'private';
