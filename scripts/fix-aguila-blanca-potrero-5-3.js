// Correccion puntual confirmada por Rosendo (08/09/2026): deshace un
// traslado mal cargado de 2 vacas (Aguila Blanca potrero 5 -> potrero 3)
// y repone un nacimiento de 2 terneros en potrero 5 que se habia borrado
// por error junto con la correccion de otro problema. Ver conversacion
// del 08/09 para el detalle completo del calculo.
//
// Resultado esperado:
//   Aguila Blanca - potrero 5: 249 vacas, 0 terneros
//   Aguila Blanca - potrero 3: 40 vacas, 40 terneros (sin cambios en terneros)
//
// Solo se toca esto -- nada mas del workspace.
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

const TRANSFER_IDS_TO_REMOVE = ["anm-1788307304508", "anm-1788307304508-pair"];
const BIRTH_TO_RESTORE = {
  id: "anm-1788383159735",
  date: "2026-09-02",
  kind: "birth",
  notes: "",
  fieldId: "field-est-aguila-blanca-5",
  species: "vacunos",
  quantity: 2,
  categoryCode: "9",
  establishmentId: "est-aguila-blanca"
};

async function main() {
  loadEnvFile();
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  const [rows] = await conn.query(
    `SELECT workspace_json, row_version FROM saas_agro_workspaces WHERE tenant_id = 123 AND workspace_key = 'public' LIMIT 1`
  );
  if (!rows[0]) throw new Error("No se encontro el workspace de tenant 123");

  const data = typeof rows[0].workspace_json === "string" ? JSON.parse(rows[0].workspace_json) : rows[0].workspace_json;

  const before = data.animalMovements.length;
  data.animalMovements = data.animalMovements.filter((m) => !TRANSFER_IDS_TO_REMOVE.includes(m.id));
  const removed = before - data.animalMovements.length;
  if (removed !== 2) {
    throw new Error(`Se esperaban 2 movimientos para sacar (el traslado + su par), se encontraron ${removed}. Abortando sin guardar.`);
  }

  if (data.animalMovements.some((m) => m.id === BIRTH_TO_RESTORE.id)) {
    throw new Error(`El nacimiento ${BIRTH_TO_RESTORE.id} ya existe -- abortando sin guardar para no duplicarlo.`);
  }
  data.animalMovements.push(BIRTH_TO_RESTORE);

  await conn.execute(
    `UPDATE saas_agro_workspaces
     SET workspace_json = ?, row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = 123 AND workspace_key = 'public'`,
    [JSON.stringify(data)]
  );

  await conn.end();
  console.log("fix-aguila-blanca-ok", { movimientosAntes: before, movimientosDespues: data.animalMovements.length });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
