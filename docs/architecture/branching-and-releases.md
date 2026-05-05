# Ramas, releases y forma de trabajo

Fecha de actualizacion: 2026-05-05

## Regla simple

- `main` = linea estable oficial
- el trabajo nuevo sale desde una rama aparte
- cuando una rama pasa PF y queda sana, vuelve a `main`

## Flujo recomendado

1. partir desde `main`
2. crear rama nueva para la mejora
3. trabajar ahi
4. correr PF completo
5. si todo da `OK`, integrar a `main`
6. `push` y `deploy` solo desde version validada

## Que significa estable

Una version estable es una que tiene:

- codigo limpio
- `typecheck` OK
- `lint` OK
- `test:smoke` OK
- test funcional del area afectada OK
- `build` OK
- validacion real cuando aplica

## PF vigente

Cuando se diga `subi`, la regla es:

- `push`
- `deploy`

pero solo si el PF paso completo.

## Versiones practicas

No hace falta pensar cada cambio como `2.0`, `3.0`, etc.

Lo importante es esto:

- `main` siempre representa la mejor base oficial disponible
- cada mejora fuerte se desarrolla en rama
- cuando esa rama queda sana, se promueve a `main`

## Rama actual recomendada para el futuro

Para cambios nuevos en `camiones`:

- crear rama corta y descriptiva

Ejemplos:

- `feat/camiones-registro-filtros`
- `fix/camiones-mobile-scroll`
- `refactor/camiones-form-flow`

Para el siguiente producto:

- `feat/nuevo-modulo-base`

La regla sigue siendo la misma:

- nunca ensuciar `main`
