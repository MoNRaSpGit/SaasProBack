# Alcance oficial del producto

Fecha de actualizacion: 2026-05-16

## Estado oficial actual

- backend oficial activo: `backend`
- productos activos documentados: `neon` y `agro`
- frontend activo de `neon`: `frontend-neon`
- frontend activo de `agro`: `frontend-agro`

## Regla de producto

Hoy el SaaS se presenta con dos productos activos:

- `neon`
- `agro`

Eso significa:

- no se documentan otros productos como activos en este corte
- cualquier modulo futuro entra como modulo nuevo sobre esta base

## Diferencia entre codigo presente y producto activo

Puede existir codigo de otros modulos dentro del backend.

Eso no alcanza para declararlos como productos activos.

Para que un modulo pase a producto activo hace falta:

- decision de producto clara
- backend funcional
- frontend propio o estrategia oficial definida
- documentacion actualizada en `backend/docs`

## Regla de detalle por modulo

Este documento solo declara la foto global del SaaS.

No documenta:

- cambios finos de `neon`
- cambios finos de `agro`
- cortes diarios de producto
- listas de tareas especificas por modulo

Ese detalle vive en la carpeta `docs/` del frontend del modulo involucrado.

## Multi-modulo

El core SaaS soporta conceptualmente multi-modulo por tenant.

Pero en esta etapa:

- los modulos activos documentados son `neon` y `agro`

## SaaS Admin

`saas-admin` sigue existiendo porque es parte del core operativo del SaaS.

Hoy su alcance practico es:

- billing
- tenants
- habilitacion de modulos
- soporte operativo del SaaS

## Regla de crecimiento

No se reabren productos viejos como si siguieran vivos.

Si un producto vuelve:

- renace como producto nuevo sobre la arquitectura actual
