-- Sesiones de admin para carnet: el boton "Admin" del login pedia un PIN
-- fijo comparado contra CARNET_ADMIN_PIN (env var), y las escrituras de la
-- API quedan protegidas detras del token de sesion (ver CarnetAdminGuard).

CREATE TABLE IF NOT EXISTS saas_carnet_admin_sessions (
  id INT NOT NULL AUTO_INCREMENT,
  token VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_carnet_admin_sessions_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
