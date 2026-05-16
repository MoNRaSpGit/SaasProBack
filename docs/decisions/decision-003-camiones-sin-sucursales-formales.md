# Decision 003 - Camiones sin sucursales formales

Fecha: 2026-05-02
Estado: aprobada

## Objetivo

Definir si `camiones` depende de sucursales reales en esta etapa del SaaS.

## Decision

- `camiones` no depende de sucursales reales por ahora
- el flujo operativo del modelo no exige gestion formal de `branches`
- si el cliente necesita distinguir un lugar, lo hace con un nombre libre y humano

## Consecuencias tecnicas

- `branch_id` puede seguir existiendo como campo opcional preparado
- `camiones` no lo usa como requisito funcional
- la UI de `camiones` no debe obligar a elegir sucursal
