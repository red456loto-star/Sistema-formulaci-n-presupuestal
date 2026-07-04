# PresuControl Empresarial

Aplicación de escritorio local para formulación, control y evaluación presupuestal empresarial.

## Estado

- **Fase 0:** análisis funcional y arquitectura.
- **Fase 1:** base técnica React, TypeScript, Node.js, SQLite y Electron.
- **Fase 2 corregida:** empresas, responsables, centros, estructura presupuestal y tablas maestras.
- **Fase 3:** ejercicios, doce periodos mensuales, tres años de proyección y versiones original/forecast.

## Acceso

El ejecutable abre directamente el panel principal. El sistema no utiliza:

- Login.
- Cuentas de usuario.
- Contraseñas.
- Roles.
- Permisos.
- Sesiones ni tokens.

Los responsables de centros son registros empresariales con nombre, cargo y correo; no son cuentas de acceso.

## Contexto temporal

La barra superior permite seleccionar empresa, ejercicio, periodo y versión. Los selectores son dependientes y conservan el contexto localmente.

La Fase 3 no registra todavía importes presupuestales.

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
