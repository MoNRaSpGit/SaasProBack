# Producto - Neon

Fecha de actualizacion: 2026-05-05

## Estado

`neon` esta en incubacion tecnica.

Hoy no es el producto oficial principal del SaaS, pero ya tiene una base real publicada para arrancar su desarrollo funcional.

## Backend

Endpoint activo:

- `GET /api/v1/neon/status`

Reglas activas:

- `Bearer`
- tenant activo
- modulo `neon` habilitado
- capability `neon.shell.read`

Respuesta actual del shell:

- modulo
- tenant actual
- usuario actual
- estado de base (`connected`)
- timestamp del backend
- fase `shell`

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
- listo para diseno tecnico e implementacion MVP

## Regla documental

La estructura general del SaaS se documenta en `backend/docs`.

La documentacion funcional y operativa propia de `neon` vive en:

- `frontend-neon/docs`

## Siguiente bloque natural

El siguiente bloque de `neon` ya no es infraestructura.

Es bajar el modelo funcional del producto:

- actividades
- movimientos
- distribuciones
- centros de costo
- cuentas
- clientes
- reportes

La referencia funcional y de MVP de este modulo vive en:

- `frontend-neon/docs/product-context.md`
- `frontend-neon/docs/mvp-technical-design.md`
