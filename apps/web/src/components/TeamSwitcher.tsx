import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function TeamSwitcher() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const { orgId } = useParams();
  const location = useLocation();

  if (!me) return null;

  return (
    <div style={{ marginTop: 12 }}>
      <label className="muted" style={{ display: "block", fontSize: "0.85em", marginBottom: 4 }}>
        Текущая команда
      </label>
      <select
        value={orgId ?? ""}
        onChange={(e) => {
          const newOrgId = e.target.value;
          if (!newOrgId) return;
          if (orgId && location.pathname.startsWith(`/t/${orgId}/`)) {
            const subpath = location.pathname.slice(`/t/${orgId}`.length);
            navigate(`/t/${newOrgId}${subpath}`);
          } else {
            navigate(`/t/${newOrgId}`);
          }
        }}
        style={{ width: "100%", padding: "8px", borderRadius: "4px" }}
      >
        <option value="" disabled>Выберите команду</option>
        {me.orgs.map((o) => (
          <option key={o.orgId} value={o.orgId}>
            {o.name || o.orgId.slice(0, 8)}
          </option>
        ))}
      </select>
    </div>
  );
}
