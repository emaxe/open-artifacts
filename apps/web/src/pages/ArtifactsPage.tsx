import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ArtifactSummary } from "../lib/api";
import { formatDateTime } from "../lib/labels";
import { PageHeader } from "../components/ui/PageHeader";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input, Select, Textarea } from "../components/ui/Input";
import { Field } from "../components/ui/Field";
import { Table, THead, TBody, TR, TH, TD } from "../components/ui/Table";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/ui/EmptyState";
import { MailIcon } from "../components/ui/icons";

export function ArtifactsPage() {
  const { orgId } = useParams();
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    if (!orgId) return;
    const data = await api.get<{ artifacts: ArtifactSummary[] }>(`/artifacts?orgId=${orgId}`);
    setArtifacts(data.artifacts);
    setLoaded(true);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (!orgId) return null;

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

      {showCreate && (
        <CreateArtifactForm
          orgId={orgId}
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
            <div className="flex gap-2">
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
        <Card className="p-0">
          <Table>
            <THead>
              <TR>
                <TH>Название</TH>
                <TH>Тип</TH>
                <TH>Видимость</TH>
                <TH>Обновлён</TH>
              </TR>
            </THead>
            <TBody>
              {artifacts.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <Link to={`/t/${orgId}/artifacts/${a.id}`} className="font-medium text-fg hover:underline">
                      {a.title}
                    </Link>
                  </TD>
                  <TD>
                    <Badge>{a.kind}</Badge>
                  </TD>
                  <TD>{a.visibility === "org" ? "команда" : "приватный"}</TD>
                  <TD className="text-muted">{formatDateTime(a.updatedAt)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}
    </>
  );
}

function CreateArtifactForm({ orgId, onCreated }: { orgId: string; onCreated: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"html" | "markdown" | "mermaid" | "svg">("html");
  const [content, setContent] = useState("<h1>Hello, world</h1>");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.post(`/artifacts?orgId=${orgId}`, { title, kind, content, visibility: "private" });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка");
    }
  }

  return (
    <Card className="mb-4">
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
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" className="self-start">
          Создать
        </Button>
      </form>
    </Card>
  );
}
