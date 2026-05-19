# Bitacora activa

Fecha de actualizacion: 2026-05-18

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

## 2026-05-16 - Regla global de frontend por capas

Se deja explicita en arquitectura una regla de trabajo para frontends que ya tienen complejidad real.

Queda establecido:

- no resolver modulos operativos como una sola pagina enorme
- separar tipos, data, logica, componentes y estilos
- usar `global.css` solo para lo verdaderamente global
- mover estilos de feature a archivos propios del modulo

Motivo:

- bajar ruido
- facilitar mantenimiento
- evitar mezclar logica, UI y estilos en un mismo archivo grande

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

### 2026-05-19 - Almacen Sprint 1 sobre core SaaS

El módulo `alamcen` dejó de ser solo un scanner demo suelto y pasó a apoyarse mejor en la arquitectura multi-tenant del backend.

Cambios principales:

- `alamcen` se agrega al catálogo oficial de productos SaaS compartidos
- nuevas capabilities del módulo:
  - `alamcen.shell.read`
  - `alamcen.products.read`
  - `alamcen.products.write`
  - `alamcen.sales.write`
  - `alamcen.payments.write`
  - `alamcen.dashboard.read`
  - `alamcen.dashboard.write`
  - `alamcen.stock.read`
  - `alamcen.stock.write`
- nuevo guard de autenticación por módulo usando el patrón compartido del SaaS
- nueva migración `018_saas_alamcen_core.sql`

Contrato backend expuesto en este corte:

- `GET /api/v1/alamcen/status`
- `GET /api/v1/alamcen/products`
- `GET /api/v1/alamcen/productos/barcode/:barcode`
- `POST /api/v1/alamcen/productos/manual`
- `PATCH /api/v1/alamcen/productos/:productId`
- `POST /api/v1/alamcen/sales`
- `POST /api/v1/alamcen/payments`
- `GET /api/v1/alamcen/dashboard`

Modelo de datos nuevo:

- `saas_alamcen_products`
- `saas_alamcen_sales`
- `saas_alamcen_sale_items`
- `saas_alamcen_payments`
- `saas_alamcen_dashboard_daily`

Objetivo del cambio:

- empezar a reconstruir el comportamiento de `LaClaudia` dentro del backend único del SaaS
- sin tocar el proyecto original ni migrar datos legacy
- dejando la base correcta para scanner, panel y productos

### 2026-05-18 - Camiones endurece clientes y evita duplicados por escritura

El backend de `camiones` se ajusto para sostener mejor el modelo donde varios viajes cuelgan de un mismo cliente.

Cambio principal:

- la creacion y edicion de clientes ahora normaliza espacios repetidos y mayusculas/minusculas antes de decidir si un cliente ya existe

Consecuencia operativa:

- `Juan`
- ` JUAN `
- `Juan   `

se interpretan como el mismo cliente activo del tenant.

Impacto real:

- baja la creacion accidental de clientes duplicados
- se protege mejor la relacion `client_id -> trips`
- se actualizo `validate-camiones.ts` para cubrir este caso de normalizacion

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
