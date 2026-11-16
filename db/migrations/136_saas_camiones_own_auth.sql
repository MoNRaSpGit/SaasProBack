-- Login propio de Camiones (17/11/2026): Camiones deja de usar el login
-- compartido (saasPro_users + saas_tenant_memberships), que tambien usa Agro.
-- Los datos (viajes, clientes, lugares) NO se mueven: siguen con su tenant_id.
-- Los usuarios se copian con el MISMO id que tenian, asi los viajes que ya
-- apuntan a ese id siguen funcionando, y con el MISMO hash de clave (entran con
-- la misma clave de siempre).
CREATE TABLE IF NOT EXISTS saas_camiones_users (
  id INT UNSIGNED NOT NULL PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  legacy_email VARCHAR(190) NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NULL,
  role VARCHAR(30) NOT NULL,
  tenant_id INT UNSIGNED NOT NULL,
  tenant_name VARCHAR(160) NOT NULL,
  tenant_slug VARCHAR(160) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_camiones_users_username (username),
  UNIQUE KEY uq_camiones_users_legacy_email (legacy_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_camiones_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  access_hash CHAR(64) NOT NULL,
  access_expires_at DATETIME NOT NULL,
  refresh_hash CHAR(64) NOT NULL,
  refresh_expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_camiones_sessions_access (access_hash),
  UNIQUE KEY uq_camiones_sessions_refresh (refresh_hash),
  KEY idx_camiones_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
