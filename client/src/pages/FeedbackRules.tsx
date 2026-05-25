import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { Brain, Loader2, RefreshCw, ThumbsDown, ThumbsUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function FeedbackRules() {
  const rulesQuery = trpc.admin.getFeedbackRules.useQuery();
  const utils = trpc.useUtils();

  const deleteMutation = trpc.admin.deleteFeedbackRule.useMutation({
    onSuccess: () => {
      toast.success("Regla eliminada");
      utils.admin.getFeedbackRules.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const rules = rulesQuery.data ?? [];
  const positiveRules = rules.filter((r) => r.signal === "positive");
  const negativeRules = rules.filter((r) => r.signal === "negative");

  return (
    <AppLayout
      title="Reglas de aprendizaje"
      subtitle="Patrones aprendidos del feedback del usuario para mejorar la clasificación"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => rulesQuery.refetch()}
          disabled={rulesQuery.isFetching}
          className="gap-2"
        >
          {rulesQuery.isFetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Actualizar
        </Button>
      }
    >
      <div className="max-w-3xl space-y-6">
        {/* Info */}
        <div className="rounded-lg bg-accent/5 border border-accent/20 p-4">
          <div className="flex items-start gap-3">
            <Brain className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div className="text-xs text-foreground/80 space-y-1">
              <p className="font-medium">Aprendizaje continuo</p>
              <p>
                Cada vez que marcas una oportunidad como relevante o irrelevante, el sistema extrae patrones
                del texto y los registra aquí. Estos patrones ajustan el score de clasificación de futuras
                publicaciones similares.
              </p>
              <p>
                Un peso mayor indica que el patrón ha sido confirmado más veces. Puedes eliminar reglas que
                consideres incorrectas.
              </p>
            </div>
          </div>
        </div>

        {rulesQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : rules.length === 0 ? (
          <Card className="border border-border shadow-sm">
            <CardContent className="p-12 text-center">
              <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Sin reglas aprendidas aún</p>
              <p className="text-xs text-muted-foreground mt-1">
                Marca oportunidades como relevantes o irrelevantes para que el sistema aprenda.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Positive */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ThumbsUp className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-foreground">
                  Patrones positivos ({positiveRules.length})
                </h3>
              </div>
              {positiveRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin patrones positivos aún.</p>
              ) : (
                <div className="space-y-2">
                  {positiveRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-emerald-100 bg-emerald-50/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">"{rule.pattern}"</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            Peso: {Number(rule.weight).toFixed(1)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {rule.occurrences}x confirmado
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          className="h-1.5 rounded-full bg-emerald-200 overflow-hidden"
                          style={{ width: "48px" }}
                        >
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(100, (Number(rule.weight) / 3) * 100)}%` }}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: rule.id })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Negative */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ThumbsDown className="w-4 h-4 text-red-400" />
                <h3 className="text-sm font-semibold text-foreground">
                  Patrones negativos ({negativeRules.length})
                </h3>
              </div>
              {negativeRules.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin patrones negativos aún.</p>
              ) : (
                <div className="space-y-2">
                  {negativeRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-red-100 bg-red-50/50"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">"{rule.pattern}"</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            Peso: {Number(rule.weight).toFixed(1)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {rule.occurrences}x confirmado
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div
                          className="h-1.5 rounded-full bg-red-200 overflow-hidden"
                          style={{ width: "48px" }}
                        >
                          <div
                            className="h-full bg-red-400 rounded-full"
                            style={{ width: `${Math.min(100, (Number(rule.weight) / 3) * 100)}%` }}
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-6 h-6 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: rule.id })}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
