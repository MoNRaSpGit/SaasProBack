-- Permite pagos "de deuda general" (no atados a una boleta puntual), para
-- la deuda vieja acumulada antes de que existiera el pago por boleta --
-- ver OriolService.pagarDeudaCliente. venta_id queda NULL en ese caso.

ALTER TABLE saas_oriol_pagos_credito
  MODIFY COLUMN venta_id INT NULL;
