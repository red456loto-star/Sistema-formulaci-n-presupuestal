
# PresuControl Empresarial

Aplicación de escritorio local para formulación, control y evaluación presupuestal empresarial.

## Estado

- **Fase 0:** análisis funcional y arquitectura.
- **Fase 1:** base técnica React, TypeScript, Node.js, SQLite y Electron.
- **Fase 2 corregida:** empresas, responsables, centros, estructura presupuestal y tablas maestras.

## Acceso

El ejecutable abre directamente el panel principal. El sistema no utiliza:

- Login.
- Cuentas de usuario.
- Contraseñas.
- Roles.
- Permisos.
- Sesiones ni tokens.

Los responsables de centros son registros empresariales con nombre, cargo y correo; no son cuentas de acceso.

## Verificación

```bash
npm install
npm run verify
```

## Ejecutable Windows

```bash
npm run desktop:dist
```

GitHub Actions también genera el ejecutable portátil de Windows.
