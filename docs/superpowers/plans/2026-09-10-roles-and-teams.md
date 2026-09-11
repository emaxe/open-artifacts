# Роли, команды и управление пользователями — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Отвязать пользователей от обязательного членства в команде, дать суперадмину видеть все команды/артефакты/агентов без ограничений (с опциональным фильтром по команде), добавить смену ролей участников, двухуровневый раздел «Команды» и раздел «Пользователи» для управления учётными записями.

**Architecture:** Backend (Hono + Drizzle + Postgres) получает: опциональный `orgId` на списковых эндпоинтах (без него — объединённый список по всем доступным командам), пагинированный `GET /orgs`, новый `PATCH /orgs/:id/members/:userId`, статус учётной записи (`active`/`blocked`/`deleted`) с гейтом на логине, и `GET/PATCH /admin/users`. Frontend получает сайдбар-селектор с пунктом «Все», двухуровневый раздел «Команды» (список → карточка), раздел «Пользователи» (только superadmin) и страницу аккаунта.

**Tech Stack:** Hono, Drizzle ORM, PostgreSQL, Vitest (integration tests hit a real Postgres — `docker compose -f docker-compose.dev.yml up -d`), React + React Router, TypeScript, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-10-roles-and-teams-design.md`

## Global Constraints

- Пагинация везде: `page` 1-based (default `1`), `pageSize` default `20`, максимум `100`. Ответ — плоский объект с `total` в дополнение к массиву данных, без обёртки `meta`.
- Суперадмин — ровно один, задаётся только сидом (`seedSuperadmin` в `apps/api/src/index.ts`), никогда не меняется/не передаётся через UI/API.
- Роль в команде (`owner`/`admin`/`member`/`viewer`) остаётся привязанной к паре `(orgId, userId)` — набор ролей не меняется.
- Регистрация без invite-токена **не создаёт** личную команду; регистрация по invite-ссылке — как раньше, сразу добавляет в целевую команду.
- Все новые эндпоинты и код — на TypeScript, в стиле уже существующих файлов в `apps/api/src/routes` и `apps/api/src/services` (Zod-валидация тела, `c.json({ error: { code, message } }, status)` на ошибках).

---

## Часть 1 — Backend

### Task 1: Регистрация больше не создаёт личную команду

**Files:**
- Modify: `apps/api/src/services/users.ts:1-63` (`registerUser`, `RegisterResult`, удалить `slugify`)
- Modify: `apps/api/src/routes/auth.ts:50-77` (`POST /auth/register`)
- Modify: `apps/api/src/__tests__/integration/helpers.ts:58-73` (`registerAndLogin`)
- Modify: `apps/api/e2e/sandbox-security.spec.ts:38-52` (`setupMaliciousShare`)
- Test: `apps/api/src/__tests__/integration/registration-no-org.test.ts` (new)

**Interfaces:**
- Produces: `registerUser(db, input): Promise<{ userId: string }>` (было `{ userId, orgId }` — `orgId` убран из результата).
- Consumes (у `registerAndLogin`): `POST /orgs` (существующий, `services/orgs` пока не нужен).

- [ ] **Step 1: Написать падающий тест на отсутствие личной команды**

Создать `apps/api/src/__tests__/integration/registration-no-org.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, extractCookie, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("registration without an invite", () => {
  it("does not create a personal org for the new user", async () => {
    const app = buildTestApp();
    const res = await app.request("/api/v1/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "solo@example.com", password: "correct horse battery staple", name: "Solo" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { userId: string; orgId: string | null };
    expect(body.orgId).toBeNull();

    const sessionCookie = extractCookie(res, "oa_session")!;
    const meRes = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${sessionCookie}` } });
    const me = (await meRes.json()) as { orgs: unknown[] };
    expect(me.orgs).toHaveLength(0);
  });

  it("still joins the invited org when registering via an invite link", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const inviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ email: "invitee@example.com", role: "member" }),
    });
    const invite = (await inviteRes.json()) as { token: string };

    const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invitee@example.com", password: "correct horse battery staple", name: "Invitee" }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { orgId: string };
    expect(body.orgId).toBe(owner.orgId);
  });
});
```

Note: этот тест использует `registerAndLogin`, которую мы ещё не обновили в Step 3 — если запустить прямо сейчас, первый sub-test упадёт с `orgId` не `null` (т.к. `registerUser` пока создаёт org), а второй тест сначала упадёт на самой `registerAndLogin` (она пока ожидает `body.orgId` из `/auth/register`, что всё ещё работает на этом шаге — падать будет именно первый assert). Это ожидаемо для этого шага.

- [ ] **Step 2: Запустить тест и убедиться что первый сценарий падает**

Run: `docker compose -f docker-compose.dev.yml up -d && cd apps/api && pnpm test:integration -- registration-no-org`
Expected: FAIL — `expect(body.orgId).toBeNull()` получает реальный uuid.

- [ ] **Step 3: Убрать автосоздание личной команды**

В `apps/api/src/services/users.ts` заменить блок с `registerUser`/`RegisterResult`/`slugify` (строки 20-63) на:

```typescript
export interface RegisterResult {
  userId: string;
}

/** Registers a user. Does not provision any org — a user is not required to belong to one. */
export async function registerUser(
  db: Database,
  input: { email: string; password: string; name: string; isSuperadmin?: boolean },
): Promise<RegisterResult> {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
  if (existing) throw new EmailAlreadyRegisteredError();

  const passwordHash = await hashSecret(input.password);
  const [user] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
      name: input.name,
      isSuperadmin: input.isSuperadmin ?? false,
    })
    .returning();
  return { userId: user!.id };
}
```

Убрать теперь неиспользуемый импорт `orgs` из `../db/schema.js`, если больше нигде в файле не используется (оставить `orgMembers` — понадобится ниже, в Task 4).

В `apps/api/src/routes/auth.ts`, в `POST /auth/register` (строки 51-70), заменить:

```typescript
  try {
    const result = await registerUser(db, body.data);

    if (invite) {
      await db.transaction(async (tx) => {
        await tx.insert(orgMembers).values({ orgId: invite!.orgId, userId: result.userId, role: invite!.role });
        await tx.update(invites).set({ acceptedAt: new Date() }).where(eq(invites.id, invite!.id));
      });
    }

    const session = await createSession(db, result.userId, { ip: c.req.header("x-forwarded-for"), userAgent: c.req.header("user-agent") });
    setCookie(c, SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTS);
    await recordAudit(db, {
      orgId: invite?.orgId,
      identity: { kind: "user", userId: result.userId, isSuperadmin: false },
      action: "user.register",
      targetType: "user",
      targetId: result.userId,
    });
    return c.json({ userId: result.userId, orgId: invite?.orgId ?? null }, 201);
```

(меняется только `orgId: invite?.orgId ?? result.orgId` → `orgId: invite?.orgId ?? null`, и `recordAudit`'s `orgId: invite?.orgId ?? result.orgId` → `orgId: invite?.orgId`).

- [ ] **Step 4: Обновить тестовый хелпер, чтобы он снова создавал команду явно**

В `apps/api/src/__tests__/integration/helpers.ts`, заменить тело `registerAndLogin` (строки 58-73):

```typescript
export async function registerAndLogin(app: ReturnType<typeof buildTestApp>, overrides: Partial<{ email: string; password: string; name: string }> = {}) {
  const email = overrides.email ?? `user-${Math.random().toString(36).slice(2)}@example.com`;
  const password = overrides.password ?? "correct horse battery staple";
  const name = overrides.name ?? "Test User";

  const res = await app.request("/api/v1/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { userId: string };
  const sessionCookie = extractCookie(res, "oa_session")!;

  const orgRes = await app.request("/api/v1/orgs", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ name: `${name}'s workspace` }),
  });
  if (orgRes.status !== 201) throw new Error(`org creation failed: ${orgRes.status} ${await orgRes.text()}`);
  const orgBody = (await orgRes.json()) as { id: string };

  return { userId: body.userId, orgId: orgBody.id, sessionCookie, email, password };
}
```

Это сохраняет прежний контракт (`{ userId, orgId, sessionCookie, email, password }`) для всех 17 существующих мест, где вызывается `registerAndLogin` — их менять не нужно.

- [ ] **Step 5: Обновить e2e-спек, который читал `orgId` прямо из ответа регистрации**

В `apps/api/e2e/sandbox-security.spec.ts`, в `setupMaliciousShare` (строки 38-52), после блока регистрации добавить создание команды и использовать её id:

```typescript
async function setupMaliciousShare(baseURL: string): Promise<string> {
  const email = `attacker-target-${Math.random().toString(36).slice(2)}@example.com`;
  const registerRes = await fetch(`${baseURL}/api/v1/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Victim" }),
  });
  if (!registerRes.ok) throw new Error(`register failed: ${registerRes.status} ${await registerRes.text()}`);
  const setCookie = registerRes.headers.get("set-cookie")!;
  const sessionCookie = /oa_session=([^;]+)/.exec(setCookie)![1];

  const orgRes = await fetch(`${baseURL}/api/v1/orgs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${sessionCookie}` },
    body: JSON.stringify({ name: "Victim's workspace" }),
  });
  if (!orgRes.ok) throw new Error(`org creation failed: ${orgRes.status} ${await orgRes.text()}`);
  const { id: orgId } = (await orgRes.json()) as { id: string };

  const createRes = await fetch(`${baseURL}/api/v1/artifacts?orgId=${orgId}`, {
    // ...unchanged from here
```

(остальное тело функции — `createRes`, `shareRes` и т.д. — не меняется, только источник `orgId`.)

- [ ] **Step 6: Прогнать тесты и убедиться что всё зелёное**

Run: `cd apps/api && pnpm test:integration`
Expected: PASS — все существующие интеграционные тесты и новый `registration-no-org.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/services/users.ts apps/api/src/routes/auth.ts apps/api/src/__tests__/integration/helpers.ts apps/api/src/__tests__/integration/registration-no-org.test.ts apps/api/e2e/sandbox-security.spec.ts
git commit -m "Stop auto-creating a personal org on self-registration"
```

---

### Task 2: Статус учётной записи (`active`/`blocked`/`deleted`) и гейт на логине

**Files:**
- Modify: `apps/api/src/db/schema.ts:28-38` (новый enum + колонка `status`)
- Create: миграция через `drizzle-kit generate` (файл появится в `apps/api/drizzle/`)
- Modify: `apps/api/src/services/users.ts` (`verifyLogin`, новый `setUserStatus`, `AccountInactiveError`, `CannotModifySuperadminError`)
- Modify: `apps/api/src/routes/auth.ts:79-95` (обработка `AccountInactiveError` в `/auth/login`)
- Modify: `apps/api/src/routes/admin.ts` (новый `PATCH /admin/users/:id/status`)
- Test: `apps/api/src/__tests__/integration/account-status.test.ts` (new)

**Interfaces:**
- Produces: `setUserStatus(db, userId, status: "active"|"blocked"|"deleted"): Promise<void>`, бросает `CannotModifySuperadminError`.
- Produces: `verifyLogin` теперь бросает `AccountInactiveError(status)` для неактивных аккаунтов.
- Consumes (Task 8, 16): поле `users.status` на каждой строке `users`.

- [ ] **Step 1: Добавить колонку в схему и сгенерировать миграцию**

В `apps/api/src/db/schema.ts`, рядом с другими `pgEnum` (после строки 27):

```typescript
export const userStatusEnum = pgEnum("user_status", ["active", "blocked", "deleted"]);
```

В определении `users` (строки 30-38) добавить поле:

```typescript
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  isSuperadmin: boolean("is_superadmin").notNull().default(false),
  status: userStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [uniqueIndex("users_email_idx").on(table.email)]);
```

Run: `docker compose -f docker-compose.dev.yml up -d && cd apps/api && pnpm db:generate`
Expected: новый файл миграции в `apps/api/drizzle/000X_*.sql`, добавляющий enum `user_status` и колонку `status` с дефолтом `'active'`.

Run: `DATABASE_URL=postgres://postgres:postgres@localhost:5433/open_artifacts_dev pnpm db:migrate`
Expected: миграция применяется без ошибок.

- [ ] **Step 2: Написать падающий тест**

Создать `apps/api/src/__tests__/integration/account-status.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function makeSuperadmin(userId: string) {
  await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, userId));
}

describe("account status", () => {
  it("blocks login for a blocked account and reports account_blocked", async () => {
    const app = buildTestApp();
    const target = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    await makeSuperadmin(admin.userId);

    const blockRes = await app.request(`/api/v1/admin/users/${target.userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${admin.sessionCookie}` },
      body: JSON.stringify({ status: "blocked" }),
    });
    expect(blockRes.status).toBe(200);

    const loginRes = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: target.email, password: target.password }),
    });
    expect(loginRes.status).toBe(403);
    const body = (await loginRes.json()) as { error: { code: string } };
    expect(body.error.code).toBe("account_blocked");
  });

  it("invalidates the existing session immediately when a user is blocked", async () => {
    const app = buildTestApp();
    const target = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    await makeSuperadmin(admin.userId);

    const meBefore = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${target.sessionCookie}` } });
    expect(meBefore.status).toBe(200);

    await app.request(`/api/v1/admin/users/${target.userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${admin.sessionCookie}` },
      body: JSON.stringify({ status: "blocked" }),
    });

    const meAfter = await app.request("/api/v1/auth/me", { headers: { Cookie: `oa_session=${target.sessionCookie}` } });
    expect(meAfter.status).toBe(401);
  });

  it("refuses to change the superadmin's own status", async () => {
    const app = buildTestApp();
    const admin = await registerAndLogin(app);
    await makeSuperadmin(admin.userId);

    const res = await app.request(`/api/v1/admin/users/${admin.userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${admin.sessionCookie}` },
      body: JSON.stringify({ status: "blocked" }),
    });
    expect(res.status).toBe(403);
  });

  it("deleting a user removes their org memberships", async () => {
    const app = buildTestApp();
    const target = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    await makeSuperadmin(admin.userId);

    await app.request(`/api/v1/admin/users/${target.userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${admin.sessionCookie}` },
      body: JSON.stringify({ status: "deleted" }),
    });

    const membersRes = await app.request(`/api/v1/orgs/${target.orgId}/members`, { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: { userId: string }[] };
    expect(membersBody.members.find((m) => m.userId === target.userId)).toBeUndefined();
  });
});
```

- [ ] **Step 3: Запустить тест и убедиться что падает**

Run: `cd apps/api && pnpm test:integration -- account-status`
Expected: FAIL — `PATCH /admin/users/:id/status` ещё не существует (404).

- [ ] **Step 4: Реализовать `setUserStatus`, `AccountInactiveError`, `CannotModifySuperadminError` и гейт на логине**

В `apps/api/src/services/users.ts`, рядом с `InvalidCredentialsError` добавить:

```typescript
export class AccountInactiveError extends Error {
  constructor(public status: "blocked" | "deleted") {
    super(status === "blocked" ? "This account has been blocked" : "This account no longer exists");
  }
}

