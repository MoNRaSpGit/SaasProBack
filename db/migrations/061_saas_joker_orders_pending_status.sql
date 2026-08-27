-- Pedidos pendientes (mostrador): el Usuario carga un pedido que queda en
-- espera hasta que el Administrador lo acepte o lo rechace. Mientras esta
-- pendiente NO tiene display_number (el numero de cocina se asigna recien
-- al aceptar, para no romper el orden real de llegada a cocina frente a
-- los pedidos que el admin sigue cargando por WhatsApp mientras tanto).
-- El DEFAULT 'confirmado' ya deja los pedidos existentes en el estado
-- correcto (no habia estado pendiente antes de esto).
ALTER TABLE saas_joker_orders
  MODIFY COLUMN display_number INT UNSIGNED NULL DEFAULT NULL,
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'confirmado' AFTER display_number,
  ADD INDEX idx_saas_joker_orders_status (status);
