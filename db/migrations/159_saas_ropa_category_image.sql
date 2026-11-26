-- Ropa: foto de portada de cada categoria (link de Cloudinary), la elige la administradora.
ALTER TABLE saas_ropa_categories ADD COLUMN image_url VARCHAR(500) NULL;
