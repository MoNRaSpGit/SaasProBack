# Ramas, releases y cortes estables

Fecha de actualizacion: 2026-05-16

## Regla simple

- `main` = linea estable oficial
- el trabajo nuevo sale desde una rama aparte
- una rama vuelve a `main` solo cuando pasa `PF`

## Flujo recomendado

1. partir desde `main`
2. crear rama nueva para la mejora
3. trabajar ahi
4. cerrar `PF`
5. integrar a `main`
6. `push` y `deploy` solo desde version validada

## Que significa estable

Una version estable es una que:

- tiene codigo limpio
- paso las validaciones tecnicas que aplican
- no deja deuda evitable
- tiene documentacion al dia
- representa un corte entendible del sistema

## Relacion con PF

`PF` es el criterio formal de cierre antes de subir cambios.

La checklist obligatoria vive en [pf-checklist.md](./pf-checklist.md).

La regla operativa es:

- sin `PF`, no hay `push`
- sin `PF`, no hay `deploy`

## Regla de ramas

Para cambios nuevos en productos activos:

- crear rama corta y descriptiva

Ejemplos:

- `feat/neon-libro-diario-filtros`
- `fix/agro-tabla-scroll`
- `refactor/agro-home-sections`

Para un producto nuevo:

- `feat/nuevo-modulo-base`

## Regla final

`main` no se usa como espacio de prueba.

`main` representa la mejor base oficial disponible.
