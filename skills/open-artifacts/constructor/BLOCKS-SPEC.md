# Blocks Specification

Детальная спецификация каждого блока конструктора.  
Формат: поля → типы → дефолты → пример YAML → ожидаемый HTML-результат (описание).

---

## Соглашения

- Поля помечены `*` если **обязательные**
- Типы: `string`, `number`, `boolean`, `enum(a|b|c)`, `Block[]` (вложенные блоки), `Item[]`
- `color` — одно из: `accent | pos | neg | warn | c1…c6 | muted` — маппится в CSS-переменную
- **Model-friendly aliases**: конструктор поддерживает синонимы полей, привычные LLM (например, `variant` для `kind`, `text`/`content` для `body`, `headers` для `columns`, `code` для `definition`, `title` для `heading`). Сборщик `build.mjs` автоматически валидирует схему и нормализует синонимы.

---

## Общие поля

Эти поля принимает **любой** блок. Сборщик применяет их к корневому элементу блока (обёртка не добавляется, поэтому существующие CSS-селекторы не ломаются). Для `markdown` / `markdown-file` они попадают на `<div class="markdown-body">`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `id` | string | авто для заголовков | Якорь блока: `href: "#id"` работает в любом `href` (cards, buttons, toc). Явные `id` резервируются первыми, автогенерация с ними не пересекается |
| `class` | string | — | Дополнительные CSS-классы (допустимы буквы, цифры, `_`, `-`) |
| `width` | enum(narrow\|normal\|wide\|full) | — | Ширина блока относительно колонки страницы (классы `oa-w-*`); `full` — на всю ширину окна. **У `image` поле `width` остаётся CSS-шириной** (`"80%"`, `"320px"`) |
| `spacing` | `{top, bottom}` или одно значение | — | Внешние отступы блока: токен `sp-1…sp-8` или CSS-длина; число = px. Одно значение задаёт и верх, и низ. Допустимы также ключи `mt` / `mb` |
| `hide` | enum(mobile\|desktop\|print) или список | — | Скрыть блок на мобильных / на десктопе / при печати (классы `oa-hide-*`) |
| `span` | number | 1 | Сколько колонок занимает блок внутри `grid` |
| `row_span` | number | 1 | Сколько рядов занимает блок внутри `grid` |
| `toc_label` | string | — | Включает блок в оглавление (`toc`) под этим названием, даже если у него нет заголовка |
| `toc_level` | number | 2 | Уровень блока в оглавлении при заданном `toc_label` |

```yaml
- type: alert
  id: risks
  class: my-callout
  width: wide
  spacing: { top: sp-6, bottom: sp-3 }
  hide: print
  toc_label: "Риски"
  kind: warning
  body: "Не показывается в печатной версии."
```

Автоматические якоря: заголовки `hero` (уровень 1), `text-section` и `section` (по `level`) и все заголовки Markdown (`markdown`, `markdown-file`) получают `id` из транслитерированного slug'а заголовка (`Выручка Q3` → `vyruchka-q3`). Повторы получают суффикс `-2`, `-3`. Если у корневого элемента шаблона уже есть свой `id`, а в блоке задан другой, перед блоком вставляется невидимая точка `<a class="oa-anchor" id="…">`.

---

## Вложенность

Блоки, содержащие другие блоки, вкладываются **на любую глубину**: `section`, `grid`, `stack`, `two-columns` (`left` / `right`), а также `items[].blocks` у `tabs`, `accordion`, `steps`, `slideshow` и `cards`. Правила:

- Валидация идёт рекурсивно; в сообщении об ошибке указан путь вида `Block #3 (blocks) → Block #2`.
- Chart.js, Mermaid и highlight.js подключаются один раз на всю страницу, сколько бы графиков ни лежало внутри вкладок и аккордеонов.
- Графики и диаграммы в скрытых панелях (вкладка, закрытый аккордеон, невидимый слайд) дорисовываются при показе.
- Ограничение «`two-columns` внутри `two-columns` нельзя» снято.

