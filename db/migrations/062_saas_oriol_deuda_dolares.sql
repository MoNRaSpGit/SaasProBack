-- Separa la deuda de cada cliente en dos saldos reales (pesos y dolares),
-- sin conversion entre ellos -- reemplaza el criterio anterior de convertir
-- la porcion en dolares de una venta a un equivalente en pesos (TASA_DOLAR)
-- para sumarla a un unico campo `deuda`. La deuda vieja acumulada antes de
-- este cambio queda como esta (legacy, mezclada) -- no se reconstruye
-- retroactivamente, solo se trackea limpio de aca en adelante.

ALTER TABLE saas_oriol_clientes
  ADD COLUMN deuda_dolares DECIMAL(10,2) NOT NULL DEFAULT '0.00' AFTER deuda;

ALTER TABLE saas_oriol_ventas
  CHANGE COLUMN monto_pagado monto_pagado_pesos DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  ADD COLUMN monto_pagado_dolares DECIMAL(10,2) NOT NULL DEFAULT '0.00' AFTER monto_pagado_pesos;

ALTER TABLE saas_oriol_pagos_credito
  ADD COLUMN moneda ENUM('UYU', 'USD') NOT NULL DEFAULT 'UYU' AFTER cliente_id;
