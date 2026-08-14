ALTER TABLE saas_joker_couriers
  ADD COLUMN status ENUM('inactivo', 'activo') NOT NULL DEFAULT 'inactivo',
  ADD COLUMN active_since DATETIME NULL;
