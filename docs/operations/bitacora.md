# Bitacora activa

Fecha de actualizacion: 2026-05-05

## Regla fija

- `LaClaudia` es solo referencia externa
- no se modifica codigo ni base de datos de `LaClaudia`
- todo lo nuevo vive en `SaasPro`

## Regla operativa de subida

Cuando se diga `subi`, se interpreta como:

- `push`
- `deploy`

solo si el PF paso completo.

## Situacion actual

Hoy `SaasPro` ya tiene:

- core multi-tenant funcional
- auth con contexto tenant
- billing core
- `SaaS Admin Lite`
- modulo oficial real:
  - `camiones`

## Lo que ya quedo hecho

- frontend oficial separado como `frontend-camiones`
- backend limpiado de modulos experimentales
- base `saas_` limpiada para quedar alineada a `camiones`
- scripts y test funcionales alineados al estado actual
- deploy del frontend publicado y validado

## Regla de crecimiento vigente

1. sostener `camiones`
2. seguir endureciendo operacion interna del SaaS
3. sumar proximo modulo solo cuando la base siga sana
