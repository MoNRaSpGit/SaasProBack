# Producto - Neon

Fecha de actualizacion: 2026-05-06

## Estado del producto

`neon` queda redefinido bajo el contexto V3 como:

- libro diario
- centros de costo
- cuentas
- actividades

Ya no debe leerse como una app guiada por flujo operativo.

Debe leerse como una herramienta real de gestion financiera y operativa para reemplazar Excel.

## Estado backend actual

El backend ya tiene una base funcional alineada al modelo nuevo.

### Endpoints activos del nucleo nuevo

- `GET /api/v1/neon/status`
- `GET /api/v1/neon/clients`
- `POST /api/v1/neon/clients`
- `PATCH /api/v1/neon/clients/:id`
- `GET /api/v1/neon/accounts`
- `POST /api/v1/neon/accounts`
- `GET /api/v1/neon/activities`
- `GET /api/v1/neon/activities/:id`
- `POST /api/v1/neon/activities`
- `PATCH /api/v1/neon/activities/:id`
- `GET /api/v1/neon/journal`
- `POST /api/v1/neon/journal`

### Endpoints heredados aun presentes

- `POST /api/v1/neon/activities/:id/payments`
- `GET /api/v1/neon/categories`
- `POST /api/v1/neon/categories`
- `GET /api/v1/neon/expenses`
- `POST /api/v1/neon/expenses`

## Capabilities activas

- `neon.shell.read`
- `neon.clients.read`
- `neon.clients.write`
- `neon.accounts.read`
- `neon.accounts.write`
- `neon.activities.read`
- `neon.activities.write`
- `neon.categories.read`
- `neon.categories.write`
- `neon.expenses.read`
- `neon.expenses.write`
- `neon.journal.read`
- `neon.journal.write`

## Base funcional implementada

Hoy ya existe en backend:

- clientes por tenant
- cuentas por tenant
- saldos recalculados por movimientos
- actividades por tenant
- journal con ingresos y gastos
- division de movimientos por multiples lineas
- asignacion a:
  - actividad
  - vehiculo
  - personal
  - otros
- kilometraje y litros en allocations de vehiculo
- cobrado y pendiente de actividades calculados desde ingresos del journal asignados a la actividad
- estado comercial derivado desde el contexto real de cobro

## Lo que queda heredado

Persisten piezas anteriores que siguen vivas por compatibilidad, pero ya no son el centro del producto:

- categorias
- gastos legacy
- endpoint viejo de pagos por actividad

No se toman como la forma final del sistema.

## Esquema funcional real hoy

### Cuentas

Soporte actual:

- `cash`
- `bank`

Pendiente V3:

- `credit`

### Journal

Campos activos hoy:

- movement_type
- movement_date
- account_id
- total_amount
- description

Con division:

- multiples `allocations`
- validacion de suma exacta

Pendiente V3 en el journal:

- proveedor
- documento
- cantidad
- unidad de medida
- moneda
- tarjeta
- vencimiento

### Actividades

Ya estan integradas al modelo nuevo.

Logica vigente:

- `facturado` se normaliza a `pendiente_de_cobrar`
- si el ingreso asignado cubre todo el pendiente, queda en `cobrado`

## Migraciones activas

- `009_saas_neon_core.sql`
- `010_saas_neon_payments.sql`
- `011_saas_neon_expenses.sql`

## Donde quedamos hoy

El backend ya soporta este corte util:

1. cuentas
2. libro diario simple
3. centros de costo simples
4. division por multiples lineas
5. actividades integradas al modelo nuevo
6. recalculo de cobrado y pendiente desde journal

## Proximos pasos backend

Orden recomendado:

1. ampliar `movements` al nivel V3 de salidas
2. agregar cuenta tipo `credit`
3. modelar tarjetas y vencimientos
4. crear reporte de deuda pendiente
5. limpiar o encapsular endpoints heredados
6. preparar edicion y borrado logico de movimientos

## Referencias funcionales

La documentacion funcional y de producto del frontend asociado vive en:

- `frontend-neon/docs/product-context.md`
- `frontend-neon/docs/mvp-technical-design.md`
- `frontend-neon/docs/README.md`
