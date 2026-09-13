# Open Artifacts — raw HTTP reference

For agents without Node/npm available, or that need to call the API directly instead of via the
`oa` CLI. All endpoints are under `<server>/api/v1` and use a Bearer API key unless noted.

## Getting a key without the CLI

If a human has already issued you a key (via the web UI's Agents page, or the CLI's device flow),
you only need the token. Set it once:

```bash
export OA_TOKEN="oa_live_..."
export OA_SERVER="https://artifacts.your-company.com"
```

Otherwise, drive the device flow yourself:

```bash
# 1. Request a code. grantKind defaults to "agent" (locked to one team, org_id below); pass
#    "user" for a personal key that spans every team the approver belongs to.
curl -sX POST "$OA_SERVER/api/v1/oauth/device/code" \
  -H 'Content-Type: application/json' \
  -d '{"agentName":"my-bot","scopes":["artifacts:read","artifacts:write","shares:write"],"grantKind":"user"}'
# -> {"device_code":"...","user_code":"WXYZ-1234","verification_uri_complete":"https://.../activate?code=WXYZ-1234","interval":5,"expires_in":600}

# 2. Tell the human to open verification_uri_complete and approve.

# 3. Poll until approved (every `interval` seconds):
curl -sX POST "$OA_SERVER/api/v1/oauth/device/token" \
  -H 'Content-Type: application/json' \
  -d '{"deviceCode":"<device_code>","grantType":"urn:ietf:params:oauth:grant-type:device_code"}'
# -> 428 {"error":"authorization_pending"}   (keep polling)
# -> 200 {"api_key":"oa_live_...","expires_at":"...","grant_kind":"user","user_id":"...","org_id":null,"agent_id":null}
#    (grant_kind:"agent" instead returns org_id/agent_id and no user_id)
```

For an agent grant, save `org_id` — every artifact call needs it, and it's the only team this key
can ever act in. For a personal (`grant_kind: "user"`) key, there's no single `org_id` — call
`GET /me/orgs` (below) to see which teams it can act in, and pass the chosen one as `?orgId=` on
each call. **If the human hasn't told you which team and there's more than one, ask — don't guess.**

## Which teams can this key act in?

```bash
curl -s "$OA_SERVER/api/v1/me/orgs" -H "Authorization: Bearer $OA_TOKEN"
# -> {"userId":"...","authKind":"user_key","scopes":[...],
#     "orgs":[{"orgId":"...","name":"Acme","slug":"acme","kind":"team","role":"member"}, ...],
#     "defaultOrgId":"..."}
```
Works for every key kind (personal or agent) — for an agent key `orgs` always has exactly one
entry, the team it's locked to.

## Create an artifact

```bash
curl -sX POST "$OA_SERVER/api/v1/artifacts?orgId=$OA_ORG_ID" \
  -H "Authorization: Bearer $OA_TOKEN" -H 'Content-Type: application/json' \
  -d @- <<EOF
{"title":"Q3 Report","kind":"html","content":"<h1>Hi</h1>","visibility":"private"}
EOF
# -> {"artifact":{"id":"...","...":"..."},"currentVersion":1}
```

`kind` is one of `html` | `markdown` | `mermaid` | `svg`. `visibility` is `private` (default) or
`org` (visible to everyone in your org). `orgId` can be omitted for a personal key that belongs to
exactly one team — the server picks it automatically; with more than one and no `orgId`, the
request fails with `400 org_required` and the candidate list in the body (see the error shape
below and the `org_required` row in `SKILL.md`'s error table).

Optional `lifetime` field: a number of minutes, or a duration string like `"12h"`/`"7d"`; `0` or
`null` for never. Omit it to get the team's default, which is also its maximum — passing something
longer than that maximum fails with `400 lifetime_exceeds_max` and `maxLifetimeMinutes` in the
body. Once `expiresAt` passes, the content is hard-deleted; there's no recovering it.
```bash
-d '{"title":"Q3 Report","kind":"html","content":"<h1>Hi</h1>","lifetime":"7d"}'
```

## Update an artifact (creates a new version)

```bash
curl -sX PATCH "$OA_SERVER/api/v1/artifacts/$ARTIFACT_ID" \
  -H "Authorization: Bearer $OA_TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"<h1>Updated</h1>","message":"fixed typo"}'
```

Add `If-Match: <contentHash>` (from a prior GET) to guard against overwriting someone else's
concurrent change — a mismatch returns `409 version_conflict`. `lifetime` can be changed here too,
independently of `content` — it's recomputed from the artifact's original creation date, not from
the moment of this update.

## Create a share link

`mode` is optional — omit it to get the team's configured default (usually `"team"`); that's the
right choice unless a human asked for a specific kind of link (see "Link modes" in `SKILL.md`):

```bash
curl -sX POST "$OA_SERVER/api/v1/artifacts/$ARTIFACT_ID/shares" \
  -H "Authorization: Bearer $OA_TOKEN" -H 'Content-Type: application/json' \
  -d '{}'
# -> {"id":"...","token":"...","url":"https://.../s/...","mode":"team","expiresAt":null}
```

The three legal values for `mode`:
- `"team"` — only a logged-in member of the artifact's team can open the URL.
- `"password"` — anyone with the URL and the password (`-d '{"mode":"password","password":"correct horse","expires":"7d"}'`).
- `"public"` — anyone with the URL, no login or password (`-d '{"mode":"public"}'`).

An explicit `"public"` request can fail with `403 public_shares_forbidden` if the team or instance
disallows public links — the body carries `"allowedModes"` (e.g. `["team","password"]"`) so you
know what's still available. Retry with one of those, or omit `mode` for the team default.

The returned `url` is what you hand to a human — it renders in their browser. A `public` or
`password` link needs no login (a password prompt appears automatically for password-mode shares);
a `team` link redirects an anonymous visitor to `/login` and then requires they be a member of the
artifact's team, so it's only useful to hand to people already on that team.

## List / fetch / delete

```bash
curl -s "$OA_SERVER/api/v1/artifacts?orgId=$OA_ORG_ID" -H "Authorization: Bearer $OA_TOKEN"
curl -s "$OA_SERVER/api/v1/artifacts/$ARTIFACT_ID"     -H "Authorization: Bearer $OA_TOKEN"
curl -sX DELETE "$OA_SERVER/api/v1/artifacts/$ARTIFACT_ID" -H "Authorization: Bearer $OA_TOKEN"
```

## Managing personal keys

Session-only (cookie auth in the web UI) — a key can't mint or revoke another key:
```bash
curl -s "$OA_SERVER/api/v1/me/keys" -H "Cookie: oa_session=$SESSION"
curl -sX POST "$OA_SERVER/api/v1/me/keys" -H "Cookie: oa_session=$SESSION" -H 'Content-Type: application/json' \
  -d '{"name":"my-bot","scopes":["artifacts:read","artifacts:write"],"expires":"90d"}'
curl -sX DELETE "$OA_SERVER/api/v1/me/keys/$KEY_ID" -H "Cookie: oa_session=$SESSION"
```

## Error shape

Every error response is `{"error": {"code": "...", "message": "..."}}` with an appropriate HTTP
status. `org_required` additionally carries `"orgs": [...]` — the same shape as `GET /me/orgs`'
`orgs` array — so you can show the human the choice without a second request. `public_shares_forbidden`
carries `"allowedModes": [...]` and `"defaultShareMode"` for the same reason. See the table in
`SKILL.md` for the codes you're likely to hit and what they mean.
