# Open Artifacts — self-hosted система артефактов для ИИ-агентов

## Context

Claude Artifacts решают конкретную проблему: агент сгенерировал HTML-страницу/отчёт/дашборд — и её нужно
куда-то положить, чтобы человек открыл её по ссылке, а не читал исходник в терминале. Но это работает только
внутри Claude. Любой другой агент (Codex, Cursor, самописный на LangChain, n8n-воркфлоу) такой возможности не имеет.

**Цель:** self-hosted сервис-аналог, который разворачивается одной командой `docker compose up`, авторизует
произвольных ИИ-агентов по токену и даёт им CRUD над артефактами, а людям — веб-интерфейс, шаринг по ссылке
и админку с аналитикой.

**Итог, которого добиваемся:** агент выполняет `oa push report.html --share` и отдаёт человеку рабочую ссылку.

### Решения, принятые на этапе брейншторма

| Вопрос | Решение |
|---|---|
| Контент артефактов | HTML (самодостаточный файл) + Markdown + Mermaid + SVG. Без React/JSX и без мульти-файловых артефактов |
| Интеграция агентов | REST API — ядро; SKILL.md + CLI поверх него; MCP-обёртка отложена (API проектируется под неё) |
| Модель доступа | Multi-tenant с организациями/командами |
| Стек | Hono (API) + React SPA (Vite), TypeScript, Postgres + Drizzle |
| Токены | Opaque API-ключи с настраиваемым TTL + OAuth Device Flow для выдачи |
| Шаринг | Публичная ссылка, ссылка с паролем, ссылка с TTL, шаринг внутри команды |
| Версионирование | Да — каждый update создаёт неизменяемую версию |
| Веб-UI | Просмотр и управление (без редактора кода) |
| Регистрация | Переключатель в админке: `open` / `invite-only` / `closed`, дефолт `invite-only` |
| Аналитика | Просмотры, активность API/агентов, хранилище и квоты, audit log |

---

## Архитектура

Монорепо на pnpm workspaces. Один runtime-контейнер: Hono отдаёт API, статику SPA и контент артефактов.

```
open-artifacts/
├─ apps/
│  ├─ api/               # Hono + Drizzle + Postgres
│  │  ├─ src/routes/     # auth, oauth-device, artifacts, shares, admin, embed
│  │  ├─ src/db/         # schema.ts, migrations/
│  │  ├─ src/middleware/ # auth, rate-limit, usage-metering, audit
│  │  └─ src/services/   # artifacts, versions, keys, analytics, sandbox
│  └─ web/               # React 19 + Vite + TS
├─ packages/
│  ├─ shared/            # zod-схемы запросов/ответов + типы (общие для api, web, cli)
│  └─ cli/               # npm-пакет `open-artifacts`, бинарь `oa`
├─ skills/open-artifacts/ # SKILL.md + references/api.md
├─ docker/               # Dockerfile (multi-stage), docker-compose.yml
└─ docs/superpowers/specs/
```

`packages/shared` — единственный источник правды для контрактов API: zod-схемы валидируют запросы в Hono,
из них же выводятся типы для SPA и CLI. Это то, что позже переиспользует MCP-обёртка.

### Изоляция песочницы — критичная часть

Артефакт — произвольный HTML со скриптами, написанный ИИ. Если рендерить его на origin админки, XSS = кража
сессии. Три эшелона:

1. **Iframe с opaque origin.** Вьювер вставляет
   `<iframe sandbox="allow-scripts allow-forms allow-popups allow-modals" src="/embed/:token">`.
   Без `allow-same-origin` iframe получает уникальный opaque origin: скрипт внутри не читает cookie и
   localStorage родителя и не делает same-origin запросов к API.
2. **Отдельный origin (опция для прода).** `ARTIFACT_ORIGIN=https://sandbox.example.com` — контент отдаётся
   только с него. Нужно, если артефакту требуется собственный localStorage: тогда `ARTIFACT_ALLOW_SAME_ORIGIN=true`
   добавляет `allow-same-origin`, но изоляция от главного домена сохраняется на уровне origin.
