import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Member {
  userId: string;
  email?: string;
  name?: string;
  role: string;
}

export function OrgPage() {
  const { currentOrgId, refresh } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [newOrgName, setNewOrgName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function load() {
    if (!currentOrgId) return;
    const data = await api.get<{ members: Member[] }>(`/orgs/${currentOrgId}/members`);
    setMembers(data.members);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrgId]);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/orgs", { name: newOrgName });
    setNewOrgName("");
    await refresh();
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!currentOrgId) return;
    const res = await api.post<{ token: string }>(`/orgs/${currentOrgId}/invites`, { email: inviteEmail, role: "member" });
    setInviteLink(`${window.location.origin}/register?invite=${res.token}`);
    setInviteEmail("");
  }

  return (
    <div>
      <h2>Команда</h2>

      <div className="card">
        <h3>Создать новую организацию</h3>
        <form onSubmit={createOrg} className="row">
          <input placeholder="Название" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required />
          <button className="btn" type="submit">Создать</button>
        </form>
      </div>

      {currentOrgId && (
        <>
          <div className="card">
            <h3>Пригласить участника</h3>
            <form onSubmit={invite} className="row">
              <input type="email" placeholder="email@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
              <button className="btn" type="submit">Пригласить</button>
            </form>
            {inviteLink && <p className="muted">Ссылка для регистрации: <code>{inviteLink}</code></p>}
          </div>

          <div className="card">
            <h3>Участники</h3>
            <table>
              <thead><tr><th>Имя</th><th>Email</th><th>Роль</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId}><td>{m.name}</td><td>{m.email}</td><td>{m.role}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
