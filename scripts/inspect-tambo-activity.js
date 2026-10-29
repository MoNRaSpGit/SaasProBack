// Actividad de frontend-tambo: quien entro y que hizo -- PARA NOSOTROS, no
// hay pantalla en la app que lo muestre. Responde a "el cliente la esta
// probando?" (pedido explicito 29/10/2026). Solo lectura.
//
// Uso:
//   node scripts/inspect-tambo-activity.js       -> ultimos 7 dias
//   node scripts/inspect-tambo-activity.js 30    -> ultimos 30 dias
//
// El ingreso es un boton "Ingresar" sin contraseña. Cada navegador se
// identifica con un id que la app genera sola ("visitante"). Cada sesion
// dice con que rol entro: CLIENTE (boton Ingresar) o LOGIC LAB (nosotros,
// 5 toques al logo). Un visitante que alguna vez entro por el logo es un
// dispositivo nuestro y sale al final.
//
// Zona horaria: occurred_at se guarda en UTC; se trae con DATE_FORMAT y se
// le agrega "Z" a mano (mysql2 NO debe construir el Date, bug de +3hs).
const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

const TZ = "America/Montevideo";
const dayKey = (iso) => new Date(iso).toLocaleDateString("es-UY", { timeZone: TZ });
const timeKey = (iso) => new Date(iso).toLocaleTimeString("es-UY", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

const EVENT_LABELS = {
  login: "INICIO SESION",
  logout: "CERRO SESION",
    seccion: "ABRIO",
  accion: "HIZO"
};

function describeDevice(userAgent) {
  if (!userAgent) return "dispositivo desconocido";
  const device = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "PC Windows"
          : /Macintosh/.test(userAgent)
            ? "Mac"
            : "otro";
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "navegador desconocido";
  return `${device}, ${browser}`;
}

async function main() {
  loadEnvFile();
  const days = Number(process.argv[2]) > 0 ? Number(process.argv[2]) : 7;

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  let rows;
  try {
    [rows] = await connection.query(
      `SELECT visitor_id, role, event, detail, user_agent, DATE_FORMAT(occurred_at, '%Y-%m-%dT%H:%i:%sZ') AS occurred_at
       FROM saas_tambo_activity_log
       WHERE occurred_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL ? DAY)
       ORDER BY occurred_at ASC, (event = 'login') DESC, id ASC`,
      [days]
    );
  } finally {
    await connection.end();
  }

  console.log(`Actividad de frontend-tambo -- ultimos ${days} dia(s) (hora Montevideo)`);
  console.log("=".repeat(80));

  if (rows.length === 0) {
    console.log("Nadie entro en ese periodo (o entraron con una version vieja de la app, sin registro).");
    return;
  }

  const visitors = new Map();
  for (const row of rows) {
    if (!visitors.has(row.visitor_id)) visitors.set(row.visitor_id, []);
    visitors.get(row.visitor_id).push(row);
  }

  // Primero los visitantes de afuera (lo que importa), al final los nuestros.
  const isOwn = (events) => events.some((e) => e.role === "logiclab");
  const ordered = [...visitors.entries()].sort(([, a], [, b]) => Number(isOwn(a)) - Number(isOwn(b)));

  for (const [visitorId, events] of ordered) {
    const own = isOwn(events);
    const entradas = events.filter((e) => e.event === "login").length;
    const acciones = events.filter((e) => e.event === "accion").length;
    const activeDays = new Set(events.map((e) => dayKey(e.occurred_at)));

    console.log("");
    console.log(`${own ? "NOSOTROS" : "VISITANTE"} ${visitorId.slice(0, 11)} (${describeDevice(events[events.length - 1].user_agent)})`);
    console.log(`  ${entradas} inicio(s) de sesion, ${acciones} cosa(s) guardada(s), ${activeDays.size} dia(s) distinto(s)`);

    let currentDay = "";
    for (const event of events) {
      const day = dayKey(event.occurred_at);
      if (day !== currentDay) {
        currentDay = day;
        console.log(`  --- ${day}`);
      }
      console.log(`    ${timeKey(event.occurred_at)} | ${EVENT_LABELS[event.event] || event.event}${event.event === "login" ? (event.role === "logiclab" ? " (LOGIC LAB)" : " (CLIENTE)") : ""}${event.detail ? ` | ${event.detail}` : ""}`);
    }
  }

  const outsiders = ordered.filter(([, events]) => !isOwn(events)).length;
  console.log("");
  console.log("-".repeat(80));
  console.log(`Visitantes de afuera: ${outsiders} | dispositivos nuestros: ${ordered.length - outsiders}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
