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

// Hamburguesa Especial, Hamburguesa Americana BBQ, Hamburguesa 4Q
const COMBO_2_BURGERS = [23, 24, 25];
// Hamburguesa Especial Doble Carne, Hamburguesa Americana BBQ 2.0, Hamburguesa 4Q 2.0
const COMBO_4_BURGERS = [27, 28, 29];

const SLOTS = [
  // Combo Nº2 (id 72): hamburguesa a eleccion (lista curada a mano, no
  // "toda la categoria" -- ver optionProductIds) + refresco chico
  // (optionCategory: se resuelve en vivo, ver joker-products.service.ts
  // -- cualquier refresco chico publicado entra solo, sin tocar nada
  // aca cuando se agrega uno nuevo).
  { comboProductId: 72, slotLabel: "Hamburguesa", slotQuantity: 1, optionProductIds: COMBO_2_BURGERS, sortOrder: 0 },
  { comboProductId: 72, slotLabel: "Refresco", slotQuantity: 1, optionCategory: "Refrescos Chicos", sortOrder: 1 },
  // Combo Nº4 (id 74): hamburguesa doble carne a eleccion + refresco chico
  { comboProductId: 74, slotLabel: "Hamburguesa (doble carne)", slotQuantity: 1, optionProductIds: COMBO_4_BURGERS, sortOrder: 0 },
  { comboProductId: 74, slotLabel: "Refresco", slotQuantity: 1, optionCategory: "Refrescos Chicos", sortOrder: 1 },
  // Combo Nº7 (id 77): las 3 hamburguesas son siempre clasicas (receta fija,
  // ver mas abajo), solo el refresco grande queda a eleccion (misma logica
  // en vivo que el refresco chico, categoria "Refrescos").
  { comboProductId: 77, slotLabel: "Refresco", slotQuantity: 1, optionCategory: "Refrescos", sortOrder: 0 }
];

// Combo Nº7 = 3 hamburguesas clasicas (siempre Comun: pan tortuga + churrasco
// de hamburguesa), receta fija igual que un producto normal.
const COMBO_7_FIXED_RECIPE = [
  { productId: 77, stockItemId: 3, quantityPerUnit: 3 }, // Churrasco de hamburguesa x3
  { productId: 77, stockItemId: 10, quantityPerUnit: 3 } // Pan tortuga clasica x3
];

async function main() {
  loadEnvFile();

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL });

  const comboIds = [...new Set(SLOTS.map((s) => s.comboProductId))];
  await conn.query(`DELETE FROM saas_joker_combo_slots WHERE combo_product_id IN (${comboIds.join(",")})`);

  for (const slot of SLOTS) {
    await conn.execute(
      `INSERT INTO saas_joker_combo_slots (combo_product_id, slot_label, slot_quantity, option_product_ids, option_category, sort_order)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        slot.comboProductId,
        slot.slotLabel,
        slot.slotQuantity,
        JSON.stringify(slot.optionProductIds ?? []),
        slot.optionCategory ?? null,
        slot.sortOrder
      ]
    );
  }

  await conn.execute(`DELETE FROM saas_joker_product_recipes WHERE product_id = 77`);
  for (const line of COMBO_7_FIXED_RECIPE) {
    await conn.execute(
      `INSERT INTO saas_joker_product_recipes (product_id, stock_item_id, quantity_per_unit) VALUES (?, ?, ?)`,
      [line.productId, line.stockItemId, line.quantityPerUnit]
    );
  }

  console.log("seed-joker-combo-slots-ok", { slots: SLOTS.length, comboIds });
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
