// Chequeo de actividad de frontend-qq para un dia dado: responde a la
// pregunta "hay movimientos en qq" (mismo criterio que
// scripts/audit-agro-workspace.js y scripts/check-oriol-activity.js).
//
// Uso: node scripts/check-qq-activity.js [YYYY-MM-DD]
// Sin fecha, chequea el dia de hoy (hora de Montevideo).
//
// Solo lee -- nunca escribe nada. Qq no tiene "ventas" (el catalogo solo
// manda al cliente por WhatsApp, no hay checkout ni ordenes guardadas),
// asi que "movimientos" acA es otra cosa: alta de clientes (cuenta
// corriente admin), productos nuevos en el catalogo, imagenes nuevas en
// el carrusel, e inicios de sesion de admin/usuario.
//
// OJO CON LA ZONA HORARIA (bug real encontrado el 18/09/2026 en el
// script hermano de oriol, corregido aca tambien): las columnas
// created_at/expires_at se guardan en UTC de verdad. Si a mysql2 se le
// deja construir un objeto Date JS a partir de esas columnas (sin
// DATE_FORMAT), las interpreta usando el timezone LOCAL del proceso de
// Node en vez de UTC -- en este servidor esa zona local ya es Montevideo
// (UTC-3), asi que mysql2 les resta 3 horas de mas a un valor que ya
// estaba en UTC, y de ahi salen corridas +3hs al mostrarlas despues con
// toLocaleString. Por eso TODA columna de fecha se trae con DATE_FORMAT
// (string crudo, sin que mysql2 la toque) y se le agrega "Z" a mano
// antes de formatear para mostrar. Los limites del rango WHERE tambien
// se mandan como STRING ya armado (no un objeto Date), por la misma
// razon: si no, mysql2 tambien los reinterpreta al mandarlos.
//
// OJO (aparte): no hay columna updated_at en clientes ni productos, asi
// que una EDICION (cambiar precio, telefono, etc.) no se puede
// distinguir de "no paso nada" -- este script solo puede ver ALTAS
// nuevas (created_at) y logins (via expires_at - 30 dias, que es el TTL
// de sesion en qq-auth.service.ts). Si se necesita detectar ediciones
// hay que agregar updated_at a esas tablas.

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const SESSION_TTL_DAYS = 30; // igual a SESSION_TTL_DAYS en qq-auth.service.ts

function dateFormatSql(column) {
  return `DATE_FORMAT(${column}, '%Y-%m-%dT%H:%i:%s')`;
}

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  const envText = fs.readFileSync(envPath, "utf8");
  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

// dayLabel: "YYYY-MM-DD". Rango [00:00, 24:00) de ese dia en hora de
// Montevideo, expresado como strings UTC-naive listos para ir directo a
// una columna DATETIME (nunca como objeto Date -- ver nota de arriba).
function montevideoDayRangeUtcStrings(dayLabel) {
  const startUtcInstant = new Date(`${dayLabel}T00:00:00-03:00`);
  const endUtcInstant = new Date(startUtcInstant.getTime() + 24 * 60 * 60 * 1000);
  const toMysqlUtc = (date) => date.toISOString().slice(0, 19).replace("T", " ");
  return { start: toMysqlUtc(startUtcInstant), end: toMysqlUtc(endUtcInstant) };
}

// Igual que montevideoDayRangeUtcStrings pero corrido +offsetDays -- para
// buscar sesiones por expires_at (login + SESSION_TTL_DAYS).
function shiftedRangeUtcStrings(dayLabel, offsetDays) {
  const startUtcInstant = new Date(`${dayLabel}T00:00:00-03:00`);
  const shift = offsetDays * 24 * 60 * 60 * 1000;
  const start = new Date(startUtcInstant.getTime() + shift);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const toMysqlUtc = (date) => date.toISOString().slice(0, 19).replace("T", " ");
  return { start: toMysqlUtc(start), end: toMysqlUtc(end) };
}

function todayMontevideoLabel() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
}

