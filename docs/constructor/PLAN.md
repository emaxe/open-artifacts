# Artifact Constructor — Plan

> **Статус:** черновик плана, реализация не начата  
> **Создан:** 2026-09-18

## Проблема

Текущий workflow создания HTML-артефактов дорогой по токенам:
- Агент пишет полный HTML (~200–1000 строк) вручную каждый раз
- CSS-токены и темы дублируются в каждом файле
- Нет переиспользования типовых UI-блоков
- Нет разделения «что показать» от «как стилизовать»

## Решение: режим конструктора

Агент описывает артефакт декларативно — как набор блоков в YAML — а скрипт собирает из них готовый HTML. Агент не пишет разметку вручную, только структуру контента.

```
Агент → YAML-спецификация → build.mjs → HTML → oa push → URL
```

---

## Структура файлов (после реализации)

```
skills/open-artifacts/
├── SKILL.md                          # обновить: добавить секцию Constructor Mode
├── references/
│   ├── design/                       # без изменений
│   │   └── ...
│   └── api.md                        # без изменений
└── constructor/                      # новая папка
    ├── build.mjs                     # сборщик HTML из YAML-спецификации
    ├── themes/                       # CSS-темы (не зависят от контента)
    │   ├── default.css               # светлая/тёмная тема (токены из DESIGN-core.md)
    │   ├── data.css                  # дополнение для дашбордов (из DESIGN-data.md)
    │   ├── document.css              # дополнение для документов
    │   ├── promo.css                 # дополнение для лендингов
    │   └── diagram.css               # дополнение для диаграмм
    └── blocks/                       # HTML-шаблоны блоков (Handlebars-подобные)
        ├── hero.html
        ├── kpi-row.html
        ├── table.html
        ├── chart-bar.html
        ├── chart-line.html
        ├── chart-pie.html
        ├── text-section.html
        ├── alert.html
        ├── code-block.html
        ├── mermaid-diagram.html
        ├── image.html
        ├── two-columns.html
        ├── tabs.html
        ├── timeline.html
        ├── stats-grid.html
        ├── progress-bars.html
        ├── list-cards.html
        ├── badge-row.html
        └── raw.html                  # универсальный блок: чистый html/css/js
```

---

## Формат спецификации (YAML)

Агент создаёт файл `artifact.yaml` следующей структуры:

```yaml
# artifact.yaml
title: "Q3 Revenue Report"
theme: data                # default | data | document | promo | diagram
lang: en

blocks:
  - type: hero
    title: "Q3 Revenue Report"
    subtitle: "July – September 2026"
    badge: "Final"

  - type: kpi-row
    items:
      - label: "Revenue"
        value: "$4.2M"
        delta: "+18%"
        trend: up
      - label: "Customers"
        value: "1 240"
        delta: "-3%"
        trend: down

  - type: table
    caption: "Top 5 accounts"
    columns: ["Account", "ARR", "Status"]
    rows:
      - ["Acme Corp", "$420k", "Active"]
      - ["Globex", "$380k", "Active"]

  - type: chart-bar
    title: "Monthly revenue"
    labels: ["Jul", "Aug", "Sep"]
    datasets:
      - label: "2026"
        data: [1200, 1500, 1500]

  - type: text-section
    heading: "Key Takeaways"
    body: |
      Revenue grew 18% QoQ driven by enterprise expansion...

  - type: raw
    html: |
      <div style="background: var(--surface-2); padding: 16px; border-radius: var(--radius);">
        <p>Любой произвольный HTML/CSS/JS</p>
      </div>
    scripts: |
      console.log('custom script runs here');
```

**Почему YAML, а не JSON:**
- Читаемее агентом и человеком
- Поддерживает многострочные строки (`|`) — важно для raw-блоков
- Легко парсится Node.js (`js-yaml`)
- Компактнее: агент пишет меньше символов → экономия токенов

---

## Блоки — полный каталог