3. **CSP на ответе с контентом:**
   `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' <allowlist>; style-src 'unsafe-inline' https://fonts.googleapis.com; img-src data: blob: https:; font-src https://fonts.gstatic.com data:; connect-src 'none'; frame-ancestors <APP_ORIGIN>`
   плюс `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`.
   Allowlist CDN редактируется в админке (дефолт: cdnjs.cloudflare.com, cdn.jsdelivr.net, code.jquery.com,
   cdn.tailwindcss.com).

Markdown рендерится сервером (`markdown-it` + `DOMPurify` на jsdom), Mermaid — на клиенте внутри того же
iframe. Санитизация здесь второй эшелон, а не единственная защита.

### Аутентификация — три канала

**Люди:** сессионная cookie (`HttpOnly; Secure; SameSite=Lax`), сессии в БД, пароли argon2id.

**Агенты:** `Authorization: Bearer oa_live_<key_id>_<secret>`. В БД — только `key_hash` (argon2id) и `prefix`.
Проверка: разбор префикса → выборка строки → verify. Успешные верификации кэшируются в памяти на 60 с, иначе
argon2 съест CPU на каждом запросе.

**OAuth Device Flow** (RFC 8628) — чтобы агент получил ключ без ручного копипаста:

```
POST /oauth/device/code  {agent_name, scopes}
  → {device_code, user_code: "WXYZ-1234", verification_uri, verification_uri_complete,
     interval: 5, expires_in: 600}
человек открывает /activate?code=WXYZ-1234 → логин → выбор организации и TTL → подтверждение
POST /oauth/device/token {device_code, grant_type: "...:device_code"}
  → 428 authorization_pending | 429 slow_down | 400 expired_token | 403 access_denied
  → 200 {api_key, expires_at, org, agent_id}
```

Scopes: `artifacts:read`, `artifacts:write`, `artifacts:delete`, `shares:write`.
TTL по умолчанию — из настроек инстанса (`default_key_ttl_days`, дефолт 90; `0` = бессрочно).
Истёкший ключ → `401 {code: "key_expired"}`; CLI ловит этот код и подсказывает `oa login`.

### Схема БД (Postgres + Drizzle)

| Таблица | Ключевые поля |
|---|---|
| `users` | id, email, password_hash, name, is_superadmin, created_at |
| `sessions` | id, user_id, expires_at, ip, user_agent |
| `orgs` | id, name, slug, storage_quota_bytes, created_at |
| `org_members` | org_id, user_id, role: owner\|admin\|member\|viewer |
| `invites` | id, org_id, email, role, token, expires_at, accepted_at |
| `agents` | id, org_id, name, description, created_by, created_at |
| `api_keys` | id, agent_id, prefix, key_hash, scopes[], expires_at, last_used_at, revoked_at |
| `device_auth_requests` | device_code, user_code, agent_name, requested_scopes, status, expires_at, approved_by, issued_key_id |
| `artifacts` | id, org_id, owner_type: user\|agent, owner_id, title, description, kind: html\|markdown\|mermaid\|svg, current_version_id, visibility: private\|org, size_bytes, created_at, updated_at, deleted_at, **expires_at**, **purged_at** |
| `artifact_versions` | id, artifact_id, version_no, content, content_hash, size_bytes, created_by_type, created_by_id, message, created_at |
| `shares` | id, artifact_id, token, mode: public\|password, password_hash, expires_at, pinned_version_id, view_count, revoked_at |
| `artifact_views` | id, artifact_id, share_id, viewed_at, ip_hash, ua_hash, referer |
| `artifact_view_daily` | artifact_id, day, views, uniques |
| `api_usage_hourly` | org_id, agent_id, key_id, endpoint, method, status_class, hour, count, p95_ms |
| `audit_log` | id, org_id, actor_type, actor_id, action, target_type, target_id, meta jsonb, ip, at |
| `settings` | key, value jsonb |
| `orgs` | id, name, slug, storage_quota_bytes, **max_artifact_lifetime_minutes**, created_at |

`artifact_versions.content` неизменяем; `artifacts.current_version_id` указывает на актуальную. Это защищает
от агента, затершего чужую работу, и позволяет шарить конкретную версию (`shares.pinned_version_id`).

Удаление артефакта — мягкое (`deleted_at`), фоновая задача чистит по retention из настроек.

