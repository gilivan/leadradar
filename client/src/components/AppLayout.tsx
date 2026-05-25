import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Bell,
  BookOpen,
  Brain,
  Calendar,
  ChevronRight,
  Cog,
  History,
  Linkedin,
  LogOut,
  Mail,
  MapPin,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  User,
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: "Principal",
    items: [
      { label: "Dashboard", href: "/", icon: BarChart3 },
      { label: "Oportunidades", href: "/opportunities", icon: Target },
      { label: "Historial de ejecuciones", href: "/logs", icon: History },
    ],
  },
  {
    title: "Administración",
    items: [
      { label: "Configuración general", href: "/admin/settings", icon: Cog },
      { label: "Perfiles de búsqueda", href: "/admin/profiles", icon: MapPin },
      { label: "Programación", href: "/admin/schedule", icon: Calendar },
      { label: "Alertas por correo", href: "/admin/email", icon: Mail },
      { label: "Reglas de aprendizaje", href: "/admin/feedback-rules", icon: Brain },
    ],
  },
];

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function AppLayout({ children, title, subtitle, actions }: AppLayoutProps) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const statsQuery = trpc.opportunities.dashboardStats.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando plataforma…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-6 max-w-sm text-center px-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
              <Linkedin className="w-6 h-6 text-accent" />
            </div>
            <div className="text-left">
              <h1 className="text-xl font-semibold text-foreground">LinkedIn Intelligence</h1>
              <p className="text-xs text-muted-foreground">Plataforma de oportunidades comerciales</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Detecta oportunidades comerciales en LinkedIn de forma automatizada con inteligencia artificial.
          </p>
          <Button asChild className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            <a href={getLoginUrl()}>Iniciar sesión</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 ease-out",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-accent-foreground" />
          </div>
          {sidebarOpen && (
            <div className="overflow-hidden">
              <p className="text-sm font-semibold text-sidebar-foreground leading-tight">LinkedIn Intel</p>
              <p className="text-[10px] text-sidebar-foreground/50 leading-tight">El Grupo · Oportunidades</p>
            </div>
          )}
        </div>

        {/* New opportunities badge */}
        {sidebarOpen && statsQuery.data && statsQuery.data.newCount > 0 && (
          <div className="mx-3 mt-3 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
            <div className="flex items-center gap-2">
              <Bell className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-xs text-sidebar-foreground/80">
                <span className="font-semibold text-accent">{statsQuery.data.newCount}</span> nuevas oportunidades
              </span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5">
          {navGroups.map((group) => (
            <div key={group.title}>
              {sidebarOpen && (
                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                  {group.title}
                </p>
              )}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.href === "/" ? location === "/" : location.startsWith(item.href);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href={item.href}>
                            <span
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 cursor-pointer",
                                isActive
                                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                              )}
                            >
                              <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-accent")} />
                              {sidebarOpen && <span className="truncate">{item.label}</span>}
                              {sidebarOpen && isActive && (
                                <ChevronRight className="w-3 h-3 ml-auto text-accent/60" />
                              )}
                            </span>
                          </Link>
                        </TooltipTrigger>
                        {!sidebarOpen && (
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        )}
                      </Tooltip>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-sidebar-border p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0">
                <User className="w-4 h-4 text-sidebar-foreground/70" />
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{user?.name || "Usuario"}</p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate">{user?.email || ""}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => logout()}
              >
                <LogOut className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-full h-8 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent"
                  onClick={() => logout()}
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Cerrar sesión</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-sidebar border border-sidebar-border flex items-center justify-center text-sidebar-foreground/50 hover:text-sidebar-foreground transition-colors"
        >
          <ChevronRight
            className={cn("w-3 h-3 transition-transform duration-300", !sidebarOpen && "rotate-180")}
          />
        </button>
      </aside>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main
        className={cn(
          "flex-1 min-h-screen transition-all duration-300 ease-out",
          sidebarOpen ? "ml-64" : "ml-16"
        )}
      >
        {(title || actions) && (
          <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                {title && (
                  <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
                )}
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-3">{actions}</div>}
            </div>
          </header>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
