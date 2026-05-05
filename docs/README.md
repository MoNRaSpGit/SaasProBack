# SaasPro Backend Docs

Fecha de actualizacion: 2026-05-05

## Fuente oficial

Esta carpeta es la fuente oficial de documentacion del SaaS.

La regla actual es:

- la documentacion estructural vive en `backend/docs`
- cada frontend de producto mantiene su propia carpeta `docs/`
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

### Producto

- [Camiones](./products/camiones.md)
- [Neon](./products/neon.md)

### Archivo

- [Modulos experimentales archivados](./archive/experimental-modules.md)

## Regla de lectura

Si hay contradiccion entre un documento historico y esta carpeta:

- manda `backend/docs`

## Estado actual resumido

- producto oficial activo: `camiones`
- frontend oficial activo: `frontend-camiones`
- backend oficial activo: este repo
- `frontend-neon` existe como modulo en incubacion, con shell publicado y documentacion propia
- `main` representa la linea estable oficial
