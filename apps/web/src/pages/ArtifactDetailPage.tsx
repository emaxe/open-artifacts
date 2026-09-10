import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type ArtifactSummary } from "../lib/api";

interface Version {
  versionNo: number;
  contentHash: string;
  sizeBytes: number;
  message: string | null;
  createdAt: string;
}

interface Share {
  id: string;
  token: string;
  mode: "public" | "password";
  expiresAt: string | null;
  viewCount: number;
  revokedAt: string | null;
  createdAt: string;
}

export function ArtifactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [artifact, setArtifact] = useState<ArtifactSummary | null>(null);
  const [content, setContent] = useState("");
  const [contentHash, setContentHash] = useState("");
  const [versions, setVersions] = useState<Version[]>([]);
  const [shares, setShares] = useState<Share[]>([]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  async function load() {
    if (!id) return;
    const data = await api.get<{ artifact: ArtifactSummary; content: string; contentHash: string }>(`/artifacts/${id}`);
    setArtifact(data.artifact);
    setContent(data.content);
    setContentHash(data.contentHash);
    const v = await api.get<{ versions: Version[] }>(`/artifacts/${id}/versions`);
    setVersions(v.versions);
    const s = await api.get<{ shares: Share[] }>(`/artifacts/${id}/shares`);
    setShares(s.shares);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function saveEdit() {
    setError(null);
    try {
      await api.patch(`/artifacts/${id}`, { content: draft }, { "If-Match": contentHash });
      setEditing(false);
      setPreviewKey((k) => k + 1);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ошибка сохранения");
    }
  }

  async function restore(versionNo: number) {
    await api.post(`/artifacts/${id}/versions/${versionNo}/restore`);
    setPreviewKey((k) => k + 1);
    await load();
  }

  async function createShare(mode: "public" | "password") {
    const password = mode === "password" ? prompt("Пароль для ссылки:") ?? undefined : undefined;
    if (mode === "password" && !password) return;
    const res = await api.post<{ url: string }>(`/artifacts/${id}/shares`, { mode, password });
    await load();
    navigator.clipboard?.writeText(res.url).catch(() => {});
    alert(`Ссылка создана и скопирована в буфер:\n${res.url}`);
  }

  async function revokeShare(shareId: string) {
    await api.delete(`/shares/${shareId}`);
    await load();
  }

  async function remove() {
    if (!confirm("Удалить артефакт?")) return;
    await api.delete(`/artifacts/${id}`);
    navigate("/artifacts");
  }

  if (!artifact) return <p className="muted">Загрузка…</p>;

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{artifact.title}</h2>
        <div className="row">
          <button className="btn secondary" onClick={() => { setDraft(content); setEditing((v) => !v); }}>
            {editing ? "Отмена" : "Редактировать"}
          </button>
          <button className="btn danger" onClick={remove}>Удалить</button>
        </div>
      </div>

      {editing ? (
        <div className="card stack">
          <textarea rows={14} value={draft} onChange={(e) => setDraft(e.target.value)} />
          {error && <div className="error">{error}</div>}
          <button className="btn" onClick={saveEdit}>Сохранить новую версию</button>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, height: 420, overflow: "hidden" }}>
          <iframe
            key={previewKey}
            title="preview"
            src={`/api/v1/artifacts/${id}/preview`}
            sandbox="allow-scripts allow-forms allow-popups allow-modals"
            style={{ width: "100%", height: "100%", border: 0 }}
          />
        </div>
      )}

      <div className="card">
        <h3>Шаринг</h3>
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn secondary" onClick={() => createShare("public")}>Публичная ссылка</button>
          <button className="btn secondary" onClick={() => createShare("password")}>Ссылка с паролем</button>
        </div>
        <table>
          <thead><tr><th>Режим</th><th>Просмотры</th><th>Истекает</th><th></th></tr></thead>
          <tbody>
            {shares.filter((s) => !s.revokedAt).map((s) => (
              <tr key={s.id}>
                <td>{s.mode}</td>
                <td>{s.viewCount}</td>
                <td className="muted">{s.expiresAt ? new Date(s.expiresAt).toLocaleString() : "никогда"}</td>
                <td><button className="btn secondary" onClick={() => revokeShare(s.id)}>Отозвать</button></td>
              </tr>
            ))}
            {shares.filter((s) => !s.revokedAt).length === 0 && <tr><td colSpan={4} className="muted">Нет активных ссылок</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>История версий</h3>
        <table>
          <thead><tr><th>#</th><th>Сообщение</th><th>Размер</th><th>Создана</th><th></th></tr></thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.versionNo}>
                <td>{v.versionNo}</td>
                <td className="muted">{v.message ?? "—"}</td>
                <td className="muted">{v.sizeBytes} байт</td>
                <td className="muted">{new Date(v.createdAt).toLocaleString()}</td>
                <td>{v.versionNo !== versions[0]?.versionNo && <button className="btn secondary" onClick={() => restore(v.versionNo)}>Откатить</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
