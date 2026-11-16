-- Login propio de Agro (17/11/2026): Agro deja de usar el login compartido con
-- Camiones. Los datos del campo NO se mueven (siguen por tenant_id). El usuario
-- se copia con el MISMO id y el MISMO hash de clave.
-- Regla: UNA sola sesion activa por usuario. Al entrar, las sesiones anteriores
-- de ese usuario quedan revocadas con motivo 'replaced' (el dispositivo viejo
-- recibe "se abrio tu cuenta en otro dispositivo").
CREATE TABLE IF NOT EXISTS saas_agro_users (
  id INT UNSIGNED NOT NULL PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(160) NULL,
  role VARCHAR(30) NOT NULL,
  tenant_id INT UNSIGNED NOT NULL,
  tenant_name VARCHAR(160) NOT NULL,
  tenant_slug VARCHAR(160) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_agro_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_agro_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  access_hash CHAR(64) NOT NULL,
  access_expires_at DATETIME NOT NULL,
  refresh_hash CHAR(64) NOT NULL,
  refresh_expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  revoked_reason VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_agro_sessions_access (access_hash),
  UNIQUE KEY uq_agro_sessions_refresh (refresh_hash),
  KEY idx_agro_sessions_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
