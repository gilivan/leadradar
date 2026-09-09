import "dotenv/config";
import { getLLMConfig, invokeConfiguredLLM } from "../server/services/llmRouter.ts";

async function main() {
  const config = await getLLMConfig();
  const response = await invokeConfiguredLLM({
    messages: [
      { role: "system", content: "Responde únicamente JSON válido." },
      { role: "user", content: "Devuelve el objeto {\"ok\":true}." },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "health_check",
        strict: true,
        schema: {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
      },
    },
    temperature: 0,
  });
  const content = response.choices?.[0]?.message?.content ?? "";
  JSON.parse(content);
  console.log(JSON.stringify({ provider: config.provider, model: config.model ?? "default", response: content }));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