```yaml
- type: section
  title: "Итоги"
  blocks:
    - type: grid
      cols: 2
      blocks:
        - type: cards
          items:
            - title: "Деталь"
              blocks:
                - type: accordion
                  items:
                    - title: "График"
                      blocks:
                        - { type: chart-bar, labels: [A, B], datasets: [{ label: X, data: [1, 2] }] }
```

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
| `spark` | number[] | — | Мини-график (sparkline): inline SVG, строится при сборке без Chart.js; нужно минимум 2 числа |

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

**Item fields:** `label`, `value`, `icon`, `color` (accent цифры), `spark` (number[], минимум 2 числа: мини-график sparkline в виде inline SVG)

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
| `monochrome` | boolean | false | Один датасет по умолчанию красится по столбцам из палитры (`--c1…--c6`); `true` или явный `color` у датасета оставляет один цвет |

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
| `monochrome` | boolean | false | Один датасет по умолчанию красится по сегментам и точкам из палитры; `true` или явный `color` оставляет один цвет |
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

Блок предупреждения / заметки / успеха. Обязательно наличие хотя бы одного из полей `body` (или `text`) либо `title` (иначе алерт не имеет контента).

| Поле | Тип | Дефолт | Алиасы (синонимы) | Описание |
|------|-----|--------|-------------------|----------|
| `kind` | enum(info\|warning\|error\|success) | info | `variant`, `type`, `status`, `severity` | Тип (также понимает `warn` → `warning`, `danger` → `error`) |
| `title` | string | — | `heading`, `header` | Заголовок |
| `body` | string | — | `text`, `content`, `message`, `description` | Текст (Markdown) |
| `icon` | string | авто | — | Кастомная иконка/эмодзи (дефолт: ℹ️, ⚠️, ❌, ✅) |

```yaml
- type: alert
  kind: warning # или variant: warning
  title: "Data lag"
  body: "Figures for Sep 30 may shift by up to 2% once invoices are reconciled." # или text: "..."
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

Изображение из URL, `data:` URI или локального файла (автоматически инлайнится в base64).

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `src` * | string | — | URL, data:image/... или локальный путь (авто-инлайн в base64) |
| `alt` | string | `caption` / имя файла | Alt-текст (доступность) |
| `title` | string | — | Заголовок **над** картинкой (раньше был синонимом `caption`) |
| `caption` | string (Markdown) | — | Подпись под картинкой; поддерживает inline-Markdown |
| `credit` | string | — | Источник / автор, мелким шрифтом в подписи |
| `link` | string | — | Картинка становится ссылкой (`https://…`, `#anchor`); алиас `href`. Внешние ссылки открываются в новой вкладке |
| `width` | string | 100% | **CSS-ширина** (px, %, auto) — не путать с общим полем `width` других блоков |
| `height` | string/number | — | Высота (число = px); вместе с ней применяется `fit` |
| `aspect` | string | — | Пропорции: `"16:9"`, `"4/3"`, `1.5` |
| `fit` | enum(cover\|contain) | cover | Как вписывать картинку при заданных `aspect` / `height` |
| `align` | enum(left\|center\|right) | center | Выравнивание |
| `float` | enum(left\|right) | — | Обтекание текстом на десктопе; без `width` занимает 45% |
| `zoomable` | boolean | false | Увеличение на весь экран по клику (lightbox) |
| `group` | string | — | Имя группы lightbox: картинки с одинаковым `group` листаются стрелками как галерея |
| `rounded` | boolean | true | `false` — прямые углы |
| `border` | boolean | false | Рамка |
| `shadow` | boolean | false | Тень |
| `lazy` | boolean | true | Ленивая загрузка (`loading="lazy"`) |

> **Изменение в 0.13.0:** `title` больше не синоним `caption`. Если раньше подпись задавалась через `title`, переименуйте поле в `caption`.

**Lightbox** (общий для `image`, `gallery`, `slideshow`, `cards`): листание группы стрелками на экране, клавишами ← / →, свайпом; подпись и счётчик «3 / 12»; клик по картинке — zoom 2× с перетаскиванием (drag-to-pan); закрытие по Esc или клику по фону. Модуль подключается только если на странице есть хотя бы один `zoomable`.

