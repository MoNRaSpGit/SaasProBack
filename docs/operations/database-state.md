# Estado actual de base de datos

Fecha de actualizacion: 2026-05-22

## Objetivo

Dejar una foto clara de la base del backend SaaS.

## Regla de alcance

Se consideran parte de esta documentacion:

- tablas `saas_` activas del core
- tablas `saas_` de modulos que siguen formando parte del backend actual
- tablas legacy de auth todavia usadas por el SaaS

Las demas tablas viejas de otros proyectos no se tocan.

## Core SaaS vigente

- `saas_tenants`
- `saas_tenant_memberships`
- `saas_tenant_modules`
- `saas_tenant_settings`
- `saas_branches`
- `saasPro_users`
- `saasPro_refresh_tokens`

## Modulos activos documentados

### Agro

- `saas_agro_discovery_responses`
- `saas_agro_public_workspaces`
- `saas_agro_workspaces`

## Uso actual destacado

### `saas_agro_public_workspaces`

Guarda el workspace publico operativo que consume `frontend-agro`.

Hoy ese workspace concentra:

- establecimientos
- campos
- movimientos de animales
- asientos contables
- registros de lluvia
- registros sanitarios
- tipos de cambio mensuales

Clave usada en este corte:

- `workspace_key = public`

Comportamiento operativo esperado en este corte:

- el workspace puede devolverse totalmente vacio
- eso incluye `establishments` y `fields` cuando el cliente arranca desde cero

Contrato asociado:

- `GET /api/v1/agro/workspace/public`
- `PUT /api/v1/agro/workspace/public`

### `saas_agro_workspaces`

Guarda el workspace autenticado de `agro` por tenant.

Hoy esta tabla concentra:

- establecimientos
- campos
- movimientos de animales
- asientos contables
- registros de lluvia
- registros sanitarios
- tipos de cambio mensuales

Clave operativa:

- `tenant_id + workspace_key`

Contrato asociado:

- `GET /api/v1/agro/workspace`
- `PUT /api/v1/agro/workspace`

## Modulos presentes en backend pero fuera del alcance oficial actual

### Camiones

Siguen existiendo tablas y codigo de backend de `camiones`, aunque no forma parte del alcance oficial activo declarado en este corte.

Tablas presentes:

- `saas_camiones_clients`
- `saas_camiones_places`
- `saas_camiones_trips`

Campos hoy relevantes en `saas_camiones_trips`:

- `status`
- `collected_amount`
- `notes`

Estados soportados:

- `confirmed`
- `pending`
- `paid`
- `cancelled`

## Limpieza ya aplicada

- eliminadas tablas `saas_pos_*`
- eliminados modulos viejos de `saas_tenant_modules`
- eliminados tenants y usuarios de prueba viejos del SaaS
- 2026-08-11: eliminadas las 7 tablas `saas_neon_*` (clients, accounts, categories,
  activities, activity_payments, movements, movement_allocations), sus filas en
  `saas_tenant_modules`, el modulo de backend completo y `frontend-neon`. Motivo: sin
  uso real (ultimo login 2026-07-06, ultimo dato cargado 2026-05-07, solo 47 filas en
  total entre las 7 tablas, casi todo tenants de test automatico). Dump de respaldo
  guardado fuera del repo antes de borrar.

## Regla futura

Cuando nazca un modulo nuevo:

- agrega sus tablas `saas_<modulo>_*`
- entra con migracion limpia y contrato claro
- actualiza este documento en el mismo cierre
