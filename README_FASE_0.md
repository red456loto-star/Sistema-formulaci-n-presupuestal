
# Fase 0 — Alcance funcional corregido

## Fuente de verdad

El alcance funcional se basa exclusivamente en el PDF **MONOGRAFIA 02 GE704W 2026 01 (1).pdf**.

## Funciones solicitadas

1. Múltiples periodos de presupuestación.
2. Múltiples versiones presupuestales.
3. Presupuesto original anual con detalle mensual.
4. Proyección anual para los tres años siguientes.
5. Forecast con información real hasta un periodo de corte y proyección posterior.
6. Importación de tablas maestras desde Excel.
7. Campos presupuestado y real.
8. Presupuesto maestro: ventas, inventarios, compras, producción, costos por centro productivo, gastos por centro, inversión y estados financieros.
9. Estado de situación financiera y estado de resultados presupuestados.
10. Análisis vertical, horizontal, ratios, Dupont y EVA.
11. Análisis de relevancia de la estructura de costos.
12. Variaciones entre datos presupuestados y reales por periodo, presupuesto, elemento y centro.
13. Dashboard presupuestal.
14. Reportes impresos y en pantalla.
15. Propuestas de mejora con impacto positivo en la rentabilidad.
16. Envío por correo del presupuesto aprobado a cada responsable de centro.
17. Ejecutable Windows offline que no requiera instalar software adicional.
18. Información real de una empresa, con fuentes y tratamiento claramente documentados.

## Regla de acceso

El PDF no solicita autenticación. Por ello, el aplicativo es local y de acceso directo:

- No existe login.
- No existen usuarios.
- No existen roles ni permisos.
- No existen contraseñas.
- No existen sesiones ni tokens.
- Los responsables son registros empresariales, no cuentas de acceso.

## Arquitectura

- React + TypeScript.
- Node.js + TypeScript.
- API REST local.
- SQLite.
- Electron.
- GitHub Actions para el ejecutable Windows.

## Estructura de soporte

Para organizar el presupuesto y enviar posteriormente el documento aprobado al responsable, se utiliza:

`Empresa → Sede → Centro de actividad → Grupo presupuestal → Elemento presupuestal → Cuenta presupuestal`

Esta estructura es de soporte a las funciones exigidas por el PDF y no introduce autenticación.

## Plan de fases actualizado

1. Base técnica.
2. Empresas, responsables, centros, estructura y tablas maestras.
3. Periodos y versiones.
4. Importación Excel.
5. Presupuesto original.
6. Presupuesto maestro.
7. Información real y forecast.
8. Estados financieros y análisis integral.
9. Variaciones, relevancia y dashboard.
10. Reportes, correo y propuestas.
11. Documentación, pruebas y entrega final.

No se añadirán funciones que no estén justificadas por el PDF o por una necesidad técnica indispensable.
