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
// OJO: las busquedas en el buscador de productos NO quedan registradas
// en ningun lado (el endpoint GET /productos/buscar no escribe nada en
// la base) -- si se necesita ese dato hay que agregar una tabla/columna
// de logging nueva, este script no lo puede inventar de datos que no
// existen. Tampoco hay forma de saber si cambio la tasa del dolar/cambio
// en Config: esa tabla (saas_oriol_config) es una sola fila que se
// pisa, sin historial ni fecha de edicion.

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

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
  // dayLabel: "YYYY-MM-DD". Construye el rango [00:00, 24:00) de ese dia
  // en hora de Montevideo (UTC-3, sin horario de verano), para filtrar
  // columnas `fecha`/`created_at` guardadas en UTC.
  const start = new Date(`${dayLabel}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function todayMontevideoLabel() {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: "America/Montevideo" }); // en-CA => YYYY-MM-DD
}

function formatTime(value) {
  return new Date(value).toLocaleString("es-UY", { timeZone: "America/Montevideo" });
}

function formatMoney(value) {
  return Number(value).toLocaleString("es-UY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function checkActivity(dayLabel) {
  loadEnvFile();
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const { start, end } = montevideoDayRange(dayLabel);

  const [ventas] = await conn.query(
    `SELECT id, cliente_id, metodo_pago, total_pesos, total_dolares, fecha
     FROM saas_oriol_ventas WHERE fecha >= ? AND fecha < ? ORDER BY fecha ASC`,
    [start, end]
  );

  const [pagos] = await conn.query(
    `SELECT id, valor, detalle, fecha FROM saas_oriol_pagos WHERE fecha >= ? AND fecha < ? ORDER BY fecha ASC`,
    [start, end]
  );

  const [pagosCredito] = await conn.query(
    `SELECT id, venta_id, cliente_id, monto, moneda, tipo, fecha
     FROM saas_oriol_pagos_credito WHERE fecha >= ? AND fecha < ? ORDER BY fecha ASC`,
    [start, end]
  );

  const [clientesNuevos] = await conn.query(
    `SELECT id, nombre, telefono, created_at FROM saas_oriol_clientes WHERE created_at >= ? AND created_at < ? ORDER BY created_at ASC`,
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
