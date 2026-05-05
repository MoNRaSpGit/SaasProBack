# Alcance oficial del producto

Fecha de actualizacion: 2026-05-05

## Estado oficial actual

- modulo oficial activo: `camiones`
- frontend oficial activo: `frontend-camiones`
- backend oficial activo: `backend`

## Regla de producto

Hoy el SaaS se presenta como producto nuevo centrado en `camiones`.

Eso significa:

- no hay otros modulos activos en el camino oficial
- no se vende ni se comunica otro modulo como parte del producto actual
- cualquier modulo futuro entra como modulo nuevo sobre esta base

## Multi-modulo

El core SaaS sigue soportando conceptualmente multi-modulo por tenant.

Pero en esta etapa:

- el unico modulo real habilitable y soportado es `camiones`

## SaaS Admin

`saas-admin` sigue existiendo porque es parte del core operativo del SaaS.

Hoy su alcance practico es:

- billing
- tenants
- habilitacion de `camiones`

## Regla de crecimiento

No se reabre `pos`, `distribuidora`, `cafeteria` o `almacen` como si siguieran vivos.

Si alguno vuelve:

- renace como producto nuevo sobre la arquitectura actual
