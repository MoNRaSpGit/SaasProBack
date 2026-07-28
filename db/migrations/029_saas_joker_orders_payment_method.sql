ALTER TABLE saas_joker_orders
  ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'efectivo' AFTER address;