```yaml
- type: image
  src: "https://example.com/af/token123"
  alt: "Q3 revenue trend chart"
  title: "Динамика выручки"
  caption: "Source: *Salesforce export*, 2026-09-15"
  credit: "Finance team"
  width: "80%"
  aspect: "16:9"
  zoomable: true
  group: report
  shadow: true
```

---

## `two-columns`

Двухколонный лейаут. Каждая колонка — список блоков (любых типов, в том числе вложенные контейнеры). Частный случай блока `grid` с двумя колонками; остаётся отдельным типом для совместимости.

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
- `blocks` * — Block[]: содержимое вкладки (любые блоки, в том числе вложенные контейнеры)

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

## `cards`

Сетка карточек: заголовок, текст, изображение, бейдж, теги, кнопки, ссылка и вложенные блоки. Заменяет `list-cards`; тип `list-cards` (и `card`) остаётся рабочим алиасом того же блока, старые spec-файлы собираются без изменений.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | CardItem[] | — | Список карточек |
| `cols` | number | 3 | Количество колонок |
| `variant` | enum(elevated\|outline\|flat\|accent) | elevated | Оформление карточек |
| `layout` | enum(grid\|list\|scroll) | grid | Сетка, вертикальный список или горизонтальная лента |
| `equal_height` | boolean | false | Выровнять карточки по высоте |
| `image_aspect` | string | — | Пропорции изображений карточек (`"16:9"`) |
| `align` | enum(left\|center\|right) | left | Выравнивание текста |

**CardItem fields:**

| Поле | Тип | Описание |
|------|-----|----------|
| `title` * | string | Заголовок |
| `subtitle` | string | Подзаголовок |
| `body` | string (Markdown) | Текст |
| `image` | string | URL или локальный файл (инлайнится) |
| `image_position` | enum(top\|left\|background) | Положение изображения (дефолт `top`) |
| `image_alt` | string | Alt-текст (дефолт — `title`) |
| `zoomable` | boolean | Открывать изображение в lightbox |
| `icon` | string | Эмодзи / символ |
| `badge`, `badge_color` | string, color | Бейдж (цвет по умолчанию `accent`) |
| `tags` | string[] | Теги |
| `meta` | string | Мелкая строка (дата, автор) |
| `href` | string | Ссылка. Без `link_label`, `buttons` и `blocks` вся карточка становится кликабельной |
| `link_label` | string | Текст отдельной ссылки внизу (дефолт «Open» / «Подробнее») |
| `new_tab` | boolean | Принудительно открыть в новой вкладке (внешние `http(s)` — всегда в новой) |
| `buttons` | Button[] | Кнопки (формат как у блока `buttons`) |
| `footer` | string | Подвал карточки |
| `color` | color | Цвет акцентной полосы |
| `blocks` | Block[] | Вложенное содержимое |

```yaml
- type: cards
  cols: 3
  variant: outline
  equal_height: true
  items:
    - title: "API Gateway"
      icon: "🔌"
      badge: "v2.4"
      body: "Handles **12k req/s** at peak."
      tags: [edge, go]
      href: "#gateway"
    - title: "Auth Service"
      image: "./auth.png"
      image_position: top
      badge: "Healthy"
      badge_color: pos
      body: "Zero incidents this quarter."
      buttons:
        - { label: "Runbook", href: "https://example.com/runbook" }
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

## `section`

Контейнер с необязательной шапкой (eyebrow, заголовок, подзаголовок) и произвольными вложенными блоками. Алиасы типа: `container`, `wrapper`. Заголовок получает автоматический `id` и попадает в оглавление. `section` с `body` / `text` и без `blocks` по-прежнему трактуется как `text-section`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `blocks` * | Block[] | — | Вложенные блоки (алиасы: `items`, `children`, `content`) |
| `title` | string | — | Заголовок секции |
| `subtitle` | string | — | Подзаголовок |
| `eyebrow` | string | — | Надпись над заголовком |
| `level` | number | 2 | Уровень заголовка (1–6), он же уровень в оглавлении |
| `background` | enum(none\|surface\|accent-soft\|gradient) или картинка | none | Фон; любое другое значение — URL или локальный файл, используется как `background-image` |
| `padding` | string/number | — | Внутренний отступ: токен `sp-*` или CSS-длина (число = px) |
| `border` | boolean | false | Рамка |
| `align` | enum(left\|center\|right) | left | Выравнивание текста шапки |

```yaml
- type: section
  eyebrow: "Раздел 2"
  title: "Результаты"
  subtitle: "Ключевые цифры квартала"
  background: surface
  padding: sp-6
  width: full
  blocks:
    - type: kpi-row
      items: [{ label: Revenue, value: "$4.2M" }]
