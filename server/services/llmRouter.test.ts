import { describe, expect, it } from "vitest";
import { extractGeminiResponseText } from "./llmRouter";

describe("extractGeminiResponseText", () => {
  it("une todas las partes de salida del modelo", () => {
    expect(
      extractGeminiResponseText([
        { text: "{\"decision\":" },
        { text: "\"qualified\"}" },
      ])
    ).toBe("{\"decision\":\"qualified\"}");
  });

  it("excluye las partes de razonamiento antes de devolver el JSON", () => {
    expect(
      extractGeminiResponseText([
        { text: "razonamiento interno", thought: true },
        { text: "{\"decision\":\"review\"}" },
      ])
    ).toBe("{\"decision\":\"review\"}");
  });
});
