CREATE TABLE IF NOT EXISTS saas_alamcen_products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  legacy_product_id BIGINT UNSIGNED NULL,
  name VARCHAR(180) NOT NULL,
  description VARCHAR(255) NULL,
  barcode VARCHAR(80) NOT NULL,
  barcode_normalized VARCHAR(80) NOT NULL,
  sale_price DECIMAL(12,2) NOT NULL,
  list_price DECIMAL(12,2) NULL,
  stock_current DECIMAL(12,2) NOT NULL DEFAULT 0,
  category VARCHAR(120) NULL,
  image_url LONGTEXT NULL,
  status ENUM('active', 'inactive', 'out_of_stock', 'archived') NOT NULL DEFAULT 'active',
  source ENUM('catalog', 'manual') NOT NULL DEFAULT 'catalog',
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_alamcen_products_barcode (tenant_id, barcode_normalized),
  KEY idx_saas_alamcen_products_tenant_name (tenant_id, name),
  KEY idx_saas_alamcen_products_deleted (deleted_at),
  CONSTRAINT fk_saas_alamcen_products_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_alamcen_sales (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  external_id VARCHAR(120) NULL,
  notes VARCHAR(255) NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  items_count INT UNSIGNED NOT NULL DEFAULT 0,
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_alamcen_sales_external (tenant_id, external_id),
  KEY idx_saas_alamcen_sales_tenant_created (tenant_id, created_at),
  CONSTRAINT fk_saas_alamcen_sales_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_alamcen_sales_user
    FOREIGN KEY (user_id) REFERENCES saasPro_users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_alamcen_sale_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  sale_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NULL,
  is_manual TINYINT(1) NOT NULL DEFAULT 0,
  product_name VARCHAR(180) NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  quantity DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(12,2) NOT NULL,
  image_url LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_alamcen_sale_items_sale (sale_id),
  KEY idx_saas_alamcen_sale_items_product (product_id),
  CONSTRAINT fk_saas_alamcen_sale_items_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_alamcen_sale_items_sale
    FOREIGN KEY (sale_id) REFERENCES saas_alamcen_sales (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_alamcen_sale_items_product
    FOREIGN KEY (product_id) REFERENCES saas_alamcen_products (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_alamcen_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NULL,
  external_id VARCHAR(120) NULL,
  amount DECIMAL(12,2) NOT NULL,
  description VARCHAR(255) NULL,
  status ENUM('confirmed', 'cancelled') NOT NULL DEFAULT 'confirmed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_alamcen_payments_external (tenant_id, external_id),
  KEY idx_saas_alamcen_payments_tenant_created (tenant_id, created_at),
  CONSTRAINT fk_saas_alamcen_payments_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_alamcen_payments_user
    FOREIGN KEY (user_id) REFERENCES saasPro_users (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_alamcen_dashboard_daily (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  business_date DATE NOT NULL,
  initial_cash DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_alamcen_dashboard_daily (tenant_id, business_date),
  KEY idx_saas_alamcen_dashboard_daily_tenant_date (tenant_id, business_date),
  CONSTRAINT fk_saas_alamcen_dashboard_daily_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
