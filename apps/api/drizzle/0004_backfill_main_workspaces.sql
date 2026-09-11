-- Closes a gap in 0002: that migration backfilled orgs.kind/created_by for *existing* orgs, but
-- never provisioned a "main" workspace for users who, at migration time, had zero org
-- memberships at all — exactly the population registerUser() now always gives one to going
-- forward (services/users.ts). This migration is a no-op if every user already belongs to at
-- least one org (true for both databases this was verified against before this migration was
-- written), and is idempotent — running it again finds no matching users the second time.
WITH missing_users AS (
  SELECT u.id
  FROM "users" u
  LEFT JOIN "org_members" m ON m.user_id = u.id
  WHERE m.user_id IS NULL
),
new_orgs AS (
  INSERT INTO "orgs" ("name", "slug", "kind", "created_by")
  SELECT
    'Основное пространство',
    'ws-' || substr(md5(mu.id::text || random()::text), 1, 12),
    'main',
    mu.id
  FROM missing_users mu
  RETURNING id, created_by
)
INSERT INTO "org_members" ("org_id", "user_id", "role")
SELECT id, created_by, 'owner' FROM new_orgs;
