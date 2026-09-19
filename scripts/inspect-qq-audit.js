// Consulta el registro de auditoria de frontend-qq (tabla saas_qq_audit_log,
// ver db/migrations/089 y src/modules/qq/qq-audit.service.ts) -- PARA
// NOSOTROS: no hay pantalla en la app que lo muestre. Responde a "que paso
// en qq": productos nuevos/editados/borrados/reordenados, fotos de
// producto, imagenes del carrusel, clientes de cuenta corriente, altas y
// logins (incluidos los intentos fallidos).
//
// Uso:
//   node scripts/inspect-qq-audit.js                 -> hoy (hora Montevideo)
//   node scripts/inspect-qq-audit.js 2026-09-19      -> ese dia
//   node scripts/inspect-qq-audit.js --days=7        -> ultimos 7 dias
//   ... [--entity=product|product_image|carousel_image|client|user] [--action=create|update|delete|reorder|upload_image|register|login|login_failed]
//
// Solo lee. Zona horaria: occurred_at se guarda en UTC; se trae con
// DATE_FORMAT (string crudo) y se le agrega "Z" a mano -- mysql2 NO debe
// construir el Date (bug de +3hs encontrado el 18/09/2026, ver
// scripts/check-oriol-activity.js).
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key && !(key in process.env)) process.env[key] = line.slice(idx + 1).trim();
  }
}

const ACTION_LABELS = {
  create: "ALTA",
  update: "EDICION",
  delete: "BORRADO",
  reorder: "REORDEN",
  upload_image: "FOTO",
  register: "REGISTRO",
  login: "LOGIN",
  login_failed: "LOGIN FALLIDO",
  checkout_whatsapp: "COMPRA POR WHATSAPP"
};

const ENTITY_LABELS = {
  product: "Producto",
  product_image: "Foto de producto",
  carousel_image: "Carrusel",
  client: "Cliente",
  user: "Usuario",
  cart: "Carrito"
};

const FIELD_LABELS = {
  name: "nombre",
  description: "descripcion",
  accountPrice: "precio cuenta",
  profilePrice: "precio perfil",
  currency: "moneda",
  category: "categoria",
  status: "estado",
  imageUrl: "imagen (url)",
  email: "email",
  phone: "telefono",
  dueDate: "vencimiento"
};

function montevideoDay(date) {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
}

// Rango [00:00, 24:00) hora Montevideo de un dia, como strings UTC-naive.
function dayRangeUtc(dayLabel, days = 1) {
  const start = new Date(`${dayLabel}T00:00:00-03:00`);
  const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 19).replace("T", " ");
  return { start: fmt(start), end: fmt(end) };
}

function formatWhen(raw) {
  return new Date(`${raw}Z`).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
}

function summarizeDetails(row) {
  if (!row.details) return "";
  let d;
  try {
    d = JSON.parse(row.details);
  } catch {
    return row.details;
  }
  if (d.changes) {
    return Object.entries(d.changes)
      .map(([field, [from, to]]) => `${FIELD_LABELS[field] || field}: ${from ?? "(vacio)"} -> ${to ?? "(vacio)"}`)
      .join("; ");
  }
  if (d.position) return `posicion: ${d.position[0]} -> ${d.position[1]}`;
  if (Array.isArray(d.items)) {
    // Compra por WhatsApp: detalle del carrito.
    return d.items.map((item) => `${item.quantity}x ${item.name} (${item.variant}, $${item.unitPrice}/mes)`).join("; ");
  }
  const parts = [];
  if (d.category) parts.push(`categoria ${d.category}`);
  if (d.accountPrice != null) parts.push(`cuenta $${d.accountPrice}`);
  if (d.profilePrice != null) parts.push(`perfil $${d.profilePrice}`);
  if (d.status) parts.push(d.status);
  if (d.dueDate) parts.push(`vence ${d.dueDate}`);
  if (d.replacedExistingImage != null) parts.push(d.replacedExistingImage ? "reemplazo la foto anterior" : "primera foto");
  if (d.approxSizeKb != null) parts.push(`~${d.approxSizeKb} KB`);
  return parts.join(", ");
}