| Тип | Описание | Ключевые поля |
|-----|----------|---------------|
| `hero` | Заголовочный баннер с заголовком, подзаголовком, опциональным бейджем | `title`, `subtitle`, `badge`, `align` |
| `kpi-row` | Строка KPI-плиток (метрики с дельтой и трендом) | `items[]{label, value, delta, trend}` |
| `stats-grid` | Сетка статистических карточек (авто-адаптив) | `cols`, `items[]{label, value, icon}` |
| `table` | HTML-таблица с заголовком и опциональной сортировкой | `columns`, `rows`, `caption`, `sortable` |
| `chart-bar` | Столбчатая диаграмма (Chart.js) | `title`, `labels`, `datasets[]` |
| `chart-line` | Линейный график (Chart.js) | `title`, `labels`, `datasets[]` |
| `chart-pie` | Круговая/кольцевая диаграмма (Chart.js) | `title`, `labels`, `data`, `donut` |
| `mermaid-diagram` | Mermaid-диаграмма, встроенная в HTML | `definition` (multiline) |
| `text-section` | Секция с заголовком и prose-текстом (Markdown → HTML) | `heading`, `body`, `level` |
| `markdown` | **Произвольный Markdown прямо в YAML** — вставка готового MD-контента | `content` (multiline) |
| `markdown-file` | **Целый MD-файл с диска** — для больших готовых отчётов | `path`, `strip_frontmatter` |
| `alert` | Блок внимания (info / warning / error / success) | `kind`, `title`, `body` |
| `code-block` | Подсвеченный блок кода | `lang`, `code`, `caption` |
| `image` | Изображение с подписью | `src`, `alt`, `caption`, `width` |
| `two-columns` | Двухколонный лейаут, каждая колонка — список блоков | `left[]`, `right[]`, `ratio` |
| `tabs` | Переключаемые вкладки (JS без CDN) | `items[]{label, blocks[]}` |
| `timeline` | Вертикальная хронология событий | `items[]{date, title, body, status}` |
| `progress-bars` | Набор прогресс-баров с метками | `items[]{label, value, max, color}` |
| `list-cards` | Сетка карточек | `items[]{title, body, badge, href}` |
| `badge-row` | Строка бейджей/тегов | `items[]{label, color}` |
| `divider` | Горизонтальный разделитель с опциональным текстом | `label` |
| `spacer` | Пустой отступ | `size` (px или sp-N) |
| `raw` | **Универсальный блок**: произвольный HTML/CSS/JS | `html`, `css`, `scripts` |

**Итого: 22 блока** — покрывают дашборды, отчёты, документы, лендинги, диаграммы.

---

## Скрипт сборщика `build.mjs`

### Технологический стек
- **Node.js** (встроенный в любую dev-машину)
- **`js-yaml`** — парсинг YAML (уже в node_modules проекта или ставится разово)
- **`marked`** — Markdown → HTML для блоков `text-section`, `markdown`, `markdown-file`
- Никаких сборщиков (webpack/vite) — один файл, запуск `node build.mjs spec.yaml`

### Два режима работы

**Режим 1: Passthrough** — весь артефакт является одним MD-файлом. Минимальная спецификация, агент ничего не описывает блоками:

```yaml
title: "Q3 Analysis Report"
theme: document
source: /tmp/q3-analysis.md   # ← весь файл целиком
```

Сборщик читает файл, конвертирует через `marked`, оборачивает в HTML-скелет с темой. Это самый короткий путь для готовых MD-отчётов.

**Режим 2: Blocks** — стандартный режим с набором блоков (как раньше).

### Алгоритм

```
1. Читаем YAML-файл (args[0])
2. ЕСЛИ spec.source задан (passthrough mode):
   a. Читаем MD-файл с указанного пути
   b. Конвертируем через marked.parse()
   c. Переходим сразу к шагу 5
3. Загружаем CSS темы: default.css + {theme}.css
4. Для каждого block в blocks[]:
   a. Если block.type === 'markdown':
      → marked.parse(block.content) → вставляем в обёртку
   b. Если block.type === 'markdown-file':
      → читаем файл block.path (путь относительно spec.yaml или абсолютный)
      → если strip_frontmatter: true — обрезаем YAML frontmatter (---...---)
      → marked.parse() → вставляем в обёртку
   c. Иначе: загружаем шаблон blocks/{type}.html, интерполируем переменные
   d. Добавляем в body
5. Собираем HTML-скелет со <style> и <body>
6. Записываем в output.html (или имя из --out)
7. Опционально: вызываем `oa push output.html --title "..." --share`
```

### CLI-интерфейс

```bash
# Только сборка
node skills/open-artifacts/constructor/build.mjs spec.yaml

# Сборка + публикация
node skills/open-artifacts/constructor/build.mjs spec.yaml --push --title "Report"

# Сборка + публикация + шеринг
node skills/open-artifacts/constructor/build.mjs spec.yaml --push --share

# Указать выходной файл
node skills/open-artifacts/constructor/build.mjs spec.yaml --out report.html
```

