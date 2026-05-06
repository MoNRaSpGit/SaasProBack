# Producto - Neon

Fecha de actualizacion: 2026-05-06

## Norte funcional vigente

`neon` se lee hoy como un modulo en piloto orientado a `libro diario`.

El modelo que se esta validando con cliente es:

- cada `ingreso` o `gasto` nace en el libro diario
- el movimiento impacta una `cuenta`
- si es a `credito`, agrega tarjeta y vencimiento
- despues se reparte a uno o varios `centros de costo`
- las `actividades` numeradas son un destino posible, no el eje del sistema
- los `alquileres` existen como flujo separado de las actividades

La meta de este corte no es cerrar arquitectura definitiva.

La meta es dejar una base funcional para validar:

- si el flujo diario se entiende
- si los centros de costo reflejan su Excel real
- si la lectura de reportes va por el camino correcto

## Estado backend real hoy

El backend ya soporta una base util para ese piloto.

### Endpoints activos del nucleo

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

Se mantienen por compatibilidad.

No son la direccion final del producto.

## Capacidades activas

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
- cuentas tipo:
  - `cash`
  - `bank`
  - `credit`
- saldos recalculados por movimientos
- actividades por tenant
- journal con ingresos y gastos
- validacion de suma exacta por multiples lineas
- asignacion a centros de costo:
  - `activity`
  - `vehicle`
  - `personal`
  - `rental`
  - `other`
- kilometraje y litros dentro de metadata de vehiculo
- soporte V3 de salidas:
  - proveedor
  - documento
  - cantidad
  - unidad
  - moneda
  - detalle
- soporte de credito:
  - tarjeta
  - vencimiento
- soporte de `expense_kind`:
  - `operational`
  - `credit_settlement`
- cobrado y pendiente de actividades calculados desde ingresos del journal asignados a la actividad
- normalizacion comercial:
  - `facturado` se trata como `pendiente_de_cobrar`
  - `cobrado` se deriva del dinero realmente ingresado

## Lectura funcional del modelo

### Cuentas

Representan de donde sale o entra el dinero:

- `Caja $`
- bancos
- credito

El saldo se recalcula desde los movimientos.

### Journal

Es el nucleo real del producto.

Cada movimiento registra:

- fecha
- tipo
- cuenta
- importe total
- detalle

Y en salidas tambien puede registrar:

- proveedor
- documento
- cantidad
- unidad
- moneda
- kilometraje o litros cuando aplica por allocation de vehiculo

### Credito

Si la cuenta es `credit`, el movimiento puede guardar:

- tarjeta
- vencimiento

Ademas ya existe el tratamiento de `pago de tarjeta` para netear deuda.

### Actividades

Se mantienen como entidad comercial numerada:

- cliente
- cotizado
- estado comercial

Pero ya no son el eje contable.

La actividad recibe dinero y gastos desde el libro diario.

### Alquileres

El backend ya permite tratarlos como centro de costo `rental`.

No obliga numero de actividad.

Esto deja listo el flujo pedido por cliente:

- ingreso por alquiler
- cuenta de entrada
- centro `ALQ1`, `ALQ2`, etc.

## Migraciones del bloque Neon

- `009_saas_neon_core.sql`
- `010_saas_neon_payments.sql`
- `011_saas_neon_expenses.sql`
- `012_saas_neon_v3_expense_fields.sql`
- `013_saas_neon_credit_settlement_kind.sql`
- `014_saas_neon_add_rental_cost_center.sql`

### Estado de aplicacion

- `012` y `013` forman parte del corte funcional actual
- `014` ya fue aplicada para que `rental` quede soportado tambien a nivel base

## Mini cierre de piloto

Este corte backend ya cubre la mayor parte del pedido importante del cliente:

- libro diario como entrada principal
- cuentas y saldo automatico
- credito con tarjeta y vencimiento
- reparto a multiples centros de costo
- ingresos sin actividad obligatoria
- alquileres separados de actividades
- pagos de tarjeta para deuda pendiente
- script repetible para resetear el tenant demo con datos de prueba curados

## Datos demo de prueba

Quedo preparado un reseteo repetible del tenant `Neon Demo`.

Script:

- `backend/scripts/reset-neon-demo-pilot-data.js`

Cobertura del set de prueba:

- `5` cuentas sugeridas
- `3` clientes
- `3` actividades
- `4` movimientos
- casos de:
  - actividad
  - vehiculo
  - personal
  - alquiler

La idea es dejar un entorno corto, legible y facil de mostrar al cliente.

## Lo que todavia no se endurece

Queda intencionalmente en estado de piloto:

- catalogos cerrados y definitivos de medios de pago
- catalogos cerrados y definitivos de tarjetas
- entidad propia de alquiler con ficha completa
- edicion y borrado logico visibles
- limpieza final de endpoints heredados

## Camino sugerido despues de la prueba

Si el cliente confirma que el flujo va por aca, el siguiente bloque recomendado es:

1. endurecer catalogos base
2. cerrar alquileres como flujo oficialmente soportado
3. consolidar reportes definitivos
4. recien despues limpiar legacy y abrir edicion / borrado logico

## Referencias cruzadas

- `backend/docs/operations/bitacora.md`
- `frontend-neon/docs/README.md`
- `frontend-neon/docs/mvp-technical-design.md`