export class CannotModifySuperadminError extends Error {
  constructor() {
    super("Cannot change status of the superadmin account");
  }
}
```

Заменить `verifyLogin` (строки 65-71):

```typescript
export async function verifyLogin(db: Database, email: string, password: string) {
  const user = await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) });
  if (!user) throw new InvalidCredentialsError();
  const ok = await verifySecret(password, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();
  if (user.status !== "active") throw new AccountInactiveError(user.status);
  return user;
}
```

Добавить в конец файла:

```typescript
export async function setUserStatus(db: Database, userId: string, status: "active" | "blocked" | "deleted") {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new Error("User not found");
  if (user.isSuperadmin) throw new CannotModifySuperadminError();

  await db.transaction(async (tx) => {
    await tx.update(users).set({ status }).where(eq(users.id, userId));
    if (status !== "active") {
      await tx.delete(sessions).where(eq(sessions.userId, userId));
    }
    if (status === "deleted") {
      await tx.delete(orgMembers).where(eq(orgMembers.userId, userId));
    }
  });
}
```

В `apps/api/src/routes/auth.ts`, импортировать `AccountInactiveError` и в `POST /auth/login` (строки 84-94) добавить ветку:

```typescript
  try {
    const user = await verifyLogin(db, body.data.email, body.data.password);
    const session = await createSession(db, user.id, { ip: c.req.header("x-forwarded-for"), userAgent: c.req.header("user-agent") });
    setCookie(c, SESSION_COOKIE_NAME, session.id, SESSION_COOKIE_OPTS);
    return c.json({ userId: user.id });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      return c.json({ error: { code: "invalid_credentials", message: err.message } }, 401);
    }
    if (err instanceof AccountInactiveError) {
      return c.json({ error: { code: `account_${err.status}`, message: err.message } }, 403);
    }
    throw err;
  }
```

В `apps/api/src/routes/admin.ts`, импортировать `setUserStatus`, `CannotModifySuperadminError` из `../services/users.js` и `z` (уже импортирован); добавить в конец файла:

```typescript
const statusPatchSchema = z.object({ status: z.enum(["active", "blocked", "deleted"]) });

adminRoutes.patch("/admin/users/:id/status", async (c) => {
  const db = c.get("db");
  const targetId = c.req.param("id");
  const body = statusPatchSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  try {
    await setUserStatus(db, targetId, body.data.status);
  } catch (err) {
    if (err instanceof CannotModifySuperadminError) return c.json({ error: { code: "forbidden", message: err.message } }, 403);
    throw err;
  }
  await recordAudit(db, { identity: c.get("identity")!, action: "user.set_status", targetType: "user", targetId, meta: { status: body.data.status } });
  return c.json({ ok: true });
});
```

- [ ] **Step 5: Прогнать тесты**

Run: `cd apps/api && pnpm test:integration`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/schema.ts apps/api/drizzle apps/api/src/services/users.ts apps/api/src/routes/auth.ts apps/api/src/routes/admin.ts apps/api/src/__tests__/integration/account-status.test.ts
git commit -m "Add account status (active/blocked/deleted) with login gating"
```

---

### Task 3: Смена своего email/пароля — `PATCH /auth/me`

**Files:**
- Modify: `apps/api/src/services/users.ts` (новый `updateOwnAccount`)
- Modify: `apps/api/src/routes/auth.ts` (новый роут `PATCH /auth/me`)
- Test: `apps/api/src/__tests__/integration/account-settings.test.ts` (new)

