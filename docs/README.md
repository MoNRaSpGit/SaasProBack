# SaasPro Backend Docs

Fecha de actualizacion: 2026-05-16

## Objetivo

Esta carpeta documenta el backend oficial de `SaasPro`.

Su funcion es dejar claro:

- que es el backend dentro del SaaS
- como esta organizada la arquitectura
- como se trabaja en este repo
- que significa cerrar un cambio con `PF`
- cual es el estado operativo actual del backend
- que decisiones tecnicas siguen vigentes

## Alcance

`backend/docs` documenta solo backend.

Entra aca informacion sobre:

- arquitectura SaaS compartida
- auth, tenant context, permisos y billing
- endpoints y contratos API
- reglas de negocio del backend
- migraciones y estado de base de datos
- metodo de trabajo y criterio de cierre
- cambios reales hechos en el backend

No entra aca informacion sobre:

- CSS
- componentes visuales
- layout
- copy de pantalla
- UX particular de un frontend
- cambios finos de producto que viven solo en un frontend

Eso se documenta en la carpeta `docs/` del frontend correspondiente.

## Orden recomendado de lectura

1. [Plataforma y reglas base](./architecture/platform-overview.md)
2. [Alcance oficial del producto](./architecture/product-scope.md)
3. [Metodo de trabajo](./architecture/work-method.md)
4. [PF - Pasos finales obligatorios](./architecture/pf-checklist.md)
5. [Ramas, releases y cortes estables](./architecture/branching-and-releases.md)
6. [Checklist para el siguiente modulo](./architecture/next-module-checklist.md)
7. [Inventario operativo del backend](./operations/backend-inventory.md)
8. [Estado actual de base de datos](./operations/database-state.md)
9. [Bitacora activa](./operations/bitacora.md)
10. [Deuda tecnica / ruido detectado en el repo](./operations/deuda-tecnica-repo.md)
11. [Indice de decisiones tecnicas](./decisions/README.md)

## Estructura de esta carpeta

### `architecture/`

Reglas duraderas del backend:

- arquitectura general
- alcance del producto
- metodo de trabajo
- `PF`
- ramas y releases
- nacimiento de modulos nuevos

### `operations/`

Estado operativo del backend:

- inventario del repo
- estado real de base de datos
- bitacora de cambios del backend
- deuda tecnica / ruido detectado en el repo (pendiente de revisar mas adelante)

### `decisions/`

Decisiones tecnicas que explican el porque de reglas todavia vigentes.

### `archive/`

Material historico o experimental que no forma parte de la foto oficial actual.

## Regla de lectura

Si hay contradiccion entre notas viejas y `backend/docs`:

- manda `backend/docs`

Si hay contradiccion entre una regla estructural y una nota de bitacora:

- manda arquitectura

Si el detalle es de un frontend puntual:

- manda la documentacion de ese frontend

## Estado actual resumido

- backend oficial activo: `backend`
- productos activos documentados: `agro`
- `frontend-agro` es el frontend activo de este corte
- `main` representa la linea estable oficial
- `neon` se dio de baja (codigo, tablas y `frontend-neon` eliminados) el 2026-08-11 por falta de uso real; ver `operations/deuda-tecnica-repo.md`

## Documentacion por frontend

- `agro`: `frontend-agro/docs`
