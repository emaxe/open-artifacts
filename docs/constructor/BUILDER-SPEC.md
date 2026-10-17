# Builder Script Specification — `build.mjs`

Детальная спецификация скрипта-сборщика артефактов.

---

## Расположение

```
skills/open-artifacts/constructor/build.mjs
```

Запускается напрямую через Node.js — никаких сборщиков, никакого `package.json` в папке конструктора.

---

## Зависимости

| Пакет | Зачем | Как подключается |
|-------|-------|------------------|
| `js-yaml` | Парсинг YAML-спецификации | `npm install -g js-yaml` или через `node_modules` проекта |
| `marked` | Markdown → HTML для полей `body` | Аналогично |
| `fs`, `path`, `url` | Встроенные Node.js модули | — |
| `child_process` | Запуск `oa push` | Встроенный |

> **Примечание:** если `js-yaml` или `marked` недоступны глобально, `build.mjs` пробует `require` из ближайшего `node_modules` (crawl up), и если не находит — fallback: YAML через встроенный мини-парсер, Markdown как plain text.

---

## CLI-интерфейс

```
Usage: node build.mjs <spec.yaml> [options]

Arguments:
  spec.yaml                Path to YAML specification file

Options:
  --out <file>             Output HTML file path (default: <spec-basename>.html)
  --push                   Push to Open Artifacts after build
  --share                  Create a share link after push (implies --push)
  --title <title>          Override artifact title for oa push
  --org <slug>             Override org for oa push
  --lifetime <duration>    Lifetime for oa push (e.g. 7d, 12h)
  --public                 Create public share link
  --password <pwd>         Create password-protected share link
  --themes-dir <path>      Path to themes directory (default: ./themes)
  --blocks-dir <path>      Path to blocks directory (default: ./blocks)
  --verbose                Print debug info
  --help                   Show this help
```

---

## Алгоритм выполнения

