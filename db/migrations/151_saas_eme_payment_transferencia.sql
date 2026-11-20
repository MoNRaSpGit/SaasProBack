-- Formas de pago de EME (20/11/2026): Efectivo, POS (valor 'tarjeta', solo
-- cambia el nombre en pantalla) y Transferencia (nuevo).
ALTER TABLE saas_eme_orders MODIFY payment ENUM('efectivo','tarjeta','cuenta','transferencia') NOT NULL DEFAULT 'efectivo';
