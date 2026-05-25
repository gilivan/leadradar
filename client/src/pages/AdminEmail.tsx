import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import {
  CheckCircle2,
  Edit2,
  Eye,
  Loader2,
  Mail,
  Plus,
  Save,
  Send,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface TemplateForm {
  name: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  supportImageUrl: string;
  isDefault: boolean;
}

// ── Static preview HTML (sample digest email) ───────────────────────────────
const PREVIEW_HTML = `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>Vista previa</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:24px 12px;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;">
  <!-- Header -->
  <tr><td style="background:#1e293b;border-radius:12px 12px 0 0;padding:24px 28px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td><table cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="background:#f0b429;border-radius:8px;width:34px;height:34px;text-align:center;vertical-align:middle;"><span style="font-size:18px;line-height:34px;">&#9889;</span></td>
        <td style="padding-left:10px;vertical-align:middle;"><span style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-0.3px;">LeadRadar</span><br/><span style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Inteligencia Comercial</span></td>
      </tr></table></td>
      <td align="right" style="vertical-align:middle;"><span style="font-size:11px;color:#64748b;font-style:italic;">El Grupo</span></td>
    </tr></table>
  </td></tr>
  <!-- Banner -->
  <tr><td style="background:#f0b429;padding:16px 28px;">
    <p style="margin:0;font-size:14px;font-weight:700;color:#1e293b;">&#127919; 2 nuevas oportunidades comerciales detectadas</p>
    <p style="margin:4px 0 0;font-size:11px;color:#78350f;">Domingo, 25 de mayo de 2025 &mdash; hora Colombia</p>
  </td></tr>
  <!-- Body -->
  <tr><td style="background:#fff;padding:24px 28px 8px;">
    <p style="margin:0 0 6px;font-size:14px;font-weight:600;color:#0f172a;">Hola, equipo de El Grupo &#128075;</p>
    <p style="margin:0 0 20px;font-size:13px;color:#475569;line-height:1.7;">LeadRadar ha identificado <strong>2 nuevas oportunidades</strong> en LinkedIn que podr&iacute;an representar una apertura comercial para El Grupo. A continuaci&oacute;n encontrar&aacute;s el detalle de cada hallazgo.</p>
    <!-- Card 1 -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background:#f8fafc;padding:12px 18px;border-bottom:1px solid #e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td><span style="font-size:13px;font-weight:600;color:#0f172a;">Mar&iacute;a Rodr&iacute;guez</span><span style="font-size:12px;color:#64748b;margin-left:6px;">&middot; Directora de Marketing</span><span style="font-size:12px;color:#64748b;margin-left:4px;">@ Empresa XYZ</span></td>
          <td align="right"><span style="display:inline-block;padding:3px 10px;border-radius:20px;background:#16a34a;color:#fff;font-size:11px;font-weight:600;">Alta relevancia &middot; 92%</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#fff;padding:14px 18px;">
        <p style="margin:0 0 8px;font-size:12px;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">&#127919; busca agencia de publicidad</p>
        <p style="margin:0 0 10px;font-size:13px;color:#334155;line-height:1.65;">&ldquo;Estamos buscando una agencia de publicidad con experiencia en campa&ntilde;as digitales para el sector retail. Si conocen alguna, les agradezco la recomendaci&oacute;n&hellip;&rdquo;</p>
        <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;">&#128205; Bogot&aacute;, Colombia &middot; &#128273; agencia publicidad</p>
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:8px;"><a href="#" style="display:inline-block;padding:7px 16px;background:#1e293b;color:#f0b429;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">Ver en LeadRadar</a></td>
          <td><a href="#" style="display:inline-block;padding:7px 16px;background:#0a66c2;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">Ver en LinkedIn</a></td>
        </tr></table>
      </td></tr>
    </table>
    <!-- Card 2 -->
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:16px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background:#f8fafc;padding:12px 18px;border-bottom:1px solid #e2e8f0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td><span style="font-size:13px;font-weight:600;color:#0f172a;">Carlos Mej&iacute;a</span><span style="font-size:12px;color:#64748b;margin-left:6px;">&middot; CEO</span><span style="font-size:12px;color:#64748b;margin-left:4px;">@ Startup ABC</span></td>
          <td align="right"><span style="display:inline-block;padding:3px 10px;border-radius:20px;background:#d97706;color:#fff;font-size:11px;font-weight:600;">Media relevancia &middot; 74%</span></td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#fff;padding:14px 18px;">
        <p style="margin:0 0 8px;font-size:12px;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">&#127919; necesita estrategia de contenidos</p>
        <p style="margin:0 0 10px;font-size:13px;color:#334155;line-height:1.65;">&ldquo;&iquest;Alguien me puede recomendar una agencia de marketing de contenidos? Necesitamos reforzar nuestra presencia en redes sociales&hellip;&rdquo;</p>
        <p style="margin:0 0 12px;font-size:12px;color:#94a3b8;">&#128205; Medell&iacute;n, Colombia &middot; &#128273; marketing contenidos</p>
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:8px;"><a href="#" style="display:inline-block;padding:7px 16px;background:#1e293b;color:#f0b429;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">Ver en LeadRadar</a></td>
          <td><a href="#" style="display:inline-block;padding:7px 16px;background:#0a66c2;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">Ver en LinkedIn</a></td>
        </tr></table>
      </td></tr>
    </table>
  </td></tr>
  <!-- CTA -->
  <tr><td style="background:#fff;padding:8px 28px 28px;text-align:center;">
    <a href="#" style="display:inline-block;padding:12px 28px;background:#1e293b;color:#f0b429;text-decoration:none;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:0.02em;">Ver todas las oportunidades en LeadRadar &rarr;</a>
  </td></tr>
  <!-- Divider -->
  <tr><td style="background:#fff;padding:0 28px;"><hr style="border:none;border-top:1px solid #e2e8f0;margin:0;"/></td></tr>
  <!-- Footer -->
  <tr><td style="background:#fff;border-radius:0 0 12px 12px;padding:18px 28px 22px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td><p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.6;">No responder este correo, dado que se ha generado de forma autom&aacute;tica por <strong>LeadRadar</strong>.</p><p style="margin:5px 0 0;font-size:11px;color:#cbd5e1;">Powered by LeadRadar &middot; <a href="https://elgrupo.com.co" style="color:#94a3b8;">El Grupo</a></p></td>
      <td align="right" style="vertical-align:bottom;"><span style="font-size:11px;color:#94a3b8;font-style:italic;">El Grupo</span></td>
    </tr></table>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

const emptyTemplate: TemplateForm = {
  name: "",
  subject: "LeadRadar — {{count}} nuevas oportunidades comerciales detectadas",
  bodyHtml: `<!-- Plantilla generada automáticamente por LeadRadar.
     El sistema envía un correo consolidado con todas las oportunidades detectadas.
     Las variables {{authorName}}, {{rawText}}, {{linkedinUrl}}, etc. se reemplazan
     automáticamente por el motor de plantillas. -->
<p>Este campo se usa como asunto del correo. El cuerpo HTML es generado
automáticamente por LeadRadar con el diseño oficial de El Grupo.</p>`,
  bodyText: "",
  supportImageUrl: "",
  isDefault: false,
};

export default function AdminEmail() {
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [recipient, setRecipient] = useState("");
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const [minScoreAlert, setMinScoreAlert] = useState("0.7");

  const [templateOpen, setTemplateOpen] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState<TemplateForm>(emptyTemplate);
  const [previewOpen, setPreviewOpen] = useState(false);

  const settingsQuery = trpc.admin.getSettings.useQuery();
  const templatesQuery = trpc.admin.getEmailTemplates.useQuery();
  const utils = trpc.useUtils();

  const updateMutation = trpc.admin.updateSettings.useMutation({
    onSuccess: () => toast.success("Configuración de correo guardada"),
    onError: (e) => toast.error(e.message),
  });

  const testMutation = trpc.admin.testEmailConnection.useMutation({
    onSuccess: (data) => {
      if (data.success) toast.success("Conexión SMTP exitosa ✓");
      else toast.error(`Error de conexión: ${data.message}`);
    },
    onError: (e) => toast.error(e.message),
  });

  const createTemplateMutation = trpc.admin.createEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success("Plantilla creada");
      utils.admin.getEmailTemplates.invalidate();
      setTemplateOpen(false);
      setTemplateForm(emptyTemplate);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTemplateMutation = trpc.admin.updateEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success("Plantilla actualizada");
      utils.admin.getEmailTemplates.invalidate();
      setTemplateOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTemplateMutation = trpc.admin.deleteEmailTemplate.useMutation({
    onSuccess: () => {
      toast.success("Plantilla eliminada");
      utils.admin.getEmailTemplates.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  useEffect(() => {
    if (settingsQuery.data) {
      const map = Object.fromEntries(settingsQuery.data.map((s) => [s.key, s.value]));
      setSmtpHost(map["smtp_host"] ?? "");
      setSmtpPort(map["smtp_port"] ?? "587");
      setSmtpUser(map["smtp_user"] ?? "");
      setSmtpPass(map["smtp_pass"] ?? "");
      setRecipient(map["email_recipient"] ?? "");
      setAlertsEnabled(map["email_alerts_enabled"] === "true");
      setMinScoreAlert(map["email_min_score"] ?? "0.7");
    }
  }, [settingsQuery.data]);

  const handleSaveSmtp = () => {
    updateMutation.mutate({
      settings: [
        { key: "smtp_host", value: smtpHost },
        { key: "smtp_port", value: smtpPort },
        { key: "smtp_user", value: smtpUser },
        { key: "smtp_pass", value: smtpPass },
        { key: "email_recipient", value: recipient },
        { key: "email_alerts_enabled", value: String(alertsEnabled) },
        { key: "email_min_score", value: minScoreAlert },
      ],
    });
  };

  const openCreateTemplate = () => {
    setEditTemplateId(null);
    setTemplateForm(emptyTemplate);
    setTemplateOpen(true);
  };

  const openEditTemplate = (t: NonNullable<typeof templatesQuery.data>[0]) => {
    setEditTemplateId(t.id);
    setTemplateForm({
      name: t.name,
      subject: t.subject,
      bodyHtml: t.bodyHtml,
      bodyText: t.bodyText ?? "",
      supportImageUrl: t.supportImageUrl ?? "",
      isDefault: t.isDefault ?? false,
    });
    setTemplateOpen(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name.trim()) return toast.error("El nombre es obligatorio");
    if (!templateForm.subject.trim()) return toast.error("El asunto es obligatorio");
    if (!templateForm.bodyHtml.trim()) return toast.error("El cuerpo HTML es obligatorio");

    if (editTemplateId) {
      updateTemplateMutation.mutate({ id: editTemplateId, ...templateForm });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  return (
    <AppLayout
      title="Alertas por correo"
      subtitle="Configura el servidor SMTP y las plantillas de notificación"
    >
      <div className="max-w-3xl">
        <Tabs defaultValue="smtp">
          <TabsList className="mb-6">
            <TabsTrigger value="smtp">Servidor SMTP</TabsTrigger>
            <TabsTrigger value="templates">Plantillas</TabsTrigger>
          </TabsList>

          {/* ── SMTP ──────────────────────────────────────────────────── */}
          <TabsContent value="smtp" className="space-y-5">
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Configuración SMTP</CardTitle>
                    <CardDescription className="text-xs mt-0.5">
                      Credenciales del servidor de correo para enviar alertas automáticas.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2 space-y-2">
                    <Label className="text-sm font-medium">Host SMTP</Label>
                    <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.gmail.com" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Puerto</Label>
                    <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Usuario</Label>
                    <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} placeholder="correo@empresa.com" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Contraseña</Label>
                    <Input type="password" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} placeholder="••••••••" />
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      testMutation.mutate({
                        host: smtpHost,
                        port: parseInt(smtpPort),
                        user: smtpUser,
                        password: smtpPass,
                      })
                    }
                    disabled={!smtpHost || testMutation.isPending}
                    className="gap-2"
                  >
                    {testMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : testMutation.data?.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : testMutation.isError ? (
                      <XCircle className="w-4 h-4 text-destructive" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Probar conexión
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Destinatario y condiciones de alerta</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Correo destinatario</Label>
                  <Input
                    type="email"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    placeholder="oportunidades@elgrupo.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dirección a la que se enviarán las alertas de nuevas oportunidades.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Score mínimo para alerta</Label>
                  <Input
                    type="number"
                    min="0"
                    max="1"
                    step="0.05"
                    value={minScoreAlert}
                    onChange={(e) => setMinScoreAlert(e.target.value)}
                    className="w-32"
                  />
                  <p className="text-xs text-muted-foreground">
                    Solo se enviarán alertas para oportunidades con score ≥ este valor.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Alertas habilitadas</p>
                    <p className="text-xs text-muted-foreground">
                      Cuando está activo, se envía un correo consolidado con todas las oportunidades de alta relevancia detectadas en cada ejecución.
                    </p>
                  </div>
                  <Switch checked={alertsEnabled} onCheckedChange={setAlertsEnabled} />
                </div>
                <Button onClick={handleSaveSmtp} disabled={updateMutation.isPending} className="gap-2">
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Guardar configuración
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Templates ─────────────────────────────────────────────── */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Las plantillas definen el asunto, cuerpo e imagen de las alertas por correo.
                Usa variables como <code className="bg-muted px-1 rounded text-xs">{"{{authorName}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{rawText}}"}</code>,{" "}
                <code className="bg-muted px-1 rounded text-xs">{"{{relevanceScore}}"}</code>.
              </p>
              <Button onClick={openCreateTemplate} size="sm" className="gap-2 shrink-0">
                <Plus className="w-4 h-4" /> Nueva plantilla
              </Button>
            </div>

            {templatesQuery.isLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (templatesQuery.data ?? []).length === 0 ? (
              <Card className="border border-border shadow-sm">
                <CardContent className="p-10 text-center">
                  <Mail className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-foreground">Sin plantillas</p>
                  <p className="text-xs text-muted-foreground mt-1">Crea una plantilla para personalizar las alertas.</p>
                  <Button onClick={openCreateTemplate} className="mt-4 gap-2" size="sm">
                    <Plus className="w-4 h-4" /> Crear plantilla
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {(templatesQuery.data ?? []).map((t) => (
                  <Card key={t.id} className="border border-border shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{t.name}</p>
                            {t.isDefault && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-medium">
                                <Star className="w-2.5 h-2.5" /> Predeterminada
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">Asunto: {t.subject}</p>
                          {t.supportImageUrl && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Con imagen de apoyo</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 ml-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground hover:text-blue-500"
                            title="Vista previa del correo"
                            onClick={() => setPreviewOpen(true)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground hover:text-foreground"
                            onClick={() => openEditTemplate(t)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 text-muted-foreground hover:text-destructive"
                            onClick={() => deleteTemplateMutation.mutate({ id: t.id })}
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
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Template dialog ─────────────────────────────────────────────── */}
      {/* ── Email preview dialog ──────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> Vista previa del correo de notificación
            </DialogTitle>
          </DialogHeader>
          <div className="rounded-lg overflow-hidden border border-border">
            <iframe
              title="Email preview"
              srcDoc={PREVIEW_HTML}
              className="w-full"
              style={{ height: "600px", border: "none" }}
              sandbox="allow-same-origin"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTemplateId ? "Editar plantilla" : "Nueva plantilla de correo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nombre *</Label>
                <Input
                  value={templateForm.name}
                  onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder="Plantilla principal"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Asunto *</Label>
                <Input
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  placeholder="Nueva oportunidad en LinkedIn"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cuerpo HTML *</Label>
              <Textarea
                value={templateForm.bodyHtml}
                onChange={(e) => setTemplateForm({ ...templateForm, bodyHtml: e.target.value })}
                className="font-mono text-xs h-48 resize-none"
                placeholder="<h2>...</h2>"
              />
              <p className="text-xs text-muted-foreground">
                Variables disponibles: <code className="bg-muted px-1 rounded">{"{{authorName}}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{{authorTitle}}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{{authorCompany}}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{{rawText}}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{{relevanceScore}}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{{linkedinUrl}}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{{country}}"}</code>{" "}
                <code className="bg-muted px-1 rounded">{"{{city}}"}</code>
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cuerpo texto plano</Label>
              <Textarea
                value={templateForm.bodyText}
                onChange={(e) => setTemplateForm({ ...templateForm, bodyText: e.target.value })}
                className="text-sm h-20 resize-none"
                placeholder="Versión de texto plano del correo…"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">URL imagen de apoyo</Label>
              <Input
                value={templateForm.supportImageUrl}
                onChange={(e) => setTemplateForm({ ...templateForm, supportImageUrl: e.target.value })}
                placeholder="https://…/imagen.png"
              />
              <p className="text-xs text-muted-foreground">
                URL pública de una imagen que se incluirá en el correo (banner, logo, etc.).
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-foreground">Plantilla predeterminada</p>
                <p className="text-xs text-muted-foreground">Se usará esta plantilla para todas las alertas automáticas.</p>
              </div>
              <Switch
                checked={templateForm.isDefault}
                onCheckedChange={(v) => setTemplateForm({ ...templateForm, isDefault: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
              className="gap-2"
            >
              {(createTemplateMutation.isPending || updateTemplateMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              {editTemplateId ? "Guardar cambios" : "Crear plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
