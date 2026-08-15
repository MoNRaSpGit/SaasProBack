-- Cierre diario de caja para Oriol: a diferencia del resto del modulo (que
-- calcula todo en vivo desde saas_oriol_ventas, sin ninguna tabla de
-- cierre), esta tabla SI guarda un valor congelado por dia -- a proposito,
-- para que "Mes" y las graficas tengan una fuente de verdad estable que
-- se pueda corregir a mano (ej: el operario vendio algo fuera del
-- sistema y el cierre automatico quedo corto).
CREATE TABLE IF NOT EXISTS saas_oriol_cierres_diarios (
  id INT NOT NULL AUTO_INCREMENT,
  fecha DATE NOT NULL,
  total_pesos DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  total_dolares DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  editado_manualmente TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_oriol_cierres_diarios_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
