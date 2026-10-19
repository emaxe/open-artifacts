// Generates a local gallery of every artifact theme × colour scheme × content width.
// Pages are produced by the real server renderer (apps/api/src/services/render.ts), so what you see
// is what a viewer gets. Run from apps/api:
//   pnpm exec tsx ../../demo/themes-gallery/build-gallery.mts
// then open demo/themes-gallery/index.html (needs internet for web fonts, mermaid and charts).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderArtifactHtml } from "../../apps/api/src/services/render.ts";
import { ARTIFACT_WIDTHS, listArtifactThemes, type ArtifactThemeId, type ArtifactWidth } from "../../packages/shared/src/index.ts";

const THEMES = listArtifactThemes();
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "../..");
const out = join(here, "pages");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1. Constructor showcase (all blocks), built once with no theme/width: the server adds those.
const showcasePath = join(out, "_showcase.html");
execFileSync("node", [join(root, "skills/open-artifacts/constructor/build.mjs"), join(root, "demo/showcase.yaml"), "--out", showcasePath], { stdio: "ignore" });
const showcase = readFileSync(showcasePath, "utf8");
rmSync(showcasePath);

// 2. Server-rendered kinds.
const markdown = `# Квартальный отчёт

Это пример Markdown-артефакта. Длинный абзац нужен, чтобы увидеть, как ширина страницы влияет на длину строки: в режимах «широкая» и «резиновая» строка ограничена примерно 80 символами, а таблицы и блоки кода занимают всю ширину. Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

## Показатели

| Регион | Выручка | Рост | Churn | NPS | Комментарий |
|--------|---------|------|-------|-----|-------------|
| Европа | $4.2M | +18% | 1.2% | 62 | Основной драйвер: enterprise-расширения и три новых крупных клиента |
| США | $6.8M | +11% | 1.9% | 55 | Рост замедлился из-за сезонности |
| Азия | $2.1M | +34% | 2.4% | 48 | Новый рынок, высокий отток на старте |

> Цитата: хороший отчёт читается так же легко на широком мониторе, как и на телефоне.

### Что сделано

- Запущена тема оформления для артефактов
- Добавлена настройка ширины содержимого
- Обновлены [ссылки](https://example.com) и \`inline code\`

\`\`\`ts
export function resolveTheme(artifact?: string, team?: string, service = "sand") {
  return artifact ?? team ?? service; // artifact → team → service
}
\`\`\`

1. Первый шаг
2. Второй шаг
3. Третий шаг
`;
const mermaid = `graph TD
  A[Артефакт] -->|своя тема?| B{Задана}
  B -->|да| C[Тема артефакта]
  B -->|нет| D{Тема команды?}
  D -->|да| E[Тема команды]
  D -->|нет| F[Тема сервиса]
  C --> G[Отрисовка]
  E --> G
  F --> G`;
const svg = `<svg viewBox="0 0 480 220" xmlns="http://www.w3.org/2000/svg" width="480" height="220">
  <rect x="20" y="120" width="60" height="80" fill="#4f6238"/><rect x="110" y="80" width="60" height="120" fill="#b0741a"/>
  <rect x="200" y="50" width="60" height="150" fill="#3d6a8a"/><rect x="290" y="20" width="60" height="180" fill="#a24a4a"/>
  <line x1="10" y1="200" x2="470" y2="200" stroke="#000" stroke-width="2"/>
  <text x="20" y="215" font-size="12">Q1</text><text x="110" y="215" font-size="12">Q2</text><text x="200" y="215" font-size="12">Q3</text><text x="290" y="215" font-size="12">Q4</text>
</svg>`;
// A hand-written page that defines its own colours: shows the theme does not override a custom design.
const custom = `<!doctype html><html><head><meta charset="utf-8"><style>
:root{--bg:#fff7e6;--fg:#3a2a00;--accent:#d9480f}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.6 Georgia,serif;padding:40px}
h1{color:var(--accent)} .plain{background:var(--surface,#eee);padding:12px;border-radius:var(--radius,0)}
</style></head><body><h1>Свой HTML</h1><p>Страница задаёт --bg, --fg и --accent сама, поэтому тема их не перекрашивает.</p>
<p class="plain">А этот блок берёт var(--surface) и var(--radius), которых страница не задаёт, и получает их из темы.</p></body></html>`;

const KINDS = [
  { id: "showcase", label: "Конструктор (все блоки)", kind: "html" as const, content: showcase, widths: true },
  { id: "markdown", label: "Markdown", kind: "markdown" as const, content: markdown, widths: true },
  { id: "mermaid", label: "Mermaid", kind: "mermaid" as const, content: mermaid, widths: true },
  { id: "svg", label: "SVG", kind: "svg" as const, content: svg, widths: false },
  { id: "custom", label: "Свой HTML", kind: "html" as const, content: custom, widths: false },
];

/** Pins the page to one colour scheme regardless of the OS setting. */
function force(html: string, scheme: "light" | "dark"): string {
  const dark = scheme === "dark";
  return html
    .replace(/\(prefers-color-scheme:\s*dark\)/g, dark ? "all" : "not all")
    .replace(/(?:window\.)?matchMedia\(\s*['"]\(prefers-color-scheme:\s*dark\)['"]\s*\)/g, `({matches:${dark}})`)
    .replace(/color-scheme(:|" content=")light dark/g, `color-scheme$1${scheme}`);
}

let count = 0;
for (const k of KINDS) {
  for (const t of THEMES) {
    for (const w of k.widths ? [...ARTIFACT_WIDTHS] : ["default" as const]) {
      for (const scheme of ["light", "dark"] as const) {
        const width = w === "default" ? null : (w as ArtifactWidth);
        const html = force(renderArtifactHtml(k.kind, k.content, { theme: t.id as ArtifactThemeId, width }), scheme);
        writeFileSync(join(out, `${k.id}.${t.id}.${w}.${scheme}.html`), html);
        count++;
      }
    }
  }
}

const meta = {
  kinds: KINDS.map(({ id, label, widths }) => ({ id, label, widths })),
  themes: THEMES.map(({ id, name, description }) => ({ id, name, description })),
  widths: ARTIFACT_WIDTHS,
};
writeFileSync(join(here, "gallery-data.js"), `window.GALLERY = ${JSON.stringify(meta)};\n`);
console.log(`wrote ${count} pages to ${out}`);
