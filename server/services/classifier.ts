/**
 * Classifier Service — Detects commercial purchase intent in LinkedIn posts.
 *
 * A keyword match is only a recovered candidate, never a commercial opportunity.
 * Deterministic exclusions remove evident noise before a configured LLM produces
 * an auditable, structured decision for the remaining candidates.
 */

import { invokeConfiguredLLM } from "./llmRouter";
import type { LinkedInPost } from "./apify";

export type ClassificationDecision = "qualified" | "review" | "discarded" | "pending";
export type AuthorSide = "buyer" | "provider" | "intermediary" | "job_seeker" | "unknown";

export interface ClassificationResult {
  relevanceScore: number;
  relevanceLabel: "high" | "medium" | "low" | "irrelevant";
  commercialScore: number;
  classificationDecision: ClassificationDecision;
  classificationConfidence: number;
  classificationReason: string;
  detectedKeywords: string[];
  intentCategory: string;
  authorSide: AuthorSide;
  serviceCategories: string[];
  evidence: string[];
  exclusionReasons: string[];
  classificationVersion: string;
}

/** Preserved for callers and historical data, but not used to promote n-grams. */
export interface FeedbackRule {
  pattern: string;
  signal: "positive" | "negative";
  weight: number;
}

type ExclusionRule = { reason: string; pattern: RegExp };
type IntentSignal = {
  category: "busca_agencia" | "solicita_recomendaciones" | "rfp_licitacion" | "busca_proveedor" | "alianza_b2b";
  label: string;
  pattern: RegExp;
};

const CLASSIFICATION_VERSION = "intent-v2";
const MAX_TEXT_LENGTH = 3500;
const PROVIDER = "agencia(?:s)?|agenc(?:y|ies)|consultora(?:s)?|firma(?:s)?|proveedor(?:es)?|partner(?:s)?|aliado(?:s)?|freelancer(?:s)?|equipo(?:s)?";

