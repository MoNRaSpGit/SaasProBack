-- SaasPro POS products schema
-- New POS tables live under the `saas_` prefix and do not modify legacy structures.

CREATE TABLE IF NOT EXISTS saas_pos_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  sku VARCHAR(80) NULL,
  barcode VARCHAR(80) NULL,
  sale_price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2) NULL,
  image_url VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_pos_products_tenant_sku (tenant_id, sku),
  UNIQUE KEY uq_saas_pos_products_tenant_barcode (tenant_id, barcode),
  KEY idx_saas_pos_products_tenant_active (tenant_id, is_active),
  KEY idx_saas_pos_products_tenant_name (tenant_id, name),
  CONSTRAINT fk_saas_pos_products_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_pos_products_branch
    FOREIGN KEY (branch_id) REFERENCES saas_branches(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
