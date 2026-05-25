import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  History,
  Loader2,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useState } from "react";

function StatusIcon({ status }: { status: string | null }) {
  if (status === "completed") return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
  if (status === "failed") return <AlertCircle className="w-4 h-4 text-destructive" />;
  if (status === "running") return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
  return <RefreshCw className="w-4 h-4 text-amber-500" />;
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-red-100 text-red-600",
    running: "bg-blue-100 text-blue-600",
    pending: "bg-amber-100 text-amber-600",
  };
  const cls = map[status ?? ""] ?? "bg-muted text-muted-foreground";
  const labels: Record<string, string> = {
    completed: "Completado",
    failed: "Fallido",
    running: "En ejecución",
    pending: "Pendiente",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", cls)}>
      {labels[status ?? ""] ?? status}
    </span>
  );
}

export default function ExecutionLogs() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const logsQuery = trpc.admin.getExecutionLogs.useQuery({ limit: 50 });
  const detailQuery = trpc.admin.getExecutionLogById.useQuery(
    { id: expandedId! },
    { enabled: !!expandedId }
  );

  const logs = logsQuery.data ?? [];

  return (
    <AppLayout
      title="Historial de ejecuciones"
      subtitle="Registro de todas las corridas del scraper, automáticas y manuales"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => logsQuery.refetch()}
          disabled={logsQuery.isFetching}
          className="gap-2"
        >
          {logsQuery.isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Actualizar
        </Button>
      }
    >
      <div className="max-w-3xl space-y-3">
        {logsQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <Card className="border border-border shadow-sm">
            <CardContent className="p-12 text-center">
              <History className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Sin ejecuciones registradas</p>
              <p className="text-xs text-muted-foreground mt-1">
                Las ejecuciones aparecerán aquí una vez que ejecutes el scraper.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="stagger-children">
            {logs.map((log) => {
              const isExpanded = expandedId === log.id;
              const duration =
                log.finishedAt && log.startedAt
                  ? Math.round(
                      (new Date(log.finishedAt).getTime() - new Date(log.startedAt).getTime()) / 1000
                    )
                  : null;

              return (
                <Card key={log.id} className="border border-border shadow-sm overflow-hidden">
                  <button
                    className="w-full text-left"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        <StatusIcon status={log.status} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 flex-wrap">
                            <StatusBadge status={log.status} />
                            <span className="text-xs font-medium text-foreground">
                              {log.triggeredBy === "manual" ? (
                                <span className="flex items-center gap-1">
                                  <Zap className="w-3 h-3" /> Manual
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Programada
                                </span>
                              )}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(log.startedAt), "d MMM yyyy, HH:mm", { locale: es })} hora Colombia
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1.5">
                            <span className="text-xs text-muted-foreground">
                              {log.totalOpportunities ?? 0} oportunidades detectadas
                            </span>
                            {(log.totalOpportunities ?? 0) > 0 && (
                              <span className="text-xs text-emerald-600 font-medium">
                                +{log.totalOpportunities} nuevas
                              </span>
                            )}
                            {duration != null && (
                              <span className="text-xs text-muted-foreground">{duration}s</span>
                            )}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    </CardContent>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-border bg-muted/20 p-4">
                      {detailQuery.isLoading ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando detalles…
                        </div>
                      ) : detailQuery.data ? (
                        <div className="space-y-3">
                          {detailQuery.data.errorMessage && (
                            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                              <p className="text-xs font-medium text-destructive mb-1">Error</p>
                              <p className="text-xs text-foreground/80 font-mono whitespace-pre-wrap">
                                {detailQuery.data.errorMessage}
                              </p>
                            </div>
                          )}
                          {detailQuery.data.logDetails && (
                            <div>
                              <p className="text-xs font-medium text-foreground mb-2">Log detallado</p>
                              <pre className="text-[10px] text-muted-foreground bg-muted rounded-lg p-3 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                                {typeof detailQuery.data.logDetails === "string"
                                  ? detailQuery.data.logDetails
                                  : JSON.stringify(detailQuery.data.logDetails, null, 2)}
                              </pre>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            {[
                              { label: "Inicio", value: format(new Date(detailQuery.data.startedAt), "HH:mm:ss") },
                              {
                                label: "Fin",
                                value: detailQuery.data.finishedAt
                                  ? format(new Date(detailQuery.data.finishedAt), "HH:mm:ss")
                                  : "—",
                              },
                              { label: "Emails enviados", value: detailQuery.data.totalEmailsSent ?? 0 },
                            ].map(({ label, value }) => (
                              <div key={label} className="rounded-lg bg-background border border-border p-2.5">
                                <p className="text-muted-foreground">{label}</p>
                                <p className="font-semibold text-foreground mt-0.5">{value}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
