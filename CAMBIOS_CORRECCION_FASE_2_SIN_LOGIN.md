# Cambios aplicados — Corrección Fase 2 sin login

## Eliminado

- Pantalla y ruta de inicio de sesión.
- Contexto de autenticación de React.
- Menú de usuarios y roles.
- Página de usuarios, roles y contraseña.
- Nombre de usuario, rol y cerrar sesión en la barra superior.
- Encabezado Bearer y almacenamiento de tokens.
- Middleware de autenticación.
- Endpoints de autenticación, usuarios y roles.
- Restricciones por permisos en frontend y backend.
- Tablas `users`, `roles`, `permissions`, `sessions`, `user_roles` y `role_permissions` mediante migración segura.

## Conservado

- Empresas.
- Sedes.
- Responsables.
- Centros de actividad.
- Grupos, elementos y cuentas presupuestales.
- Jerarquía integral.
- Monedas, tipos de cambio y unidades.
- SQLite y persistencia local.
- Electron.
- GitHub Actions.

## Comportamiento nuevo

- El ejecutable abre directamente el panel principal.
- La API local funciona sin token.
- Los responsables son registros empresariales y no cuentas de acceso.
- La versión del proyecto pasa a `0.2.1`.

## Verificación realizada

- `npm run typecheck`: aprobado.
- Pruebas de integración: 2 de 2 aprobadas.
- Build frontend: aprobado.
- Build API: aprobado.
- Build Electron: aprobado.
- `npm run verify`: aprobado.
- Migración desde una base de Fase 2 anterior: aprobada, conservando empresa y centro y eliminando tablas de autenticación.
