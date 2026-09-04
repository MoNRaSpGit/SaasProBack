-- Quien fue la ultima persona (rol) que edito un pedido, y cuando. El
-- cliente pidio poder editar pedidos desde el Historial de ventas con
-- los dos roles (Administrador y Usuario), pero que quede registro de
-- quien lo toco -- antes de esto no habia forma de saberlo.
ALTER TABLE saas_joker_orders
  ADD COLUMN edited_by_role ENUM('administrador', 'usuario') NULL AFTER origin_role,
  ADD COLUMN edited_at DATETIME NULL AFTER edited_by_role;