**Interfaces:**
- Produces: `updateOwnAccount(db, userId, input: { currentPassword, email?, name?, newPassword? }): Promise<User>`, бросает `InvalidCredentialsError` / `EmailAlreadyRegisteredError`.

- [ ] **Step 1: Написать падающий тест**

Создать `apps/api/src/__tests__/integration/account-settings.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("PATCH /auth/me", () => {
  it("updates email and password when the current password is correct", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);

    const res = await app.request("/api/v1/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ email: "new-email@example.com", newPassword: "a new strong password", currentPassword: user.password }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe("new-email@example.com");

    const loginRes = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "new-email@example.com", password: "a new strong password" }),
    });
    expect(loginRes.status).toBe(200);
  });

  it("rejects the update when the current password is wrong", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);

    const res = await app.request("/api/v1/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ email: "new-email@example.com", currentPassword: "totally wrong" }),
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться что падает**

Run: `cd apps/api && pnpm test:integration -- account-settings`
Expected: FAIL — `PATCH /auth/me` не существует (404).

- [ ] **Step 3: Реализовать `updateOwnAccount` и роут**

В `apps/api/src/services/users.ts`, в конец файла добавить:

```typescript
export async function updateOwnAccount(
  db: Database,
  userId: string,
  input: { currentPassword: string; email?: string; name?: string; newPassword?: string },
) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw new InvalidCredentialsError();
  const ok = await verifySecret(input.currentPassword, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();

  if (input.email && input.email.toLowerCase() !== user.email) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, input.email.toLowerCase()) });
    if (existing) throw new EmailAlreadyRegisteredError();
  }

  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.email) patch.email = input.email.toLowerCase();
  if (input.name) patch.name = input.name;
  if (input.newPassword) patch.passwordHash = await hashSecret(input.newPassword);

  const [updated] = await db.update(users).set(patch).where(eq(users.id, userId)).returning();
  return updated!;
}
```

В `apps/api/src/routes/auth.ts`, импортировать `updateOwnAccount` и `z` из `"zod"`; добавить перед `/auth/me` GET-роутом:

```typescript
const updateMeSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().min(1).max(200).optional(),
  newPassword: z.string().min(8).max(200).optional(),
  currentPassword: z.string().min(1),
});

authRoutes.patch("/auth/me", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const body = updateMeSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  try {
    const updated = await updateOwnAccount(db, identity.userId, body.data);
    return c.json({ id: updated.id, email: updated.email, name: updated.name });
  } catch (err) {
    if (err instanceof InvalidCredentialsError) return c.json({ error: { code: "invalid_credentials", message: err.message } }, 401);
    if (err instanceof EmailAlreadyRegisteredError) return c.json({ error: { code: "email_taken", message: err.message } }, 409);
    throw err;
  }
});
```

- [ ] **Step 4: Прогнать тесты**

Run: `cd apps/api && pnpm test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/users.ts apps/api/src/routes/auth.ts apps/api/src/__tests__/integration/account-settings.test.ts
git commit -m "Add self-service account settings endpoint (PATCH /auth/me)"
```

---

### Task 4: Смена роли участника команды

**Files:**
- Create: `apps/api/src/services/orgs.ts`
- Modify: `apps/api/src/routes/orgs.ts` (новый роут `PATCH /orgs/:id/members/:userId`)
- Test: `apps/api/src/__tests__/integration/org-roles.test.ts` (new)

**Interfaces:**
- Produces: `changeMemberRole(db, orgId, userId, role): Promise<void>`, бросает `LastOwnerError` / `NotAMemberError`.
- Produces: `listMemberOrgIds(db, userId): Promise<string[]>` (понадобится в Task 6, 7).

- [ ] **Step 1: Написать падающий тест**

Создать `apps/api/src/__tests__/integration/org-roles.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { buildTestApp, extractCookie, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

async function inviteAndRegister(app: ReturnType<typeof buildTestApp>, owner: { orgId: string; sessionCookie: string }, email: string) {
  const inviteRes = await app.request(`/api/v1/orgs/${owner.orgId}/invites`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
    body: JSON.stringify({ email, role: "member" }),
  });
  const invite = (await inviteRes.json()) as { token: string };
  const res = await app.request(`/api/v1/auth/register?invite=${invite.token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple", name: "Member" }),
  });
  const body = (await res.json()) as { userId: string };
  const sessionCookie = extractCookie(res, "oa_session")!;
  return { userId: body.userId, sessionCookie };
}

describe("PATCH /orgs/:id/members/:userId", () => {
  it("lets an owner promote a member to admin", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const member = await inviteAndRegister(app, owner, "member@example.com");

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${member.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(200);

    const membersRes = await app.request(`/api/v1/orgs/${owner.orgId}/members`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    const membersBody = (await membersRes.json()) as { members: { userId: string; role: string }[] };
    expect(membersBody.members.find((m) => m.userId === member.userId)?.role).toBe("admin");
  });

  it("refuses to demote the last remaining owner", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${owner.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ role: "member" }),
    });
    expect(res.status).toBe(409);
  });

  it("rejects a plain member trying to change roles", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const other = await inviteAndRegister(app, owner, "other@example.com");
    const acting = await inviteAndRegister(app, owner, "acting@example.com");

    const res = await app.request(`/api/v1/orgs/${owner.orgId}/members/${other.userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${acting.sessionCookie}` },
      body: JSON.stringify({ role: "admin" }),
    });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться что падает**

Run: `cd apps/api && pnpm test:integration -- org-roles`
Expected: FAIL — роут не существует (404).

- [ ] **Step 3: Реализовать сервис и роут**

Создать `apps/api/src/services/orgs.ts`:

```typescript
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client.js";
import { orgMembers } from "../db/schema.js";

export class LastOwnerError extends Error {
  constructor() {
    super("Cannot change role: this is the last owner of the organization");
  }
}

export class NotAMemberError extends Error {
  constructor() {
    super("User is not a member of this organization");
  }
}

export async function listMemberOrgIds(db: Database, userId: string): Promise<string[]> {
  const rows = await db.query.orgMembers.findMany({ where: eq(orgMembers.userId, userId) });
  return rows.map((r) => r.orgId);
}

export async function changeMemberRole(
  db: Database,
  orgId: string,
  userId: string,
  role: "owner" | "admin" | "member" | "viewer",
) {
  const membership = await db.query.orgMembers.findFirst({
    where: and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)),
  });
  if (!membership) throw new NotAMemberError();

  if (membership.role === "owner" && role !== "owner") {
    const [{ n: ownerCount }] = await db
      .select({ n: sql<number>`count(*)` })
      .from(orgMembers)
      .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.role, "owner")));
    if (Number(ownerCount) <= 1) throw new LastOwnerError();
  }

  await db.update(orgMembers).set({ role }).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
}
```

В `apps/api/src/routes/orgs.ts`, импортировать `changeMemberRole`, `LastOwnerError`, `NotAMemberError` из `../services/orgs.js`; добавить после `DELETE /orgs/:id/members/:userId`:

```typescript
const changeRoleSchema = z.object({ role: orgRoleSchema });

orgRoutes.patch("/orgs/:id/members/:userId", requireAuth, async (c) => {
  const orgId = c.req.param("id");
  const targetUserId = c.req.param("userId");
  const role = await requireOrgRole(c, orgId, ["owner", "admin"]);
  if (!role) return c.json({ error: { code: "forbidden" } }, 403);

  const body = changeRoleSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: { code: "invalid_input", message: body.error.message } }, 400);

  const db = c.get("db");
  try {
    await changeMemberRole(db, orgId, targetUserId, body.data.role);
  } catch (err) {
    if (err instanceof LastOwnerError) return c.json({ error: { code: "last_owner", message: err.message } }, 409);
    if (err instanceof NotAMemberError) return c.json({ error: { code: "not_found", message: err.message } }, 404);
    throw err;
  }
  await recordAudit(db, { orgId, identity: c.get("identity")!, action: "org.change_role", targetType: "user", targetId: targetUserId, meta: { role: body.data.role } });
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Прогнать тесты**

Run: `cd apps/api && pnpm test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/orgs.ts apps/api/src/routes/orgs.ts apps/api/src/__tests__/integration/org-roles.test.ts
git commit -m "Add endpoint to change an existing org member's role"
```

---

### Task 5: Пагинированный `GET /orgs` + `GET /orgs/:id`, убрать `GET /admin/orgs`

**Files:**
- Modify: `apps/api/src/services/orgs.ts` (добавить `listOrgsForUser`, `listAllOrgs`, `getOrgDetail`)
- Modify: `apps/api/src/routes/orgs.ts` (переписать `GET /orgs`, добавить `GET /orgs/:id`)
- Modify: `apps/api/src/routes/admin.ts` (удалить `GET /admin/orgs`)
- Test: `apps/api/src/__tests__/integration/org-listing.test.ts` (new)

**Interfaces:**
- Produces: `listOrgsForUser(db, userId, { search?, page, pageSize }): Promise<{ orgs: OrgListItem[]; total: number }>`
- Produces: `listAllOrgs(db, { search?, page, pageSize }): Promise<{ orgs: OrgListItem[]; total: number }>`
- Produces: `getOrgDetail(db, orgId): Promise<{ id; name; slug; storageQuotaBytes; memberCount; createdAt } | null>`
- `OrgListItem = { id: string; name: string; slug: string; role: string | null; memberCount: number }`

