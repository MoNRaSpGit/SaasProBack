# Alcance oficial del producto

Fecha de actualizacion: 2026-05-05

## Estado oficial actual

- modulo oficial activo: `camiones`
- frontend oficial activo: `frontend-camiones`
- backend oficial activo: `backend`
- modulo en incubacion tecnica: `neon`
- frontend en incubacion tecnica: `frontend-neon`
- modulo en incubacion tecnica temprana: `agro`
- frontend en incubacion tecnica temprana: `frontend-agro`

## Regla de producto

Hoy el SaaS se presenta como producto nuevo centrado en `camiones`.

Eso significa:

- no hay otros modulos activos en el camino oficial
- no se vende ni se comunica otro modulo como parte del producto actual
- cualquier modulo futuro entra como modulo nuevo sobre esta base

## Incubacion actual

`neon` ya tiene:

- frontend propio publicado
- shell protegido por auth
- endpoint backend activo
- validacion de conexion a base

Pero en esta etapa:

- no reemplaza a `camiones` como producto oficial
- no se comunica como producto cerrado
- funciona como base valida para arrancar su bloque funcional siguiente

`agro` ya tiene:

- frontend demo propio
- contrato de discovery definido
- endpoint backend inicial previsto para guardar respuestas

Pero en esta etapa:

- no se comunica como producto cerrado
- no tiene aun stock ni contabilidad endurecidos en backend
- se usa como base de discovery y validacion comercial

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
- habilitacion de modulos nuevos en incubacion como `neon`
- habilitacion de modulos nuevos en incubacion temprana como `agro`

## Regla de crecimiento

No se reabre `pos`, `distribuidora`, `cafeteria` o `almacen` como si siguieran vivos.

Si alguno vuelve:

- renace como producto nuevo sobre la arquitectura actual
