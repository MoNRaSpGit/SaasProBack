-- Version PC de cada imagen del carrusel de QQ (16/11/2026), igual que en
-- Ropa: la imagen de siempre es la de celular; sin version PC, la PC usa la
-- de celular. Cambio aditivo: no toca lo ya cargado.
ALTER TABLE saas_qq_carousel_images
  ADD COLUMN desktop_image_data LONGBLOB NULL,
  ADD COLUMN desktop_mime_type VARCHAR(100) NULL,
  ADD COLUMN desktop_source_hash CHAR(64) NULL;
