# Decision 008 - Frontend dedicado sin tenant para productos nuevos

Fecha: 2026-07-16
Estado: aprobada

## Objetivo

Registrar el pivot real de arquitectura: por que dejamos de asumir que un mismo frontend
sirve a varios tenants, y que patron sigue todo producto nuevo de aca en adelante.

## Contexto

`decision-001` y `decision-007` describen el plan original: un backend SaaS multi-tenant,
con `saas_tenants` / `saas_tenant_memberships` / `saas_tenant_modules`, login con JWT,
`dashboard` de seleccion de modulo, y un frontend por producto compartido entre varios
clientes con los datos aislados por `tenant_id`.

En la practica, ningun cliente uso ese frontend compartido tal cual: cada cliente que
pidio algo parecido a "scrum" o similar termino necesitando funcionalidad distinta.
Mantener un solo frontend generico por producto para intentar cubrir a todos generaba
mas complejidad que valor.

## Decision

- se abandona la idea de un frontend generico reutilizado por multiples clientes
- todo producto nuevo se arma como frontend dedicado (`frontend-x1`, `frontend-x2`, etc.),
  uno por cliente o variante real
- el backend sigue siendo unico y la base de datos sigue siendo unica
- cada modulo nuevo usa sus propias tablas con prefijo `saas_<modulo>_*`, sin `tenant_id`
  y sin pasar por el sistema de login/tenant compartido
- el aislamiento de datos entre productos nuevos se logra por tabla propia, no por fila
  con `tenant_id`

## Que NO cambia

- `agro`, `neon`, `alamcen`, `camiones` y `saas-admin` siguen con el modelo de
  `decision-001` (multi-tenant, JWT, `tenant_id` por fila) exactamente como estan hoy
- no se migra su esquema ni sus datos a este modelo nuevo
- `decision-001` y `decision-007` siguen vigentes para esos modulos puntuales; esta
  decision no las deroga, acota su alcance a los modulos que ya las usan

## Consecuencias tecnicas

- todo modulo nuevo no requiere `saas-authz` ni tabla `tenant_id`
- todo modulo nuevo si necesita su propia migracion en `db/migrations/` (no bootstrap de
  esquema en el primer request; ver la falla que esto genero en `carnet`/`scrum`)
- cada modulo nuevo evalua por separado si necesita algun tipo de autenticacion propia
  (hoy `carnet`, `scrum` y `juez-auth` no tienen ninguna; queda como deuda a revisar
  caso por caso, no como parte de este pivot)
- `backend/docs/operations/backend-inventory.md` debe listar todos los modulos reales,
  marcando a cual de los dos patrones pertenece cada uno
