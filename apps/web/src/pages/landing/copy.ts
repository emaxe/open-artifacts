/**
 * Hand-written RU/EN dictionary for the marketing landing only — mirrors the approach already
 * used app-wide in `lib/labels.ts` ("not a full i18n library... one language, ~70 strings") rather
 * than adding an i18n dependency. The rest of the app stays Russian-only and untouched.
 *
 * `LANDING_COPY.en` is typed against `typeof LANDING_COPY.ru`, so a key present in one language and
 * missing in the other is a compile error, not a silently blank string at runtime.
 */

export type Lang = "ru" | "en";

/** Keys the auth card's error mapping (`authErrors.ts`) can resolve to — see routes/auth.ts on the API for the source codes. */
export interface AuthErrorCopy {
  invalidCredentials: string;
  accountBlocked: string;
  accountDeleted: string;
  emailTaken: string;
  registrationClosed: string;
  inviteRequired: string;
  invalidInput: string;
  rateLimited: string;
  unknown: string;
}

export interface LandingCopy {
  meta: { title: string; description: string };
  nav: { features: string; how: string; security: string; selfHost: string; docs: string; signIn: string; signUp: string; openApp: string };
  hero: {
    badge: string;
    title: string;
    subtitle: string;
    bullets: string[];
    ctaPrimary: string;
    ctaSecondary: string;
  };
  auth: {
    tabLogin: string;
    tabRegister: string;
    nameLabel: string;
    emailLabel: string;
    passwordLabel: string;
    passwordHint: string;
    loginSubmit: string;
    registerSubmit: string;
    loginAltPrompt: string;
    loginAltLink: string;
    registerAltPrompt: string;
    registerAltLink: string;
    fullPageLogin: string;
    connectAgent: string;
    signedInAs: string;
    openApp: string;
    registrationInviteOnlyNote: string;
    registrationClosedNote: string;
    switchToLogin: string;
    errors: AuthErrorCopy;
  };
  compat: { heading: string; agents: string[]; badges: string[] };
  problem: { heading: string; before: string[]; afterHeading: string; after: string };
  how: { heading: string; subtitle: string; steps: { title: string; body: string }[]; terminalCaption: string; terminalReplay: string };
  features: { heading: string; subtitle: string; items: { title: string; body: string }[] };
  security: { heading: string; body: string; points: string[]; diagramSteps: string[] };
  demo: { heading: string; body: string; frameTitle: string; fakeUrl: string; note: string };
  audience: { heading: string; agent: { title: string; points: string[] }; team: { title: string; points: string[] } };
  comparison: { heading: string; colUs: string; colThem: string; rows: { label: string; us: string; them: string }[] };
  selfHost: { heading: string; body: string; command: string; note: string };
  stats: { value: number; suffix: string; label: string }[];
  cta: { heading: string; body: string; button: string };
  footer: { tagline: string; product: string; resources: string; license: string; sourceLabel: string };
}

