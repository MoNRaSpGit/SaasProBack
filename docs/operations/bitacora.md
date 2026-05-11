# Bitacora activa

Fecha de actualizacion: 2026-05-11

## Regla fija

- `LaClaudia` es solo referencia externa
- no se modifica codigo ni base de datos de `LaClaudia`
- todo lo nuevo vive en `SaasPro`

## Regla operativa de subida

Cuando se diga `subi`, se interpreta como:

- `push`
- `deploy`

solo si el PF paso completo.

## Regla operativa de PF

`PF` significa `Pasos Finales`.

PF no se interpreta solo como tests.

PF incluye:

- chequeo de codigo suelto, basura o ruido
- chequeo de legacy no deseado
- validaciones tecnicas
- validacion real si corresponde
- documentacion al dia

La regla final es esta:

- primero se cierra PF completo
- despues recien van `push` y `deploy`

Si falta documentacion relevante, PF no esta cerrado.

## Situacion general del SaaS

Hoy `SaasPro` mantiene:

- core multi-tenant funcional
- auth con contexto tenant
- billing core
- `SaaS Admin Lite`
- productos activos:
  - `neon`
  - `agro`

## Regla de crecimiento vigente

1. mantener sano el core SaaS
2. sostener `neon` como producto activo en validacion
3. sostener `agro` como producto activo en validacion
4. endurecer solo cuando el cliente confirme direccion

## Regla de bitacora por modulo

Esta bitacora no registra detalle fino de `neon` ni de `agro`.

No va aca informacion como:

- cambios de formularios
- cambios de textos
- widgets nuevos
- decisiones finas de UX
- "donde quedamos hoy" de un modulo puntual

Eso se registra en:

- `frontend-neon/docs/bitacora.md`
- `frontend-agro/docs/bitacora.md`

## Cambio backend reciente en Agro

En este corte el backend de `agro` dejo de quedar limitado solo a discovery tecnico.

Se agrego soporte real para el frontend operativo mediante:

- tabla `saas_agro_public_workspaces`
- lectura de workspace publico
- guardado de workspace publico
- devolucion de workspace vacio cuando todavia no hay datos

El objetivo de este cambio fue permitir que `frontend-agro` guarde en BDD:

- establecimientos
- campos
- animales
- contabilidad
- lluvia
- sanidad
- tipos de cambio mensuales

Contrato expuesto en este corte:

- `GET /api/v1/agro/workspace/public`
- `PUT /api/v1/agro/workspace/public`

Este cambio existe para sostener el piloto real del cliente desde backend compartido.

## Proximo paso general

1. mantener sana la base compartida del SaaS
2. esperar devolucion de cliente en los modulos activos
3. endurecer primero lo que se confirme como direccion real
