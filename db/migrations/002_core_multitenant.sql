-- SaasPro core multi-tenant schema
-- Legacy tables already present in the database are left untouched.
-- All new SaaS tables must use the `saas_` prefix.

CREATE TABLE IF NOT EXISTS saas_tenants (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  status ENUM('active', 'suspended', 'archived') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_tenants_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_tenant_memberships (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role ENUM('admin', 'operario', 'staff') NOT NULL DEFAULT 'admin',
  status ENUM('active', 'invited', 'suspended') NOT NULL DEFAULT 'active',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_tenant_memberships_tenant_user (tenant_id, user_id),
  KEY idx_saas_tenant_memberships_user_id (user_id),
  KEY idx_saas_tenant_memberships_tenant_role (tenant_id, role),
  CONSTRAINT fk_saas_tenant_memberships_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_saas_tenant_memberships_user
    FOREIGN KEY (user_id) REFERENCES saasPro_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_tenant_modules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  module_key VARCHAR(60) NOT NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_tenant_modules_tenant_module (tenant_id, module_key),
  KEY idx_saas_tenant_modules_module_key (module_key),
  CONSTRAINT fk_saas_tenant_modules_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_branches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(60) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_branches_tenant_code (tenant_id, code),
  KEY idx_saas_branches_tenant_active (tenant_id, is_active),
  CONSTRAINT fk_saas_branches_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_tenant_settings (
  tenant_id BIGINT UNSIGNED NOT NULL,
  timezone VARCHAR(80) NOT NULL DEFAULT 'America/Montevideo',
  currency VARCHAR(12) NOT NULL DEFAULT 'UYU',
  brand_name VARCHAR(120) NULL,
  logo_url VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id),
  CONSTRAINT fk_saas_tenant_settings_tenant
    FOREIGN KEY (tenant_id) REFERENCES saas_tenants(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
