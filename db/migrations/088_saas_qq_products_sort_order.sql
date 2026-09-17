-- Orden manual de las tarjetas del catalogo (16/09/2026): "vamos a
-- ponerle un numero, el cual va a ser su numero de donde esta ubicada...
-- si la cambio al puesto numero 1, la 1 pasaria al puesto de la que
-- cambie" -- un numero de posicion por producto (1, 2, 3...), que el
-- catalogo publico respeta al listar. El swap de posiciones se resuelve
-- en el backend (qq-products.service.ts), no aca.
ALTER TABLE saas_qq_products
  ADD COLUMN sort_order INT NOT NULL DEFAULT 0 AFTER status;

-- Backfill: los productos ya cargados arrancan numerados segun el orden
-- en el que se ven hoy (mas nuevo primero, que es como los devolvia
-- listProducts hasta ahora).
SET @rownum := 0;
UPDATE saas_qq_products
SET sort_order = (@rownum := @rownum + 1)
ORDER BY created_at DESC;
