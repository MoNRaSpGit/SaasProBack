-- Repartidores fijos para la pestana "Delivery". Por ahora son 3 tarjetas
-- (Juan, Ana, Pablo) cargadas a mano, sin alta/baja desde la UI.
CREATE TABLE IF NOT EXISTS saas_joker_couriers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO saas_joker_couriers (name)
SELECT * FROM (SELECT 'Juan' AS name UNION ALL SELECT 'Ana' UNION ALL SELECT 'Pablo') AS seed
WHERE NOT EXISTS (SELECT 1 FROM saas_joker_couriers);