- [ ] **Step 1: Написать падающий тест**

Создать `apps/api/src/__tests__/integration/org-listing.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /orgs", () => {
  it("returns only the caller's orgs, paginated", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    await app.request("/api/v1/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ name: "Second Team" }),
    });

    const res = await app.request("/api/v1/orgs?page=1&pageSize=1", { headers: { Cookie: `oa_session=${user.sessionCookie}` } });
    const body = (await res.json()) as { orgs: unknown[]; total: number; page: number };
    expect(body.total).toBe(2);
    expect(body.orgs).toHaveLength(1);
    expect(body.page).toBe(1);
  });

  it("returns every org in the system for a superadmin, including ones they don't belong to", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const admin = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request("/api/v1/orgs?pageSize=100", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const body = (await res.json()) as { orgs: { id: string }[] };
    expect(body.orgs.some((o) => o.id === owner.orgId)).toBe(true);
  });
});

describe("GET /orgs/:id", () => {
  it("404s for a non-existent org and 403s for a non-member", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    const outsider = await registerAndLogin(app);

    const notFound = await app.request(`/api/v1/orgs/00000000-0000-0000-0000-000000000000`, { headers: { Cookie: `oa_session=${owner.sessionCookie}` } });
    expect(notFound.status).toBe(404);

    const forbidden = await app.request(`/api/v1/orgs/${owner.orgId}`, { headers: { Cookie: `oa_session=${outsider.sessionCookie}` } });
    expect(forbidden.status).toBe(403);
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться что падает**

Run: `cd apps/api && pnpm test:integration -- org-listing`
Expected: FAIL — текущий `GET /orgs` не поддерживает пагинацию/чужие команды, `GET /orgs/:id` не существует.

- [ ] **Step 3: Реализовать сервисные функции**

В `apps/api/src/services/orgs.ts` добавить (после существующего кода):

```typescript
import { ilike, inArray } from "drizzle-orm";
import { orgs } from "../db/schema.js";

export interface OrgListItem {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  memberCount: number;
}

export interface PageOpts {
  search?: string;
  page: number;
  pageSize: number;
}

async function countMembers(db: Database, orgId: string): Promise<number> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(orgMembers).where(eq(orgMembers.orgId, orgId));
  return Number(n);
}

export async function listAllOrgs(db: Database, opts: PageOpts): Promise<{ orgs: OrgListItem[]; total: number }> {
  const where = opts.search ? ilike(orgs.name, `%${opts.search}%`) : undefined;
  const [{ n: total }] = await db.select({ n: sql<number>`count(*)` }).from(orgs).where(where);
  const rows = await db.query.orgs.findMany({
    where,
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    limit: opts.pageSize,
    offset: (opts.page - 1) * opts.pageSize,
  });
  const list = await Promise.all(
    rows.map(async (o) => ({ id: o.id, name: o.name, slug: o.slug, role: null as string | null, memberCount: await countMembers(db, o.id) })),
  );
  return { orgs: list, total: Number(total) };
}

export async function listOrgsForUser(db: Database, userId: string, opts: PageOpts): Promise<{ orgs: OrgListItem[]; total: number }> {
  const memberships = await db.query.orgMembers.findMany({ where: eq(orgMembers.userId, userId) });
  const orgIds = memberships.map((m) => m.orgId);
  if (orgIds.length === 0) return { orgs: [], total: 0 };
  const roleByOrgId = new Map(memberships.map((m) => [m.orgId, m.role]));

  const where = opts.search ? and(inArray(orgs.id, orgIds), ilike(orgs.name, `%${opts.search}%`)) : inArray(orgs.id, orgIds);
  const [{ n: total }] = await db.select({ n: sql<number>`count(*)` }).from(orgs).where(where);
  const rows = await db.query.orgs.findMany({
    where,
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    limit: opts.pageSize,
    offset: (opts.page - 1) * opts.pageSize,
  });
  const list = await Promise.all(
    rows.map(async (o) => ({ id: o.id, name: o.name, slug: o.slug, role: roleByOrgId.get(o.id) ?? null, memberCount: await countMembers(db, o.id) })),
  );
  return { orgs: list, total: Number(total) };
}

export async function getOrgDetail(db: Database, orgId: string) {
  const org = await db.query.orgs.findFirst({ where: eq(orgs.id, orgId) });
  if (!org) return null;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    storageQuotaBytes: org.storageQuotaBytes,
    createdAt: org.createdAt,
    memberCount: await countMembers(db, org.id),
  };
}
```

(объединить с уже существующими импортами `and, eq, sql` вверху файла — просто дописать `ilike, inArray` в тот же import.)

- [ ] **Step 4: Переписать роуты**

В `apps/api/src/routes/orgs.ts`, заменить `GET /orgs` (строки 19-31) на:

```typescript
orgRoutes.get("/orgs", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const search = c.req.query("search") || undefined;
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20")));

  const db = c.get("db");
  const result = identity.isSuperadmin
    ? await listAllOrgs(db, { search, page, pageSize })
    : await listOrgsForUser(db, identity.userId, { search, page, pageSize });

  return c.json({ orgs: result.orgs, total: result.total, page, pageSize });
});

orgRoutes.get("/orgs/:id", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (identity.kind !== "user") return c.json({ error: { code: "forbidden" } }, 403);

  const orgId = c.req.param("id");
  const db = c.get("db");
  const myRole = await getOrgRole(db, orgId, identity.userId);
  if (!myRole && !identity.isSuperadmin) return c.json({ error: { code: "forbidden" } }, 403);

  const detail = await getOrgDetail(db, orgId);
  if (!detail) return c.json({ error: { code: "not_found" } }, 404);
  return c.json({ ...detail, myRole });
});
```

Импортировать `listAllOrgs, listOrgsForUser, getOrgDetail` из `../services/orgs.js`.

В `apps/api/src/routes/admin.ts`, удалить блок:

```typescript
adminRoutes.get("/admin/orgs", async (c) => {
  const db = c.get("db");
  const list = await db.query.orgs.findMany();
  return c.json({ orgs: list });
});
```

(остальные роуты `admin.ts`, включая `/admin/orgs/:id/top-artifacts`, не трогать — они не заменяются этим планом.)

- [ ] **Step 5: Прогнать тесты**

Run: `cd apps/api && pnpm test:integration`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/orgs.ts apps/api/src/routes/orgs.ts apps/api/src/routes/admin.ts apps/api/src/__tests__/integration/org-listing.test.ts
git commit -m "Paginate GET /orgs and add GET /orgs/:id; retire GET /admin/orgs"
```

---

### Task 6: `GET /artifacts` без `orgId` — объединённый список по всем командам

**Files:**
- Modify: `apps/api/src/services/artifacts.ts:127-132` (добавить `listArtifactsForOrgs`, `listAllArtifacts`)
- Modify: `apps/api/src/routes/artifacts.ts:28-43`
- Test: `apps/api/src/__tests__/integration/multi-org-artifacts.test.ts` (new)

**Interfaces:**
- Produces: `listArtifactsForOrgs(db, orgIds: string[])`, `listAllArtifacts(db)`.
- Consumes: `listMemberOrgIds` из `services/orgs.ts` (Task 4).

- [ ] **Step 1: Написать падающий тест**

