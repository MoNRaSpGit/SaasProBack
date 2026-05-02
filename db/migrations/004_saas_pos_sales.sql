-- SaasPro POS sales schema
-- Ticket header + items, isolated by tenant and fully independent from legacy systems.

CREATE TABLE IF NOT EXISTS saas_pos_sales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  external_id VARCHAR(120) NULL,
  notes VARCHAR(255) NULL,
  items_count INT UNSIGNED NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_pos_sales_tenant_external (tenant_id, external_id),
  KEY idx_saas_pos_sales_tenant_created (tenant_id, created_at),
  KEY idx_saas_pos_sales_tenant_status (tenant_id, status),
  CONSTRAINT fk_saas_pos_sales_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_pos_sales_branch
    FOREIGN KEY (branch_id) REFERENCES saas_branches(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_saas_pos_sales_user
    FOREIGN KEY (user_id) REFERENCES saasPro_users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_pos_sale_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  sale_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  is_manual TINYINT(1) NOT NULL DEFAULT 0,
  product_name VARCHAR(160) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  line_total DECIMAL(10, 2) NOT NULL,
  barcode VARCHAR(80) NULL,
  sku VARCHAR(80) NULL,
  image_url VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_pos_sale_items_sale (sale_id),
  KEY idx_saas_pos_sale_items_tenant_product (tenant_id, product_id),
  CONSTRAINT fk_saas_pos_sale_items_sale
    FOREIGN KEY (sale_id) REFERENCES saas_pos_sales(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_pos_sale_items_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_pos_sale_items_product
    FOREIGN KEY (product_id) REFERENCES saas_pos_products(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