export const LANDING_COPY: { ru: LandingCopy; en: LandingCopy } = {
  ru: {
    meta: {
      title: "Open Artifacts — публикуйте артефакты AI-агентов по ссылке",
      description:
        "Self-hosted хостинг артефактов для AI-агентов: любой агент публикует HTML, Markdown, Mermaid или SVG в изолированной песочнице и получает ссылку. MIT, свой сервер, встроенный MCP.",
    },
    nav: {
      features: "Возможности",
      how: "Как это работает",
      security: "Безопасность",
      selfHost: "Self-host",
      docs: "GitHub",
      signIn: "Войти",
      signUp: "Начать",
      openApp: "Открыть приложение",
    },
    hero: {
      badge: "Open source · MIT · Self-hosted",
      title: "Артефакты ваших AI-агентов — одной ссылкой, на вашем сервере",
      subtitle:
        "Claude Code, Cursor, Codex, Windsurf и любой другой агент публикует интерактивный HTML, Markdown, Mermaid или SVG через CLI, REST или встроенный MCP-сервер — и получает ссылку, которую безопасно открыть в браузере.",
      bullets: [
        "Песочница нулевого доверия: без доступа к сессии и API хоста",
        "Свой сервер, свои данные — MIT-лицензия, docker compose up -d",
        "MCP, REST и CLI из коробки — подключается за одну команду",
      ],
      ctaPrimary: "Как это работает",
      ctaSecondary: "Исходный код",
    },
    auth: {
      tabLogin: "Вход",
      tabRegister: "Регистрация",
      nameLabel: "Имя",
      emailLabel: "Email",
      passwordLabel: "Пароль",
      passwordHint: "Минимум 8 символов",
      loginSubmit: "Войти",
      registerSubmit: "Создать аккаунт",
      loginAltPrompt: "Нет аккаунта?",
      loginAltLink: "Зарегистрироваться",
      registerAltPrompt: "Уже есть аккаунт?",
      registerAltLink: "Войти",
      fullPageLogin: "Открыть как отдельную страницу",
      connectAgent: "Подключить агента →",
      signedInAs: "Вы вошли как",
      openApp: "Открыть приложение",
      registrationInviteOnlyNote: "На этом сервере регистрация доступна только по приглашению.",
      registrationClosedNote: "Регистрация на этом сервере закрыта.",
      switchToLogin: "Войти с этим email",
      errors: {
        invalidCredentials: "Неверный email или пароль",
        accountBlocked: "Аккаунт заблокирован. Обратитесь к администратору",
        accountDeleted: "Этот аккаунт удалён",
        emailTaken: "Такой email уже зарегистрирован",
        registrationClosed: "Регистрация на этом сервере закрыта",
        inviteRequired: "На этом сервере нужна ссылка-приглашение",
        invalidInput: "Проверьте поля формы — пароль не короче 8 символов",
        rateLimited: "Слишком много попыток. Попробуйте через минуту",
        unknown: "Что-то пошло не так. Попробуйте ещё раз",
      },
    },
    compat: {
      heading: "Работает с любым агентом, который умеет вызывать CLI, REST или MCP",
      agents: ["Claude Code", "Cursor", "Codex", "Windsurf", "Antigravity", "OpenCode"],
      badges: ["MCP-сервер", "npm @emaxe/oa", "Docker", "MIT"],
    },
    problem: {
      heading: "Агент написал интерактивный HTML. А дальше что?",
      before: [
        "Вставить в чат — теряется интерактивность",
        "Залить на чужой хостинг — чужие условия, чужие данные",
        "Открыть локальный файл — некому переслать ссылку",
      ],
      afterHeading: "С Open Artifacts",
      after: "Одна команда — `oa push` — и агент получает ссылку, которую сразу можно переслать: контент отрендерен, безопасен и живёт на вашем сервере.",
    },
    how: {
      heading: "Как это работает",
      subtitle: "От установки до готовой ссылки — три шага",
      steps: [
        { title: "Подключите агента", body: "npx skills add emaxe/open-artifacts — агент сам ставит CLI и знает, как публиковать." },
        { title: "Авторизуйтесь", body: "oa login — код подтверждения и переход по ссылке активации, без ручного управления токенами." },
        { title: "Публикуйте", body: "oa push report.html --share — версия сохранена, ссылка готова, политика доступа применена автоматически." },
      ],
      terminalCaption: "Реальные команды CLI — вывод не переведён специально, это то, что вы увидите в терминале.",
      terminalReplay: "Повторить",
    },
    features: {
      heading: "Всё, что нужно для продакшена, а не только для демо",
      subtitle: "12 возможностей, которые реально работают — без выдуманных цифр",
      items: [
        { title: "Песочница нулевого доверия", body: "Контент рендерится в iframe без allow-same-origin, с CSP default-src 'none' и connect-src 'none' — проверено e2e-набором атак." },
        { title: "4 формата контента", body: "Интерактивный HTML, GitHub-flavored Markdown, диаграммы Mermaid и SVG — каждый со своим рендерингом и защитой." },
        { title: "Встроенный MCP-сервер", body: "13 инструментов на /mcp: publish, версии, шаринг, квоты — подключается к Claude Desktop, Cursor и Claude Code без доп. сервисов." },
        { title: "CLI и skills.sh", body: "oa login/push/share/quota и агентский skill с автоустановкой — публикация встроена в рабочий процесс агента." },
        { title: "4 дизайн-системы", body: "Готовые шаблоны — дашборды, документы, промо и диаграммы — так что артефакты разных агентов выглядят единообразно." },
        { title: "История версий и откат", body: "Каждая публикация — новая версия с сообщением коммита; откат к любой прежней версии в один клик." },
        { title: "Команды, роли, приглашения", body: "Owner/admin/member/viewer, личные и командные рабочие пространства, приглашения по одноразовой ссылке." },
        { title: "Гибкий шаринг", body: "Ссылки team / с паролем / public, срок жизни, закрепление версии, отзыв — политику задаёт команда и инстанс." },
        { title: "Вложения и квоты", body: "Файлы в S3-совместимом хранилище через приватный прокси — без presigned URL. Квоты на команду и на артефакт." },
        { title: "Срок жизни артефактов", body: "TTL с автоматическим жёстким удалением по истечении — контент не копится вечно, если вы этого не хотите." },
        { title: "Админка и аудит", body: "Обзор, пользователи, команды, журнал аудита и настройки инстанса — без перезапуска сервера." },
        { title: "Self-hosted, MIT", body: "docker compose up -d — Postgres, MinIO и приложение одной командой. Код и данные остаются у вас." },
      ],
    },
    security: {
      heading: "Безопасность — не галочка, а архитектура",
      body: "Каждый артефакт рендерится так, будто это код от недоверенного агента — потому что это он и есть.",
      points: [
        "iframe без allow-same-origin — контент не может достучаться до cookie или API хоста",
        "CSP: default-src 'none', connect-src 'none' — никаких fetch/XHR обратно на сервер",
        "frame-ancestors ограничен вашим origin — артефакт нельзя встроить на чужом сайте",
        "Исходник всегда отдаётся как text/plain — HTML не исполнится на origin приложения",
        "IP зрителей хешируются с солью, ключи агентов — со скоупами и сроком действия",
        "Проверено набором e2e-тестов, имитирующих реальные атаки на песочницу",
      ],
      diagramSteps: ["Контент агента", "iframe без allow-same-origin", "CSP: connect-src 'none'", "Браузер получателя"],
    },
    demo: {
      heading: "То, что увидит получатель ссылки",
      body: "Ниже — настоящий sandboxed iframe с демонстрационным артефактом: та же модель изоляции, что и в продакшене.",
      frameTitle: "Демонстрационный артефакт",
      fakeUrl: "https://ваш-сервер/s/9kQ2xR",
      note: "sandbox=\"allow-scripts\", без allow-same-origin",
    },
    audience: {
      heading: "Одна платформа — два сценария",
      agent: {
        title: "Для агента",
        points: [
          "CLI и MCP с --json на каждую команду",
          "Скоупы ключей: artifacts:read/write/delete, shares:write",
          "Проверка квоты перед загрузкой (oa quota / get_storage_quota)",
          "Личный ключ на все команды или ключ, привязанный к одной — для CI",
        ],
      },
      team: {
        title: "Для команды",
        points: [
          "Роли owner/admin/member/viewer и командные рабочие пространства",
          "Приглашения по ссылке, политика ссылок по умолчанию",
          "Журнал аудита и метрики использования API",
          "Квоты на команду и на артефакт, TTL по умолчанию",
        ],
      },
    },
    comparison: {
      heading: "Чем это отличается от готовых сервисов артефактов",
      colUs: "Open Artifacts",
      colThem: "Готовый облачный сервис",
      rows: [
        { label: "Где хранятся данные", us: "На вашем сервере", them: "У вендора" },
        { label: "Какие агенты подходят", us: "Любой — CLI, REST, MCP", them: "Обычно один вендор" },
        { label: "Лицензия", us: "MIT, исходный код открыт", them: "Проприетарно" },
        { label: "Команды и роли", us: "Встроены", them: "Зависит от тарифа" },
        { label: "Политика ссылок и TTL", us: "Настраивается инстансом и командой", them: "Обычно фиксирована" },
      ],
    },
    selfHost: {
      heading: "Разворачивается за одну команду",
      body: "Postgres, MinIO и приложение — единым docker-compose стеком. Миграции применяются автоматически при старте.",
      command: "cp .env.example .env && docker compose up -d",
      note: "Или интерактивный ./run.sh — меню для продакшена, разработки, сборки и тестов.",
    },
    stats: [
      { value: 4, suffix: "", label: "формата контента" },
      { value: 13, suffix: "", label: "инструментов MCP" },
      { value: 3, suffix: "", label: "режима ссылок" },
      { value: 1, suffix: "", label: "команда для self-host" },
    ],
    cta: {
      heading: "Разверните свой инстанс за пару минут",
      body: "MIT-лицензия, никакой привязки к вендору. Начните с формы выше или посмотрите исходный код.",
      button: "Создать аккаунт",
    },
    footer: {
      tagline: "Self-hosted артефакты для AI-агентов",
      product: "Продукт",
      resources: "Ресурсы",
      license: "MIT",
      sourceLabel: "Исходный код",
    },
  },

  en: {
    meta: {
      title: "Open Artifacts — publish AI agent artifacts as a link",
      description:
        "Self-hosted artifact hosting for AI agents: any agent publishes HTML, Markdown, Mermaid, or SVG into a sandboxed viewer and gets back a link. MIT-licensed, your own server, a built-in MCP server.",
    },
    nav: {
      features: "Features",
      how: "How it works",
      security: "Security",
      selfHost: "Self-host",
      docs: "GitHub",
      signIn: "Sign in",
      signUp: "Get started",
      openApp: "Open the app",
    },
    hero: {
      badge: "Open source · MIT · Self-hosted",
      title: "Your AI agents' artifacts — one link, on your own server",
      subtitle:
        "Claude Code, Cursor, Codex, Windsurf, and any other agent publish interactive HTML, Markdown, Mermaid, or SVG over the CLI, REST, or a built-in MCP server — and get back a link that's safe to open in a browser.",
      bullets: [
        "Zero-trust sandbox: no access to the host's session or API",
        "Your server, your data — MIT-licensed, docker compose up -d",
        "MCP, REST, and a CLI out of the box — one command to connect",
      ],
      ctaPrimary: "See how it works",
      ctaSecondary: "View source",
    },
    auth: {
      tabLogin: "Sign in",
      tabRegister: "Sign up",
      nameLabel: "Name",
      emailLabel: "Email",
      passwordLabel: "Password",
      passwordHint: "At least 8 characters",
      loginSubmit: "Sign in",
      registerSubmit: "Create account",
      loginAltPrompt: "No account yet?",
      loginAltLink: "Sign up",
      registerAltPrompt: "Already have an account?",
      registerAltLink: "Sign in",
      fullPageLogin: "Open as a full page",
      connectAgent: "Connect an agent →",
      signedInAs: "Signed in as",
      openApp: "Open the app",
      registrationInviteOnlyNote: "Registration on this server requires an invite link.",
      registrationClosedNote: "Registration on this server is closed.",
      switchToLogin: "Sign in with this email",
      errors: {
        invalidCredentials: "Incorrect email or password",
        accountBlocked: "This account is blocked. Contact an administrator",
        accountDeleted: "This account has been deleted",
        emailTaken: "This email is already registered",
        registrationClosed: "Registration on this server is closed",
        inviteRequired: "This server requires an invite link to register",
        invalidInput: "Check the fields — password must be at least 8 characters",
        rateLimited: "Too many attempts. Try again in a minute",
        unknown: "Something went wrong. Please try again",
      },
    },
    compat: {
      heading: "Works with any agent that can call a CLI, REST, or MCP",
      agents: ["Claude Code", "Cursor", "Codex", "Windsurf", "Antigravity", "OpenCode"],
      badges: ["MCP server", "npm @emaxe/oa", "Docker", "MIT"],
    },
    problem: {
      heading: "Your agent just wrote an interactive HTML page. Now what?",
      before: [
        "Paste it into chat — the interactivity is gone",
        "Upload it to someone else's host — their terms, your data",
        "Open the local file — there's no link to send anyone",
      ],
      afterHeading: "With Open Artifacts",
      after: "One command — `oa push` — and the agent gets back a link that's ready to send: rendered, sandboxed, and living on your own server.",
    },
    how: {
      heading: "How it works",
      subtitle: "From install to a shareable link in three steps",
      steps: [
        { title: "Connect the agent", body: "npx skills add emaxe/open-artifacts — the agent installs the CLI itself and learns how to publish." },
        { title: "Authenticate", body: "oa login — a verification code and an activation link, no manual token handling." },
        { title: "Publish", body: "oa push report.html --share — a version is saved, a link is ready, access policy applied automatically." },
      ],
      terminalCaption: "Real CLI commands — the output is intentionally left untranslated, it's exactly what you'd see in your terminal.",
      terminalReplay: "Replay",
    },
    features: {
      heading: "Built for production, not just a demo",
      subtitle: "12 capabilities that actually work — no invented numbers",
      items: [
        { title: "Zero-trust sandbox", body: "Content renders inside an iframe without allow-same-origin, with a default-src 'none' / connect-src 'none' CSP — verified by an e2e attack suite." },
        { title: "4 content formats", body: "Interactive HTML, GitHub-flavored Markdown, Mermaid diagrams, and SVG — each with its own rendering and hardening." },
        { title: "Built-in MCP server", body: "13 tools at /mcp: publish, versions, sharing, quotas — connects to Claude Desktop, Cursor, and Claude Code with no extra service." },
        { title: "CLI and skills.sh", body: "oa login/push/share/quota plus an agent skill with auto-install — publishing is baked into the agent's own workflow." },
        { title: "4 design systems", body: "Ready-made templates — dashboards, documents, promo, and diagrams — so artifacts from different agents look consistent." },
        { title: "Version history & rollback", body: "Every publish is a new version with a commit-style message; roll back to any earlier version in one click." },
        { title: "Teams, roles, invites", body: "Owner/admin/member/viewer roles, personal and team workspaces, one-time invite links." },
        { title: "Flexible sharing", body: "Team, password-protected, or public links, expiry, version pinning, and revocation — policy set by the team and the instance." },
        { title: "Attachments & quotas", body: "Files in an S3-compatible bucket served through a private proxy — no presigned URLs. Per-team and per-artifact quotas." },
        { title: "Artifact lifetime (TTL)", body: "Automatic hard-delete once a TTL expires — content doesn't pile up forever unless you want it to." },
        { title: "Admin console & audit log", body: "Overview, users, teams, an audit log, and instance settings — no server restart required." },
        { title: "Self-hosted, MIT", body: "docker compose up -d — Postgres, MinIO, and the app in one command. Your code, your data." },
      ],
    },
    security: {
      heading: "Security isn't a checkbox, it's the architecture",
      body: "Every artifact renders as if it were untrusted-agent code — because it is.",
      points: [
        "An iframe without allow-same-origin — content can't reach the host's cookies or API",
        "CSP: default-src 'none', connect-src 'none' — no fetch/XHR back to the server",
        "frame-ancestors locked to your own origin — an artifact can't be embedded elsewhere",
        "Source is always served as text/plain — HTML never executes on the app's own origin",
        "Viewer IPs are salted and hashed; agent keys carry scopes and an expiry",
        "Verified by an e2e test suite that simulates real attacks on the sandbox",
      ],
      diagramSteps: ["Agent content", "iframe, no allow-same-origin", "CSP: connect-src 'none'", "Viewer's browser"],
    },
    demo: {
      heading: "What the recipient of a link actually sees",
      body: "Below is a real sandboxed iframe with a demo artifact — the exact same isolation model used in production.",
      frameTitle: "Demo artifact",
      fakeUrl: "https://your-server/s/9kQ2xR",
      note: "sandbox=\"allow-scripts\", no allow-same-origin",
    },
    audience: {
      heading: "One platform, two audiences",
      agent: {
        title: "For the agent",
        points: [
          "CLI and MCP, with --json on every command",
          "Key scopes: artifacts:read/write/delete, shares:write",
          "Quota check before upload (oa quota / get_storage_quota)",
          "One personal key across every team, or a single-team key for CI",
        ],
      },
      team: {
        title: "For the team",
        points: [
          "Owner/admin/member/viewer roles and team workspaces",
          "Invite links plus a default link-sharing policy",
          "Audit log and per-hour API usage metering",
          "Per-team and per-artifact quotas, a default TTL",
        ],
      },
    },
    comparison: {
      heading: "How this differs from a hosted artifact service",
      colUs: "Open Artifacts",
      colThem: "A hosted service",
      rows: [
        { label: "Where data lives", us: "On your own server", them: "With the vendor" },
        { label: "Which agents fit", us: "Any — CLI, REST, MCP", them: "Usually one vendor" },
        { label: "License", us: "MIT, source available", them: "Proprietary" },
        { label: "Teams & roles", us: "Built in", them: "Depends on plan" },
        { label: "Link policy & TTL", us: "Configurable per instance and team", them: "Usually fixed" },
      ],
    },
    selfHost: {
      heading: "Deploys with one command",
      body: "Postgres, MinIO, and the app as a single docker-compose stack. Migrations run automatically on startup.",
      command: "cp .env.example .env && docker compose up -d",
      note: "Or the interactive ./run.sh — a menu for production, dev, builds, and tests.",
    },
    stats: [
      { value: 4, suffix: "", label: "content formats" },
      { value: 13, suffix: "", label: "MCP tools" },
      { value: 3, suffix: "", label: "share link modes" },
      { value: 1, suffix: "", label: "command to self-host" },
    ],
    cta: {
      heading: "Stand up your own instance in a couple of minutes",
      body: "MIT-licensed, no vendor lock-in. Start with the form above, or browse the source.",
      button: "Create an account",
    },
    footer: {
      tagline: "Self-hosted artifacts for AI agents",
      product: "Product",
      resources: "Resources",
      license: "MIT",
      sourceLabel: "Source code",
    },
  },
};

export function detectInitialLang(searchParamLang: string | null): Lang {
  if (searchParamLang === "ru" || searchParamLang === "en") return searchParamLang;
  try {
    const stored = localStorage.getItem("oa_landing_lang");
    if (stored === "ru" || stored === "en") return stored;
  } catch {
    // Private tab or blocked site data — fall through to the browser's own language.
  }
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}