```

---

## `grid`

Сетка из вложенных блоков. Частный случай: `two-columns` — сетка из двух колонок с `left` / `right`; он остаётся отдельным блоком без изменений. Тип `columns` с `blocks` трактуется как `grid`, без `blocks` — как `two-columns`; `grid` с `items` и без `blocks` по-прежнему означает `stats-grid`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `blocks` * | Block[] | — | Ячейки сетки (алиасы: `items`, `children`, `content`) |
| `cols` | number \| string | auto | Число колонок, строка треков (`"2fr 1fr"`, `"200px 1fr"`) или `auto` (колонки по `min`) |
| `min` | string/number | 240px | Минимальная ширина колонки при `cols: auto` |
| `gap` | string/number | — | Промежуток (`sp-*` или CSS-длина) |
| `align` | enum(start\|center\|end\|stretch) | — | Вертикальное выравнивание ячеек |
| `cols_mobile` | number | 1 | Число колонок на узких экранах |

Дочерние блоки управляют своим размещением через общие поля `span` (колонки) и `row_span` (ряды).

```yaml
- type: grid
  cols: "2fr 1fr"
  gap: sp-4
  blocks:
    - { type: chart-line, labels: [Q1, Q2], datasets: [{ label: Sales, data: [3, 5] }], span: 1, row_span: 2 }
    - { type: kpi-row, items: [{ label: NPS, value: "62" }] }
    - { type: alert, kind: info, body: "Справа два блока." }
```

---

## `stack`

Flex-контейнер: ряд или колонка вложенных блоков. Алиасы типа: `row`, `flex`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `blocks` * | Block[] | — | Вложенные блоки |
| `direction` | enum(row\|column) | column | Направление (синонимы: `horizontal`, `vertical`) |
| `gap` | string/number | — | Промежуток |
| `align` | enum(start\|center\|end\|stretch\|baseline) | — | `align-items` |
| `justify` | enum(start\|center\|end\|between\|around) | — | `justify-content` |
| `wrap` | boolean | true | `false` — не переносить элементы и не сворачивать `row` в колонку на мобильных |
| `fill` | boolean | false | Дочерние блоки делят ширину поровну |

```yaml
- type: stack
  direction: row
  gap: sp-3
  align: center
  justify: between
  blocks:
    - { type: badge-row, items: [Beta, Internal] }
    - { type: buttons, items: [{ label: "Открыть", href: "#details" }] }
```

---

## `anchor`

Невидимая точка перехода. Нужна, когда якорь должен стоять там, где нет заголовка.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `id` * | string | — | Идентификатор (алиасы: `name`, `target`) |
| `label` | string | — | Если задан, точка попадает в оглавление под этим названием |

```yaml
- type: anchor
  id: pricing
  label: "Тарифы"
```

---

## `toc`

Оглавление, собираемое из заголовков и/или помеченных блоков страницы. Алиасы типа: `contents`, `table-of-contents`. Строится в два прохода: на месте блока остаётся заглушка, которая заменяется списком после рендера всей страницы, поэтому оглавление видит заголовки, которые идут после него.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `title` | string | «Contents» / «Содержание» | Заголовок оглавления (язык берётся из `spec.lang`); пустая строка — без заголовка |
| `variant` | enum(inline\|sticky\|sidebar) | inline | `inline` — обычный список; `sticky` — липкая полоса сверху с пунктами верхнего уровня; `sidebar` — боковая колонка рядом с `main` на широких экранах, на узких превращается в inline |
| `min_level` | number | 2 | Минимальный уровень заголовков в списке |
| `depth` | number | 3 | Максимальный уровень заголовков |
| `numbered` | boolean | false | Нумерация (1, 1.1, …) |
| `include` | enum(headings\|blocks\|both) | headings | `headings` — автозаголовки (hero, text-section, section, Markdown); `blocks` — блоки с `toc_label` и `anchor` с `label`; `both` — всё вместе |

У `sticky` и `sidebar` подключается небольшой скрипт: подсветка текущего раздела при прокрутке и плавный переход. Вариант `sidebar` рекомендуется вместе со spec-уровневым `width: wide`.

```yaml
- type: toc
  variant: sidebar
  numbered: true
  depth: 3
  include: both