Создать `apps/api/src/__tests__/integration/multi-org-artifacts.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /artifacts without orgId", () => {
  it("combines artifacts across all of a regular user's orgs", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const secondOrgRes = await app.request("/api/v1/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ name: "Second Team" }),
    });
    const secondOrg = (await secondOrgRes.json()) as { id: string };

    for (const orgId of [user.orgId, secondOrg.id]) {
      await app.request(`/api/v1/artifacts?orgId=${orgId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
        body: JSON.stringify({ title: `Art in ${orgId}`, kind: "html", content: "<p>hi</p>", visibility: "private" }),
      });
    }

    const res = await app.request("/api/v1/artifacts", { headers: { Cookie: `oa_session=${user.sessionCookie}` } });
    const body = (await res.json()) as { artifacts: { orgId: string }[] };
    expect(body.artifacts).toHaveLength(2);
    expect(new Set(body.artifacts.map((a) => a.orgId))).toEqual(new Set([user.orgId, secondOrg.id]));
  });

  it("returns artifacts from every org in the system for a superadmin", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await app.request(`/api/v1/artifacts?orgId=${owner.orgId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ title: "Owner's artifact", kind: "html", content: "<p>hi</p>", visibility: "private" }),
    });

    const admin = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request("/api/v1/artifacts", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const body = (await res.json()) as { artifacts: { orgId: string }[] };
    expect(body.artifacts.some((a) => a.orgId === owner.orgId)).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться что падает**

Run: `cd apps/api && pnpm test:integration -- multi-org-artifacts`
Expected: FAIL — сейчас `GET /artifacts` без `orgId` отвечает 400.

- [ ] **Step 3: Реализовать**

В `apps/api/src/services/artifacts.ts`, после `listArtifactsForOrg` (строки 127-132) добавить:

```typescript
export async function listArtifactsForOrgs(db: Database, orgIds: string[]) {
  if (orgIds.length === 0) return [];
  return db.query.artifacts.findMany({
    where: and(inArray(artifacts.orgId, orgIds), isNull(artifacts.deletedAt)),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
  });
}

export async function listAllArtifacts(db: Database) {
  return db.query.artifacts.findMany({
    where: isNull(artifacts.deletedAt),
    orderBy: (a, { desc }) => [desc(a.updatedAt)],
  });
}
```

Добавить `inArray` в существующий импорт `drizzle-orm` в начале файла.

В `apps/api/src/routes/artifacts.ts`, заменить `GET /artifacts` (строки 28-43) на:

```typescript
artifactRoutes.get("/artifacts", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  if (!requiresScope(identity, "artifacts:read")) return c.json({ error: { code: "forbidden", message: "Missing scope artifacts:read" } }, 403);

  const db = c.get("db");
  const orgIdParam = identity.kind === "agent" ? identity.orgId : c.req.query("orgId");

  let all;
  if (orgIdParam) {
    all = await listArtifactsForOrg(db, orgIdParam);
  } else if (identity.kind === "user" && identity.isSuperadmin) {
    all = await listAllArtifacts(db);
  } else if (identity.kind === "user") {
    all = await listArtifactsForOrgs(db, await listMemberOrgIds(db, identity.userId));
  } else {
    return c.json({ error: { code: "invalid_input", message: "orgId query param is required" } }, 400);
  }

  const visible = [];
  for (const artifact of all) {
    const access = await resolveAccessForIdentity(db, identity, artifact);
    if (access.read) visible.push(artifact);
  }
  return c.json({ artifacts: visible });
});
```

Добавить импорты: `listArtifactsForOrgs, listAllArtifacts` из `../services/artifacts.js` (в существующий импорт-блок), `listMemberOrgIds` из `../services/orgs.js`.

- [ ] **Step 4: Прогнать тесты**

Run: `cd apps/api && pnpm test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/artifacts.ts apps/api/src/routes/artifacts.ts apps/api/src/__tests__/integration/multi-org-artifacts.test.ts
git commit -m "Let GET /artifacts combine results across all accessible orgs"
```

---

### Task 7: `GET /agents` без `orgId` — объединённый список по всем командам

**Files:**
- Modify: `apps/api/src/services/agents.ts:90-92` (добавить `listAgentsForOrgs`, `listAllAgents`)
- Modify: `apps/api/src/routes/agents.ts:22-29`
- Test: `apps/api/src/__tests__/integration/multi-org-agents.test.ts` (new)

**Interfaces:**
- Produces: `listAgentsForOrgs(db, orgIds: string[])`, `listAllAgents(db)`.

- [ ] **Step 1: Написать падающий тест**

Создать `apps/api/src/__tests__/integration/multi-org-agents.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /agents without orgId", () => {
  it("combines agents across all of a regular user's orgs", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const secondOrgRes = await app.request("/api/v1/orgs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
      body: JSON.stringify({ name: "Second Team" }),
    });
    const secondOrg = (await secondOrgRes.json()) as { id: string };

    for (const orgId of [user.orgId, secondOrg.id]) {
      await app.request(`/api/v1/agents?orgId=${orgId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `oa_session=${user.sessionCookie}` },
        body: JSON.stringify({ name: `agent-${orgId.slice(0, 4)}` }),
      });
    }

    const res = await app.request("/api/v1/agents", { headers: { Cookie: `oa_session=${user.sessionCookie}` } });
    const body = (await res.json()) as { agents: { orgId: string }[] };
    expect(body.agents).toHaveLength(2);
  });

  it("returns agents from every org in the system for a superadmin", async () => {
    const app = buildTestApp();
    const owner = await registerAndLogin(app);
    await app.request(`/api/v1/agents?orgId=${owner.orgId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: `oa_session=${owner.sessionCookie}` },
      body: JSON.stringify({ name: "owner-agent" }),
    });

    const admin = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request("/api/v1/agents", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    const body = (await res.json()) as { agents: { orgId: string }[] };
    expect(body.agents.some((a) => a.orgId === owner.orgId)).toBe(true);
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться что падает**

Run: `cd apps/api && pnpm test:integration -- multi-org-agents`
Expected: FAIL — сейчас `GET /agents` без `orgId` отвечает 400.

- [ ] **Step 3: Реализовать**

В `apps/api/src/services/agents.ts`, после `listAgentsForOrg` (строки 90-92) добавить:

```typescript
export async function listAgentsForOrgs(db: Database, orgIds: string[]) {
  if (orgIds.length === 0) return [];
  return db.query.agents.findMany({ where: inArray(agents.orgId, orgIds) });
}

export async function listAllAgents(db: Database) {
  return db.query.agents.findMany();
}
```

Добавить `inArray` в существующий импорт `drizzle-orm` в начале файла.

В `apps/api/src/routes/agents.ts`, заменить `GET /agents` (строки 22-29) на:

```typescript
agentRoutes.get("/agents", requireAuth, async (c) => {
  const identity = c.get("identity")!;
  const orgId = c.req.query("orgId");
  const db = c.get("db");

  if (orgId) {
    if (!(await requireOrgMember(c, orgId))) return c.json({ error: { code: "forbidden" } }, 403);
    return c.json({ agents: await listAgentsForOrg(db, orgId) });
  }

  if (identity.kind !== "user") return c.json({ error: { code: "invalid_input", message: "orgId query param is required" } }, 400);
  if (identity.isSuperadmin) return c.json({ agents: await listAllAgents(db) });
  return c.json({ agents: await listAgentsForOrgs(db, await listMemberOrgIds(db, identity.userId)) });
});
```

Добавить импорты: `listAgentsForOrgs, listAllAgents` из `../services/agents.js`, `listMemberOrgIds` из `../services/orgs.js`.

- [ ] **Step 4: Прогнать тесты**

Run: `cd apps/api && pnpm test:integration`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/agents.ts apps/api/src/routes/agents.ts apps/api/src/__tests__/integration/multi-org-agents.test.ts
git commit -m "Let GET /agents combine results across all accessible orgs"
```

---

### Task 8: `GET /admin/users` — список всех пользователей с командами и ролями

**Files:**
- Modify: `apps/api/src/routes/admin.ts`
- Test: `apps/api/src/__tests__/integration/admin-users.test.ts` (new)

**Interfaces:**
- Produces: HTTP `GET /admin/users?search=&page=&pageSize=` → `{ users: AdminUserSummary[]; total; page; pageSize }`, `AdminUserSummary = { id, email, name, status, isSuperadmin, createdAt, orgs: { orgId, orgName, role }[] }`.

- [ ] **Step 1: Написать падающий тест**

Создать `apps/api/src/__tests__/integration/admin-users.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../../db/schema.js";
import { buildTestApp, getTestDb, registerAndLogin, resetDb } from "./helpers.js";

beforeEach(resetDb);

describe("GET /admin/users", () => {
  it("lists users with their org memberships and roles, searchable by email", async () => {
    const app = buildTestApp();
    const target = await registerAndLogin(app, { email: "findme@example.com" });
    const admin = await registerAndLogin(app);
    await getTestDb().update(users).set({ isSuperadmin: true }).where(eq(users.id, admin.userId));

    const res = await app.request("/api/v1/admin/users?search=findme", { headers: { Cookie: `oa_session=${admin.sessionCookie}` } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { users: { id: string; orgs: { orgId: string; role: string }[] }[]; total: number };
    expect(body.total).toBe(1);
    expect(body.users[0]!.id).toBe(target.userId);
    expect(body.users[0]!.orgs.find((o) => o.orgId === target.orgId)?.role).toBe("owner");
  });

  it("is forbidden for a non-superadmin", async () => {
    const app = buildTestApp();
    const user = await registerAndLogin(app);
    const res = await app.request("/api/v1/admin/users", { headers: { Cookie: `oa_session=${user.sessionCookie}` } });
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 2: Запустить тест и убедиться что падает**

Run: `cd apps/api && pnpm test:integration -- admin-users`
Expected: FAIL — роут не существует (404 через `requireSuperadmin`... на самом деле роута нет вовсе, 404 от Hono).

- [ ] **Step 3: Реализовать**

В `apps/api/src/routes/admin.ts`, импортировать `or, ilike, inArray` из `drizzle-orm` (дописать в существующий импорт) и `orgMembers` из `../db/schema.js` (дописать в существующий импорт `{ artifacts, agents, orgs, users }`). Добавить перед `/admin/audit`:

```typescript
adminRoutes.get("/admin/users", async (c) => {
  const db = c.get("db");
  const search = c.req.query("search") || undefined;
  const page = Math.max(1, Number(c.req.query("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(c.req.query("pageSize") ?? "20")));

  const where = search ? or(ilike(users.email, `%${search}%`), ilike(users.name, `%${search}%`)) : undefined;
  const [{ n: total }] = await db.select({ n: sql<number>`count(*)` }).from(users).where(where);
  const rows = await db.query.users.findMany({
    where,
    orderBy: (u, { desc }) => [desc(u.createdAt)],
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const userIds = rows.map((u) => u.id);
  const memberships = userIds.length ? await db.query.orgMembers.findMany({ where: inArray(orgMembers.userId, userIds) }) : [];
  const membershipOrgIds = [...new Set(memberships.map((m) => m.orgId))];
  const orgRows = membershipOrgIds.length ? await db.query.orgs.findMany({ where: inArray(orgs.id, membershipOrgIds) }) : [];
  const orgNameById = new Map(orgRows.map((o) => [o.id, o.name]));

  const usersList = rows.map((u) => ({
    id: u.id,
    email: u.email,
    name: u.name,
    status: u.status,
    isSuperadmin: u.isSuperadmin,
    createdAt: u.createdAt,
    orgs: memberships
      .filter((m) => m.userId === u.id)
      .map((m) => ({ orgId: m.orgId, orgName: orgNameById.get(m.orgId) ?? m.orgId, role: m.role })),
  }));

  return c.json({ users: usersList, total: Number(total), page, pageSize });
});
```

- [ ] **Step 4: Прогнать тесты**

Run: `cd apps/api && pnpm test:integration`
Expected: PASS — включая весь набор бэкенд-тестов из Task 1-8 разом.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/admin.ts apps/api/src/__tests__/integration/admin-users.test.ts
git commit -m "Add GET /admin/users: paginated user list with org memberships"
```

---

## Часть 2 — Frontend

Веб-приложение не имеет юнит-тестов (`apps/web/package.json`: `"test": "echo \"no unit tests in web\""`). Проверка для каждой фронтенд-задачи: `pnpm --filter @open-artifacts/web typecheck` + ручная проверка в браузере (`docker compose up` или `pnpm --filter @open-artifacts/web dev`).

### Task 9: Типы и хук `useOrgList` для пагинированного списка команд

**Files:**
- Modify: `apps/web/src/lib/api.ts` (добавить `OrgSummary`, `AdminUserSummary`)
- Create: `apps/web/src/lib/useOrgList.ts`

**Interfaces:**
- Produces: `useOrgList(search: string, page: number, pageSize?: number): { orgs: OrgSummary[]; total: number; loading: boolean; refetch: () => void }`.
- Produces (тип): `OrgSummary = { id: string; name: string; slug: string; role: string | null; memberCount: number }`.

- [ ] **Step 1: Добавить типы в `api.ts`**

В `apps/web/src/lib/api.ts`, добавить после интерфейса `ArtifactSummary`:

```typescript
export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  memberCount: number;
}

export interface AdminUserSummary {
  id: string;
  email: string;
  name: string;
  status: "active" | "blocked" | "deleted";
  isSuperadmin: boolean;
  createdAt: string;
  orgs: { orgId: string; orgName: string; role: string }[];
}
```

- [ ] **Step 2: Создать хук**

Создать `apps/web/src/lib/useOrgList.ts`:

```typescript
import { useEffect, useState } from "react";
import { api, type OrgSummary } from "./api";

export function useOrgList(search: string, page: number, pageSize = 20) {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) qs.set("search", search);
    api.get<{ orgs: OrgSummary[]; total: number }>(`/orgs?${qs.toString()}`).then((data) => {
      if (cancelled) return;
      setOrgs(data.orgs);
      setTotal(data.total);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, pageSize, tick]);

  return { orgs, total, loading, refetch: () => setTick((t) => t + 1) };
}
```

- [ ] **Step 3: Типчек**

Run: `pnpm --filter @open-artifacts/web typecheck`
Expected: PASS (новый файл не используется пока нигде, ошибок быть не должно).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/useOrgList.ts
git commit -m "Add OrgSummary/AdminUserSummary types and useOrgList hook"
```

---

### Task 10: Сайдбар получает пункт «Все организации» по умолчанию

**Files:**
- Modify: `apps/web/src/lib/auth.tsx`

**Interfaces:**
- Produces: `AuthState.currentOrgId: string` (было `string | null`) — теперь всегда `"all"` или id конкретной команды, никогда `null`.

- [ ] **Step 1: Изменить дефолт и убрать логику автовыбора первой команды**

В `apps/web/src/lib/auth.tsx`, заменить:

```typescript
interface AuthState {
  me: Me | null;
  loading: boolean;
  currentOrgId: string;
  setCurrentOrgId: (id: string) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}
```

и в `AuthProvider`:

```typescript
export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentOrgId, setCurrentOrgIdState] = useState<string>(localStorage.getItem("oa_org_id") ?? "all");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Me>("/auth/me");
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);
```

(убрать блок `if (!currentOrgId && data.orgs.length > 0) { setCurrentOrgIdState(...) }` целиком — дефолт теперь всегда `"all"`, если пользователь не выбрал явно другую команду через сайдбар.)

- [ ] **Step 2: Типчек**

Run: `pnpm --filter @open-artifacts/web typecheck`
Expected: FAIL на этом шаге — `ArtifactsPage.tsx`, `AgentsPage.tsx`, `OrgPage.tsx` используют `if (!currentOrgId) return;`, что больше не имеет смысла с non-nullable типом, но TS это не отловит как ошибку типов (просто мёртвый код) — типчек должен пройти. Если типчек всё же падает из-за использования `currentOrgId` как `string | null` где-то ещё, поправить эти места по месту (ожидается, что таких мест, кроме уже перечисленных трёх страниц, нет — они будут переписаны в Task 12/13/16).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/auth.tsx
git commit -m "Default currentOrgId to 'all' instead of the first org membership"
```

---

### Task 11: Артефакты — режим «Все команды», колонка «Команда», фильтр

**Files:**
- Modify: `apps/web/src/pages/ArtifactsPage.tsx`

- [ ] **Step 1: Переписать страницу**

Заменить содержимое `apps/web/src/pages/ArtifactsPage.tsx` целиком на:

```typescript
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type ArtifactSummary } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useOrgList } from "../lib/useOrgList";

export function ArtifactsPage() {
  const { currentOrgId } = useAuth();
  const { orgs } = useOrgList("", 1, 100);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [filterOrgId, setFilterOrgId] = useState("all");

  const isAll = currentOrgId === "all";
  const effectiveOrgId = isAll ? (filterOrgId === "all" ? null : filterOrgId) : currentOrgId;

  async function load() {
    const qs = effectiveOrgId ? `?orgId=${effectiveOrgId}` : "";
    const data = await api.get<{ artifacts: ArtifactSummary[] }>(`/artifacts${qs}`);
    setArtifacts(data.artifacts);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId, filterOrgId]);

  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2>Артефакты</h2>
        <div className="row" style={{ gap: 8 }}>
          {isAll && (
            <select value={filterOrgId} onChange={(e) => setFilterOrgId(e.target.value)}>
              <option value="all">Все команды</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          )}
          {effectiveOrgId && (
            <button className="btn" onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Отмена" : "Новый артефакт"}</button>
          )}
        </div>
      </div>

      {showCreate && effectiveOrgId && (
        <CreateArtifactForm
          orgId={effectiveOrgId}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Название</th><th>Тип</th><th>Видимость</th>
              {isAll && <th>Команда</th>}
              <th>Обновлён</th>
            </tr>
          </thead>
          <tbody>
            {artifacts.map((a) => (
              <tr key={a.id}>
                <td><Link to={`/artifacts/${a.id}`}>{a.title}</Link></td>
                <td><span className="badge">{a.kind}</span></td>
                <td>{a.visibility === "org" ? "команда" : "приватный"}</td>
                {isAll && <td className="muted">{orgNameById.get(a.orgId) ?? a.orgId.slice(0, 8)}</td>}
                <td className="muted">{new Date(a.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {artifacts.length === 0 && (
              <tr>
                <td colSpan={isAll ? 5 : 4} className="muted">
                  Пока пусто. {orgs.length === 0 && "Создайте команду на вкладке «Команды»."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateArtifactForm({ orgId, onCreated }: { orgId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"html" | "markdown" | "mermaid" | "svg">("html");
  const [content, setContent] = useState("<h1>Hello, world</h1>");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/artifacts?orgId=${orgId}`, { title, kind, content, visibility: "private" });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <form onSubmit={onSubmit} className="card stack">
      <input placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="html">HTML</option>
        <option value="markdown">Markdown</option>
        <option value="mermaid">Mermaid</option>
        <option value="svg">SVG</option>
      </select>
      <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} required />
      {error && <div className="error">{error}</div>}
      <button className="btn" type="submit">Создать</button>
    </form>
  );
}
```

- [ ] **Step 2: Типчек**

Run: `pnpm --filter @open-artifacts/web typecheck`
Expected: PASS.

- [ ] **Step 3: Ручная проверка**

Run: `docker compose up -d --build` (или `pnpm --filter @open-artifacts/api dev` + `pnpm --filter @open-artifacts/web dev`), залогиниться, открыть «Артефакты»:
Expected: по умолчанию (сайдбар = «Все организации») видна колонка «Команда» и фильтр справа; выбор конкретной команды в фильтре сужает список и скрывает колонку «Команда» не требуется (колонка видна пока сайдбар = «Все», даже если фильтр сужен — это ожидаемо, т.к. `isAll` зависит от `currentOrgId`, не от `filterOrgId`); кнопка «Новый артефакт» скрыта, когда фильтр = «Все команды».

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/ArtifactsPage.tsx
git commit -m "Support combined 'all orgs' view on the Artifacts page"
```

---

### Task 12: Агенты — режим «Все команды», колонка «Команда», фильтр

**Files:**
- Modify: `apps/web/src/pages/AgentsPage.tsx`

- [ ] **Step 1: Переписать верхнюю часть страницы**

В `apps/web/src/pages/AgentsPage.tsx`, заменить импорт-блок и интерфейс `Agent`:

```typescript
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";
import { useOrgList } from "../lib/useOrgList";

interface Agent {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
}
```

Заменить тело `AgentsPage` (от `export function AgentsPage()` до закрывающей `}` перед `function AgentCard`) на:

```typescript
export function AgentsPage() {
  const { currentOrgId } = useAuth();
  const { orgs } = useOrgList("", 1, 100);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState("");
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [filterOrgId, setFilterOrgId] = useState("all");

  const isAll = currentOrgId === "all";
  const effectiveOrgId = isAll ? (filterOrgId === "all" ? null : filterOrgId) : currentOrgId;

  async function load() {
    const qs = effectiveOrgId ? `?orgId=${effectiveOrgId}` : "";
    const data = await api.get<{ agents: Agent[] }>(`/agents${qs}`);
    setAgents(data.agents);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId, filterOrgId]);

  async function createAgent(e: React.FormEvent) {
    e.preventDefault();
    if (!effectiveOrgId) return;
    await api.post(`/agents?orgId=${effectiveOrgId}`, { name });
    setName("");
    await load();
  }

  const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <h2>Агенты и ключи</h2>
        {isAll && (
          <select value={filterOrgId} onChange={(e) => setFilterOrgId(e.target.value)}>
            <option value="all">Все команды</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>

      {effectiveOrgId && (
        <form onSubmit={createAgent} className="card row">
          <input placeholder="Имя агента (например, my-langchain-bot)" value={name} onChange={(e) => setName(e.target.value)} required />
          <button className="btn" type="submit">Создать агента</button>
        </form>
      )}

      {issuedToken && (
        <div className="card" style={{ borderColor: "#111" }}>
          <strong>Новый API-ключ (показывается один раз):</strong>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{issuedToken}</pre>
          <button className="btn secondary" onClick={() => setIssuedToken(null)}>Скрыть</button>
        </div>
      )}

      {agents.length === 0 && <p className="muted">Агентов пока нет.</p>}
      {agents.map((agent) => (
        <div key={agent.id}>
          {isAll && <p className="muted" style={{ marginBottom: 4 }}>Команда: {orgNameById.get(agent.orgId) ?? agent.orgId.slice(0, 8)}</p>}
          <AgentCard agent={agent} onIssued={setIssuedToken} />
        </div>
      ))}
    </div>
  );
}
```

`AgentCard` и `ApiKeySummary`/`ALL_SCOPES` ниже — без изменений.

- [ ] **Step 2: Типчек**

Run: `pnpm --filter @open-artifacts/web typecheck`
Expected: PASS.

- [ ] **Step 3: Ручная проверка**

Аналогично Task 11, но для раздела «Агенты».

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/AgentsPage.tsx
git commit -m "Support combined 'all orgs' view on the Agents page"
```

---

### Task 13: Раздел «Команды» — двухуровневый (список → карточка)

**Files:**
- Create: `apps/web/src/pages/TeamsPage.tsx`
- Create: `apps/web/src/pages/TeamDetailPage.tsx`
- Delete: `apps/web/src/pages/OrgPage.tsx` (заменяется двумя новыми страницами)

**Interfaces:**
- Consumes: `GET /orgs`, `GET /orgs/:id`, `GET /orgs/:id/members`, `POST /orgs`, `POST /orgs/:id/invites`, `PATCH /orgs/:id/members/:userId`, `DELETE /orgs/:id/members/:userId`.

- [ ] **Step 1: Список команд**

Создать `apps/web/src/pages/TeamsPage.tsx`:

```typescript
import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useOrgList } from "../lib/useOrgList";

export function TeamsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const { orgs, total, loading, refetch } = useOrgList(search, page, pageSize);
  const [newOrgName, setNewOrgName] = useState("");

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/orgs", { name: newOrgName });
    setNewOrgName("");
    setPage(1);
    refetch();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h2>Команды</h2>

      <div className="card">
        <h3>Создать команду</h3>
        <form onSubmit={createOrg} className="row">
          <input placeholder="Название" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required />
          <button className="btn" type="submit">Создать</button>
        </form>
      </div>

      <div className="card">
        <input
          placeholder="Поиск по названию"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ marginBottom: 12 }}
        />
        <table>
          <thead><tr><th>Название</th><th>Роль</th><th>Участников</th></tr></thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/teams/${o.id}`}>{o.name}</Link></td>
                <td className="muted">{o.role ?? "—"}</td>
                <td className="muted">{o.memberCount}</td>
              </tr>
            ))}
            {!loading && orgs.length === 0 && (
              <tr><td colSpan={3} className="muted">Команд не найдено</td></tr>
            )}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</button>
          <span className="muted">Стр. {page} из {totalPages}</span>
          <button className="btn secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Вперёд</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Карточка команды**

Создать `apps/web/src/pages/TeamDetailPage.tsx`:

```typescript
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

interface OrgDetail {
  id: string;
  name: string;
  slug: string;
  storageQuotaBytes: number;
  memberCount: number;
  createdAt: string;
  myRole: string | null;
}

interface Member {
  userId: string;
  email?: string;
  name?: string;
  role: string;
}

const ROLES = ["owner", "admin", "member", "viewer"];

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { me } = useAuth();
  const [org, setOrg] = useState<OrgDetail | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = org?.myRole === "owner" || org?.myRole === "admin" || !!me?.isSuperadmin;

  async function load() {
    if (!id) return;
    const [orgData, membersData] = await Promise.all([
      api.get<OrgDetail>(`/orgs/${id}`),
      api.get<{ members: Member[] }>(`/orgs/${id}/members`),
    ]);
    setOrg(orgData);
    setMembers(membersData.members);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    const res = await api.post<{ token: string }>(`/orgs/${id}/invites`, { email: inviteEmail, role: "member" });
    setInviteLink(`${window.location.origin}/register?invite=${res.token}`);
    setInviteEmail("");
  }

  async function changeRole(userId: string, role: string) {
    if (!id) return;
    setError(null);
    try {
      await api.patch(`/orgs/${id}/members/${userId}`, { role });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось изменить роль");
    }
  }

  async function removeMember(userId: string) {
    if (!id) return;
    await api.delete(`/orgs/${id}/members/${userId}`);
    if (userId === me?.id) navigate("/teams");
    else await load();
  }

  if (!org) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <button className="btn secondary" onClick={() => navigate("/teams")}>← Все команды</button>
      <h2>{org.name}</h2>
      <p className="muted">{org.memberCount} участников · создана {new Date(org.createdAt).toLocaleDateString()}</p>

      {canManage && (
        <div className="card">
          <h3>Пригласить участника</h3>
          <form onSubmit={invite} className="row">
            <input type="email" placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
            <button className="btn" type="submit">Пригласить</button>
          </form>
          {inviteLink && <p className="muted">Ссылка для регистрации: <code>{inviteLink}</code></p>}
        </div>
      )}

      {error && <div className="error">{error}</div>}

      <div className="card">
        <h3>Участники</h3>
        <table>
          <thead><tr><th>Имя</th><th>Email</th><th>Роль</th><th></th></tr></thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.userId}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>
                  {canManage ? (
                    <select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value)}>
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : m.role}
                </td>
                <td>
                  {m.userId === me?.id ? (
                    <button className="btn secondary" onClick={() => removeMember(m.userId)}>Покинуть команду</button>
                  ) : (
                    canManage && <button className="btn secondary" onClick={() => removeMember(m.userId)}>Удалить</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Удалить старую страницу**

```bash
git rm apps/web/src/pages/OrgPage.tsx
```

(роутинг на `/teams`/`/teams/:id` подключается в Task 16 — до этого момента старый `/org` роут в `App.tsx` временно будет ссылаться на несуществующий модуль; это нормально для промежуточного шага одной задачи, но раз мы удаляем файл в этой же задаче — сразу обновить импорт и маршрут в `App.tsx`, чтобы сборка не ломалась):

В `apps/web/src/App.tsx`, заменить:
```typescript
import { OrgPage } from "./pages/OrgPage";
```
на
```typescript
import { TeamsPage } from "./pages/TeamsPage";
import { TeamDetailPage } from "./pages/TeamDetailPage";
```
и заменить строку `<Route path="/org" element={<OrgPage />} />` на:
```typescript
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:id" element={<TeamDetailPage />} />
```

(Полная перестройка навигации сайдбара и роутинга — в Task 16; здесь только минимально необходимая правка, чтобы `App.tsx` продолжал собираться после удаления `OrgPage.tsx`.)

- [ ] **Step 4: Типчек**

Run: `pnpm --filter @open-artifacts/web typecheck`
Expected: PASS.

- [ ] **Step 5: Ручная проверка**

Открыть `/teams` — список команд с пагинацией и поиском; кликнуть по команде — карточка с участниками, пригласить нового участника, сменить роль существующему, удалить участника.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/TeamsPage.tsx apps/web/src/pages/TeamDetailPage.tsx apps/web/src/App.tsx
git commit -m "Replace single-org Team page with a two-level Teams list/detail"
```

---

### Task 14: Раздел «Пользователи» (только superadmin)

**Files:**
- Create: `apps/web/src/pages/UsersPage.tsx`

**Interfaces:**
- Consumes: `GET /admin/users`, `PATCH /admin/users/:id/status`, `PATCH /orgs/:id/members/:userId`.

- [ ] **Step 1: Реализовать страницу**

Создать `apps/web/src/pages/UsersPage.tsx`:

```typescript
import { useEffect, useState } from "react";
import { api, type AdminUserSummary } from "../lib/api";

const ROLES = ["owner", "admin", "member", "viewer"];

export function UsersPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const pageSize = 20;

  async function load() {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) qs.set("search", search);
    const data = await api.get<{ users: AdminUserSummary[]; total: number }>(`/admin/users?${qs.toString()}`);
    setUsers(data.users);
    setTotal(data.total);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page]);

  async function setStatus(userId: string, status: "active" | "blocked" | "deleted") {
    if (status === "deleted" && !confirm("Удалить учётную запись безвозвратно? Пользователь потеряет доступ ко всем командам.")) return;
    await api.patch(`/admin/users/${userId}/status`, { status });
    await load();
  }

  async function changeRole(orgId: string, userId: string, role: string) {
    await api.patch(`/orgs/${orgId}/members/${userId}`, { role });
    await load();
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <h2>Пользователи</h2>
      <div className="card">
        <input
          placeholder="Поиск по email или имени"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ marginBottom: 12 }}
        />
        <table>
          <thead><tr><th>Email</th><th>Имя</th><th>Команды</th><th>Статус</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}{u.isSuperadmin && <span className="badge" style={{ marginLeft: 4 }}>superadmin</span>}</td>
                <td>{u.name}</td>
                <td>
                  {u.orgs.length === 0 && <span className="muted">нет команд</span>}
                  {u.orgs.map((o) => (
                    <div key={o.orgId} className="row" style={{ gap: 4 }}>
                      <span className="muted">{o.orgName}:</span>
                      <select value={o.role} onChange={(e) => changeRole(o.orgId, u.id, e.target.value)}>
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </div>
                  ))}
                </td>
                <td>
                  {u.isSuperadmin ? (
                    <span className="muted">—</span>
                  ) : (
                    <select value={u.status} onChange={(e) => setStatus(u.id, e.target.value as "active" | "blocked" | "deleted")}>
                      <option value="active">active</option>
                      <option value="blocked">blocked</option>
                      <option value="deleted">deleted</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="row" style={{ justifyContent: "space-between", marginTop: 12 }}>
          <button className="btn secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Назад</button>
          <span className="muted">Стр. {page} из {totalPages}</span>
          <button className="btn secondary" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Вперёд</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Типчек**

Run: `pnpm --filter @open-artifacts/web typecheck`
Expected: PASS (страница пока не подключена к роутингу — это Task 16).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/UsersPage.tsx
git commit -m "Add superadmin Users page: search, pagination, role and status management"
```

---

### Task 15: Страница аккаунта (смена email/пароля)

**Files:**
- Create: `apps/web/src/pages/AccountPage.tsx`

**Interfaces:**
- Consumes: `PATCH /auth/me`.

- [ ] **Step 1: Реализовать страницу**

Создать `apps/web/src/pages/AccountPage.tsx`:

```typescript
import { useState } from "react";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth";

export function AccountPage() {
  const { me, refresh } = useAuth();
  const [email, setEmail] = useState(me?.email ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      await api.patch("/auth/me", {
        email: email !== me?.email ? email : undefined,
        newPassword: newPassword || undefined,
        currentPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setSaved(true);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Не удалось сохранить изменения");
    }
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h2>Аккаунт</h2>
      <form onSubmit={onSubmit} className="card stack">
        <label className="muted">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="muted">Новый пароль (необязательно)</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} />
        <label className="muted">Текущий пароль (для подтверждения)</label>
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        {error && <div className="error">{error}</div>}
        {saved && <p className="muted">Сохранено</p>}
        <button className="btn" type="submit">Сохранить</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Типчек**

Run: `pnpm --filter @open-artifacts/web typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/AccountPage.tsx
git commit -m "Add account settings page (email/password change)"
```

---

### Task 16: Сайдбар и роутинг — свести всё воедино

**Files:**
- Modify: `apps/web/src/components/Layout.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Переписать сайдбар**

Заменить содержимое `apps/web/src/components/Layout.tsx` на:

```typescript
import { NavLink, Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useOrgList } from "../lib/useOrgList";

export function Layout() {
  const { me, loading, currentOrgId, setCurrentOrgId, logout } = useAuth();
  const { orgs } = useOrgList("", 1, 100);

  if (loading) return <div style={{ padding: 24 }}>Загрузка…</div>;
  if (!me) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>Open Artifacts</h1>
        <select value={currentOrgId} onChange={(e) => setCurrentOrgId(e.target.value)} style={{ marginBottom: 12 }}>
          <option value="all">Все организации</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}{o.role ? ` (${o.role})` : ""}</option>
          ))}
        </select>
        <nav className="stack">
          <NavLink to="/artifacts" className={({ isActive }) => (isActive ? "active" : "")}>Артефакты</NavLink>
          <NavLink to="/agents" className={({ isActive }) => (isActive ? "active" : "")}>Агенты и ключи</NavLink>
          <NavLink to="/teams" className={({ isActive }) => (isActive ? "active" : "")}>Команды</NavLink>
          {me.isSuperadmin && <NavLink to="/users" className={({ isActive }) => (isActive ? "active" : "")}>Пользователи</NavLink>}
          {me.isSuperadmin && <NavLink to="/admin" className={({ isActive }) => (isActive ? "active" : "")}>Админка</NavLink>}
        </nav>
        <div style={{ marginTop: 24 }}>
          <p className="muted">{me.email}</p>
          <NavLink to="/account" className={({ isActive }) => (isActive ? "active" : "")}>Аккаунт</NavLink>
          <button className="btn secondary" onClick={() => logout()}>Выйти</button>
        </div>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Подключить новые страницы и защитить superadmin-роуты**

Заменить содержимое `apps/web/src/App.tsx` на:

```typescript
import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { ArtifactDetailPage } from "./pages/ArtifactDetailPage";
import { AgentsPage } from "./pages/AgentsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { TeamDetailPage } from "./pages/TeamDetailPage";
import { UsersPage } from "./pages/UsersPage";
import { AccountPage } from "./pages/AccountPage";
import { AdminPage } from "./pages/AdminPage";
import { ActivatePage } from "./pages/ActivatePage";

function RequireSuperadmin({ children }: { children: ReactNode }) {
  const { me } = useAuth();
  if (!me?.isSuperadmin) return <Navigate to="/artifacts" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/activate" element={<ActivatePage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/artifacts" replace />} />
            <Route path="/artifacts" element={<ArtifactsPage />} />
            <Route path="/artifacts/:id" element={<ArtifactDetailPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/teams" element={<TeamsPage />} />
            <Route path="/teams/:id" element={<TeamDetailPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/users" element={<RequireSuperadmin><UsersPage /></RequireSuperadmin>} />
            <Route path="/admin" element={<RequireSuperadmin><AdminPage /></RequireSuperadmin>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Типчек**

Run: `pnpm --filter @open-artifacts/web typecheck`
Expected: PASS.

- [ ] **Step 4: Ручная сквозная проверка**

Run: `docker compose up -d --build`, открыть приложение:
1. Залогиниться суперадмином → сайдбар по умолчанию на «Все организации» → «Артефакты»/«Агенты» показывают все записи системы с колонкой «Команда» — это должно закрыть исходный баг-репорт (счётчики в «Админке» и списки в «Артефактах»/«Агентах» теперь совпадают).
2. Переключить сайдбар на конкретную команду → списки сужаются, колонка «Команда» пропадает.
3. Открыть «Команды» → список с пагинацией → провалиться в карточку → пригласить участника, сменить его роль, удалить.
4. Зарегистрировать нового обычного пользователя без инвайта → убедиться, что у него нет команд и виден экран создания/присоединения.
5. Как суперадмин открыть «Пользователи» → найти пользователя поиском, сменить его роль в команде, заблокировать — убедиться, что залогиненный как этот пользователь сеанс сразу теряет доступ.
6. Открыть «Аккаунт» → сменить пароль → перелогиниться новым паролем.
7. Как обычный (не superadmin) пользователь — убедиться, что пункты «Пользователи» и «Админка» не отображаются в сайдбаре и прямой переход на `/users`/`/admin` редиректит на `/artifacts`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Layout.tsx apps/web/src/App.tsx
git commit -m "Wire up 'all orgs' sidebar option, Teams/Users/Account navigation"
```

---

## Self-Review Notes

- **Spec coverage:** все пункты из spec (§1 роли/статус, §2 API, §3 frontend) покрыты задачами 1-16; §4 (вне рамок) сознательно не реализуется.
- **Type consistency:** `OrgSummary`, `AdminUserSummary`, `AccountInactiveError`, `LastOwnerError`/`NotAMemberError`, `listMemberOrgIds`/`listArtifactsForOrgs`/`listAllArtifacts`/`listAgentsForOrgs`/`listAllAgents` — имена и сигнатуры одинаковы во всех задачах, где они объявляются и используются.
- **Placeholder scan:** пройден — везде даны рабочие сниппеты кода, не описания.
