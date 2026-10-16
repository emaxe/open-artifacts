import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { TeamSwitcher } from "./TeamSwitcher";
import { LogoMark } from "./Logo";
import { Badge } from "./ui/Badge";
import { ThemeSwitch } from "./ui/ThemeSwitch";
import { cn } from "../lib/cn";
import { HomeIcon, LogOutIcon, MailIcon, SettingsIcon, ShieldIcon, UsersIcon } from "./ui/icons";

const THEME_LABELS = { light: "Светлая", system: "Системная", dark: "Тёмная" };

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "flex items-center gap-2.5 rounded-control px-3 py-2 text-[0.9375rem] font-medium transition-colors duration-150",
    isActive ? "bg-accent-soft text-accent" : "text-muted hover:bg-panel-muted hover:text-fg",
  );

/** The sidebar's nav content — rendered as a fixed desktop rail by Layout, and reused inside the mobile drawer's Dialog so there's exactly one nav to keep in sync. */
export function GlobalSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { me, logout } = useAuth();
  if (!me) return null;

  return (
    <div className="flex h-full flex-col p-5">
      <Link to="/home" className="mb-2 flex items-center gap-2 text-[1.0625rem] font-bold tracking-tight text-fg" onClick={onNavigate}>
        <LogoMark size={20} /> Open Artifacts
      </Link>
      <TeamSwitcher />

      <nav className="mt-6 flex flex-1 flex-col gap-0.5" onClick={onNavigate}>
        <NavLink to="/home" className={navLinkClass}>
          <HomeIcon size={16} /> Главная
        </NavLink>
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

      <div className="mt-4 flex flex-col gap-3 pt-4">
        <ThemeSwitch labels={THEME_LABELS} />
        <p className="truncate text-[0.8125rem] text-muted" title={me.email}>
          {me.email}
        </p>
        <button
          type="button"
          onClick={() => logout()}
          className="flex items-center justify-center gap-2 rounded-control bg-panel-muted px-3 py-2 text-[0.9375rem] font-medium text-fg transition-colors duration-150 hover:bg-accent-soft"
        >
          <LogOutIcon size={15} /> Выйти
        </button>
      </div>
    </div>
  );
}
