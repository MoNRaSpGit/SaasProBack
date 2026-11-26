-- Santi: precios que se editan en Configuracion (una sola fila, id = 1).
CREATE TABLE IF NOT EXISTS saas_santi_settings (
  id TINYINT PRIMARY KEY,
  price_day INT NOT NULL,
  price_week INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
