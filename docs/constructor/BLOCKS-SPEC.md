# Blocks Specification

Детальная спецификация каждого блока конструктора.  
Формат: поля → типы → дефолты → пример YAML → ожидаемый HTML-результат (описание).

---

## Соглашения

- Поля помечены `*` если **обязательные**
- Типы: `string`, `number`, `boolean`, `enum(a|b|c)`, `Block[]` (вложенные блоки), `Item[]`
- `color` — одно из: `accent | pos | neg | warn | c1…c6 | muted` — маппится в CSS-переменную

---

## `hero`

Заголовочный баннер страницы. Обычно первый блок.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `title` * | string | — | Главный заголовок (H1) |
| `subtitle` | string | — | Подзаголовок / описание |
| `badge` | string | — | Маленький лейбл справа от заголовка |
| `badge_color` | color | `accent` | Цвет бейджа |
| `align` | enum(left\|center) | `left` | Выравнивание текста |
| `meta` | string | — | Мелкий текст под заголовком (дата, автор) |

```yaml
- type: hero
  title: "Q3 Revenue Report"
  subtitle: "Performance summary for July – September 2026"
  badge: "Final"
  meta: "Generated 2026-09-18"
```

---

## `kpi-row`

Горизонтальная строка KPI-плиток. Адаптируется к ширине экрана (auto-fit grid).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | Item[] | — | Список плиток |
| `cols` | number | auto | Макс. количество колонок (1–6) |

**Item fields:**

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `label` * | string | — | Название метрики |
| `value` * | string | — | Значение (строка, форматирование на стороне агента) |
| `delta` | string | — | Изменение (+18%, −3 pts) |
| `trend` | enum(up\|down\|neutral) | neutral | Направление тренда → цвет |
| `suffix` | string | — | Единица измерения (показывается мелко рядом с value) |
| `icon` | string | — | Unicode-эмодзи или символ (💰, 👤) |

```yaml
- type: kpi-row
  items:
    - label: Revenue
      value: "$4.2M"
      delta: "+18%"
      trend: up
      icon: "💰"
    - label: Customers
      value: "1 240"
      delta: "−3%"
      trend: down
```

---

## `stats-grid`

Сетка карточек со статистикой — аналог kpi-row, но с другим визуальным акцентом (большие числа, иконки).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | Item[] | — | Список карточек |
| `cols` | number | 3 | Количество колонок |

**Item fields:** `label`, `value`, `icon`, `color` (accent цифры)

```yaml
- type: stats-grid
  cols: 4
  items:
    - label: "Uptime"
      value: "99.98%"
      icon: "⬆️"
      color: pos
    - label: "Incidents"
      value: "2"
      icon: "⚠️"
      color: warn
```

---

## `table`

HTML-таблица. Поддерживает опциональную JS-сортировку (без внешних библиотек).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `columns` * | string[] | — | Заголовки колонок |
| `rows` * | string[][] | — | Строки данных |
| `caption` | string | — | Подпись таблицы (над ней) |
| `sortable` | boolean | false | Включить JS-сортировку по клику на заголовок |
| `striped` | boolean | true | Чередующиеся строки |
| `compact` | boolean | false | Уменьшенные отступы |
| `highlight_col` | number | — | Индекс колонки для выделения (0-based) |

```yaml
- type: table
  caption: "Top accounts by ARR"
  sortable: true
  columns: ["Account", "ARR", "Growth", "Status"]
  rows:
    - ["Acme Corp", "$420k", "+22%", "Active"]
    - ["Globex", "$380k", "+11%", "Active"]
    - ["Initech", "$210k", "−4%", "At risk"]
```

---

## `chart-bar`

Столбчатая диаграмма (Chart.js UMD с cdnjs).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `title` | string | — | Заголовок диаграммы |
| `labels` * | string[] | — | Подписи по оси X |
| `datasets` * | Dataset[] | — | Один или несколько датасетов |
| `height` | number | 300 | Высота canvas в px |
| `stacked` | boolean | false | Стакированные столбцы |
| `horizontal` | boolean | false | Горизонтальные столбцы |

**Dataset fields:** `label`, `data` (number[]), `color` (маппится в --c1…--c6)

```yaml
- type: chart-bar
  title: "Monthly Revenue ($k)"
  labels: ["Jul", "Aug", "Sep"]
  datasets:
    - label: "2026"
      data: [1200, 1500, 1500]
      color: c1
    - label: "2025"
      data: [980, 1100, 1320]
      color: c2
```

