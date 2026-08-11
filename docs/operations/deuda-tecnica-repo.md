# Deuda tecnica / ruido detectado en el repo

Fecha de actualizacion: 2026-08-11

## Objetivo

Dejar anotado lo que se detecto en una revision generica del repo completo (no solo
`backend`), para volver mas adelante con tiempo y decidir que se arregla, que se archiva
y que se deja como esta. Nada de esto se toco todavia: es solo el registro de lo visto.

## Contexto

Revision pedida por el dueno del proyecto, a modo de "mirada generica" sin tocar codigo,
buscando ruido: carpetas grandes, proyectos sin uso, duplicacion, o cualquier detalle que
llame la atencion. Se dejo explicitamente para despues porque hay proyectos que capaz no
estan en uso y otras prioridades por delante.

## Hallazgos, de mayor a menor prioridad

### 1. El `.git` de la raiz de `SaasPro/` no es un repo funcional

`git status` en la raiz de `SaasPro/` tira `fatal: not a git repository`. Cada proyecto
(`backend`, cada `frontend-*`) tiene su propio git independiente; el `.git` de la raiz es
una carpeta sin uso real. Explica por que el `docs/` viejo de la raiz nunca se subio a
ningun lado (ver punto 5).

### 2. `front-web/` no tiene git en absoluto

Es el unico proyecto del workspace sin repo propio (ni siquiera roto: no existe `.git`).
Cero backup, cero historial. Es chico y esta "en incubacion" segun su propio README, pero
si se pierde el disco local, se pierde sin remedio.

### 3. Cinco frontends sin modulo de backend, sin commits hace semanas/meses

No tienen contraparte en `backend/src/modules`:

- `frontend-urreta` - ultimo commit hace ~3 meses
- `frontend-gym` - ultimo commit hace ~3 meses
- `frontend-lab` - ultimo commit hace ~6 semanas
- `frontend-restaurante` - ultimo commit hace ~6 semanas
- `frontend-presupuesto` - ultimo commit hace ~5 semanas

Falta confirmar si siguen vivos (prototipos en pausa) o si ya se pueden dar de baja /
archivar aparte para que no ensucien el panorama general.

### 4. `SaasPro/scripts/` (la de la raiz, no `backend/scripts/`) esta vacia

Carpeta fantasma, 0 archivos. Probable resabio de una convencion vieja que se mudo a
`backend/scripts/`.

### 5. `SaasPro/docs/` (la de la raiz) es la version vieja/abandonada

Convive con la real (`backend/docs/`, esta misma carpeta). La de la raiz no se toca desde
el 2026-07-01 y describe un SaaS distinto (habla de "camiones" como unico modulo oficial,
"LaClaudia" como referencia, etc.). Riesgo: alguien (yo en otra sesion, o alguien nuevo en
el equipo) puede leerla pensando que es la vigente. La regla ya esta escrita en
`backend/docs/README.md` ("si hay contradiccion, manda `backend/docs`"), pero la carpeta
vieja sigue ahi física y visualmente confundible.

### 6. `backend/scripts/` acumula scripts de un solo uso, todos commiteados, sin archivar

57 scripts a la fecha (`apply-*-migration.js`, `add-joker-*.js`, `create-*-user.js`, etc.).
Utiles en su momento, se van a seguir necesitando para migraciones futuras, pero no hay
ninguna carpeta `archive/` ni indice que separe "esto se va a volver a usar" de "esto ya
cumplio su funcion una sola vez". Con el tiempo se vuelve dificil encontrar el script
correcto a simple vista.

### 7. `tmp-LaClaudiaBackend` / `tmp-LaClaudiaFront`

El prefijo `tmp-` sugiere algo temporal, pero llevan desde 2026-06-27 con remoto propio
en GitHub (`LaClaudiaBackend` / `LaClaudiaFront`). Si el proyecto sigue activo, el nombre
engana (parece descartable); si ya no se usa, se puede dar de baja o mover fuera del
workspace principal.

### 8. Nota menor (no es ruido, al reves)

Los guards de autenticacion por modulo (`agro-auth.guard.ts`, `camiones-auth.guard.ts`,
`alamcen-auth.guard.ts`, `neon-auth.guard.ts`) estan prolijos: los cuatro son wrappers
finitos (~19 lineas) que reusan el helper compartido `authenticateModuleRequest`. La
unica pieza que rompe esa consistencia es el login de admin de `camisetas`
(`CamisetasAdminGuard`), que es un patron aparte (usuario/contrasena en texto plano,
tabla de sesiones propia) hecho a pedido explicito del cliente para modo de prueba. No es
un error, pero cuando se le agregue hash de contrasena (pendiente, ver bitacora), vale la
pena evaluar si conviene alinearlo al patron compartido o dejarlo separado a proposito.

## Resuelto (2026-08-11)

- **neon**: dado de baja completo (no estaba en la lista original de este documento, salio
  de una revision de actividad aparte). Motivo: sin uso real, ver la entrada del
  2026-08-11 en `operations/bitacora.md` para el detalle completo.
- **DB**: `productos_test`, `productos_test_backup`, `ops_producto`, `ops_producto_media`,
  `eco_desclasificados`, `eco_sesion`, `eco_scan_session_item`, `eco_caja_movimiento`,
  `saas_alamcen_products`, `saas_alamcen_sale_items` renombradas con prefijo `zzarchive_`
  como prueba en caliente antes del `DROP` final (alamcen quedo reemplazado por `piloto`,
  segun confirmo el dueno del proyecto).

## Que falta decidir (no hacer todavia)

- Confirmar si los 5 frontends huerfanos del punto 3 siguen vivos.
- Decidir si `tmp-LaClaudiaBackend/Front` se quedan, se renombran o se sacan del
  workspace.
- Decidir si vale la pena limpiar/archivar `SaasPro/docs/` y `SaasPro/scripts/` (raiz) o
  simplemente dejarlos y confiar en la regla de "manda `backend/docs`".
- Pensar una convencion de archivado para `backend/scripts/` antes de que crezca mas
  (¿carpeta `archive/` para migraciones ya aplicadas en produccion?).

## Documentacion relacionada

- inventario operativo del backend: `docs/operations/backend-inventory.md`
- bitacora activa: `docs/operations/bitacora.md`
