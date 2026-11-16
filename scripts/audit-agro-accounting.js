// Auditoria de la parte CONTABLE de un workspace de frontend-agro (16/11/2026).
// Hermano de audit-agro-workspace.js (que solo mira animales/saldos): este
// revisa que los numeros de Contabilidad cierren entre si y con Animales.
//
// Uso: node scripts/audit-agro-accounting.js [tenantId]
// Sin tenantId, audita el 123 (Rosendo, unico cliente real hoy).
//
// Solo lee -- nunca escribe nada. Las formulas son copia de la logica real
// (agro.domain.ts calculateAnimalTotal y agro.home.shared.ts getNetAmount /
// getIncome*): si cambian en el frontend, actualizar aca tambien.

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
    const value = line.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

const EPS = 0.01;
const close = (a, b) => Math.abs((a || 0) - (b || 0)) <= EPS;
const num = (v) => (v === undefined || v === null ? 0 : Number(v));

function expectedNet(entry, freight) {
  const gross = num(entry.grossAmount);
  const commission = num(entry.commissionAmount);
  const tax = num(entry.taxAmount);
  return entry.type === "income" ? gross - commission - tax : gross + commission + tax + freight;
}

function animalTotal(m) {
  const gross = m.pricingMode === "kilo" ? num(m.weightKg) * num(m.quantity) * num(m.unitPrice) : num(m.quantity) * num(m.unitPrice);
  if (m.kind === "sale") return gross - num(m.commissionAmount) - num(m.taxAmount);
  return gross + num(m.commissionAmount) + num(m.taxAmount) + num(m.freightAmount);
}

