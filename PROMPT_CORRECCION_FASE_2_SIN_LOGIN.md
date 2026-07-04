# PROMPT DE CORRECCIÓN — FASE 2 SIN LOGIN

## Contexto

Proyecto: **Sistema Integral de Formulación, Control y Evaluación Presupuestal Empresarial**

Repositorio:

- `red456loto-star/Sistema-formulaci-n-presupuestal`
- `https://github.com/red456loto-star/Sistema-formulaci-n-presupuestal`

El enunciado académico de la MONOGRAFÍA 02 no solicita registro de usuarios, inicio de sesión, contraseñas, roles ni permisos. Estas funciones fueron añadidas por error y deben retirarse.

## Regla obligatoria de alcance

La aplicación es un ejecutable local y offline de uso directo. Al abrir el `.exe` debe ingresar inmediatamente al panel principal, sin pedir usuario ni contraseña.

No implementar ni conservar como funcionalidad activa:

- Pantalla de login.
- Registro o creación de cuentas.
- Usuarios.
- Roles.
- Permisos.
- Contraseñas.
- Cambio o recuperación de contraseña.
- Sesiones.
- Tokens.
- Botón de cerrar sesión.
- Restricciones por usuario.
- Autenticación externa o en la nube.
- Cuenta obligatoria para responsables de centros.
- Aprobaciones dependientes de una cuenta de usuario.

Los responsables de centros de actividad son únicamente registros empresariales con:

- Código.
- Nombre.
- Cargo.
- Correo.
- Teléfono.
- Empresa.
- Centro relacionado.
- Estado.

## Objetivo de la corrección

Reabrir la Fase 2 y corregir el aplicativo para que contenga únicamente:

1. Acceso directo al panel principal.
2. Empresas.
3. Sedes o localizaciones.
4. Responsables de centros.
5. Centros de actividad.
6. Grupos presupuestales.
7. Elementos presupuestales.
8. Cuentas presupuestales.
9. Jerarquía:
   `Empresa → Sede → Centro → Grupo → Elemento → Cuenta`.
10. Monedas.
11. Tipos de cambio.
12. Unidades de medida.
13. Persistencia local con SQLite.
14. Ejecutable portátil para Windows.

## Cambios obligatorios en la interfaz

- Eliminar la ruta y la pantalla `/login`.
- Abrir directamente el dashboard.
- Eliminar “Usuarios y roles” del menú.
- Eliminar el bloque de usuario de la barra superior.
- Eliminar el botón “Cerrar sesión”.
- Eliminar mensajes sobre permisos, credenciales o seguridad por roles.
- Eliminar tarjetas o indicadores de cantidad de usuarios.
- Cambiar textos como “Seguridad y estructura” por “Empresas y estructura presupuestal”.
- Mantener el selector de empresa activa.
- Permitir todas las operaciones funcionales del aplicativo local sin permisos por usuario.

## Cambios obligatorios en el backend

- No registrar rutas activas `/api/auth/*`.
- No registrar rutas activas `/api/users` ni `/api/roles`.
- Las rutas de empresas, sedes, responsables, centros, estructura y parámetros deben funcionar directamente, sin encabezado `Authorization`.
- Eliminar la exigencia de sesión o token para usar la API local.
- Las validaciones deben centrarse en integridad de datos y pertenencia a la empresa, no en permisos.
- Conservar las tablas antiguas de autenticación solo si retirarlas rompe migraciones existentes; en ese caso deben quedar como legado interno sin interfaz, sin endpoints y sin uso funcional.
- No crear nuevas tablas, pantallas ni reglas de autenticación.

## Cambios obligatorios en la base de datos

La estructura funcional debe priorizar:

- Empresas.
- Sedes.
- Responsables.
- Centros.
- Grupos.
- Elementos.
- Cuentas.
- Monedas.
- Tipos de cambio.
- Unidades.
- Relaciones centro-cuenta.

No usar un usuario como clave obligatoria de las operaciones presupuestales futuras.

Cuando se necesite registrar quién formuló, revisó o aprobó, utilizar un campo de texto o una relación con el catálogo de responsables, no una cuenta de acceso.

## Pruebas mínimas

1. El `.exe` abre directamente el panel principal.
2. No existe login.
3. No existe menú de usuarios o roles.
4. La API responde sin token.
5. Se puede crear una empresa.
6. Se puede crear una sede.
7. Se puede crear un responsable.
8. Un centro exige responsable y correo.
9. Se pueden crear grupo, elemento y cuenta.
10. La jerarquía de seis niveles se visualiza correctamente.
11. Los códigos duplicados son rechazados.
12. Los datos persisten al cerrar y volver a abrir.
13. `npm run verify` finaliza correctamente.
14. GitHub Actions genera un nuevo ejecutable Windows.

## Documentación

Actualizar:

- `README_FASE_0.md`
- `README_FASE_2.md`
- Pruebas.
- Mensajes del dashboard.
- Descripciones de módulos.

Los documentos deben declarar expresamente:

> El sistema es una aplicación local de acceso directo. No utiliza cuentas, login, contraseñas, roles ni permisos porque esas funciones no forman parte del enunciado académico.

## Criterio de finalización

La corrección termina solo cuando:

- La aplicación abre sin login.
- No existen funciones visibles de usuarios, roles, permisos o contraseñas.
- El build y las pruebas pasan.
- GitHub Actions genera un nuevo artifact.
- La corrección se integra a `main`.

No iniciar la Fase 3 antes de cerrar esta corrección.
