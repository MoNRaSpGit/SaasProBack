const fs = require("fs");
const mysql = require("mysql2/promise");

const DEMO_TENANT_SLUG = "agro-demo";
const WORKSPACE_KEY = "public";
const WORKSPACE_VERSION = "v1";

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

function animalMovement({
  id,
  date,
  establishmentId,
  fieldId,
  species,
  categoryCode,
  kind,
  quantity,
  notes,
  unitPrice,
  freightAmount,
  commissionAmount,
  taxAmount,
  totalAmount,
  currency,
  linkedAccountingEntryId
}) {
  return {
    id,
    date,
    establishmentId,
    fieldId,
    species,
    categoryCode,
    kind,
    quantity,
    notes,
    ...(unitPrice !== undefined ? { unitPrice } : {}),
    ...(freightAmount !== undefined ? { freightAmount } : {}),
    ...(commissionAmount !== undefined ? { commissionAmount } : {}),
    ...(taxAmount !== undefined ? { taxAmount } : {}),
    ...(totalAmount !== undefined ? { totalAmount } : {}),
    ...(currency ? { currency } : {}),
    ...(linkedAccountingEntryId ? { linkedAccountingEntryId } : {})
  };
}

function accountingEntry({
  id,
  date,
  establishmentId,
  fieldId,
  type,
  concept,
  currency,
  grossAmount,
  commissionAmount,
  taxAmount,
  netAmount,
  expectedAmount,
  collectedAmount,
  linkedAnimalMovementId,
  notes
}) {
  return {
    id,
    date,
    establishmentId,
    fieldId,
    type,
    concept,
    currency,
    grossAmount,
    commissionAmount,
    taxAmount,
    netAmount,
    ...(expectedAmount !== undefined ? { expectedAmount } : {}),
    ...(collectedAmount !== undefined ? { collectedAmount } : {}),
    ...(linkedAnimalMovementId ? { linkedAnimalMovementId } : {}),
    notes
  };
}

function monthlyExchangeRate(id, yearMonth, averageRate) {
  return { id, yearMonth, averageRate };
}

function rainfallRecord(id, date, fieldId, millimeters, notes) {
  return { id, date, fieldId, millimeters, notes };
}

function sanitaryRecord(id, date, establishmentId, fieldId, species, quantity, treatment, notes) {
  return { id, date, establishmentId, fieldId, species, quantity, treatment, notes };
}

