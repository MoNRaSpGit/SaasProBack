-- Clasifica cada insumo en comida/bebida/otro, para poder mostrar un
-- tablero de stock filtrado (por ahora solo comidas, bebidas se suma
-- despues). Todo lo existente arranca en "comida" y se corrige a mano con
-- el script de backfill para los insumos que en realidad son bebida.
ALTER TABLE saas_joker_stock_items
  ADD COLUMN category ENUM('comida', 'bebida', 'otro') NOT NULL DEFAULT 'comida' AFTER unit;