```
build.mjs <spec.yaml>
│
├─ 1. PARSE ARGS
│   └─ Читает argv, выставляет defaults
│
├─ 2. LOAD SPEC
│   ├─ fs.readFileSync(specPath)
│   └─ yaml.load(content) → spec object
│       Валидация:
│         если spec.source — проверяем что файл существует
│         если spec.blocks — проверяем что массив, каждый block.type string
│
├─ 3. RESOLVE PATHS
│   ├─ themesDir = args['--themes-dir'] || path.join(import.meta.dirname, 'themes')
│   ├─ blocksDir = args['--blocks-dir'] || path.join(import.meta.dirname, 'blocks')
│   └─ specDir  = path.dirname(path.resolve(specPath))  ← база для relative paths
│
├─ 4. PASSTHROUGH MODE (если spec.source задан)
│   ├─ mdPath = resolve(spec.source, relative to specDir)
│   ├─ rawMd  = fs.readFileSync(mdPath, 'utf8')
│   ├─ rawMd  = stripFrontmatter(rawMd)  ← убираем ---...--- автоматически
│   ├─ bodyHtml = `<article class="markdown-body">${marked.parse(rawMd)}</article>`
│   └─ Переходим сразу к шагу 7 (CSS нужен, CDN-скрипты не нужны)
│
├─ 5. LOAD CSS
│   ├─ defaultCss = fs.readFileSync(themesDir/default.css)
│   ├─ theme = spec.theme || 'default'
│   ├─ if theme !== 'default': themeCss = fs.readFileSync(themesDir/${theme}.css)
│   └─ combinedCss = defaultCss + '\n' + (themeCss || '')
│       + collectRawCss(spec.blocks)  ← CSS из raw-блоков
│
├─ 6. COLLECT CDN SCRIPTS
│   ├─ Сканирует все блоки и определяет нужные CDN-скрипты
│   │   chart-bar | chart-line | chart-pie → Chart.js
│   │   mermaid-diagram → Mermaid.js
│   │   code-block → highlight.js (если есть хотя бы один)
│   │   raw.cdn_scripts → добавляются напрямую
│   ├─ Обход идёт через walkBlocks, то есть захватывает вложенные блоки на любой глубине
│   ├─ Заодно собирает runtime-модули (lightbox, slideshow, accordion, …) — см. «Runtime-модули»
│   └─ Дедуплицирует (Chart.js подключается один раз даже если 3 графика)
│
├─ 7. RENDER BLOCKS
│   ├─ Для каждого block в spec.blocks:
│   │   ├─ if block.type === 'markdown':
│   │   │   └─ html = `<div class="markdown-body ${block.class||''}">`
│   │   │            + marked.parse(block.content) + `</div>`
│   │   │
│   │   ├─ if block.type === 'markdown-file':
│   │   │   ├─ mdPath = resolve(block.path, relative to specDir)
│   │   │   ├─ rawMd  = fs.readFileSync(mdPath, 'utf8')
│   │   │   ├─ if block.strip_frontmatter !== false: rawMd = stripFrontmatter(rawMd)
│   │   │   └─ html = `<div class="markdown-body ${block.class||''}">`
│   │   │            + marked.parse(rawMd) + `</div>`
│   │   │
│   │   ├─ Иначе:
│   │   │   ├─ templatePath = blocksDir/${block.type}.html
│   │   │   ├─ if !exists → throw Error(`Unknown block type: ${block.type}`)
│   │   │   ├─ template = fs.readFileSync(templatePath)
│   │   │   └─ html = renderTemplate(template, block)
│   │   │
│   │   ├─ html = injectRootAttrs(html, id/class/width/spacing/hide/span)  ← общие поля
│   │   │
│   │   │
│   │   └─ Добавляем html в bodyParts[]
│   └─ bodyHtml = bodyParts.join('\n')
│
├─ 8. COLLECT INLINE SCRIPTS
│   └─ Сканирует raw-блоки на поле `scripts`, собирает в один <script>
│
├─ 9. ASSEMBLE HTML
│   └─ Собирает финальный HTML из skeleton:
│       <!doctype html>
│       <html lang="{lang}">
│       <head>
│         <meta charset="utf-8">
│         <meta name="viewport" ...>
│         <meta name="color-scheme" content="light dark">
│         <title>{title}</title>
│         {cdnScripts (в head, если нужны до body)}
│         <style>{combinedCss}</style>
│       </head>
│       <body>
│         <main>
│           {bodyHtml}
│         </main>
│         {cdnScripts (в конце body, для Chart.js/hljs)}
│         {inlineScripts}
│       </body>
│       </html>
│
├─ 10. WRITE OUTPUT
│   └─ fs.writeFileSync(outPath, html)
│       Печатает: ✓ Built: output.html (14.2 KB)
│
└─ 11. PUSH (if --push or --share)
    ├─ child_process.execSync(`oa push ${outPath} --title "${title}" ${shareFlags}`)
    └─ Печатает URL из stdout oa push
```

---

## Шаблонизатор

Простой микро-шаблонизатор, встроенный в build.mjs. Никаких внешних зависимостей.

### Синтаксис

```
{{var}}          →  HTML-экранированное значение поля
{{{var}}}        →  сырое HTML-значение (без экранирования)
{{#if cond}}...{{/if}}       →  условный блок
{{#each items}}...{{/each}}  →  цикл, внутри доступны {{this.field}}
{{#color color}}             →  маппинг color-токена в CSS-переменную
```

### Пример шаблона `blocks/kpi-row.html`

```html
<section class="kpi-row" style="--cols: {{cols_or_auto}}">
  {{#each items}}
  <div class="kpi-tile">
    {{#if this.icon}}<span class="kpi-icon" aria-hidden="true">{{this.icon}}</span>{{/if}}
    <div class="kpi-label">{{this.label}}</div>
    <div class="kpi-value">{{this.value}}{{#if this.suffix}}<span class="kpi-suffix">{{this.suffix}}</span>{{/if}}</div>
    {{#if this.delta}}
    <div class="kpi-delta kpi-delta--{{this.trend}}">{{this.delta}}</div>
    {{/if}}
  </div>
  {{/each}}
</section>
```

### Функция renderTemplate