function createDemoWorkspace() {
  const establishments = [
    { id: "est-demo-1", name: "La Esperanza", location: "Durazno", hectares: 1280 },
    { id: "est-demo-2", name: "San Jorge", location: "Flores", hectares: 910 }
  ];

  const fields = [
    {
      id: "field-demo-1",
      establishmentId: "est-demo-1",
      name: "La Esperanza",
      hectares: 1280,
      notes: "Campo principal para seguir el acumulado mensual."
    },
    {
      id: "field-demo-2",
      establishmentId: "est-demo-2",
      name: "San Jorge",
      hectares: 910,
      notes: "Campo secundario del demo sin carga operativa fuerte."
    }
  ];

  const animalMovements = [
    animalMovement({
      id: "mov-base-vac-1",
      date: "2025-06-30",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "2",
      kind: "adjustment",
      quantity: 180,
      notes: "Carga inicial: vacas de cria antes del ejercicio."
    }),
    animalMovement({
      id: "mov-base-vac-2",
      date: "2025-06-30",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "9",
      kind: "adjustment",
      quantity: 72,
      notes: "Carga inicial: terneros antes del ejercicio."
    }),
    animalMovement({
      id: "mov-base-ovi-1",
      date: "2025-06-30",
      establishmentId: "est-demo-2",
      fieldId: "field-demo-2",
      species: "ovinos",
      categoryCode: "2",
      kind: "adjustment",
      quantity: 120,
      notes: "Carga inicial: ovejas de cria antes del ejercicio."
    }),
    animalMovement({
      id: "mov-2026-01-entry",
      date: "2026-01-10",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "8",
      kind: "purchase",
      quantity: 10,
      unitPrice: 410,
      freightAmount: 40,
      commissionAmount: 35,
      taxAmount: 15,
      totalAmount: 4190,
      currency: "USD",
      linkedAccountingEntryId: "acc-2026-01-entry",
      notes: "Enero: entran 10 vaquillonas."
    }),
    animalMovement({
      id: "mov-2026-02-entry",
      date: "2026-02-12",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "9",
      kind: "birth",
      quantity: 10,
      notes: "Febrero: nacen 10 terneros."
    }),
    animalMovement({
      id: "mov-2026-02-exit",
      date: "2026-02-24",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "6",
      kind: "sale",
      quantity: 4,
      unitPrice: 690,
      commissionAmount: 45,
      taxAmount: 20,
      totalAmount: 2695,
      currency: "USD",
      linkedAccountingEntryId: "acc-2026-02-exit",
      notes: "Febrero: salen 4 novillos."
    }),
    animalMovement({
      id: "mov-2026-03-entry",
      date: "2026-03-08",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "8",
      kind: "purchase",
      quantity: 10,
      unitPrice: 425,
      freightAmount: 42,
      commissionAmount: 38,
      taxAmount: 18,
      totalAmount: 4348,
      currency: "USD",
      linkedAccountingEntryId: "acc-2026-03-entry",
      notes: "Marzo: entran 10 vaquillonas."
    }),
    animalMovement({
      id: "mov-2026-03-exit",
      date: "2026-03-21",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "5",
      kind: "death",
      quantity: 1,
      notes: "Marzo: baja de 1 animal."
    }),
    animalMovement({
      id: "mov-2026-04-entry",
      date: "2026-04-06",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "9",
      kind: "birth",
      quantity: 8,
      notes: "Abril: nacen 8 terneros."
    }),
    animalMovement({
      id: "mov-2026-04-exit",
      date: "2026-04-18",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "6",
      kind: "sale",
      quantity: 3,
      unitPrice: 705,
      commissionAmount: 35,
      taxAmount: 16,
      totalAmount: 2096,
      currency: "USD",
      linkedAccountingEntryId: "acc-2026-04-exit",
      notes: "Abril: salen 3 novillos."
    }),
    animalMovement({
      id: "mov-2026-05-entry",
      date: "2026-05-09",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "8",
      kind: "purchase",
      quantity: 7,
      unitPrice: 430,
      freightAmount: 30,
      commissionAmount: 24,
      taxAmount: 12,
      totalAmount: 3076,
      currency: "USD",
      linkedAccountingEntryId: "acc-2026-05-entry",
      notes: "Mayo: entran 7 vaquillonas."
    }),
    animalMovement({
      id: "mov-2026-05-exit",
      date: "2026-05-24",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      species: "vacunos",
      categoryCode: "2",
      kind: "shortage",
      quantity: 2,
      notes: "Mayo: faltante de 2 animales."
    })
  ];

  const accountingEntries = [
    accountingEntry({
      id: "acc-2026-01-entry",
      date: "2026-01-10",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "expense",
      concept: "compra_animales",
      currency: "USD",
      grossAmount: 4100,
      commissionAmount: 35,
      taxAmount: 55,
      netAmount: 4190,
      linkedAnimalMovementId: "mov-2026-01-entry",
      notes: "Compra de enero ligada a las 10 entradas."
    }),
    accountingEntry({
      id: "acc-2026-01-op",
      date: "2026-01-22",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "expense",
      concept: "alimentacion",
      currency: "UYU",
      grossAmount: 22000,
      commissionAmount: 0,
      taxAmount: 0,
      netAmount: 22000,
      notes: "Gasto operativo de enero."
    }),
    accountingEntry({
      id: "acc-2026-02-exit",
      date: "2026-02-24",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "income",
      concept: "venta_vacunos",
      currency: "USD",
      grossAmount: 2760,
      commissionAmount: 45,
      taxAmount: 20,
      netAmount: 2695,
      expectedAmount: 2695,
      collectedAmount: 1800,
      linkedAnimalMovementId: "mov-2026-02-exit",
      notes: "Cobro parcial de febrero."
    }),
    accountingEntry({
      id: "acc-2026-02-op",
      date: "2026-02-14",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "expense",
      concept: "sanidad",
      currency: "UYU",
      grossAmount: 14500,
      commissionAmount: 0,
      taxAmount: 0,
      netAmount: 14500,
      notes: "Gasto sanitario de febrero."
    }),
    accountingEntry({
      id: "acc-2026-03-entry",
      date: "2026-03-08",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "expense",
      concept: "compra_animales",
      currency: "USD",
      grossAmount: 4250,
      commissionAmount: 38,
      taxAmount: 60,
      netAmount: 4348,
      linkedAnimalMovementId: "mov-2026-03-entry",
      notes: "Compra de marzo ligada a las 10 entradas."
    }),
    accountingEntry({
      id: "acc-2026-03-op",
      date: "2026-03-19",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "expense",
      concept: "mantenimiento",
      currency: "UYU",
      grossAmount: 19800,
      commissionAmount: 0,
      taxAmount: 0,
      netAmount: 19800,
      notes: "Mantenimiento de marzo."
    }),
    accountingEntry({
      id: "acc-2026-04-exit",
      date: "2026-04-18",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "income",
      concept: "venta_vacunos",
      currency: "USD",
      grossAmount: 2147,
      commissionAmount: 35,
      taxAmount: 16,
      netAmount: 2096,
      expectedAmount: 2096,
      collectedAmount: 2096,
      linkedAnimalMovementId: "mov-2026-04-exit",
      notes: "Venta cobrada al contado en abril."
    }),
    accountingEntry({
      id: "acc-2026-04-op",
      date: "2026-04-11",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "expense",
      concept: "combustible",
      currency: "UYU",
      grossAmount: 16800,
      commissionAmount: 0,
      taxAmount: 0,
      netAmount: 16800,
      notes: "Combustible de abril."
    }),
    accountingEntry({
      id: "acc-2026-05-entry",
      date: "2026-05-09",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "expense",
      concept: "compra_animales",
      currency: "USD",
      grossAmount: 3010,
      commissionAmount: 24,
      taxAmount: 42,
      netAmount: 3076,
      linkedAnimalMovementId: "mov-2026-05-entry",
      notes: "Compra de mayo ligada a las 7 entradas."
    }),
    accountingEntry({
      id: "acc-2026-05-op",
      date: "2026-05-11",
      establishmentId: "est-demo-1",
      fieldId: "field-demo-1",
      type: "expense",
      concept: "sueldos",
      currency: "UYU",
      grossAmount: 26500,
      commissionAmount: 0,
      taxAmount: 0,
      netAmount: 26500,
      notes: "Sueldos de mayo."
    })
  ];

  const monthlyExchangeRates = [
    monthlyExchangeRate("fx-2026-01", "2026-01", 42.1),
    monthlyExchangeRate("fx-2026-02", "2026-02", 42.5),
    monthlyExchangeRate("fx-2026-03", "2026-03", 42.9),
    monthlyExchangeRate("fx-2026-04", "2026-04", 43.3),
    monthlyExchangeRate("fx-2026-05", "2026-05", 43.7),
    monthlyExchangeRate("fx-2026-06", "2026-06", 44.2)
  ];

  const rainfallRecords = [
    rainfallRecord("rain-2026-01", "2026-01-17", "field-demo-1", 9, "Lluvia de enero."),
    rainfallRecord("rain-2026-02", "2026-02-08", "field-demo-1", 26, "Lluvia de febrero."),
    rainfallRecord("rain-2026-03", "2026-03-21", "field-demo-1", 41, "Lluvia de marzo."),
    rainfallRecord("rain-2026-04", "2026-04-12", "field-demo-1", 33, "Lluvia de abril."),
    rainfallRecord("rain-2026-05", "2026-05-25", "field-demo-1", 17, "Lluvia de mayo.")
  ];

  const sanitaryRecords = [
    sanitaryRecord("san-2026-01", "2026-01-19", "est-demo-1", "field-demo-1", "vacunos", 96, "Bano garrapaticida", "Sanidad de enero."),
    sanitaryRecord("san-2026-02", "2026-02-15", "est-demo-1", "field-demo-1", "vacunos", 110, "Vacuna clostridial", "Sanidad de febrero."),
    sanitaryRecord("san-2026-04", "2026-04-28", "est-demo-1", "field-demo-1", "vacunos", 120, "Refuerzo mineral", "Sanidad de abril.")
  ];

  return {
    workspaceKey: WORKSPACE_KEY,
    version: WORKSPACE_VERSION,
    data: {
      establishments,
      fields,
      animalMovements,
      accountingEntries,
      rainfallRecords,
      sanitaryRecords,
      monthlyExchangeRates
    }
  };
}