async function main() {
  const args = process.argv.slice(2);
  const daysArg = args.find((a) => a.startsWith("--days="))?.split("=")[1];
  const entity = args.find((a) => a.startsWith("--entity="))?.split("=")[1];
  const action = args.find((a) => a.startsWith("--action="))?.split("=")[1];
  const dayArg = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));

  let start;
  let end;
  let title;
  if (daysArg) {
    const days = Number(daysArg);
    const today = montevideoDay(new Date());
    const firstDay = montevideoDay(new Date(new Date(`${today}T00:00:00-03:00`).getTime() - (days - 1) * 24 * 60 * 60 * 1000));
    ({ start, end } = { start: dayRangeUtc(firstDay).start, end: dayRangeUtc(today).end });
    title = `ultimos ${days} dia(s) (desde ${firstDay})`;
  } else {
    const day = dayArg || montevideoDay(new Date());
    ({ start, end } = dayRangeUtc(day));
    title = day;
  }

  loadEnvFile();
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const filters = ["occurred_at >= ?", "occurred_at < ?"];
  const params = [start, end];
  if (entity) {
    filters.push("entity_type = ?");
    params.push(entity);
  }
  if (action) {
    filters.push("action = ?");
    params.push(action);
  }
  const [rows] = await conn.query(
    `SELECT id, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%s') AS occurred_at, action, entity_type, entity_id, entity_label,
            actor_email, actor_role, details
     FROM saas_qq_audit_log WHERE ${filters.join(" AND ")} ORDER BY occurred_at ASC, id ASC`,
    params
  );
  await conn.end();

  console.log(`Auditoria de frontend-qq -- ${title} (hora Montevideo)${entity ? ` | entidad=${entity}` : ""}${action ? ` | accion=${action}` : ""}`);
  console.log("=".repeat(100));
  if (!rows.length) {
    console.log("Sin registros para ese filtro.");
    console.log("(La auditoria empezo a registrar el 19/09/2026: no hay historial anterior a esa fecha.)");
    return;
  }
  console.log(`${rows.length} registro(s)\n`);
  for (const row of rows) {
    const who = row.actor_email ? `${row.actor_email}${row.actor_role ? ` (${row.actor_role})` : ""}` : "(anonimo)";
    const detail = summarizeDetails(row);
    console.log(
      `${formatWhen(row.occurred_at)} | ${ACTION_LABELS[row.action] || row.action} | ${ENTITY_LABELS[row.entity_type] || row.entity_type}` +
        `${row.entity_label ? ` "${row.entity_label}"` : ""}${row.entity_id ? ` [#${row.entity_id}]` : ""} | por ${who}${detail ? `\n    ${detail}` : ""}`
    );
  }

  // Resumen de intenciones de compra (toques en "Comprar por WhatsApp"):
  // OJO, no son ventas confirmadas -- el pedido se cierra por WhatsApp,
  // afuera del sistema.
  const checkouts = rows.filter((row) => row.action === "checkout_whatsapp");
  if (checkouts.length) {
    let totalMensual = 0;
    let suscripciones = 0;
    for (const row of checkouts) {
      try {
        const d = JSON.parse(row.details || "{}");
        totalMensual += Number(d.total) || 0;
        suscripciones += (d.items || []).reduce((sum, item) => sum + item.quantity, 0);
      } catch {
        // detalle ilegible: se cuenta el toque igual, sin sumar importes.
      }
    }
    console.log("\n" + "-".repeat(100));
    console.log(
      `Intenciones de compra por WhatsApp: ${checkouts.length} pedido(s), ${suscripciones} suscripcion(es), $${totalMensual}/mes en total`
    );
    console.log("(intencion declarada por el cliente al tocar el boton, no venta confirmada)");
  }
}

main().catch((error) => {
  console.error("Error consultando la auditoria de qq:", error);
  process.exitCode = 1;
});
