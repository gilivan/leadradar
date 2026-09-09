import { describe, expect, it } from "vitest";
import { buildEmailConfig } from "./scrapeOrchestrator";

describe("buildEmailConfig", () => {
  it("prioriza la clave SMTP canónica y conserva compatibilidad con la clave anterior", () => {
    const canonical = buildEmailConfig({
      smtp_host: "smtp.example.com",
      smtp_port: "465",
      smtp_user: "user@example.com",
      smtp_password: "canonical-password",
      smtp_pass: "legacy-password",
      smtp_from: "Alertas <alertas@example.com>",
      email_recipient: "ventas@example.com",
      email_alerts_enabled: "true",
    });
    const legacy = buildEmailConfig({
      smtp_user: "user@example.com",
      smtp_pass: "legacy-password",
    });

    expect(canonical.password).toBe("canonical-password");
    expect(canonical.from).toBe("Alertas <alertas@example.com>");
    expect(legacy.password).toBe("legacy-password");
    expect(legacy.from).toBe("user@example.com");
  });
});
