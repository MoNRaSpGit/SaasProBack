-- Planilla de voley (26/10/2026): cuadros y jugadores COPIADOS de juez
-- (pedido explicito: "copia esos datos y hace una base para planilla").
-- Solo nombre/division/sexo y nombre/apellido: nada de cedula, telefono ni
-- foto. juez_*_id es para poder volver a copiar sin duplicar
-- (scripts/copy-juez-to-planilla.js usa INSERT IGNORE).
CREATE TABLE IF NOT EXISTS saas_planilla_teams (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  juez_team_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  division ENUM('A', 'B') NOT NULL,
  sex ENUM('masculino', 'femenino') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_saas_planilla_teams_juez (juez_team_id),
  UNIQUE KEY uniq_saas_planilla_teams_name (name, division, sex)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS saas_planilla_players (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  team_id INT NOT NULL,
  juez_player_id BIGINT UNSIGNED NULL,
  first_name VARCHAR(120) NOT NULL,
  last_name VARCHAR(120) NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_saas_planilla_players_juez (juez_player_id),
  KEY idx_saas_planilla_players_team (team_id),
  CONSTRAINT fk_saas_planilla_players_team FOREIGN KEY (team_id) REFERENCES saas_planilla_teams (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
