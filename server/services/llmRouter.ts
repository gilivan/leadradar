/**
 * llmRouter.ts
 * Unified LLM service that routes requests to the configured provider.
 * Supported providers: manus (default), openai, anthropic, gemini, groq
 */

import { invokeLLM } from "../_core/llm";
import { getSettingValue } from "../db";

export type LLMMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type LLMProvider = "manus" | "openai" | "anthropic" | "gemini" | "groq";

export interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
}

/** Load LLM configuration from app_settings */
export async function getLLMConfig(): Promise<LLMConfig> {
  const provider = ((await getSettingValue("llm_provider")) ?? "manus") as LLMProvider;
  const apiKey = (await getSettingValue("llm_api_key")) ?? undefined;
  const model = (await getSettingValue("llm_model")) ?? undefined;
  return { provider, apiKey, model };
}

/** Default models per provider — updated July 2026 */
const DEFAULT_MODELS: Record<LLMProvider, string> = {
  manus: "default",
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-20241022",
  gemini: "gemini-2.5-flash",
  groq: "llama-3.3-70b-versatile",
};

/**
 * Unified invoke function. Reads provider config from DB and routes accordingly.
 * Falls back to Manus internal LLM if provider is unconfigured or errors out.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function invokeConfiguredLLM(params: {
  messages: LLMMessage[];
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
  temperature?: number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
}): Promise<any> {
  const config = await getLLMConfig();

  if (config.provider === "manus" || !config.apiKey) {
    // Use built-in Manus LLM (only available when deployed on Manus platform)
    // In local mode, if no external provider is configured, this will fail with a clear message
    const isLocalMode = process.env.LOCAL_AUTH === "true";
    if (isLocalMode && (!config.apiKey || config.provider === "manus")) {
      throw new Error(
        "En modo local, debes configurar un proveedor LLM externo (Gemini, OpenAI, Anthropic o Groq) " +
        "con su API key en Configuración General → Proveedor LLM."
      );
    }
    return invokeLLM(params as Parameters<typeof invokeLLM>[0]);
  }

  const model = config.model || DEFAULT_MODELS[config.provider];

  switch (config.provider) {
    case "openai":
      return invokeOpenAI({ ...params, apiKey: config.apiKey, model });
    case "anthropic":
      return invokeAnthropic({ ...params, apiKey: config.apiKey, model });
    case "gemini":
      return invokeGemini({ ...params, apiKey: config.apiKey, model });
    case "groq":
      return invokeGroq({ ...params, apiKey: config.apiKey, model });
    default:
      return invokeLLM(params as Parameters<typeof invokeLLM>[0]);
  }
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function invokeOpenAI(params: {
  messages: LLMMessage[];
  apiKey: string;
  model: string;
  response_format?: unknown;
  temperature?: number;
}) {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.2,
  };
  if (params.response_format) body.response_format = params.response_format;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<{ choices: Array<{ message: { content: string } }> }>;
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function invokeAnthropic(params: {
  messages: LLMMessage[];
  apiKey: string;
  model: string;
  response_format?: unknown;
  temperature?: number;
}) {
  // Separate system message from conversation
  const systemMsg = params.messages.find((m) => m.role === "system")?.content ?? "";
  const conversation = params.messages.filter((m) => m.role !== "system");

  // If JSON schema requested, append instruction to system prompt
  let system = systemMsg;
  if (params.response_format) {
    system += "\n\nRespond ONLY with valid JSON matching the requested schema. No markdown, no explanation.";
  }

  const body: Record<string, unknown> = {
    model: params.model,
    max_tokens: 1024,
    temperature: params.temperature ?? 0.2,
    system,
    messages: conversation,
  };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": params.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content.find((c) => c.type === "text")?.text ?? "";

  // Normalize to OpenAI-compatible shape
  return { choices: [{ message: { content: text } }] };
}

// ─── Google Gemini ───────────────────────────────────────────────────────────

export function extractGeminiResponseText(
  parts: Array<{ text?: string; thought?: boolean }> | undefined
): string {
  return (parts ?? [])
    .filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
}

async function invokeGemini(params: {
  messages: LLMMessage[];
  apiKey: string;
  model: string;
  response_format?: {
    type: "json_schema";
    json_schema: {
      name: string;
      strict: boolean;
      schema: Record<string, unknown>;
    };
  };
  temperature?: number;
}) {
  const systemMsg = params.messages.find((m) => m.role === "system")?.content ?? "";
  const conversation = params.messages.filter((m) => m.role !== "system");

  let systemInstruction = systemMsg;
  if (params.response_format) {
    systemInstruction += "\n\nRespond ONLY with valid JSON. No markdown, no explanation.";
  }

  const contents = conversation.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const generationConfig: Record<string, unknown> = {
    temperature: params.temperature ?? 0.2,
    // Classification evidence can require several fields and excerpts. Reserve
    // enough output space so JSON mode is not cut mid-object.
    maxOutputTokens: 2048,
  };
  if (params.response_format) {
    // Google supports structured JSON for generateContent via generationConfig.
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseJsonSchema = params.response_format.json_schema.schema;
    // Gemini 2.5 Flash uses dynamic reasoning by default. This simple,
    // deterministic classification needs no hidden thinking tokens; disabling
    // them prevents the output budget from ending before the JSON is complete.
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  }

  const body: Record<string, unknown> = {
    contents,
    systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
    generationConfig,
  };

  // v1beta is required for systemInstruction support
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${params.model}:generateContent?key=${params.apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = (await res.json()) as {
    candidates: Array<{
      content: { parts: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  const text = extractGeminiResponseText(data.candidates?.[0]?.content?.parts);

  return { choices: [{ message: { content: text } }] };
}

// ─── Groq ────────────────────────────────────────────────────────────────────

async function invokeGroq(params: {
  messages: LLMMessage[];
  apiKey: string;
  model: string;
  response_format?: unknown;
  temperature?: number;
}) {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    temperature: params.temperature ?? 0.2,
    max_tokens: 1024,
  };
  // Groq supports OpenAI-compatible response_format for JSON mode
  if (params.response_format) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<{ choices: Array<{ message: { content: string } }> }>;
}

/**
 * Test connectivity to the configured LLM provider.
 * Returns { success: true, model, provider } or throws.
 */
export async function testLLMConnection(): Promise<{
  success: boolean;
  provider: string;
  model: string;
  message: string;
}> {
  const config = await getLLMConfig();
  const model = config.model || DEFAULT_MODELS[config.provider];

  const testMessages: LLMMessage[] = [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Reply with exactly: OK" },
  ];

  try {
    const result = await invokeConfiguredLLM({ messages: testMessages });
    const content = result.choices?.[0]?.message?.content ?? "";
    return {
      success: true,
      provider: config.provider,
      model,
      message: `Conexión exitosa. Respuesta: "${content.slice(0, 80)}"`,
    };
  } catch (err: unknown) {
    throw new Error(
      `Error al conectar con ${config.provider}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
