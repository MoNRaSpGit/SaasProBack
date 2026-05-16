# Decision 001 - Gobierno de modulos por tenant

Fecha: 2026-05-02
Estado: aprobada

## Objetivo

Definir quien habilita modulos, como entra el cliente al SaaS y que experiencia base debe tener un tenant cuando usa uno o varios productos.

## Decision

- la habilitacion de modulos por tenant no es autogestionada por el cliente
- la habilitacion de modulos la hace `SaasPro` de forma administrada
- un tenant puede tener cero, uno o varios modulos habilitados
- el login del cliente debe llevar al `dashboard` del SaaS
- el `dashboard` muestra unicamente los modulos habilitados para ese tenant
- desde el `dashboard`, el cliente elige a que modulo entrar

## Consecuencias tecnicas

- `register` no asigna modulos por defecto
- el frontend no asume redirect directo al unico modulo
- el `dashboard` es el punto de entrada oficial del usuario autenticado
- toda ruta de modulo sigue protegida por autenticacion, modulo habilitado y capability cuando corresponda
