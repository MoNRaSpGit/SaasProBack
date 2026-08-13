-- Suma un motivo mas al archivo de cuenta corriente para correcciones
-- manuales de movimientos que quedaron desincronizados de su pedido (bug
-- de fechas/ediciones previo al arreglo de order_id), sin mezclarlos con
-- pagos reales del cliente ni con bajas de cliente.
ALTER TABLE saas_joker_account_settlements
  MODIFY COLUMN reason ENUM('pago', 'cliente_eliminado', 'correccion_manual') NOT NULL;
