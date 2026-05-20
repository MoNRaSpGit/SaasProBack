const fs = require("fs");
const mysql = require("mysql2/promise");

const WORKSPACE_KEY = "public";

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

function parseWorkspaceJson(value) {
  if (typeof value === "object" && value !== null && !Buffer.isBuffer(value)) {
    return value;
  }

  return JSON.parse(Buffer.isBuffer(value) ? value.toString("utf8") : String(value));
}

async function main() {
  loadEnvFile();

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  try {
    const [rows] = await connection.execute(
      `SELECT id, workspace_json
       FROM saas_agro_public_workspaces
       WHERE workspace_key = ?
       LIMIT 1`,
      [WORKSPACE_KEY]
    );

    const row = rows[0];
    if (!row) {
      throw new Error("No se encontro el workspace publico de agro.");
    }

    const currentWorkspace = parseWorkspaceJson(row.workspace_json);
    const preservedFields = Array.isArray(currentWorkspace.fields) ? currentWorkspace.fields : [];
    const fieldEstablishmentIds = new Set(
      preservedFields
        .map((field) => (field && typeof field.establishmentId === "string" ? field.establishmentId : ""))
        .filter(Boolean)
    );
    const preservedEstablishments = Array.isArray(currentWorkspace.establishments)
      ? currentWorkspace.establishments.filter(
          (establishment) =>
            establishment &&
            typeof establishment.id === "string" &&
            fieldEstablishmentIds.has(establishment.id)
        )
      : [];

    const nextWorkspace = {
      establishments: preservedEstablishments,
      fields: preservedFields,
      animalMovements: [],
      accountingEntries: [],
      rainfallRecords: [],
      sanitaryRecords: [],
      monthlyExchangeRates: []
    };

    await connection.execute(
      `UPDATE saas_agro_public_workspaces
       SET workspace_json = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [JSON.stringify(nextWorkspace), row.id]
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          workspaceKey: WORKSPACE_KEY,
          preservedEstablishments: preservedEstablishments.length,
          preservedFields: preservedFields.length,
          cleared: [
            "animalMovements",
            "accountingEntries",
            "rainfallRecords",
            "sanitaryRecords",
            "monthlyExchangeRates"
          ]
        },
        null,
        2
      )
    );
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
