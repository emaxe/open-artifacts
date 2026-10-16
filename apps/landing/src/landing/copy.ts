/**
 * Hand-written RU/EN dictionary for the marketing site — one language at a time, no i18n library
 * (same approach as apps/web's `lib/labels.ts`).
 *
 * `LANDING_COPY.en` is typed against `LandingCopy`, so a key present in one language and missing in
 * the other is a compile error, not a silently blank string at runtime.
 *
 * Every headline is authored as short lines (two at most at any width) — see HeroSection/Poster.
 */

export type Lang = "ru" | "en";

export interface LandingCopy {
  meta: { title: string; description: string };
  nav: { how: string; compare: string; selfHost: string; themeLight: string; themeSystem: string; themeDark: string };
  hero: {
    lines: [string, string];
    subtitle: string;
    cta: string;
    domainLabel: string;
    domainPlaceholder: string;
    linkCaption: string;
  };
  how: {
    heading: string;
    steps: { duration: string; title: string; body: string }[];
    terminalCaption: string;
    terminalReplay: string;
  };
  showcase: {
    heading: string;
    body: string;
    rawLabel: string;
    rawWord: string;
    builtLabel: string;
    builtWord: string;
  };
  product: {
    heading: string;
    body: string;
    frameTitle: string;
    panelTitle: string;
    panelMeta: string;
    copy: string;
    copied: string;
    note: string;
  };
  compare: {
    heading: string;
    cols: [string, string, string];
    rows: { label: string; cells: [string, string, string] }[];
  };
  poster: { heading: string; items: { word: string; detail: string }[] };
  selfHost: { heading: string; body: string; command: string; note: string; docsLink: string; copy: string; copied: string };
  cta: { word: string; size: string; body: string };
  media: { pressLabel: string; pressAlt: string; stampsAlt: string; videoAlt: string; serverAlt: string; credits: string };
  footer: { tagline: string; version: string; top: string; credit: string; location: string };
}

