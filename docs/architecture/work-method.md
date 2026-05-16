# Metodo de trabajo del backend

Fecha de actualizacion: 2026-05-16

## Objetivo

Definir como se trabaja en `backend` para mantener una base SaaS clara, sana y documentada.

## Alcance

Este documento aplica al repo `backend`.

No reemplaza:

- la documentacion de cada frontend
- las decisiones tecnicas historicas
- la bitacora operativa del backend

## Principios de trabajo

- `backend` es el nucleo unico del SaaS
- la logica estructural vive primero en backend
- el frontend no define reglas de negocio compartidas
- cada cambio debe dejar el sistema mas claro, no mas confuso
- la documentacion forma parte del trabajo terminado

## Regla backend vs frontend

Se documenta en `backend/docs` si el cambio afecta:

- endpoints
- contratos API
- auth
- guards
- capabilities
- billing
- base de datos
- migraciones
- reglas de negocio del backend
- estructura SaaS compartida

No se documenta en `backend/docs` si el cambio afecta solo:

- CSS
- layout
- componentes visuales
- copy
- navegacion visual
- UX especifica de un frontend

Eso va en la carpeta `docs/` del frontend correspondiente.

## Regla de arquitectura

- un solo backend SaaS multi-tenant
- un frontend por producto cuando el modulo madura
- no se crean frontends por cliente individual
- toda tabla nueva del SaaS usa prefijo `saas_`
- toda tabla de negocio nueva incluye `tenant_id`
- las tablas legacy ajenas al SaaS no se tocan
- todo modulo nuevo nace sobre el core actual

## Regla de modulos nuevos

Un modulo nuevo entra limpio sobre la arquitectura vigente.

Eso implica:

- backend primero
- migracion propia
- contrato claro
- tenant, permisos y billing respetados
- frontend propio cuando el modulo madura
- documentacion propia del frontend si corresponde

La guia operativa vive en [next-module-checklist.md](./next-module-checklist.md).

## Regla de cambios experimentales

- un experimento no se presenta como producto oficial
- si queda descartado, va a archivo
- si madura, se documenta como producto activo solo cuando el corte oficial lo confirme
- los experimentos no deben ensuciar la foto oficial del SaaS

## Regla documental

- la documentacion no es opcional
- si cambia una regla permanente, se actualiza `architecture/`
- si cambia la base, se actualiza `operations/database-state.md`
- si cambia el mapa operativo del repo, se actualiza `operations/backend-inventory.md`
- si se hizo un cambio real de backend, se actualiza `operations/bitacora.md`
- si la decision es duradera, se registra o ajusta en `decisions/`
- no se deja documentacion relevante para despues

## Regla de calidad minima

Antes de cerrar un cambio:

- no debe quedar codigo basura
- no debe quedar ruido tecnico innecesario
- no deben quedar archivos temporales sin sentido
- DTO, service, controller, tipos y contrato deben seguir alineados
- las validaciones tecnicas que apliquen deben quedar sanas

## Definicion de trabajo terminado

Un cambio no esta terminado cuando solo "parece funcionar".

Un cambio esta terminado cuando:

- funciona
- no deja deuda evitable
- respeta la arquitectura
- queda documentado
- pasa `PF` completo

## PF

`PF` significa `Pasos Finales`.

`PF` es obligatorio antes de subir cambios al repo.

La checklist formal vive en [pf-checklist.md](./pf-checklist.md).

## Regla previa a subir al repo

Antes de `push` o `deploy`:

- se revisa `git diff`
- se revisa `git status`
- se confirma que el cambio pertenece a este repo
- se confirma que la documentacion quedo al dia
- se confirma que `PF` realmente cerro

Sin `PF` completo, el cambio no esta listo para subir.

## Regla de interpretacion operativa

Cuando se diga `subilo` o `subi`:

- si `PF` ya cerro, se interpreta como `push` y `deploy` cuando corresponda
- si el repo o modulo no tiene deploy aplicable en ese corte, se hace solo `push`
- si `PF` no cerro, no se sube ni se despliega
