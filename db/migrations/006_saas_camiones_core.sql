-- SaasPro Camiones core schema
-- First persistent backend step for the `camiones` model.
-- Keeps the schema tenant-aware from day one and aligned with the current UX prototype.

CREATE TABLE IF NOT EXISTS saas_camiones_clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  name VARCHAR(160) NOT NULL,
  phone VARCHAR(40) NULL,
  notes VARCHAR(255) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_camiones_clients_tenant_active (tenant_id, is_active),
  KEY idx_saas_camiones_clients_tenant_name (tenant_id, name),
  KEY idx_saas_camiones_clients_branch (branch_id),
  CONSTRAINT fk_saas_camiones_clients_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_camiones_clients_branch
    FOREIGN KEY (branch_id) REFERENCES saas_branches(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_camiones_trips (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  branch_id BIGINT UNSIGNED NULL,
  client_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  trip_date DATE NOT NULL,
  place VARCHAR(160) NOT NULL,
  kilometers DECIMAL(10, 2) NOT NULL,
  status ENUM('pending', 'paid', 'cancelled') NOT NULL DEFAULT 'pending',
  notes VARCHAR(255) NULL,
  paid_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_camiones_trips_tenant_date (tenant_id, trip_date),
  KEY idx_saas_camiones_trips_tenant_status (tenant_id, status),
  KEY idx_saas_camiones_trips_tenant_client (tenant_id, client_id),
  KEY idx_saas_camiones_trips_branch (branch_id),
  KEY idx_saas_camiones_trips_user (user_id),
  CONSTRAINT fk_saas_camiones_trips_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_camiones_trips_branch
    FOREIGN KEY (branch_id) REFERENCES saas_branches(id)
    ON DELETE SET NULL,
  CONSTRAINT fk_saas_camiones_trips_client
    FOREIGN KEY (client_id) REFERENCES saas_camiones_clients(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_saas_camiones_trips_user
    FOREIGN KEY (user_id) REFERENCES saasPro_users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
