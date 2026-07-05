# PresuControl Empresarial

Aplicación de escritorio local para formulación, control y evaluación presupuestal empresarial.

## Estado

- **Fase 0:** análisis funcional y arquitectura.
- **Fase 1:** base técnica React, TypeScript, Node.js, SQLite y Electron.
- **Fase 2 corregida:** empresas, responsables, centros, estructura presupuestal y tablas maestras.
- **Fase 3:** ejercicios, doce periodos mensuales, tres años de proyección y versiones original/forecast.
- **Fase 4:** importación flexible de tablas maestras desde Excel.
- **Fase 5:** presupuesto original mensual, total anual, valor real diferenciado y proyección anual de tres años.
- **Fase 6:** presupuesto maestro integrado, estados financieros presupuestados y exportación Excel.

## Acceso

El ejecutable abre directamente el panel principal. El sistema no utiliza login, cuentas de usuario, contraseñas, roles, permisos, sesiones ni tokens.

Los responsables son registros empresariales con nombre, cargo y correo; no son cuentas de acceso.

## Contexto presupuestal

La barra superior permite seleccionar empresa, ejercicio, periodo y versión. Los selectores son dependientes y conservan el contexto localmente.

La pantalla **Presupuesto maestro** requiere una versión anual de tipo `ORIGINAL` y contiene:

- Presupuesto de ventas.
- Presupuesto de inventarios.
- Presupuesto de compras.
- Presupuesto de producción calculado.
- Materiales, mano de obra y costos indirectos por centro productivo.
- Gastos por centro, grupo, elemento y cuenta.
- Presupuesto de inversiones y depreciación.
- Estado de resultados presupuestado.
- Estado de situación financiera presupuestado.
- Exportación Excel de cada componente y del consolidado.

Los estados financieros se derivan de los componentes y de los saldos iniciales estrictamente necesarios; no se capturan como cifras finales aisladas.

La documentación detallada está en `README_FASE_6.md`.

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
