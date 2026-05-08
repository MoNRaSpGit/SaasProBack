# Estado actual de base de datos

Fecha de actualizacion: 2026-05-08

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
