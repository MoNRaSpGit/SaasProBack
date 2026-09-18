// Chequeo de actividad de frontend-oriol para un dia dado: responde a la
// pregunta "hay movimientos en oriol" (pedido explicito del usuario,
// mismo criterio que scripts/audit-agro-workspace.js para frontend-agro).
//
// Uso: node scripts/check-oriol-activity.js [YYYY-MM-DD]
// Sin fecha, chequea el dia de hoy (hora de Montevideo).
//
// Solo lee -- nunca escribe nada. Junta, para el rango del dia elegido:
//   - Ventas (contado y credito) en saas_oriol_ventas
//   - Pagos de gastos/proveedores en saas_oriol_pagos
//   - Pagos de cuenta corriente de clientes en saas_oriol_pagos_credito
//   - Clientes nuevos en saas_oriol_clientes (por created_at)
//   - Cierre de caja del dia en saas_oriol_cierres_diarios
//
// OJO CON LA ZONA HORARIA (bug real encontrado el 18/09/2026, corregido
// aca): las columnas `fecha`/`created_at` se guardan en UTC de verdad
// (ver toMysqlDateTime en oriol.dateUtils.ts, usa date.toISOString()).
// Si a mysql2 se le deja construir un objeto Date JS a partir de esas
// columnas (sin DATE_FORMAT), lo interpreta usando el timezone LOCAL del
// proceso de Node en vez de UTC -- en este servidor esa zona local ya es
// Montevideo (UTC-3), asi que mysql2 le resta 3 horas de mas a un valor
// que ya estaba en UTC, y de ahi sale corrido +3hs al mostrarlo despues
// con toLocaleString. Por eso TODA columna de fecha se trae con
// DATE_FORMAT (string crudo, sin que mysql2 la toque) y se le agrega "Z"
// a mano antes de formatear para mostrar -- mismo criterio que ya usa
// toIsoString() en el propio codigo del proyecto. Los limites del rango
// WHERE tambien se mandan como STRING ya armado (no un objeto Date), por
// la misma razon: si no, mysql2 tambien los reinterpreta al mandarlos.
//
// Las busquedas en el buscador de productos NO quedan registradas en
// ningun lado (el endpoint GET /productos/buscar no escribe nada en la
// base) -- si se necesita ese dato hay que agregar una tabla/columna de
// logging nueva, este script no lo puede inventar de datos que no
// existen. Tampoco hay forma de saber si cambio la tasa del dolar/cambio
// en Config: esa tabla (saas_oriol_config) es una sola fila que se pisa,
// sin historial ni fecha de edicion.

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

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

function todayMontevideoLabel() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Montevideo" }); // en-CA => YYYY-MM-DD
}

// value: string crudo que vino de DATE_FORMAT (sin "Z"), UTC de verdad.
function formatTime(value) {
  return new Date(`${value}Z`).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
}

function formatMoney(value) {
  return Number(value).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function checkActivity(dayLabel) {
  loadEnvFile();
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const { start, end } = montevideoDayRangeUtcStrings(dayLabel);

  const [ventas] = await conn.query(
    `SELECT id, cliente_id, metodo_pago, total_pesos, total_dolares, ${dateFormatSql("fecha")} AS fecha
     FROM saas_oriol_ventas WHERE fecha >= ? AND fecha < ? ORDER BY fecha ASC`,
    [start, end]
  );

  const [pagos] = await conn.query(
    `SELECT id, valor, detalle, ${dateFormatSql("fecha")} AS fecha FROM saas_oriol_pagos WHERE fecha >= ? AND fecha < ? ORDER BY fecha ASC`,
    [start, end]
  );

  const [pagosCredito] = await conn.query(
    `SELECT id, venta_id, cliente_id, monto, moneda, tipo, ${dateFormatSql("fecha")} AS fecha
     FROM saas_oriol_pagos_credito WHERE fecha >= ? AND fecha < ? ORDER BY fecha ASC`,
    [start, end]
  );

  const [clientesNuevos] = await conn.query(
    `SELECT id, nombre, telefono, ${dateFormatSql("created_at")} AS created_at
     FROM saas_oriol_clientes WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC`,
    [start, end]
  );

  const [cierre] = await conn.query(
    `SELECT fecha, total_pesos, total_dolares, editado_manualmente FROM saas_oriol_cierres_diarios WHERE fecha = ?`,
    [dayLabel]
  );

  await conn.end();

  return { dayLabel, ventas, pagos, pagosCredito, clientesNuevos, cierre };
}

function printReport({ dayLabel, ventas, pagos, pagosCredito, clientesNuevos, cierre }) {
  const hasActivity = ventas.length || pagos.length || pagosCredito.length || clientesNuevos.length || cierre.length;

  console.log(`Actividad de frontend-oriol el ${dayLabel} (hora Montevideo)`);
  console.log("=".repeat(60));

  if (!hasActivity) {
    console.log("No hubo movimientos registrados este dia.");
    return;
  }

  if (ventas.length) {
    const totalPesos = ventas.reduce((sum, v) => sum + Number(v.total_pesos), 0);
    const totalDolares = ventas.reduce((sum, v) => sum + Number(v.total_dolares), 0);
    console.log(`\nVentas: ${ventas.length} (total $${formatMoney(totalPesos)} / US$${formatMoney(totalDolares)})`);
    ventas.forEach((v) => {
      const cliente = v.cliente_id ? `cliente #${v.cliente_id}` : "contado";
      console.log(
        `  ${formatTime(v.fecha)} | ${v.metodo_pago} | ${cliente} | $${formatMoney(v.total_pesos)} / US$${formatMoney(v.total_dolares)}`
      );
    });
  } else {
    console.log("\nVentas: ninguna.");
  }

  if (pagos.length) {
    console.log(`\nPagos de gastos/proveedores: ${pagos.length}`);
    pagos.forEach((p) => console.log(`  ${formatTime(p.fecha)} | $${formatMoney(p.valor)} | ${p.detalle}`));
  } else {
    console.log("\nPagos de gastos/proveedores: ninguno.");
  }

  if (pagosCredito.length) {
    console.log(`\nPagos de cuenta corriente (clientes): ${pagosCredito.length}`);
    pagosCredito.forEach((p) =>
      console.log(`  ${formatTime(p.fecha)} | cliente #${p.cliente_id} | ${p.tipo} | ${formatMoney(p.monto)} ${p.moneda}`)
    );
  } else {
    console.log("\nPagos de cuenta corriente (clientes): ninguno.");
  }

  if (clientesNuevos.length) {
    console.log(`\nClientes nuevos: ${clientesNuevos.length}`);
    clientesNuevos.forEach((c) => console.log(`  ${formatTime(c.created_at)} | ${c.nombre} (#${c.id})`));
  } else {
    console.log("\nClientes nuevos: ninguno.");
  }

  if (cierre.length) {
    const c = cierre[0];
    console.log(
      `\nCierre de caja: SI (total $${formatMoney(c.total_pesos)} / US$${formatMoney(c.total_dolares)}${c.editado_manualmente ? ", editado a mano" : ""})`
    );
  } else {
    console.log("\nCierre de caja: no se hizo todavia.");
  }
}

async function main() {
  const dayLabel = process.argv[2] || todayMontevideoLabel();
  const report = await checkActivity(dayLabel);
  printReport(report);
}

main().catch((error) => {
  console.error("Error chequeando actividad de oriol:", error);
  process.exitCode = 1;
});
