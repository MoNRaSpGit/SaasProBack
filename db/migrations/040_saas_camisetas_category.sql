ALTER TABLE saas_camisetas_products
  ADD COLUMN category VARCHAR(60) NULL AFTER currency;

-- Categorias oficiales del cliente. Por ahora asignamos 1 producto por
-- categoria con lo que ya tenemos cargado (todavia no llego el catalogo
-- real), solo para poder probar el filtro.
UPDATE saas_camisetas_products SET category = 'Uruguayos' WHERE id = 'nacional';
UPDATE saas_camisetas_products SET category = 'Selección' WHERE id = 'penarol';
UPDATE saas_camisetas_products SET category = 'Sudamérica' WHERE id = 'boca';
UPDATE saas_camisetas_products SET category = 'Europa' WHERE id = 'barcelona';
UPDATE saas_camisetas_products SET category = 'Shorts' WHERE id = 'botafogo';
UPDATE saas_camisetas_products SET category = 'Conjuntos largo' WHERE id = 'milan';
UPDATE saas_camisetas_products SET category = 'Conjuntos corto' WHERE id = 'real-madrid';
UPDATE saas_camisetas_products SET category = 'Camperas rompevientos' WHERE id = 'river';
UPDATE saas_camisetas_products SET category = 'Otros' WHERE id = 'zzz-producto-prueba';
