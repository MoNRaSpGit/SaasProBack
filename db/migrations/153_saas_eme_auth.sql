-- Login de EME (20/11/2026): dos usuarios fijos (admin = nosotros, nueva =
-- la clienta). Sesiones por token opaco; en la base se guarda solo el hash.
CREATE TABLE IF NOT EXISTS saas_eme_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(40) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin','cliente') NOT NULL DEFAULT 'cliente',
  display_name VARCHAR(80) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_eme_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_eme_sessions_user (user_id),
  CONSTRAINT fk_eme_sessions_user FOREIGN KEY (user_id) REFERENCES saas_eme_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
