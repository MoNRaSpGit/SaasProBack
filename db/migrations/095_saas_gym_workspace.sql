CREATE TABLE IF NOT EXISTS saas_gym_workspaces (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  workspace_key VARCHAR(40) NOT NULL DEFAULT 'public',
  workspace_json JSON NOT NULL,
  row_version INT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_gym_workspace_key (workspace_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO saas_gym_workspaces (workspace_key, workspace_json, row_version)
VALUES ('public', JSON_OBJECT('expenses', JSON_ARRAY(), 'tasks', JSON_ARRAY(), 'movements', JSON_ARRAY(), 'auditLog', JSON_ARRAY()), 1);
