# Fase 2 — Usuarios, roles, empresas y estructura presupuestal

## Objetivo

Implementar la seguridad local, la estructura organizacional y la estructura presupuestal base de PresuControl Empresarial, sin adelantar periodos, versiones, formulación, forecast ni cálculos financieros.

## Funcionalidades implementadas

### Autenticación local

- Inicio de sesión mediante usuario y contraseña.
- Contraseñas almacenadas con `scrypt` y salt individual.
- Sesiones locales con token aleatorio, hash y vencimiento.
- Cierre de sesión.
- Cambio de contraseña.
- Bloqueo de usuarios inactivos.
- Clave temporal para usuarios nuevos.

Acceso inicial de demostración:

- Usuario: `admin`.
- La contraseña inicial se comunica al responsable de la instalación.
- Debe cambiarse desde el apartado **Mi contraseña**.

### Roles y permisos

Roles incorporados:

1. Administrador.
2. Analista de presupuestos.
3. Responsable de centro.
4. Revisor.
5. Aprobador.
6. Consulta.

Los permisos se controlan en frontend y backend por módulo y acción:

- Leer.
- Crear.
- Editar.
- Eliminar o desactivar.

Módulos protegidos en esta fase:

- Usuarios.
- Empresas.
- Estructura.
- Parámetros.
- Auditoría.

### Empresas y organización

Se implementaron:

- Empresas.
- Sedes o localizaciones.
- Responsables.
- Centros de actividad.
- Responsable y correo asociados al centro.
- Estados activo/inactivo.
- Códigos únicos por empresa.
- Selector de empresa activa.

### Estructura presupuestal

Se implementaron:

- Grupos presupuestales.
- Elementos presupuestales.
- Cuentas presupuestales.
- Naturalezas: ingreso, costo, gasto, activo, pasivo y patrimonio.
- Tipo de movimiento: detalle o acumuladora.
- Árbol jerárquico y breadcrumbs.

Se conserva la separación conceptual aprobada:

```text
Estructura organizacional:
Empresa → Sede → Centro de actividad

Estructura presupuestal:
Empresa → Grupo → Elemento → Cuenta
```

En fases posteriores, cada línea presupuestal relacionará:

```text
Centro + Cuenta + Ejercicio + Periodo + Versión
```

### Parámetros transversales

- Monedas.
- Tipos de cambio.
- Unidades de medida.

### Separación empresarial

Las rutas protegidas validan que los identificadores relacionados pertenezcan a la misma empresa. Los usuarios no administradores no pueden consultar ni modificar registros de otra empresa.

### Auditoría

Se registran eventos de:

- Creación.
- Modificación.
- Desactivación.
- Cambio de contraseña.

Cada evento conserva usuario, empresa, entidad, identificador, descripción, datos anteriores, datos posteriores y fecha.

## Base de datos

La migración 2 agrega:

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

Se incorporaron claves foráneas, restricciones únicas e índices para empresa y jerarquía.

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

### Jerarquía y auditoría

- `GET /api/organization/hierarchy`
- `GET /api/audit`

## Interfaz

Se agregaron:

- Pantalla de inicio de sesión.
- Selector de empresa activa.
- Usuarios, roles y permisos.
- Empresas, sedes y responsables.
- Árbol organizacional y presupuestal.
- Formularios para centros, grupos, elementos y cuentas.
- Monedas, tipos de cambio y unidades.
- Visor de auditoría.
- Mensajes claros de validación y permisos.

La interfaz mantiene el diseño moderno de la Fase 1 y conserva la profundidad del prototipo histórico sin utilizar ventanas superpuestas.

## Datos demo

Los datos incluidos son sintéticos y están identificados como demostrativos:

- Empresa demostrativa.
- Sede Lima.
- Responsable Ana Torres.
- Centro Administración.
- Grupo Gastos operativos.
- Elemento Servicios de terceros.
- Cuenta Energía eléctrica.
- Monedas PEN y USD.
- Unidades UND, KG, HORA y MES.

## Pruebas

La prueba de integración valida:

- Inicio de la API y SQLite.
- Inicio de sesión.
- Permisos del administrador.
- Creación de empresa.
- Rechazo de duplicados.
- Creación de sede, responsable y centro.
- Creación de grupo, elemento y cuenta.
- Jerarquía y responsable del centro.
- Creación de usuario de consulta.
- Denegación de una operación no autorizada.
- Auditoría.
- Respaldo de la base de datos.

## Verificación realizada

En el entorno de desarrollo se completaron correctamente:

- `npm run typecheck`
- `npm run build`

La prueba con el módulo nativo SQLite debe confirmarse en el runner Windows de GitHub Actions, donde se instala y compila `better-sqlite3`.

## Criterios de aceptación

La fase se considera aprobada si:

- Se crean empresas y usuarios.
- Los roles y permisos restringen operaciones.
- No se mezclan datos entre empresas.
- Los centros tienen responsables y correos.
- La jerarquía se visualiza correctamente.
- Las validaciones de duplicidad funcionan.
- La auditoría registra operaciones.
- El build de Electron continúa funcionando.
- GitHub Actions genera el artifact de Windows.

## Alcance no implementado todavía

- Ejercicios y periodos reales.
- Versiones y escenarios.
- Flujos de aprobación presupuestal.
- Importación Excel.
- Presupuesto original.
- Forecast.
- Presupuesto maestro.
- Estados financieros.

Estos componentes corresponden a las fases siguientes.
