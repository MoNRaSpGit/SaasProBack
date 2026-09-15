-- Imagenes de fondo del carrusel de frontend-qq -- el admin las carga
-- desde una pestaña propia ("Carrusel") y el sitio va rotando entre
-- ellas como fondo de pagina, ademas de la foto original fija en
-- public/ (esa no vive aca, sigue siendo un archivo estatico). Mismo
-- patron de imagen binaria que saas_qq_product_images.
CREATE TABLE IF NOT EXISTS saas_qq_carousel_images (
  id INT AUTO_INCREMENT PRIMARY KEY,
  image_data LONGBLOB NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  source_hash CHAR(64) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
