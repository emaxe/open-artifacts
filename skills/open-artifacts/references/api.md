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
# 1. Request a code
curl -sX POST "$OA_SERVER/api/v1/oauth/device/code" \
  -H 'Content-Type: application/json' \
  -d '{"agentName":"my-bot","scopes":["artifacts:read","artifacts:write","shares:write"]}'
# -> {"device_code":"...","user_code":"WXYZ-1234","verification_uri_complete":"https://.../activate?code=WXYZ-1234","interval":5,"expires_in":600}

# 2. Tell the human to open verification_uri_complete and approve.

# 3. Poll until approved (every `interval` seconds):
curl -sX POST "$OA_SERVER/api/v1/oauth/device/token" \
  -H 'Content-Type: application/json' \
  -d '{"deviceCode":"<device_code>","grantType":"urn:ietf:params:oauth:grant-type:device_code"}'
# -> 428 {"error":"authorization_pending"}   (keep polling)
# -> 200 {"api_key":"oa_live_...","expires_at":"...","org_id":"...","agent_id":"..."}
```

Save the `org_id` too — every artifact call needs it.

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
`org` (visible to everyone in your org).

## Update an artifact (creates a new version)

```bash
curl -sX PATCH "$OA_SERVER/api/v1/artifacts/$ARTIFACT_ID" \
  -H "Authorization: Bearer $OA_TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"<h1>Updated</h1>","message":"fixed typo"}'
```

Add `If-Match: <contentHash>` (from a prior GET) to guard against overwriting someone else's
concurrent change — a mismatch returns `409 version_conflict`.

## Create a share link

```bash
curl -sX POST "$OA_SERVER/api/v1/artifacts/$ARTIFACT_ID/shares" \
  -H "Authorization: Bearer $OA_TOKEN" -H 'Content-Type: application/json' \
  -d '{"mode":"public"}'
# -> {"id":"...","token":"...","url":"https://.../s/...","mode":"public","expiresAt":null}
```

For a password-protected or expiring link:
```bash
-d '{"mode":"password","password":"correct horse","expires":"7d"}'
```

The returned `url` is what you hand to a human — it renders in their browser, no auth needed
(a password prompt appears automatically for password-mode shares).

## List / fetch / delete

```bash
curl -s "$OA_SERVER/api/v1/artifacts?orgId=$OA_ORG_ID" -H "Authorization: Bearer $OA_TOKEN"
curl -s "$OA_SERVER/api/v1/artifacts/$ARTIFACT_ID"     -H "Authorization: Bearer $OA_TOKEN"
curl -sX DELETE "$OA_SERVER/api/v1/artifacts/$ARTIFACT_ID" -H "Authorization: Bearer $OA_TOKEN"
```

## Error shape

Every error response is `{"error": {"code": "...", "message": "..."}}` with an appropriate HTTP
status. See the table in `SKILL.md` for the codes you're likely to hit and what they mean.
