-- Login real para frontend-distribuidora (02/11/2026, pedido explicito):
-- antes no habia usuarios, el vendedor de la calle y la oficina usaban
-- los mismos endpoints sin loguearse. Mismo esquema que saas_gym_users /
-- saas_gym_sessions (sesion por token opaco, no JWT).
CREATE TABLE IF NOT EXISTS saas_distribuidora_users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NULL,
  role ENUM('admin', 'vendedor') NOT NULL DEFAULT 'vendedor',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_distribuidora_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_distribuidora_sessions (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_distribuidora_sessions_token (token),
  KEY idx_distribuidora_sessions_user (user_id),
  CONSTRAINT fk_distribuidora_sessions_user FOREIGN KEY (user_id) REFERENCES saas_distribuidora_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