async function main() {
  loadEnvFile();
  const tenantId = Number(process.argv[2] || 123);
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  const [rows] = await conn.query(
    `SELECT workspace_json FROM saas_agro_workspaces WHERE tenant_id = ? AND workspace_key = 'public' LIMIT 1`,
    [tenantId]
  );
  await conn.end();
  if (!rows.length) {
    console.log(`No hay workspace para tenant_id ${tenantId}.`);
    return;
  }
  const data = typeof rows[0].workspace_json === "string" ? JSON.parse(rows[0].workspace_json) : rows[0].workspace_json;
  const entries = data.accountingEntries || [];
  const movements = data.animalMovements || [];
  const audit = data.accountingAuditLog || [];
  const fields = data.fields || [];
  const establishments = data.establishments || [];
  const rates = data.monthlyExchangeRates || [];
  const movementById = new Map(movements.map((m) => [m.id, m]));
  const entryById = new Map(entries.map((e) => [e.id, e]));
  const fieldIds = new Set(fields.map((f) => f.id));
  const establishmentIds = new Set(establishments.map((e) => e.id));
  const today = new Date().toISOString().slice(0, 10);

  const findings = {
    idsDuplicados: [],
    netoNoCierra: [],
    brutoVentaKilo: [],
    cobradoMayorAlEsperado: [],
    esperadoDistintoDelNeto: [],
    vinculoRoto: [],
    totalDistintoEntreLados: [],
    ventaOCompraSinMovimientoContable: [],
    campoOEstablecimientoInexistente: [],
    fechaInvalidaOFutura: [],
    pendienteSinClienteOVencimiento: [],
    uyuSinTipoDeCambio: [],
    sinAuditoria: []
  };

  // 1) ids duplicados
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.id)) findings.idsDuplicados.push({ id: e.id });
    seen.add(e.id);
  }

  for (const e of entries) {
    const linked = e.linkedAnimalMovementId ? movementById.get(e.linkedAnimalMovementId) : undefined;
    const freight = linked && linked.kind === "purchase" ? num(linked.freightAmount) : 0;
    const short = { id: e.id, fecha: e.date, tipo: e.type, rubro: e.concept, moneda: e.currency };

    // 2) neto = formula(bruto, comision, impuestos, flete)
    const net = expectedNet(e, freight);
    if (!close(net, e.netAmount)) {
      findings.netoNoCierra.push({ ...short, bruto: e.grossAmount, comision: e.commissionAmount, iva: e.taxAmount, flete: freight, netoGuardado: e.netAmount, netoCalculado: net });
    }

    // 3) venta a kilo: el bruto tiene que ser peso x cantidad x precio
    if (linked && linked.pricingMode === "kilo") {
      const grossShould = num(linked.weightKg) * num(linked.quantity) * num(linked.unitPrice);
      if (!close(grossShould, e.grossAmount)) {
        findings.brutoVentaKilo.push({ ...short, brutoGuardado: e.grossAmount, brutoDeberiaSer: grossShould, movimiento: linked.id });
      }
    }

    // 4) ingresos: cobrado <= esperado y esperado == neto
    if (e.type === "income") {
      const expected = e.expectedAmount === undefined ? num(e.netAmount) : num(e.expectedAmount);
      const collected = e.collectedAmount === undefined ? expected : num(e.collectedAmount);
      if (collected - expected > EPS) findings.cobradoMayorAlEsperado.push({ ...short, esperado: expected, cobrado: collected });
      if (!close(expected, e.netAmount)) findings.esperadoDistintoDelNeto.push({ ...short, esperado: expected, neto: e.netAmount });
      const pending = Math.max(0, expected - Math.min(collected, expected));
      if (pending > EPS && (!e.clientName || !e.dueDate)) {
        findings.pendienteSinClienteOVencimiento.push({ ...short, pendiente: pending, cliente: e.clientName || null, vence: e.dueDate || null });
      }
    }

    // 5) vinculo con animales (en los dos sentidos)
    if (e.linkedAnimalMovementId) {
      if (!linked) findings.vinculoRoto.push({ ...short, problema: "apunta a un movimiento de animales que no existe", movimiento: e.linkedAnimalMovementId });
      else if (linked.linkedAccountingEntryId !== e.id) findings.vinculoRoto.push({ ...short, problema: "el movimiento de animales no apunta de vuelta a este asiento", movimiento: linked.id, apuntaA: linked.linkedAccountingEntryId || null });
      else {
        if (!close(num(linked.totalAmount), num(e.netAmount))) {
          findings.totalDistintoEntreLados.push({ ...short, netoContable: e.netAmount, totalAnimales: linked.totalAmount, movimiento: linked.id });
        }
        if (linked.currency && linked.currency !== e.currency) findings.totalDistintoEntreLados.push({ ...short, problema: "moneda distinta", contable: e.currency, animales: linked.currency });
      }
    }

    // 6) campo / establecimiento
    if ((e.fieldId && !fieldIds.has(e.fieldId)) || (e.establishmentId && !establishmentIds.has(e.establishmentId))) {
      findings.campoOEstablecimientoInexistente.push({ ...short, fieldId: e.fieldId, establishmentId: e.establishmentId });
    }

    // 7) fechas
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || "") || e.date > today) {
      findings.fechaInvalidaOFutura.push({ ...short, fecha: e.date });
    }

    // 8) gastos en pesos sin tipo de cambio de ese mes (no se pueden dolarizar)
    if (e.type === "expense" && e.currency === "UYU") {
      const ym = (e.date || "").slice(0, 7);
      if (!rates.some((r) => r.yearMonth === ym && r.averageRate > 0)) findings.uyuSinTipoDeCambio.push({ ...short, mes: ym, neto: e.netAmount });
    }
  }

  // 9) ventas/compras de animales sin su asiento contable (o con uno que no existe)
  for (const m of movements) {
    if (m.kind !== "sale" && m.kind !== "purchase") continue;
    if (!m.linkedAccountingEntryId || !entryById.has(m.linkedAccountingEntryId)) {
      findings.ventaOCompraSinMovimientoContable.push({ id: m.id, fecha: m.date, tipo: m.kind, total: m.totalAmount, apuntaA: m.linkedAccountingEntryId || null });
    }
  }

  // 10) auditoria: asientos cuyo ultimo cambio no quedo registrado.
  // Un asiento "editado" (netAmount del rastro != netAmount actual) sin entrada
  // posterior en el log es sospechoso; aca solo se cuentan los borrados que
  // siguen existiendo y los rastros de asientos que ya no estan.
  const auditByEntry = new Map();
  const deletedIds = new Set(audit.filter((a) => a.action === "delete").map((a) => a.entryId));
  for (const a of audit) {
    auditByEntry.set(a.entryId, (auditByEntry.get(a.entryId) || 0) + 1);
    if (a.action === "edit" && a.after && !entryById.has(a.entryId) && !deletedIds.has(a.entryId)) {
      findings.sinAuditoria.push({ entryId: a.entryId, problema: "hay una edicion registrada pero el asiento ya no existe (y no hay borrado registrado)" });
    }
  }
  for (const a of audit) {
    if (a.action === "delete" && entryById.has(a.entryId)) findings.sinAuditoria.push({ entryId: a.entryId, problema: "figura como borrado en el rastro pero el asiento sigue existiendo" });
  }

  // Totales para tener a mano
  const totals = {};
  for (const e of entries) {
    const k = `${e.currency}/${e.type}`;
    totals[k] = totals[k] || { cantidad: 0, neto: 0, cobrado: 0 };
    totals[k].cantidad += 1;
    totals[k].neto += num(e.netAmount);
    if (e.type === "income") totals[k].cobrado += e.collectedAmount === undefined ? num(e.expectedAmount ?? e.netAmount) : num(e.collectedAmount);
  }

  console.log(`Tenant ${tenantId}: ${entries.length} asientos contables, ${movements.length} movimientos de animales, ${audit.length} registros de auditoria contable.`);
  console.log("Totales por moneda/tipo:", JSON.stringify(totals));
  let problems = 0;
  for (const [name, list] of Object.entries(findings)) {
    problems += list.length;
    console.log(`\n== ${name}: ${list.length}`);
    for (const item of list.slice(0, 15)) console.log("  ", JSON.stringify(item));
    if (list.length > 15) console.log(`   ... y ${list.length - 15} mas`);
  }
  console.log(`\nTotal de hallazgos: ${problems}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
