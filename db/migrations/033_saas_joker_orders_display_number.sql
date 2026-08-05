ALTER TABLE saas_joker_orders
  ADD COLUMN display_number INT UNSIGNED NOT NULL DEFAULT 0 AFTER id;
