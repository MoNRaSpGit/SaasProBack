-- Metodos de pago de frontend-joker (20/09/2026): listado corto (banco/
-- billetera + numero de cuenta) para responder rapido por WhatsApp cuando
-- un cliente pregunta "a que cuenta te hago la transferencia". sort_order
-- respeta el orden en que el administrador los va agregando (se reordena
-- a mano, no alfabetico).
CREATE TABLE IF NOT EXISTS saas_joker_payment_methods (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(80) NOT NULL,
  account_info VARCHAR(160) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
