-- Metodos de pago: se agrega el propietario de la cuenta (20/09/2026,
-- pedido explicito: "propietario seria el nombre de la persona") -- ahora
-- el formulario pide banco, propietario y numero de cuenta.
ALTER TABLE saas_joker_payment_methods
  ADD COLUMN owner_name VARCHAR(120) NOT NULL DEFAULT '' AFTER label;
