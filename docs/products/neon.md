# Producto - Neon

Fecha de actualizacion: 2026-05-05

## Estado

`neon` esta en incubacion tecnica.

Hoy no es el producto oficial principal del SaaS, pero ya tiene una base real publicada y un primer slice funcional del MVP.

## Backend

Endpoints activos:

- `GET /api/v1/neon/status`
- `GET /api/v1/neon/clients`
- `POST /api/v1/neon/clients`
- `PATCH /api/v1/neon/clients/:id`
- `GET /api/v1/neon/accounts`
- `GET /api/v1/neon/categories`
- `POST /api/v1/neon/categories`
- `GET /api/v1/neon/activities`
- `GET /api/v1/neon/activities/:id`
- `POST /api/v1/neon/activities`
- `PATCH /api/v1/neon/activities/:id`
- `POST /api/v1/neon/activities/:id/payments`
- `GET /api/v1/neon/expenses`
- `POST /api/v1/neon/expenses`

Reglas activas:

- `Bearer`
- tenant activo
- modulo `neon` habilitado
- capability `neon.shell.read`
- capability `neon.clients.read`
- capability `neon.clients.write`
- capability `neon.accounts.read`
- capability `neon.activities.read`
- capability `neon.activities.write`
- capability `neon.categories.read`
- capability `neon.categories.write`
- capability `neon.expenses.read`
- capability `neon.expenses.write`

Base funcional actual:

- clientes por tenant
- actividades por tenant
- cuentas base por tenant (`Caja`, `Banco`)
- pagos de actividad enlazados a cuentas
- recalculo automatico de `cobrado` y `pendiente`
- saldo de cuentas calculado por movimientos
- categorias de gasto por tenant
- gasto simple con destino y cuenta

Migraciones activas del modulo:

- `009_saas_neon_core.sql`
- `010_saas_neon_payments.sql`
- `011_saas_neon_expenses.sql`

## Frontend

Frontend asociado:

- `frontend-neon`

Ruta oficial del modulo:

- `/neon`

Estado del bloque 1:

- login real conectado al SaaS
- ruta protegida
- dashboard base
- saas-admin enlazado
- shell publicado en produccion
- credenciales demo de prueba para esta etapa
- contexto funcional cerrado

Estado actual del bloque 2:

- alta de clientes publicada
- alta de actividades publicada
- detalle de actividad publicado
- cuentas base visibles
- `Registrar pago` publicado
- pagos parciales activos desde actividad
- `cobrado` y `pendiente` recalculados automaticamente
- categorias de gasto publicadas
- gasto simple publicado

## Regla documental

La estructura general del SaaS se documenta en `backend/docs`.

La documentacion funcional y operativa propia de `neon` vive en:

- `frontend-neon/docs`

## Siguiente bloque natural

El siguiente bloque de `neon` ya no es infraestructura ni ingresos desde actividad.

El siguiente foco funcional es:

- dividir gasto
- centros de costo
- primeros reportes base

La referencia funcional y de MVP de este modulo vive en:

- `frontend-neon/docs/product-context.md`
- `frontend-neon/docs/mvp-technical-design.md`
