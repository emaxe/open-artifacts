import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { api, type OrgListItem } from "../lib/api";
import { OrgIdentity, type OrgRef } from "./OrgIdentity";
import { SearchInput } from "./ui/SearchInput";
import { ChevronDownIcon, PlusIcon } from "./ui/icons";

/**
 * A searchable popover instead of a bare native <select>. `me.orgs` (own memberships) covers the
 * common case instantly; a superadmin additionally gets a live server search across every org in
 * the instance — the same GET /orgs?search= the admin Teams table uses — since their own
 * memberships no longer include orgs they don't belong to (see routes/auth.ts's /auth/me).
 */
export function TeamSwitcher() {
  const { me } = useAuth();
  const navigate = useNavigate();
  const { orgId } = useParams();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [instanceResults, setInstanceResults] = useState<OrgListItem[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !me?.isSuperadmin) return;
    api
      .get<{ orgs: OrgListItem[] }>(`/orgs?search=${encodeURIComponent(search)}&pageSize=8`)
      .then((res) => setInstanceResults(res.orgs))
      .catch(() => setInstanceResults([]));
  }, [open, search, me?.isSuperadmin]);

  if (!me) return null;

  const current = me.orgs.find((o) => o.orgId === orgId);
  const query = search.trim().toLowerCase();
  const own = me.orgs.filter((o) => !query || o.name.toLowerCase().includes(query) || o.slug.toLowerCase().includes(query));
  const toRef = (o: (typeof me.orgs)[number]): OrgRef => ({ id: o.orgId, name: o.name, slug: o.slug, kind: o.kind });
  const mainOrgs = own.filter((o) => o.kind === "main").map(toRef);
  const teamOrgs = own.filter((o) => o.kind === "team").map(toRef);
  const ownIds = new Set(me.orgs.map((o) => o.orgId));
  // Own orgs already cover these — don't show them twice in the instance-wide search results.
  const instanceOnly: OrgRef[] = (instanceResults ?? [])
    .filter((o) => !ownIds.has(o.id))
    .map((o) => ({ id: o.id, name: o.name, slug: o.slug, kind: o.kind, ownerEmail: o.owner?.email }));

  function goTo(newOrgId: string) {
    setOpen(false);
    setSearch("");
    if (orgId && location.pathname.startsWith(`/t/${orgId}/`)) {
      navigate(`/t/${newOrgId}${location.pathname.slice(`/t/${orgId}`.length)}`);
    } else {
      navigate(`/t/${newOrgId}`);
    }
  }

  return (
    <div ref={containerRef} className="relative mt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-control border border-border bg-panel px-2.5 py-2 text-left hover:bg-panel-muted"
      >
        {current ? (
          <OrgIdentity org={{ id: current.orgId, name: current.name, slug: current.slug, kind: current.kind }} size="sm" secondary="none" />
        ) : (
          <span className="text-sm text-muted">Выберите команду</span>
        )}
        <ChevronDownIcon size={14} className="shrink-0 text-muted" />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-96 overflow-y-auto rounded-control border border-border bg-panel p-2 shadow-lg">
          <SearchInput value={search} onChange={setSearch} placeholder="Поиск команды…" debounceMs={200} className="mb-2" />

          <OrgGroup label="Основное" orgs={mainOrgs} onSelect={goTo} />
          <OrgGroup label="Мои команды" orgs={teamOrgs} onSelect={goTo} />
          {me.isSuperadmin && <OrgGroup label="Все команды инстанса" orgs={instanceOnly} onSelect={goTo} showSecondary />}

          {mainOrgs.length === 0 && teamOrgs.length === 0 && instanceOnly.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted">Ничего не найдено</p>
          )}

          <Link
            to="/teams"
            onClick={() => setOpen(false)}
            className="mt-1 flex items-center gap-1.5 rounded-control px-2 py-1.5 text-xs font-medium text-muted hover:bg-panel-muted hover:text-fg"
          >
            <PlusIcon size={13} /> Создать команду
          </Link>
        </div>
      )}
    </div>
  );
}

function OrgGroup({
  label,
  orgs,
  onSelect,
  showSecondary,
}: {
  label: string;
  orgs: OrgRef[];
  onSelect: (id: string) => void;
  showSecondary?: boolean;
}) {
  if (orgs.length === 0) return null;
  return (
    <div className="mb-2 last:mb-0">
      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
      {orgs.map((ref) => (
        <button
          key={ref.id}
          type="button"
          onClick={() => onSelect(ref.id)}
          className="flex w-full items-center rounded-control px-2 py-1.5 text-left hover:bg-panel-muted"
        >
          <OrgIdentity org={ref} size="sm" secondary={showSecondary ? undefined : "none"} />
        </button>
      ))}
    </div>
  );
}
