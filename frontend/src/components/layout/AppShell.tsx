import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { getOverdueCount } from "@/api";
import {
  LayoutDashboard, FolderKanban, Users, Settings, LogOut,
  Menu, X, Zap, BookOpen, CheckSquare, Sparkles, Tags,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { aiEnabled } from "@/config/features";

const navItems = [
  { to: "/", icon: FolderKanban, label: "Projects" },
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/todos", icon: CheckSquare, label: "My Todos" },
  ...(aiEnabled ? [{ to: "/ask-ai", icon: Sparkles, label: "Ask AI" }] : []),
];

const adminNavItems = [
  { to: "/users", icon: Users, label: "Users" },
  { to: "/categories", icon: Tags, label: "Categories" },
  // NOTE: "/settings" route does not exist yet — removed dead link.
  // Re-add here once a Settings page + route are implemented.
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { data: overdueData } = useQuery({
    queryKey: ["overdueCount"],
    queryFn: () => getOverdueCount().then((r) => r.data),
    refetchInterval: 60_000,
  });
  const overdueCount = overdueData?.count ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const sidebar = (
    <nav className="flex flex-col h-full">
      <div className="px-4 py-5 flex items-center gap-2 border-b border-gray-100">
        <div className="flex gap-1">
          <BookOpen size={18} className="text-blue-600" />
          <Zap size={18} className="text-amber-500" />
        </div>
        <span className="font-semibold text-gray-900">ProjectTracker</span>
      </div>

      <div className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )
            }
            onClick={() => setSidebarOpen(false)}
          >
            <Icon size={16} />
            {label}
            {label === "Dashboard" && overdueCount > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {overdueCount}
              </span>
            )}
          </NavLink>
        ))}

        {user?.role === "admin" && (
          <>
            <div className="pt-3 pb-1 px-3 text-xs font-medium text-gray-400 uppercase tracking-wider">
              Admin
            </div>
            {adminNavItems.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )
                }
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </>
        )}
      </div>

      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-2 px-3 py-2 mb-1">
          <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
            {user?.full_name?.[0] ?? "?"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <Link
          to="/profile"
          className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50"
          onClick={() => setSidebarOpen(false)}
        >
          <Settings size={14} />
          Profile
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </nav>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 flex-shrink-0 bg-white border-r border-gray-200">
        {sidebar}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-56 bg-white border-r border-gray-200 z-50">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={18} />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="md:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)}>
            <Menu size={20} className="text-gray-600" />
          </button>
          <span className="font-semibold text-gray-900">ProjectTracker</span>
          {overdueCount > 0 && (
            <span className="ml-auto bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
              {overdueCount} overdue
            </span>
          )}
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 pb-24 sm:p-4 md:p-6 md:pb-6">{children}</main>
        <nav className={cn("fixed bottom-0 left-0 right-0 z-30 grid border-t border-gray-200 bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] shadow-lg backdrop-blur md:hidden", aiEnabled ? "grid-cols-4" : "grid-cols-3")} aria-label="Mobile navigation">
          {navItems.map(({ to, icon: Icon, label }) => <NavLink key={to} to={to} end={to === "/"}
            className={({ isActive }) => `flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${isActive ? "text-blue-700" : "text-gray-500"}`}>
            <Icon size={20} /><span>{label}</span></NavLink>)}
        </nav>
      </div>
    </div>
  );
}
