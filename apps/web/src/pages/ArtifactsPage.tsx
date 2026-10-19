import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ArtifactSummary, type ArtifactThemeId, type OrgDetail } from "../lib/api";
import { ARTIFACT_WIDTH_LABELS, formatDateTime, formatExpiry } from "../lib/labels";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { LifetimeSelect } from "../components/ui/LifetimeSelect";
import { ThemePicker, themeName } from "../components/ThemePicker";
import { ARTIFACT_FONTS } from "../lib/artifactThemes.generated";
import { SearchInput } from "../components/ui/SearchInput";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { MailIcon } from "../components/ui/icons";

const KINDS = ["all", "html", "markdown", "mermaid", "svg"] as const;
const KIND_LABELS: Record<ArtifactSummary["kind"], string> = { html: "HTML", markdown: "Markdown", mermaid: "Mermaid", svg: "SVG" };

export function ArtifactsPage() {
  const { orgId } = useParams();
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [orgDetail, setOrgDetail] = useState<OrgDetail | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"all" | ArtifactSummary["kind"]>("all");

  async function load() {
    if (!orgId) return;
    const [artifactsRes, orgRes] = await Promise.all([
      api.get<{ artifacts: ArtifactSummary[] }>(`/artifacts?orgId=${orgId}`),
      api.get<OrgDetail>(`/orgs/${orgId}`),
    ]);
    setArtifacts(artifactsRes.artifacts);
    setOrgDetail(orgRes);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (!orgId) return null;

  const q = query.trim().toLowerCase();
  const visible = artifacts.filter((a) => (kindFilter === "all" || a.kind === kindFilter) && (!q || a.title.toLowerCase().includes(q)));

  return (
    <>
      <PageHeader
        title="Артефакты"
        action={
          <Button variant={showCreate ? "secondary" : "primary"} onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Отмена" : "Новый артефакт"}
          </Button>
        }
      />

      {showCreate && orgDetail && (
        <CreateArtifactForm
          orgId={orgId}
          maxLifetimeMinutes={orgDetail.effectiveMaxArtifactLifetimeMinutes}
          inheritedTheme={orgDetail.effectiveTheme}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {loaded && artifacts.length === 0 && !showCreate ? (
        <EmptyState
          icon={<MailIcon size={28} />}
          title="Здесь пока пусто"
          description="Создайте первый артефакт вручную, подключите агента, который будет публиковать их за вас, или пригласите коллегу в команду."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => setShowCreate(true)}>Новый артефакт</Button>
              <Link to="/help/agents">
                <Button variant="secondary">Подключить агента</Button>
              </Link>
              <Link to={`/t/${orgId}/settings`}>
                <Button variant="secondary">Пригласить коллегу</Button>
              </Link>
            </div>
          }
        />
      ) : (
        <>
          {artifacts.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <SearchInput value={query} onChange={setQuery} placeholder="Поиск по названию" className="w-full sm:w-72" />
              <div className="flex gap-1 overflow-x-auto">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={kindFilter === k}
                    onClick={() => setKindFilter(k)}
                    className={`whitespace-nowrap rounded-control px-3 py-2 text-[0.9375rem] font-medium transition-colors duration-150 ${
                      kindFilter === k ? "bg-accent text-accent-fg" : "bg-panel-muted text-fg hover:bg-accent-soft"
                    }`}
                  >
                    {k === "all" ? "Все" : KIND_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {visible.length === 0 && artifacts.length > 0 ? (
            <p className="py-10 text-center text-[0.9375rem] text-muted">Ничего не найдено. Измените запрос или фильтр.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {visible.map((a) => (
                <li key={a.id}>
                  <Link
                    to={`/t/${orgId}/artifacts/${a.id}`}
                    className="grid items-center gap-x-6 gap-y-1 rounded-card bg-panel px-5 py-4 transition-colors duration-150 hover:bg-accent-soft md:grid-cols-[minmax(0,1fr)_auto_7rem_11rem]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[1.0625rem] font-semibold tracking-tight text-fg">{a.title}</span>
                      {a.description && <span className="block truncate text-[0.9375rem] text-muted">{a.description}</span>}
                    </span>
                    <span>
                      <Badge>{KIND_LABELS[a.kind]}</Badge>
                    </span>
                    <span className="text-[0.9375rem] text-fg">{a.visibility === "org" ? "Команда" : "Приватный"}</span>
                    <span className="text-[0.9375rem] text-muted md:text-right">
                      {formatDateTime(a.updatedAt)}
                      {a.expiresAt && <span className="block text-[0.8125rem]">Истекает {formatExpiry(a.expiresAt)}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function CreateArtifactForm({
  orgId,
  maxLifetimeMinutes,
  inheritedTheme,
  onCreated,
}: {
  orgId: string;
  maxLifetimeMinutes: number | null;
  /** The theme the artifact gets when none is chosen: the team's, else the service's. */
  inheritedTheme: ArtifactThemeId;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"html" | "markdown" | "mermaid" | "svg">("html");
  const [content, setContent] = useState("<h1>Hello, world</h1>");
  const [lifetime, setLifetime] = useState<number | null>(maxLifetimeMinutes);
  const [theme, setTheme] = useState<ArtifactThemeId | null>(null);
  const [width, setWidth] = useState("");
  const [font, setFont] = useState("");
  const [allowViewerStyle, setAllowViewerStyle] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/artifacts?orgId=${orgId}`, { title, kind, content, visibility: "org", lifetime, theme, width: width || null, font: font || null, lockAppearance: !allowViewerStyle });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <Card className="mb-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Field label="Название" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
        </Field>
        <Field label="Тип">
          <Select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="html">HTML</option>
            <option value="markdown">Markdown</option>
            <option value="mermaid">Mermaid</option>
            <option value="svg">SVG</option>
          </Select>
        </Field>
        <Field label="Содержимое" required>
          <Textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} required />
        </Field>
        <Field label="Срок жизни" hint="После истечения содержимое удаляется безвозвратно.">
          <LifetimeSelect value={lifetime} maxMinutes={maxLifetimeMinutes} onChange={setLifetime} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <p className="text-[0.9375rem] font-medium text-fg">Тема оформления</p>
          <ThemePicker value={theme} onChange={setTheme} inheritLabel={`Сейчас: ${themeName(inheritedTheme)}`} />
          <p className="text-sm text-muted">Применяется к Markdown, Mermaid, SVG и страницам из конструктора. В своём HTML — только к тому, что использует переменные темы.</p>
        </div>
        <Field label="Шрифт" hint="По умолчанию берётся шрифт выбранной темы.">
          <Select value={font} onChange={(e) => setFont(e.target.value)}>
            <option value="">Из темы</option>
            {ARTIFACT_FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Ширина содержимого" hint="Для широких и резиновых страниц длина строки текста ограничена, таблицы и графики занимают всю ширину.">
          <Select value={width} onChange={(e) => setWidth(e.target.value)}>
            {Object.entries(ARTIFACT_WIDTH_LABELS).map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex items-start gap-2 text-[0.9375rem] text-fg">
          <input type="checkbox" className="mt-1" checked={allowViewerStyle} onChange={(e) => setAllowViewerStyle(e.target.checked)} />
          <span>
            Зрители ссылки могут менять оформление
            <span className="block text-sm text-muted">Тему, режим (светлый/тёмный) и ширину — только для себя, в своём браузере. Снимите галочку, если нужен единый вид.</span>
          </span>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="self-start">
          Создать
        </Button>
      </form>
    </Card>
  );
}
