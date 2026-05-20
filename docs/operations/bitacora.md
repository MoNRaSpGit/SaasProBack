# Bitacora activa

Fecha de actualizacion: 2026-05-20

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

## 2026-05-20 - Auth acepta cuenta corta para agro y cliente La Milagrosa

Se ajusta el auth para soportar login tradicional por cuenta corta sin exigir email literal.

Cambios principales:

- `login` y `register` ahora aceptan `identifier`, `username` o `email`
- si no llega `@`, el backend normaliza la cuenta a un email canonico interno
- la password minima baja de `5` a `4`
- nuevo script `create-agro-client-user.js`

Credencial operativa preparada en este corte:

- cuenta: `lamilagrosa`
- password: `1994`

Objetivo:

- permitir que el cliente entre con credenciales simples
- mantener compatibilidad con el auth existente por email
- asociar el ingreso del cliente actual al workspace publico que hoy ya contiene los datos reales visibles

## 2026-05-20 - Usuario lamilagrosa para camiones sobre tenant real actual

Se agrega una utilidad para crear el usuario `lamilagrosa` sobre el mismo tenant que hoy usa el acceso `cliente actual` de `camiones`.

Cambio principal:

- nuevo script `create-camiones-current-client-user.js`

Comportamiento:

- crea o actualiza `lamilagrosa@saaspro.local`
- password operativa `1994`
- deja al usuario como miembro `admin` del tenant `camiones-demo`
- ese tenant conserva los viajes, clientes y cobros reales ya existentes

Objetivo:

- evitar copias innecesarias de datos
- separar accesos por cliente manteniendo cada usuario dentro de su propia porcion del SaaS

## 2026-05-20 - Auth multi-tenant mas blindado para sesiones de camiones

Se endurece el auth para reducir el riesgo de cruces de tenant por sesiones viejas, cambios de tenant default o reuso de credenciales entre frontends.

Cambio principal:

- los JWT nuevos ahora incluyen `tenantId`

Comportamiento:

- `login` emite tokens atados al tenant elegido al iniciar sesion
- `refresh` conserva el mismo tenant del token
- los guards de modulo validan la membresia contra ese `tenantId`
- si la membresia ya no existe o no coincide, la sesion deja de ser valida
- los tokens viejos sin `tenantId` quedan invalidados y fuerzan re-login despues del deploy

Objetivo:

- blindar mejor la separacion entre clientes dentro del SaaS
- evitar que una sesion derive a otro tenant por cambio de `is_default`

## 2026-05-20 - Script para limpiar workspace publico de agro

Se agrega una utilidad operativa para dejar listo el piloto de `agro` para carga real del cliente sin perder los campos visibles ya cargados.

Cambio principal:

- nuevo script `reset-agro-public-workspace.js`

Comportamiento:

- conserva `fields`
- conserva los `establishments` referenciados por esos campos
- borra `animalMovements`
- borra `accountingEntries`
- borra `rainfallRecords`
- borra `sanitaryRecords`
- borra `monthlyExchangeRates`

Objetivo:

- limpiar el workspace publico sin romper la UI ni los selectores que dependen de `establishmentId`

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

El mÃ³dulo `alamcen` dejÃ³ de ser solo un scanner demo suelto y pasÃ³ a apoyarse mejor en la arquitectura multi-tenant del backend.

Cambios principales:

- `alamcen` se agrega al catÃ¡logo oficial de productos SaaS compartidos
- nuevas capabilities del mÃ³dulo:
  - `alamcen.shell.read`
  - `alamcen.products.read`
  - `alamcen.products.write`
  - `alamcen.sales.write`
  - `alamcen.payments.write`
  - `alamcen.dashboard.read`
  - `alamcen.dashboard.write`
  - `alamcen.stock.read`
  - `alamcen.stock.write`
- nuevo guard de autenticaciÃ³n por mÃ³dulo usando el patrÃ³n compartido del SaaS
- nueva migraciÃ³n `018_saas_alamcen_core.sql`

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

- empezar a reconstruir el comportamiento de `LaClaudia` dentro del backend Ãºnico del SaaS
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
