ALTER TABLE saas_joker_products
  ADD COLUMN subcategory VARCHAR(80) NULL AFTER category,
  ADD COLUMN subcategory_detail VARCHAR(80) NULL AFTER subcategory,
  ADD COLUMN brand VARCHAR(80) NULL AFTER subcategory_detail,
  ADD COLUMN ingredients TEXT NULL AFTER price,
  ADD COLUMN observations TEXT NULL AFTER ingredients,
  ADD COLUMN product_type VARCHAR(20) NOT NULL DEFAULT 'simple' AFTER observations,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'published' AFTER product_type,
  ADD COLUMN pricing_unit VARCHAR(20) NOT NULL DEFAULT 'unidad' AFTER status;
