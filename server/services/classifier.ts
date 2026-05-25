/**
 * Classifier Service — Uses LLM to score LinkedIn posts for commercial opportunity relevance.
 * Incorporates learned feedback rules to progressively improve accuracy.
 */

import { invokeLLM } from "../_core/llm";
import type { LinkedInPost } from "./apify";

export interface ClassificationResult {
  relevanceScore: number; // 0.0 – 1.0
  relevanceLabel: "high" | "medium" | "low" | "irrelevant";
  classificationReason: string;
  detectedKeywords: string[];
  intentCategory: string;
}

export interface FeedbackRule {
  pattern: string;
  signal: "positive" | "negative";
  weight: number;
}

const BASE_POSITIVE_SIGNALS = [
  "busco agencia",
  "necesito agencia",
  "estoy buscando agencia",
  "buscamos agencia",
  "necesitamos agencia",
  "busco una agencia",
  "necesito una agencia",
  "quién me recomienda",
  "me pueden recomendar",
  "alguien conoce una agencia",
  "busco proveedor",
  "necesito proveedor de marketing",
  "busco partner",
  "agencia de publicidad",
  "agencia de marketing",
  "agencia creativa",
  "agencia digital",
  "campaña publicitaria",
  "campaña de marketing",
  "estrategia de marketing",
  "estrategia digital",
  "contenido para redes",
  "manejo de redes sociales",
  "community manager",
  "branding",
  "identidad de marca",
  "activación de marca",
  "activaciones",
  "lanzamiento de producto",
  "lanzamiento de marca",
  "evento corporativo",
  "experiencia de marca",
  "pauta digital",
  "pauta en redes",
  "publicidad digital",
  "comunicación corporativa",
  "relaciones públicas",
  "influencer marketing",
  "marketing de contenidos",
  "diseño gráfico",
  "producción audiovisual",
  "video marketing",
];

const BASE_NEGATIVE_SIGNALS = [
  "ofrezco servicios",
  "soy agencia",
  "nuestra agencia",
  "mi agencia",
  "somos una agencia",
  "trabajo en agencia",
  "ofrecemos soluciones",
  "contáctanos",
  "visita nuestro sitio",
  "descarga gratis",
  "curso gratis",
  "webinar gratis",
  "oferta de empleo",
  "vacante",
  "se busca",
  "hiring",
  "job opening",
];