---

## `chart-line`

Линейный график (Chart.js UMD).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `title` | string | — | Заголовок |
| `labels` * | string[] | — | Ось X |
| `datasets` * | Dataset[] | — | Датасеты |
| `height` | number | 300 | Высота canvas |
| `fill` | boolean | false | Заливка под линией |
| `tension` | number | 0.3 | Сглаживание линии (0–1) |
| `y_min` | number | — | Минимум оси Y |
| `y_max` | number | — | Максимум оси Y |

```yaml
- type: chart-line
  title: "DAU trend"
  fill: true
  labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
  datasets:
    - label: "Users"
      data: [4200, 4800, 5100, 4900, 5400, 3100, 2900]
```

---

## `chart-pie`

Круговая или кольцевая диаграмма (Chart.js UMD).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `title` | string | — | Заголовок |
| `labels` * | string[] | — | Сегменты |
| `data` * | number[] | — | Значения |
| `donut` | boolean | false | Кольцевой вариант |
| `height` | number | 280 | Высота canvas |

```yaml
- type: chart-pie
  title: "Revenue by segment"
  donut: true
  labels: ["Enterprise", "Mid-market", "SMB"]
  data: [58, 27, 15]
```

---

## `mermaid-diagram`

Встраивает Mermaid-диаграмму через `mermaid.js` UMD (cdnjs/jsdelivr).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `definition` * | string | — | Mermaid-разметка (multiline YAML `\|`) |
| `caption` | string | — | Подпись под диаграммой |

```yaml
- type: mermaid-diagram
  caption: "Service architecture"
  definition: |
    graph LR
      A[Client] --> B[API Gateway]
      B --> C[Auth Service]
      B --> D[Data Service]
      D --> E[(Database)]
```

---

## `text-section`

Секция с заголовком и текстом. Тело поддерживает Markdown (конвертируется на этапе сборки через `marked`).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `heading` | string | — | Заголовок секции |
| `level` | number (1–4) | 2 | Уровень heading (h2, h3…) |
| `body` * | string | — | Текст (Markdown) |
| `lead` | boolean | false | Первый абзац крупнее (lead paragraph) |

```yaml
- type: text-section
  heading: "Key Takeaways"
  body: |
    Revenue grew **18% QoQ** driven by enterprise expansion.

    - Three new Fortune 500 logos
    - Average deal size increased to **$340k**

    > Churn remained flat at 1.2% monthly.
```

---

## `markdown`

**Вставка готового Markdown-контента прямо в YAML.** Используй когда у тебя уже есть написанный MD-текст (отчёт, анализ, README) и нужно вставить его как блок внутри артефакта — рядом с другими блоками (KPI, таблицами и т.д.).

Отличие от `text-section`: нет отдельного заголовочного поля — весь контент уже содержит свои заголовки. Поддерживаются все стандартные MD-элементы: h1–h6, списки, таблицы, цитаты, code, bold, italic.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `content` * | string | — | Markdown-текст (multiline YAML `\|`) |
| `class` | string | — | Доп. CSS-класс на обёртке (для кастомизации через `raw.css`) |

```yaml
- type: markdown
  content: |
    ## Summary

    This quarter we achieved **record revenue** of $4.2M, representing an 18% increase QoQ.

    ### Key drivers

    | Driver | Impact |
    |--------|--------|
    | Enterprise expansion | +$420k ARR |
    | New logos (3) | +$180k ARR |
    | Price increase | +$95k ARR |

    > All figures are preliminary pending final reconciliation on Oct 5.

    For detailed breakdown see the [appendix](#appendix).
```

> **Когда использовать `markdown` vs `text-section`:**  
> - `text-section` — когда у тебя есть отдельный заголовок и короткий текст  
> - `markdown` — когда у тебя уже готовый MD-документ или его фрагмент с собственной структурой заголовков

---

## `markdown-file`

**Загрузка целого MD-файла с диска.** Главный блок для вставки готовых больших отчётов — агент пишет MD-файл, потом ссылается на него в спецификации. Никакого копирования контента в YAML.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `path` * | string | — | Путь к MD-файлу (абсолютный или относительно spec.yaml) |
| `strip_frontmatter` | boolean | true | Убрать YAML frontmatter (`---…---`) перед рендерингом |
| `class` | string | — | Доп. CSS-класс на обёртке |