```javascript
function renderTemplate(template, data) {
  let html = template;

  // {{{raw}}} — без экранирования
  html = html.replace(/\{\{\{(\w[\w.]*)\}\}\}/g, (_, key) => get(data, key) ?? '');

  // {{#if cond}}...{{/if}}
  html = html.replace(/\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, inner) =>
    get(data, key) ? inner : ''
  );

  // {{#each arr}}...{{/each}}
  html = html.replace(/\{\{#each (\w+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, inner) => {
    const arr = get(data, key) ?? [];
    return arr.map(item => renderTemplate(inner, item)).join('');
  });

  // {{var}} — с HTML-экранированием
  html = html.replace(/\{\{([\w.]+)\}\}/g, (_, key) => escape(get(data, key) ?? ''));

  return html;
}

function escape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function get(obj, path) {
  return path.split('.').reduce((o, k) => o?.[k], obj);
}
```

---

## Специальная обработка блоков

### `chart-*` блоки

Chart.js инициализируется через inline `<script>` который рендерится из данных блока:

```javascript
// Встраивается в шаблон chart-bar.html
new Chart(document.getElementById('chart-{{id}}'), {
  type: 'bar',
  data: {
    labels: {{{labels_json}}},
    datasets: {{{datasets_json}}}
  },
  options: {{{options_json}}}
});
```

- `id` генерируется как `chart-N` (N = порядковый номер в документе)
- `datasets_json` — colors маппятся: `c1` → `getComputedStyle(root).getPropertyValue('--c1')`
- Chart.js читает CSS-переменные через `getComputedStyle` в `beforeInit` plugin для поддержки dark mode

### `mermaid-diagram` блок

```html
<figure class="mermaid-figure">
  <div class="mermaid">
    {{{definition}}}
  </div>
  {{#if caption}}<figcaption>{{caption}}</figcaption>{{/if}}
</figure>
```

Mermaid.js подключается один раз в конце body и вызывает `mermaid.initialize({ startOnLoad: true })`.

### `text-section` блок

Поле `body` прогоняется через `marked.parse()` на этапе сборки (не в браузере):

```javascript
// В renderTemplate, специальная обработка для text-section
if (block.type === 'text-section' && block.body) {
  block._body_html = marked.parse(block.body);
}
```

Шаблон использует `{{{_body_html}}}` (без экранирования).

### `markdown` блок

Самый простой случай — контент уже в YAML, никаких файлов читать не нужно:

```javascript
if (block.type === 'markdown') {
  const html = marked.parse(block.content ?? '');
  const cls = block.class ? ` ${block.class}` : '';
  return `<div class="markdown-body${cls}">\n${html}\n</div>`;
}
```

### `markdown-file` блок

```javascript
if (block.type === 'markdown-file') {
  const mdPath = path.resolve(specDir, block.path);
  let rawMd = fs.readFileSync(mdPath, 'utf8');
  if (block.strip_frontmatter !== false) {
    rawMd = stripFrontmatter(rawMd);
  }
  const html = marked.parse(rawMd);
  const cls = block.class ? ` ${block.class}` : '';
  return `<div class="markdown-body${cls}">\n${html}\n</div>`;
}
```

### Функция `stripFrontmatter`

Используется в passthrough mode и в `markdown-file` блоках:

```javascript
function stripFrontmatter(md) {
  // Убирает YAML frontmatter: блок между двумя строками "---" в начале файла
  return md.replace(/^---[\s\S]*?^---\s*\n?/m, '').trimStart();
}
```

### `raw` блок

```html
<!-- raw block CSS вставляется в <style> в head -->
<!-- raw block scripts вставляются в <script> перед </body> -->
<div class="raw-block">
  {{{html}}}
</div>
```

---

## Дерево блоков, общие поля, якоря и runtime (0.13)

### Обобщённое дерево блоков

Вложенность описана одной таблицей `CHILD_SPEC` (в `build.mjs`): для каждого типа указано, где лежат дочерние блоки — собственные массивы (`own`: `left`/`right` у `two-columns`, `blocks` у `section` / `grid` / `stack`) или массивы `blocks` внутри элементов `items` (`items`: `tabs`, `accordion`, `steps`, `slideshow`, `cards`).