export async function classifyPost(
  post: LinkedInPost,
  feedbackRules: FeedbackRule[] = [],
  minScore: number = 0.5
): Promise<ClassificationResult> {
  const text = post.text.toLowerCase();

  // Pre-screening: fast keyword check before LLM call
  const preScore = computePreScore(text, feedbackRules);

  // If clearly irrelevant by keywords, skip LLM
  if (preScore < -0.3) {
    return {
      relevanceScore: 0,
      relevanceLabel: "irrelevant",
      classificationReason: "Descartado por señales negativas en pre-clasificación",
      detectedKeywords: [],
      intentCategory: "no_relevante",
    };
  }

  // Build dynamic prompt with learned rules
  const learnedPositive = feedbackRules
    .filter((r) => r.signal === "positive" && r.weight > 0.5)
    .map((r) => `- "${r.pattern}"`)
    .join("\n");

  const learnedNegative = feedbackRules
    .filter((r) => r.signal === "negative" && r.weight > 0.5)
    .map((r) => `- "${r.pattern}"`)
    .join("\n");

  const prompt = `Eres un sistema de inteligencia comercial para El Grupo, una agencia de marketing, publicidad, comunicación, activaciones, estrategia, creatividad, contenidos, medios y experiencias.

Tu tarea es analizar el siguiente texto extraído de LinkedIn y determinar si representa una oportunidad comercial real para El Grupo.

Una oportunidad comercial es cuando una persona o empresa:
- Busca o solicita una agencia de marketing, publicidad, comunicación o servicios relacionados
- Necesita ayuda con campañas, branding, estrategia digital, contenidos, redes sociales, activaciones o experiencias
- Pide recomendaciones de proveedores de servicios creativos o de comunicación
- Manifiesta una necesidad que El Grupo podría resolver

NO es una oportunidad cuando:
- La persona o empresa OFRECE servicios (son competencia o proveedores)
- Es una oferta de empleo o vacante
- Es contenido educativo o informativo sin intención de compra
- Es publicidad de un producto o servicio sin relación con agencias
${learnedPositive ? `\nSeñales adicionales POSITIVAS aprendidas de feedback:\n${learnedPositive}` : ""}
${learnedNegative ? `\nSeñales adicionales NEGATIVAS aprendidas de feedback:\n${learnedNegative}` : ""}

Texto a analizar:
"""
${post.text.substring(0, 1500)}
"""

Autor: ${post.authorName || "Desconocido"}
Cargo: ${post.authorTitle || ""}
Empresa: ${post.authorCompany || ""}

Responde ÚNICAMENTE con un JSON válido con esta estructura exacta:
{
  "relevanceScore": <número entre 0.0 y 1.0>,
  "relevanceLabel": <"high" si score >= 0.75, "medium" si >= 0.5, "low" si >= 0.25, "irrelevant" si < 0.25>,
  "classificationReason": "<explicación breve en español de por qué es o no es una oportunidad>",
  "detectedKeywords": ["<keyword1>", "<keyword2>"],
  "intentCategory": "<categoría principal: busca_agencia | campaña_publicitaria | estrategia_digital | contenido_digital | branding | activaciones | no_relevante | otro>"
}`;

  try {
    const response = await invokeLLM({
      messages: [
        { role: "system", content: "Eres un clasificador de oportunidades comerciales. Responde solo con JSON válido." },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "classification_result",
          strict: true,
          schema: {
            type: "object",
            properties: {
              relevanceScore: { type: "number" },
              relevanceLabel: { type: "string", enum: ["high", "medium", "low", "irrelevant"] },
              classificationReason: { type: "string" },
              detectedKeywords: { type: "array", items: { type: "string" } },
              intentCategory: { type: "string" },
            },
            required: ["relevanceScore", "relevanceLabel", "classificationReason", "detectedKeywords", "intentCategory"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("LLM devolvió respuesta vacía");
    const content = typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    const result = JSON.parse(content) as ClassificationResult;

    // Apply pre-score adjustment
    const adjustedScore = Math.max(0, Math.min(1, result.relevanceScore + preScore * 0.1));
    result.relevanceScore = Math.round(adjustedScore * 100) / 100;
    result.relevanceLabel = scoreToLabel(result.relevanceScore);

    return result;
  } catch (err) {
    // Fallback to keyword-based scoring
    const score = Math.max(0, Math.min(1, 0.5 + preScore * 0.3));
    return {
      relevanceScore: score,
      relevanceLabel: scoreToLabel(score),
      classificationReason: "Clasificación por palabras clave (LLM no disponible)",
      detectedKeywords: detectKeywords(text),
      intentCategory: "otro",
    };
  }
}

function computePreScore(text: string, feedbackRules: FeedbackRule[]): number {
  let score = 0;

  for (const signal of BASE_POSITIVE_SIGNALS) {
    if (text.includes(signal)) score += 0.15;
  }
  for (const signal of BASE_NEGATIVE_SIGNALS) {
    if (text.includes(signal)) score -= 0.2;
  }

  for (const rule of feedbackRules) {
    if (text.includes(rule.pattern.toLowerCase())) {
      score += rule.signal === "positive" ? rule.weight * 0.1 : -rule.weight * 0.1;
    }
  }

  return Math.max(-1, Math.min(1, score));
}

function detectKeywords(text: string): string[] {
  return BASE_POSITIVE_SIGNALS.filter((s) => text.includes(s)).slice(0, 5);
}

function scoreToLabel(score: number): "high" | "medium" | "low" | "irrelevant" {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.25) return "low";
  return "irrelevant";
}

/**
 * Extract learning signals from user feedback to update rules.
 */
export function extractFeedbackSignals(
  text: string,
  feedback: "relevant" | "irrelevant"
): Array<{ pattern: string; signal: "positive" | "negative" }> {
  const lower = text.toLowerCase();
  const signal = feedback === "relevant" ? "positive" : "negative";
  const signals: Array<{ pattern: string; signal: "positive" | "negative" }> = [];

  // Extract 2-4 word phrases that appear in the text
  const words = lower.split(/\s+/).filter((w) => w.length > 3);
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    if (phrase.length > 8 && phrase.length < 40) {
      signals.push({ pattern: phrase, signal });
    }
  }

  return signals.slice(0, 5);
}
