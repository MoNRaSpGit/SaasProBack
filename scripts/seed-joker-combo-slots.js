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

// Refrescos Chicos (500/600 ml) y Refrescos (formato grande), tal cual estan
// hoy en el catalogo. Si se agregan sodas nuevas a esas categorias despues,
// hay que sumarlas aca a mano (no se resuelve por categoria en vivo, para
// no arrastrar productos nuevos sin revisar).
const REFRESCOS_CHICOS = [249, 250, 251, 252, 253, 254, 255, 256, 257, 258];
const REFRESCOS_GRANDES = [228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239, 240, 241, 242, 243, 244, 245, 246, 247, 248];

// Hamburguesa Especial, Hamburguesa Americana BBQ, Hamburguesa 4Q
const COMBO_2_BURGERS = [23, 24, 25];
// Hamburguesa Especial Doble Carne, Hamburguesa Americana BBQ 2.0, Hamburguesa 4Q 2.0
const COMBO_4_BURGERS = [27, 28, 29];

const SLOTS = [
  // Combo Nº2 (id 72): hamburguesa a eleccion + refresco medio
  { comboProductId: 72, slotLabel: "Hamburguesa", slotQuantity: 1, optionProductIds: COMBO_2_BURGERS, sortOrder: 0 },
  { comboProductId: 72, slotLabel: "Refresco", slotQuantity: 1, optionProductIds: REFRESCOS_CHICOS, sortOrder: 1 },
  // Combo Nº4 (id 74): hamburguesa doble carne a eleccion + refresco medio
  { comboProductId: 74, slotLabel: "Hamburguesa (doble carne)", slotQuantity: 1, optionProductIds: COMBO_4_BURGERS, sortOrder: 0 },
  { comboProductId: 74, slotLabel: "Refresco", slotQuantity: 1, optionProductIds: REFRESCOS_CHICOS, sortOrder: 1 },
  // Combo Nº7 (id 77): las 3 hamburguesas son siempre clasicas (receta fija,
  // ver mas abajo), solo el refresco grande queda a eleccion.
  { comboProductId: 77, slotLabel: "Refresco", slotQuantity: 1, optionProductIds: REFRESCOS_GRANDES, sortOrder: 0 }
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
      `INSERT INTO saas_joker_combo_slots (combo_product_id, slot_label, slot_quantity, option_product_ids, sort_order)
       VALUES (?, ?, ?, ?, ?)`,
      [slot.comboProductId, slot.slotLabel, slot.slotQuantity, JSON.stringify(slot.optionProductIds), slot.sortOrder]
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
