import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, Eye, EyeOff, Loader2, Save, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function AdminSettings() {
  const settingsQuery = trpc.admin.getSettings.useQuery();
  const updateMutation = trpc.admin.updateSettings.useMutation({
    onSuccess: () => toast.success("Configuración guardada"),
    onError: (e) => toast.error(e.message),
  });
  const validateMutation = trpc.admin.validateApifyToken.useMutation({
    onSuccess: (data) => {
      if (data.valid) toast.success("Token de Apify válido ✓");
      else toast.error("Token inválido o sin permisos suficientes");
    },
    onError: (e) => toast.error(e.message),
  });

  const [apifyToken, setApifyToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [minScore, setMinScore] = useState("0.5");
  const [maxResults, setMaxResults] = useState("50");
  const [apifyActorId, setApifyActorId] = useState("apify/linkedin-post-search-scraper");

  useEffect(() => {
    if (settingsQuery.data) {
      const map = Object.fromEntries(settingsQuery.data.map((s) => [s.key, s.value]));
      setApifyToken(map["apify_token"] ?? "");
      setMinScore(map["min_relevance_score"] ?? "0.5");
      setMaxResults(map["max_results_per_run"] ?? "50");
      setApifyActorId(map["apify_actor_id"] ?? "apify/linkedin-post-search-scraper");
    }
  }, [settingsQuery.data]);

  const handleSave = () => {
    updateMutation.mutate({
      settings: [
        { key: "apify_token", value: apifyToken },
        { key: "min_relevance_score", value: minScore },
        { key: "max_results_per_run", value: maxResults },
        { key: "apify_actor_id", value: apifyActorId },
      ],
    });
  };

  return (
    <AppLayout
      title="Configuración general"
      subtitle="Credenciales de Apify y parámetros del motor de scraping"
      actions={
        <Button onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
          {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar cambios
        </Button>
      }
    >
      <div className="max-w-2xl space-y-6">
        {/* Apify */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-accent" />
              </div>
              <div>
                <CardTitle className="text-base">Apify — Scraping de LinkedIn</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Configura tu API token de Apify para habilitar el scraping de publicaciones en LinkedIn.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* How to get token */}
            <div className="rounded-lg bg-muted/50 border border-border p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent" />
                Cómo obtener tu API token de Apify
              </p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>Ingresa a <a href="https://console.apify.com" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">console.apify.com</a> con tu cuenta.</li>
                <li>Haz clic en tu avatar (esquina superior derecha) → <strong>Settings</strong>.</li>
                <li>En el menú lateral selecciona <strong>Integrations</strong>.</li>
                <li>Copia el valor de <strong>Personal API token</strong> (empieza con <code className="bg-muted px-1 rounded">apify_api_…</code>).</li>
                <li>Pégalo en el campo de abajo y haz clic en <strong>Validar token</strong>.</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">API Token de Apify</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    type={showToken ? "text" : "password"}
                    value={apifyToken}
                    onChange={(e) => setApifyToken(e.target.value)}
                    placeholder="apify_api_xxxxxxxxxxxxxxxxxxxxxxxx"
                    className="pr-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <Button
                  variant="outline"
                  onClick={() => validateMutation.mutate({ token: apifyToken })}
                  disabled={!apifyToken || validateMutation.isPending}
                  className="gap-2 shrink-0"
                >
                  {validateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : validateMutation.data?.valid ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : validateMutation.isError ? (
                    <XCircle className="w-4 h-4 text-destructive" />
                  ) : (
                    <ShieldCheck className="w-4 h-4" />
                  )}
                  Validar token
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">ID del Actor de Apify</Label>
              <Input
                value={apifyActorId}
                onChange={(e) => setApifyActorId(e.target.value)}
                placeholder="apify/linkedin-post-search-scraper"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Actor recomendado:{" "}
                <a
                  href="https://apify.com/apify/linkedin-post-search-scraper"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  apify/linkedin-post-search-scraper
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Classification params */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Parámetros de clasificación</CardTitle>
            <CardDescription className="text-xs">
              Controla el umbral de relevancia y el volumen de resultados por ejecución.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Score mínimo de relevancia</Label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.05"
                  value={minScore}
                  onChange={(e) => setMinScore(e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Valor entre 0 y 1. Oportunidades por debajo de este umbral se descartan automáticamente.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Máx. resultados por ejecución</Label>
                <Input
                  type="number"
                  min="1"
                  max="200"
                  value={maxResults}
                  onChange={(e) => setMaxResults(e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Límite de publicaciones a procesar por cada corrida del scraper.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
