-- Turnos del gym (reservas de alumnos por link publico), solo para Ale.
-- Aditiva: tablas nuevas, no toca nada existente.
CREATE TABLE IF NOT EXISTS saas_gym_booking_links (
  workspace_key VARCHAR(40) NOT NULL PRIMARY KEY,
  public_token CHAR(32) NOT NULL,
  config_json LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gym_booking_links_token (public_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_gym_bookings (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_key VARCHAR(40) NOT NULL,
  class_key VARCHAR(40) NOT NULL,
  slot_hour CHAR(5) NOT NULL,
  booking_date DATE NOT NULL,
  student_name VARCHAR(80) NOT NULL,
  cancel_code CHAR(16) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_gym_bookings_day (workspace_key, booking_date, class_key, slot_hour)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
