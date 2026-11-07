-- Gaby Almacen (07/11/2026): marca los productos a los que SI se les cargo
-- un stock a mano (aunque sea 0). Todos arrancan sin marcar: el stock bajo
-- futuro solo mira los marcados, asi el catalogo copiado de Piloto (que
-- nunca uso stock) no ensucia la lista.
ALTER TABLE saas_gaby_products
  ADD COLUMN stock_tracked TINYINT(1) NOT NULL DEFAULT 0 AFTER stock;
