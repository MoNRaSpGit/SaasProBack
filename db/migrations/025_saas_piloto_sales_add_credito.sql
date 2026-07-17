ALTER TABLE saas_piloto_sales
  MODIFY COLUMN payment_method ENUM('efectivo', 'tarjeta', 'credito') NOT NULL DEFAULT 'efectivo';