```yaml
- type: markdown-file
  path: /tmp/q3-analysis-report.md
  strip_frontmatter: true
```

```yaml
# Также работает относительный путь от spec.yaml:
- type: markdown-file
  path: ./reports/q3-analysis.md
```

> **Типичный workflow агента:**
> 1. Агент пишет отчёт в `/tmp/report.md`
> 2. Создаёт минимальный `spec.yaml` с одним `markdown-file` блоком (+ опционально hero/kpi сверху)
> 3. Запускает `build.mjs spec.yaml --share`

**Пример комбинированной спецификации** — KPI сверху, полный MD-отчёт ниже:

```yaml
title: "Q3 Full Report"
theme: document

blocks:
  - type: hero
    title: "Q3 Analysis Report"
    subtitle: "July – September 2026"
    badge: "Preliminary"
    meta: "Generated 2026-09-18"

  - type: kpi-row
    items:
      - label: Revenue
        value: "$4.2M"
        delta: "+18%"
        trend: up
      - label: Churn
        value: "1.2%"
        delta: "0%"
        trend: neutral

  - type: divider
    label: "Full Report"

  - type: markdown-file
    path: /tmp/q3-analysis.md
    strip_frontmatter: true
```

---

## Passthrough mode (без `blocks`)

Если агенту нужно опубликовать **весь MD-файл как артефакт** — без блоков сверху — можно использовать поле `source` на верхнем уровне спецификации вместо `blocks`:

```yaml
title: "Q3 Analysis Report"
theme: document
lang: en
source: /tmp/q3-analysis.md   # путь к MD-файлу, blocks не нужны
```

Это самый короткий вариант для готового отчёта. Сборщик читает файл, рендерит через `marked` и оборачивает в HTML с темой `document` (или любой другой). YAML frontmatter обрезается автоматически.

---



## `alert`

Блок предупреждения / заметки / успеха.


| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `kind` | enum(info\|warning\|error\|success) | info | Тип |
| `title` | string | — | Заголовок |
| `body` | string | — | Текст (Markdown) |

```yaml
- type: alert
  kind: warning
  title: "Data lag"
  body: "Figures for Sep 30 may shift by up to 2% once invoices are reconciled."
```

---

## `code-block`

Блок кода с подсветкой синтаксиса (highlight.js UMD cdnjs, только если хотя бы один `code-block` в документе — скрипт подключает его один раз).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `lang` | string | plaintext | Язык для подсветки |
| `code` * | string | — | Код (multiline YAML `\|`) |
| `caption` | string | — | Подпись под блоком |
| `line_numbers` | boolean | false | Показывать номера строк |

```yaml
- type: code-block
  lang: python
  caption: "Churn prediction model"
  code: |
    def predict_churn(features):
        return model.predict_proba(features)[:, 1]
```

---

## `image`

Изображение из абсолютного URL (или data URI).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `src` * | string | — | URL, data:image/... или локальный путь (авто-инлайн в base64) |
| `alt` * | string | — | Alt-текст (доступность) |
| `caption` | string | — | Подпись |
| `width` | string | 100% | CSS-ширина (px, %, auto) |
| `align` | enum(left\|center\|right) | center | Выравнивание |
| `zoomable` | boolean | false | Увеличение на весь экран при клике (lightbox) |

```yaml
- type: image
  src: "https://example.com/af/token123"
  alt: "Q3 revenue trend chart"
  caption: "Source: Salesforce export, 2026-09-15"
  width: "80%"
  zoomable: true
```

---

## `two-columns`

Двухколонный лейаут. Каждая колонка — список блоков (любых типов, кроме `two-columns`).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `left` * | Block[] | — | Блоки в левой колонке |
| `right` * | Block[] | — | Блоки в правой колонке |
| `ratio` | string | 1:1 | Пропорция (1:2, 2:3, etc.) |
| `gap` | number | 24 | Отступ между колонками (px) |
| `breakpoint` | number | 640 | Ширина (px) для переключения в одну колонку |

```yaml
- type: two-columns
  ratio: 2:1
  left:
    - type: text-section
      heading: "Analysis"
      body: "Details here..."
  right:
    - type: kpi-row
      items:
        - label: "Score"
          value: "8.4"
```

---

## `tabs`

Переключаемые вкладки (JS встроен в шаблон, без внешних зависимостей).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | TabItem[] | — | Вкладки |
| `default` | number | 0 | Индекс активной вкладки по умолчанию |