```

Spec-уровневые опции, влияющие на навигацию (в корне spec, рядом с `title` и `theme`):

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `heading_links` | boolean | true | Ссылка «#» при наведении на любой заголовок с `id` |
| `back_to_top` | boolean | false | Плавающая кнопка «наверх» |
| `width` | enum(narrow\|normal\|wide) или px | normal | Ширина колонки страницы: 720 / 920 / 1200 px либо число в px |

---

## `gallery`

Галерея изображений. Локальные файлы инлайнятся в base64. По клику открывается lightbox с листанием по всей галерее.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | GalleryItem[] | — | Изображения (можно просто список URL-строк; алиасы: `images`, `photos`) |
| `layout` | enum(grid\|masonry\|strip) | grid | `masonry` — колонки с естественной высотой; `strip` — горизонтальная лента со scroll-snap |
| `cols` | number | 3 | Число колонок |
| `aspect` | string | 4:3 | Пропорции ячеек (для `masonry` по умолчанию не задаются) |
| `fit` | enum(cover\|contain) | cover | Вписывание в ячейку |
| `gap` | string/number | — | Промежуток |
| `captions` | enum(below\|overlay\|hover\|none) | below | Где показывать подписи |
| `zoomable` | boolean | true | Lightbox; все элементы образуют одну группу |
| `max_visible` | number | — | Показать N элементов, остальные свернуть в плитку «+N», открывающую lightbox |

**GalleryItem fields:** `src` * (или `url`, `path`, `image`), `alt`, `title`, `caption`, `link` (ссылка вместо lightbox; работает при `zoomable: false`).

```yaml
- type: gallery
  layout: masonry
  cols: 3
  captions: hover
  max_visible: 6
  items:
    - { src: "./shots/a.jpg", title: "Лобби", caption: "Вид с входа" }
    - { src: "./shots/b.jpg" }
    - { src: "https://example.com/af/xyz", alt: "Фасад" }
```

---

## `slideshow`

Слайдшоу / карусель. Слайд — это либо изображение, либо произвольные `blocks`. Управление: стрелки, точки / миниатюры, клавиатура (← / →), свайп. При `prefers-reduced-motion: reduce` автопрокрутка отключается, анимации сокращаются. Алиасы типа: `carousel`, `slider`, `slides`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | SlideItem[] | — | Слайды (алиасы: `slides`, `images`; допустим список URL-строк) |
| `effect` | enum(slide\|fade) | slide | Смена слайдов |
| `nav` | enum(dots\|thumbs\|counter\|none) | dots | Навигация |
| `arrows` | boolean | true | Стрелки |
| `autoplay` | number \| true | — | Интервал в мс (`true` = 5000); добавляет кнопку паузы; останавливается при наведении и фокусе |
| `loop` | boolean | true | Зацикливание |
| `per_view` | number (1–4) | 1 | Сколько слайдов видно одновременно (для `fade` всегда 1) |
| `aspect` | string | 16:9 для картинок | Пропорции слайда |
| `fit` | enum(cover\|contain) | cover | Вписывание картинки |
| `captions` | enum(overlay\|below) | overlay | Положение подписей |
| `zoomable` | boolean | false | Открывать картинки в lightbox |
| `label` | string | «Slideshow» | aria-label карусели |

**SlideItem fields:** `src`, `alt`, `title`, `caption` (inline Markdown) — слайд-картинка; либо `blocks` (Block[]) — слайд с любым содержимым.

```yaml
- type: slideshow
  effect: fade
  nav: thumbs
  autoplay: 6000
  aspect: "16:9"
  zoomable: true
  items:
    - { src: "./slides/1.jpg", caption: "Было" }
    - { src: "./slides/2.jpg", caption: "Стало" }
    - title: "Итог"
      blocks:
        - { type: kpi-row, items: [{ label: "Рост", value: "+18%" }] }
