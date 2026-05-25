import { describe, expect, it } from "vitest";

// ── Helpers extracted from classifier (pure functions) ──────────────────────

function scoreToLabel(score: number): "high" | "medium" | "low" | "irrelevant" {
  if (score >= 0.75) return "high";
  if (score >= 0.5) return "medium";
  if (score >= 0.25) return "low";
  return "irrelevant";
}

const POSITIVE_KEYWORDS = [
  "agencia de publicidad",
  "agencia de marketing",
  "agencia creativa",
  "necesito una agencia",
  "busco agencia",
  "buscando agencia",
  "recomiendan agencia",
  "quién me recomienda",
  "campaña publicitaria",
  "estrategia de marketing",
  "contenido digital",
  "activación de marca",
  "comunicación corporativa",
  "medios digitales",
  "branding",
  "pauta digital",
  "marketing digital",
  "social media",
  "community manager",
  "diseño gráfico",
  "producción audiovisual",
];

const NEGATIVE_KEYWORDS = [
  "ofrezco servicios",
  "soy freelance",
  "trabajo como",
  "mi agencia",
  "nuestra agencia",
  "ofrecemos",
  "contáctanos",
  "contáctame",
  "visita nuestro",
  "descarga gratis",
  "curso gratis",
  "webinar",
  "empleo",
  "vacante",
  "oferta laboral",
];

function computeKeywordPreScore(text: string): number {
  const lower = text.toLowerCase();
  let positiveMatches = 0;
  let negativeMatches = 0;

  for (const kw of POSITIVE_KEYWORDS) {
    if (lower.includes(kw)) positiveMatches++;
  }
  for (const kw of NEGATIVE_KEYWORDS) {
    if (lower.includes(kw)) negativeMatches++;
  }

  if (negativeMatches > positiveMatches) return -1;
  if (positiveMatches === 0) return 0;
  return Math.min(1, positiveMatches * 0.3);
}

// ── Colombia UTC conversion ──────────────────────────────────────────────────

function colombiaHourToUtcCron(hourColombia: string): string {
  const [h, m] = hourColombia.split(":").map(Number);
  const utcHour = (h + 5) % 24;
  return `0 ${m ?? 0} ${utcHour} * * *`;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("scoreToLabel", () => {
  it("returns 'high' for scores >= 0.75", () => {
    expect(scoreToLabel(0.75)).toBe("high");
    expect(scoreToLabel(0.9)).toBe("high");
    expect(scoreToLabel(1.0)).toBe("high");
  });

  it("returns 'medium' for scores 0.5–0.74", () => {
    expect(scoreToLabel(0.5)).toBe("medium");
    expect(scoreToLabel(0.6)).toBe("medium");
    expect(scoreToLabel(0.74)).toBe("medium");
  });

  it("returns 'low' for scores 0.25–0.49", () => {
    expect(scoreToLabel(0.25)).toBe("low");
    expect(scoreToLabel(0.4)).toBe("low");
  });

  it("returns 'irrelevant' for scores < 0.25", () => {
    expect(scoreToLabel(0.0)).toBe("irrelevant");
    expect(scoreToLabel(0.24)).toBe("irrelevant");
  });
});

describe("computeKeywordPreScore", () => {
  it("returns positive score for clear opportunity text", () => {
    const text = "Estoy buscando una agencia de marketing digital para una campaña publicitaria en Colombia.";
    const score = computeKeywordPreScore(text);
    expect(score).toBeGreaterThan(0);
  });

  it("returns negative score for offer/spam text", () => {
    const text = "Ofrecemos servicios de marketing. Contáctanos para más información. Nuestra agencia tiene 10 años.";
    const score = computeKeywordPreScore(text);
    expect(score).toBe(-1);
  });

  it("returns 0 for neutral text with no keywords", () => {
    const text = "Hoy fue un gran día en la oficina. Aprendí mucho sobre gestión de proyectos.";
    const score = computeKeywordPreScore(text);
    expect(score).toBe(0);
  });

  it("caps score at 1.0 regardless of keyword count", () => {
    const text = POSITIVE_KEYWORDS.join(" ");
    const score = computeKeywordPreScore(text);
    expect(score).toBeLessThanOrEqual(1);
  });
});

describe("colombiaHourToUtcCron", () => {
  it("converts 08:00 Colombia to 13:00 UTC", () => {
    expect(colombiaHourToUtcCron("08:00")).toBe("0 0 13 * * *");
  });

  it("converts 18:00 Colombia to 23:00 UTC", () => {
    expect(colombiaHourToUtcCron("18:00")).toBe("0 0 23 * * *");
  });

  it("wraps around midnight correctly (21:00 Colombia = 02:00 UTC next day)", () => {
    expect(colombiaHourToUtcCron("21:00")).toBe("0 0 2 * * *");
  });

  it("handles 00:00 Colombia = 05:00 UTC", () => {
    expect(colombiaHourToUtcCron("00:00")).toBe("0 0 5 * * *");
  });

  it("preserves minutes in cron expression", () => {
    expect(colombiaHourToUtcCron("08:30")).toBe("0 30 13 * * *");
  });
});

describe("email template interpolation", () => {
  function interpolate(template: string, vars: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
  }

  it("replaces all known variables", () => {
    const tpl = "Hola {{authorName}}, su empresa {{authorCompany}} tiene score {{relevanceScore}}";
    const result = interpolate(tpl, {
      authorName: "Juan Pérez",
      authorCompany: "Acme S.A.",
      relevanceScore: "85%",
    });
    expect(result).toBe("Hola Juan Pérez, su empresa Acme S.A. tiene score 85%");
  });

  it("leaves missing variables as empty string", () => {
    const tpl = "Autor: {{authorName}}, Ciudad: {{city}}";
    const result = interpolate(tpl, { authorName: "María" });
    expect(result).toBe("Autor: María, Ciudad: ");
  });
});