```
CHILD_SPEC  →  childSlots(block)  →  walkBlocks(blocks, visit)
```

- `childSlots(b)` возвращает список слотов `{ obj, key, label }` с дочерними массивами блока.
- `walkBlocks(blocks, visit)` рекурсивно обходит дерево в порядке документа.
- Через них работают: рекурсивная нормализация и валидация (`normalizeAndValidateBlock`, путь ошибки вида `Block #3 (blocks) → Block #2`), сборщик потребностей `collectNeeds` и резервирование явных `id`. Ручных веток под `two-columns` / `tabs` нет: чтобы новый контейнер заработал на любой глубине, достаточно добавить запись в `CHILD_SPEC` и шаблон.
- Рендер дочерних блоков — `renderKids(list, ctx)`: вызывает `renderBlockList` и результат «экранирует» функцией `shield`.

### Общие поля и `injectRootAttrs`

`COMMON_FIELDS` (`id`, `class`, `width`, `spacing`, `hide`, `span`, `row_span`, `toc_label`, `toc_level`) добавляется к `canonical` каждого типа, поэтому валидатор не считает их неизвестными. После рендера шаблона `renderBlock` вызывает `rootAttrsFor(block)` (собирает id, классы `oa-w-*` / `oa-hide-*` / пользовательские, inline-стиль для `spacing` и `span` / `row_span`) и `injectRootAttrs(html, attrs)`, которая дописывает атрибуты в **первый реальный тег** результата. Обёрток нет — существующие селекторы не меняются. Если у корневого тега уже есть собственный `id`, а в блоке задан другой, перед блоком вставляется `<a class="oa-anchor" id="…">`. Тот же механизм работает для `markdown` / `markdown-file`.

Исключение: у `image` поле `width` — CSS-ширина самой картинки, а не класс `oa-w-*`.

### Реестр якорей и двухпроходное оглавление

На сборку создаётся состояние `STATE` (`resetState(spec)` в начале `main()`): счётчики `uid(prefix)` (вместо отдельных `_chartIdx` / `_tabIdx`), множество занятых id, реестр `headings[]`, список конфигураций `tocs[]`, набор runtime-модулей, предупреждения.

1. **Reserve.** До рендера `walkBlocks` резервирует все явные `id` из spec.
2. **Anchor assign.** `assignAnchor(block)` перед рендером даёт id заголовкам `hero` (уровень 1), `text-section` и `section` (`level`) и блокам с `toc_label` / `anchor.label`; `uniqueId` делает slug (`slugify`: транслитерация кириллицы, латиница, дефисы) и добавляет суффикс `-2`, `-3` при повторе. Заголовки Markdown обрабатывает `addHeadingIds`: проставляет `id` на `<h1>…<h6>` и регистрирует их в `headings[]`.
3. **Placeholder.** Блок `toc` на первом проходе кладёт в `STATE.tocs` свою конфигурацию (`variant`, `include`, `min_level`, `depth`, `numbered`) и выводит заглушку `<!--OA_TOC_LIST:n-->`.
4. **Fill.** После рендера всех блоков `renderTocLists(bodyHtml)` заменяет заглушки списками `<ol class="oa-toc__list">`, отфильтровав реестр по конфигурации (поэтому оглавление видит заголовки ниже себя). Для `sticky` остаются только пункты уровня `min_level`.
5. **Sidebar CSS.** Если есть `toc` с `variant: sidebar`, к CSS дописывается media query с `min-width = ширина main + 2 × (240 + 24) px`: боковая колонка закрепляется слева от `main` только когда хватает места; иначе остаётся inline.

### Spec-level опции

| Поле spec | Эффект |
|-----------|--------|
| `width: narrow\|normal\|wide\|<px>` | Ширина колонки `main`: 720 / 920 (по умолчанию) / 1200 px или число; записывается в CSS-переменную `--oa-main-w` (на `<main>` через `mainStyle`). Неверное значение — предупреждение и игнорирование |
| `heading_links` (по умолчанию `true`) | Если `false`, runtime-модуль `anchors` не добавляет ссылки «#» к заголовкам |
| `back_to_top` (по умолчанию `false`) | После `<main>` выводится `<a class="oa-top" hidden>`, модуль `anchors` показывает его при прокрутке |
| `lang` | Язык служебных подписей (оглавление, слайдшоу, «Наверх») |