```

---

## `image-compare`

Сравнение «до / после» со шторкой. Шторка двигается мышью, касанием и клавиатурой (слайдер с `aria`-разметкой). Алиасы типа: `before-after`, `image-comparison`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `before` * | string | — | Изображение «до» (URL или локальный файл) |
| `after` * | string | — | Изображение «после» |
| `before_label` | string | «Before» / «До» | Подпись слева (пустая строка — скрыть) |
| `after_label` | string | «After» / «После» | Подпись справа |
| `start` | number | 50 | Начальное положение шторки, % |
| `aspect` | string | 16:9 | Пропорции |
| `caption` | string (Markdown) | — | Подпись под блоком |

```yaml
- type: image-compare
  before: "./old.png"
  after: "./new.png"
  start: 40
  caption: "Редизайн формы входа"
```

---

## `accordion`

Раскрывающиеся секции на нативных `<details>` / `<summary>`: работают без JS и при печати раскрыты целиком. JS-модуль только дорисовывает графики и диаграммы внутри при открытии. Алиасы типа: `faq`, `collapse`, `collapsible`, `details`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | AccItem[] | — | Секции |
| `multiple` | boolean | true | `false` (или `single: true`) — открыта максимум одна секция |
| `default_open` | enum(first\|all\|none) | none | Какие секции открыты изначально |
| `variant` | enum(bordered\|separated\|minimal) | bordered | Оформление |

**AccItem fields:** `title` * (алиасы: `question`, `label`), `body` (Markdown; алиас `answer`), `blocks` (Block[]), `open` (boolean, перекрывает `default_open`), `icon`, `badge`. `body` и `blocks` можно использовать вместе.

```yaml
- type: accordion
  single: true
  default_open: first
  variant: separated
  items:
    - title: "Как получить доступ?"
      body: "Напишите в **#access**."
    - title: "Схема потоков"
      icon: "🧭"
      blocks:
        - type: mermaid-diagram
          definition: "graph LR; A-->B"
```

---

## `steps`

Пошаговая инструкция с акцентом на номера (в отличие от `timeline`, без дат). Алиасы типа: `howto`, `instructions`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | StepItem[] | — | Шаги |
| `variant` | enum(vertical\|horizontal) | vertical | Раскладка |
| `numbered` | boolean | true | Номера в маркерах (`false` — точки) |

**StepItem fields:** `title` *, `body` (Markdown), `blocks` (Block[]), `status` (`done` | `active` | `pending`; у `done` в маркере галочка).

```yaml
- type: steps
  items:
    - title: "Установите CLI"
      body: "`npm i -g oa`"
      status: done
    - title: "Войдите"
      body: "Выполните `oa login`."
    - title: "Опубликуйте"
      blocks:
        - { type: code-block, lang: bash, code: "oa push report.html" }
```

---

## `quote`

Цитата или отзыв. Несколько отзывов — `grid` с `quote` внутри. Алиасы типа: `testimonial`, `pullquote`, `blockquote`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `text` * | string (Markdown) | — | Текст цитаты (алиасы: `quote`, `body`) |
| `author` | string | — | Автор |
| `role` | string | — | Должность / компания |
| `avatar` | string | — | Картинка автора (URL или локальный файл) |
| `source` | string | — | Название источника |
| `href` | string | — | Ссылка на источник |
| `variant` | enum(plain\|card\|large) | plain | Оформление |

```yaml
- type: quote
  variant: card
  text: "Отчёт, который раньше собирали два дня, теперь готов за час."
  author: "Анна Т."
  role: "Руководитель аналитики"
