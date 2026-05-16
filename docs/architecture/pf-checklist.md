# PF - Pasos finales obligatorios

Fecha de actualizacion: 2026-05-16

## Objetivo

Definir el cierre obligatorio de un cambio antes de subirlo al repo.

## Regla general

Cuando se diga `hacer PF`, significa completar todos los bloques que apliquen.

Si falta un bloque relevante:

- `PF` no esta cerrado

La documentacion forma parte obligatoria de `PF`.

## Bloque 1 - Validacion funcional

- probar el flujo principal tocado
- probar el caso feliz
- revisar errores razonables
- revisar que no haya regresion visible en el comportamiento previo
- validar el contrato esperado si hubo cambio de endpoint

## Bloque 2 - Validacion tecnica

- correr `typecheck`
- correr `lint` si aplica
- correr `build` si aplica
- correr `test:smoke` si aplica
- correr el test funcional del area afectada si existe
- revisar logs, errores y warnings relevantes
- revisar imports sobrantes
- revisar codigo basura o ruido tecnico
- revisar hacks temporales o comentarios olvidados

## Bloque 3 - Validacion estructural

- confirmar que el cambio quedo en el repo correcto
- confirmar que no se mezclo documentacion de frontend dentro de backend
- revisar alineacion entre DTO, service, controller, tipos y respuesta
- revisar impacto en tenant, auth, roles, capabilities y billing si aplica
- revisar migraciones y scripts si hubo cambio de base
- confirmar que el cambio respeta la arquitectura SaaS vigente

## Bloque 4 - Validacion documental

- actualizar `operations/bitacora.md` si hubo cambio real de backend
- actualizar `operations/database-state.md` si cambio la estructura de datos
- actualizar `operations/backend-inventory.md` si cambio el mapa operativo del repo
- actualizar `architecture/` si cambio una regla permanente
- actualizar `decisions/` si se tomo una decision duradera
- confirmar que cada cambio quedo documentado en el lugar correcto

## Bloque 5 - Validacion final de repo

- revisar `git diff`
- revisar `git status`
- revisar que no queden archivos temporales o basura
- revisar que no se suba trabajo mezclado
- confirmar que el corte que va al repo es entendible y coherente

## Criterio de cierre

`PF` cerrado significa:

- cambio listo para subir

`PF` incompleto significa:

- cambio no listo para subir

## Regla de excepcion

Si un paso no aplica o no pudo correrse:

- se deja explicito

No se omite en silencio.

## Checklist rapida PF

- flujo principal validado
- regresiones revisadas
- `typecheck` OK
- `lint` OK si aplica
- `build` OK si aplica
- tests corridos o justificados
- sin codigo basura
- sin archivos temporales
- estructura alineada
- documentacion actualizada
- `git diff` revisado
- `git status` entendido
- listo para subir