### Время жизни артефактов (TTL)

Трёхуровневая политика: `settings.instance.maxArtifactLifetimeMinutes` (0 = без ограничений; он же
дефолт для новых артефактов) → опциональный `orgs.max_artifact_lifetime_minutes` строже глобального
→ выбор автора в рамках эффективного лимита при создании/обновлении. Превышение лимита — явная
ошибка `400 lifetime_exceeds_max`, а не молчаливое обрезание.

`artifacts.expires_at` (`NULL` = бессрочно) читается лениво на каждом чтении — истёкший артефакт
пропадает из списков и выдаёт 404/410 ещё до того, как до него доберётся фоновая задача. Сама
задача (`purgeExpiredArtifacts`, интервал `ARTIFACT_PURGE_INTERVAL_MINUTES`) безвозвратно удаляет
строки `artifact_versions` и выставляет `purged_at` — первый и единственный фоновый процесс в
проекте; строка `artifacts` остаётся надгробием для `audit_log`/`artifact_views`.

Понижение лимита пересчитывает `expires_at` уже созданных артефактов от их `created_at`
(`LEAST(expires_at, created_at + новый_максимум)`) — так уменьшение лимита действует и на прошлое,
а повышение никогда не продлевает то, что уже создано.

### API (`/api/v1`)

```
# люди (cookie-сессия)
POST   /auth/register            POST /auth/login          POST /auth/logout
GET    /auth/me                  POST /auth/invites/accept

# организации
GET    /orgs                     POST /orgs
GET    /orgs/:id/members         POST /orgs/:id/invites    DELETE /orgs/:id/members/:userId

# агенты и ключи (cookie-сессия)
GET/POST /agents                 POST /agents/:id/keys     DELETE /keys/:id

# device flow (без авторизации / cookie на approve)
POST   /oauth/device/code        POST /oauth/device/token
GET    /oauth/device/pending     POST /oauth/device/approve   POST /oauth/device/deny

# артефакты (Bearer-ключ ИЛИ cookie-сессия — одна мидлварь, два источника identity)
GET    /artifacts                POST /artifacts
GET    /artifacts/:id            PATCH /artifacts/:id       DELETE /artifacts/:id
GET    /artifacts/:id/versions   GET  /artifacts/:id/versions/:n
POST   /artifacts/:id/versions/:n/restore

# шаринг
GET/POST /artifacts/:id/shares   DELETE /shares/:id

# публичный доступ (без авторизации)
GET    /s/:token                 # HTML-страница вьювера
POST   /s/:token/unlock          # для mode=password
GET    /embed/:token             # сам контент, отдаётся в iframe с CSP

# админка (superadmin)
GET    /admin/stats              GET /admin/users          GET /admin/orgs
GET    /admin/audit              GET/PATCH /admin/settings
```

`PATCH /artifacts/:id` с новым `content` создаёт новую версию, а не перезаписывает. Поддерживает
`If-Match: <content_hash>` для оптимистичной блокировки, если два агента пишут в один артефакт.

Rate limiting — token bucket в памяти по `key_id`, лимиты в настройках инстанса.

### Аналитика

- **Просмотры:** каждое открытие пишет строку в `artifact_views` (IP хэшируется с серверной солью).
  Почасовой rollup в `artifact_view_daily`; сырьё чистится по retention (дефолт 30 дней).
- **API-usage:** мидлварь копит счётчики в памяти и раз в 5 с флашит батчем в `api_usage_hourly` —
  чтобы аналитика не добавляла запись в БД на каждый запрос.
- **Audit log:** пишется синхронно в той же транзакции, что и мутация. Иначе он врёт.

Дашборд админки: карточки (артефакты / орги / агенты / запросы за 24ч / объём хранилища), график просмотров
по дням и запросов по часам, топ артефактов, таблица ключей с `last_used_at`, лента аудита с фильтрами.

### CLI (`packages/cli`, бинарь `oa`)

```
oa login [--server URL]          # device flow, пишет ~/.config/open-artifacts/credentials.json (chmod 600)
oa whoami                        oa list [--json]
oa push <file> [--title T] [--kind html] [--id ID] [--share] [--message M]
oa get <id> [-o file]            oa rm <id>
oa share <id> [--password P] [--expires 7d] [--version N]
oa unshare <share-id>
```

