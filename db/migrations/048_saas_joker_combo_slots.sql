-- Slots de eleccion dentro de un combo (ej: "Hamburguesa" o "Refresco"),
-- para que el descuento de stock siga a lo que efectivamente se eligio en
-- vez de quedar fijo al producto combo. option_product_ids es la lista
-- curada de productos que se pueden elegir para ese slot; cada uno ya tiene
-- su propia receta en saas_joker_product_recipes, asi que no hace falta
-- duplicar nada aca.
CREATE TABLE IF NOT EXISTS saas_joker_combo_slots (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  combo_product_id BIGINT UNSIGNED NOT NULL,
  slot_label VARCHAR(60) NOT NULL,
  slot_quantity INT UNSIGNED NOT NULL DEFAULT 1,
  option_product_ids JSON NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_joker_combo_slots_combo (combo_product_id),
  CONSTRAINT fk_saas_joker_combo_slots_combo
    FOREIGN KEY (combo_product_id) REFERENCES saas_joker_products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
