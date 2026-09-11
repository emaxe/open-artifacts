import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth";

interface Org {
  id: string;
  name: string;
  role: string | null;
  memberCount: number;
}

export function TeamsPage() {
  const { refresh } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [newOrgName, setNewOrgName] = useState("");

  async function load() {
    const data = await api.get<{ orgs: Org[] }>("/orgs");
    setOrgs(data.orgs);
  }

  useEffect(() => {
    load();
  }, []);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/orgs", { name: newOrgName });
    setNewOrgName("");
    await load();
    await refresh();
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 24 }}>
        <h2>Команды</h2>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h3>Создать новую команду</h3>
        <form onSubmit={createOrg} className="row">
          <input placeholder="Название" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required />
          <button className="btn" type="submit">Создать</button>
        </form>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr><th>Название</th><th>Роль</th><th>Участники</th></tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id}>
                <td><Link to={`/t/${o.id}`}>{o.name}</Link></td>
                <td>{o.role || "—"}</td>
                <td>{o.memberCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
