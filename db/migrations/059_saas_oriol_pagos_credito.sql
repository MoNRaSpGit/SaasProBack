-- Permite pagar (total o parcialmente) una boleta de credito puntual, no
-- solo la deuda agregada del cliente. monto_pagado acumula lo pagado de esa
-- venta; saas_oriol_pagos_credito guarda un historial inmutable de cada
-- pago (nunca se borra), para poder reconstruir "quien debia cuanto y
-- cuando se pago" incluso si la venta ya quedo saldada.

ALTER TABLE saas_oriol_ventas
  ADD COLUMN monto_pagado DECIMAL(10,2) NOT NULL DEFAULT '0.00' AFTER total_dolares;

CREATE TABLE IF NOT EXISTS saas_oriol_pagos_credito (
  id INT NOT NULL AUTO_INCREMENT,
  venta_id INT NOT NULL,
  cliente_id INT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  tipo ENUM('completo', 'parcial') NOT NULL,
  saldo_anterior DECIMAL(10,2) NOT NULL,
  saldo_nuevo DECIMAL(10,2) NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY venta_id (venta_id),
  KEY cliente_id (cliente_id),
  CONSTRAINT saas_oriol_pagos_credito_ibfk_1 FOREIGN KEY (venta_id) REFERENCES saas_oriol_ventas (id),
  CONSTRAINT saas_oriol_pagos_credito_ibfk_2 FOREIGN KEY (cliente_id) REFERENCES saas_oriol_clientes (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
