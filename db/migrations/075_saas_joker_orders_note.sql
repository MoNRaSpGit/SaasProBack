-- Nota general del pedido (ej. "Pedido para las 9:30"), la que hoy ya se
-- imprime en el ticket cuando se carga un pedido normal (Usuario o
-- Administrador). Nunca se guardaba en la base -- vivia solo en el estado
-- del formulario, se usaba una vez para el ticket impreso al toque y se
-- perdia. Eso rompia justo el caso de un pedido de mostrador (Usuario)
-- que queda "pendiente" hasta que el Administrador lo acepta: la nota
-- jamas viajaba al backend, asi que en el ticket que se imprime recien al
-- aceptarlo no habia forma de que apareciera.
ALTER TABLE saas_joker_orders
  ADD COLUMN note VARCHAR(300) NULL AFTER address;
