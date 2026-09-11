# Open Artifacts

<p align="left">
  <a href="https://github.com/emaxe/open-artifacts/releases"><img src="https://img.shields.io/github/v/release/emaxe/open-artifacts?label=release&color=blue&logo=github" alt="GitHub Release"></a>
  <a href="https://github.com/emaxe/open-artifacts/stargazers"><img src="https://img.shields.io/github/stars/emaxe/open-artifacts?style=flat&logo=github" alt="GitHub Stars"></a>
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/v/@emaxe/oa.svg?color=blue&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/dm/@emaxe/oa.svg?color=blue&logo=npm" alt="npm downloads"></a>
  <a href="https://skills.sh/emaxe/open-artifacts"><img src="https://skills.sh/b/emaxe/open-artifacts" alt="skills.sh"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen?logo=node.js" alt="Node.js"></a>
  <a href="https://www.docker.com/"><img src="https://img.shields.io/badge/Docker-compose-2496ED?logo=docker&logoColor=white" alt="Docker"></a>
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Server-purple" alt="MCP Server"></a>
</p>

**[English](README.md)** | **[Русский](README.ru.md)** | **[Changelog](CHANGELOG.md)** | **[История изменений](CHANGELOG.ru.md)**

Self-hosted (автономный) сервис хостинга артефактов для AI-агентов — открытая альтернатива Claude Artifacts. Любой агент (Claude, Cursor, Codex, Windsurf, Antigravity, OpenCode или кастомные LLM-скрипты) авторизуется с помощью токена или OAuth Device Flow, публикует HTML, Markdown, Mermaid-диаграммы или SVG и получает ссылку для интерактивного просмотра человеком в браузере.

Разворачивается в виде единого легковесного стека Docker Compose.

---

### Топики и теги репозитория
`ai-agents` • `artifacts` • `claude-artifacts` • `claude` • `mcp` • `mcp-server` • `model-context-protocol` • `self-hosted` • `docker` • `hono` • `react` • `typescript` • `cli` • `developer-tools` • `open-artifacts` • `llm`

---

## Ключевые возможности

- 🛡️ **Песочница с нулевым доверием (Zero-Trust Sandbox)**: Контент, сгенерированный агентами, отображается в строго изолированных контейнерах `<iframe>` с уникальным origin (`allow-scripts`, без доступа к cookie или `localStorage` хоста, строгая Content Security Policy).
- 📦 **Поддержка форматов**: Интерактивные веб-приложения на HTML/JS, разметка Markdown (с синтаксисом GitHub), адаптивные диаграммы Mermaid и векторная графика SVG.
- ⚡ **Встроенный MCP-сервер**: Готовый эндпоинт Model Context Protocol по пути `/mcp` (Streamable HTTP) для бесшовной интеграции с Cursor, Claude Desktop, Claude Code и другими агентами.
- 🤖 **Стандартный AI Agent Skill**: Полная поддержка стандарта `skills.sh` (`npx skills add emaxe/open-artifacts`) с автоматической установкой CLI и авторизацией через Device Flow.
- 🔑 **Гибкая аутентификация**: Интерактивная привязка устройств через OAuth Device Flow (`oa login`) и фоновые сервисные токены (`OA_TOKEN`).
- 👥 **Организации, команды и роли**: Разделение на организации/команды, управление пользователями, переключатель команд и роли (`superadmin`, `admin`, `member`).
- 🔗 **Управление доступом к ссылкам**: Публичные ссылки, защита паролем и автоматическое истечение срока действия ссылки (1 час, 1 день, 7 дней, 30 дней).
- 🚀 **Быстрый запуск**: Развертывание в продакшн одной командой с помощью Docker Compose или интерактивного скрипта `./run.sh`.

---

## Быстрый старт

### Вариант 1: Интерактивный запуск (рекомендуется)

```bash
./run.sh
```

Интерактивное меню для управления всеми сценариями: продакшн (Docker), локальная разработка, сборка, тесты и миграции базы данных.

### Вариант 2: Docker Compose

```bash
cp .env.example .env        # Настройте SESSION_SECRET, SUPERADMIN_EMAIL/PASSWORD
docker compose up -d
```

Откройте `http://localhost:3000`, войдите под учетной записью суперпользователя, указанной в `.env`. Миграции базы данных применяются автоматически при старте контейнера.

---

## Архитектура проекта

```
apps/api/              REST API на Hono + MCP сервер + Postgres (Drizzle) + Раздача статики
apps/web/              React SPA (Vite) — интерфейс администратора и пользователя
packages/shared/       Схемы Zod + общая бизнес-логика (права доступа, CSP, парсинг TTL)
packages/cli/          CLI утилита `oa` для агентов (npm-пакет @emaxe/oa)
skills/open-artifacts/ Спецификация навыка для агентов (SKILL.md) под skills.sh
docker/                Multi-stage Dockerfile для продакшн-контейнера
run.sh                 Интерактивный шелл-скрипт управления проектом
```

---

## Локальная разработка

Требования: **Node.js 20+**, **pnpm** и **Docker** (для локальной PostgreSQL).

```bash
# 1. Установка зависимостей
pnpm install

# 2. Запуск локального PostgreSQL на localhost:5433
docker compose -f docker-compose.dev.yml up -d

# 3. Применение схемы базы данных
cd apps/api && DATABASE_URL=postgres://postgres:postgres@localhost:5433/open_artifacts_dev \
  pnpm exec drizzle-kit push

# 4. Запуск серверов разработки
pnpm dev:api   # API и MCP сервер на http://localhost:3000
pnpm dev:web   # Веб-интерфейс React на http://localhost:5173 (проксирует /api на :3000)
```

Разработка и отладка CLI:
```bash
cd packages/cli && pnpm dev -- login --server http://localhost:3000
```

