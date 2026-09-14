// Mismo criterio que inspect-audit-log.js pero para Contabilidad
// (ventas/gastos) -- ver AgroAccountingAuditEntry en agro.types.ts.
// Pedido explicito del cliente (11/09/2026): a diferencia de los
// movimientos de animales, aca se maneja plata real y quiere poder ver
// todo lo que se edito o borro. No hay pantalla en la app que lo muestre
// a proposito; esta es la unica forma de verlo.
//
// Uso:
//   node scripts/inspect-accounting-audit-log.js [tenantId] [--action=edit|delete] [--establishment=<id o nombre>]
// Sin tenantId, audita el 123 (Rosendo, unico cliente real hoy).
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envPath = path.join(__dirname, "..", ".env");
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return env;
}

function extractEpoch(id) {
  return Number(String(id).match(/\d{10,}/)?.[0] || 0);
}

function formatEntry(entry, establishmentsById) {
  if (!entry) return "(eliminado)";
  const establishmentName = establishmentsById.get(entry.establishmentId)?.name || entry.establishmentId;
  const tipo = entry.type === "income" ? "Ingreso" : "Egreso";
  return `${tipo} · ${entry.concept} · establecimiento=${establishmentName} · neto=${entry.netAmount} ${entry.currency} · cobrado=${entry.collectedAmount ?? "-"} · fecha=${entry.date}${entry.notes ? ` · notas="${entry.notes}"` : ""}`;
}

async function main() {
  const tenantId = Number(process.argv.find((arg) => /^\d+$/.test(arg)) || 123);
  const actionFilter = process.argv.find((arg) => arg.startsWith("--action="))?.split("=")[1];
  const establishmentFilter = process.argv.find((arg) => arg.startsWith("--establishment="))?.split("=")[1];

  const env = loadEnvFile();
  const url = new URL(env.DATABASE_URL);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: url.port || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.replace("/", "")
  });

  const [rows] = await conn.execute(
    "SELECT workspace_json FROM saas_agro_workspaces WHERE tenant_id = ? AND workspace_key = ?",
    [tenantId, "public"]
  );
  await conn.end();

  if (!rows[0]) {
    console.log(`No hay workspace para tenant_id ${tenantId}.`);
    return;
  }

  const raw = rows[0].workspace_json;
  const workspace = typeof raw === "string" ? JSON.parse(raw) : raw;
  const auditLog = Array.isArray(workspace.accountingAuditLog) ? workspace.accountingAuditLog : [];
  const establishmentsById = new Map((workspace.establishments || []).map((e) => [e.id, e]));

  let entries = [...auditLog].sort((a, b) => extractEpoch(b.id) - extractEpoch(a.id));

  if (actionFilter) {
    entries = entries.filter((e) => e.action === actionFilter);
  }
  if (establishmentFilter) {
    const needle = establishmentFilter.toLowerCase();
    entries = entries.filter((e) => {
      const establishmentId = e.before?.establishmentId || e.after?.establishmentId;
      const establishmentName = establishmentsById.get(establishmentId)?.name || "";
      return (establishmentId || "").toLowerCase().includes(needle) || establishmentName.toLowerCase().includes(needle);
    });
  }

  console.log(`=== Auditoria contable agro -- tenant_id ${tenantId} (${entries.length} entrada(s) de ${auditLog.length} totales) ===\n`);

  if (entries.length === 0) {
    console.log("Nada para mostrar con ese filtro.");
    return;
  }

  for (const entry of entries) {
    const epoch = extractEpoch(entry.id);
    const when = epoch ? new Date(epoch).toLocaleString("es-UY", { timeZone: "America/Montevideo" }) : "(sin timestamp)";
    console.log(`[${when}] ${entry.action.toUpperCase()} -- movimiento contable ${entry.entryId}`);
    console.log(`  antes:    ${formatEntry(entry.before, establishmentsById)}`);
    console.log(`  despues:  ${formatEntry(entry.after, establishmentsById)}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
