# Bitacora activa

Fecha de actualizacion: 2026-05-06

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
- modulo oficial estable:
  - `camiones`
- modulo piloto activo:
  - `neon`

## Mini cierre Neon - piloto cliente

Durante esta jornada se dejo `neon` en un corte de validacion con cliente.

### Objetivo del corte

No endurecer aun la arquitectura final.

Si dejar:

- flujo diario entendible
- centros de costo reconocibles
- reportes suficientes para que el cliente diga si el camino es correcto

### Lo que quedo alineado

- `libro diario` como nucleo real del modulo
- `cuentas` como origen o destino del dinero
- `credito` con tarjeta y vencimiento
- asignacion de un movimiento a multiples centros de costo
- `actividades` tratadas como destino comercial posible, no como eje contable
- `alquileres` separados de actividades
- primera lectura de reportes por:
  - cuentas
  - deuda
  - centros de costo
  - actividades
  - vehiculos

### Criterio de este cierre

Se priorizo:

- funcionalidad usable
- lenguaje parecido al del cliente
- base de prueba

Se postergo a proposito:

- cierres estructurales definitivos
- catalogos formales fuertes
- limpieza final de legacy

## Estado recomendado para manana

Manana se puede retomar desde este punto:

1. escuchar devolucion del cliente
2. confirmar si el flujo diario refleja su Excel real
3. detectar que centros o reportes faltan
4. recien despues endurecer codigo y modelo

## Regla de crecimiento vigente

1. sostener `camiones`
2. mantener sano el core SaaS
3. usar `neon` como piloto controlado hasta validacion final
4. endurecer solo cuando el cliente confirme direccion
