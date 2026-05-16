# Decision 005 - Cobro, gracia y bloqueo del tenant

Fecha: 2026-05-02
Estado: aprobada

## Objetivo

Definir que pasa cuando un cliente no paga a tiempo.

## Decision

- el tenant no se bloquea de inmediato el dia del vencimiento
- si la cuota vence y no fue abonada, entra en estado de aviso
- el cliente dispone de `5` dias de gracia antes de un posible bloqueo
- el bloqueo final siempre lo decide `staff`

## Estados vigentes

- `active`
- `grace_period`
- `pending_manual_block`
- `blocked`

## Consecuencias tecnicas

- el sistema automatiza deteccion de vencimiento y gracia
- el sistema no automatiza el bloqueo final
- el panel interno debe permitir ver y operar el estado de cobro del tenant
