// Actividad de frontend-gym: quien entro y que hizo, de TODOS los usuarios
// (cada uno puede estar en un workspace distinto). Solo lectura.
//
// Uso:
//   node scripts/inspect-gym-activity.js            -> ultimos 7 dias
//   node scripts/inspect-gym-activity.js 30         -> ultimos 30 dias
//   node scripts/inspect-gym-activity.js 7 demogym08 -> solo ese usuario/workspace
//
// Los inicios de sesion (y los intentos fallidos) quedan en el auditLog del
// workspace del usuario. Como la sesion vive solo mientras la pestaña esta
// abierta, cada inicio de sesion equivale a una visita.
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

const TZ = "America/Montevideo";
const fmt = (iso) =>
  new Date(iso).toLocaleString("es-UY", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
const dayKey = (iso) => new Date(iso).toLocaleDateString("es-UY", { timeZone: TZ });

const ACTION_LABELS = {
  login: "Inicio de sesión",
  login_failed: "Intento fallido",
  student_created: "Alta de alumno",
  student_renewed: "Renovación",
  student_updated: "Edición de alumno",
  student_deleted: "Borrado de alumno",
  student_checkin: "Ingreso (kiosco)",
  expense_created: "Alta de gasto",
  expense_paid: "Gasto pagado",
  expense_deleted: "Borrado de gasto",
  task_created: "Alta de tarea",
  task_moved: "Tarea movida",
  task_deleted: "Borrado de tarea",
  movement_created: "Movimiento cargado",
  movement_deleted: "Movimiento borrado",
  progress_created: "Medición cargada",
  progress_deleted: "Medición borrada"
};

async function main() {
  loadEnvFile();
  const days = Number(process.argv[2]) || 7;
  const onlyFilter = (process.argv[3] || "").toLowerCase();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });
  const [users] = await conn.query(
    `SELECT username, full_name, workspace_key, created_at FROM saas_gym_users ORDER BY workspace_key, username`
  );
  const [workspaces] = await conn.query(`SELECT workspace_key, workspace_json, updated_at FROM saas_gym_workspaces`);
  await conn.end();

  const byKey = new Map(
    workspaces.map((row) => {
      const data = typeof row.workspace_json === "string" ? JSON.parse(row.workspace_json) : row.workspace_json;
      return [row.workspace_key, { data, updatedAt: row.updated_at }];
    })
  );

  console.log(`\n=== Actividad gym · últimos ${days} días (hora Montevideo) ===\n`);

  const keys = [...new Set(users.map((u) => u.workspace_key))];
  for (const key of keys) {
    const members = users.filter((u) => u.workspace_key === key);
    if (onlyFilter && key !== onlyFilter && !members.some((u) => u.username === onlyFilter)) continue;

    const ws = byKey.get(key);
    const audit = (ws?.data?.auditLog ?? []).filter((e) => e.timestamp >= since);
    console.log(`── Workspace "${key}" · usuarios: ${members.map((u) => u.username).join(", ")}`);
    if (!ws) {
      console.log("   Nunca entró nadie (todavía no tiene datos).\n");
      continue;
    }

    const d = ws.data;
    console.log(
      `   Datos actuales: ${d.students?.length ?? 0} alumnos · ${d.expenses?.length ?? 0} gastos · ` +
        `${d.tasks?.length ?? 0} tareas · ${d.movements?.length ?? 0} movimientos · ${d.checkIns?.length ?? 0} ingresos`
    );

    // Por usuario: visitas y ultima entrada (el detalle del login trae el nombre).
    for (const user of members) {
      const name = (user.full_name || user.username).toLowerCase();
      const logins = audit.filter(
        (e) => e.action === "login" && e.details.toLowerCase().endsWith(`: ${name}`)
      );
      const failed = audit.filter(
        (e) => e.action === "login_failed" && e.details.toLowerCase().endsWith(`: ${user.username}`)
      );
      const allLogins = (d.auditLog ?? []).filter(
        (e) => e.action === "login" && e.details.toLowerCase().endsWith(`: ${name}`)
      );
      const last = allLogins.map((e) => e.timestamp).sort().pop();
      console.log(
        `   · ${user.username.padEnd(12)} visitas: ${String(logins.length).padStart(3)}   ` +
          `fallidos: ${String(failed.length).padStart(2)}   última entrada: ${last ? fmt(last) : "nunca"}`
      );
    }

    if (audit.length === 0) {
      console.log("   Sin actividad en el período.\n");
      continue;
    }

    // Resumen por dia.
    const perDay = new Map();
    for (const e of audit) {
      const k = dayKey(e.timestamp);
      const row = perDay.get(k) ?? { logins: 0, actions: 0 };
      if (e.action === "login") row.logins += 1;
      else if (e.action !== "login_failed") row.actions += 1;
      perDay.set(k, row);
    }
    console.log("   Por día:");
    for (const [k, row] of perDay) console.log(`     ${k.padEnd(11)} ${row.logins} visitas · ${row.actions} acciones`);

    // Que hicieron (conteo por tipo).
    const perAction = new Map();
    for (const e of audit) perAction.set(e.action, (perAction.get(e.action) ?? 0) + 1);
    console.log("   Qué hicieron:");
    for (const [action, count] of [...perAction.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`     ${(ACTION_LABELS[action] ?? action).padEnd(20)} ${count}`);
    }

    console.log("   Últimos movimientos:");
    for (const e of audit.slice(0, 10)) console.log(`     ${fmt(e.timestamp)}  ${e.details}`);
    console.log("");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
