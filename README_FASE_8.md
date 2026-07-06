# Fase 8 — Estados financieros y análisis financiero

## Objetivo

Generar estados financieros comparables y realizar análisis vertical, análisis horizontal, ratios, Dupont y EVA sobre presupuesto original, forecast e información real.

La fase mantiene el funcionamiento local y offline con React, TypeScript, Node.js, SQLite y Electron. No incorpora autenticación, dashboard ejecutivo, análisis multidimensional de variaciones, propuestas ni correo.

## Fuentes comparables

El análisis admite:

- `ORIGINAL`: estados derivados del presupuesto maestro de una versión original.
- `FORECAST`: valores consolidados de una versión forecast.
- `REAL`: información real vinculada a una versión original.

Cada consulta valida que empresa, ejercicio, versión y fuente pertenezcan al mismo contexto.

El periodo puede ser:

- Un mes específico entre enero y diciembre.
- Total anual para resultados y cierre del ejercicio para situación financiera.

## Clasificación de cuentas

Para forecast e información real, cada cuenta debe clasificarse explícitamente en una partida:

- Ventas.
- Costo de ventas.
- Gasto operativo.
- Impuesto a la renta.
- Activo corriente.
- Activo no corriente.
- Pasivo corriente.
- Pasivo no corriente.
- Patrimonio.
- Excluir del análisis.

Los activos corrientes pueden identificar además:

- Efectivo.
- Cuentas por cobrar.
- Inventarios.
- Otros activos corrientes.

La aplicación no presume si un activo o pasivo es corriente o no corriente. La clasificación queda visible y editable.

## Estado de resultados

Partidas mínimas:

```text
Ventas
- Costos
= Utilidad bruta
- Gastos
= Utilidad operativa
= Resultado antes de impuestos
- Impuesto
= Resultado neto
```

Cuando no existe una cuenta de impuesto, el sistema solo lo deriva si se registró una tasa documentada. Sin cuenta ni tasa, el impuesto y resultado neto se muestran como no disponibles.

## Estado de situación financiera

Partidas mínimas:

```text
Activos corrientes
+ Activos no corrientes
= Total activos

Pasivos corrientes
+ Pasivos no corrientes
= Total pasivos
+ Patrimonio
= Total pasivo y patrimonio
```

Validación:

```text
Total activos = Total pasivo + patrimonio
```

La diferencia se muestra en pantalla. No se oculta ni se reemplaza por una partida inventada.

## Análisis vertical

### Estado de resultados

```text
Participación = Partida / Ventas × 100
```

Las ventas constituyen la base de 100 %.

### Estado de situación financiera

Las partidas de activo se comparan con total activos. Las partidas de pasivo y patrimonio se comparan con total pasivo y patrimonio.

```text
Participación = Partida / Base × 100
```

## Análisis horizontal

Compara dos escenarios de una misma empresa. Los escenarios pueden corresponder a distintos:

- Periodos.
- Ejercicios.
- Versiones.
- Tipos de fuente.

Fórmulas:

```text
Diferencia monetaria = Valor final − Valor inicial
Variación porcentual = Diferencia monetaria / |Valor inicial| × 100
```

Cuando el valor inicial es cero, la variación porcentual se muestra como no disponible para evitar división entre cero.

## Ratios financieros

### Liquidez

```text
Liquidez corriente = Activos corrientes / Pasivos corrientes
Prueba ácida = (Activos corrientes − Inventarios) / Pasivos corrientes
```

### Gestión

```text
Rotación de activos = Ventas / Total activos
Rotación de inventarios = Costo de ventas / Inventarios
Rotación de cuentas por cobrar = Ventas / Cuentas por cobrar
```

### Solvencia

```text
Endeudamiento total = Total pasivos / Total activos × 100
Deuda sobre patrimonio = Total pasivos / Patrimonio
```

### Rentabilidad

```text
Margen bruto = Utilidad bruta / Ventas × 100
Margen operativo = Utilidad operativa / Ventas × 100
Margen neto = Resultado neto / Ventas × 100
ROA = Resultado neto / Total activos × 100
ROE = Resultado neto / Patrimonio × 100
```

Cada ratio muestra nombre, fórmula, variables, resultado, unidad, interpretación y fuente.

## Dupont

```text
Margen neto = Resultado neto / Ventas
Rotación de activos = Ventas / Total activos
Multiplicador financiero = Total activos / Patrimonio
ROE Dupont = Margen neto × Rotación de activos × Multiplicador financiero
```

## EVA

```text
NOPAT = Utilidad operativa × (1 − Tasa de impuesto)
Capital invertido = Total activos − Pasivos corrientes
Cargo de capital = Capital invertido × Costo de capital
EVA = NOPAT − Cargo de capital
```

El usuario puede registrar un capital invertido manual cuando disponga de una fuente sustentada. En caso contrario se utiliza la fórmula derivada indicada.

El costo de capital no se inventa. Sin una tasa documentada, el EVA se muestra como no disponible.

## Supuestos

Cada contexto de análisis puede guardar:

- Tasa de impuesto.
- Costo de capital.
- Capital invertido manual opcional.
- Fuente o referencia obligatoria.
- Notas.

Los supuestos se separan por empresa, ejercicio, versión y tipo de fuente.

## Base de datos

La migración 9 crea:

- `financial_account_mappings`.
- `financial_analysis_assumptions`.

## API local

- `GET /api/financial-analysis/mappings`.
- `PUT /api/financial-analysis/mappings`.
- `GET /api/financial-analysis/assumptions`.
- `PUT /api/financial-analysis/assumptions`.
- `GET /api/financial-analysis/report`.
- `POST /api/financial-analysis/horizontal`.
- `GET /api/financial-analysis/export`.

## Exportación Excel

El libro exportado contiene:

- Estado de resultados.
- Estado de situación financiera.
- Análisis vertical.
- Ratios.
- Dupont y EVA.
- Fuentes, supuestos y advertencias.

## Pruebas automatizadas

La suite verifica:

- Estado de resultados.
- Estado de situación financiera balanceado.
- Análisis vertical.
- Análisis horizontal.
- Ratios de las cuatro categorías.
- Dupont.
- EVA con supuestos documentados.
- Presupuesto original, forecast e información real.
- División entre cero y variables faltantes.
- Separación por empresa.
- Exportación Excel.
- Persistencia en SQLite.
- Ausencia de login.

```bash
npm run verify
```

## Fuera de alcance

- Análisis de relevancia de costos.
- Variaciones multidimensionales por centro y elemento.
- Dashboard ejecutivo.
- Reportes imprimibles finales.
- Propuestas de mejora.
- Correo.
