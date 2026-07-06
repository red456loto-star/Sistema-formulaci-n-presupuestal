# Fase 7 — Información real y forecast

## Objetivo

Incorporar información real trazable y elaborar múltiples presupuestos revisados o forecast sin autenticación.

La fase mantiene React + TypeScript, API local Node.js, SQLite, Electron y funcionamiento offline. El correo y los análisis financieros posteriores permanecen fuera de alcance.

## Información real

Cada registro se relaciona con:

```text
Empresa + Ejercicio + Versión original + Periodo + Centro + Grupo + Elemento + Cuenta + Tipo de presupuesto
```

Campos principales:

- Valor presupuestado.
- Valor real.
- Tipo de presupuesto.
- Tipo de fuente.
- Referencia de la fuente.
- Periodo y fecha de la fuente.
- Responsable.
- Comentario.
- Fecha de registro.

Tipos de fuente permitidos:

- `REAL_PUBLICADO`: dato real procedente de una fuente pública identificable.
- `REAL_INTERNO`: dato real de un cierre o reporte interno.
- `DERIVADO`: dato transformado o calculado desde una fuente documentada.
- `DEMOSTRATIVO`: dato sintético usado únicamente para pruebas.

Los datos demostrativos no se presentan como oficiales.

### Registro manual

Para `PRESUPUESTO_ORIGINAL`, el valor presupuestado se deriva automáticamente de la línea mensual del presupuesto original. Para otros tipos de presupuesto se registra el valor presupuestado junto con el real.

La combinación de versión original, periodo, centro, cuenta y tipo de presupuesto es única.

### Importación Excel

La plantilla `plantilla-informacion-real.xlsx` contiene:

- Periodo.
- Centro.
- Cuenta.
- Tipo de presupuesto.
- Presupuestado.
- Real.
- Tipo de fuente.
- Fuente.
- Periodo de la fuente.
- Fecha de la fuente.
- Responsable.
- Comentario.

El flujo de importación:

1. Selecciona el archivo `.xlsx`.
2. Detecta la hoja y encabezados.
3. Valida periodo, centro, cuenta, responsable, importes y fuente.
4. Muestra filas válidas y rechazadas.
5. Importa únicamente las filas válidas confirmadas.
6. Registra archivo, hoja, operador textual, fecha y resumen de carga.

## Forecast

Un forecast requiere:

- Una versión original del mismo ejercicio y empresa.
- Versión original aprobada o cerrada.
- Mes de corte entre enero y diciembre.
- Información real completa para todas las líneas hasta el corte.
- Código, nombre, responsable y observación.

Regla de cálculo:

```text
Periodo <= mes de corte  → Forecast = Real
Periodo > mes de corte   → Forecast = Proyección revisada
```

Al crear una revisión, los meses posteriores al corte se inicializan con el presupuesto original y luego pueden modificarse.

Cada línea muestra:

- Presupuesto original.
- Información real, cuando corresponde.
- Valor proyectado.
- Forecast resultante.
- Diferencia respecto al original.
- Comentario.
- Fuente.
- Responsable.

Los meses reales no pueden ser reemplazados por proyecciones.

## Versionamiento

Cada forecast se registra también en `budget_versions` como tipo `FORECAST` y conserva:

- Versión original de origen.
- Número de versión.
- Número de revisión.
- Mes de corte.
- Fecha de creación.
- Responsable.
- Observación.
- Estado.

Se permiten múltiples revisiones para una misma versión original.

## Aprobación

La aprobación exige:

- Responsable empresarial activo.
- Observación.
- Líneas reales completas hasta el corte.
- Proyecciones completas después del corte.

Al aprobar:

- El estado cambia de `BORRADOR` a `APROBADO`.
- Se registra responsable, fecha y observación.
- Se agrega historial de estado.
- La versión queda bloqueada para edición.

No se requiere cuenta de acceso.

## Base de datos

La migración 8 crea:

- `actual_values`.
- `actual_import_batches`.
- `forecast_profiles`.
- `forecast_values`.

## API local

### Información real

- `GET /api/actuals`.
- `POST /api/actuals`.
- `PATCH /api/actuals/:id`.
- `DELETE /api/actuals/:id`.
- `GET /api/actuals/template`.
- `POST /api/actuals/import/inspect`.
- `POST /api/actuals/import/confirm`.
- `GET /api/actuals/import/history`.

### Forecast

- `GET /api/forecasts`.
- `POST /api/forecasts`.
- `GET /api/forecasts/:id`.
- `GET /api/forecasts/:id/summary`.
- `PATCH /api/forecasts/:id/lines/:lineId`.
- `POST /api/forecasts/:id/approve`.

Todas las rutas funcionan sin autenticación.

## Pruebas automatizadas

La suite comprueba:

- Registro manual de datos reales.
- Derivación del valor presupuestado original.
- Rechazo de duplicados.
- Inspección e importación Excel.
- Rechazo de filas inválidas.
- Creación de forecast con distintos meses de corte.
- Protección de meses reales.
- Edición de meses proyectados.
- Total anual y diferencia contra el original.
- Múltiples revisiones.
- Aprobación y bloqueo.
- Persistencia en SQLite.
- Separación por empresa.
- Ausencia de login.

```bash
npm run verify
```

## Fuera de alcance

- Análisis vertical y horizontal.
- Ratios financieros, Dupont y EVA.
- Análisis final de variaciones.
- Relevancia de costos.
- Dashboard financiero ejecutivo.
- Reportes imprimibles finales.
- Correo y propuestas de mejora.
