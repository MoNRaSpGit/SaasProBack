-- Partidos, disponibilidad de jueces y designaciones de juez, con
-- persistencia real (antes vivian solo en memoria del navegador).
-- Las tablas se crean solas desde JuezMatchesService.createTables()
-- (CREATE TABLE IF NOT EXISTS), esta migracion queda como registro.

CREATE TABLE IF NOT EXISTS saas_juez_matches (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tournament VARCHAR(150) NOT NULL,
  home_side VARCHAR(120) NOT NULL,
  away_side VARCHAR(120) NOT NULL,
  venue VARCHAR(150) NOT NULL,
  match_date DATE NOT NULL,
  match_time VARCHAR(5) NOT NULL,
  status ENUM('open', 'closed', 'assigned') NOT NULL DEFAULT 'open',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_saas_juez_matches_date (match_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_juez_availability (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  match_id BIGINT UNSIGNED NOT NULL,
  referee_id VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_saas_juez_availability_match_referee (match_id, referee_id),
  KEY idx_saas_juez_availability_match (match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_juez_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  match_id BIGINT UNSIGNED NOT NULL,
  principal_referee_id VARCHAR(64) NOT NULL,
  secondary_referee_id VARCHAR(64) NOT NULL,
  scorer_referee_id VARCHAR(64) NOT NULL,
  confirmed_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_saas_juez_assignments_match (match_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