```

---

## `compare`

Сравнение двух сторон A и B. Алиасы типа: `comparison`, `vs`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `left` * | Side | — | Левая сторона (алиасы: `a`, `before`, `pros`) |
| `right` * | Side | — | Правая сторона (алиасы: `b`, `after`, `cons`) |
| `variant` | enum(vs\|pros-cons\|before-after) | vs | Тона по умолчанию: `vs` — нейтральные обе; `pros-cons` — `pos` / `neg`; `before-after` — `neutral` / `pos` |

**Side fields:** `title`, `badge`, `tone` (`pos` | `neg` | `neutral`, перекрывает тон варианта), `items` (string[], inline-Markdown; маркеры ✓ / ✗ / •) или `body` (Markdown).

```yaml
- type: compare
  variant: pros-cons
  left:
    title: "Плюсы"
    items: ["Быстрая сборка", "Один файл на выходе"]
  right:
    title: "Минусы"
    items: ["Нет iframe"]
```

---

## `feature-matrix`

Матрица возможностей: функции в строках, планы или продукты в столбцах. Алиасы типа: `matrix`, `features`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `columns` * | (string \| Col)[] | — | Столбцы. Col: `name`, `sub`, `badge` |
| `rows` * | Row[] | — | Строки |
| `highlight_col` | number \| string | — | Выделенный столбец (индекс с 0 или имя) |
| `note` | string | — | Примечание под таблицей (общее поле строки `note` — на уровне Row) |
| `caption` | string | — | Заголовок таблицы |

**Row fields:** `feature` * (имя функции), `values` (массив по числу столбцов), `note`; либо `{ group: "Название" }` — строка-подзаголовок группы. Значения: `true` / `false` (или `yes` / `no`) выводятся как ✓ и ✗; пустое, `-` или `—` — прочерк; остальное — inline-Markdown. Строка может быть и массивом `[feature, v1, v2, …]`.

```yaml
- type: feature-matrix
  columns: [Free, { name: Pro, badge: "Хит" }, Team]
  highlight_col: Pro
  rows:
    - { group: "Публикация" }
    - { feature: "Публичные ссылки", values: [true, true, true] }
    - { feature: "Пароль на ссылке", values: [false, true, true] }
    - { feature: "Хранение", values: ["7 дней", "90 дней", "без лимита"] }
```

---

## `buttons`

Ряд кнопок. Алиасы типа: `button`, `cta-row`, `button-row`. Ссылки: `https://…` (в новой вкладке), `#anchor`, `mailto:`, `tel:`; `javascript:` и `data:` отбрасываются, кнопка без допустимого `href` рисуется как статичная.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | Button[] | — | Кнопки (допустим список строк-подписей) |
| `align` | enum(left\|center\|right) | left | Выравнивание ряда |
| `size` | string | — | Размер (например `sm`, `lg`; класс `oa-buttons--<size>`) |

**Button fields:** `label` *, `href`, `variant` (`primary` | `secondary` | `ghost` | `link`; по умолчанию первая — `primary`, остальные — `secondary`), `icon`, `new_tab` (boolean; по умолчанию внешние ссылки открываются в новой вкладке).

```yaml
- type: buttons
  align: center
  items:
    - { label: "Открыть панель", href: "https://example.com/dash", icon: "↗" }
    - { label: "К разделу", href: "#details", variant: ghost }
```

---

## `cta`

Баннер с призывом к действию. Алиас типа: `banner`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `title` * | string | — | Заголовок |
| `body` | string (Markdown) | — | Текст |
| `buttons` | Button[] | — | Кнопки (формат как у `buttons`) |
| `background` | enum(accent\|surface\|accent-soft\|gradient) или картинка | accent | Фон |
| `align` | enum(left\|center\|right) | left | Выравнивание |

```yaml
- type: cta
  title: "Готовы начать?"
  body: "Опубликуйте первый артефакт за минуту."
  align: center
  buttons:
    - { label: "Начать", href: "https://example.com/start" }
```

---

## `embed`

Видео или карточка-ссылка на внешний материал. Алиас типа: `video`. **iframe невозможен**: CSP просмотрщика (`default-src 'none'`, без `frame-src`) блокирует любые встроенные страницы (YouTube, Vimeo, Loom, Figma). Подробнее — в разделе «Ограничения CSP для медиа».

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `src` * | string | — | Для `video` — URL файла (`/af/…` этого инстанса); для `link` — адрес страницы |
| `kind` | enum(video\|link) | авто | Если не задан: `video` для `.mp4 / .webm / .mov / .m4v / .ogv`, иначе `link` |
| `title` | string | провайдер | Заголовок карточки (`link`) |
| `caption` | string (Markdown) | — | Подпись |
| `poster` | string | — | Постер видео (URL или локальный файл) |
| `thumbnail` | string | — | Превью карточки `link`; у YouTube подставляется автоматически (`i.ytimg.com`) |
| `provider` | string | авто | Название сервиса (YouTube, или домен) |
| `aspect` | string | 16:9 | Пропорции |
| `autoplay`, `loop`, `muted` | boolean | false | Флаги `<video>` (`autoplay` включает `muted`) |

