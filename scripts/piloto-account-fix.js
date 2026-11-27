// Correcciones de la cuenta corriente de Piloto (27/11/2026). Las hacemos
// nosotros cuando en el negocio avisan un error: NUNCA se borra, se marca
// como anulado y queda en el historial.
//
// Uso:
//   node scripts/piloto-account-fix.js                      -> clientes y saldos
//   node scripts/piloto-account-fix.js ver <clientId>       -> movimientos
//   node scripts/piloto-account-fix.js anular pago <id> "motivo"           (muestra que haria)
//   node scripts/piloto-account-fix.js anular pago <id> "motivo" --aplicar
//   node scripts/piloto-account-fix.js anular fiado <id> "motivo" --aplicar
//
// Anular un pago que habia saldado la cuenta la vuelve a abrir. Anular un
// fiado NO borra la venta del Panel (avisar si tambien hay que sacarla).
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

const OPEN = "closed_by_payment_id IS NULL AND voided_at IS NULL";
const TABLES = { pago: "saas_piloto_account_payments", fiado: "saas_piloto_account_entries" };
const when = (date) => new Date(date).toLocaleString("es-UY", { timeZone: "America/Montevideo" });

async function balance(connection, clientId) {
  const [[row]] = await connection.query(
    `SELECT
       (SELECT COALESCE(SUM(total), 0) FROM saas_piloto_account_entries WHERE client_id = ? AND ${OPEN}) -
       (SELECT COALESCE(SUM(amount), 0) FROM saas_piloto_account_payments WHERE client_id = ? AND ${OPEN}) AS balance`,
    [clientId, clientId]
  );
  return Number(row.balance);
}

async function main() {
  loadEnvFile();
  const [command, a, b, reason] = process.argv.slice(2);
  const apply = process.argv.includes("--aplicar");
  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  try {
    if (!command) {
      const [clients] = await connection.query("SELECT id, name, deleted_at FROM saas_piloto_clients ORDER BY name");
      for (const client of clients) {
        console.log(`#${client.id} ${client.name}${client.deleted_at ? " (borrado)" : ""} · debe $${await balance(connection, client.id)}`);
      }
      return;
    }

    if (command === "ver") {
      const [rows] = await connection.query(
        `SELECT 'fiado' AS tipo, id, total AS monto, created_at, closed_by_payment_id, voided_at, void_reason
           FROM saas_piloto_account_entries WHERE client_id = ?
         UNION ALL
         SELECT 'pago', id, amount, created_at, closed_by_payment_id, voided_at, void_reason
           FROM saas_piloto_account_payments WHERE client_id = ?
         ORDER BY created_at, id`,
        [a, a]
      );
      for (const row of rows) {
        const state = row.voided_at ? `ANULADO (${row.void_reason})` : row.closed_by_payment_id ? `saldado por pago #${row.closed_by_payment_id}` : "abierto";
        console.log(`${when(row.created_at)}  ${row.tipo} #${row.id}  $${Number(row.monto)}  ${state}`);
      }
      console.log(`Debe: $${await balance(connection, a)}`);
      return;
    }

    const table = TABLES[a];
    if (command !== "anular" || !table || !b || !reason || reason.startsWith("--")) {
      console.log('Uso: anular pago|fiado <id> "motivo" [--aplicar]');
      return;
    }

    await connection.beginTransaction();
    const [[found]] = await connection.query(`SELECT client_id FROM ${table} WHERE id = ?`, [b]);
    if (!found) throw new Error(`No existe el ${a} #${b}.`);
    await connection.query("SELECT id FROM saas_piloto_clients WHERE id = ? FOR UPDATE", [found.client_id]);
    const [[row]] = await connection.query(`SELECT * FROM ${table} WHERE id = ? FOR UPDATE`, [b]);
    if (row.voided_at) throw new Error("Ya estaba anulado.");
    if (a === "fiado" && row.closed_by_payment_id) {
      throw new Error(`Ese fiado ya se saldo con el pago #${row.closed_by_payment_id}: anular primero ese pago.`);
    }

    const before = await balance(connection, found.client_id);
    if (a === "pago") {
      // Reabre lo que ese pago habia cerrado.
      for (const name of Object.values(TABLES)) {
        await connection.query(`UPDATE ${name} SET closed_by_payment_id = NULL WHERE closed_by_payment_id = ?`, [b]);
      }
    }
    await connection.query(`UPDATE ${table} SET voided_at = NOW(), void_reason = ? WHERE id = ?`, [reason.slice(0, 200), b]);
    const after = await balance(connection, found.client_id);
    if (after < 0) throw new Error(`No se puede: la cuenta quedaria en $${after}.`);

    console.log(`Cliente #${found.client_id}: debe $${before} -> $${after}`);
    if (apply) {
      await connection.commit();
      console.log("APLICADO.");
    } else {
      await connection.rollback();
      console.log("Solo prueba (agregar --aplicar para guardar).");
    }
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
