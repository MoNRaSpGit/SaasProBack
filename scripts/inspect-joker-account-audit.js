// Lee saas_joker_account_audit_log -- rastro de cada alta/edicion/borrado de
// un movimiento de cuenta corriente (saas_joker_account_entries), disparado
// desde Pedidos, Panel/Historial (editar pedido) o cambio rapido de metodo
// de pago. Sin pantalla en la app: se consulta a mano con este script,
// mismo criterio que backend/scripts/inspect-audit-log.js de frontend-agro.
//
// Uso:
//   node scripts/inspect-joker-account-audit.js                 -> ultimos 50 movimientos, todos los clientes
//   node scripts/inspect-joker-account-audit.js --client 5      -> solo el cliente con id 5
//   node scripts/inspect-joker-account-audit.js --order 1805    -> solo lo relacionado a ese pedido
const fs = require("fs");
const mysql = require("mysql2/promise");

function loadEnvFile() {
  const envText = fs.readFileSync(".env", "utf8");

  for (const line of envText.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();

    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv) {
  const args = { clientId: null, orderId: null, limit: 50 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--client") args.clientId = Number(argv[++i]);
    if (argv[i] === "--order") args.orderId = Number(argv[++i]);
    if (argv[i] === "--limit") args.limit = Number(argv[++i]);
  }
  return args;
}

function montevideoTime(date) {
  return date ? new Date(date).toLocaleString("es-UY", { timeZone: "America/Montevideo", hour12: true }) : null;
}

async function main() {
  loadEnvFile();
  const args = parseArgs(process.argv.slice(2));

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  const where = [];
  const params = [];
  if (args.clientId) {
    where.push("client_id = ?");
    params.push(args.clientId);
  }
  if (args.orderId) {
    where.push("order_id = ?");
    params.push(args.orderId);
  }
  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await conn.query(
    `SELECT a.*, c.name AS client_name
     FROM saas_joker_account_audit_log a
     LEFT JOIN saas_joker_clients c ON c.id = a.client_id
     ${whereClause}
     ORDER BY a.id DESC
     LIMIT ?`,
    [...params, args.limit]
  );

  console.log(`${rows.length} movimiento(s) de auditoria:`);
  for (const row of rows) {
    console.log(
      `\n#${row.id} · ${montevideoTime(row.created_at)} · ${row.action.toUpperCase()} · ${row.reason}` +
        `\n  cliente: ${row.client_name ?? "?"} (id ${row.client_id}) · entry_id=${row.entry_id} · order_id=${row.order_id} · actor=${row.actor_role ?? "?"}`
    );
    if (row.previous_total !== null) {
      console.log(`  antes: $${row.previous_total} ${JSON.stringify(row.previous_items)}`);
    }
    if (row.new_total !== null) {
      console.log(`  despues: $${row.new_total} ${JSON.stringify(row.new_items)}`);
    }
  }

  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
