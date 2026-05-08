# SaasPro Backend Docs

Fecha de actualizacion: 2026-05-08

## Fuente oficial

Esta carpeta es la fuente oficial de documentacion del SaaS.

La regla actual es:

- la documentacion estructural vive en `backend/docs`
- cada modulo mantiene su propia carpeta `docs/`
- la bitacora de "que hicimos hoy", "donde quedamos" y decisiones finas del modulo vive en la carpeta `docs/` de ese modulo
- la documentacion vieja fuera de este repo queda solo como referencia historica

## Mapa rapido

### Arquitectura

- [Plataforma y reglas base](./architecture/platform-overview.md)
- [Ramas, releases y forma de trabajo](./architecture/branching-and-releases.md)
- [Checklist para el siguiente modulo](./architecture/next-module-checklist.md)
- [Alcance oficial del producto](./architecture/product-scope.md)

### Operacion

- [Bitacora activa](./operations/bitacora.md)
- [Estado actual de base de datos](./operations/database-state.md)

### Archivo

- [Modulos experimentales archivados](./archive/experimental-modules.md)

## Regla de lectura

Si hay contradiccion entre un documento historico y esta carpeta:

- manda `backend/docs`

Si aparece informacion tipo:

- "hoy en agro agregamos un input"
- "en neon quedo pendiente tal ajuste"
- "el cliente pidio cambiar tal flujo"

esa informacion no va aca.

Va en la documentacion propia del modulo involucrado.

## Estado actual resumido

- productos activos: `neon` y `agro`
- backend oficial activo: este repo
- `frontend-neon` y `frontend-agro` son los frontends activos documentados en este corte
- `main` representa la linea estable oficial

## Docs por modulo

- `neon`: `frontend-neon/docs`
- `agro`: `frontend-agro/docs`
