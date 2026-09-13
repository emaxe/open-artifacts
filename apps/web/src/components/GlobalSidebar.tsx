import { NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTheme, type ThemePreference } from "../lib/theme";
import { TeamSwitcher } from "./TeamSwitcher";
import { LogoMark } from "./Logo";
import { Badge } from "./ui/Badge";
import { cn } from "../lib/cn";
import { LogOutIcon, MailIcon, SettingsIcon, ShieldIcon, UsersIcon } from "./ui/icons";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Светлая" },
  { value: "system", label: "Системная" },
  { value: "dark", label: "Тёмная" },
];

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 rounded-control px-2.5 py-2 text-sm font-medium",
    isActive ? "bg-panel-muted text-fg" : "text-muted hover:bg-panel-muted hover:text-fg",
  );

/** The sidebar's nav content — rendered as a fixed desktop rail by Layout, and reused inside the mobile drawer's Dialog so there's exactly one nav to keep in sync. */
export function GlobalSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { me, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  if (!me) return null;

  return (
    <div className="flex h-full flex-col p-4">
      <h1 className="mb-1 flex items-center gap-2 text-base font-semibold text-fg">
        <LogoMark size={20} /> Open Artifacts
      </h1>
      <TeamSwitcher />

      <nav className="mt-6 flex flex-1 flex-col gap-0.5" onClick={onNavigate}>
        <NavLink to="/teams" className={navLinkClass}>
          <UsersIcon size={16} /> Команды
        </NavLink>
        <NavLink to="/invites" className={navLinkClass}>
          <MailIcon size={16} />
          Приглашения
          {me.pendingInviteCount > 0 && (
            <Badge variant="accent" className="ml-auto">
              {me.pendingInviteCount}
            </Badge>
          )}
        </NavLink>
        {me.isSuperadmin && (
          <NavLink to="/admin" className={navLinkClass}>
            <ShieldIcon size={16} /> Админка
          </NavLink>
        )}
        <NavLink to="/settings" className={navLinkClass}>
          <SettingsIcon size={16} /> Настройки
        </NavLink>
      </nav>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
        <div className="flex gap-1 rounded-control bg-panel-muted p-1">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={theme === opt.value}
              onClick={() => setTheme(opt.value)}
              className={cn(
                "flex-1 rounded-[calc(var(--radius-control)-2px)] py-1 text-xs font-medium",
                theme === opt.value ? "bg-panel text-fg shadow-sm" : "text-muted hover:text-fg",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="truncate text-xs text-muted" title={me.email}>
          {me.email}
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center justify-center gap-2 rounded-control border border-border bg-panel px-3 py-2 text-sm font-medium text-fg hover:bg-panel-muted"
        >
          <LogOutIcon size={15} /> Выйти
        </button>
      </div>
    </div>
  );
}
