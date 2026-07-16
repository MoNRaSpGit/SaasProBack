# Plataforma y reglas base

Fecha de actualizacion: 2026-05-16

## Objetivo

Definir la estructura oficial del backend de `SaasPro` para crecer sin ruido.

## Foto actual

- `backend` = nucleo unico del SaaS
- `frontend-neon` = frontend activo de `neon`
- `frontend-agro` = frontend activo de `agro`
- `neon` y `agro` = productos activos documentados en este corte

## Regla de arquitectura

- un solo backend SaaS
- una sola base de datos, con tablas propias por modulo (`saas_<modulo>_*`)
- un frontend dedicado por cliente o variante real (no un frontend generico reusado)
- los frontends se construyen por capas separadas cuando el modulo ya tiene complejidad real
- cada repo mantiene su propia carpeta `docs/`
- `backend/docs` conserva la documentacion estructural y operativa del backend

## Dos patrones de producto conviven hoy

Ver [decision-008](../decisions/decision-008-frontend-dedicado-sin-tenant-para-productos-nuevos.md)
para el detalle completo. Resumen:

- **Patron legacy (multi-tenant compartido)**: `agro`, `neon`, `alamcen`, `camiones`,
  `saas-admin`. Login con JWT, `saas_tenants` / `saas_tenant_memberships` /
  `saas_tenant_modules`, tablas de negocio con `tenant_id`. Pensado para que un mismo
  frontend sirva a varios clientes con datos aislados por fila. No se toca ni se migra.
- **Patron nuevo (frontend dedicado, sin tenant)**: `carnet`, `scrum`, `juez-auth`, y todo
  producto que se arme de aca en adelante. Un frontend por cliente o variante, tablas
  propias del modulo sin `tenant_id`, sin pasar por el login/tenant compartido. El
  aislamiento de datos es por tabla, no por fila.

Todo modulo nuevo sigue el patron dedicado salvo decision explicita en contrario.

## Regla de frontend por capas

Cuando un frontend deja de ser una pantalla minima o entra en flujo operativo real, no se resuelve como una sola pagina gigante.

Regla esperada:

- tipos por un lado
- datos mock o catálogos por un lado
- logica o estado por un lado
- componentes visuales por un lado
- estilos globales solo para lo verdaderamente global
- estilos del modulo o feature en archivos separados

Evitar:

- una sola pagina con demasiadas lineas mezclando todo
- logica, UI y estilos del modulo apretados en un mismo archivo
- meter estilos de feature dentro de `global.css` si no son globales

## Responsabilidades del backend

El backend concentra:

- auth
- tenant context
- permisos y capabilities
- billing core
- reglas de negocio compartidas
- contratos API
- persistencia y migraciones

## Nucleo compartido obligatorio

Todo modulo actual o futuro se apoya en:

- `saas_tenants`
- `saas_tenant_memberships`
- `saas_tenant_modules`
- `saas_tenant_settings`
- `saas_branches`
- `saasPro_users`
- `saasPro_refresh_tokens`

## Reglas de base

- toda tabla nueva del SaaS usa prefijo `saas_`
- las tablas legacy ajenas al SaaS no se tocan
- toda tabla de negocio nueva debe incluir `tenant_id`
- toda logica de negocio importante vive primero en backend

## Auth y contexto

Auth devuelve:

- `tenantContext.modules`
- `tenantContext.products`
- `tenantContext.preferredFrontend`
- `tenantContext.billing`

## Roles base

Jerarquia vigente:

- `staff`
- `admin`
- `operario`

Regla actual:

- `staff` conserva control total del SaaS
- `admin` opera y administra su tenant
- `operario` opera con permisos mas limitados

## Billing

Estados vigentes:

- `active`
- `grace_period`
- `pending_manual_block`
- `blocked`

Regla actual:

- aviso
- gracia de 5 dias
- decision final manual

## Documentacion relacionada

- metodo de trabajo: [work-method.md](./work-method.md)
- PF: [pf-checklist.md](./pf-checklist.md)
- alcance oficial del producto: [product-scope.md](./product-scope.md)
- pivot a frontend dedicado sin tenant: [decision-008](../decisions/decision-008-frontend-dedicado-sin-tenant-para-productos-nuevos.md)

## Fuente de verdad actual

Cuando haya dudas sobre el estado real:

- manda el backend
- manda `backend/docs`
- manda la carpeta `docs/` del frontend involucrado para cambios propios de ese frontend
- manda la base de datos actual del SaaS
