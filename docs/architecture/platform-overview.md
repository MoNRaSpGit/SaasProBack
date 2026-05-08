# Plataforma y reglas base

Fecha de actualizacion: 2026-05-08

## Objetivo

Definir la estructura oficial del SaaS para seguir creciendo sin ruido.

## Foto actual

- `backend` = nucleo unico del SaaS
- `frontend-neon` = frontend activo del modulo `neon`
- `frontend-agro` = frontend activo del modulo `agro`
- `neon` y `agro` = productos activos en este corte

## Regla de arquitectura

- un solo backend SaaS multi-tenant
- un frontend por producto cuando un modulo madura
- no se crean frontends por cliente individual
- cada repo mantiene su propia carpeta `docs/`
- `backend/docs` conserva la documentacion estructural y compartida

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

- `admin` opera y administra
- `operario` opera con permisos mas limitados
- `staff` conserva control total del SaaS

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

## Fuente de verdad actual

Cuando haya dudas sobre el producto actual:

- el backend
- esta carpeta `backend/docs`
- la carpeta `docs/` del frontend del modulo involucrado
- la base de datos actual del SaaS

son la referencia oficial.