---

## Тестирование

```bash
pnpm -r run test                                             # Запуск модульных тестов
cd apps/api && pnpm run test:integration                     # Интеграционные тесты (требуется dev БД)
cd apps/api && pnpm exec playwright install chromium          # Разовая установка браузера Playwright
cd apps/api && pnpm run test:e2e                              # E2E тесты безопасности песочницы
```

> **Проверка безопасности:** E2E тест (`apps/api/e2e/sandbox-security.spec.ts`) гарантирует изоляцию: скрипты внутри сгенерированного артефакта физически не могут прочитать cookie или `localStorage` хоста, а также не имеют доступа к внутренним эндпоинтам API.

---

## Скилл для AI-агентов (Claude, Cursor, Windsurf и др.)

В Open Artifacts встроен навык для агентов по стандарту [skills.sh](https://skills.sh/emaxe/open-artifacts). Он обучает AI-агентов самостоятельно устанавливать CLI `@emaxe/oa`, подключаться к инстансу, публиковать артефакты и возвращать аккуратные ссылки в диалог.

### 1. Установка через skills.sh

```bash
# Для текущего проекта/репозитория (рекомендуется):
npx skills add emaxe/open-artifacts

# Или глобально для всех проектов на машине:
npx skills add emaxe/open-artifacts -g
```

### 2. Подключение агентов

Агенты могут авторизоваться двумя способами:

#### Вариант A: Интерактивный OAuth Device Flow (рекомендуется для CLI)
1. Выполните в терминале агента:
   ```bash
   oa login --server http://localhost:3000
   ```
2. Утилита выведет одноразовый код активации (например, `ABCD-1234`) и ссылку.
3. Откройте `http://localhost:3000/activate?code=ABCD-1234` в браузере, выберите организацию и подтвердите доступ («Разрешить»).
4. Ключи сохраняются в `~/.config/open-artifacts/credentials.json` (права `600`).

#### Вариант Б: Переменные окружения (для CI и фоновых сервисов)
Выпустите API-токен в веб-интерфейсе в разделе **Команда > Агенты** (`/t/:orgId/agents`) и передайте переменные окружения:

```bash
export OA_SERVER="http://localhost:3000"
export OA_TOKEN="oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Проверка подключения:
```bash
oa whoami
```

### 3. Основные команды CLI

| Задача | Команда |
|---|---|
| Опубликовать артефакт и получить публичную ссылку | `oa push report.html --title "Отчет за 3 квартал" --share` |
| Обновить артефакт (новая версия) | `oa push report.html --id <artifact-id> --message "Обновлены цифры"` |
| Поделиться с паролем и сроком жизни 7 дней | `oa share <artifact-id> --password "secret123" --expires 7d` |
| Посмотреть список артефактов организации | `oa list` |
| Скачать содержимое артефакта | `oa get <artifact-id> -o local.html` |
| Удалить артефакт | `oa rm <artifact-id>` |
| Отозвать ссылку на артефакт | `oa unshare <share-id>` |

Поддерживаемые форматы: `html`, `markdown`, `mermaid`, `svg`. Флаг `--json` выводит машиночитаемый JSON для любой команды.

---

## MCP-сервер (Model Context Protocol)

Каждый инстанс Open Artifacts предоставляет встроенный сервер MCP по адресу `<APP_ORIGIN>/mcp` (Streamable HTTP). Подключите любой MCP-клиент, передав API-ключ агента в заголовке `Authorization`:

```json
{
  "mcpServers": {
    "open-artifacts": {
      "url": "http://localhost:3000/mcp",
      "headers": {
        "Authorization": "Bearer oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"
      }
    }
  }
}
```

### Доступные инструменты MCP
- `whoami`: Информация о токене, владельце и выбранной организации.
- `list_artifacts`: Поиск и получение списка артефактов организации.
- `get_artifact`: Получение метаданных и содержимого артефакта.
- `create_artifact`: Создание нового артефакта (`html`, `markdown`, `mermaid`, `svg`).
- `update_artifact`: Публикация новой версии существующего артефакта.
- `delete_artifact`: Удаление артефакта в архив.
- `create_share`: Создание публичной или защищенной паролем ссылки.
- `list_shares`: Просмотр действующих ссылок артефакта.
- `revoke_share`: Мгновенный отзыв ссылки.

---

## Страница инструкций в панели управления

Интерактивная шпаргалка с командами для копирования, актуальным адресом инстанса и ссылками на активацию встроена в интерфейс: **Администрирование > Инструкция** (`/admin/instructions`).

---

## Конфигурация (.env)

Основные переменные конфигурации (см. [`.env.example`](.env.example)):

| Переменная | Назначение | По умолчанию |
|---|---|---|
| `PORT` | Порт HTTP-сервера | `3000` |
| `DATABASE_URL` | Строка подключения к PostgreSQL | `postgres://postgres:postgres@db:5432/open_artifacts` |
| `SESSION_SECRET` | Ключ подписи сессий (минимум 32 символа) | *Обязательно* |
| `SUPERADMIN_EMAIL` | Email начального суперпользователя | `admin@example.com` |
| `SUPERADMIN_PASSWORD` | Пароль суперпользователя | *Обязательно в продакшн* |
| `APP_ORIGIN` | Базовый публичный URL инстанса | `http://localhost:3000` |
| `REGISTRATION_MODE` | Режим регистрации: `open`, `invite_only` или `disabled` | `invite_only` |
| `DEFAULT_KEY_TTL_DAYS` | Срок действия токенов агентов (в днях) | `90` |
| `MAX_ARTIFACT_SIZE_BYTES` | Максимальный размер загружаемого артефакта | `2097152` (2 МБ) |

---

## Лицензия

MIT © [emaxe](https://github.com/emaxe)
