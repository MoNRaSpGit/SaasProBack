const fs = require("fs");
const mysql = require("mysql2/promise");

const DEMO_EMAIL = "neon.demo@saaspro.com";
const ACTIVITY_YEAR = 2026;

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

async function insertAccount(connection, tenantId, account) {
  const [result] = await connection.execute(
    `INSERT INTO saas_neon_accounts (
       tenant_id,
       name,
       account_type,
       opening_balance
     )
     VALUES (?, ?, ?, ?)`,
    [tenantId, account.name, account.accountType, account.openingBalance]
  );

  return result.insertId;
}

async function insertClient(connection, tenantId, client) {
  const [result] = await connection.execute(
    `INSERT INTO saas_neon_clients (
       tenant_id,
       name,
       phone,
       notes
     )
     VALUES (?, ?, ?, ?)`,
    [tenantId, client.name, client.phone ?? null, client.notes ?? null]
  );

  return result.insertId;
}

async function insertActivity(connection, tenantId, activity) {
  const [result] = await connection.execute(
    `INSERT INTO saas_neon_activities (
       tenant_id,
       activity_number,
       activity_year,
       activity_date,
       description,
       client_id,
       activity_type,
       commercial_status,
       quoted_amount
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      activity.activityNumber,
      ACTIVITY_YEAR,
      activity.activityDate,
      activity.description,
      activity.clientId,
      activity.activityType,
      activity.commercialStatus,
      activity.quotedAmount
    ]
  );

  return result.insertId;
}

async function insertMovement(connection, tenantId, movement) {
  const [result] = await connection.execute(
    `INSERT INTO saas_neon_movements (
       tenant_id,
       movement_type,
       movement_date,
       account_id,
       total_amount,
       description,
       provider_name,
       document_ref,
       quantity,
       unit_label,
       currency_code,
       expense_kind,
       credit_card_label,
       due_date,
       source_type,
       source_activity_id
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      movement.movementType,
      movement.movementDate,
      movement.accountId,
      movement.totalAmount,
      movement.description ?? null,
      movement.providerName ?? null,
      null,
      null,
      null,
      movement.currencyCode ?? null,
      movement.expenseKind ?? null,
      movement.creditCardLabel ?? null,
      movement.dueDate ?? null,
      movement.sourceType ?? "independent",
      movement.sourceActivityId ?? null
    ]
  );

  for (const allocation of movement.allocations) {
    await connection.execute(
      `INSERT INTO saas_neon_movement_allocations (
         tenant_id,
         movement_id,
         destination_type,
         destination_activity_id,
         destination_label,
         amount,
         metadata_json
       )
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        result.insertId,
        allocation.destinationType,
        allocation.destinationActivityId ?? null,
        allocation.destinationLabel ?? null,
        allocation.amount,
        allocation.metadata ? JSON.stringify(allocation.metadata) : null
      ]
    );
  }

  return result.insertId;
}

async function main() {
  loadEnvFile();

  const connection = await mysql.createConnection({ uri: process.env.DATABASE_URL, multipleStatements: true });

  try {
    await connection.beginTransaction();

    const [tenantRows] = await connection.query(
      `SELECT tm.tenant_id, t.name AS tenant_name
       FROM saasPro_users u
       INNER JOIN saas_tenant_memberships tm
         ON tm.user_id = u.id
       INNER JOIN saas_tenants t
         ON t.id = tm.tenant_id
       WHERE u.email = ?
       ORDER BY tm.is_default DESC, tm.id ASC
       LIMIT 1`,
      [DEMO_EMAIL]
    );

    const tenantRow = tenantRows[0];
    if (!tenantRow) {
      throw new Error(`No se encontro tenant demo para ${DEMO_EMAIL}`);
    }

    const tenantId = Number(tenantRow.tenant_id);

    await connection.execute(`DELETE FROM saas_neon_activity_payments WHERE tenant_id = ?`, [tenantId]);
    await connection.execute(`DELETE FROM saas_neon_movement_allocations WHERE tenant_id = ?`, [tenantId]);
    await connection.execute(`DELETE FROM saas_neon_movements WHERE tenant_id = ?`, [tenantId]);
    await connection.execute(`DELETE FROM saas_neon_activities WHERE tenant_id = ?`, [tenantId]);
    await connection.execute(`DELETE FROM saas_neon_clients WHERE tenant_id = ?`, [tenantId]);
    await connection.execute(`DELETE FROM saas_neon_accounts WHERE tenant_id = ?`, [tenantId]);

    const cajaId = await insertAccount(connection, tenantId, {
      name: "Caja $",
      accountType: "cash",
      openingBalance: 8000
    });
    const brouId = await insertAccount(connection, tenantId, {
      name: "BROU $",
      accountType: "bank",
      openingBalance: 25000
    });
    const bbvaId = await insertAccount(connection, tenantId, {
      name: "BBVA $",
      accountType: "bank",
      openingBalance: 12000
    });
    await insertAccount(connection, tenantId, {
      name: "ITAU U$S",
      accountType: "bank",
      openingBalance: 0
    });
    const creditId = await insertAccount(connection, tenantId, {
      name: "Credito",
      accountType: "credit",
      openingBalance: 0
    });

    const clienteNeonId = await insertClient(connection, tenantId, {
      name: "Cliente Neon Centro",
      phone: "099111111",
      notes: "Cliente de prueba para fachada y carteleria"
    });
    const clienteMovilId = await insertClient(connection, tenantId, {
      name: "Cliente Movil Norte",
      phone: "099222222",
      notes: "Cliente de prueba para movil audiovisual"
    });
    const clientePendienteId = await insertClient(connection, tenantId, {
      name: "Cliente Vidriera Sur",
      phone: "099333333",
      notes: "Actividad pendiente de facturar"
    });

    const actividad1Id = await insertActivity(connection, tenantId, {
      activityNumber: 1,
      activityDate: "2026-05-02",
      description: "Fachada neon local Centro",
      clientId: clienteNeonId,
      activityType: "neon",
      commercialStatus: "facturado",
      quotedAmount: 15000
    });
    const actividad2Id = await insertActivity(connection, tenantId, {
      activityNumber: 2,
      activityDate: "2026-05-03",
      description: "Reparacion movil audiovisual Norte",
      clientId: clienteMovilId,
      activityType: "movil_audiovisual",
      commercialStatus: "pendiente_de_cobrar",
      quotedAmount: 10000
    });
    await insertActivity(connection, tenantId, {
      activityNumber: 3,
      activityDate: "2026-05-04",
      description: "Vidriera pendiente para local Sur",
      clientId: clientePendienteId,
      activityType: "neon",
      commercialStatus: "pendiente_de_facturar",
      quotedAmount: 7000
    });

    await insertMovement(connection, tenantId, {
      movementType: "expense",
      movementDate: "2026-05-04",
      accountId: cajaId,
      totalAmount: 3000,
      description: "Gasoil y uso personal",
      providerName: "Estacion America",
      currencyCode: "UYU",
      expenseKind: "operational",
      allocations: [
        {
          destinationType: "vehicle",
          destinationLabel: "Toyota RAA1111",
          amount: 2000,
          metadata: {
            kilometers: 120000,
            liters: 40
          }
        },
        {
          destinationType: "personal",
          destinationLabel: "Casa",
          amount: 1000
        }
      ]
    });

    await insertMovement(connection, tenantId, {
      movementType: "expense",
      movementDate: "2026-05-05",
      accountId: creditId,
      totalAmount: 4200,
      description: "Materiales para movil",
      providerName: "Moderna",
      currencyCode: "UYU",
      expenseKind: "operational",
      creditCardLabel: "Visa Itau",
      dueDate: "2026-05-20",
      allocations: [
        {
          destinationType: "activity",
          destinationActivityId: actividad2Id,
          amount: 4200
        }
      ]
    });

    await insertMovement(connection, tenantId, {
      movementType: "income",
      movementDate: "2026-05-05",
      accountId: brouId,
      totalAmount: 18000,
      description: "Cobro alquiler mayo",
      allocations: [
        {
          destinationType: "rental",
          destinationLabel: "ALQ1",
          amount: 18000
        }
      ]
    });

    await insertMovement(connection, tenantId, {
      movementType: "income",
      movementDate: "2026-05-06",
      accountId: bbvaId,
      totalAmount: 12000,
      description: "Cobro clientes semana",
      allocations: [
        {
          destinationType: "activity",
          destinationActivityId: actividad1Id,
          amount: 9000
        },
        {
          destinationType: "activity",
          destinationActivityId: actividad2Id,
          amount: 3000
        }
      ]
    });

    await connection.commit();
    console.log(
      JSON.stringify(
        {
          ok: true,
          tenantId,
          tenantName: tenantRow.tenant_name,
          accounts: 5,
          clients: 3,
          activities: 3,
          movements: 4
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
