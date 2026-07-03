# Fase 2 — Usuarios, roles, empresas y estructura presupuestal

## Objetivo

Implementar la seguridad local, la estructura organizacional y la jerarquía presupuestal base de PresuControl Empresarial, sin adelantar ejercicios, versiones, formulación, forecast ni cálculos financieros.

## Funcionalidades implementadas

### Autenticación local

- Inicio y cierre de sesión.
- Contraseñas protegidas con `scrypt` y salt individual.
- Sesiones locales con token y vencimiento.
- Cambio de contraseña.
- Bloqueo de usuarios y empresas inactivas.
- Clave temporal y cambio obligatorio para usuarios nuevos.

### Usuarios, roles y permisos

Roles disponibles:

1. Administrador.
2. Analista de presupuestos.
3. Responsable de centro.
4. Revisor.
5. Aprobador.
6. Consulta.

Permisos por módulo y acción:

- Leer.
- Crear.
- Editar.
- Eliminar o desactivar.

Módulos protegidos:

- Usuarios.
- Empresas.
- Estructura.
- Parámetros.
- Auditoría.
- Sistema y mantenimiento local.

Controles adicionales:

- Validación de roles activos.
- Protección contra autodesactivación y retiro de roles propios.
- Protección del último administrador activo.
- Respaldo y restauración limitados por permisos.

### Empresas y organización

- Empresas.
- Sedes o localizaciones.
- Responsables.
- Centros de actividad.
- Responsable y correo obligatorios por centro.
- Estados activo e inactivo.
- Códigos únicos y normalizados en mayúsculas.
- Selector de empresa activa.
- Validación de pertenencia a la misma empresa.

### Estructura presupuestal

- Grupos presupuestales.
- Elementos presupuestales.
- Cuentas presupuestales.
- Naturalezas: ingreso, costo, gasto, activo, pasivo y patrimonio.
- Tipo de movimiento: detalle o acumuladora.
- Relación automática entre centros y cuentas mediante `center_accounts`.

La jerarquía integral es:

```text
Empresa
└── Sede
    └── Centro de actividad
        └── Grupo presupuestal
            └── Elemento presupuestal
                └── Cuenta presupuestal
```

En fases posteriores cada línea presupuestal incorporará además ejercicio, periodo y versión.

### Parámetros transversales

- Monedas.
- Tipos de cambio.
- Unidades de medida.
- Validación de fechas con formato `AAAA-MM-DD`.
- Validación de moneda activa.

### Separación por empresa

- Los usuarios no administradores solo consultan su empresa asignada.
- Las rutas validan que los identificadores relacionados pertenezcan a la empresa activa.
- Los vínculos centro-cuenta se mantienen dentro de la misma empresa.
- La jerarquía solo devuelve registros activos de la empresa seleccionada.

### Auditoría

Se registran eventos de creación, modificación, desactivación y cambio de contraseña. Cada evento conserva usuario, empresa, acción, entidad, identificador, descripción, valores anteriores, valores posteriores y fecha.

## Base de datos

La migración de Fase 2 contiene:

- `currencies`
- `exchange_rates`
- `units_of_measure`
- `companies`
- `sites`
- `responsibles`
- `roles`
- `permissions`
- `role_permissions`
- `users`
- `user_roles`
- `sessions`
- `activity_centers`
- `budget_groups`
- `budget_elements`
- `budget_accounts`
- `center_accounts`
- `audit_events`

Se utilizan claves foráneas, restricciones únicas, validaciones `CHECK` e índices por empresa y jerarquía.

## API principal

### Autenticación

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`

### Usuarios y seguridad

- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `DELETE /api/users/:id`
- `GET /api/roles`
- `GET /api/permissions`

### Catálogos

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

### Jerarquía, auditoría y sistema

- `GET /api/organization/hierarchy`
- `GET /api/audit`
- `GET /api/system/database-status`
- `POST /api/system/backup`
- `POST /api/system/restore-latest`

## Interfaz

- Pantalla de inicio de sesión.
- Selector de empresa activa.
- Usuarios, roles y permisos.
- Empresas, sedes y responsables.
- Centros, grupos, elementos y cuentas.
- Árbol integral de seis niveles.
- Breadcrumbs de contexto.
- Búsqueda transversal en las tablas.
- Parámetros y auditoría.
- Estado de SQLite, respaldo y restauración según permisos.
- Mensajes claros para usuarios no técnicos.

La interfaz conserva el menú lateral, barra superior, tarjetas, pestañas y tablas amplias, sin ventanas superpuestas.

## Datos demostrativos

Los datos incluidos en el seed son sintéticos y están identificados como demostrativos. No deben interpretarse como información oficial de una empresa real.

## Pruebas automatizadas

Las pruebas verifican:

- Inicio de API y SQLite.
- Inicio de sesión y permisos.
- Creación de empresa y rechazo de duplicados.
- Normalización de códigos.
- Creación de sede y responsable.
- Rechazo de centros sin responsable.
- Creación de centro, grupo, elemento y cuenta.
- Árbol completo de seis niveles.
- Usuario de consulta y denegación de escritura.
- Denegación de respaldo sin permiso.
- Auditoría y respaldo de SQLite.

Comando de verificación:

```bash
npm run verify
```

Este comando ejecuta typecheck, pruebas y build completo. GitHub Actions genera además el ejecutable portátil de Windows.

## Criterios de aceptación cubiertos

- Se crean empresas y usuarios.
- Los permisos funcionan.
- La jerarquía completa se visualiza correctamente.
- No se mezclan datos entre empresas.
- Todos los centros tienen responsable y correo.
- Existen búsquedas en las tablas.
- Funcionan estados activo e inactivo.
- Funcionan validaciones de duplicidad.
- La auditoría registra operaciones.
- SQLite, Electron y el flujo de build se mantienen.

## Fuera del alcance

No se implementan todavía ejercicios, periodos, versiones, aprobaciones presupuestales, importación Excel, presupuesto original, forecast, presupuesto maestro, estados financieros, análisis, dashboards ni reportes finales.
