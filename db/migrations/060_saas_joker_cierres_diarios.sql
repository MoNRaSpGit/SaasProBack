-- Cierre diario de caja para Joker (tab "Mes"): a diferencia del resto del
-- modulo (que calcula todo en vivo desde saas_joker_orders, sin ninguna
-- tabla de cierre), esta tabla SI guarda un valor congelado por dia
-- comercial -- a proposito, para que "Mes" y la grafica tengan una fuente
-- de verdad estable que se pueda corregir a mano (ej: se cargo un pedido
-- fuera del sistema y el cierre automatico quedo corto). El "dia" aca es
-- el dia comercial de Joker (arranca/cierra a las 5am, ver
-- STORE_DAY_START_HOUR en joker.service.ts), no el dia calendario.
CREATE TABLE IF NOT EXISTS saas_joker_cierres_diarios (
  id INT NOT NULL AUTO_INCREMENT,
  fecha DATE NOT NULL,
  total DECIMAL(10,2) NOT NULL DEFAULT '0.00',
  editado_manualmente TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_saas_joker_cierres_diarios_fecha (fecha)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
