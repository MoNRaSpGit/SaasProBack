ALTER TABLE saas_neon_movement_allocations
  MODIFY COLUMN destination_type ENUM('activity', 'personal', 'vehicle', 'rental', 'other') NOT NULL;
