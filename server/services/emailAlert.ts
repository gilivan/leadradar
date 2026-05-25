/**
 * Email Alert Service — Sends opportunity alerts via SMTP using configurable templates.
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
