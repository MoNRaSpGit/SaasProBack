-- frontend-delivery: coordinacion de eventos entre un Administrador y sus
-- repartidores ("deliverys"). Sin cuentas ni contraseñas por ahora: el
-- login es por boton (elegis quien sos de una lista fija). Este arranque
-- es un simulacro -- el admin crea un evento (lugar + fecha/hora), a los
-- deliverys les aparece y cada uno se anota; el admin ve quien se anoto.

-- Roster fijo: el admin y los repartidores. Se puede ampliar despues.
CREATE TABLE IF NOT EXISTS saas_delivery_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  role ENUM('administrador', 'delivery') NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_delivery_users_role (role, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO saas_delivery_users (name, role, sort_order) VALUES
  ('Administrador', 'administrador', 0),
  ('Juan', 'delivery', 1),
  ('Ana', 'delivery', 2),
  ('Maria', 'delivery', 3);

-- Eventos que crea el Administrador. starts_at guarda fecha + hora juntas
-- (ej: 2026-09-18 20:00). place es el lugar ("Mama Mia"). status permite
-- cerrar las inscripciones o cancelar el evento sin borrarlo.
CREATE TABLE IF NOT EXISTS saas_delivery_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  place VARCHAR(200) NOT NULL,
  starts_at DATETIME NOT NULL,
  notes VARCHAR(500) NULL,
  slots INT NULL,
  status ENUM('abierto', 'cerrado', 'cancelado') NOT NULL DEFAULT 'abierto',
  created_by BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_delivery_events_starts_at (starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un delivery anotado a un evento. Unico por (evento, usuario): no se
-- puede anotar dos veces al mismo.
CREATE TABLE IF NOT EXISTS saas_delivery_signups (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  event_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_delivery_signups_event_user (event_id, user_id),
  KEY idx_saas_delivery_signups_event (event_id),
  CONSTRAINT fk_saas_delivery_signups_event FOREIGN KEY (event_id) REFERENCES saas_delivery_events (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
