import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  Edit2,
  Globe,
  Loader2,
  MapPin,
  Plus,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ProfileForm {
  name: string;
  country: string;
  city: string;
  keywords: string;
  isActive: boolean;
}

const emptyForm: ProfileForm = {
  name: "",
  country: "",
  city: "",
  keywords: "",
  isActive: true,
};

export default function AdminProfiles() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<ProfileForm>(emptyForm);

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

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (p: NonNullable<typeof profilesQuery.data>[0]) => {
    setEditId(p.id);
    setForm({
      name: p.name,
      country: p.country ?? "",
      city: p.city ?? "",
      keywords: ((p.keywords as string[]) ?? []).join(", "),
      isActive: p.isActive ?? true,
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
        country: form.country || undefined,
        city: form.city || undefined,
        keywords,
        isActive: form.isActive,
      });
    } else {
      createMutation.mutate({
        name: form.name,
        country: form.country || undefined,
        city: form.city || undefined,
        keywords,
        isActive: form.isActive,
      });
    }
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
            {profiles.map((profile) => {
              const keywords = (profile.keywords as string[]) ?? [];
              return (
                <Card
                  key={profile.id}
                  className={cn(
                    "border shadow-sm transition-all hover:shadow-md",
                    profile.isActive ? "border-border" : "border-border/50 opacity-60"
                  )}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-foreground truncate">{profile.name}</h3>
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
                        </div>
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

                    <div className="space-y-2">
                      {(profile.country || profile.city) && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>{[profile.city, profile.country].filter(Boolean).join(", ")}</span>
                        </div>
                      )}
                      {!profile.country && !profile.city && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Globe className="w-3.5 h-3.5 shrink-0" />
                          <span>Global (sin región específica)</span>
                        </div>
                      )}
                      <div className="flex items-start gap-2">
                        <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <div className="flex flex-wrap gap-1">
                          {keywords.slice(0, 5).map((kw) => (
                            <span
                              key={kw}
                              className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-[10px] font-medium"
                            >
                              {kw}
                            </span>
                          ))}
                          {keywords.length > 5 && (
                            <span className="text-[10px] text-muted-foreground">+{keywords.length - 5} más</span>
                          )}
                        </div>
                      </div>
                    </div>
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
                placeholder="Ej: Colombia — Agencias de marketing"
              />
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
              <Label className="text-sm font-medium">Keywords *</Label>
              <Input
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="agencia publicidad, marketing digital, campaña…"
              />
              <p className="text-xs text-muted-foreground">
                Separa las palabras clave con comas. Cada keyword se buscará de forma independiente.
              </p>
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
