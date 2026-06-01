import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Edit2,
  Globe,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
  X,
  CheckCircle2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProfileForm {
  name: string;
  description: string;
  country: string;
  city: string;
  keywords: string;
  isActive: boolean;
  useExpandedContext: boolean;
}

const emptyForm: ProfileForm = {
  name: "",
  description: "",
  country: "",
  city: "",
  keywords: "",
  isActive: true,
  useExpandedContext: true,
};

type ExpandedContextData = {
  alternativeRoles: string[];
  searchPhrases: string[];
  industryKeywords: string[];
  allQueries: string[];
  expandedAt: string;
};

export default function AdminProfiles() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());
  const [expandingId, setExpandingId] = useState<number | null>(null);

  const profilesQuery = trpc.admin.getSearchProfiles.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.admin.createSearchProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil creado");
      utils.admin.getSearchProfiles.invalidate();
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.admin.updateSearchProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil actualizado");
      utils.admin.getSearchProfiles.invalidate();
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.admin.deleteSearchProfile.useMutation({
    onSuccess: () => {
      toast.success("Perfil eliminado");
      utils.admin.getSearchProfiles.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const expandMutation = trpc.admin.expandProfileContext.useMutation({
    onSuccess: (data, variables) => {
      toast.success(`Contexto expandido: ${data.allQueries.length} queries generadas`);
      utils.admin.getSearchProfiles.invalidate();
      setExpandingId(null);
      // Auto-open the expanded context panel
      setExpandedCards((prev) => new Set(Array.from(prev).concat(variables.id)));
    },
    onError: (e) => {
      toast.error("Error al expandir contexto: " + e.message);
      setExpandingId(null);
    },
  });

  const clearContextMutation = trpc.admin.clearProfileContext.useMutation({
    onSuccess: () => {
      toast.success("Contexto expandido eliminado");
      utils.admin.getSearchProfiles.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: NonNullable<typeof profilesQuery.data>[0]) => {
    setEditId(p.id);
    setForm({
      name: p.name,
      description: (p as { description?: string }).description ?? "",
      country: p.country ?? "",
      city: p.city ?? "",
      keywords: ((p.keywords as string[]) ?? []).join(", "),
      isActive: p.isActive ?? true,
      useExpandedContext: (p as { useExpandedContext?: boolean }).useExpandedContext ?? true,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    const keywords = form.keywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (!form.name.trim()) return toast.error("El nombre es obligatorio");
    if (keywords.length === 0) return toast.error("Agrega al menos una keyword");

    if (editId) {
      updateMutation.mutate({
        id: editId,
        name: form.name,
        description: form.description || undefined,
        country: form.country || undefined,
        city: form.city || undefined,
        keywords,
        isActive: form.isActive,
        useExpandedContext: form.useExpandedContext,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        description: form.description || undefined,
        country: form.country || undefined,
        city: form.city || undefined,
        keywords,
        isActive: form.isActive,
        useExpandedContext: form.useExpandedContext,
      });
    }
  };

  const handleExpand = (id: number) => {
    setExpandingId(id);
    expandMutation.mutate({ id });
  };

  const toggleCard = (id: number) => {
    setExpandedCards((prev) => {
      const arr = Array.from(prev);
      if (arr.includes(id)) return new Set(arr.filter((x) => x !== id));
      return new Set(arr.concat(id));
    });
  };

  const profiles = profilesQuery.data ?? [];

  return (
    <AppLayout
      title="Perfiles de búsqueda"
      subtitle="Define las regiones y palabras clave para detectar oportunidades"
      actions={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nuevo perfil
        </Button>
      }
    >
      {/* Explanation banner */}
      <div className="mb-6 rounded-xl border border-brand-gold/20 bg-brand-gold/5 p-4 flex gap-3">
        <Sparkles className="w-5 h-5 text-brand-gold shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground mb-0.5">Expansión de contexto con IA</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            El sistema usa inteligencia artificial para ampliar cada perfil con roles alternativos, frases de búsqueda y términos de industria relacionados. Esto aumenta significativamente la cobertura del scraping sin que tengas que definir manualmente todas las variantes. Haz clic en <strong>Expandir con IA</strong> en cualquier perfil para generarlo.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {profilesQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : profiles.length === 0 ? (
          <Card className="border border-border shadow-sm">
            <CardContent className="p-12 text-center">
              <Search className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Sin perfiles de búsqueda</p>
              <p className="text-xs text-muted-foreground mt-1">
                Crea un perfil para comenzar a detectar oportunidades en LinkedIn.
              </p>
              <Button onClick={openCreate} className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> Crear primer perfil
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 stagger-children">
            {profiles.map((profile) => {
              const keywords = (profile.keywords as string[]) ?? [];
              const expandedCtx = (profile as { expandedContext?: ExpandedContextData | null }).expandedContext;
              const isExpanded = expandedCards.has(profile.id);
              const isExpandingThis = expandingId === profile.id;
              const useExpanded = (profile as { useExpandedContext?: boolean }).useExpandedContext ?? true;

              return (
                <Card
                  key={profile.id}
                  className={cn(
                    "border shadow-sm transition-all hover:shadow-md",
                    profile.isActive ? "border-border" : "border-border/50 opacity-60"
                  )}
                >
                  <CardContent className="p-5">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-foreground">{profile.name}</h3>
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                              profile.isActive
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {profile.isActive ? "Activo" : "Inactivo"}
                          </span>
                          {expandedCtx && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-brand-gold/10 text-brand-gold">
                              <Brain className="w-2.5 h-2.5" />
                              IA activa
                            </span>
                          )}
                        </div>
                        {(profile as { description?: string }).description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {(profile as { description?: string }).description}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-foreground"
                          onClick={() => openEdit(profile)}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-destructive"
                          onClick={() => deleteMutation.mutate({ id: profile.id })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Location & base keywords */}
                    <div className="space-y-2 mb-4">
                      {(profile.country || profile.city) ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{[profile.city, profile.country].filter(Boolean).join(", ")}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span>Global (sin región específica)</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {keywords.slice(0, 4).map((kw) => (
                            <span
                              key={kw}
                              className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-medium"
                            >
                              {kw}
                            </span>
                          ))}
                          {keywords.length > 4 && (
                            <span className="text-[10px] text-muted-foreground">+{keywords.length - 4} más</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Context Expansion Section */}
                    <div className="border-t border-border/50 pt-3">
                      {expandedCtx ? (
                        <Collapsible open={isExpanded} onOpenChange={() => toggleCard(profile.id)}>
                          <div className="flex items-center justify-between">
                            <CollapsibleTrigger asChild>
                              <button className="flex items-center gap-2 text-xs font-medium text-brand-gold hover:text-brand-gold/80 transition-colors">
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                <Brain className="w-3.5 h-3.5" />
                                {expandedCtx.allQueries.length} queries expandidas con IA
                              </button>
                            </CollapsibleTrigger>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1"
                                onClick={() => handleExpand(profile.id)}
                                disabled={isExpandingThis}
                              >
                                {isExpandingThis ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="w-3 h-3" />
                                )}
                                Regenerar
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-6 h-6 text-muted-foreground hover:text-destructive"
                                onClick={() => clearContextMutation.mutate({ id: profile.id })}
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>

                          <CollapsibleContent className="mt-3 space-y-3">
                            {/* Alternative Roles */}
                            {expandedCtx.alternativeRoles.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                  Roles alternativos ({expandedCtx.alternativeRoles.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {expandedCtx.alternativeRoles.map((role) => (
                                    <Badge key={role} variant="outline" className="text-[10px] py-0 px-1.5 font-normal border-border/60">
                                      {role}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Search Phrases */}
                            {expandedCtx.searchPhrases.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                  Frases de búsqueda ({expandedCtx.searchPhrases.length})
                                </p>
                                <div className="space-y-1">
                                  {expandedCtx.searchPhrases.map((phrase) => (
                                    <div key={phrase} className="flex items-start gap-1.5">
                                      <CheckCircle2 className="w-3 h-3 text-brand-gold shrink-0 mt-0.5" />
                                      <span className="text-[11px] text-foreground/80">{phrase}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Industry Keywords */}
                            {expandedCtx.industryKeywords.length > 0 && (
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                                  Keywords de industria ({expandedCtx.industryKeywords.length})
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {expandedCtx.industryKeywords.map((kw) => (
                                    <Badge key={kw} variant="secondary" className="text-[10px] py-0 px-1.5 font-normal">
                                      {kw}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <p className="text-[10px] text-muted-foreground/60">
                              Expandido el {new Date(expandedCtx.expandedAt).toLocaleDateString("es-CO", {
                                day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
                              })}
                            </p>
                          </CollapsibleContent>
                        </Collapsible>
                      ) : (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">Sin expansión de contexto IA</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-3 text-xs gap-1.5 border-brand-gold/30 text-brand-gold hover:bg-brand-gold/5 hover:border-brand-gold/60"
                            onClick={() => handleExpand(profile.id)}
                            disabled={isExpandingThis}
                          >
                            {isExpandingThis ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Generando…
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                Expandir con IA
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Query count summary */}
                    {expandedCtx && useExpanded && (
                      <div className="mt-3 rounded-lg bg-brand-gold/5 border border-brand-gold/15 px-3 py-2 flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">Queries activas en el scraper</span>
                        <span className="text-[11px] font-semibold text-brand-gold">{expandedCtx.allQueries.length} queries</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar perfil de búsqueda" : "Nuevo perfil de búsqueda"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nombre del perfil *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Especialista Digital"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Descripción (opcional)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe el tipo de persona o empresa que buscas detectar…"
                rows={2}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                La IA usa esta descripción para generar mejores variantes de búsqueda.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">País</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  placeholder="Ej: Colombia"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ciudad</Label>
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="Ej: Bogotá"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Keywords base *</Label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="agencia publicidad, marketing digital, campaña…"
              />
              <p className="text-xs text-muted-foreground">
                Separa con comas. La IA las usará como punto de partida para generar variantes.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Brain className="w-4 h-4 text-brand-gold" />
                  Usar expansión de contexto IA
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Amplía automáticamente las búsquedas con roles y frases generadas por IA.
                </p>
              </div>
              <Switch
                checked={form.useExpandedContext}
                onCheckedChange={(v) => setForm({ ...form, useExpandedContext: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Perfil activo</p>
                <p className="text-xs text-muted-foreground">Los perfiles inactivos no se ejecutan en el scraping automático.</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(v) => setForm({ ...form, isActive: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="gap-2"
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {editId ? "Guardar cambios" : "Crear perfil"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
