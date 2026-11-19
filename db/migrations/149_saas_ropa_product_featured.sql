-- Producto destacado en Ropa (18/11/2026): el admin tilda "Destacado" y la
-- tarjeta muestra una etiqueta "Producto destacado".
ALTER TABLE saas_ropa_products ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0;
