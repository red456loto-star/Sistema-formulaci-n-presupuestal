
# Fase 2 corregida — Empresas y estructura presupuestal sin login

## Objetivo

Preparar las tablas maestras y la estructura necesaria para los presupuestos, respetando el alcance del PDF y eliminando totalmente la autenticación añadida anteriormente.

## Acceso directo

Al abrir el ejecutable se muestra inmediatamente el panel principal.

Se eliminaron del flujo y de la base de datos:

- Pantalla de login.
- Usuarios.
- Roles.
- Permisos.
- Contraseñas.
- Sesiones.
- Tokens.
- Rutas `/api/auth/*`, `/api/users` y `/api/roles`.
- Menú “Usuarios y roles”.
- Botón “Cerrar sesión”.
- Restricciones por permisos.

## Funciones de la fase

- Empresas.
- Sedes.
- Responsables con cargo, correo y teléfono.
- Centros de actividad con responsable obligatorio.
- Grupos presupuestales.
- Elementos presupuestales.
- Cuentas presupuestales.
- Jerarquía integral:

```text
Empresa
└── Sede
    └── Centro de actividad
        └── Grupo presupuestal
            └── Elemento presupuestal
                └── Cuenta presupuestal
```

- Monedas.
- Tipos de cambio.
- Unidades de medida.
- Códigos normalizados en mayúsculas.
- Validaciones de duplicidad y pertenencia empresarial.
- Persistencia local con SQLite.

## Compatibilidad de base de datos

La migración 3 transforma una base creada por la versión anterior:

- Conserva empresas, responsables, centros y estructura.
- Conserva eventos técnicos sin asociarlos a usuarios.
- Elimina tablas antiguas de usuarios, roles, permisos y sesiones.
- Declara el modo `directo_sin_login`.

## API

Todas las rutas funcionales trabajan localmente sin encabezado `Authorization`.

Principales rutas:

- `/api/catalog/empresas`
- `/api/catalog/sedes`
- `/api/catalog/responsables`
- `/api/catalog/centros`
- `/api/catalog/grupos`
- `/api/catalog/elementos`
- `/api/catalog/cuentas`
- `/api/catalog/monedas`
- `/api/catalog/tipos-cambio`
- `/api/catalog/unidades`
- `/api/organization/hierarchy`

## Pruebas

Las pruebas confirman:

- Acceso directo sin login.
- Rutas de autenticación inexistentes.
- Tablas de autenticación eliminadas.
- API utilizable sin token.
- Creación de empresa, sede, responsable, centro, grupo, elemento y cuenta.
- Responsable obligatorio.
- Jerarquía de seis niveles.
- Rechazo de duplicados.
- Respaldo técnico y persistencia SQLite.

Comando:

```bash
npm run verify
```

## Límite de alcance

Todavía no se implementan periodos, versiones, importación Excel, presupuesto original, forecast, presupuesto maestro, estados financieros, análisis, dashboard, reportes, propuestas ni correo. Corresponden a fases posteriores.
