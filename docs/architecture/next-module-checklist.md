# Siguiente modulo - Checklist de nacimiento

Fecha de actualizacion: 2026-05-16

## Objetivo

Sumar un modulo nuevo sin romper los productos activos ni ensuciar la arquitectura vigente.

## Condicion para empezar

Un modulo nuevo se empieza solo si:

- `neon` y `agro` siguen sanos en su estado actual
- el backend sigue sano
- la necesidad comercial del modulo esta clara

## Paso 1 - Definir producto

Antes de escribir codigo:

- nombre del modulo
- problema exacto que resuelve
- usuario principal
- flujo minimo vendible
- decision de frontend propio

## Paso 2 - Backend

Crear en `src/modules/<modulo>`:

- `<modulo>.module.ts`
- `<modulo>.controller.ts`
- `<modulo>.service.ts`
- `<modulo>.types.ts`
- `dto/`

Ademas:

- migracion SQL nueva
- tablas nuevas con prefijo `saas_`
- `tenant_id` en toda tabla de negocio
- guard de modulo sobre helper shared si aplica
- capabilities nuevas si hacen falta
- registrar el producto en `src/shared/saas/product-catalog.ts`

## Paso 3 - SaaS core

Confirmar:

- `saas-admin` puede habilitar el modulo si corresponde
- auth devuelve bien `modules`, `products` y `preferredFrontend`
- el modulo respeta tenant, permisos y billing

## Paso 4 - Frontend nuevo

Crear frontend propio:

- `frontend-<modulo>`
- `frontend-<modulo>/docs`

Base minima:

- auth
- config API
- rutas
- features propias
- shared minimo
- documentacion particular del modulo

No agregar el modulo nuevo dentro de otro frontend activo.

## Paso 5 - Documentacion

Antes de considerar oficial el modulo:

- actualizar `backend/docs/architecture/product-scope.md` si pasa a producto activo
- actualizar `backend/docs/operations/backend-inventory.md`
- actualizar `backend/docs/operations/database-state.md`
- registrar el cambio en `backend/docs/operations/bitacora.md`
- crear o actualizar la documentacion del frontend del modulo

## Paso 6 - Validacion

Antes de subir:

- cerrar `PF`
- correr validaciones tecnicas aplicables
- revisar contratos, auth y base
- confirmar que el modulo entra limpio al corte estable

## Regla final

La meta no es meter modulos rapido.

La meta es que cada modulo entre:

- limpio
- desacoplado
- vendible
- documentado
- sin romper los productos ya vivos
