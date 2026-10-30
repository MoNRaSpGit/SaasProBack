-- Venta del "fondo" de Piloto (30/10/2026, pedido explicito): una tablet
-- en el fondo del local con su propio lector va pasando productos, y el
-- mostrador los ve y los "toma" a su caja cuando quiere (o cuando la
-- tablet aprieta "Enviar"). Una sola fila (id = 1): es la venta en curso
-- del fondo, no un historial -- al tomarla se vacia.
CREATE TABLE IF NOT EXISTS saas_piloto_fondo_cart (
  id INT NOT NULL PRIMARY KEY,
  items JSON NOT NULL,
  sent_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
