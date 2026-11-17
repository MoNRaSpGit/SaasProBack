-- Peluqueria multi-local (17/11/2026): cada peluqueria tiene sus peluqueros, su
-- horario, su usuario dueño y sus clientes. Las reservas pasan a colgar de una
-- peluqueria. Aditivo: las reservas que ya existen se asignan a la peluqueria
-- "demo" desde scripts/apply-144-peluqueria-salons-migration.js.
CREATE TABLE IF NOT EXISTS saas_peluqueria_salons (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(60) NOT NULL,
  name VARCHAR(120) NOT NULL,
  logo_url VARCHAR(500) NULL,
  -- Horario semanal editable: {"slotMinutes":60,"days":{"1":[["09:00","19:00"]],...}}
  -- (0 = domingo). Cada dia admite varios tramos (turno cortado).
  schedule_json TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_peluqueria_salon_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS saas_peluqueria_barbers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  salon_id INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  position INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uq_peluqueria_barber_name (salon_id, name),
  KEY idx_peluqueria_barber_salon (salon_id, position),
  CONSTRAINT fk_peluqueria_barber_salon FOREIGN KEY (salon_id) REFERENCES saas_peluqueria_salons (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Un usuario dueño por peluqueria (por ahora). Login propio, separado del resto.
CREATE TABLE IF NOT EXISTS saas_peluqueria_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  salon_id INT UNSIGNED NOT NULL,
  username VARCHAR(60) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_peluqueria_user_username (username),
  KEY idx_peluqueria_user_salon (salon_id),
  CONSTRAINT fk_peluqueria_user_salon FOREIGN KEY (salon_id) REFERENCES saas_peluqueria_salons (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- El token viaja en claro solo hasta el celular; en la base se guarda su sha256.
CREATE TABLE IF NOT EXISTS saas_peluqueria_sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_peluqueria_session_token (token_hash),
  KEY idx_peluqueria_session_user (user_id),
  CONSTRAINT fk_peluqueria_session_user FOREIGN KEY (user_id) REFERENCES saas_peluqueria_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Ficha de cliente por peluqueria, identificada por el celular (solo digitos).
CREATE TABLE IF NOT EXISTS saas_peluqueria_clients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  salon_id INT UNSIGNED NOT NULL,
  phone_norm VARCHAR(20) NOT NULL,
  name VARCHAR(120) NOT NULL,
  visits INT UNSIGNED NOT NULL DEFAULT 0,
  last_visit_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_peluqueria_client_phone (salon_id, phone_norm),
  CONSTRAINT fk_peluqueria_client_salon FOREIGN KEY (salon_id) REFERENCES saas_peluqueria_salons (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
