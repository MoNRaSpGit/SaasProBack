# Ramas, releases y forma de trabajo

Fecha de actualizacion: 2026-05-11

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

## Que incluye PF

`PF` significa `Pasos Finales`.

No es solo correr tests.

PF incluye, como minimo:

- revisar que no quede codigo basura
- revisar que no quede codigo legacy o ruido tecnico innecesario
- `typecheck`
- `lint`
- tests del area afectada
- `build`
- validacion real cuando aplica
- documentacion actualizada

## Orden esperado de PF

El orden practico esperado es:

1. limpiar ruido tecnico o codigo suelto
2. correr validaciones tecnicas
3. confirmar que la feature o fix funciona
4. actualizar documentacion del backend o del modulo afectado
5. recien despues hacer `push`
6. recien despues hacer `deploy`

La documentacion forma parte de PF.

No se considera PF cerrado si falta documentar el cambio relevante.

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
