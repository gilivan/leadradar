import { describe, expect, it } from "vitest";
import { preClassifyPost } from "./classifier";

function classify(text: string) {
  return preClassifyPost({ text });
}

describe("preClassifyPost", () => {
  it("permite pasar al clasificador semántico una solicitud directa de agencia", () => {
    const result = classify(
      "Estamos buscando una agencia de medios en Colombia para varios proyectos y licitaciones. Por favor envíen portafolio y propuesta."
    );
    expect(result).toBeNull();
  });

  it("descarta una vacante aunque mencione marketing y agencia", () => {
    const result = classify(
      "Estamos hiring un Account Manager para nuestra agencia de marketing. Envía tu CV para aplicar."
    );
    expect(result?.classificationDecision).toBe("discarded");
    expect(result?.exclusionReasons).toContain("vacante_o_busqueda_de_talento");
  });

  it("descarta la autopromoción de una agencia", () => {
    const result = classify(
      "Somos una agencia creativa. Ayudamos a marcas con campañas, pauta y contenido. Agenda una llamada."
    );
    expect(result?.classificationDecision).toBe("discarded");
    expect(result?.exclusionReasons).toContain("autopromocion_de_proveedor");
  });

  it("descarta contenido editorial sin necesidad activa", () => {
    const result = classify(
      "Guía: por qué las marcas deberían contratar una agencia de publicidad para una campaña de lanzamiento."
    );
    expect(result?.classificationDecision).toBe("discarded");
    expect(result?.exclusionReasons).toContain("sin_intencion_comercial_explicita");
  });

  it("descarta un post que excluye agencias", () => {
    const result = classify(
      "Busco una persona freelance para gestionar pauta digital. No agencias, por favor."
    );
    expect(result?.classificationDecision).toBe("discarded");
    expect(result?.exclusionReasons).toContain("descarta_agencias_expresamente");
  });

  it("descarta sectores no permitidos aunque tengan intención de compra", () => {
    const result = classify(
      "Busco agencia de influencers para una campaña de iGaming en Colombia."
    );
    expect(result?.classificationDecision).toBe("discarded");
    expect(result?.exclusionReasons).toContain("sector_restringido");
  });

  it("deja pasar solicitudes de agencias en plural con servicio objetivo", () => {
    const result = classify(
      "Estoy en búsqueda de Agencias creativas, de diseño y publicidad en Colombia. Por favor compartan sus datos de contacto."
    );
    expect(result).toBeNull();
  });

  it("deja pasar solicitudes de recomendaciones de agencia con un servicio objetivo", () => {
    const result = classify(
      "¿Me recomiendan una agencia de marketing digital especializada en inbound, SEO y automatización de CRM?"
    );
    expect(result).toBeNull();
  });

  it("deja pasar procesos de compra con servicio BTL", () => {
    const result = classify(
      "Necesitamos una agencia BTL para activaciones, material POP y eventos en punto de venta. Compartiremos el brief y presupuesto."
    );
    expect(result).toBeNull();
  });
});