async function main() {
  loadEnvFile();

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  try {
    await connection.beginTransaction();

    const [tenantRows] = await connection.execute(
      `SELECT id, name
       FROM saas_tenants
       WHERE slug = ?
       LIMIT 1`,
      [DEMO_TENANT_SLUG]
    );

    const tenant = tenantRows[0];
    if (!tenant) {
      throw new Error("No se encontro el tenant agro-demo. Corre primero create-agro-demo-user.js.");
    }

    const workspace = createDemoWorkspace();

    await connection.execute(
      `INSERT INTO saas_agro_workspaces (
         tenant_id,
         workspace_key,
         version,
         workspace_json
       ) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         version = VALUES(version),
         workspace_json = VALUES(workspace_json),
         updated_at = CURRENT_TIMESTAMP`,
      [tenant.id, WORKSPACE_KEY, WORKSPACE_VERSION, JSON.stringify(workspace.data)]
    );

    await connection.commit();

    console.log(
      JSON.stringify(
        {
          ok: true,
          tenantId: tenant.id,
          tenantName: tenant.name,
          tenantSlug: DEMO_TENANT_SLUG,
          seeded: {
            establishments: workspace.data.establishments.length,
            fields: workspace.data.fields.length,
            animalMovements: workspace.data.animalMovements.length,
            accountingEntries: workspace.data.accountingEntries.length,
            rainfallRecords: workspace.data.rainfallRecords.length,
            sanitaryRecords: workspace.data.sanitaryRecords.length,
            monthlyExchangeRates: workspace.data.monthlyExchangeRates.length
          },
          expectedChecks: {
            monthlyEntriesByMonth: {
              "2026-01": 10,
              "2026-02": 10,
              "2026-03": 10,
              "2026-04": 8,
              "2026-05": 7,
              "2026-06": 0
            },
            accumulatedEntriesThroughJune2026: 45
          },
          note: "Datos ficticios organizados para que el acumulado coincida exactamente con la suma mensual."
        },
        null,
        2
      )
    );
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
