-- Fondo de Piloto: "tomar" el borrador ya no lo vacia de una (03/11/2026,
-- pedido explicito: "que yo lo pueda agarrar igual... y si ella sigue
-- pasando, me sigue sumando en el mio... cuando le de enviar, ahi
-- cortaria"). claimed = una caja ya empezo a recibir en vivo lo que la
-- tablet escanea; delivered_items = ultima foto de lo ya entregado (para
-- calcular que hay de nuevo en cada sincronizacion); closing = la tablet
-- ya apreto Enviar pero puede quedar un resto sin entregar todavia.
-- pending_unknown_barcode: codigo que la tablet escaneo y no existe en el
-- catalogo, pendiente de que el mostrador lo cargue (pedido explicito:
-- "que me salga otro pop-up... y ella sigue ahi").
ALTER TABLE saas_piloto_fondo_cart
  ADD COLUMN claimed TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN delivered_items JSON NULL,
  ADD COLUMN closing TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN pending_unknown_barcode VARCHAR(64) NULL;
