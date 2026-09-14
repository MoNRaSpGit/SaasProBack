-- Imagenes de producto subidas por el administrador (15/09/2026), mismo
-- criterio ya probado en frontend-piloto: la imagen NO va en
-- saas_qq_products (columna aparte, binaria), se sirve por separado via
-- GET /qq/products/:id/image con cache fuerte (ETag). El frontend ya
-- redimensiona/comprime la imagen ANTES de mandarla (canvas, del lado del
-- cliente), asi que lo que llega aca ya es "prudente" -- esta tabla no
-- hace ningun procesamiento, solo guarda.
CREATE TABLE IF NOT EXISTS saas_qq_product_images (
  product_id BIGINT UNSIGNED NOT NULL,
  image_data LONGBLOB NOT NULL,
  mime_type VARCHAR(60) NOT NULL,
  source_hash VARCHAR(64) NOT NULL,
  byte_size INT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (product_id),
  KEY idx_saas_qq_product_images_hash (source_hash),
  CONSTRAINT fk_saas_qq_product_images_product
    FOREIGN KEY (product_id) REFERENCES saas_qq_products (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE saas_qq_products
  ADD COLUMN has_image TINYINT(1) NOT NULL DEFAULT 0 AFTER image_url;
