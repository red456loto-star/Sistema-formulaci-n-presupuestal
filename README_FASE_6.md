# Fase 6 — Presupuesto maestro

## Objetivo

Integrar los componentes operativos y financieros del presupuesto maestro dentro de una aplicación local, offline y de acceso directo.

La fase mantiene la arquitectura React + TypeScript, API local Node.js, SQLite y Electron. No incorpora login, usuarios, roles, permisos, sesiones ni tokens.

## Contexto obligatorio

Todos los movimientos se separan por:

```text
Empresa + Ejercicio + Versión ORIGINAL anual + Periodo + Centro + Cuenta
```

Las versiones aprobadas, cerradas o reemplazadas son de solo consulta. Los periodos cerrados no admiten cambios.

## Componentes

### Presupuesto de ventas

Registra producto, cantidad, precio, centro, cuenta y periodo.

```text
Venta presupuestada = Cantidad × Precio unitario
```

### Presupuesto de inventarios

Registra inventario inicial, entradas, salidas, inventario final deseado y costo unitario.

```text
Inventario final calculado = Inventario inicial + Entradas − Salidas
Valor del inventario = Inventario final calculado × Costo unitario
```

No se permiten resultados negativos.

### Presupuesto de producción

Se deriva de ventas e inventarios de productos terminados.

```text
Producción requerida = Ventas previstas + Inventario final deseado − Inventario inicial
```

Cuando el inventario inicial cubre las ventas y la meta final, la producción requerida es cero y se muestra una observación.

### Presupuesto de compras

Registra material, necesidades, inventario inicial, inventario final deseado y precio de compra.

```text
Cantidad de compras = Necesidades + Inventario final deseado − Inventario inicial
Total de compras = Cantidad de compras × Precio de compra
```

### Costos por centro productivo

Permite clasificar cada línea como:

- Materiales.
- Mano de obra.
- Costos indirectos de fabricación.
- Fijo o variable.
- Directo o indirecto.

```text
Costo total = Cantidad × Costo unitario
```

La captura de costos exige un centro de tipo `PRODUCTIVO`.

### Gastos por centro

Consolida el gasto por centro, grupo, elemento, cuenta, periodo y versión. También diferencia comportamiento fijo o variable y trazabilidad directa o indirecta.

### Presupuesto de inversión

Registra descripción, centro, cuenta, periodo, importe, vida útil y fuente de financiamiento.

Las fuentes disponibles son caja, deuda o capital. Cuando existe vida útil, la depreciación se calcula en línea recta desde el mes de adquisición.

### Estado de resultados presupuestado

Se deriva de:

- Ventas.
- Materiales.
- Mano de obra.
- Costos indirectos de fabricación.
- Gastos operativos.
- Depreciación de inversiones.
- Tasa presupuestada del impuesto a la renta.

No admite captura manual de sus cifras finales.

### Estado de situación financiera presupuestado

Se deriva de los componentes y de los siguientes saldos o supuestos iniciales estrictamente necesarios:

- Efectivo inicial.
- Cuentas por cobrar iniciales.
- Propiedad, planta y equipo inicial.
- Cuentas por pagar iniciales.
- Deuda inicial.
- Porcentaje de cobranza.
- Porcentaje de pago de compras.

Para mantener la ecuación contable, el sistema deriva efectivo disponible o financiamiento de corto plazo según corresponda.

```text
Activos = Pasivos + Patrimonio
```

## Base de datos

La migración 7 crea:

- `master_items`.
- `master_sales`.
- `master_inventories`.
- `master_purchases`.
- `master_costs`.
- `master_expenses`.
- `master_investments`.
- `master_financial_settings`.

Las ventas, cantidades de compra, producción, depreciación y estados financieros se calculan al consultar; no se duplican como cifras finales independientes.

## API local

### Captura

- `/api/master-budget/items`.
- `/api/master-budget/sales`.
- `/api/master-budget/inventories`.
- `/api/master-budget/purchases`.
- `/api/master-budget/costs`.
- `/api/master-budget/expenses`.
- `/api/master-budget/investments`.
- `/api/master-budget/settings`.

### Cálculo y reportes

- `/api/master-budget/production`.
- `/api/master-budget/income-statement`.
- `/api/master-budget/balance-sheet`.
- `/api/master-budget/summary`.
- `/api/master-budget/export/:component`.

Todas las rutas funcionan sin autenticación.

## Exportación Excel

Se puede exportar individualmente:

- Ventas.
- Inventarios.
- Compras.
- Producción.
- Costos.
- Gastos.
- Inversiones.
- Estado de resultados.
- Estado de situación financiera.

La opción consolidada genera un libro con todos los componentes en hojas separadas.

## Pruebas

La suite de la fase comprueba:

- Cantidad × precio.
- Inventario final y valor de inventario.
- Rechazo de inventarios negativos.
- Fórmula de producción.
- Fórmula y total de compras.
- Materiales, mano de obra y CIF.
- Gastos e inversiones.
- Depreciación.
- Estado de resultados.
- Ecuación del estado de situación financiera.
- Exportación Excel válida.
- Bloqueo de periodos cerrados.
- Bloqueo de versiones aprobadas.
- Persistencia en SQLite.
- Ausencia de login.

```bash
npm run verify
```

## Fuera de alcance de esta fase

- Información real transaccional.
- Forecast con mes de corte.
- Análisis vertical y horizontal.
- Ratios, Dupont y EVA.
- Análisis de variaciones y relevancia de costos.
- Dashboard financiero final.
- Correo y propuestas de mejora.
