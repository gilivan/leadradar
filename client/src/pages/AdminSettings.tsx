import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import {
  Brain,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Save,
  ShieldCheck,
  Sparkles,
  XCircle,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type LLMProvider = "manus" | "openai" | "anthropic" | "gemini" | "groq";

const PROVIDER_INFO: Record<
  LLMProvider,
  { label: string; placeholder: string; models: string[]; docsUrl: string; hint: string }
> = {
  manus: {
    label: "Manus (interno, por defecto)",
    placeholder: "No se requiere API key",
    models: [],
    docsUrl: "",
    hint: "Usa el LLM interno de la plataforma Manus. No requiere configuración adicional.",
  },
  openai: {
    label: "OpenAI (GPT-4o / GPT-4o-mini)",
    placeholder: "sk-proj-…",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    docsUrl: "https://platform.openai.com/api-keys",
    hint: "Obtén tu API key en platform.openai.com → API Keys.",
  },
  anthropic: {
    label: "Anthropic Claude",
    placeholder: "sk-ant-…",
    models: ["claude-3-5-haiku-20241022", "claude-3-5-sonnet-20241022", "claude-3-opus-20240229"],
    docsUrl: "https://console.anthropic.com/settings/keys",
    hint: "Obtén tu API key en console.anthropic.com → API Keys.",
  },
  gemini: {
    label: "Google Gemini",
    placeholder: "AIza…",
    models: ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-3.1-flash-lite"],
    docsUrl: "https://aistudio.google.com/app/apikey",
    hint: "Obtén tu API key en Google AI Studio → Get API Key. Flash es el modelo recomendado (tier gratuito).",
  },
  groq: {
    label: "Groq (Llama — muy rápido)",
    placeholder: "gsk_…",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "openai/gpt-oss-20b"],
    docsUrl: "https://console.groq.com/keys",
    hint: "Obtén tu API key en console.groq.com → API Keys. Tier gratuito disponible.",
  },
};

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
  const saveLLMMutation = trpc.admin.saveLLMConfig.useMutation({
    onSuccess: () => toast.success("Configuración de IA guardada"),
    onError: (e) => toast.error(e.message),
  });
  const testLLMMutation = trpc.admin.testLLMConnection.useMutation({
    onSuccess: (data) => toast.success(data.message),
    onError: (e) => toast.error(`Error: ${e.message}`),
  });
  const reclassifyMutation = trpc.admin.reclassifyHistorical.useMutation({
    onSuccess: (summary) => toast.success(`Histórico recalibrado: ${summary.qualified} calificadas, ${summary.review} por revisar y ${summary.discarded} descartadas.`),
    onError: (e) => toast.error(e.message),
  });

  // Apify / classification state
  const [apifyToken, setApifyToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [minCommercialScore, setMinCommercialScore] = useState("75");
  const [minConfidence, setMinConfidence] = useState("0.85");
  const [maxResults, setMaxResults] = useState("50");
  const [apifyActorId, setApifyActorId] = useState("apify/linkedin-post-search-scraper");

  // LLM state
  const [llmProvider, setLlmProvider] = useState<LLMProvider>("manus");
  const [llmApiKey, setLlmApiKey] = useState("");
  const [llmModel, setLlmModel] = useState("");
  const [showLlmKey, setShowLlmKey] = useState(false);

  useEffect(() => {
    if (settingsQuery.data) {
      const map = Object.fromEntries(settingsQuery.data.map((s) => [s.key, s.value ?? ""]));
      setApifyToken(map["apify_token"] ?? "");
      const legacyScore = Number.parseFloat(map["min_relevance_score"] ?? "0.75");
      setMinCommercialScore(map["min_commercial_score"] ?? String(legacyScore <= 1 ? Math.round(legacyScore * 100) : legacyScore));
      setMinConfidence(map["min_classification_confidence"] ?? "0.85");
      setMaxResults(map["max_results_per_run"] ?? "50");
      setApifyActorId(map["apify_actor_id"] ?? "apify/linkedin-post-search-scraper");
      setLlmProvider((map["llm_provider"] as LLMProvider) ?? "manus");
      setLlmApiKey(map["llm_api_key"] ?? "");
      setLlmModel(map["llm_model"] ?? "");
    }
  }, [settingsQuery.data]);

  const handleSaveApify = () => {
    updateMutation.mutate({
      settings: [
        { key: "apify_token", value: apifyToken },
        { key: "min_commercial_score", value: minCommercialScore },
        { key: "min_classification_confidence", value: minConfidence },
        { key: "max_results_per_run", value: maxResults },
        { key: "apify_actor_id", value: apifyActorId },
      ],
    });
  };

  const handleSaveLLM = () => {
    saveLLMMutation.mutate({
      provider: llmProvider,
      apiKey: llmApiKey || undefined,
      model: llmModel || undefined,
    });
  };

  const providerInfo = PROVIDER_INFO[llmProvider];

  return (
    <AppLayout
      title="Configuración general"
      subtitle="Credenciales de Apify, motor de scraping e inteligencia artificial"
    >
      <div className="max-w-2xl space-y-6">

        {/* ── Apify ──────────────────────────────────────────────────────── */}
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Puntaje comercial mínimo</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={minCommercialScore}
                  onChange={(e) => setMinCommercialScore(e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
Solo una solicitud calificada puede activar alerta a partir de este puntaje. Recomendado: 75.
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
                  Límite de publicaciones a procesar por corrida.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Confianza mínima para alertas</Label>
              <Input type="number" min="0" max="1" step="0.05" value={minConfidence} onChange={(e) => setMinConfidence(e.target.value)} className="text-sm" />
              <p className="text-xs text-muted-foreground">Exige evidencia suficiente antes de alertar. Recomendado: 0.85.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSaveApify} disabled={updateMutation.isPending} className="gap-2">
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar configuración Apify
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── LLM Provider ───────────────────────────────────────────────── */}
        <Card className="border border-border shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Brain className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Proveedor de Inteligencia Artificial</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Selecciona el modelo de lenguaje que clasificará oportunidades y expandirá contextos de búsqueda.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Provider selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Proveedor LLM</Label>
              <Select value={llmProvider} onValueChange={(v) => {
                setLlmProvider(v as LLMProvider);
                setLlmModel("");
                setLlmApiKey("");
              }}>
                <SelectTrigger className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_INFO) as LLMProvider[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_INFO[p].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{providerInfo.hint}</p>
            </div>

            {/* API Key — hidden for Manus */}
            {llmProvider !== "manus" && (
              <>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">API Key</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        type={showLlmKey ? "text" : "password"}
                        value={llmApiKey}
                        onChange={(e) => setLlmApiKey(e.target.value)}
                        placeholder={providerInfo.placeholder}
                        className="pr-10 font-mono text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowLlmKey(!showLlmKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showLlmKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {providerInfo.docsUrl && (
                      <a
                        href={providerInfo.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                      >
                        <Button variant="outline" type="button" className="gap-2">
                          <ShieldCheck className="w-4 h-4" />
                          Obtener key
                        </Button>
                      </a>
                    )}
                  </div>
                </div>

                {/* Model selector */}
                {providerInfo.models.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Modelo</Label>
                    <Select
                      value={llmModel || providerInfo.models[0]}
                      onValueChange={setLlmModel}
                    >
                      <SelectTrigger className="text-sm font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {providerInfo.models.map((m) => (
                          <SelectItem key={m} value={m} className="font-mono text-sm">
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Modelo recomendado para clasificación: <strong>{providerInfo.models[0]}</strong> (mejor relación costo/precisión).
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Manus default notice */}
            {llmProvider === "manus" && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
                <p className="text-xs text-muted-foreground flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>
                    El LLM interno de Manus está activo. No se requiere API key ni configuración adicional.
                    Los tres servicios de IA (clasificador, expansor de contexto y extractor de señales de feedback)
                    usarán este modelo automáticamente.
                  </span>
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 justify-end pt-1">
              <Button
                variant="outline"
                onClick={() => testLLMMutation.mutate()}
                disabled={testLLMMutation.isPending || (llmProvider !== "manus" && !llmApiKey)}
                className="gap-2"
              >
                {testLLMMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : testLLMMutation.isSuccess ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : testLLMMutation.isError ? (
                  <XCircle className="w-4 h-4 text-destructive" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Probar conexión
              </Button>
              <Button
                onClick={handleSaveLLM}
                disabled={saveLLMMutation.isPending}
                className="gap-2"
              >
                {saveLLMMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                Guardar configuración IA
              </Button>
            </div>
          </CardContent>
                </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Recalibración del histórico</CardTitle>
            <CardDescription className="text-xs">Procesa 100 candidatos antiguos por vez con la clasificación de intención comercial. No envía correos ni borra publicaciones.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-xs text-muted-foreground max-w-xl">El proceso conserva la evidencia y los motivos de descarte. Repite por lotes hasta vaciar la cola pendiente.</p>
            <Button variant="outline" onClick={() => reclassifyMutation.mutate({ limit: 100 })} disabled={reclassifyMutation.isPending} className="gap-2">
              {reclassifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Recalibrar 100 registros
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
