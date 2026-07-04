# PresuControl Empresarial

Aplicación de escritorio local para formulación, control y evaluación presupuestal empresarial.

## Estado

- **Fase 0:** análisis funcional y arquitectura.
- **Fase 1:** base técnica React, TypeScript, Node.js, SQLite y Electron.
- **Fase 2 corregida:** empresas, responsables, centros, estructura presupuestal y tablas maestras.
- **Fase 3:** ejercicios, doce periodos mensuales, tres años de proyección y versiones original/forecast.
- **Fase 4:** importación flexible de tablas maestras desde Excel.
- **Fase 5:** presupuesto original mensual, total anual, valor real diferenciado y proyección anual de tres años.

## Acceso

El ejecutable abre directamente el panel principal. El sistema no utiliza login, cuentas de usuario, contraseñas, roles, permisos, sesiones ni tokens.

Los responsables son registros empresariales con nombre, cargo y correo; no son cuentas de acceso.

## Contexto presupuestal

La barra superior permite seleccionar empresa, ejercicio, periodo y versión. Los selectores son dependientes y conservan el contexto localmente.

La pantalla **Presupuesto original** requiere una versión de tipo `ORIGINAL` y permite:

- Registrar líneas por centro y cuenta.
- Capturar enero a diciembre.
- Diferenciar presupuesto y valor real.
- Calcular automáticamente el total anual.
- Distribuir un total anual entre periodos abiertos.
- Copiar valores dentro de la misma versión.
- Proyectar los tres años posteriores.
- Filtrar por centro, grupo, elemento y cuenta.
- Aprobar mediante responsable y bloquear la edición.

La documentación detallada está en `README_FASE_5.md`.

## Verificación

```bash
npm install
npm run verify
```

## Ejecutable Windows

```bash
npm run desktop:dist
```

GitHub Actions genera también el ejecutable portátil de Windows.
