# Decision 007 - Frontends por producto sobre backend unico

Fecha: 2026-05-05
Estado: aprobada

## Objetivo

Definir la regla de separacion entre backend compartido y frontends por producto.

## Decision

- `SaasPro` mantiene un solo backend SaaS multi-tenant
- cada frontend representa una experiencia de producto
- no se crea un frontend por cliente
- los frontends apuntan al mismo backend SaaS

## Consecuencias tecnicas

- el backend concentra auth, tenants, billing, permisos y reglas compartidas
- cada producto puede tener su propio frontend y su propia carpeta `docs/`
- la documentacion de frontend no se mezcla dentro de `backend/docs`
