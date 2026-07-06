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
- **Fase 7:** información real documentada, importación Excel y múltiples revisiones forecast por mes de corte.
- **Fase 8:** estados financieros comparables, análisis vertical y horizontal, ratios, Dupont y EVA.

## Acceso

El ejecutable abre directamente el panel principal. El sistema no utiliza login, cuentas de usuario, contraseñas, roles, permisos, sesiones ni tokens.

Los responsables son registros empresariales con nombre, cargo y correo; no son cuentas de acceso.

## Análisis financiero

Las pantallas **Estados financieros** y **Análisis** permiten trabajar con:

- Presupuesto original.
- Forecast.
- Información real.
- Periodos mensuales o total anual.
- Versiones y ejercicios de una misma empresa.

El sistema genera:

- Estado de resultados.
- Estado de situación financiera.
- Análisis vertical.
- Análisis horizontal.
- Ratios de liquidez, gestión, solvencia y rentabilidad.
- Análisis Dupont.
- EVA.
- Exportación Excel con estados, indicadores, fuentes y supuestos.

Para forecast e información real, las cuentas se clasifican explícitamente como ventas, costos, gastos, activos, pasivos, patrimonio o partidas excluidas. Los roles de efectivo, cuentas por cobrar e inventarios se identifican por separado para los ratios.

Los supuestos necesarios para impuesto y EVA son visibles, editables y documentados. Una variable faltante permanece como no disponible; el sistema no inventa valores.

La documentación detallada está en `README_FASE_8.md`.

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
