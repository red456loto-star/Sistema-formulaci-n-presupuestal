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
- **Fase 9:** variaciones multidimensionales, relevancia de costos y dashboard presupuestal.

## Acceso

El ejecutable abre directamente el dashboard. El sistema no utiliza login, cuentas de usuario, contraseñas, roles, permisos, sesiones ni tokens.

Los responsables son registros empresariales con nombre, cargo y correo; no son cuentas de acceso.

## Control y evaluación presupuestal

El dashboard y las pantallas **Variaciones** y **Relevancia de costos** permiten trabajar con:

- Presupuesto original versus información real.
- Presupuesto original versus forecast.
- Forecast versus información real.
- Periodos mensuales o total anual.
- Centro, grupo, elemento y cuenta.
- Tipo de presupuesto.
- Umbral configurable de materialidad.

El sistema calcula:

- Variación monetaria.
- Variación porcentual.
- Porcentaje de ejecución.
- Participación dentro del total.
- Impacto dentro de la desviación total.
- Tendencia mensual.
- Favorabilidad según la naturaleza de la cuenta.
- Costos fijos, variables, directos e indirectos.
- Impacto en resultado y rentabilidad.
- Ranking de centros y cuentas críticos.

La exportación Excel incluye resumen, variaciones detalladas, tendencia, rankings, relevancia de costos y advertencias. Los gráficos funcionan localmente sin internet.

La documentación detallada está en `README_FASE_9.md`.

## Análisis financiero

Las pantallas **Estados financieros** y **Análisis financiero** conservan:

- Estado de resultados.
- Estado de situación financiera.
- Análisis vertical.
- Análisis horizontal.
- Ratios de liquidez, gestión, solvencia y rentabilidad.
- Análisis Dupont.
- EVA.
- Exportación Excel con estados, indicadores, fuentes y supuestos.

Los supuestos necesarios para impuesto y EVA son visibles, editables y documentados. Una variable faltante permanece como no disponible; el sistema no inventa valores.

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