---

## Обновление SKILL.md

В `skills/open-artifacts/SKILL.md` добавляется новая секция **"Constructor Mode"** (перед секцией "Design: read a template before you write"):

### Содержание новой секции

1. **Что такое режим конструктора** — краткое описание
2. **Когда использовать** — всегда по умолчанию, кроме случаев где нужен raw HTML
3. **Когда НЕ использовать** — явная просьба «чистый HTML», или нужен очень нестандартный лейаут
4. **Инструкция агенту**: написать `artifact.yaml` → запустить `build.mjs` → опубликовать
5. **Справочник блоков** — краткая таблица (полный каталог в отдельном файле)
6. **Примеры** — 2–3 минимальных YAML-спецификации для типовых задач

---

## Темы оформления (CSS)

### Принцип
- `default.css` содержит весь CSS из `DESIGN-core.md` + базовые стили блоков
- `{theme}.css` — delta-файл, только переопределения/дополнения
- Скрипт конкатенирует: `default.css` + `{theme}.css` → `<style>` в HTML

### Темы и их назначение

| Файл | Назначение | Что добавляет к default |
|------|------------|------------------------|
| `default.css` | Все базовые токены + стили блоков | — |
| `data.css` | KPI-плитки, таблицы, графики | Compact spacing, dense tables, chart wrappers |
| `document.css` | Длинные тексты, RFC, документы | Wider line-height, drop caps, footnote styles |
| `promo.css` | Лендинги, анонсы, питч-слайды | Large hero, gradient accents, bold type scale |
| `diagram.css` | Диаграммы, схемы | Mermaid wrapper, legend styles |

---

## Дополнительные файлы плана

| Файл | Содержание |
|------|------------|
| [`BLOCKS-SPEC.md`](./BLOCKS-SPEC.md) | Детальная спецификация каждого блока: поля, типы, дефолты, примеры YAML |
| [`THEMES-SPEC.md`](./THEMES-SPEC.md) | Детальная спецификация CSS-тем: что входит, какие классы, примеры |
| [`BUILDER-SPEC.md`](./BUILDER-SPEC.md) | Детальная спецификация скрипта build.mjs: алгоритм, API, обработка ошибок |
| [`SKILL-PATCH.md`](./SKILL-PATCH.md) | Точный текст изменений в SKILL.md (diff-подобный формат) |

---

## Порядок реализации

```
Шаг 1: CSS-темы (themes/)
  → Нет зависимостей, самодостаточны
  → default.css = DESIGN-core.md + базовые блок-стили
  → Остальные темы — delta поверх default.css

Шаг 2: HTML-шаблоны блоков (blocks/)
  → Начать с core-блоков: hero, kpi-row, table, text-section, raw
  → Затем chart-блоки (Chart.js UMD)
  → Затем интерактивные: tabs, mermaid-diagram

Шаг 3: Скрипт build.mjs
  → Зависит от шаблонов и тем
  → Сначала минимальный вариант (без Markdown, без --push)
  → Потом полный

Шаг 4: Обновление SKILL.md
  → После того как build.mjs работает и проверен
  → Добавить секцию Constructor Mode с реальными примерами

Шаг 5: Тестирование
  → 3–4 тестовых спецификации: дашборд, документ, лендинг, диаграмма
  → Проверить dark mode, print, CSP
```

---

## Открытые вопросы

1. **Зависимости build.mjs**: использовать `js-yaml` (нужна установка) или написать минимальный YAML-парсер для подмножества, которое нам нужно? → рекомендую `js-yaml`, он уже в devDeps многих проектов
2. **Markdown в `text-section.body`**: использовать `marked` (CDN недоступен внутри артефакта, но нужен на этапе сборки) или оставить plain text? → рекомендую `marked` на этапе сборки
3. **Шаблонизатор**: самописный `{{var}}` vs Handlebars/mustache? → самописный, чтобы не добавлять зависимость
4. **Хранение `artifact.yaml`**: в tmp агента или в scratch-директории сессии? → в scratch-директории, путь передаётся через аргументы build.mjs
5. **Chart.js версия для пиннинга**: зафиксировать одну версию в шаблонах блоков или параметризировать? → зафиксировать в шаблоне, обновлять вручную при необходимости
