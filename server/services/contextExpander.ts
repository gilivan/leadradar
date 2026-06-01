/**
 * Context Expander Service
 * Uses LLM to intelligently expand a search profile into a rich set of
 * alternative roles, job titles, keywords and search phrases that maximise
 * LinkedIn scraping coverage.
 */

import { invokeLLM } from "../_core/llm";

export interface ExpandedContext {
  /** Original profile name */
  profileName: string;
  /** Alternative job titles / roles in Spanish and English */
  alternativeRoles: string[];
  /** Search phrases optimised for LinkedIn post search */
  searchPhrases: string[];
  /** Industry / sector keywords */
  industryKeywords: string[];
  /** Combined flat list ready to pass to the Apify scraper */
  allQueries: string[];
  /** ISO timestamp of last expansion */
  expandedAt: string;
}

/**
 * Expand a search profile using LLM.
 * @param profileName  The name of the search profile (e.g. "Especialista Digital")
 * @param baseKeywords The keywords already defined in the profile
 * @param country      Optional country for localisation hints
 * @param city         Optional city for localisation hints
 */
export async function expandSearchContext(
  profileName: string,
  baseKeywords: string[],
  country?: string,
  city?: string
): Promise<ExpandedContext> {
  const locationHint = [city, country].filter(Boolean).join(", ");

  const prompt = `Eres un experto en marketing digital y estrategia comercial para El Grupo, una agencia de marketing, publicidad, comunicación, activaciones, estrategia, creatividad, contenidos, medios y experiencias con sede en Colombia.

Tu tarea es expandir un perfil de búsqueda de LinkedIn para maximizar la detección de oportunidades comerciales. El objetivo es encontrar publicaciones de personas o empresas que NECESITEN servicios de agencia (no que los ofrezcan).

Perfil de búsqueda: "${profileName}"
Palabras clave base: ${baseKeywords.length > 0 ? baseKeywords.join(", ") : "(ninguna definida)"}
${locationHint ? `Región objetivo: ${locationHint}` : ""}

Genera una expansión inteligente del perfil con:

1. **alternativeRoles**: 10-15 cargos/roles alternativos en español e inglés que típicamente BUSCAN servicios de agencia. Incluye variantes de nomenclatura usadas en LinkedIn en Colombia y Latinoamérica.

2. **searchPhrases**: 8-12 frases de búsqueda optimizadas para encontrar posts donde alguien PIDE o NECESITA servicios de marketing/publicidad/comunicación. Usa frases naturales en español que aparecerían en LinkedIn (ej: "busco agencia", "necesito apoyo en marketing", "¿alguien recomienda?").

3. **industryKeywords**: 8-10 términos de industria/sector relacionados con el perfil que ayuden a encontrar empresas o personas con necesidades de agencia.

Responde ÚNICAMENTE con JSON válido:
{
  "alternativeRoles": ["cargo1", "cargo2", ...],
  "searchPhrases": ["frase1", "frase2", ...],
  "industryKeywords": ["keyword1", "keyword2", ...]
}`;

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Eres un experto en marketing digital y LinkedIn. Responde solo con JSON válido sin markdown.",
        },
        { role: "user", content: prompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "context_expansion",
          strict: true,
          schema: {
            type: "object",
            properties: {
              alternativeRoles: {
                type: "array",
                items: { type: "string" },
              },
              searchPhrases: {
                type: "array",
                items: { type: "string" },
              },
              industryKeywords: {
                type: "array",
                items: { type: "string" },
              },
            },
            required: ["alternativeRoles", "searchPhrases", "industryKeywords"],
            additionalProperties: false,
          },
        },
      },
    });

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error("LLM devolvió respuesta vacía");
    const content =
      typeof rawContent === "string" ? rawContent : JSON.stringify(rawContent);

    const parsed = JSON.parse(content) as {
      alternativeRoles: string[];
      searchPhrases: string[];
      industryKeywords: string[];
    };

    // Build the combined query list: base keywords + search phrases + top roles
    // Limit to 20 queries to avoid Apify rate limits on free plans
    const allQueries = deduplicateAndLimit(
      [
        ...baseKeywords,
        ...parsed.searchPhrases,
        ...parsed.alternativeRoles.slice(0, 5),
        ...parsed.industryKeywords.slice(0, 3),
      ],
      20
    );

    return {
      profileName,
      alternativeRoles: parsed.alternativeRoles,
      searchPhrases: parsed.searchPhrases,
      industryKeywords: parsed.industryKeywords,
      allQueries,
      expandedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[ContextExpander] LLM error, using base keywords:", err);
    // Fallback: return base keywords only
    return {
      profileName,
      alternativeRoles: [],
      searchPhrases: baseKeywords,
      industryKeywords: [],
      allQueries: baseKeywords.length > 0 ? baseKeywords : [profileName],
      expandedAt: new Date().toISOString(),
    };
  }
}

function deduplicateAndLimit(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const normalized = item.trim().toLowerCase();
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(item.trim());
      if (result.length >= limit) break;
    }
  }
  return result;
}
