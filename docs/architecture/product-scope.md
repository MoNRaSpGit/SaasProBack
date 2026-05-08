# Alcance oficial del producto

Fecha de actualizacion: 2026-05-08

## Estado oficial actual

- backend oficial activo: `backend`
- productos activos: `neon` y `agro`
- frontend activo de `neon`: `frontend-neon`
- frontend activo de `agro`: `frontend-agro`

## Regla de producto

Hoy el SaaS se presenta con dos productos activos:

- `neon`
- `agro`

Eso significa:

- no se documentan otros productos como activos en este corte
- cualquier modulo futuro entra como modulo nuevo sobre esta base

## Regla de detalle por modulo

Este documento solo declara la foto global del SaaS.

No documenta:

- cambios finos de `neon`
- cambios finos de `agro`
- cortes diarios de producto
- listas de tareas especificas por modulo

Ese detalle vive en la carpeta `docs/` de cada modulo.

## Multi-modulo

El core SaaS sigue soportando conceptualmente multi-modulo por tenant.

Pero en esta etapa:

- los modulos activos documentados son `neon` y `agro`

## SaaS Admin

`saas-admin` sigue existiendo porque es parte del core operativo del SaaS.

Hoy su alcance practico es:

- billing
- tenants
- habilitacion de `neon`
- habilitacion de `agro`

## Regla de crecimiento

No se reabre `pos`, `distribuidora`, `cafeteria`, `almacen` o productos viejos como si siguieran vivos.

Si alguno vuelve:

- renace como producto nuevo sobre la arquitectura actual
