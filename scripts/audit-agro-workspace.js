// Auditoria de integridad de un workspace de frontend-agro: busca cosas
// que NUNCA deberian pasar (saldo negativo, traslados con una sola
// mitad, movimientos que apuntan a un potrero que ya no existe) sin
// tener que esperar a que el cliente las note el, como paso con el
// "toro negativo" de Rosendo (ver memory project_frontend_agro_traslado_bug).
//
// Uso: node scripts/audit-agro-workspace.js [tenantId]
// Sin tenantId, audita el 123 (Rosendo, unico cliente real hoy).
//
// Solo lee -- nunca escribe nada. Reusa exactamente la misma logica de
// direccion de movimiento que la app real (ver deriveMovementDirection en
// frontend-agro/src/features/agro/agro.domain.ts e isInitialStockLoad en
// agro.home.shared.ts) para que el saldo que calcula acA sea IDENTICO al
// que ve el cliente en pantalla -- si audita distinto a como se ve la
// app, la auditoria no sirve para nada.

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

// Copia exacta de la logica real (agro.domain.ts + agro.home.shared.ts).
// Si esa logica cambia en el frontend, hay que actualizar esta copia
// tambien -- no se pudo importar directo porque son dos proyectos TS
// separados (frontend-agro no es una dependencia del backend).
function isInitialStockLoad(movement) {
  return movement.kind === "adjustment" && (movement.notes || "").startsWith("Carga inicial:");
}

function getMovementDirection(movement) {
  if (isInitialStockLoad(movement)) return "entry";
  return movement.kind === "purchase" ||
    movement.kind === "birth" ||
    movement.kind === "transfer_in" ||
    movement.kind === "correction_in"
    ? "entry"
    : "exit";
}

async function auditTenant(tenantId) {
  loadEnvFile();
  const conn = await mysql.createConnection(process.env.DATABASE_URL);

  const [rows] = await conn.query(
    `SELECT workspace_json FROM saas_agro_workspaces WHERE tenant_id = ? AND workspace_key = 'public' LIMIT 1`,
    [tenantId]
  );
  await conn.end();

  if (!rows.length) {
    console.log(`No hay workspace para tenant_id ${tenantId}.`);
    return { ok: true, findings: {} };
  }

  const data = typeof rows[0].workspace_json === "string" ? JSON.parse(rows[0].workspace_json) : rows[0].workspace_json;
  const movements = data.animalMovements || [];
  const initialStock = data.initialStock || [];
  const fields = data.fields || [];
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const fieldLabel = (id) => {
    const field = fieldById.get(id);
    return field ? `${field.name} (${id})` : `<potrero inexistente: ${id}>`;
  };

  // 1) Saldo negativo, replicando el mismo calculo que usa la pantalla
  // (initialStock + suma de movimientos, sin ordenar por fecha -- la app
  // tampoco ordena, solo suma).
  const balances = new Map();
  for (const item of initialStock) {
    const key = `${item.fieldId}:${item.species}:${item.categoryCode}`;
    balances.set(key, (balances.get(key) || 0) + item.quantity);
  }
  for (const m of movements) {
    const key = `${m.fieldId}:${m.species}:${m.categoryCode}`;
    const signed = getMovementDirection(m) === "entry" ? m.quantity : -m.quantity;
    balances.set(key, (balances.get(key) || 0) + signed);
  }
  const negativeBalances = [...balances.entries()]
    .filter(([, qty]) => qty < 0)
    .map(([key, qty]) => {
      const [fieldId, species, categoryCode] = key.split(":");
      return { potrero: fieldLabel(fieldId), species, categoryCode, saldo: qty };
    });

  // 2) Traslados sin pareja completa (una mitad sin la otra, o con
  // cantidad/especie que no coincide entre las dos mitades).
  const byId = new Map(movements.map((m) => [m.id, m]));
  const brokenTransfers = [];
  for (const m of movements) {
    if (m.kind !== "transfer_in" && m.kind !== "transfer_out") continue;
    if (!m.pairedTransferMovementId) {
      brokenTransfers.push({ tipo: "sin pairedTransferMovementId", id: m.id, potrero: fieldLabel(m.fieldId), date: m.date });
      continue;
    }
    const pair = byId.get(m.pairedTransferMovementId);
    if (!pair) {
      brokenTransfers.push({
        tipo: "pareja inexistente",
        id: m.id,
        pairedId: m.pairedTransferMovementId,
        potrero: fieldLabel(m.fieldId),
        date: m.date
      });
    } else if (pair.quantity !== m.quantity || pair.species !== m.species || pair.categoryCode !== m.categoryCode) {
      brokenTransfers.push({
        tipo: "pareja con datos distintos",
        id: m.id,
        pairedId: pair.id,
        potrero: fieldLabel(m.fieldId),
        date: m.date
      });
    }
  }
  // Cada par roto puede aparecer una vez por cada lado -- de-duplicar por id.
  const seenBroken = new Set();
  const brokenTransfersUnique = brokenTransfers.filter((item) => {
    if (seenBroken.has(item.id)) return false;
    seenBroken.add(item.id);
    return true;
  });

  // 3) Movimientos que apuntan a un potrero que ya no existe en `fields`.
  const orphanFieldRefs = movements
    .filter((m) => !fieldById.has(m.fieldId))
    .map((m) => ({ id: m.id, fieldId: m.fieldId, date: m.date, kind: m.kind }));

  const findings = { negativeBalances, brokenTransfers: brokenTransfersUnique, orphanFieldRefs };
  const ok = negativeBalances.length === 0 && brokenTransfersUnique.length === 0 && orphanFieldRefs.length === 0;

  console.log(`\n=== Auditoria agro -- tenant_id ${tenantId} (${movements.length} movimientos, ${fields.length} potreros) ===\n`);

  if (ok) {
    console.log("✅ Todo en orden -- sin saldos negativos, sin traslados rotos, sin potreros fantasma.\n");
  } else {
    if (negativeBalances.length) {
      console.log(`❌ Saldos negativos (${negativeBalances.length}):`);
      negativeBalances.forEach((item) => console.log(`   ${item.potrero} · ${item.species} cat.${item.categoryCode} = ${item.saldo}`));
      console.log("");
    }
    if (brokenTransfersUnique.length) {
      console.log(`❌ Traslados rotos (${brokenTransfersUnique.length}):`);
      brokenTransfersUnique.forEach((item) => console.log(`   ${item.tipo} · id ${item.id} · ${item.potrero} · ${item.date}`));
      console.log("");
    }
    if (orphanFieldRefs.length) {
      console.log(`❌ Movimientos con potrero fantasma (${orphanFieldRefs.length}):`);
      orphanFieldRefs.forEach((item) => console.log(`   ${item.kind} · id ${item.id} · fieldId ${item.fieldId} · ${item.date}`));
      console.log("");
    }
  }

  return { ok, findings };
}

const tenantId = Number(process.argv[2] || 123);
auditTenant(tenantId)
  .then((result) => process.exit(result.ok ? 0 : 1))
  .catch((error) => {
    console.error(error);
    process.exit(2);
  });
