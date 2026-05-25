/**
 * Email Alert Service — Sends opportunity alerts via SMTP using configurable templates.
 * Supports both single-opportunity and consolidated (digest) emails.
 */

import nodemailer from "nodemailer";
import type { Opportunity } from "../../drizzle/schema";

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  from: string;
  recipient: string;
  subject: string;
  alertsEnabled: boolean;
}

export interface EmailTemplate {
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  supportImageUrl?: string;
}

// ── Transporter ───────────────────────────────────────────────────────────────

function buildTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.password,
    },
    tls: { rejectUnauthorized: false },
  });
}

// ── Template interpolation (single opportunity) ───────────────────────────────

function interpolateTemplate(template: string, opportunity: Opportunity): string {
  return template
    .replace(/\{\{authorName\}\}/g, opportunity.authorName || "Desconocido")
    .replace(/\{\{authorTitle\}\}/g, opportunity.authorTitle || "")
    .replace(/\{\{authorCompany\}\}/g, opportunity.authorCompany || "")
    .replace(/\{\{authorProfileUrl\}\}/g, opportunity.authorProfileUrl || "#")
    .replace(/\{\{linkedinUrl\}\}/g, opportunity.linkedinUrl || "#")
    .replace(/\{\{rawText\}\}/g, (opportunity.rawText || "").substring(0, 500))
    .replace(/\{\{relevanceScore\}\}/g, ((opportunity.relevanceScore || 0) * 100).toFixed(0) + "%")
    .replace(/\{\{relevanceLabel\}\}/g, opportunity.relevanceLabel || "")
    .replace(/\{\{intentCategory\}\}/g, opportunity.intentCategory || "")
    .replace(/\{\{country\}\}/g, opportunity.country || "")
    .replace(/\{\{city\}\}/g, opportunity.city || "")
    .replace(/\{\{searchKeyword\}\}/g, opportunity.searchKeyword || "");
}

// ── Label helpers ─────────────────────────────────────────────────────────────

function labelBadgeStyle(label: string | null | undefined): string {
  switch (label) {
    case "high":   return "background:#16a34a;color:#fff;";
    case "medium": return "background:#d97706;color:#fff;";
    case "low":    return "background:#6b7280;color:#fff;";
    default:       return "background:#e5e7eb;color:#374151;";
  }
}

function labelText(label: string | null | undefined): string {
  switch (label) {
    case "high":   return "Alta relevancia";
    case "medium": return "Media relevancia";
    case "low":    return "Baja relevancia";
    default:       return "Sin clasificar";
  }
}

// ── Consolidated digest HTML builder ─────────────────────────────────────────

