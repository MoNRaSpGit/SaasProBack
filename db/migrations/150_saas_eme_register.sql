-- Caja de EME (19/11/2026): cada "turno" de caja con su caja inicial y sus
-- gastos. Se cierra a mano ("Cierre de caja") o sola a las 3 de la mañana
-- (hora Montevideo). Al cerrar se abre otro turno vacio.
CREATE TABLE IF NOT EXISTS saas_eme_register_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  opened_at DATETIME NOT NULL,
  opening_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  closed_at DATETIME NULL,
  closed_by ENUM('manual','auto') NULL,
  KEY idx_eme_register_open (closed_at, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_eme_register_expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL,
  description VARCHAR(120) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  created_at DATETIME NOT NULL,
  KEY idx_eme_register_expense_session (session_id),
  CONSTRAINT fk_eme_register_expense_session FOREIGN KEY (session_id) REFERENCES saas_eme_register_sessions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
