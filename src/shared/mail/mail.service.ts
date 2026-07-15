import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport";
import type { Transporter } from "nodemailer";

type MailEnvelope = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    this.fromAddress = this.configService.get<string>("MAIL_FROM") || "SaasPro <no-reply@saaspro.local>";
    this.transporter = this.createTransporter();
  }

  async sendJudgeVerificationEmail(to: string, fullName: string, confirmationUrl: string) {
    const subject = "Confirmá tu cuenta de juez";
    const text = [
      `Hola ${fullName},`,
      "",
      "Recibimos tu registro en SaasPro Juez.",
      `Confirmá tu cuenta acá: ${confirmationUrl}`,
      "",
      "Si no pediste este registro, podés ignorar este correo."
    ].join("\n");

    const html = `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #0f172a;">
        <h2 style="margin: 0 0 12px;">Confirmá tu cuenta de juez</h2>
        <p style="margin: 0 0 12px;">Hola ${this.escapeHtml(fullName)},</p>
        <p style="margin: 0 0 16px;">Recibimos tu registro en SaasPro Juez. Para activar tu cuenta, hacé click en el botón de abajo.</p>
        <p style="margin: 0 0 20px;">
          <a href="${this.escapeHtml(confirmationUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #4f46e5; color: #fff; text-decoration: none; font-weight: 700;">
            Confirmar cuenta
          </a>
        </p>
        <p style="margin: 0 0 12px; color: #475569;">Si el botón no funciona, copiá este enlace en el navegador:</p>
        <p style="word-break: break-all; margin: 0 0 16px; color: #1d4ed8;">${this.escapeHtml(confirmationUrl)}</p>
        <p style="margin: 0; color: #64748b;">Si no pediste este registro, podés ignorar este correo.</p>
      </div>
    `;

    await this.sendMail({ to, subject, text, html });
  }

  private createTransporter(): Transporter {
    const host = this.configService.get<string>("MAIL_HOST")?.trim();
    const port = Number(this.configService.get<string>("MAIL_PORT") || 587);
    const user = this.configService.get<string>("MAIL_USER")?.trim();
    const pass = this.configService.get<string>("MAIL_PASS")?.trim();
    const secure = this.configService.get<string>("MAIL_SECURE") === "true";

    if (host) {
      const transportOptions: SMTPTransport.Options = {
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined
      };

      return nodemailer.createTransport(transportOptions);
    }

    return nodemailer.createTransport({
      streamTransport: true,
      buffer: true,
      newline: "unix"
    });
  }

  private async sendMail(envelope: MailEnvelope) {
    const info = await this.transporter.sendMail({
      from: this.fromAddress,
      to: envelope.to,
      subject: envelope.subject,
      text: envelope.text,
      html: envelope.html
    });

    // Useful when a real SMTP provider is not configured.
    if (!this.configService.get<string>("MAIL_HOST")) {
      // eslint-disable-next-line no-console
      console.log(`[mail] verification email prepared for ${envelope.to} (${info.messageId})`);
    }
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
