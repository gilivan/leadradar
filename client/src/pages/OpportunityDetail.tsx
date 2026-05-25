import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  Loader2,
  MapPin,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  User,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function RelevanceBadge({ label }: { label: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: "Alta relevancia", cls: "badge-high" },
    medium: { label: "Relevancia media", cls: "badge-medium" },
    low: { label: "Baja relevancia", cls: "badge-low" },
    irrelevant: { label: "Irrelevante", cls: "badge-irrelevant" },
  };
  const item = map[label ?? ""] ?? { label: label ?? "", cls: "badge-irrelevant" };
  return (
    <span className={cn("inline-flex items-center px-3 py-1 rounded-full text-sm font-medium", item.cls)}>
      {item.label}
    </span>
  );
}

export default function OpportunityDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");
  const [feedbackNote, setFeedbackNote] = useState("");

  const query = trpc.opportunities.getById.useQuery({ id }, { enabled: !!id });

  const feedbackMutation = trpc.opportunities.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success("Feedback registrado. El sistema aprenderá de esta señal.");
      query.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const statusMutation = trpc.opportunities.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      query.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  if (query.isLoading) {
    return (
      <AppLayout title="Oportunidad">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  const opp = query.data;
  if (!opp) {
    return (
      <AppLayout title="Oportunidad no encontrada">
        <div className="text-center py-20">
          <p className="text-muted-foreground">La oportunidad no existe o fue eliminada.</p>
          <Link href="/opportunities">
            <Button variant="outline" className="mt-4 gap-2">
              <ArrowLeft className="w-4 h-4" /> Volver
            </Button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const score = ((opp.relevanceScore ?? 0) * 100).toFixed(0);
  const keywords = (opp.detectedKeywords as string[]) ?? [];

  return (
    <AppLayout
      title="Detalle de oportunidad"
      subtitle={`#${opp.id} · Detectada ${format(new Date(opp.createdAt), "d MMM yyyy, HH:mm", { locale: es })}`}
      actions={
        <Link href="/opportunities">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
        </Link>
      }
    >
      <div className="max-w-4xl space-y-6 animate-fade-in-up">
        {/* ── Header card ─────────────────────────────────────────────── */}
        <Card className="border border-border shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xl font-bold text-primary">
                    {(opp.authorName || "?")[0].toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{opp.authorName || "Autor desconocido"}</h2>
                  {opp.authorTitle && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <User className="w-3.5 h-3.5" /> {opp.authorTitle}
                    </p>
                  )}
                  {opp.authorCompany && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5" /> {opp.authorCompany}
                    </p>
                  )}
                  {(opp.country || opp.city) && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      {[opp.city, opp.country].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <RelevanceBadge label={opp.relevanceLabel} />
                <p className="text-2xl font-bold text-foreground tabular-nums">{score}%</p>
                <p className="text-xs text-muted-foreground">Score de relevancia</p>
              </div>
            </div>

            {opp.linkedinUrl && (
              <div className="mt-4 pt-4 border-t border-border">
                <a
                  href={opp.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-accent hover:text-accent/80 font-medium transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver publicación en LinkedIn
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Content ─────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  Contenido de la publicación
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="gold-border-left pl-4">
                  <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                    {opp.rawText}
                  </p>
                </div>
                {opp.publishedAt && (
                  <p className="text-xs text-muted-foreground mt-4">
                    Publicado: {format(new Date(opp.publishedAt), "d MMM yyyy", { locale: es })}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Feedback */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Feedback y aprendizaje</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-muted-foreground">
                  Tu feedback ayuda al sistema a mejorar la clasificación de futuras oportunidades.
                </p>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => feedbackMutation.mutate({ id: opp.id, feedback: "relevant", note: feedbackNote })}
                    disabled={feedbackMutation.isPending}
                    className={cn(
                      "gap-2 transition-colors",
                      opp.userFeedback === "relevant" && "bg-emerald-50 border-emerald-200 text-emerald-700"
                    )}
                  >
                    <ThumbsUp className="w-4 h-4" />
                    {opp.userFeedback === "relevant" ? "Marcada como relevante" : "Es relevante"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => feedbackMutation.mutate({ id: opp.id, feedback: "irrelevant", note: feedbackNote })}
                    disabled={feedbackMutation.isPending}
                    className={cn(
                      "gap-2 transition-colors",
                      opp.userFeedback === "irrelevant" && "bg-red-50 border-red-200 text-red-600"
                    )}
                  >
                    <ThumbsDown className="w-4 h-4" />
                    {opp.userFeedback === "irrelevant" ? "Marcada como irrelevante" : "No es relevante"}
                  </Button>
                </div>
                <Textarea
                  placeholder="Nota opcional sobre el feedback (ej: 'Es competencia', 'Busca agencia de diseño')…"
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  className="text-sm resize-none h-20"
                />
                {opp.feedbackNote && (
                  <p className="text-xs text-muted-foreground italic">
                    Nota anterior: "{opp.feedbackNote}"
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Sidebar ─────────────────────────────────────────────── */}
          <div className="space-y-4">
            {/* Classification */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Clasificación IA</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Categoría de intención</p>
                  <p className="text-sm font-medium text-foreground capitalize">
                    {(opp.intentCategory || "—").replace(/_/g, " ")}
                  </p>
                </div>
                {opp.classificationReason && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Razón de clasificación</p>
                    <p className="text-xs text-foreground/80 leading-relaxed">{opp.classificationReason}</p>
                  </div>
                )}
                {keywords.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Keywords detectadas</p>
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map((kw) => (
                        <span
                          key={kw}
                          className="inline-flex items-center px-2 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Status */}
            <Card className="border border-border shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Estado de gestión</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={opp.status ?? "new"}
                  onValueChange={(v) =>
                    statusMutation.mutate({
                      id: opp.id,
                      status: v as "new" | "reviewed" | "contacted" | "discarded",
                    })
                  }
                >
                  <SelectTrigger className="w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Nuevo</SelectItem>
                    <SelectItem value="reviewed">Revisado</SelectItem>
                    <SelectItem value="contacted">Contactado</SelectItem>
                    <SelectItem value="discarded">Descartado</SelectItem>
                  </SelectContent>
                </Select>
                {opp.emailSentAt && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Alerta enviada: {format(new Date(opp.emailSentAt), "d MMM yyyy HH:mm", { locale: es })}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Meta */}
            <Card className="border border-border shadow-sm">
              <CardContent className="p-4 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Metadatos</p>
                {[
                  { label: "Tipo", value: opp.contentType },
                  { label: "Keyword búsqueda", value: opp.searchKeyword },
                  { label: "Log ejecución", value: opp.executionLogId ? `#${opp.executionLogId}` : null },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="text-xs font-medium text-foreground">{value}</span>
                    </div>
                  ) : null
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
