# Correcciones de jerarquía y presupuesto maestro

## Objetivo

El sistema organiza el trabajo presupuestal en una secuencia lógica:

1. Empresa y perfil.
2. Periodos y versiones.
3. Tipos de presupuesto.
4. Tablas maestras.
5. Presupuesto maestro.
6. Análisis financiero integral.
7. Relevancia de costos.
8. Análisis de variaciones.
9. Dashboard de presupuestos.
10. Propuestas de mejora.
11. Envío por correo.

Las opciones posteriores se subordinan a las anteriores para evitar mezclar empresas, periodos, versiones, tipos de presupuesto o fuentes de información.

## Tipos de presupuesto

Esta opción ya no contiene componentes del presupuesto maestro. Solo contiene modalidades presupuestales, por ejemplo:

- Presupuesto original anual y proyección a 3 años.
- Presupuesto revisado forecast.

La primera modalidad permite formular el presupuesto original anual del próximo periodo con detalle mensual y proyectar los tres años posteriores con detalle anual.

La segunda modalidad permite formular un presupuesto revisado con información real hasta cierto periodo y valores proyectados presupuestados para los periodos restantes.

## Presupuesto maestro

El presupuesto maestro es una opción separada y aparece después de Tablas maestras. Permanece bloqueada hasta que exista información presupuestada cargada en el contexto activo.

La vista integrada muestra:

- Presupuesto de ventas.
- Presupuesto de inventarios.
- Presupuesto de compras.
- Presupuesto de producción.
- Presupuesto de costos por centro de actividad productivo.
- Presupuesto de gastos por centro de actividad.
- Presupuesto de inversión.
- Estado de situación financiera presupuestado.
- Estado de resultados presupuestado.

## Tablas maestras

La información se registra de forma única por:

`Empresa + Ejercicio + Periodo + Versión + Tipo de presupuesto + Origen`

El origen puede ser presupuestado o real.

Desde esta opción se puede registrar manualmente, importar desde Excel, editar partidas, eliminar filas y eliminar conjuntos completos.

## Bloqueo progresivo

- Periodos y versiones requieren empresa.
- Tipos de presupuesto requieren empresa, ejercicio, periodo y versión.
- Tablas maestras requieren tipo de presupuesto.
- Presupuesto maestro, análisis, propuestas y correo requieren información maestra.

## Mensajes visibles

Los rótulos visibles de la aplicación evitan mostrar numeraciones de etapa. El usuario ve nombres funcionales: Flujo corregido, Presupuesto maestro, Tablas maestras, Tipos de presupuesto, Análisis y Dashboard.

## Verificación

```bash
npm install
npm run verify
```