export const LANDING_COPY: { ru: LandingCopy; en: LandingCopy } = {
  ru: {
    meta: {
      title: "Open Artifacts — публикуйте артефакты AI-агентов по ссылке",
      description:
        "Self-hosted хостинг артефактов для AI-агентов: конструктор дашбордов из YAML/JSON, публикация HTML, Markdown, Mermaid или SVG в изолированной песочнице. MIT, свой сервер, встроенный MCP.",
    },
    nav: { how: "Как это работает", compare: "Сравнение", selfHost: "Self-host", themeLight: "Светлая", themeSystem: "Авто", themeDark: "Тёмная" },
    hero: {
      lines: ["Артефакты", "одной ссылкой"],
      subtitle:
        "Claude Code, Cursor, Codex и любой агент с CLI, REST или MCP публикует HTML, Markdown, Mermaid и SVG — и получает ссылку на вашем сервере.",
      cta: "Развернуть у себя",
      domainLabel: "Ваш домен",
      domainPlaceholder: "your-server.com",
      linkCaption: "Так будет выглядеть ссылка, которую получит агент",
    },
    how: {
      heading: "Три шага до ссылки",
      steps: [
        {
          duration: "Одна команда",
          title: "Подключите агента",
          body: "npx skills add emaxe/open-artifacts — агент сам ставит CLI, получает конструктор и знает, как публиковать.",
        },
        {
          duration: "Один код",
          title: "Авторизуйтесь",
          body: "oa login — код подтверждения и ссылка активации, без ручной возни с токенами.",
        },
        {
          duration: "Секунды",
          title: "Публикуйте",
          body: "oa push report.html --share или через конструктор — ссылка готова, политика доступа уже применена.",
        },
      ],
      terminalCaption: "Настоящие команды CLI: вывод не переводится, вы увидите в терминале именно это.",
      terminalReplay: "Повторить",
    },
    showcase: {
      heading: "Агент описывает, а не верстает",
      body: "Сырой HTML — это тысячи токенов и поехавшая вёрстка на телефоне. Конструктор принимает YAML или JSON из 23 блоков и сам собирает адаптивный дашборд с графиками, KPI и тёмной темой. Экономия — до 80% токенов.",
      rawLabel: "Агент пишет вручную",
      rawWord: "HTML",
      builtLabel: "Агент описывает блоками",
      builtWord: "YAML",
    },
    product: {
      heading: "Что увидит получатель ссылки",
      body: "Настоящий sandboxed iframe с артефактом из конструктора. Та же изоляция, что и в продакшене: без allow-same-origin, CSP default-src 'none', без запросов назад на сервер.",
      frameTitle: "Демонстрационный артефакт",
      panelTitle: "Weekly Active Users",
      panelMeta: "версия 3 · команда Analytics",
      copy: "Копировать ссылку",
      copied: "Скопировано",
      note: "sandbox=\"allow-scripts\", без allow-same-origin",
    },
    compare: {
      heading: "Не облако, а ваш сервер",
      cols: ["Open Artifacts", "Облачный сервис артефактов", "Файл или чат"],
      rows: [
        { label: "Где хранятся данные", cells: ["На вашем сервере", "У вендора", "На вашем диске"] },
        { label: "Какие агенты подходят", cells: ["Любой: CLI, REST, MCP", "Обычно один вендор", "Любой"] },
        { label: "Лицензия", cells: ["MIT, исходники открыты", "Проприетарная", "Не нужна"] },
        { label: "Изоляция контента", cells: ["iframe без allow-same-origin, CSP default-src 'none'", "Зависит от вендора", "Нет: открывается с вашими правами"] },
        { label: "Ссылка для получателя", cells: ["Для команды, с паролем или публичная, со сроком жизни", "Обычно фиксированная", "Ссылки нет"] },
        { label: "Команды и роли", cells: ["owner, admin, member, viewer", "Зависит от тарифа", "Нет"] },
        { label: "Версии и откат", cells: ["Каждая публикация — версия, откат в один клик", "Зависит от тарифа", "Вручную"] },
        { label: "Квоты и срок жизни", cells: ["На команду и на артефакт, TTL с автоудалением", "Обычно нет", "Нет"] },
      ],
    },
    poster: {
      heading: "Подключается любым способом",
      items: [
        { word: "MCP", detail: "13 инструментов на /mcp" },
        { word: "CLI", detail: "oa push --share" },
        { word: "REST", detail: "/api/v1" },
        { word: "Конструктор", detail: "23 блока, 5 тем" },
        { word: "Шаринг", detail: "команда · пароль · публично" },
      ],
    },
    selfHost: {
      heading: "Разворачивается за одну команду",
      body: "Postgres, MinIO и приложение — единым docker compose. Миграции применяются сами при старте.",
      command: "cp .env.example .env && docker compose up -d",
      note: "Или интерактивный ./run.sh: меню для продакшена, разработки, сборки и тестов.",
      docsLink: "Полная инструкция в README",
      copy: "Копировать",
      copied: "Скопировано",
    },
    cta: {
      word: "Развернуть",
      size: "17.6vw",
      body: "MIT-лицензия, никакой привязки к вендору. Одна команда — и сервер поднят.",
    },
    media: {
      pressLabel: "Печать",
      pressAlt: "Печатный станок: бумажный лист с газетной полосой на барабане, под ним набор из литер",
      stampsAlt: "Коробка с латунными литерами готического шрифта",
      videoAlt: "Ротационная печатная машина: лента бумаги быстро идёт между валами",
      serverAlt: "Домашнее сетевое оборудование на деревянной полке: модем, роутер, базовая станция и внешний диск",
      credits: "Фото и видео",
    },
    footer: {
      tagline: "Self-hosted артефакты для AI-агентов",
      version: "Версия",
      top: "Наверх",
      credit: "Шрифт Onest, лицензия OFL",
      location: "MIT · 2026",
    },
  },

  en: {
    meta: {
      title: "Open Artifacts — publish AI agent artifacts as a link",
      description:
        "Self-hosted artifact hosting for AI agents: declarative YAML/JSON constructor, publish HTML, Markdown, Mermaid, or SVG into a sandboxed viewer. MIT, your own server, built-in MCP.",
    },
    nav: { how: "How it works", compare: "Compare", selfHost: "Self-host", themeLight: "Light", themeSystem: "Auto", themeDark: "Dark" },
    hero: {
      lines: ["Artifacts,", "one link"],
      subtitle:
        "Claude Code, Cursor, Codex, and any agent with a CLI, REST, or MCP publishes HTML, Markdown, Mermaid, and SVG — and gets back a link on your own server.",
      cta: "Deploy it yourself",
      domainLabel: "Your domain",
      domainPlaceholder: "your-server.com",
      linkCaption: "This is the link your agent gets back",
    },
    how: {
      heading: "Three steps to a link",
      steps: [
        {
          duration: "One command",
          title: "Connect the agent",
          body: "npx skills add emaxe/open-artifacts — the agent installs the CLI, gets the constructor, and learns how to publish.",
        },
        {
          duration: "One code",
          title: "Authenticate",
          body: "oa login — a verification code and an activation link, no manual token handling.",
        },
        {
          duration: "Seconds",
          title: "Publish",
          body: "oa push report.html --share, or go through the constructor — the link is ready, access policy already applied.",
        },
      ],
      terminalCaption: "Real CLI commands: the output is left untranslated, it is exactly what you'd see in your terminal.",
      terminalReplay: "Replay",
    },
    showcase: {
      heading: "The agent describes, it doesn't lay out",
      body: "Raw HTML costs thousands of tokens and breaks on a phone. The constructor takes YAML or JSON from 23 blocks and compiles a responsive dashboard with charts, KPIs, and dark mode on its own. Up to 80% fewer tokens.",
      rawLabel: "The agent writes by hand",
      rawWord: "HTML",
      builtLabel: "The agent describes in blocks",
      builtWord: "YAML",
    },
    product: {
      heading: "What the recipient of a link sees",
      body: "A real sandboxed iframe with a constructor-built artifact. The same isolation as production: no allow-same-origin, CSP default-src 'none', no requests back to the server.",
      frameTitle: "Demo artifact",
      panelTitle: "Weekly Active Users",
      panelMeta: "version 3 · Analytics team",
      copy: "Copy link",
      copied: "Copied",
      note: "sandbox=\"allow-scripts\", no allow-same-origin",
    },
    compare: {
      heading: "Not a cloud, your server",
      cols: ["Open Artifacts", "A hosted artifact service", "A file or a chat"],
      rows: [
        { label: "Where data lives", cells: ["On your own server", "With the vendor", "On your disk"] },
        { label: "Which agents fit", cells: ["Any: CLI, REST, MCP", "Usually one vendor", "Any"] },
        { label: "License", cells: ["MIT, source available", "Proprietary", "Not needed"] },
        { label: "Content isolation", cells: ["iframe without allow-same-origin, CSP default-src 'none'", "Depends on the vendor", "None: it opens with your own rights"] },
        { label: "Link for the recipient", cells: ["Team, password, or public, with an expiry", "Usually fixed", "No link"] },
        { label: "Teams and roles", cells: ["owner, admin, member, viewer", "Depends on the plan", "None"] },
        { label: "Versions and rollback", cells: ["Every publish is a version, one-click rollback", "Depends on the plan", "By hand"] },
        { label: "Quotas and lifetime", cells: ["Per team and per artifact, TTL with auto-delete", "Usually none", "None"] },
      ],
    },
    poster: {
      heading: "Connects any way you like",
      items: [
        { word: "MCP", detail: "13 tools at /mcp" },
        { word: "CLI", detail: "oa push --share" },
        { word: "REST", detail: "/api/v1" },
        { word: "Constructor", detail: "23 blocks, 5 themes" },
        { word: "Sharing", detail: "team · password · public" },
      ],
    },
    selfHost: {
      heading: "Deploys with one command",
      body: "Postgres, MinIO, and the app as a single docker compose stack. Migrations run on their own at startup.",
      command: "cp .env.example .env && docker compose up -d",
      note: "Or the interactive ./run.sh: a menu for production, dev, builds, and tests.",
      docsLink: "Full setup guide in the README",
      copy: "Copy",
      copied: "Copied",
    },
    cta: {
      word: "Deploy",
      size: "26vw",
      body: "MIT-licensed, no vendor lock-in. One command and the server is up.",
    },
    media: {
      pressLabel: "Printing",
      pressAlt: "A printing press: a sheet with a newspaper page on the drum, a bed of type beneath it",
      stampsAlt: "A box of brass blackletter type stamps",
      videoAlt: "A web offset press: a ribbon of paper racing between rollers",
      serverAlt: "Home network equipment on a wooden shelf: a modem, a router, a base station and an external drive",
      credits: "Pictures and footage",
    },
    footer: {
      tagline: "Self-hosted artifacts for AI agents",
      version: "Version",
      top: "Back to top",
      credit: "Typeface Onest, OFL license",
      location: "MIT · 2026",
    },
  },
};

export function detectInitialLang(searchParamLang: string | null): Lang {
  if (searchParamLang === "ru" || searchParamLang === "en") return searchParamLang;
  try {
    const stored = localStorage.getItem("oa_site_lang");
    if (stored === "ru" || stored === "en") return stored;
  } catch {
    // Private tab or blocked site data — fall through to the browser's own language.
  }
  return navigator.language.toLowerCase().startsWith("ru") ? "ru" : "en";
}