const EXCLUSION_RULES: ExclusionRule[] = [
  { reason: "vacante_o_busqueda_de_talento", pattern: /\b(vacante|vacantes|oferta laboral|hiring|we(?:'|’)re hiring|job opening|job opportunity|internship|intern|practicante|prácticas|apply now|apply today)\b/i },
  { reason: "rol_laboral_en_vez_de_proveedor", pattern: /\b(busco|buscamos|necesito|necesitamos|looking for|seeking)\s+(?:un|una|a|an)?\s*(?:account manager|media buyer|community manager|copywriter|diseñador(?:a)?|designer|analista|analyst|specialist|especialista|manager|ejecutivo(?:a)?|practicante|intern|trafficker|recruiter|reclutador(?:a)?)\b/i },
  { reason: "autopromocion_de_proveedor", pattern: /\b(somos\s+(?:una|la)\s+agencia|our agency|mi agencia|my agency|en nuestra agencia|we help (?:brands|businesses|companies)|ayudamos a (?:marcas|empresas|negocios)|nuestros servicios|our services|agenda una llamada|book a call|contáctanos|contact us|caso de éxito|case study)\b/i },
  { reason: "republicacion_de_tercero", pattern: /\b(#solocomparto|solo comparto|comparto algunas vacantes|repost|republicación|republicado)\b/i },
  { reason: "tipo_de_agencia_fuera_del_servicio_objetivo", pattern: /\b(agencia de viajes|travel agency|agencia inmobiliaria|real estate agency|agencia de empleo|employment agency|agencia de reclutamiento|recruitment agency|agencia de noticias|news agency|agencia gubernamental|government agency)\b/i },
  { reason: "descarta_agencias_expresamente", pattern: /\b(no agencias?|not (?:an )?agenc(?:y|ies)|sin agencia)\b/i },
  { reason: "sector_restringido", pattern: /\b(onlyfans|i\s*gaming|igaming|casino|apuestas|betting|contenido adulto|adult content)\b/i },
];

const INTENT_SIGNALS: IntentSignal[] = [
  { category: "busca_agencia", label: "búsqueda explícita de agencia o proveedor", pattern: new RegExp(`\\b(busco|buscamos|estoy buscando|estamos buscando|estoy en búsqueda|nos encontramos en la búsqueda|necesito|necesitamos|requerimos|solicito|solicitamos|looking for|seeking|in search of)\\b[\\s\\S]{0,180}\\b(${PROVIDER})\\b`, "i") },
  { category: "solicita_recomendaciones", label: "solicitud de recomendaciones de proveedor", pattern: new RegExp(`\\b(recomendaciones|recomiendan|recomiéndenme|alguna reco|recommendations|referrals|referidos)\\b[\\s\\S]{0,180}\\b(${PROVIDER})\\b|\\b(${PROVIDER})\\b[\\s\\S]{0,180}\\b(recomendaciones|recomiendan|recomiéndenme|alguna reco|recommendations|referrals|referidos)\\b`, "i") },
  { category: "rfp_licitacion", label: "señal de proceso de compra", pattern: new RegExp(`\\b(rfp|licitación|licitaciones|convocatoria|términos de referencia|brief|propuesta(?:s)?|cotización|cotizaciones|fee mensual|presupuesto|budget)\\b[\\s\\S]{0,220}\\b(${PROVIDER})\\b|\\b(${PROVIDER})\\b[\\s\\S]{0,220}\\b(rfp|licitación|licitaciones|convocatoria|términos de referencia|brief|propuesta(?:s)?|cotización|cotizaciones|fee mensual|presupuesto|budget)\\b`, "i") },
  { category: "busca_proveedor", label: "búsqueda explícita de proveedor", pattern: /\b(busco|buscamos|necesito|necesitamos|looking for|seeking)\s+proveedores?\b/i },
  { category: "alianza_b2b", label: "búsqueda de aliado o partner comercial", pattern: /\b(busco|buscamos|looking for|seeking)\b[\s\S]{0,120}\b(aliado estratégico|strategic partner|partner comercial|agency partner|colaborar con una agencia)\b/i },
];

const SERVICE_RULES: Array<{ category: string; pattern: RegExp }> = [
  { category: "paid_media_performance", pattern: /\b(performance|paid media|media buying|google ads|meta ads|facebook ads|linkedin ads|tiktok ads|pauta|ppc|sem)\b/i },
  { category: "social_media_contenido", pattern: /\b(social media|redes sociales|community management|community manager|contenido(?:s)?|content marketing)\b/i },
  { category: "influencer_marketing", pattern: /\b(influencer|creadores(?: de contenido)?|creator(?:s)?|ugc)\b/i },
  { category: "seo_lead_generation", pattern: /\b(seo|search engine optimization|lead generation|generación de leads|demand generation)\b/i },
  { category: "branding_diseno_creativo", pattern: /\b(branding|identidad (?:visual|de marca)|diseño|design|agencia creativa|creative agency)\b/i },
  { category: "pr_comunicaciones", pattern: /\b(relaciones públicas|public relations|\bpr\b|comunicación(?:es)? estratégica|corporate communications)\b/i },
  { category: "web_ecommerce", pattern: /\b(página web|website|web development|desarrollo web|ecommerce|e-commerce|shopify)\b/i },
  { category: "crm_automatizacion", pattern: /\b(hubspot|crm|automatización|automation|inbound marketing|email marketing)\b/i },
  { category: "btl_activaciones", pattern: /\b(btl|activaciones|activación de marca|punto de venta|material pop)\b/i },
  { category: "marketing_general", pattern: /\b(marketing|publicidad|advertising|agencia de medios|media agency)\b/i },
];

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function scoreToLabel(score: number): "high" | "medium" | "low" | "irrelevant" {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.25) return "low";
  return "irrelevant";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Some providers implement JSON mode as a best effort. Normalize their output
 * before applying commercial guardrails so omitted optional arrays do not cause
 * a runtime error or leave an otherwise usable record in pending state.
 */
export function normalizeLLMClassification(value: unknown): Omit<ClassificationResult, "relevanceScore" | "relevanceLabel" | "classificationVersion"> {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const decision = raw.classificationDecision;
  const authorSide = raw.authorSide;
  const commercialScore = typeof raw.commercialScore === "number" && Number.isFinite(raw.commercialScore)
    ? raw.commercialScore
    : 0;
  const confidence = typeof raw.classificationConfidence === "number" && Number.isFinite(raw.classificationConfidence)
    ? raw.classificationConfidence
    : 0;

  return {
    classificationDecision: decision === "qualified" || decision === "review" || decision === "discarded" ? decision : "review",
    commercialScore,
    classificationConfidence: confidence,
    classificationReason: typeof raw.classificationReason === "string" && raw.classificationReason.trim()
      ? raw.classificationReason
      : "El modelo devolvió una decisión parcial; requiere revisión humana.",
    detectedKeywords: asStringArray(raw.detectedKeywords),
    intentCategory: typeof raw.intentCategory === "string" ? raw.intentCategory : "no_aplica",
    authorSide: authorSide === "buyer" || authorSide === "provider" || authorSide === "intermediary" || authorSide === "job_seeker" || authorSide === "unknown"
      ? authorSide
      : "unknown",
    serviceCategories: asStringArray(raw.serviceCategories),
    evidence: asStringArray(raw.evidence),
    exclusionReasons: asStringArray(raw.exclusionReasons),
  };
}

export function parseLLMJson(rawContent: unknown): unknown {
  const jsonText = (typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent))
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  return JSON.parse(jsonText);
}

function buildResult(
  partial: Omit<ClassificationResult, "relevanceScore" | "relevanceLabel" | "classificationVersion"> &
    Partial<Pick<ClassificationResult, "relevanceScore" | "relevanceLabel" | "classificationVersion">>
): ClassificationResult {
  const commercialScore = Math.max(0, Math.min(100, Math.round(partial.commercialScore)));
  const relevanceScore = partial.classificationDecision === "qualified" ? commercialScore / 100 : 0;
  return {
    relevanceScore,
    relevanceLabel: partial.classificationDecision === "qualified" ? scoreToLabel(relevanceScore) : "irrelevant",
    commercialScore,
    classificationDecision: partial.classificationDecision,
    classificationConfidence: Math.max(0, Math.min(1, partial.classificationConfidence)),
    classificationReason: partial.classificationReason,
    detectedKeywords: partial.detectedKeywords.slice(0, 8),
    intentCategory: partial.intentCategory,
    authorSide: partial.authorSide,
    serviceCategories: partial.serviceCategories.slice(0, 6),
    evidence: partial.evidence.slice(0, 3),
    exclusionReasons: partial.exclusionReasons.slice(0, 4),
    classificationVersion: partial.classificationVersion || CLASSIFICATION_VERSION,
  };
}

export function preClassifyPost(post: Pick<LinkedInPost, "text">): ClassificationResult | null {
  const text = normalizeText(post.text || "");
  const exclusions = EXCLUSION_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.reason);
  const services = SERVICE_RULES.filter((rule) => rule.pattern.test(text)).map((rule) => rule.category);
  const signals = INTENT_SIGNALS.filter((signal) => signal.pattern.test(text));

  if (exclusions.length > 0) {
    return buildResult({ commercialScore: 0, classificationDecision: "discarded", classificationConfidence: 0.98, classificationReason: `Descartado antes del análisis semántico: ${exclusions.join(", ")}.`, detectedKeywords: services, intentCategory: "no_aplica", authorSide: exclusions.some((reason) => reason.includes("vacante")) ? "job_seeker" : "provider", serviceCategories: services, evidence: [], exclusionReasons: exclusions });
  }
  if (signals.length === 0) {
    return buildResult({ commercialScore: 0, classificationDecision: "discarded", classificationConfidence: 0.92, classificationReason: "No hay una señal explícita de búsqueda, recomendación o proceso de compra de un proveedor.", detectedKeywords: services, intentCategory: "no_aplica", authorSide: "unknown", serviceCategories: services, evidence: [], exclusionReasons: ["sin_intencion_comercial_explicita"] });
  }
  if (services.length === 0) {
    return buildResult({ commercialScore: 0, classificationDecision: "review", classificationConfidence: 0.55, classificationReason: "Hay intención de búsqueda de proveedor, pero el servicio solicitado no coincide claramente con el catálogo objetivo.", detectedKeywords: [], intentCategory: signals[0].category, authorSide: "unknown", serviceCategories: [], evidence: signals.map((signal) => signal.label), exclusionReasons: [] });
  }
  return null;
}

export async function classifyPost(post: LinkedInPost, _feedbackRules: FeedbackRule[] = []): Promise<ClassificationResult> {
  const preClassification = preClassifyPost(post);
  if (preClassification) return preClassification;

  const knownServices = SERVICE_RULES.filter((rule) => rule.pattern.test(post.text || "")).map((rule) => rule.category);
  const prompt = `Eres un clasificador conservador de oportunidades B2B para El Grupo, una agencia de marketing, publicidad, comunicación, activaciones, estrategia, creatividad, contenidos y medios.

Clasifica el post por INTENCIÓN COMERCIAL, no por coincidencia de palabras. Una oportunidad solamente existe si una persona o empresa del lado comprador busca contratar, recibir propuestas, cotizar, licitar, evaluar o pedir recomendaciones de una agencia/proveedor para un servicio objetivo.

DESCARTA SIEMPRE:
- La publicación es una vacante, búsqueda de empleo, práctica o contratación de talento.
- Una agencia, consultor o freelancer promociona sus propios servicios, casos de éxito o portafolio.
- Es opinión, noticia, contenido educativo, listado o análisis de mercado sin compra activa.
- Es una republicación de una oportunidad de tercero; el autor no es el comprador original.
- Se refiere a una agencia de viajes, empleo, reclutamiento, inmobiliaria, noticias o gubernamental.
- Declara que no busca agencias o pertenece a un sector restringido.

Cuando no hay evidencia suficiente de que el autor sea comprador, devuelve "review". Solo devuelve "qualified" si hay una cita textual clara que pruebe la búsqueda comercial y el servicio solicitado.

Texto:
"""
${(post.text || "").substring(0, MAX_TEXT_LENGTH)}
"""

Autor: ${post.authorName || "Desconocido"}
Cargo: ${post.authorTitle || ""}
Empresa: ${post.authorCompany || ""}
Servicios ya detectados por reglas: ${knownServices.join(", ") || "ninguno"}`;

  try {
    const response = await invokeConfiguredLLM({
      messages: [
        { role: "system", content: "Clasificas intención comercial B2B con precisión. Respondes solo JSON válido y nunca inventas evidencia." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "commercial_intent_classification",
          strict: true,
          schema: {
            type: "object",
            properties: {
              classificationDecision: { type: "string", enum: ["qualified", "review", "discarded"] },
              commercialScore: { type: "number", minimum: 0, maximum: 100 },
              classificationConfidence: { type: "number", minimum: 0, maximum: 1 },
              classificationReason: { type: "string" },
              detectedKeywords: { type: "array", items: { type: "string" } },
              intentCategory: { type: "string", enum: ["busca_agencia", "solicita_recomendaciones", "rfp_licitacion", "busca_proveedor", "alianza_b2b", "no_aplica"] },
              authorSide: { type: "string", enum: ["buyer", "provider", "intermediary", "job_seeker", "unknown"] },
              serviceCategories: { type: "array", items: { type: "string" } },
              evidence: { type: "array", items: { type: "string" } },
              exclusionReasons: { type: "array", items: { type: "string" } },
            },
            required: ["classificationDecision", "commercialScore", "classificationConfidence", "classificationReason", "detectedKeywords", "intentCategory", "authorSide", "serviceCategories", "evidence", "exclusionReasons"],
            additionalProperties: false,
          },
        },
      },
      temperature: 0.1,
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("LLM devolvió respuesta vacía");
    const parsed = normalizeLLMClassification(parseLLMJson(rawContent));
    if (parsed.classificationDecision === "qualified" && (parsed.authorSide !== "buyer" || parsed.evidence.length === 0 || parsed.serviceCategories.length === 0)) {
      parsed.classificationDecision = "review";
      parsed.classificationReason = "El modelo detectó señales parciales, pero faltó evidencia suficiente de comprador y servicio para calificar automáticamente.";
      parsed.commercialScore = Math.min(parsed.commercialScore, 70);
    }
    return buildResult({ ...parsed, classificationVersion: CLASSIFICATION_VERSION });
  } catch (error) {
    console.warn(
      "[Classifier] No se pudo completar la clasificación semántica:",
      error instanceof Error ? error.message : String(error)
    );
    return buildResult({ commercialScore: 0, classificationDecision: "pending", classificationConfidence: 0, classificationReason: "Pendiente de clasificación semántica: no se generó una decisión automática.", detectedKeywords: knownServices, intentCategory: "no_aplica", authorSide: "unknown", serviceCategories: knownServices, evidence: [], exclusionReasons: ["clasificador_semantico_no_disponible"], classificationVersion: `${CLASSIFICATION_VERSION}-pending` });
  }
}

export function extractFeedbackSignals(_text: string, _feedback: "relevant" | "irrelevant"): Array<{ pattern: string; signal: "positive" | "negative" }> {
  return [];
}

export function isQualifiedDecision(decision: ClassificationDecision): boolean {
  return decision === "qualified";
}
