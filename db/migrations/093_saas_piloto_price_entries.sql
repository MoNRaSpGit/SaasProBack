-- "Precios" en frontend-piloto, Modo Pro (23/09/2026, pedido explicito):
-- lista organizada de precios por categoria (Congelados, Frutas y
-- verduras, Empanadas, Otros), independiente de los productos reales del
-- escaner (saas_piloto_products) -- no se convierten en productos, es
-- solo una lista de referencia.
CREATE TABLE IF NOT EXISTS saas_piloto_price_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category ENUM('congelados', 'frutas_verduras', 'empanadas', 'otros') NOT NULL,
  name VARCHAR(120) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_saas_piloto_price_entries_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