`oa push` берёт файл с диска — агенту не нужно эскейпить многокилобайтный HTML в JSON, где агенты регулярно
ломаются. Выводит URL. Все команды поддерживают `--json` для машинного чтения. Токен читается из
`OA_TOKEN` / credentials-файла, в таком порядке.

### Скилл (`skills/open-artifacts/SKILL.md`)

Описание-триггер: «когда нужно опубликовать HTML/отчёт/дашборд и дать человеку ссылку».
Содержит: установку CLI, `oa login` при первом запуске, три типовых рецепта (создать, обновить, расшарить),
таблицу ошибок (`key_expired`, `quota_exceeded`, `409` конфликт версий) и что с ними делать.
`references/api.md` — сырые curl-примеры для агентов без Node.

---

## Фазы реализации

Каждая фаза заканчивается рабочим состоянием, которое можно поднять и проверить.

**Phase 0 — каркас.** pnpm-монорепо, TS-конфиги, Hono-скелет с `/health`, Vite+React скелет, Drizzle,
Dockerfile (multi-stage) + `docker-compose.yml` (app + postgres + healthcheck), автомиграции при старте,
сид superadmin из env, vitest + тестовая БД.

**Phase 1 — люди и организации.** Регистрация/логин/сессии, argon2id, режимы регистрации, орги, участники,
роли, инвайты. Layout SPA, страницы логина и настроек.

**Phase 2 — артефакты и песочница.** CRUD, версии, `content_hash`, мягкое удаление, квоты. Роут `/embed/:token`
с CSP и sandbox-заголовками, рендер markdown/mermaid/svg. Web UI: список, карточка, превью в iframe,
история версий, откат, скачивание.

**Phase 3 — агенты.** Сущность `agents`, ключи, Bearer-мидлварь с кэшем верификации, scopes, TTL,
отзыв ключа, rate limiting. Device flow целиком + страница `/activate`. UI управления агентами и ключами.

**Phase 4 — CLI и скилл.** Пакет `open-artifacts`, все команды, credentials-файл, SKILL.md, references/api.md.

**Phase 5 — шаринг.** Четыре режима, публичный вьювер `/s/:token`, разблокировка паролем, TTL, пиннинг версии,
шаринг внутри команды через `visibility: org`.

**Phase 6 — аналитика и админка.** Трекинг просмотров + rollup, usage-мидлварь с батчингом, audit log,
настройки инстанса, дашборд, ретеншн-джобы.

Phase 5 не зависит от Phase 4 — их можно делать параллельно.

---

## Тестирование и верификация

**TDD** на всех фазах: тест сначала, потом реализация (`superpowers:test-driven-development`).

- **Юнит-тесты (vitest):** хэширование и верификация ключей, парсинг TTL, разрешение прав доступа
  (матрица роль × visibility × share-mode), генерация CSP, вычисление `content_hash`.
- **Интеграционные (vitest + реальный Postgres из compose):** весь device flow от `/device/code` до
  выданного ключа; создание артефакта → три обновления → откат на версию 2; истёкший ключ → 401 `key_expired`;
  превышение квоты → 413; конфликт `If-Match` → 409.
- **E2E (Playwright), обязательный тест безопасности:** артефакт со скриптом, который пытается прочитать
  `document.cookie` и `localStorage` родителя и сделать `fetch('/api/v1/artifacts')`. Все три попытки должны
  провалиться. Этот тест — главная страховка проекта.
- **Ручная сквозная проверка (после Phase 4):**
  ```
  docker compose up -d && docker compose logs -f app     # ждём healthy
  открыть http://localhost:3000 → зарегистрировать superadmin
  npx open-artifacts login --server http://localhost:3000 → подтвердить в браузере
  oa push ./test.html --title "Тест" --share                # печатает URL
  открыть URL в приватном окне → артефакт рендерится
  проверить в админке: просмотр засчитан, в audit log три записи
  ```

## Открытые вопросы, решаемые по ходу

- Точный порог `max_artifact_size` (стартовое значение 5 МБ, в настройках инстанса).
- Нужен ли preview-скриншот артефакта для списка (headless-браузер) — отложено, не MVP.
