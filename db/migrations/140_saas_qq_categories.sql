-- Categorias y subcategorias de la tienda de qq, editables por el
-- administrador (16/11/2026). Antes vivian fijas en el codigo del frontend.
-- El producto sigue guardando el MISMO texto "categoria:subcategoria" (o solo
-- "categoria"), asi que los productos que ya existen no cambian: la clave
-- (slug) de cada categoria NUNCA se modifica, solo su nombre visible.
CREATE TABLE IF NOT EXISTS saas_qq_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  parent_id INT UNSIGNED NULL,
  slug VARCHAR(80) NOT NULL,
  label VARCHAR(120) NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_qq_categories_parent_slug (parent_id, slug),
  KEY idx_qq_categories_parent (parent_id, position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
