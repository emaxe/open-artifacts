# @emaxe/oa

<p align="left">
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/v/@emaxe/oa.svg?color=blue&logo=npm" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/@emaxe/oa"><img src="https://img.shields.io/npm/dm/@emaxe/oa.svg?color=blue&logo=npm" alt="npm downloads"></a>
  <a href="https://github.com/emaxe/open-artifacts"><img src="https://img.shields.io/badge/GitHub-emaxe%2Fopen--artifacts-blue?logo=github" alt="GitHub Repository"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT"></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg?logo=node.js" alt="Node.js"></a>
  <a href="https://skills.sh/emaxe/open-artifacts"><img src="https://skills.sh/b/emaxe/open-artifacts" alt="skills.sh"></a>
</p>

**[English](README.md)** | **[Русский](README.ru.md)** | **[Changelog](CHANGELOG.md)** | **[История изменений](CHANGELOG.ru.md)**

Официальная консольная утилита (CLI) для [Open Artifacts](https://github.com/emaxe/open-artifacts) — открытой альтернативы Claude Artifacts. Позволяет публиковать веб-приложения на HTML, документы Markdown, диаграммы Mermaid или векторную графику SVG из терминала, скриптов или диалогов с AI-агентами, получая в ответ интерактивную публичную ссылку.

---

### Топики и теги
`ai-agents` • `artifacts` • `claude-artifacts` • `claude` • `mcp` • `model-context-protocol` • `self-hosted` • `cli` • `open-artifacts` • `developer-tools`

---

## Установка

```bash
# Глобальная установка (рекомендуется):
npm install -g @emaxe/oa

# Или запуск без установки:
npx @emaxe/oa --help
```

---

## Быстрый старт

### 1. Авторизация

Подключитесь к вашему серверу Open Artifacts через удобный интерактивный OAuth Device Flow:

```bash
oa login --server https://artifacts.your-company.com
```

Утилита сгенерирует короткий код подтверждения (например, `ABCD-1234`) и ссылку на страницу активации. Перейдите по ссылке, выберите организацию и разрешите доступ. Токен сохранится локально в `~/.config/open-artifacts/credentials.json` с правами `600`.

Проверить статус сессии в любой момент:

```bash
oa whoami
```

### 2. Публикация файлов

```bash
# Опубликовать HTML-страницу и получить публичную ссылку:
oa push report.html --title "Финансовый отчет" --share

# Опубликовать документ Markdown:
oa push summary.md --title "Протокол встречи" --share

# Отрендерить диаграмму Mermaid:
oa push architecture.mmd --title "Архитектура сервиса" --share

# Загрузить векторный файл SVG:
oa push diagram.svg --title "Схема базы данных" --share
```

---

## Справочник команд

### `oa login`
Авторизация CLI на сервере Open Artifacts по протоколу OAuth Device Flow.

```bash
oa login [options]
  --server <url>      URL сервера Open Artifacts (по умолчанию: "http://localhost:3000")
  --name <name>        Имя регистрируемого агента
  --scopes <scopes>    Список запрашиваемых прав через запятую (по умолчанию: "artifacts:read,artifacts:write,shares:write")
```

### `oa whoami`
Показывает текущие учетные данные, адрес сервера, идентификатор организации и статус токена.

### `oa push <file>`
Создает новый артефакт или обновляет существующий из локального файла.

```bash
oa push <file> [options]
  --title <title>       Название артефакта (по умолчанию: имя файла)
  --kind <kind>         Тип контента: html | markdown | mermaid | svg (определяется автоматически)
  --id <id>             ID существующего артефакта для создания новой версии
  --share               Сразу сгенерировать публичную ссылку
  --password <pass>     Защитить ссылку паролем (включает --share)
  --expires <ttl>       Срок действия ссылки: 1h, 1d, 7d, 30d (включает --share)
  --message <msg>       Сообщение версии
  --json                Вывод результата в формате JSON
```

### `oa list`
Выводит список всех артефактов в текущей организации.

```bash
oa list [--json]
```

### `oa get <artifact-id>`
Показывает информацию об артефакте или скачивает его содержимое в файл.

```bash
oa get <artifact-id> [-o output-file] [--json]
```

### `oa rm <artifact-id>`
Удаляет артефакт в архив.

```bash
oa rm <artifact-id> [--json]
```

### `oa share <artifact-id>`
Создает ссылку для совместного доступа к артефакту.

```bash
oa share <artifact-id> [options]
  --password <pass>     Защитить ссылку паролем
  --expires <ttl>       Срок действия ссылки (например: 1h, 1d, 7d, 30d)
  --json                Вывод информации о ссылке в формате JSON
```

### `oa unshare <share-id>`
Мгновенно отзывает выданную ссылку.

```bash
oa unshare <share-id> [--json]
```

---

## Использование в CI/CD и неинтерактивных средах

Для автоматических пайплайнов или фоновых скриптов можно передать параметры через переменные окружения, минуя Device Flow:

```bash
export OA_SERVER="https://artifacts.your-company.com"
export OA_TOKEN="oa_live_xxxxxxxxxxxxxxxxxxxxxxxx"
```

Токены агентов создаются в панели управления Open Artifacts в разделе **Команда > Агенты**.

---

## Интеграция с AI-агентами

Утилита оптимизирована для взаимодействия с современными AI-агентами (Claude Code, Cursor, Windsurf, Codex, Antigravity, OpenCode). Установите готовый скилл через [skills.sh](https://skills.sh/emaxe/open-artifacts):

```bash
npx skills add emaxe/open-artifacts
```

---

## Лицензия

MIT © [emaxe](https://github.com/emaxe)
