// Correccion puntual confirmada por el usuario (error de carga de Rosendo):
// el 27/08/2026 se cargo un traslado de 16 vacas de cria (Chapadon ->
// "Invernada Casas") eligiendo del desplegable el potrero equivocado.
// La Milagrosa tenia DOS potreros con nombre casi igual, los dos
// "agregados manualmente":
//   - field-est-la-milagrosa-invernada-de-casas  ("Invernada de Casas", 50 ha) -- el real, con toda la historia
//   - field-est-la-milagrosa-invernada-casas     ("Invernada Casas", 40 ha)    -- duplicado, su UNICO movimiento es este traslado
//
// Este script:
//   1) re-apunta el transfer_in anm-1788212149662-pair al potrero real
//      (field-est-la-milagrosa-invernada-de-casas)
//   2) elimina el potrero duplicado field-est-la-milagrosa-invernada-casas
//
// Resultado esperado: las 16 vacas quedan en "Invernada de Casas"; el
// potrero "Invernada Casas" desaparece. Nada mas del workspace se toca.
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

const PAIR_MOVEMENT_ID = "anm-1788212149662-pair";
const DUPLICATE_FIELD_ID = "field-est-la-milagrosa-invernada-casas";
const REAL_FIELD_ID = "field-est-la-milagrosa-invernada-de-casas";

async function main() {
  loadEnvFile();
  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  const [rows] = await conn.query(
    `SELECT workspace_json, row_version FROM saas_agro_workspaces WHERE tenant_id = 123 AND workspace_key = 'public' LIMIT 1`
  );
  if (!rows[0]) throw new Error("No se encontro el workspace de tenant 123");

  const data = typeof rows[0].workspace_json === "string" ? JSON.parse(rows[0].workspace_json) : rows[0].workspace_json;

  // 1) el potrero real tiene que existir
  if (!(data.fields || []).some((f) => f.id === REAL_FIELD_ID)) {
    throw new Error(`No existe el potrero real ${REAL_FIELD_ID} -- abortando sin guardar.`);
  }

  // 2) re-apuntar el transfer_in
  const pair = (data.animalMovements || []).find((m) => m.id === PAIR_MOVEMENT_ID);
  if (!pair) throw new Error(`No se encontro el movimiento ${PAIR_MOVEMENT_ID} -- abortando sin guardar.`);
  if (pair.fieldId !== DUPLICATE_FIELD_ID) {
    throw new Error(
      `El movimiento ${PAIR_MOVEMENT_ID} apunta a "${pair.fieldId}", se esperaba "${DUPLICATE_FIELD_ID}" -- abortando sin guardar.`
    );
  }
  pair.fieldId = REAL_FIELD_ID;

  // 3) verificar que NADA mas referencia el potrero duplicado
  const stillRef = (data.animalMovements || []).filter(
    (m) => m.fieldId === DUPLICATE_FIELD_ID || m.toFieldId === DUPLICATE_FIELD_ID || m.fromFieldId === DUPLICATE_FIELD_ID
  );
  if (stillRef.length) {
    throw new Error(
      `El potrero duplicado todavia tiene ${stillRef.length} movimiento(s) referenciandolo (${stillRef
        .map((m) => m.id)
        .join(", ")}) -- abortando sin guardar.`
    );
  }

  // 4) eliminar el potrero duplicado
  const beforeFields = data.fields.length;
  data.fields = data.fields.filter((f) => f.id !== DUPLICATE_FIELD_ID);
  const removedFields = beforeFields - data.fields.length;
  if (removedFields !== 1) {
    throw new Error(`Se esperaba borrar 1 potrero, se borraron ${removedFields} -- abortando sin guardar.`);
  }

  await conn.execute(
    `UPDATE saas_agro_workspaces
     SET workspace_json = ?, row_version = row_version + 1, updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = 123 AND workspace_key = 'public' AND row_version = ?`,
    [JSON.stringify(data), rows[0].row_version]
  );

  await conn.end();
  console.log("fix-milagrosa-invernada-casas-ok", {
    movimientoReapuntado: PAIR_MOVEMENT_ID,
    de: DUPLICATE_FIELD_ID,
    a: REAL_FIELD_ID,
    potrerosAntes: beforeFields,
    potrerosDespues: data.fields.length
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
