/**
 * Apify Service — Executes LinkedIn scrapers via the Apify API
 * Supports both the official LinkedIn Post Search Scraper and fallback actors.
 */

import axios from "axios";

export interface ApifyRunInput {
  queries: string[];
  maxResults?: number;
  country?: string;
  city?: string;
}

export interface LinkedInPost {
  id: string;
  url: string;
  text: string;
  authorName?: string;
  authorTitle?: string;
  authorCompany?: string;
  authorProfileUrl?: string;
  publishedAt?: string;
  contentType: "post" | "comment" | "article" | "other";
  likes?: number;
  comments?: number;
}

export async function runLinkedInScraper(
  apiToken: string,
  actorId: string,
  input: ApifyRunInput
): Promise<LinkedInPost[]> {
  if (!apiToken) throw new Error("Apify API token no configurado");

  const baseUrl = "https://api.apify.com/v2";

  // Build the actor input based on known Apify LinkedIn actors
  const actorInput = buildActorInput(actorId, input);

  // Start the actor run
  const startRes = await axios.post(
    `${baseUrl}/acts/${encodeURIComponent(actorId)}/runs`,
    actorInput,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      params: { waitForFinish: 120 }, // wait up to 2 min
    }
  );

  const runId: string = startRes.data?.data?.id;
  if (!runId) throw new Error("No se pudo iniciar el actor de Apify");

  // Poll for completion if not already finished
  const run = await waitForRun(apiToken, runId, baseUrl);
  if (run.status === "FAILED" || run.status === "ABORTED") {
    throw new Error(`El actor de Apify terminó con estado: ${run.status}`);
  }

  // Fetch dataset items
  const datasetId: string = run.defaultDatasetId;
  const itemsRes = await axios.get(
    `${baseUrl}/datasets/${datasetId}/items`,
    {
      headers: { Authorization: `Bearer ${apiToken}` },
      params: { format: "json", limit: 200 },
    }
  );

  const items: Record<string, unknown>[] = itemsRes.data || [];
  return normalizeItems(items, actorId);
}

function buildActorInput(actorId: string, input: ApifyRunInput): Record<string, unknown> {
  const queries = input.queries.map((q) => {
    const parts = [q];
    if (input.city) parts.push(input.city);
    else if (input.country) parts.push(input.country);
    return parts.join(" ");
  });

  // harvestapi/linkedin-post-search — actor recomendado por defecto.
  // Schema verificado contra /v2/acts/harvestapi~linkedin-post-search/builds/default
  if (actorId.includes("harvestapi") || actorId.includes("linkedin-post-search")) {
    return {
      searchQueries: queries,
      maxPosts: input.maxResults ?? 50,
      sortBy: "date",
      postedLimit: "month",
    };
  }

  if (actorId.includes("linkedin-scraper") || actorId.includes("linkedin_scraper")) {
    return {
      searchTerms: queries,
      resultsPerPage: input.maxResults ?? 50,
    };
  }

  // Generic fallback (sin proxy RESIDENTIAL: muchos planes FREE no lo tienen disponible)
  return {
    queries,
    maxResults: input.maxResults ?? 50,
    proxy: { useApifyProxy: true },
  };
}

async function waitForRun(
  apiToken: string,
  runId: string,
  baseUrl: string,
  maxWaitMs = 110_000
): Promise<{ status: string; defaultDatasetId: string }> {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await axios.get(`${baseUrl}/actor-runs/${runId}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });
    const data = res.data?.data;
    if (["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"].includes(data?.status)) {
      return data;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Tiempo de espera agotado para el actor de Apify");
}

function normalizeItems(
  items: Record<string, unknown>[],
  _actorId: string
): LinkedInPost[] {
  // Filtra "error items" tipo {input, error} que devuelven algunos actores cuando fallan
  const valid = items.filter((item) => {
    if (!item) return false;
    if (item.error && !item.content && !item.text) return false;
    return Boolean(item.text || item.content || item.postText || item.description);
  });

  return valid.map((item, idx) => {
    // Soporte tanto para campos en raíz (actores antiguos) como anidados (harvestapi)
    const author = (item.author as Record<string, unknown> | undefined) || {};
    const postedAt = (item.postedAt as Record<string, unknown> | string | undefined) || {};

    const text =
      (item.content as string) ||
      (item.text as string) ||
      (item.postText as string) ||
      (item.description as string) ||
      "";

    const url =
      (item.linkedinUrl as string) ||
      (item.url as string) ||
      (item.postUrl as string) ||
      "";

    // Autor: harvestapi anida en `author.{name,info,linkedinUrl}`
    const authorName =
      (author.name as string) ||
      (item.authorName as string) ||
      (typeof item.author === "string" ? (item.author as string) : "") ||
      (item.name as string) ||
      "";

    // En harvestapi, `author.info` es el headline (cargo + empresa en una línea)
    const authorTitle =
      (author.info as string) ||
      (author.headline as string) ||
      (item.authorTitle as string) ||
      (item.headline as string) ||
      (item.title as string) ||
      "";

    // harvestapi no devuelve company a nivel raíz; intentar extraerla del headline
    const authorCompany =
      (author.company as string) ||
      (item.authorCompany as string) ||
      (item.company as string) ||
      extractCompanyFromTitle(authorTitle);

    const authorProfileUrl =
      (author.linkedinUrl as string) ||
      (author.profileUrl as string) ||
      (item.authorProfileUrl as string) ||
      (item.profileUrl as string) ||
      "";

    // postedAt puede ser objeto {date,timestamp,...} (harvestapi) o string (otros)
    const publishedAt =
      (typeof postedAt === "object" && postedAt !== null
        ? ((postedAt as Record<string, unknown>).date as string)
        : "") ||
      (item.publishedAt as string) ||
      (item.date as string) ||
      (typeof item.postedAt === "string" ? (item.postedAt as string) : "") ||
      "";

    // Engagement (harvestapi lo expone en `engagement`)
    const engagement = (item.engagement as Record<string, unknown> | undefined) || {};

    return {
      id: (item.id as string) || `item-${idx}`,
      url,
      text,
      authorName,
      authorTitle,
      authorCompany,
      authorProfileUrl,
      publishedAt,
      contentType: "post" as const,
      likes: (engagement.likeCount as number) ?? (item.likes as number),
      comments: (engagement.commentCount as number) ?? (item.comments as number),
    };
  });
}

// Heurística simple: en LinkedIn el headline típico es "Cargo at/en/@ Empresa | ..."
function extractCompanyFromTitle(title: string): string {
  if (!title) return "";
  const match = title.match(/(?:\s+at\s+|\s+en\s+|\s+@\s*)([^|·\-]+)/i);
  return match ? match[1].trim().slice(0, 120) : "";
}

/**
 * Validate that an Apify token is working by fetching the user profile.
 */
export async function validateApifyToken(apiToken: string): Promise<boolean> {
  try {
    const res = await axios.get("https://api.apify.com/v2/users/me", {
      headers: { Authorization: `Bearer ${apiToken}` },
      timeout: 8000,
    });
    return res.status === 200;
  } catch {
    return false;
  }
}
