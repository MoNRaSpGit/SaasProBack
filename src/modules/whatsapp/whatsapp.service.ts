import { Injectable, Logger } from "@nestjs/common";

const GRAPH_VERSION = "v21.0";

// Links de cada sistema para el menu "Necesito un sistema" (28/10/2026,
// PLACEHOLDER: pendiente que el cliente confirme los links reales).
const SYSTEM_LINKS: Record<string, { label: string; url: string }> = {
  almacen: { label: "Almacén / kiosco", url: "https://wa.me/59892945696?text=Hola%2C%20quiero%20info%20del%20sistema%20de%20almac%C3%A9n" },
  gimnasio: { label: "Gimnasio", url: "https://wa.me/59892945696?text=Hola%2C%20quiero%20info%20del%20sistema%20de%20gimnasio" },
  distribuidora: { label: "Distribuidora", url: "https://wa.me/59892945696?text=Hola%2C%20quiero%20info%20del%20sistema%20de%20distribuidora" },
  reservas: { label: "Reservas", url: "https://wa.me/59892945696?text=Hola%2C%20quiero%20info%20del%20sistema%20de%20reservas" }
};

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  private get phoneNumberId(): string {
    const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!id) throw new Error("Falta WHATSAPP_PHONE_NUMBER_ID");
    return id;
  }

  private get token(): string {
    const token = process.env.WHATSAPP_TOKEN;
    if (!token) throw new Error("Falta WHATSAPP_TOKEN");
    return token;
  }

  get verifyToken(): string | undefined {
    return process.env.WHATSAPP_VERIFY_TOKEN;
  }

  private get ownerNumber(): string | undefined {
    return process.env.WHATSAPP_OWNER_NUMBER;
  }

  private async callGraph(body: Record<string, unknown>) {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${this.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", ...body })
    });
    const data = await res.json();
    if (!res.ok) {
      this.logger.error(`Error de WhatsApp API: ${JSON.stringify(data)}`);
    }
    return data;
  }

  async sendText(to: string, text: string) {
    return this.callGraph({ to, type: "text", text: { body: text } });
  }

  async sendWelcomeButtons(to: string) {
    return this.callGraph({
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: "¡Hola! Gracias por comunicarte con Logic Lab 👋 ¿En qué te podemos ayudar?" },
        action: {
          buttons: [
            { type: "reply", reply: { id: "need_system", title: "Necesito un sistema" } },
            { type: "reply", reply: { id: "talk_human", title: "Hablar con una persona" } }
          ]
        }
      }
    });
  }

  async sendSystemList(to: string) {
    return this.callGraph({
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: "Contanos qué tipo de negocio tenés y te mandamos la info:" },
        action: {
          button: "Elegir sistema",
          sections: [
            {
              title: "Sistemas Logic Lab",
              rows: Object.entries(SYSTEM_LINKS).map(([id, info]) => ({
                id: `system_${id}`,
                title: info.label
              }))
            }
          ]
        }
      }
    });
  }

  async sendSystemLink(to: string, systemId: string) {
    const info = SYSTEM_LINKS[systemId];
    if (!info) {
      await this.sendText(to, "No encontré ese sistema, probá de nuevo.");
      return;
    }
    await this.sendText(to, `${info.label}: ${info.url}`);
  }

  async handleHumanRequest(to: string, fromName: string | undefined) {
    await this.sendText(to, "Te atendemos a la brevedad 🙌");
    const owner = this.ownerNumber;
    if (owner) {
      await this.sendText(owner, `📩 ${fromName || to} quiere hablar con una persona (Logic Lab bot).`);
    } else {
      this.logger.warn("WHATSAPP_OWNER_NUMBER no configurado: no se pudo avisar al dueño.");
    }
  }

  async handleIncomingMessage(message: any, contactName: string | undefined) {
    const from = message.from as string;

    if (message.type === "interactive" && message.interactive?.button_reply) {
      const id = message.interactive.button_reply.id as string;
      if (id === "need_system") {
        await this.sendSystemList(from);
        return;
      }
      if (id === "talk_human") {
        await this.handleHumanRequest(from, contactName);
        return;
      }
    }

    if (message.type === "interactive" && message.interactive?.list_reply) {
      const id = message.interactive.list_reply.id as string; // "system_almacen", etc.
      const systemId = id.replace("system_", "");
      await this.sendSystemLink(from, systemId);
      return;
    }

    // Cualquier texto nuevo (primer contacto o lo que sea) -> saludo inicial.
    if (message.type === "text") {
      await this.sendWelcomeButtons(from);
    }
  }
}
