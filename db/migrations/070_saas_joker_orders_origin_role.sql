-- De donde nacio el pedido (quien lo cargo), separado del courier/entrega.
-- Necesario para poder separar la caja del Usuario de la del Administrador:
-- un pedido pendiente armado por el Usuario y despues aceptado por el
-- Administrador tiene que seguir contando para la caja del Usuario, no la
-- del Administrador -- status pasa de 'pendiente' a 'confirmado' al
-- aceptarlo, pero esta columna no se toca nunca despues de creado el
-- pedido, asi que sobrevive a esa transicion.
-- Los pedidos existentes quedan en 'administrador' por default: no hay
-- forma de reconstruir retroactivamente cuales fueron hechos por el
-- Usuario (nunca se trackeo hasta ahora), y no importa porque la caja del
-- Usuario es un concepto nuevo que arranca de cero desde este momento.
ALTER TABLE saas_joker_orders
  ADD COLUMN origin_role ENUM('administrador', 'usuario') NOT NULL DEFAULT 'administrador' AFTER status;
