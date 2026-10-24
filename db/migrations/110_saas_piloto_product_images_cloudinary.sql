-- Imagenes de Piloto a Cloudinary (24/10/2026, pedido explicito): de aca
-- en mas, las imagenes nuevas van a la nube en vez de guardarse en
-- binario en esta tabla. image_data pasa a ser opcional (las filas
-- viejas lo siguen teniendo hasta que se migren).
ALTER TABLE saas_piloto_product_images
  MODIFY COLUMN image_data LONGBLOB NULL,
  ADD COLUMN cloudinary_url VARCHAR(500) NULL AFTER mime_type,
  ADD COLUMN cloudinary_public_id VARCHAR(255) NULL AFTER cloudinary_url;
