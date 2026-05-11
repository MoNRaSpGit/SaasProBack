# Estado actual de base de datos

Fecha de actualizacion: 2026-05-11

## Regla de alcance

Solo se consideran parte del SaaS actual:

- tablas `saas_` activas del core
- tablas `saas_` activas de modulos documentados
- tablas legacy de auth:
  - `saasPro_users`
  - `saasPro_refresh_tokens`

Las demas tablas viejas de otros proyectos no se tocan.

## Tablas SaaS activas actuales

### Core

- `saas_tenants`
- `saas_tenant_memberships`
- `saas_tenant_modules`
- `saas_tenant_settings`
- `saas_branches`

### Agro

- `saas_agro_discovery_responses`
- `saas_agro_public_workspaces`

## Uso actual de tabla Agro nueva

`saas_agro_public_workspaces` guarda el workspace publico operativo que consume `frontend-agro`.

Hoy ese workspace concentra:

- establecimientos
- campos
- movimientos de animales
- asientos contables
- registros de lluvia
- registros sanitarios
- tipos de cambio mensuales

La clave usada en este corte es:

- `workspace_key = public`

El contrato actual del backend para esa tabla se expone por:

- `GET /api/v1/agro/workspace/public`
- `PUT /api/v1/agro/workspace/public`

### Camiones historico

- `saas_camiones_clients`
- `saas_camiones_places`
- `saas_camiones_trips`

### Auth legacy vigente

- `saasPro_users`
- `saasPro_refresh_tokens`

## Limpieza ya aplicada

- eliminadas tablas `saas_pos_*`
- eliminados modulos viejos de `saas_tenant_modules`
- eliminados tenants y usuarios de prueba viejos del SaaS

## Estado de modulos

En `saas_tenant_modules` deben existir los modulos documentados por el core segun el estado vigente del producto.

Hoy la referencia oficial para esa lectura es:

- `backend/docs/architecture/product-scope.md`

## Regla futura

Cuando nazca un modulo nuevo:

- agrega sus tablas `saas_<modulo>_*`
- no reabre tablas viejas borradas
- entra con migracion limpia y contrato claro