// value: string crudo que vino de DATE_FORMAT (sin "Z"), UTC de verdad.
function formatTime(value) {
  return new Date(`${value}Z`).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
}

async function checkActivity(dayLabel) {
  loadEnvFile();
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const { start, end } = montevideoDayRangeUtcStrings(dayLabel);

  const [clientesNuevos] = await conn.query(
    `SELECT id, name, email, phone, ${dateFormatSql("created_at")} AS created_at
     FROM saas_qq_clients WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC`,
    [start, end]
  );

  const [productosNuevos] = await conn.query(
    `SELECT id, name, category, status, ${dateFormatSql("created_at")} AS created_at
     FROM saas_qq_products WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC`,
    [start, end]
  );

  const [imagenesCarrusel] = await conn.query(
    `SELECT id, ${dateFormatSql("created_at")} AS created_at
     FROM saas_qq_carousel_images WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC`,
    [start, end]
  );

  // Sesiones no tienen created_at -- se estima el login como
  // expires_at - SESSION_TTL_DAYS (ver createSession en qq-auth.service.ts).
  const sessionRange = shiftedRangeUtcStrings(dayLabel, SESSION_TTL_DAYS);
  const [sesiones] = await conn.query(
    `SELECT s.user_id, ${dateFormatSql("s.expires_at")} AS expires_at, u.email, u.role
     FROM saas_qq_sessions s
     JOIN saas_qq_users u ON u.id = s.user_id
     WHERE s.expires_at >= ? AND s.expires_at < ?`,
    [sessionRange.start, sessionRange.end]
  );

  await conn.end();

  return { dayLabel, clientesNuevos, productosNuevos, imagenesCarrusel, sesiones };
}

function printReport({ dayLabel, clientesNuevos, productosNuevos, imagenesCarrusel, sesiones }) {
  const hasActivity = clientesNuevos.length || productosNuevos.length || imagenesCarrusel.length || sesiones.length;

  console.log(`Actividad de frontend-qq el ${dayLabel} (hora Montevideo)`);
  console.log("=".repeat(60));

  if (!hasActivity) {
    console.log("No hubo movimientos registrados este dia.");
    return;
  }

  if (clientesNuevos.length) {
    console.log(`\nClientes nuevos: ${clientesNuevos.length}`);
    clientesNuevos.forEach((c) => console.log(`  ${formatTime(c.created_at)} | ${c.name} (#${c.id})`));
  } else {
    console.log("\nClientes nuevos: ninguno.");
  }

  if (productosNuevos.length) {
    console.log(`\nProductos nuevos en el catalogo: ${productosNuevos.length}`);
    productosNuevos.forEach((p) =>
      console.log(`  ${formatTime(p.created_at)} | ${p.name} (${p.category || "sin categoria"}, ${p.status})`)
    );
  } else {
    console.log("\nProductos nuevos en el catalogo: ninguno.");
  }

  if (imagenesCarrusel.length) {
    console.log(`\nImagenes nuevas en el carrusel: ${imagenesCarrusel.length}`);
    imagenesCarrusel.forEach((img) => console.log(`  ${formatTime(img.created_at)} | imagen #${img.id}`));
  } else {
    console.log("\nImagenes nuevas en el carrusel: ninguna.");
  }

  if (sesiones.length) {
    console.log(`\nInicios de sesion (estimado): ${sesiones.length}`);
    sesiones.forEach((s) => {
      const loginAtMs = new Date(`${s.expires_at}Z`).getTime() - SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
      console.log(`  ${formatTime(new Date(loginAtMs).toISOString().slice(0, 19))} | ${s.email} (${s.role})`);
    });
  } else {
    console.log("\nInicios de sesion: ninguno.");
  }
}

async function main() {
  const dayLabel = process.argv[2] || todayMontevideoLabel();
  const report = await checkActivity(dayLabel);
  printReport(report);
}

main().catch((error) => {
  console.error("Error chequeando actividad de qq:", error);
  process.exitCode = 1;
});
