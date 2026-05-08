# Bitacora activa

Fecha de actualizacion: 2026-05-08

## Regla fija

- `LaClaudia` es solo referencia externa
- no se modifica codigo ni base de datos de `LaClaudia`
- todo lo nuevo vive en `SaasPro`

## Regla operativa de subida

Cuando se diga `subi`, se interpreta como:

- `push`
- `deploy`

solo si el PF paso completo.

## Situacion general del SaaS

Hoy `SaasPro` mantiene:

- core multi-tenant funcional
- auth con contexto tenant
- billing core
- `SaaS Admin Lite`
- productos activos:
  - `neon`
  - `agro`

## Regla de crecimiento vigente

1. mantener sano el core SaaS
2. sostener `neon` como producto activo en validacion
3. sostener `agro` como producto activo en validacion
4. endurecer solo cuando el cliente confirme direccion

## Regla de bitacora por modulo

Esta bitacora no registra detalle fino de `neon` ni de `agro`.

No va aca informacion como:

- cambios de formularios
- cambios de textos
- widgets nuevos
- decisiones finas de UX
- "donde quedamos hoy" de un modulo puntual

Eso se registra en:

- `frontend-neon/docs/bitacora.md`
- `frontend-agro/docs/bitacora.md`

## Proximo paso general

1. mantener sana la base compartida del SaaS
2. esperar devolucion de cliente en los modulos activos
3. endurecer primero lo que se confirme como direccion real
