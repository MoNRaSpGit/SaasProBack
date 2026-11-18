-- Galeria de fotos extra por producto de QQ (17/11/2026): ademas de la foto
-- principal, un producto puede tener hasta 5 fotos mas que se pasan dentro del
-- detalle. Van a Cloudinary: aca solo el link y el public_id (para borrarlas).
CREATE TABLE IF NOT EXISTS saas_qq_product_gallery (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id BIGINT UNSIGNED NOT NULL,
  image_url VARCHAR(600) NOT NULL,
  public_id VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_qq_gallery_product (product_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