`kind: video` работает только с файлами с домена этого инстанса (`/af/…`): локальные файлы не инлайнятся, а чужой домен блокируется `media-src`, о чём сборщик выдаёт предупреждение. `kind: link` рисует карточку с превью и кнопкой Play; ссылка открывается в новой вкладке.

```yaml
- type: embed
  kind: link
  src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  title: "Демо продукта"
  caption: "Открывается на YouTube"

- type: embed
  kind: video
  src: "https://artifacts.example.com/af/abc123"
  poster: "./poster.jpg"
```

---

## `definition-list`

Глоссарий и пары «ключ — значение». Алиасы типа: `glossary`, `key-value`, `facts`, `dl`. Вместо списка `items` принимается обычный mapping `Термин: определение`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | DefItem[] \| mapping | — | Термины |
| `layout` | enum(stacked\|inline\|grid) | stacked | Термин над определением / в одну строку / в две колонки |

**DefItem fields:** `term` * (алиасы: `key`, `name`, `label`), `definition` (inline-Markdown; алиасы: `value`, `description`, `body`).

```yaml
- type: definition-list
  layout: inline
  items:
    ARR: "Annual recurring revenue"
    Churn: "Доля ушедших клиентов за период"
```

---

## `checklist`

Список задач со статусами и итоговым прогрессом. Алиасы типа: `todo`, `tasks`.

| Поле | Тип | Дефолт | Описание |
|------|-----|--------|----------|
| `items` * | CheckItem[] | — | Пункты (допустимы строки: `"[x] сделано"`, `"[ ] нужно"`) |
| `summary` | boolean | false | Счётчик «7 / 10» и прогресс-бар (пункты `skip` не считаются) |
| `title` | string | — | Заголовок списка |

**CheckItem fields:** `label` *, `status` (`done` | `todo` | `blocked` | `skip`) или `checked` (boolean; `true` = `done`), `note`.

```yaml
- type: checklist
  title: "Перед релизом"
  summary: true
  items:
    - { label: "Тесты зелёные", status: done }
    - { label: "Обновить CHANGELOG", status: todo, note: "до пятницы" }
    - { label: "Миграция БД", status: blocked }
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

---

## Ограничения CSP для медиа

Готовый артефакт открывается в sandbox-iframe под CSP инстанса (`packages/shared/src/csp.ts`) с `default-src 'none'`. Для блоков это означает:

| Ресурс | Что разрешено | Следствие |
|--------|---------------|-----------|
| Изображения (`img-src`) | `https:`, `data:` | Любые `https://` URL работают; локальные файлы сборщик инлайнит в base64 (`image`, `gallery`, `slideshow`, `cards`, `quote`, `image-compare`, фоны) |
| Видео (`media-src`) | только файлы этого инстанса (`/af/…`) | `embed kind: video` работает только с загруженными на инстанс файлами; локальные видео не инлайнятся, чужие домены блокируются |
| Фреймы (`frame-src`) | не задан | **iframe невозможен**: YouTube / Vimeo / Loom / Figma не встраиваются. Используйте `embed kind: link` — карточку-превью со ссылкой (превью YouTube берётся с `i.ytimg.com`, разрешённого через `img-src`) |
| Скрипты | inline | Runtime-модули блоков инлайнятся в страницу; внешние только CDN-библиотеки (Chart.js, Mermaid, highlight.js) |
| Ссылки | sandbox с `allow-popups` | Внешние `http(s)` ссылки автоматически получают `target="_blank" rel="noopener noreferrer"`; `javascript:` и `data:` в `href` отбрасываются; `#anchor` работают внутри страницы |