### Runtime-модули

JS блоков живёт в `constructor/runtime/*.js`, а не в шаблонах. Модули: `core` (`__oaReady`, `__oaReveal` — дорисовка графиков и Mermaid в только что показанных панелях), `lightbox`, `slideshow`, `accordion`, `compare` (`image-compare`), `toc`, `anchors` (ссылки «#» и «наверх»).

```
collectNeeds(blocks)  →  needs.runtime : Set<string>
        ↓  (+ 'anchors' при heading_links и наличии заголовков, либо back_to_top)
loadRuntime(names, runtimeDir)  →  string[]   // порядок фиксирован RUNTIME_ORDER, 'core' добавляется всегда
        ↓
inlineScripts = [...runtimeScripts, ...rawScripts]  →  один <script> перед </body>
```

- `collectNeeds` (развитие прежнего `collectCdnNeeds`) через `walkBlocks` возвращает CDN-флаги (`chartjs`, `mermaid`, `hljs`), CSS / скрипты / CDN-ссылки из `raw` и множество runtime-модулей: `lightbox` — при `zoomable` у `image`, `slideshow`, элементов `cards` и по умолчанию у `gallery`; `slideshow`, `accordion`, `compare` — по типу блока; `toc` — только для `sticky` / `sidebar`; `core` — для `tabs`.
- Каждый модуль вставляется в страницу один раз и только если нужен: без `zoomable` lightbox в HTML нет. Каждый модуль завёрнут в комментарий `/* oa-runtime: name */` и защищён от повторной инициализации.
- Модули не используют внешних библиотек и сети (CSP: только inline-скрипты).

### `shield` / `unshield` для HTML дочерних блоков

Шаблонизатор повторно сканирует результат на `{{ … }}`. HTML, уже отрендеренный дочерним блоком или Markdown'ом (и содержащий, например, `{{x}}` в блоке кода), при вставке в родительский шаблон проходит через `shield` (`{{` → `{`, `}}` → `}`), а готовый HTML шаблона возвращается обратно через `unshield` (`{` → `{{`). Так фигурные скобки из пользовательского контента доходят до страницы без изменений и не интерпретируются как теги шаблона. Правило для новых блоков: любой вставляемый в шаблон готовый HTML (`_*_html`) передавайте через `shield(…)` / `renderKids` / `mdb`, а в шаблоне выводите тройными скобками `{{{ }}}`.

### Прочее в 0.13

- `resolveImageSrc(src, specDir)` — инлайн локального файла в `data:` URI (image, gallery, slideshow, cards, quote, image-compare, фоны section / cta).
- `safeHref(href)` отбрасывает `javascript:`, `data:` и другие схемы, кроме `http(s)`, `mailto:`, `tel:`; `linkAttrs(href, newTab)` добавляет `target="_blank" rel="noopener noreferrer"` внешним `http(s)` ссылкам (артефакт живёт в sandbox-iframe).
- `sparklineSvg(values)` — inline SVG для `spark` в `kpi-row` / `stats-grid`.
- Алиасы типов блоков: `BLOCK_TYPE_ALIASES` (карта «синоним → тип»), а также `resolveLegacyType` для имён, у которых значение менялось: `grid` с `items` и без `blocks` → `stats-grid`, `columns` → `grid` (если есть `blocks`) или `two-columns`, `section` без `blocks`, но с `body` / `text` → `text-section`.
- Блок может определить `warn(b)` — не фатальные предупреждения (например, `embed video` с чужого домена).

---

## Валидация спецификации и обработка ошибок

Сборщик `build.mjs` выполняет предварительную валидацию спецификации перед сборкой:
1. **Model-friendly aliases**: автоматически маппит распространенные синонимы полей (например `variant` → `kind`, `text` → `body`, `headers` → `columns`, `code` → `definition`).
2. **Семантическая проверка пустоты**: блоки, лишенные смыслового контента (например, `alert` без `body`/`text` и без `title`), отклоняются с кодом 1, чтобы избежать публикации пустых значков.
3. **Did you mean?**: при опечатках в свойствах сборщик вычисляет расстояние Левенштейна и подсказывает правильное имя.
4. **Флаги строгости**:
   - `--strict`: трактовать любые неизвестные свойства как фатальные ошибки (exit 1).
   - `--lenient`: игнорировать ошибки валидации и продолжать сборку.

| Ситуация | Поведение |
|----------|-----------| 
| Файл спецификации не найден | `Error: spec file not found: path/to/spec.yaml` → exit 1 |
| Невалидный YAML / JSON | `Error: YAML/JSON parse error: <message>` → exit 1 |
| Ошибка валидации структуры (пустой alert, нет обязательных полей) | `❌ Spec validation failed: [Block #N]: ...` → exit 1 |
| Неизвестное свойство блока | Предупреждение + предложение "Did you mean?" (в `--strict` режиме → exit 1) |
| Использование синонимов (`variant` вместо `kind`, `text` вместо `body`) | Автоматический маппинг в каноническое поле + лог `ℹ Spec: auto-mapped N alias(es)` |
| `spec.source` файл не найден | `Error: source file not found: path/to/report.md` → exit 1 |
| `markdown-file` файл не найден | `Error: markdown-file not found: path/to/file.md (block #N)` → exit 1 |
| Неизвестный тип блока | `❌ Spec validation failed: Unknown block type "xyz"` + предложение похожих → exit 1 |
| Нефатальное предупреждение блока (`warn`, например `embed video` с чужого домена) | В списке `⚠️ Spec warnings`, сборка продолжается |
| Шаблон блока не найден | `Error: Template not found: blocks/xyz.html` → exit 1 |
| `oa push` завершился с ошибкой | Выводит stderr oa и exit 1 |
| `--share` без `--push` | Автоматически добавляет `--push` |

---

## Интеграция с `oa` CLI

```javascript
// Шаг 10: push + share
const titleFlag = title ? `--title "${title.replace(/"/g, '\\"')}"` : '';
const orgFlag = org ? `--org ${org}` : '';
const shareFlag = args['--share'] ? '--share' : '';
const publicFlag = args['--public'] ? '--public' : '';
const passwordFlag = args['--password'] ? `--password "${args['--password']}"` : '';
const lifetimeFlag = args['--lifetime'] ? `--lifetime ${args['--lifetime']}` : '';

