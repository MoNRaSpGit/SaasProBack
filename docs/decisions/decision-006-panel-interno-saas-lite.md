# Decision 006 - Panel interno SaaS Lite

Fecha: 2026-05-02
Estado: aprobada

## Objetivo

Definir el alcance inicial del panel interno de `SaasPro`.

## Decision

- el primer panel interno del SaaS es `SaaS Admin Lite`
- su foco es control operativo sobre tenants reales
- la prioridad inicial es ver clientes, modulos habilitados y estado de cobro

## Consecuencias tecnicas

- el panel es una capacidad del SaaS orientada a `staff`
- consume el core ya existente de tenants, memberships, modules, settings y billing
- no introduce una arquitectura paralela
