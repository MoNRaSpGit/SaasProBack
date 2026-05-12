ALTER TABLE saas_camiones_trips
  ADD COLUMN collected_amount DECIMAL(10, 2) NULL AFTER status;

ALTER TABLE saas_camiones_trips
  MODIFY COLUMN status ENUM('confirmed', 'pending', 'paid', 'cancelled') NOT NULL DEFAULT 'confirmed';

UPDATE saas_camiones_trips
SET status = 'confirmed'
WHERE status = 'pending';
