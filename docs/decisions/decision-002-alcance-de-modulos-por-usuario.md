# Decision 002 - Alcance de modulos por usuario

Fecha: 2026-05-02
Estado: aprobada

## Objetivo

Definir si un usuario puede usar uno o varios modulos dentro de su tenant.

## Decision

- un `tenant` puede tener uno o varios modulos habilitados
- un usuario puede ver uno o varios modulos dentro de ese tenant
- el acceso a cada modulo depende de:
  - modulo habilitado para el tenant
  - rol y capabilities del usuario
- el `dashboard` del SaaS es el punto de entrada donde el usuario ve los modulos a los que realmente tiene acceso

## Consecuencias tecnicas

- `saas_tenant_modules` sigue siendo la fuente oficial de modulos contratados
- las rutas de modulo siguen protegidas por autenticacion, modulo habilitado y capability
- el sistema debe tolerar que usuarios del mismo tenant tengan accesos distintos
