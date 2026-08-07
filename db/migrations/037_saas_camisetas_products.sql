CREATE TABLE IF NOT EXISTS saas_camisetas_products (
  id VARCHAR(40) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(500) NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'UYU',
  static_image_path VARCHAR(255) NULL,
  has_image TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_camisetas_product_images (
  product_id VARCHAR(40) NOT NULL,
  image_data LONGBLOB NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  source_hash VARCHAR(64) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  CONSTRAINT fk_saas_camisetas_product_images_product
    FOREIGN KEY (product_id) REFERENCES saas_camisetas_products (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Semilla: las 8 camisetas reales que ya estaban hardcodeadas en el servicio.
-- Las imagenes actuales siguen viniendo del bundle del frontend
-- (static_image_path, has_image = 0) hasta que el cliente suba una propia
-- desde el panel de Productos (ahi has_image pasa a 1 y se sirve el binario).
INSERT INTO saas_camisetas_products (id, name, description, price, currency, static_image_path, has_image) VALUES
  ('barcelona', 'Camiseta Barcelona', 'Camiseta titular del Barcelona, corte clasico y tela liviana transpirable.', 10, 'UYU', 'camisetas/barcelona.jpg', 0),
  ('boca', 'Camiseta Boca Juniors', 'Camiseta titular de Boca Juniors, azul y oro, para hinchas de La Bombonera.', 20, 'UYU', 'camisetas/boca.jpg', 0),
  ('botafogo', 'Camiseta Botafogo', 'Camiseta a rayas blancas y negras del Botafogo, estilo clasico brasileño.', 10, 'UYU', 'camisetas/botafogo.jpg', 0),
  ('milan', 'Camiseta Milan', 'Camiseta titular del Milan, rojo y negro, corte ajustado.', 20, 'UYU', 'camisetas/milan.jpg', 0),
  ('nacional', 'Camiseta Nacional', 'Camiseta tricolor de Nacional, un clasico del futbol uruguayo.', 10, 'UYU', 'camisetas/nacional.jpg', 0),
  ('penarol', 'Camiseta Peñarol', 'Camiseta a rayas amarillas y negras de Peñarol, la garra charrua.', 20, 'UYU', 'camisetas/penarol.jpg', 0),
  ('river', 'Camiseta River Plate', 'Camiseta titular de River Plate, banda roja sobre blanco.', 10, 'UYU', 'camisetas/river.jpg', 0),
  ('real-madrid', 'Camiseta Real Madrid', 'Camiseta titular del Real Madrid, blanca con detalles dorados.', 20, 'UYU', 'camisetas/real-madrid.jpg', 0)
ON DUPLICATE KEY UPDATE name = VALUES(name);
