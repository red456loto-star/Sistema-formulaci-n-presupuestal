# Fase 11 — Correcciones de jerarquía y flujo presupuestal

## Objetivo

La Fase 11 reorganiza el sistema para que el usuario trabaje en un orden lógico y obligatorio:

1. Empresa y perfil.
2. Periodos y versiones.
3. Tipos de presupuesto.
4. Tablas maestras.
5. Análisis financiero integral y relevancia de costos.
6. Variaciones y dashboard.
7. Propuestas de mejora y envío por correo.

Las opciones posteriores se subordinan a las anteriores para impedir que se mezclen empresas, periodos, versiones o tipos de presupuesto.

## Menú corregido

El panel lateral muestra únicamente:

1. Empresa y perfil.
2. Periodos y versiones.
3. Tipos de presupuesto.
4. Tablas maestras.
5. Análisis financiero integral.
6. Relevancia de costos.
7. Análisis de variaciones.
8. Dashboard de presupuestos.
9. Propuestas de mejora.
10. Envío por correo.

Las rutas antiguas y redundantes se redirigen a la nueva opción equivalente. Los datos y las API anteriores se conservan para no romper el historial ni las regresiones.

## Reglas de habilitación

- **Empresa y perfil:** siempre disponible.
- **Periodos y versiones:** requiere una empresa activa.
- **Tipos de presupuesto:** requiere empresa, ejercicio, periodo y versión.
- **Tablas maestras:** requiere el tipo de presupuesto.
- **Análisis financiero, costos, variaciones, dashboard, propuestas y correo:** requieren información maestra en el contexto activo.
- **Variaciones y dashboard:** no dependen de que el usuario abra o complete previamente las pantallas de análisis financiero o costos; se calculan directamente desde la información maestra.

## Empresa y perfil

La primera opción reúne:

- Empresas.
- Sedes.
- Responsables empresariales.
- Centros de actividad.
- Grupos presupuestales.
- Elementos presupuestales.
- Cuentas presupuestales.

Los responsables continúan siendo registros empresariales y no cuentas de acceso.

## Periodos y versiones

Ejercicios, periodos y versiones se administran dentro de una sola opción con dos pestañas. El contexto activo queda compuesto por:

`Empresa + Ejercicio + Periodo + Versión`

## Tipos de presupuesto

El tipo de presupuesto se administra de forma independiente de la versión original o forecast.

Tipos iniciales:

- Ventas.
- Producción.
- Compras.
- Costos.
- Gastos.
- Inversiones.
- Caja.
- Estado de resultados.
- Estado de situación financiera.
- Estado de flujos de efectivo.

También se pueden crear, editar, activar o desactivar tipos adicionales por empresa.

## Tablas maestras

La información se registra de forma única por:

`Empresa + Ejercicio + Periodo + Versión + Tipo de presupuesto + Origen`

El origen puede ser:

- `PRESUPUESTADO`.
- `REAL`.

### Registro manual

Permite agregar múltiples partidas al mismo conjunto maestro.

### Importación Excel

La opción de importación está dentro de Tablas maestras. Permite:

- Descargar una plantilla.
- Inspeccionar hojas.
- Detectar encabezados equivalentes.
- Validar filas.
- Excluir filas observadas.
- Sustituir un conjunto existente de manera explícita.
- Registrar fuente, periodo, operador y WACC.

La plantilla admite presupuestos operativos, costos y estados financieros.

### Edición y eliminación

Después de registrar la información, el usuario puede:

- Editar cada fila.
- Eliminar una fila.
- Eliminar todo el conjunto presupuestado o real del contexto.

Los análisis y bloqueos se actualizan inmediatamente después de cada cambio.

## Análisis automáticos

Desde las tablas maestras se calculan automáticamente:

### Análisis financiero integral

- Estado de resultados.
- Estado de situación financiera.
- Análisis vertical.
- Análisis horizontal presupuestado versus real.
- Ratios de liquidez, solvencia, rentabilidad y gestión.
- Análisis Dupont.
- EVA.

El EVA requiere el WACC registrado en Tablas maestras. Si falta, se muestra como no disponible.

### Relevancia de costos

- Costos fijos.
- Costos variables.
- Costos directos.
- Costos indirectos.
- Participación por centro.
- Participación por elemento.
- Margen de contribución.
- Punto de equilibrio.

### Variaciones

Compara presupuestado versus real por:

- Periodo.
- Tipo de presupuesto.
- Centro.
- Elemento.
- Cuenta o partida.

Calcula importe presupuestado, real, variación, porcentaje, ejecución y favorabilidad.

### Dashboard

Presenta:

- Presupuestado.
- Real.
- Variación.
- Ejecución.
- Rentabilidad o resultado.
- Tendencia por periodo.
- Partidas críticas.
- Estructura de costos.

Cada pantalla puede visualizarse, imprimirse y exportarse a Excel o PDF.

## Propuestas de mejora

La opción se habilita después de registrar información maestra. Cada propuesta contiene:

- Problema.
- Evidencia cuantitativa.
- Centro, elemento y cuenta.
- Causa probable.
- Acción.
- Impacto esperado.
- Impacto en rentabilidad.
- Responsable.
- Prioridad.
- Plazo.
- Estado.

El sistema puede sugerir propuestas a partir de variaciones desfavorables, pero no las guarda sin revisión del usuario.

## Correo

El correo permanece bloqueado hasta que exista información maestra. Solo permite enviar versiones aprobadas o cerradas.

El PDF adjunto se genera desde las partidas presupuestadas del centro en las tablas maestras. El envío conserva historial, estado, error y reintentos. La contraseña SMTP no se almacena.

## Persistencia

La migración 12 incorpora:

- `budget_types`.
- `master_data_sets`.
- `master_data_rows`.
- `phase11_improvement_proposals`.

## Pruebas

`tests/phase11.test.mjs` valida:

- Versión 0.11.0 y acceso sin login.
- Jerarquía y estado del flujo.
- Tipos de presupuesto.
- Plantilla e inspección Excel.
- Información presupuestada y real.
- Unicidad por contexto.
- Registro manual acumulativo.
- Edición y eliminación.
- Análisis vertical y horizontal.
- Ratios, Dupont y EVA.
- Relevancia de costos.
- Variaciones y dashboard.
- Reportes Excel y PDF.
- Propuestas.
- Envío del presupuesto aprobado desde datos maestros.
- Persistencia después de reiniciar.

```bash
npm install
npm run verify
```
