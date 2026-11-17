-- Imagenes de QQ y Ropa a Cloudinary (17/11/2026, pedido explicito): en vez de
-- guardar el binario en la base, se sube a Cloudinary y solo se guarda el link.
-- Productos: usan la columna image_url que ya existia (has_image queda en 0).
-- Carrusel: image_data pasa a ser opcional y se agregan las columnas del link
-- (celular y PC) y del public_id (para poder borrarlas de Cloudinary).
ALTER TABLE saas_qq_carousel_images
  MODIFY COLUMN image_data LONGBLOB NULL,
  ADD COLUMN image_url VARCHAR(600) NULL,
  ADD COLUMN image_public_id VARCHAR(255) NULL,
  ADD COLUMN desktop_image_url VARCHAR(600) NULL,
  ADD COLUMN desktop_image_public_id VARCHAR(255) NULL;

ALTER TABLE saas_ropa_carousel_images
  MODIFY COLUMN image_data LONGBLOB NULL,
  ADD COLUMN image_url VARCHAR(600) NULL,
  ADD COLUMN image_public_id VARCHAR(255) NULL,
  ADD COLUMN desktop_image_url VARCHAR(600) NULL,
  ADD COLUMN desktop_image_public_id VARCHAR(255) NULL;

-- image_url de productos: las URLs de Cloudinary (con transformaciones) pueden
-- pasar de 500 caracteres.
ALTER TABLE saas_qq_products MODIFY COLUMN image_url VARCHAR(600) NULL;
ALTER TABLE saas_ropa_products MODIFY COLUMN image_url VARCHAR(600) NULL;
