# Ramas, releases y forma de trabajo

Fecha de actualizacion: 2026-05-08

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

Regla adicional:

- si el modulo afectado todavia no tiene rondas de test, se crean antes de considerar PF valido

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

Para cambios nuevos en productos activos:

- crear rama corta y descriptiva

Ejemplos:

- `feat/neon-libro-diario-filtros`
- `fix/agro-tabla-scroll`
- `refactor/agro-home-sections`

Para un producto nuevo:

- `feat/nuevo-modulo-base`

La regla sigue siendo la misma:

- nunca ensuciar `main`
