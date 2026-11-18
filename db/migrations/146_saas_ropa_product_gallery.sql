-- Galeria de fotos extra por producto de Ropa (17/11/2026): ademas de la foto
-- principal, un producto puede tener hasta 5 fotos mas (otros angulos) que se
-- pasan dentro del detalle del producto. Se guardan en Cloudinary: aca solo el
-- link y el public_id (para poder borrarlas).
CREATE TABLE IF NOT EXISTS saas_ropa_product_gallery (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  image_url VARCHAR(600) NOT NULL,
  public_id VARCHAR(255) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ropa_gallery_product (product_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
