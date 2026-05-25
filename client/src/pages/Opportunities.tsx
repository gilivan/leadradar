import AppLayout from "@/components/AppLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Filter,
  Loader2,
  Search,
  Target,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import * as XLSX from "xlsx";

function RelevanceBadge({ label }: { label: string | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    high: { label: "Alta", cls: "badge-high" },
    medium: { label: "Media", cls: "badge-medium" },
    low: { label: "Baja", cls: "badge-low" },
    irrelevant: { label: "Irrelevante", cls: "badge-irrelevant" },
  };
  const item = map[label ?? ""] ?? { label: label ?? "", cls: "badge-irrelevant" };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", item.cls)}>
      {item.label}
    </span>
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "Todos los estados" },
  { value: "new", label: "Nuevo" },
  { value: "reviewed", label: "Revisado" },
  { value: "contacted", label: "Contactado" },
  { value: "discarded", label: "Descartado" },
];

const RELEVANCE_OPTIONS = [
  { value: "all", label: "Toda relevancia" },
  { value: "high", label: "Alta" },
  { value: "medium", label: "Media" },
  { value: "low", label: "Baja" },
  { value: "irrelevant", label: "Irrelevante" },
];

export default function Opportunities() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("");
  const [relevanceLabel, setRelevanceLabel] = useState("all");
  const [status, setStatus] = useState("all");
  const [isExporting, setIsExporting] = useState(false);

  const listQuery = trpc.opportunities.list.useQuery({
    page,
    pageSize: 20,
    keyword: keyword || undefined,
    country: country || undefined,
    relevanceLabel: relevanceLabel !== "all" ? relevanceLabel : undefined,
    status: status !== "all" ? status : undefined,
  });

  const exportQuery = trpc.opportunities.exportData.useQuery(
    {
      country: country || undefined,
      relevanceLabel: relevanceLabel !== "all" ? relevanceLabel : undefined,
      status: status !== "all" ? status : undefined,
    },
    { enabled: false }
  );

  const feedbackMutation = trpc.opportunities.submitFeedback.useMutation({
    onSuccess: () => {
      toast.success("Feedback registrado. El sistema aprenderá de esta señal.");
      listQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const statusMutation = trpc.opportunities.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("Estado actualizado");
      listQuery.refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const result = await exportQuery.refetch();
      const data = result.data ?? [];

      const rows = data.map((opp) => ({
        ID: opp.id,
        Autor: opp.authorName ?? "",
        Cargo: opp.authorTitle ?? "",
        Empresa: opp.authorCompany ?? "",
        "URL LinkedIn": opp.linkedinUrl ?? "",
        Texto: opp.rawText,
        "Score relevancia": ((opp.relevanceScore ?? 0) * 100).toFixed(0) + "%",
        "Nivel relevancia": opp.relevanceLabel ?? "",
        "Categoría intención": opp.intentCategory ?? "",
        País: opp.country ?? "",
        Ciudad: opp.city ?? "",
        "Keyword búsqueda": opp.searchKeyword ?? "",
        Estado: opp.status ?? "",
        Feedback: opp.userFeedback ?? "",
        "Razón clasificación": opp.classificationReason ?? "",
        "Fecha detección": new Date(opp.createdAt).toLocaleString("es-CO"),
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Oportunidades");
      XLSX.writeFile(wb, `oportunidades-linkedin-${new Date().toISOString().split("T")[0]}.xlsx`);
      toast.success(`${rows.length} oportunidades exportadas`);
    } catch (err) {
      toast.error("Error al exportar");
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setKeyword("");
    setCountry("");
    setRelevanceLabel("all");
    setStatus("all");
    setPage(1);
  };

  const hasFilters = keyword || country || relevanceLabel !== "all" || status !== "all";
  const totalPages = Math.ceil((listQuery.data?.total ?? 0) / 20);

  return (
    <AppLayout
      title="Oportunidades comerciales"
      subtitle={`${listQuery.data?.total ?? "—"} resultados encontrados`}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={isExporting}
          className="gap-2"
        >
          {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Exportar Excel
        </Button>
      }
    >
      <div className="space-y-5">
        {/* ── Filters ──────────────────────────────────────────────────── */}
        <Card className="border border-border shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por keyword…"
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Input
                placeholder="País"
                value={country}
                onChange={(e) => { setCountry(e.target.value); setPage(1); }}
                className="w-36 h-9 text-sm"
              />
              <Select value={relevanceLabel} onValueChange={(v) => { setRelevanceLabel(v); setPage(1); }}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RELEVANCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
                <SelectTrigger className="w-44 h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 text-muted-foreground">
                  <X className="w-3.5 h-3.5" /> Limpiar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <Card className="border border-border shadow-sm overflow-hidden">
          {listQuery.isLoading ? (
            <div className="p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : listQuery.data?.items.length === 0 ? (
            <div className="p-12 text-center">
              <Target className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Sin resultados</p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasFilters ? "Prueba con otros filtros." : "Ejecuta el scraper para detectar oportunidades."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Autor</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contenido</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Relevancia</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Región</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Feedback</th>
                      <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha</th>
                      <th className="px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {listQuery.data?.items.map((opp) => (
                      <tr key={opp.id} className="hover:bg-muted/20 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-semibold text-primary">
                                {(opp.authorName || "?")[0].toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground text-xs leading-tight">
                                {opp.authorName || "Desconocido"}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate max-w-32">
                                {opp.authorTitle || opp.authorCompany || ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 max-w-xs">
                          <p className="text-xs text-foreground/80 line-clamp-2 leading-relaxed">
                            {opp.rawText}
                          </p>
                          {opp.intentCategory && (
                            <span className="text-[10px] text-muted-foreground/60 mt-1 block">
                              {opp.intentCategory.replace(/_/g, " ")}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="space-y-1">
                            <RelevanceBadge label={opp.relevanceLabel} />
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              {((opp.relevanceScore ?? 0) * 100).toFixed(0)}%
                            </p>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-xs text-foreground/80">{opp.country || "—"}</p>
                          {opp.city && <p className="text-[10px] text-muted-foreground">{opp.city}</p>}
                        </td>
                        <td className="px-5 py-4">
                          <Select
                            value={opp.status ?? "new"}
                            onValueChange={(v) =>
                              statusMutation.mutate({
                                id: opp.id,
                                status: v as "new" | "reviewed" | "contacted" | "discarded",
                              })
                            }
                          >
                            <SelectTrigger className="h-7 w-32 text-xs border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="new">Nuevo</SelectItem>
                              <SelectItem value="reviewed">Revisado</SelectItem>
                              <SelectItem value="contacted">Contactado</SelectItem>
                              <SelectItem value="discarded">Descartado</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => feedbackMutation.mutate({ id: opp.id, feedback: "relevant" })}
                              className={cn(
                                "p-1.5 rounded-md transition-colors",
                                opp.userFeedback === "relevant"
                                  ? "bg-emerald-100 text-emerald-600"
                                  : "text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50"
                              )}
                              title="Marcar como relevante"
                            >
                              <ThumbsUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => feedbackMutation.mutate({ id: opp.id, feedback: "irrelevant" })}
                              className={cn(
                                "p-1.5 rounded-md transition-colors",
                                opp.userFeedback === "irrelevant"
                                  ? "bg-red-100 text-red-500"
                                  : "text-muted-foreground hover:text-red-500 hover:bg-red-50"
                              )}
                              title="Marcar como irrelevante"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatDistanceToNow(new Date(opp.createdAt), { addSuffix: true, locale: es })}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <Link href={`/opportunities/${opp.id}`}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-muted/10">
                  <p className="text-xs text-muted-foreground">
                    Página {page} de {totalPages} · {listQuery.data?.total} resultados
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= totalPages}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
