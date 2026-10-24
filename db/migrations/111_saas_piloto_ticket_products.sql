-- Tickets de Piloto (24/10/2026): productos con codigo de barras
-- inventado (ej. empanadas sueltas) que se imprimen en la tiquetera. Cada
-- ticket ES un producto normal de saas_piloto_products (asi el lector lo
-- encuentra igual que cualquier otro); esta tabla solo marca cuales son
-- tickets para listarlos en la pestaña "Tickets" del Modo Pro.
CREATE TABLE IF NOT EXISTS saas_piloto_ticket_products (
  product_id INT NOT NULL PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
