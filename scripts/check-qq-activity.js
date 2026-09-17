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
// OJO: no hay columna updated_at en clientes ni productos, asi que una
// EDICION (cambiar precio, telefono, etc.) no se puede distinguir de "no
// paso nada" -- este script solo puede ver ALTAS nuevas (created_at) y
// logins (via expires_at - 30 dias, que es el TTL de sesion en
// qq-auth.service.ts). Si se necesita detectar ediciones hay que agregar
// updated_at a esas tablas.

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

const SESSION_TTL_DAYS = 30; // igual a SESSION_TTL_DAYS en qq-auth.service.ts

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

function montevideoDayRange(dayLabel) {
  const start = new Date(`${dayLabel}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function todayMontevideoLabel() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" });
}

function formatTime(value) {
  return new Date(value).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
}

async function checkActivity(dayLabel) {
  loadEnvFile();
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const { start, end } = montevideoDayRange(dayLabel);

  const [clientesNuevos] = await conn.query(
    `SELECT id, name, email, phone, created_at FROM saas_qq_clients WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC`,
    [start, end]
  );

  const [productosNuevos] = await conn.query(
    `SELECT id, name, category, status, created_at FROM saas_qq_products WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC`,
    [start, end]
  );

  const [imagenesCarrusel] = await conn.query(
    `SELECT id, created_at FROM saas_qq_carousel_images WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC`,
    [start, end]
  );

  // Sesiones no tienen created_at -- se estima el login como
  // expires_at - SESSION_TTL_DAYS (ver createSession en qq-auth.service.ts).
  const [sesiones] = await conn.query(
    `SELECT s.user_id, s.expires_at, u.email, u.role
     FROM saas_qq_sessions s
     JOIN saas_qq_users u ON u.id = s.user_id
     WHERE s.expires_at >= ? AND s.expires_at < ?`,
    [
      new Date(start.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000),
      new Date(end.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
    ]
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
      const loginAt = new Date(new Date(s.expires_at).getTime() - SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
      console.log(`  ${formatTime(loginAt)} | ${s.email} (${s.role})`);
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
