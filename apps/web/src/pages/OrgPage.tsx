import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";

interface Member {
  userId: string;
  email?: string;
  name?: string;
  role: string;
}

export function OrgPage() {
  const { orgId } = useParams();
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  async function load() {
    if (!orgId) return;
    const data = await api.get<{ members: Member[] }>(`/orgs/${orgId}/members`);
    setMembers(data.members);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    const res = await api.post<{ token: string }>(`/orgs/${orgId}/invites`, { email: inviteEmail, role: "member" });
    setInviteLink(`${window.location.origin}/register?invite=${res.token}`);
    setInviteEmail("");
  }

  async function changeRole(userId: string, role: string) {
    if (!orgId) return;
    await api.patch(`/orgs/${orgId}/members/${userId}`, { role });
    await load();
  }

  if (!orgId) return null;

  return (
    <div>
      <h2>Настройки команды</h2>

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
              <tr key={m.userId}>
                <td>{m.name}</td>
                <td>{m.email}</td>
                <td>
                  <select
                    value={m.role}
                    onChange={(e) => changeRole(m.userId, e.target.value)}
                    style={{ padding: "4px 8px", borderRadius: 4 }}
                  >
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
