# Producto - Agro

Fecha de actualizacion: 2026-05-06

## Norte funcional vigente

`agro` se interpreta hoy como un producto nuevo con dos bloques conceptuales:

- stock animal
- contabilidad operativa

Pero en esta etapa backend todavia no se endurece ese modelo.

## Alcance backend real hoy

El backend de `agro` arranca con un alcance chico y deliberado:

- `GET /api/v1/agro/status`
- `GET /api/v1/agro/discovery/latest`
- `POST /api/v1/agro/discovery`

## Objetivo del primer corte

La primera pieza real a persistir no es stock ni contabilidad.

Es `discovery`.

La idea es guardar por tenant las respuestas del cliente a preguntas de definicion funcional para usar eso como base del modulo real.

## Capacidades activas

- `agro.shell.read`
- `agro.discovery.read`
- `agro.discovery.write`

## Tabla inicial del modulo

La primera tabla propia del bloque es:

- `saas_agro_discovery_responses`

Reglas:

- prefijo `saas_`
- `tenant_id` obligatorio
- `answers_json` como almacenamiento flexible del discovery temprano

## Migracion inicial

- `015_saas_agro_discovery.sql`

## Lo que deliberadamente no se cierra todavia

En este corte no se cierran aun:

- entidades de establecimientos
- entidades de campos
- stock animal definitivo
- plan contable definitivo
- reportes oficiales

## Lectura correcta de este estado

`agro` ya existe tecnicamente en backend, pero todavia no como modulo funcional cerrado.

Su valor actual es:

- dejar el cascaron oficial creado
- habilitar auth y capabilities
- persistir discovery por tenant
- permitir que el siguiente bloque nazca sobre base limpia
