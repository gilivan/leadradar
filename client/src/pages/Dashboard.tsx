import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

function RelevanceBadge({ label }: { label: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: "Alta", cls: "badge-high" },
    medium: { label: "Media", cls: "badge-medium" },
    low: { label: "Baja", cls: "badge-low" },
    irrelevant: { label: "Irrelevante", cls: "badge-irrelevant" },
  };
  const item = map[label] ?? { label, cls: "badge-irrelevant" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", item.cls)}>
      {item.label}
    </span>
  );
}

export default function Dashboard() {
  const [isRunning, setIsRunning] = useState(false);

  const statsQuery = trpc.opportunities.dashboardStats.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const recentQuery = trpc.opportunities.list.useQuery({
    page: 1,
    pageSize: 5,
    status: "new",
  });

  const logsQuery = trpc.admin.getExecutionLogs.useQuery({ limit: 3 });

  const runMutation = trpc.admin.runManualScrape.useMutation({
    onSuccess: (data) => {
      toast.success(`Ejecución completada. Log #${data.logId}`);
      statsQuery.refetch();
      recentQuery.refetch();
      logsQuery.refetch();
      setIsRunning(false);
    },
    onError: (err) => {
      toast.error(`Error: ${err.message}`);
      setIsRunning(false);
    },
  });

  const handleRun = () => {
    setIsRunning(true);
    runMutation.mutate();
  };

  const stats = statsQuery.data;

  const statCards = [
    {
      title: "Total oportunidades",
      value: stats?.total ?? "—",
      icon: Target,
      color: "text-blue-600",
      bg: "bg-blue-50",
      description: "Detectadas históricamente",
    },
    {
      title: "Alta relevancia",
      value: stats?.highCount ?? "—",
      icon: Star,
      color: "text-amber-600",
      bg: "bg-amber-50",
      description: "Score ≥ 75%",
    },
    {
      title: "Nuevas hoy",
      value: stats?.todayCount ?? "—",
      icon: Zap,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      description: "Detectadas en las últimas 24h",
    },
    {
      title: "Pendientes de revisión",
      value: stats?.newCount ?? "—",
      icon: Clock,
      color: "text-purple-600",
      bg: "bg-purple-50",
      description: "Sin revisar aún",
    },
  ];

  return (
    <AppLayout
      title="Dashboard"
      subtitle="Inteligencia comercial en tiempo real"
      actions={
        <Button
          onClick={handleRun}
          disabled={isRunning}
          className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2"
        >
          {isRunning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Ejecutando…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Ejecutar ahora
            </>
          )}
        </Button>
      }
    >
      <div className="space-y-8 stagger-children">
        {/* ── Stats grid ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="border border-border shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {card.title}
                      </p>
                      <p className="text-3xl font-bold text-foreground mt-1 tabular-nums">
                        {statsQuery.isLoading ? (
                          <span className="inline-block w-12 h-8 bg-muted animate-pulse rounded" />
                        ) : (
                          card.value
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{card.description}</p>
                    </div>
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", card.bg)}>
                      <Icon className={cn("w-5 h-5", card.color)} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* ── Recent opportunities ──────────────────────────────────── */}
          <div className="xl:col-span-2">
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-semibold">Oportunidades recientes</CardTitle>
                <Link href="/opportunities">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground hover:text-foreground">
                    Ver todas <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0">
                {recentQuery.isLoading ? (
                  <div className="space-y-px">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="px-6 py-4 flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-muted animate-pulse shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-muted animate-pulse rounded w-1/3" />
                          <div className="h-3 bg-muted animate-pulse rounded w-2/3" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : recentQuery.data?.items.length === 0 ? (
                  <div className="px-6 py-12 text-center">
                    <Target className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No hay oportunidades nuevas.</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Ejecuta el scraper para detectar oportunidades en LinkedIn.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-border">
                    {recentQuery.data?.items.map((opp) => (
                      <li key={opp.id} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                        <Link href={`/opportunities/${opp.id}`}>
                          <div className="flex items-start gap-4 cursor-pointer">
                            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-xs font-semibold text-primary">
                                {(opp.authorName || "?")[0].toUpperCase()}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-foreground truncate">
                                  {opp.authorName || "Autor desconocido"}
                                </span>
                                <RelevanceBadge label={opp.relevanceLabel || "medium"} />
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                {opp.rawText}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <span className="text-[10px] text-muted-foreground/70">
                                  {opp.country}{opp.city ? ` · ${opp.city}` : ""}
                                </span>
                                <span className="text-[10px] text-muted-foreground/70">
                                  Score: {((opp.relevanceScore || 0) * 100).toFixed(0)}%
                                </span>
                                <span className="text-[10px] text-muted-foreground/70">
                                  {formatDistanceToNow(new Date(opp.createdAt), { addSuffix: true, locale: es })}
                                </span>
                              </div>
                            </div>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0 mt-1" />
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Right column ─────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Avg score */}
            <Card className="border border-border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Score promedio</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {stats ? `${(stats.avgScore * 100).toFixed(0)}%` : "—"}
                    </p>
                  </div>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-700"
                    style={{ width: `${(stats?.avgScore || 0) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Basado en clasificación LLM + reglas aprendidas
                </p>
              </CardContent>
            </Card>

            {/* Recent executions */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">Últimas ejecuciones</CardTitle>
                <Link href="/logs">
                  <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
                    Ver todas <ArrowRight className="w-3 h-3" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent className="p-0 pb-2">
                {logsQuery.isLoading ? (
                  <div className="px-4 space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                    ))}
                  </div>
                ) : logsQuery.data?.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">Sin ejecuciones aún.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {logsQuery.data?.map((log) => (
                      <li key={log.id} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {log.status === "completed" ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : log.status === "failed" ? (
                            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                          ) : log.status === "running" ? (
                            <Loader2 className="w-4 h-4 text-blue-500 animate-spin shrink-0" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-foreground capitalize">
                                {log.triggeredBy === "manual" ? "Manual" : "Programada"}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {log.totalOpportunities} oportunidades
                              </span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                              {formatDistanceToNow(new Date(log.startedAt), { addSuffix: true, locale: es })}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Quick links */}
            <Card className="border border-border shadow-sm">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Accesos rápidos</p>
                {[
                  { label: "Configurar Apify", href: "/admin/settings", icon: Sparkles },
                  { label: "Perfiles de búsqueda", href: "/admin/profiles", icon: Target },
                  { label: "Programar ejecuciones", href: "/admin/schedule", icon: Clock },
                ].map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link key={link.href} href={link.href}>
                      <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group">
                        <Icon className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
                        <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors">
                          {link.label}
                        </span>
                        <ArrowRight className="w-3 h-3 text-muted-foreground/40 ml-auto group-hover:text-accent transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
