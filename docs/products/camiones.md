# Producto - Camiones

Fecha de actualizacion: 2026-05-05

## Estado

`camiones` es el unico producto oficial activo del SaaS.

## Backend

Tablas activas:

- `saas_camiones_clients`
- `saas_camiones_places`
- `saas_camiones_trips`

Endpoints activos:

- `GET /api/v1/camiones/clients`
- `POST /api/v1/camiones/clients`
- `PATCH /api/v1/camiones/clients/:id`
- `PATCH /api/v1/camiones/clients/:id/archive`
- `GET /api/v1/camiones/places`
- `POST /api/v1/camiones/places`
- `PATCH /api/v1/camiones/places/:id`
- `PATCH /api/v1/camiones/places/:id/archive`
- `GET /api/v1/camiones/trips`
- `POST /api/v1/camiones/trips`
- `PATCH /api/v1/camiones/trips/:id`
- `PATCH /api/v1/camiones/trips/:id/pay`

Reglas activas:

- `Bearer`
- tenant activo
- modulo `camiones` habilitado
- filtro por `tenant_id`

## Frontend

Ruta oficial:

- `/camiones`

Estado:

- flujo real validado en produccion
- clientes reales por tenant
- viajes reales por tenant
- pagos reales por tenant
- carga manual de localidades
- UX operativa ya bastante afinada

## Reglas de negocio actuales

- no exige sucursales formales
- prioriza velocidad operativa
- el usuario puede cargar viaje con localidades manuales

## Prioridades futuras naturales

- mas pulido UX
- mas comodidad en registro/pagos
- validaciones mas finas
- mejoras mobile

## Regla importante

Mientras `camiones` sea el unico producto activo:

- toda mejora nueva debe cuidar no ensuciar la base preparada para el proximo modulo
