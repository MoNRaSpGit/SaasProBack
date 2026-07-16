# Inventario operativo del backend

Fecha de actualizacion: 2026-07-16

## Objetivo

Dar un mapa rapido del backend real para orientarse sin recorrer todo el repo a ciegas.

## Estructura principal del repo

- `src/` = codigo fuente del backend
- `db/migrations/` = migraciones SQL
- `scripts/` = validaciones, migraciones asistidas y utilidades operativas
- `docs/` = documentacion oficial del backend

## Modulos presentes en `src/modules`

Ver [decision-008](../decisions/decision-008-frontend-dedicado-sin-tenant-para-productos-nuevos.md)
para la explicacion completa de los dos patrones. Cada modulo se marca aca con el patron
que usa.

### Core operativo

- `auth` (patron legacy - emite y valida JWT/tenant para los modulos que lo usan)
- `saas-admin` (patron legacy)

### Productos activos documentados (patron legacy - multi-tenant compartido)

- `neon`
- `agro`

### Modulos con datos reales fuera del alcance oficial actual (patron legacy)

- `camiones`
- `alamcen`

### Modulos con frontend dedicado (patron nuevo - sin tenant, tablas propias)

- `carnet` - frontend `frontend-carnet`, tablas `saas_carnet_*`, sin auth
- `scrum` - frontend `frontend-scrum`, tablas `saas_scrum_*`, sin auth
- `juez-auth` - tablas propias de cuentas juez, sin el sistema de tenant compartido

## Shared relevante

El backend tambien se apoya en capas compartidas dentro de `src/shared` para:

- authz y capabilities
- base de datos
- contexto request
- middleware y filtros HTTP
- health checks
- catalogo de productos SaaS

## Scripts operativos actuales

### Migraciones asistidas

- `apply-tenant-billing-core.js`
- `apply-tenant-role-alignment.js`
- `apply-neon-core-migration.js`
- `apply-neon-payments-migration.js`
- `apply-neon-expenses-migration.js`
- `apply-neon-v3-expense-fields-migration.js`
- `apply-neon-credit-settlement-kind-migration.js`
- `apply-neon-rental-cost-center-migration.js`
- `apply-agro-discovery-migration.js`
- `apply-agro-public-workspace-migration.js`
- `apply-alamcen-core-migration.js`
- `apply-camiones-core-migration.js`
- `apply-camiones-places-migration.js`
- `apply-camiones-trip-status-and-collections-migration.js`

### Validaciones y suites funcionales

- `verify-saas-core.js`
- `smoke-auth-module-access.js`
- `run-functional-suite.js`
- `validate-auth-multitenant.ts`
- `validate-alamcen.ts`
- `validate-role-capabilities.ts`
- `validate-saas-admin-lite.ts`
- `validate-neon-shell.ts`
- `validate-agro-discovery.ts`
- `validate-camiones.ts`

### Utilidades operativas

- `backfill-camiones-module.js`
- `create-alamcen-demo-user.js`
- `create-agro-client-user.js`
- `create-agro-demo-user.js`
- `seed-agro-demo-workspace.js`
- `create-camiones-current-client-user.js`
- `create-camiones-demo-user.js`
- `reset-agro-public-workspace.js`
- `reset-neon-demo-pilot-data.js`

## Scripts npm relevantes

- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `npm run test:smoke`
- `npm run test:functional`
- `npm run test:functional:auth`
- `npm run test:functional:alamcen`
- `npm run test:functional:saas-admin`
- `npm run test:functional:neon`
- `npm run test:functional:agro`
- `npm run test:functional:camiones`

## Documentacion relacionada

- arquitectura general: `docs/architecture/`
- operacion: `docs/operations/`
- decisiones vigentes: `docs/decisions/`
- archivo historico: `docs/archive/`

## Regla de mantenimiento

Si cambia el mapa real del backend:

- se actualiza este inventario en el mismo cierre del cambio
