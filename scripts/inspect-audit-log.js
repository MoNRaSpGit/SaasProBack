// Consulta el registro de auditoria (ediciones/borrados de movimientos de
// animales) de un tenant -- PARA NOSOTROS, no para el cliente. No hay
// pantalla en la app que lo muestre a proposito; esto es la unica forma de
// verlo, cuando el cliente pregunte "che, que paso aca" y haga falta
// reconstruir que edicion o borrado cambio un numero.
//
// Uso:
//   node scripts/inspect-audit-log.js [tenantId] [--action=edit|delete] [--field=<fieldId o nombre>]
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

function formatRecord(record) {
  if (!record) return "(eliminado)";
  return `${record.kind} · campo=${record.establishmentId} potrero=${record.fieldId} · ${record.species} cat.${record.categoryCode} · qty=${record.quantity} · fecha=${record.date}${record.notes ? ` · notas="${record.notes}"` : ""}`;
}

async function main() {
  const tenantId = Number(process.argv.find((arg) => /^\d+$/.test(arg)) || 123);
  const actionFilter = process.argv.find((arg) => arg.startsWith("--action="))?.split("=")[1];
  const fieldFilter = process.argv.find((arg) => arg.startsWith("--field="))?.split("=")[1];

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
  const auditLog = Array.isArray(workspace.auditLog) ? workspace.auditLog : [];
  const fieldsById = new Map((workspace.fields || []).map((f) => [f.id, f]));

  let entries = [...auditLog].sort((a, b) => extractEpoch(b.id) - extractEpoch(a.id));

  if (actionFilter) {
    entries = entries.filter((e) => e.action === actionFilter);
  }
  if (fieldFilter) {
    const needle = fieldFilter.toLowerCase();
    entries = entries.filter((e) => {
      const fieldId = e.before?.fieldId || e.after?.fieldId;
      const fieldName = fieldsById.get(fieldId)?.name || "";
      return (fieldId || "").toLowerCase().includes(needle) || fieldName.toLowerCase().includes(needle);
    });
  }

  console.log(`=== Auditoria agro -- tenant_id ${tenantId} (${entries.length} entrada(s) de ${auditLog.length} totales) ===\n`);

  if (entries.length === 0) {
    console.log("Nada para mostrar con ese filtro.");
    return;
  }

  for (const entry of entries) {
    const epoch = extractEpoch(entry.id);
    const when = epoch ? new Date(epoch).toLocaleString("es-UY", { timeZone: "America/Montevideo" }) : "(sin timestamp)";
    console.log(`[${when}] ${entry.action.toUpperCase()} -- movimiento ${entry.movementId}`);
    console.log(`  antes:    ${formatRecord(entry.before)}`);
    console.log(`  despues:  ${formatRecord(entry.after)}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
