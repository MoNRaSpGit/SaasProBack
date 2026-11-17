import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { RowDataPacket } from "mysql2";
import { createHash } from "crypto";
import * as webpush from "web-push";
import { DatabaseService } from "../../shared/database/database.service";

type SubscriptionRow = RowDataPacket & { endpoint: string; p256dh: string; auth: string };
type PushPayload = { title: string; body: string; url?: string };

// Solo se aceptan los servidores de push oficiales de cada navegador. Sin esto,
// cualquiera podria registrar una URL propia y hacer que el backend le mande
// pedidos (SSRF).
const ALLOWED_PUSH_HOSTS = [
  /^fcm.googleapis.com$/,
  /^android.googleapis.com$/,
  /(^|.)push.services.mozilla.com$/,
  /(^|.)notify.windows.com$/,
  /(^|.)push.apple.com$/
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && ALLOWED_PUSH_HOSTS.some((pattern) => pattern.test(url.hostname));
  } catch {
    return false;
  }
}

const hashEndpoint = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");

// Avisos push al celular del dueño (17/11/2026). Sin login por ahora (version
// de demostracion): cualquier celular que toque "Activar avisos" en el panel
// queda suscripto. Si faltan las claves VAPID, se desactiva sin romper nada.
@Injectable()
export class PeluqueriaPushService {
  private readonly logger = new Logger(PeluqueriaPushService.name);
  private readonly publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  private readonly enabled: boolean;

  constructor(private readonly databaseService: DatabaseService) {
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim() || "https://monraspgit.github.io/frontend-peluqueria/";
    this.enabled = Boolean(this.publicKey && privateKey);
    if (this.enabled) {
      webpush.setVapidDetails(subject, this.publicKey, privateKey as string);
    } else {
      this.logger.warn("Faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY: avisos push desactivados.");
    }
  }

  getPublicKey() {
    return { publicKey: this.enabled ? this.publicKey : null };
  }

  async subscribe(endpoint: string, p256dh: string, auth: string) {
    if (!isAllowedPushEndpoint(endpoint)) throw new BadRequestException("Servicio de notificaciones no permitido.");
    await this.databaseService.execute(
      `INSERT INTO saas_peluqueria_push_subscriptions (endpoint_hash, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [hashEndpoint(endpoint), endpoint, p256dh, auth]
    );
    return { ok: true };
  }

  async unsubscribe(endpoint: string) {
    await this.databaseService.execute(`DELETE FROM saas_peluqueria_push_subscriptions WHERE endpoint_hash = ?`, [hashEndpoint(endpoint)]);
    return { ok: true };
  }

  // Manda el mismo aviso a todos los celulares suscriptos. Nunca lanza: un
  // aviso que falla no puede romper la reserva de la clienta.
  async notifyAll(payload: PushPayload): Promise<number> {
    if (!this.enabled) return 0;
    try {
      const rows = await this.databaseService.query<SubscriptionRow[]>(
        `SELECT endpoint, p256dh, auth FROM saas_peluqueria_push_subscriptions`
      );
      const message = JSON.stringify(payload);
      let sent = 0;
      await Promise.all(
        rows.map(async (row) => {
          try {
            await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, message);
            sent += 1;
          } catch (error) {
            const status = (error as { statusCode?: number }).statusCode;
            // 404/410: el celular ya no existe o revoco el permiso -> se borra.
            if (status === 404 || status === 410) {
              await this.unsubscribe(row.endpoint).catch(() => undefined);
            } else {
              this.logger.warn(`No se pudo enviar un aviso push (estado ${status ?? "?"}).`);
            }
          }
        })
      );
      return sent;
    } catch (error) {
      this.logger.warn(`Fallo el envio de avisos push: ${(error as Error).message}`);
      return 0;
    }
  }

  // Aviso de prueba solo al celular que lo pide.
  async notifyOne(endpoint: string, payload: PushPayload): Promise<boolean> {
    if (!this.enabled) return false;
    const rows = await this.databaseService.query<SubscriptionRow[]>(
      `SELECT endpoint, p256dh, auth FROM saas_peluqueria_push_subscriptions WHERE endpoint_hash = ? LIMIT 1`,
      [hashEndpoint(endpoint)]
    );
    if (!rows[0]) return false;
    try {
      await webpush.sendNotification({ endpoint: rows[0].endpoint, keys: { p256dh: rows[0].p256dh, auth: rows[0].auth } }, JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }
}
