import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ArtifactSummary } from "../lib/api";

export function ArtifactsPage() {
  const { orgId } = useParams();
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    if (!orgId) return;
    const data = await api.get<{ artifacts: ArtifactSummary[] }>(`/artifacts?orgId=${orgId}`);
    setArtifacts(data.artifacts);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  if (!orgId) return null;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>Артефакты</h2>
        <button className="btn" onClick={() => setShowCreate((v) => !v)}>{showCreate ? "Отмена" : "Новый артефакт"}</button>
      </div>

      {showCreate && (
        <CreateArtifactForm
          orgId={orgId}
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      <div className="card">
        <table>
          <thead>
            <tr><th>Название</th><th>Тип</th><th>Видимость</th><th>Обновлён</th></tr>
          </thead>
          <tbody>
            {artifacts.map((a) => (
              <tr key={a.id}>
                <td><Link to={`/t/${orgId}/artifacts/${a.id}`}>{a.title}</Link></td>
                <td><span className="badge">{a.kind}</span></td>
                <td>{a.visibility === "org" ? "команда" : "приватный"}</td>
                <td className="muted">{new Date(a.updatedAt).toLocaleString()}</td>
              </tr>
            ))}
            {artifacts.length === 0 && (
              <tr><td colSpan={4} className="muted">Пока пусто</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
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
    <form onSubmit={onSubmit} className="card stack">
      <input placeholder="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
      <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
        <option value="html">HTML</option>
        <option value="markdown">Markdown</option>
        <option value="mermaid">Mermaid</option>
        <option value="svg">SVG</option>
      </select>
      <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} required />
      {error && <div className="error">{error}</div>}
      <button className="btn" type="submit">Создать</button>
    </form>
  );
}