export function buildDigestHtml(
  opportunities: Opportunity[],
  appBaseUrl: string = "https://leadradar.manus.space"
): string {
  const count = opportunities.length;
  const dateStr = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Bogota",
  });

  // Build each opportunity card
  const oppCards = opportunities
    .map((opp, idx) => {
      const score = ((opp.relevanceScore || 0) * 100).toFixed(0);
      const snippet = (opp.rawText || "").substring(0, 320).trim();
      const hasMore = (opp.rawText || "").length > 320;
      const detailUrl = `${appBaseUrl}/opportunities/${opp.id}`;
      const linkedinUrl = opp.linkedinUrl || "#";

      return `
      <!-- Opportunity card #${idx + 1} -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;">
        <!-- Card header -->
        <tr>
          <td style="background:#f8fafc;padding:14px 20px;border-bottom:1px solid #e2e8f0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <span style="font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:600;color:#0f172a;">
                    ${opp.authorName || "Autor desconocido"}
                  </span>
                  ${opp.authorTitle ? `<span style="font-family:'Inter',Arial,sans-serif;font-size:12px;color:#64748b;margin-left:6px;">· ${opp.authorTitle}</span>` : ""}
                  ${opp.authorCompany ? `<span style="font-family:'Inter',Arial,sans-serif;font-size:12px;color:#64748b;margin-left:4px;">@ ${opp.authorCompany}</span>` : ""}
                </td>
                <td align="right" style="white-space:nowrap;">
                  <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-family:'Inter',Arial,sans-serif;font-size:11px;font-weight:600;${labelBadgeStyle(opp.relevanceLabel)}">
                    ${labelText(opp.relevanceLabel)} · ${score}%
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Card body -->
        <tr>
          <td style="background:#ffffff;padding:16px 20px;">
            ${opp.intentCategory ? `<p style="margin:0 0 10px;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#7c3aed;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">🎯 ${opp.intentCategory}</p>` : ""}
            <p style="margin:0 0 12px;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#334155;line-height:1.65;">
              "${snippet}${hasMore ? "…" : ""}"
            </p>
            ${(opp.country || opp.city) ? `
            <p style="margin:0 0 14px;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#94a3b8;">
              📍 ${[opp.city, opp.country].filter(Boolean).join(", ")}
              ${opp.searchKeyword ? ` · 🔑 ${opp.searchKeyword}` : ""}
            </p>` : ""}
            <!-- CTA buttons -->
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding-right:10px;">
                  <a href="${detailUrl}" target="_blank"
                     style="display:inline-block;padding:8px 18px;background:#1e293b;color:#f0b429;text-decoration:none;border-radius:6px;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:600;">
                    Ver en LeadRadar
                  </a>
                </td>
                <td>
                  <a href="${linkedinUrl}" target="_blank"
                     style="display:inline-block;padding:8px 18px;background:#0a66c2;color:#ffffff;text-decoration:none;border-radius:6px;font-family:'Inter',Arial,sans-serif;font-size:13px;font-weight:600;">
                    Ver en LinkedIn
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>LeadRadar — Nuevas oportunidades comerciales</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Inter',Arial,sans-serif;">

  <!-- Wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">

          <!-- ── Header ── -->
          <tr>
            <td style="background:#1e293b;border-radius:12px 12px 0 0;padding:28px 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <!-- LeadRadar wordmark -->
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background:#f0b429;border-radius:8px;width:36px;height:36px;text-align:center;vertical-align:middle;">
                          <span style="font-size:20px;line-height:36px;">⚡</span>
                        </td>
                        <td style="padding-left:12px;vertical-align:middle;">
                          <span style="font-family:'Inter',Arial,sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">LeadRadar</span>
                          <br/>
                          <span style="font-family:'Inter',Arial,sans-serif;font-size:11px;color:#94a3b8;letter-spacing:0.05em;text-transform:uppercase;">Inteligencia Comercial</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <!-- El Grupo logo -->
                    <a href="https://elgrupo.com.co" target="_blank" style="text-decoration:none;">
                      <img
                        src="https://3000-iu5lslfkq4yqfmkgs9qfs-94efe48b.us2.manus.computer/manus-storage/elgrupo-logo-email_76c2ce5f.png"
                        alt="El Grupo"
                        width="110"
                        style="display:block;height:auto;opacity:0.9;"
                      />
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ── Intro banner ── -->
          <tr>
            <td style="background:#f0b429;padding:18px 32px;">
              <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:15px;font-weight:700;color:#1e293b;">
                🎯 ${count === 1 ? "1 nueva oportunidad comercial detectada" : `${count} nuevas oportunidades comerciales detectadas`}
              </p>
              <p style="margin:4px 0 0;font-family:'Inter',Arial,sans-serif;font-size:12px;color:#78350f;">
                ${dateStr}
              </p>
            </td>
          </tr>

          <!-- ── Body ── -->
          <tr>
            <td style="background:#ffffff;padding:28px 32px 8px;">
              <p style="margin:0 0 8px;font-family:'Inter',Arial,sans-serif;font-size:15px;color:#0f172a;font-weight:600;">
                Hola, equipo de El Grupo 👋
              </p>
              <p style="margin:0 0 24px;font-family:'Inter',Arial,sans-serif;font-size:14px;color:#475569;line-height:1.7;">
                LeadRadar ha identificado <strong>${count === 1 ? "una nueva oportunidad" : `<strong>${count} nuevas oportunidades</strong>`}</strong> en LinkedIn que podrían representar una apertura comercial para El Grupo.
                A continuación encontrarás el detalle de cada hallazgo. Te invitamos a explorarlos y a marcar los que consideres más relevantes directamente en la plataforma para mejorar la precisión del sistema.
              </p>

              <!-- Opportunity cards -->
              ${oppCards}
            </td>
          </tr>

          <!-- ── CTA principal ── -->
          <tr>
            <td style="background:#ffffff;padding:8px 32px 32px;text-align:center;">
              <a href="${appBaseUrl}/opportunities"
                 target="_blank"
                 style="display:inline-block;padding:13px 32px;background:#1e293b;color:#f0b429;text-decoration:none;border-radius:8px;font-family:'Inter',Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.02em;">
                Ver todas las oportunidades en LeadRadar →
              </a>
            </td>
          </tr>

          <!-- ── Divider ── -->
          <tr>
            <td style="background:#ffffff;padding:0 32px;">
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0;" />
            </td>
          </tr>

          <!-- ── Footer ── -->
          <tr>
            <td style="background:#ffffff;border-radius:0 0 12px 12px;padding:20px 32px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0;font-family:'Inter',Arial,sans-serif;font-size:11px;color:#94a3b8;line-height:1.6;">
                      No responder este correo, dado que se ha generado de forma automática por <strong>LeadRadar</strong>.
                    </p>
                    <p style="margin:6px 0 0;font-family:'Inter',Arial,sans-serif;font-size:11px;color:#cbd5e1;">
                      Powered by LeadRadar · <a href="https://elgrupo.com.co" target="_blank" style="color:#94a3b8;text-decoration:underline;">El Grupo</a>
                    </p>
                  </td>
                  <td align="right" style="vertical-align:bottom;">
                    <a href="https://elgrupo.com.co" target="_blank">
                      <img
                        src="https://3000-iu5lslfkq4yqfmkgs9qfs-94efe48b.us2.manus.computer/manus-storage/elgrupo-logo-email_76c2ce5f.png"
                        alt="El Grupo"
                        width="80"
                        style="display:block;height:auto;opacity:0.5;"
                      />
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;
}

// ── Consolidated digest send ───────────────────────────────────────────────────

export async function sendDigestAlert(
  config: EmailConfig,
  opportunities: Opportunity[],
  appBaseUrl?: string
): Promise<{ sent: number; failed: number; errors: string[] }> {
  if (!config.alertsEnabled) return { sent: 0, failed: 0, errors: [] };
  if (!config.host || !config.user || !config.password || !config.recipient) {
    throw new Error("Configuración SMTP incompleta. Verifica host, usuario, contraseña y destinatario.");
  }
  if (opportunities.length === 0) return { sent: 0, failed: 0, errors: [] };

  const transporter = buildTransporter(config);
  const count = opportunities.length;
  const subject =
    config.subject ||
    (count === 1
      ? "LeadRadar — 1 nueva oportunidad comercial detectada"
      : `LeadRadar — ${count} nuevas oportunidades comerciales detectadas`);

  const html = buildDigestHtml(opportunities, appBaseUrl);

  // Plain-text fallback
  const text = [
    `LeadRadar — ${count === 1 ? "1 nueva oportunidad" : `${count} nuevas oportunidades`} comerciales detectadas`,
    "",
    ...opportunities.map(
      (opp, i) =>
        `${i + 1}. ${opp.authorName || "Desconocido"} (${opp.relevanceLabel || ""} · ${((opp.relevanceScore || 0) * 100).toFixed(0)}%)\n   ${(opp.rawText || "").substring(0, 200)}\n   LinkedIn: ${opp.linkedinUrl || "#"}`
    ),
    "",
    "No responder este correo, dado que se ha generado de forma automática por LeadRadar.",
  ].join("\n");

  try {
    await transporter.sendMail({
      from: config.from || config.user,
      to: config.recipient,
      subject,
      html,
      text,
    });
    return { sent: 1, failed: 0, errors: [] };
  } catch (err) {
    return { sent: 0, failed: 1, errors: [(err as Error).message] };
  }
}

// ── Single opportunity alert (kept for backward compat) ───────────────────────

export async function sendOpportunityAlert(
  config: EmailConfig,
  template: EmailTemplate,
  opportunity: Opportunity
): Promise<void> {
  if (!config.alertsEnabled) return;
  if (!config.host || !config.user || !config.password || !config.recipient) {
    throw new Error("Configuración SMTP incompleta. Verifica host, usuario, contraseña y destinatario.");
  }

  const transporter = buildTransporter(config);

  const subject = interpolateTemplate(template.subject || config.subject, opportunity);
  const htmlBody = interpolateTemplate(template.bodyHtml, opportunity);
  const textBody = template.bodyText
    ? interpolateTemplate(template.bodyText, opportunity)
    : undefined;

  await transporter.sendMail({
    from: config.from || config.user,
    to: config.recipient,
    subject,
    html: htmlBody,
    text: textBody,
  });
}

// ── Batch alerts (one email per opportunity — kept for backward compat) ────────

export async function sendBatchAlerts(
  config: EmailConfig,
  template: EmailTemplate,
  opportunities: Opportunity[]
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const opp of opportunities) {
    try {
      await sendOpportunityAlert(config, template, opp);
      sent++;
    } catch (err) {
      failed++;
      errors.push(`Oportunidad #${opp.id}: ${(err as Error).message}`);
    }
  }

  return { sent, failed, errors };
}

export async function testEmailConnection(config: EmailConfig): Promise<{ success: boolean; message: string }> {
  try {
    const transporter = buildTransporter(config);
    await transporter.verify();
    return { success: true, message: "Conexión SMTP verificada correctamente" };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}
