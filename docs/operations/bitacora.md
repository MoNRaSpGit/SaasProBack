# Bitacora activa

Fecha de actualizacion: 2026-05-16

## Objetivo

Registrar cambios reales del backend.

No es un documento de arquitectura ni una bitacora fina de frontend.

## Regla de uso

Esta bitacora registra:

- cambios de backend ya hechos
- cambios de base de datos
- cambios de contratos API
- cambios operativos del core o de modulos backend

No registra:

- cambios visuales de frontend
- copy
- UX puntual
- notas de "donde quedamos hoy" dentro de un frontend

Eso va en la carpeta `docs/` del frontend correspondiente.

## Situacion general del SaaS

Hoy `SaasPro` mantiene:

- core multi-tenant funcional
- auth con contexto tenant
- billing core
- `SaaS Admin Lite`
- productos activos documentados:
  - `neon`
  - `agro`

## Cambios relevantes del backend

### 2026-05-12 - Agro workspace publico operativo

El backend de `agro` dejo de quedar limitado solo a discovery tecnico.

Se agrego soporte real para el frontend operativo mediante:

- tabla `saas_agro_public_workspaces`
- lectura de workspace publico
- guardado de workspace publico
- devolucion de workspace vacio cuando todavia no hay datos

Objetivo del cambio:

- permitir que `frontend-agro` guarde en BDD establecimientos, campos, animales, contabilidad, lluvia, sanidad y tipos de cambio mensuales

Contrato expuesto:

- `GET /api/v1/agro/workspace/public`
- `PUT /api/v1/agro/workspace/public`

### 2026-05-12 - Camiones ciclo de cobro mas real

El backend de `camiones` se actualizo para soportar ciclo de cobro mas real.

Cambios de contrato:

- los viajes nuevos ahora nacen en estado `confirmed`
- `update trip` ahora acepta `status` y `collectedAmount`
- se mantiene `PATCH /api/v1/camiones/trips/:id/pay`
- se agrega `DELETE /api/v1/camiones/trips/:id` solo para viajes con estado `paid`

Cambios de base:

- nueva migracion `017_saas_camiones_trip_status_and_collections.sql`
- nueva columna `saas_camiones_trips.collected_amount`
- `status` de `saas_camiones_trips` pasa a soportar `confirmed`, `pending`, `paid` y `cancelled`
- los viajes viejos en `pending` se normalizan a `confirmed`

Cambios operativos:

- nuevo script `apply-camiones-trip-status-and-collections-migration.js`
- actualizacion de `validate-camiones.ts`
- el PF funcional de `camiones` ahora valida borrado de viaje pago

## Proximo foco general

1. mantener sano el core compartido
2. sostener sanos `neon` y `agro`
3. endurecer primero lo que se confirme como direccion real
