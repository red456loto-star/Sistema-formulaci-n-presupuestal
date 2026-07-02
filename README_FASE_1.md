# Fase 1 — Estructura técnica, SQLite, Electron y navegación base

## 1. Objetivo

Construir la base tecnológica de **PresuControl Empresarial** sin adelantar la lógica funcional de las fases posteriores.

## 2. Decisiones técnicas

- Monorepo con `npm workspaces`.
- Frontend React + TypeScript + Vite.
- Backend Node.js + TypeScript + Express.
- API REST local.
- SQLite mediante `better-sqlite3`.
- Migraciones versionadas en código.
- Aplicación de escritorio Electron.
- Empaquetado portable con `electron-builder`.
- Validación preparada con Zod.
- Logs locales con Pino.
- Pruebas integrales con `node:test`.
- Workflow de GitHub Actions para Windows.

## 3. Arquitectura implementada

```text
Electron
  ├── inicia la API local en producción
  ├── define el directorio de datos del usuario
  └── carga el frontend compilado

Frontend React
  └── consume la API REST local

API Express
  ├── rutas de salud y demostración
  ├── estado de la base de datos
  ├── respaldo
  └── restauración

SQLite
  ├── migraciones
  ├── metadatos
  ├── contexto demo
  └── eventos técnicos
```

## 4. Alcance offline

La primera versión está diseñada como aplicación local por instalación:

- Una base SQLite por instalación.
- Usuarios y roles locales en fases posteriores.
- Sin edición simultánea desde varias computadoras.
- Sin sincronización en nube.
- Preparada para una futura migración a servidor, pero esa función no pertenece al alcance inicial.

## 5. Funciones implementadas

### Frontend

- Menú lateral moderno y adaptable.
- Barra superior con empresa, ejercicio, periodo, versión y usuario demo.
- Página de inicio.
- Pantallas base para todos los módulos futuros.
- Página de estado del sistema.
- Manejo global de errores.
- Diseño responsive.

### API

- `GET /api/health`
- `GET /api/demo/context`
- `GET /api/demo/summary`
- `GET /api/system/database-status`
- `POST /api/system/backup`
- `POST /api/system/restore-latest`
- `GET /api/system/log-location`

### Base de datos

- Inicialización automática.
- `PRAGMA foreign_keys = ON`.
- Modo WAL.
- Tabla de migraciones.
- Datos demo mínimos.
- Copias de seguridad básicas.
- Restauración del respaldo más reciente.

### Electron

- Inicio de API local al abrir la aplicación empaquetada.
- Carga segura del frontend.
- `contextIsolation` activo.
- `nodeIntegration` desactivado.
- Preload limitado.
- Aplicación portable para Windows.

## 6. Datos demo

Se crea únicamente un contexto técnico para validar la integración:

- Empresa: Empresa demostrativa.
- Ejercicio: 2027.
- Periodo: Enero.
- Versión: Original 1.0.
- Usuario: Administrador local.

Estos datos son sintéticos de prueba y no representan información oficial.

## 7. Ejecución local

Requisitos:

- Node.js 22.
- npm.

Instalación:

```bash
npm install
```

Desarrollo:

```bash
npm run dev
```

Verificación:

```bash
npm run verify
```

Construcción portable:

```bash
npm run desktop:dist
```

## 8. Datos, logs y respaldos

En desarrollo, si no se especifica otra ruta, la API usa:

```text
~/.presucontrol-empresarial/
```

En el ejecutable, Electron utiliza el directorio de datos de usuario de la aplicación y crea:

```text
data/presucontrol.sqlite
data/logs/api.log
data/backups/*.sqlite
```

## 9. Pruebas incluidas

La prueba de integración verifica:

- Inicio de la API en un puerto libre.
- Respuesta de salud.
- Conexión SQLite.
- Lectura de datos demo.
- Creación de respaldo.
- Estado del respaldo.

## 10. GitHub Actions

El workflow `.github/workflows/build-windows.yml`:

1. Descarga el repositorio.
2. Configura Node.js 22.
3. Instala dependencias.
4. Ejecuta validación de tipos, pruebas y builds.
5. Genera un `.exe` portable.
6. Publica el artifact `PresuControl-Empresarial-Windows`.

## 11. Funcionalidades no implementadas todavía

Para respetar el desarrollo por fases, todavía no se implementaron:

- Autenticación completa.
- Roles y permisos funcionales.
- Empresas reales y sedes.
- Estructura presupuestal editable.
- Periodos y versiones funcionales.
- Importación Excel.
- Presupuesto original.
- Forecast.
- Presupuesto maestro.
- Cálculos financieros.
- Reportes finales.
- Correo.
- Propuestas de mejora.

## 12. Criterios de aceptación

La fase se considera correcta cuando:

- React compila.
- La API responde.
- SQLite se inicializa.
- Electron abre la interfaz.
- La navegación funciona.
- La información demo se consulta.
- El respaldo básico funciona.
- Las pruebas de integración finalizan correctamente.
- GitHub Actions genera el artifact de Windows.

## 13. Próxima fase

La Fase 2 implementará usuarios, roles, empresas, sedes, responsables y la estructura jerárquica presupuestal, sin adelantar periodos ni cálculos del presupuesto maestro.
