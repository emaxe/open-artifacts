import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { GlobalSidebar } from "./GlobalSidebar";
import { LogoMark } from "./Logo";
import { Spinner } from "./ui/Spinner";
import { IconButton } from "./ui/Button";
import { Dialog } from "./ui/Dialog";

// A minimal hamburger — the icon set in ui/icons.tsx doesn't have one dedicated, three stacked
// bars are simpler as a one-off SVG than adding a 13th shared icon for a single call site.
function MenuIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function Layout() {
  const { me, loading } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (loading) return <Spinner />;
  if (!me) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r border-border bg-panel md:block">
        <GlobalSidebar />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-panel px-4 py-3 md:hidden">
          <IconButton label="Меню" onClick={() => setMobileNavOpen(true)}>
            <MenuIcon />
          </IconButton>
          <LogoMark size={20} />
          <span className="text-sm font-semibold text-fg">Open Artifacts</span>
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <Dialog open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} title="Меню" className="m-0 ml-0 mr-auto h-full max-h-none w-72 max-w-[85vw] rounded-none">
        <div className="-m-4">
          <GlobalSidebar onNavigate={() => setMobileNavOpen(false)} />
        </div>
      </Dialog>
    </div>
  );
}
