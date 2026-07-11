import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  Shield,
  Rocket,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match: (path: string) => boolean;
  show?: boolean;
}

/** Routes where the app sidebar should appear (authenticated app, not marketing). */
export function isAppRoute(pathname: string): boolean {
  return [
    "/dashboard",
    "/campaign",
    "/admin",
    "/account",
    "/manager",
    "/schedule",
    "/knowledge-base",
    "/settings",
  ].some((p) => pathname === p || pathname.startsWith(p + "/") || pathname === p);
}

/**
 * Collapsed icon rail (56px) that expands to a labeled panel (224px) on hover.
 * Fixed to the left; content is offset by the collapsed width via AppShell.
 */
export function AppSidebar() {
  const location = useLocation();
  const { isAdmin, isManager, signOut } = useAuth();

  if (!isAppRoute(location.pathname)) return null;

  const items: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, match: (p) => p.startsWith("/dashboard") || p.startsWith("/campaign") },
    { to: "/schedule", label: "Calendar", icon: CalendarDays, match: (p) => p.startsWith("/schedule") },
    { to: "/knowledge-base", label: "Knowledge Base", icon: BookOpen, match: (p) => p.startsWith("/knowledge-base") },
    { to: "/settings/workspace", label: "Team", icon: Users, match: (p) => p.startsWith("/settings") },
    { to: "/admin", label: "Admin", icon: Shield, match: (p) => p.startsWith("/admin") || p.startsWith("/manager"), show: isAdmin || isManager },
  ];

  const active = (item: NavItem) => item.match(location.pathname);

  return (
    <aside
      className={cn(
        "group fixed inset-y-0 left-0 z-50 flex w-14 flex-col overflow-hidden border-r border-border",
        "bg-card/85 backdrop-blur-xl transition-[width] duration-200 ease-out hover:w-56",
        "hidden md:flex"
      )}
    >
      {/* brand */}
      <div className="flex h-16 items-center gap-3 px-3.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Rocket className="h-4 w-4" />
        </span>
        <span className="whitespace-nowrap font-display text-base font-semibold tracking-tight opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Archer
        </span>
      </div>

      {/* nav */}
      <nav className="flex flex-1 flex-col gap-1 px-2 py-2">
        {items.filter((i) => i.show !== false).map((item) => {
          const isActive = active(item);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      {/* footer */}
      <div className="flex flex-col gap-1 border-t border-border px-2 py-2">
        <div className="flex items-center gap-3 rounded-lg px-2.5 py-1.5">
          <ThemeToggle />
          <span className="whitespace-nowrap text-sm text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Theme
          </span>
        </div>
        <button
          onClick={() => signOut()}
          className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
