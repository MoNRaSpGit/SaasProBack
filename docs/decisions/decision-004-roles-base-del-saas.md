# Decision 004 - Roles base del SaaS

Fecha: 2026-05-02
Estado: aprobada

## Objetivo

Definir la jerarquia simple de roles para esta etapa del SaaS.

## Roles oficiales

- `staff`
- `admin`
- `operario`

## Decision

- `staff` tiene acceso total al SaaS
- `admin` es el rol completo del cliente dentro de su tenant
- `operario` es el rol de trabajo operativo con permisos mas limitados
- no se inventan roles extra por ahora

## Consecuencias tecnicas

- las capabilities deben mapearse sobre esta jerarquia
- `admin` hereda capacidades operativas del `operario`
- `staff` conserva acceso total