const cmd = `oa push ${outPath} ${titleFlag} ${orgFlag} ${shareFlag} ${publicFlag} ${passwordFlag} ${lifetimeFlag}`;

const result = execSync(cmd, { encoding: 'utf8' });
console.log(result);
```

---

## Выходной артефакт

Финальный HTML:
- Полностью самодостаточный (нет внешних CSS-файлов)
- Проходит все CSP-ограничения Open Artifacts (только cdnjs/jsdelivr скрипты)
- Dark mode через `@media (prefers-color-scheme: dark)` — без JS-переключателя
- Print-ready (правила из default.css)
- Responsive начиная с 400px
- WCAG AA по контрасту

---

## Пример полного запуска агентом

```bash
# 1. Агент создаёт спецификацию
cat > /tmp/q3-report.yaml << 'EOF'
title: "Q3 Revenue Report"
theme: data
blocks:
  - type: hero
    title: "Q3 Revenue Report"
    subtitle: "July – September 2026"
  - type: kpi-row
    items:
      - label: Revenue
        value: "$4.2M"
        delta: "+18%"
        trend: up
EOF

# 2. Агент запускает сборщик
node skills/open-artifacts/constructor/build.mjs /tmp/q3-report.yaml --share

# 3. Сборщик выводит:
# ✓ Built: q3-report.html (8.4 KB)
# ✓ Pushed: artifact-id abc123
# Share URL: https://artifacts.example.com/s/xyz789 (mode: team)
```
