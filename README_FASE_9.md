# Fase 9 — Relevancia, variaciones y dashboard

## Alcance

Esta fase implementa exclusivamente las funciones exigidas para el control y evaluación presupuestal:

- Presupuesto original versus información real.
- Presupuesto original versus forecast.
- Forecast versus información real.
- Variación monetaria y porcentual.
- Porcentaje de ejecución.
- Participación dentro del total analizado.
- Tendencia mensual.
- Desviaciones favorables y desfavorables.
- Materialidad de partidas.
- Relevancia de costos fijos, variables, directos e indirectos.
- Centros, elementos y cuentas con mayor impacto.
- Dashboard presupuestal con KPI útiles.
- Exportación Excel de los resultados.

No se implementan todavía reportes imprimibles, PDF, correo ni propuestas de mejora, que corresponden a la Fase 10.

## Base de comparación

La pantalla obliga a mostrar la base y el escenario comparado. Las combinaciones disponibles son:

1. Presupuesto original vs real.
2. Presupuesto original vs forecast.
3. Forecast vs real.

Cuando se utiliza forecast, el sistema valida que la versión seleccionada derive del presupuesto original indicado. No permite mezclar empresas, ejercicios o versiones incompatibles.

## Fórmulas

- Variación monetaria = Valor comparado − Valor base.
- Variación porcentual = Variación monetaria / valor absoluto de la base × 100.
- Ejecución = Valor comparado / valor absoluto de la base × 100.
- Participación = Valor absoluto de la partida / total absoluto analizado × 100.
- Impacto de variación = Variación absoluta de la partida / total absoluto de variaciones × 100.

Si la base es cero, la variación porcentual y la ejecución se muestran como no disponibles. El sistema no fuerza divisiones entre cero.

## Favorabilidad

- Ingresos: un aumento es favorable y una disminución es desfavorable.
- Costos y gastos: una disminución es favorable y un aumento es desfavorable.
- Activos, pasivos y patrimonio se muestran como variaciones neutrales, salvo que el usuario interprete su efecto junto con los estados financieros.

## Materialidad

El usuario define un umbral porcentual. Una partida se considera material cuando su participación en el total o su participación en el impacto de la variación alcanza dicho umbral. El valor inicial es 10 % y puede modificarse sin alterar los datos almacenados.

## Relevancia de costos

La estructura se obtiene del presupuesto maestro y conserva las clasificaciones registradas:

- Comportamiento: fijo o variable.
- Trazabilidad: directo o indirecto.
- Categoría: materiales, mano de obra, CIF o gastos.
- Centro, elemento y cuenta.

El impacto en resultados invierte el signo de las variaciones de costos y gastos: un sobrecosto reduce el resultado y un ahorro lo mejora. El impacto porcentual en rentabilidad se calcula respecto de las ventas base disponibles.

## Dashboard

Incluye únicamente información útil para toma de decisiones:

- Base presupuestal.
- Valor comparado.
- Variación total.
- Ejecución.
- Cobertura de información real.
- Ventas, costos, gastos, resultado y rentabilidad por escenario.
- Tendencia mensual.
- Participación de costos.
- Ranking de centros críticos.
- Ranking de cuentas.

Los gráficos se renderizan localmente mediante React, SVG y CSS; no requieren internet ni servicios externos.

## Filtros

- Empresa.
- Ejercicio.
- Periodo o total anual.
- Versión original.
- Versión forecast.
- Centro.
- Grupo.
- Elemento.
- Cuenta.
- Tipo de presupuesto.
- Tipo de comparación.
- Umbral de materialidad.

## API local

- `GET /api/phase9/options`
- `POST /api/phase9/analyze`
- `POST /api/phase9/export`

## Persistencia

La Fase 9 no duplica cifras ni almacena resultados calculados. Lee la información persistida en SQLite de presupuesto original, información real, forecast, presupuesto maestro y análisis financiero. La migración 10 registra la activación de la fase sin crear tablas redundantes.

## Exportación Excel

El archivo contiene:

- Resumen.
- Variaciones detalladas.
- Tendencia mensual.
- Ranking de centros.
- Ranking de cuentas.
- Relevancia de costos.
- Advertencias.

## Verificación

```bash
npm run verify
```

La regresión `tests/phase9.test.mjs` valida fórmulas, filtros, materialidad, tendencia, centros críticos, relevancia de costos, exportación Excel, persistencia y ausencia de autenticación.
