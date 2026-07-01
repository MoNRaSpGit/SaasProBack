# Bitacora activa

Fecha de actualizacion: 2026-06-11

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

## 2026-06-11 - Demo de agro alineado con filtros mensuales y seed consistente

Se ajusta el entorno demo de `agro` para acompañar la nueva lectura operativa mensual del frontend sin tocar el tenant real del cliente.

Cambios principales:

- `create-agro-demo-user.js` alinea la password operativa del demo usando `AGRO_DEMO_PASSWORD`
- nuevo script `seed-agro-demo-workspace.js`
- el seed queda armado con datos ficticios consistentes para validar cortes mensuales y acumulado del ejercicio

Comportamiento operativo:

- el tenant `agro-demo` sigue aislado del cliente real
- junio 2026 queda sin movimientos operativos para validar una planilla mensual en cero
- el acumulado del ejercicio queda trazable por suma mensual
- el script devuelve un bloque `expectedChecks` para auditar rapidamente los valores esperados del demo

Objetivo:

- probar filtros por mes visible y acumulado sin mezclar datos reales
- evitar inconsistencias entre la planilla mensual y los acumulados del demo

## 2026-06-05 - Rosendo puede fijar su propia contrasena sin perder datos

Se ajusta el corte operativo de `agro` para dejar de depender de una contrasena fija administrada por nosotros.

Cambios principales:

- nuevo endpoint autenticado `POST /api/v1/auth/change-password`
- `create-agro-client-user.js` deja de reescribir la contrasena si la cuenta `rosendo` ya existe
- el cambio invalida `refresh_tokens` vigentes del usuario para forzar re-login limpio

Comportamiento operativo:

- `rosendo` mantiene la misma cuenta
- mantiene el mismo tenant y los mismos datos
- puede entrar con la contrasena actual y reemplazarla por una propia
- si el script operativo de `rosendo` se vuelve a correr, conserva la contrasena ya definida por el cliente

Objetivo:

- migrar la cuenta real del cliente desde una clave temporal nuestra a una clave propia
- evitar perdida de datos o rotura del tenant operativo
- evitar que un script futuro vuelva a pisar la clave del cliente

## 2026-05-22 - Agro suma workspace por tenant y usuario demo aislado

Se agrega una capa real de aislamiento para pruebas de `agro` sin tocar el workspace del cliente real.

Cambios principales:

- nuevos endpoints autenticados:
  - `GET /api/v1/agro/workspace`
  - `PUT /api/v1/agro/workspace`
- nueva tabla `saas_agro_workspaces`
- nuevo script `create-agro-demo-user.js`

Credencial operativa de demo preparada en este corte:

- cuenta corta real: `agrodemo`
- password real del usuario demo: gestionada fuera de Git

Objetivo:

- separar pruebas del cliente real
- permitir que `frontend-agro` guarde por `tenantId`
- evitar cruces entre Rosendo y el entorno demo

## 2026-05-22 - Credencial operativa real de agro y workspace publico en cero

Se ajusta el corte operativo de `agro` para dejarlo listo para carga real del cliente.

Cambios principales:

- el script `create-agro-client-user.js` ahora prepara la cuenta corta `rosendo`
- la password operativa pasa a gestionarse fuera de Git
- el script `reset-agro-public-workspace.js` ahora deja vacios tambien `establishments` y `fields`

Credencial operativa preparada en este corte:

- cuenta: `rosendo`
- password: gestionada fuera de Git mediante `AGRO_CLIENT_PASSWORD`

Objetivo:

- dejar un acceso simple para el cliente real
- hacer que `frontend-agro` arranque completamente vacio
- evitar que queden campos o establecimientos sembrados de cortes anteriores

## 2026-05-20 - Auth acepta cuenta corta para agro y cliente La Milagrosa

Se ajusta el auth para soportar login tradicional por cuenta corta sin exigir email literal.

Cambios principales:

- `login` y `register` ahora aceptan `identifier`, `username` o `email`
- si no llega `@`, el backend normaliza la cuenta a un email canonico interno
- la password minima baja de `5` a `4`
- nuevo script `create-agro-client-user.js`

Credencial operativa inicial de ese corte:

- cuenta: `lamilagrosa`
- password: gestionada fuera de Git mediante `CAMIONES_CLIENT_PASSWORD`

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
- password operativa gestionada fuera de Git mediante `CAMIONES_CLIENT_PASSWORD`
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

Se agrega una utilidad operativa para dejar listo el piloto de `agro` para carga real del cliente.

Cambio principal:

- nuevo script `reset-agro-public-workspace.js`

Comportamiento:

- en su version actual tambien puede dejar vacios `fields`
- en su version actual tambien puede dejar vacios `establishments`
- borra `animalMovements`
- borra `accountingEntries`
- borra `rainfallRecords`
- borra `sanitaryRecords`
- borra `monthlyExchangeRates`

Objetivo:

- limpiar el workspace publico y permitir arranque en cero del frontend

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

Situacion actual de ese contrato:

- queda como compatibilidad operativa
- el frontend autenticado ya usa `GET /api/v1/agro/workspace` y `PUT /api/v1/agro/workspace`

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
