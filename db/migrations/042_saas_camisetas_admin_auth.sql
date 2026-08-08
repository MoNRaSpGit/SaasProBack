-- Login simple para el admin de Piel de Hincha. A pedido del cliente,
-- la contrasena queda en texto plano por ahora (modo de prueba) -- se
-- hashea mas adelante cuando el flujo este mas asentado.
CREATE TABLE IF NOT EXISTS saas_camisetas_admin_users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  password VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saas_camisetas_admin_sessions (
  token VARCHAR(64) NOT NULL PRIMARY KEY,
  admin_user_id INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_camisetas_admin_session_user
    FOREIGN KEY (admin_user_id) REFERENCES saas_camisetas_admin_users(id)
    ON DELETE CASCADE
);

INSERT INTO saas_camisetas_admin_users (username, password) VALUES ('piel', 'admin54321');
