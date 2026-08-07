ALTER TABLE saas_camisetas_products
  ADD COLUMN sale_price DECIMAL(10, 2) NULL AFTER price;

-- Ofertas de ejemplo (50% off) para dejar la pestaña "Ofertas" armada.
-- Contenido inventado, se puede cambiar despues desde /productos.
UPDATE saas_camisetas_products SET sale_price = price / 2 WHERE id IN ('boca', 'river', 'barcelona');
