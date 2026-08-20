-- Tabla de equipos de juez (nombre + division + sexo). La tabla se crea
-- sola desde JuezTeamsService.createTables() (CREATE TABLE IF NOT EXISTS),
-- pero se deja esta migracion para que quede registrada junto al resto.

CREATE TABLE IF NOT EXISTS saas_juez_teams (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  division ENUM('A', 'B') NOT NULL,
  sex ENUM('masculino', 'femenino') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_saas_juez_teams_name_division_sex (name, division, sex)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
