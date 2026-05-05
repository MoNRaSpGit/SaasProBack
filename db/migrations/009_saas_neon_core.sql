CREATE TABLE IF NOT EXISTS saas_neon_clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NULL,
  notes VARCHAR(255) NULL,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_neon_clients_tenant (tenant_id),
  KEY idx_saas_neon_clients_deleted (deleted_at),
  CONSTRAINT fk_saas_neon_clients_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_neon_activities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  activity_number INT UNSIGNED NOT NULL,
  activity_year INT UNSIGNED NOT NULL,
  activity_date DATE NOT NULL,
  description VARCHAR(255) NOT NULL,
  client_id BIGINT UNSIGNED NULL,
  activity_type ENUM('neon', 'movil_audiovisual', 'otros') NOT NULL,
  commercial_status ENUM('pendiente_de_facturar', 'facturado', 'pendiente_de_cobrar', 'cobrado') NOT NULL DEFAULT 'pendiente_de_facturar',
  quoted_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_neon_activities_year_number (tenant_id, activity_year, activity_number),
  KEY idx_saas_neon_activities_tenant_date (tenant_id, activity_date),
  KEY idx_saas_neon_activities_client (client_id),
  KEY idx_saas_neon_activities_deleted (deleted_at),
  CONSTRAINT fk_saas_neon_activities_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_neon_activities_client
    FOREIGN KEY (client_id) REFERENCES saas_neon_clients (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