**TabItem fields:**
- `label` * — string: название вкладки
- `blocks` * — Block[]: содержимое вкладки

```yaml
- type: tabs
  items:
    - label: "Overview"
      blocks:
        - type: text-section
          body: "Summary of Q3 results..."
    - label: "Details"
      blocks:
        - type: table
          columns: ["Month", "Revenue"]
          rows: [["Jul", "$1.2M"], ["Aug", "$1.5M"]]
```

---

## `timeline`

Вертикальная хронология событий.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | TimelineItem[] | — | События |

**TimelineItem fields:**
- `date` * — string: дата или метка времени
- `title` * — string: заголовок события
- `body` — string: описание (Markdown)
- `status` — enum(done\|active\|pending): иконка/цвет точки

```yaml
- type: timeline
  items:
    - date: "2026-07-01"
      title: "Q3 kickoff"
      status: done
      body: "Targets set: $4M revenue, 1200 customers."
    - date: "2026-09-30"
      title: "Q3 close"
      status: done
      body: "Achieved **$4.2M**, 1240 customers."
```

---

## `progress-bars`

Набор прогресс-баров (горизонтальных).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | ProgressItem[] | — | Список баров |

**ProgressItem fields:**
- `label` * — string
- `value` * — number
- `max` — number (default: 100)
- `color` — color (default: accent)
- `show_value` — boolean (default: true): показывать число справа

```yaml
- type: progress-bars
  items:
    - label: "Enterprise"
      value: 58
      color: c1
    - label: "Mid-market"
      value: 27
      color: c2
    - label: "SMB"
      value: 15
      color: c3
```

---

## `list-cards`

Сетка карточек с заголовком, текстом, опциональным бейджем и ссылкой.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | CardItem[] | — | Список карточек |
| `cols` | number | 3 | Количество колонок |

**CardItem fields:**
- `title` * — string
- `body` — string (Markdown)
- `badge` — string
- `badge_color` — color (default: accent)
- `href` — string: делает карточку кликабельной
- `icon` — string: эмодзи/символ

```yaml
- type: list-cards
  cols: 3
  items:
    - title: "API Gateway"
      icon: "🔌"
      badge: "v2.4"
      body: "Handles **12k req/s** at peak."
    - title: "Auth Service"
      icon: "🔒"
      badge: "Healthy"
      badge_color: pos
      body: "Zero incidents this quarter."
```

---

## `badge-row`

Горизонтальный ряд бейджей/тегов.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | BadgeItem[] | — | Бейджи |
| `align` | enum(left\|center\|right) | left | Выравнивание |

**BadgeItem fields:**
- `label` * — string
- `color` — color (default: accent)

```yaml
- type: badge-row
  align: center
  items:
    - label: "Python"
      color: c1
    - label: "React"
      color: c2
    - label: "PostgreSQL"
      color: c3
```

---

## `divider`

Горизонтальная линия-разделитель.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `label` | string | — | Текст в центре разделителя |

```yaml
- type: divider
  label: "Appendix"
```

---

## `spacer`

Пустой вертикальный отступ.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `size` | string | sp-5 (24px) | CSS-значение или sp-токен (sp-1…sp-8) |

```yaml
- type: spacer
  size: sp-7
```

---

## `raw`

**Универсальный escape-hatch блок.** Используй когда ни один другой блок не подходит.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `html` | string | — | Произвольный HTML (multiline `\|`) |
| `css` | string | — | Дополнительный CSS (вставляется в `<style>` в head) |
| `scripts` | string | — | JS-код (вставляется в `<script>` в конец body) |
| `cdn_scripts` | string[] | — | Список CDN URL скриптов (UMD, cdnjs/jsdelivr) |

```yaml
- type: raw
  css: |
    .my-custom { background: var(--surface-2); border-radius: var(--radius); padding: var(--sp-4); }
  html: |
    <div class="my-custom">
      <h3>Custom layout</h3>
      <p>Здесь можно написать любой HTML, используя CSS-токены темы.</p>
    </div>
  scripts: |
    document.querySelector('.my-custom').addEventListener('click', () => {
      console.log('clicked');
    });
```

> **Важно:** CSS-переменные темы (`--bg`, `--surface`, `--accent`, etc.) доступны в raw-блоках — используй их вместо хардкода цветов.
