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
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Edit2,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface JobForm {
  name: string;
  description: string;
  hourColombia: string;
  isEnabled: boolean;
}

const emptyForm: JobForm = {
  name: "",
  description: "",
  hourColombia: "08:00",
  isEnabled: true,
};

export default function AdminSchedule() {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<JobForm>(emptyForm);

  const jobsQuery = trpc.admin.getScheduleJobs.useQuery();
  const utils = trpc.useUtils();

  const upsertMutation = trpc.admin.upsertScheduleJob.useMutation({
    onSuccess: () => {
      toast.success(editId ? "Programación actualizada" : "Programación creada");
      utils.admin.getScheduleJobs.invalidate();
      setOpen(false);
      setEditId(null);
      setForm(emptyForm);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.admin.deleteScheduleJob.useMutation({
    onSuccess: () => {
      toast.success("Programación eliminada");
      utils.admin.getScheduleJobs.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (job: NonNullable<typeof jobsQuery.data>[0]) => {
    setEditId(job.id);
    setForm({
      name: job.name,
      description: job.description ?? "",
      hourColombia: job.hourColombia ?? "08:00",
      isEnabled: job.isEnabled ?? true,
    });
    setOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return toast.error("El nombre es obligatorio");
    if (!form.hourColombia) return toast.error("La hora es obligatoria");
    upsertMutation.mutate({
      id: editId ?? undefined,
      name: form.name,
      description: form.description || undefined,
      hourColombia: form.hourColombia,
      isEnabled: form.isEnabled,
    });
  };

  const jobs = jobsQuery.data ?? [];

  // Compute UTC equivalent for display
  const toUtcLabel = (hourColombia: string) => {
    const [h, m] = (hourColombia ?? "00:00").split(":").map(Number);
    const utcH = (h + 5) % 24;
    return `${String(utcH).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")} UTC`;
  };

  return (
    <AppLayout
      title="Programación de ejecuciones"
      subtitle="Configura los horarios automáticos en hora Colombia (UTC-5)"
      actions={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva programación
        </Button>
      }
    >
      <div className="max-w-2xl space-y-4">
        {/* Info box */}
        <div className="rounded-lg bg-accent/5 border border-accent/20 p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-4 h-4 text-accent mt-0.5 shrink-0" />
            <div className="text-xs text-foreground/80 space-y-1">
              <p className="font-medium">Zona horaria: Colombia (UTC-5)</p>
              <p>
                Todos los horarios se ingresan en hora Colombia. El sistema los convierte automáticamente a UTC para la ejecución en el servidor.
              </p>
              <p>
                Se recomienda configurar al menos dos ejecuciones diarias (ej: 07:00 y 18:00 hora Colombia).
              </p>
            </div>
          </div>
        </div>

        {jobsQuery.isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : jobs.length === 0 ? (
          <Card className="border border-border shadow-sm">
            <CardContent className="p-10 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Sin programaciones</p>
              <p className="text-xs text-muted-foreground mt-1">
                Crea una programación para que el scraper se ejecute automáticamente.
              </p>
              <Button onClick={openCreate} className="mt-4 gap-2">
                <Plus className="w-4 h-4" /> Crear programación
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 stagger-children">
            {jobs.map((job) => (
              <Card
                key={job.id}
                className={cn(
                  "border shadow-sm transition-all",
                  job.isEnabled ? "border-border" : "border-border/50 opacity-60"
                )}
              >
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-primary/5 border border-border flex flex-col items-center justify-center shrink-0">
                        <span className="text-base font-bold text-primary tabular-nums leading-none">
                          {job.hourColombia?.split(":")[0] ?? "—"}
                        </span>
                        <span className="text-[10px] text-muted-foreground leading-none mt-0.5">
                          :{job.hourColombia?.split(":")[1] ?? "00"}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-foreground">{job.name}</p>
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium",
                              job.isEnabled
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {job.isEnabled ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                        {job.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{job.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            {job.hourColombia} hora Colombia · {toUtcLabel(job.hourColombia ?? "00:00")}
                          </span>
                          {job.lastRunAt && (
                            <span className="text-[10px] text-muted-foreground">
                              Última ejecución: {formatDistanceToNow(new Date(job.lastRunAt), { addSuffix: true, locale: es })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-muted-foreground hover:text-foreground"
                        onClick={() => openEdit(job)}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: job.id })}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialog ──────────────────────────────────────────────────────── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar programación" : "Nueva programación"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nombre *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ej: Ejecución matutina"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Opcional"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Hora de ejecución (hora Colombia, UTC-5) *</Label>
              <Input
                type="time"
                value={form.hourColombia}
                onChange={(e) => setForm({ ...form, hourColombia: e.target.value })}
                className="w-40"
              />
              {form.hourColombia && (
                <p className="text-xs text-muted-foreground">
                  Equivale a {toUtcLabel(form.hourColombia)} · Se ejecutará diariamente a esta hora.
                </p>
              )}
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Habilitada</p>
                <p className="text-xs text-muted-foreground">Las programaciones deshabilitadas no se ejecutan automáticamente.</p>
              </div>
              <Switch
                checked={form.isEnabled}
                onCheckedChange={(v) => setForm({ ...form, isEnabled: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={upsertMutation.isPending} className="gap-2">
              {upsertMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editId ? "Guardar cambios" : "Crear programación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
