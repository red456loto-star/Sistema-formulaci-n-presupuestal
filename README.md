# PresuControl Empresarial

Aplicación de escritorio local para formulación, control y evaluación presupuestal empresarial.

## Estado actual

El sistema trabaja con un flujo jerárquico obligatorio y sin login. Primero se define la empresa, luego el periodo y la versión, después el tipo de presupuesto, posteriormente se cargan las tablas maestras y recién desde esa fuente se habilitan el presupuesto maestro, los análisis, el dashboard, las propuestas y el correo.

## Acceso

El ejecutable abre directamente sin login. El sistema no utiliza cuentas de usuario, contraseñas, roles, permisos, sesiones ni tokens.

Los responsables son registros empresariales con nombre, cargo y correo; no son cuentas de acceso.

## Flujo obligatorio

El menú está organizado en este orden:

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

Las opciones posteriores permanecen bloqueadas hasta completar las anteriores. Variaciones y dashboard se calculan directamente desde las tablas maestras y no dependen de visitar previamente otras pantallas de análisis.

## Tipos de presupuesto

Los tipos de presupuesto representan la modalidad de trabajo:

- Presupuesto original anual y proyección a 3 años.
- Presupuesto revisado forecast.

Los componentes como ventas, inventarios, compras, producción, costos, gastos, inversión y estados financieros no se registran en esta opción. Esos componentes se visualizan en Presupuesto maestro luego de subir la información.

## Tablas maestras

La información se registra de forma única por:

`Empresa + Ejercicio + Periodo + Versión + Tipo de presupuesto + Origen`

El origen puede ser presupuestado o real. El usuario puede:

- Registrar partidas manualmente.
- Importar presupuestos y estados financieros desde Excel.
- Descargar una plantilla.
- Validar y seleccionar filas.
- Editar partidas registradas.
- Eliminar filas o conjuntos completos.
- Registrar fuente, operador y WACC.

## Presupuesto maestro

Después de subir la información presupuestada, el sistema muestra una vista integrada con:

- Presupuesto de ventas.
- Presupuesto de inventarios.
- Presupuesto de compras.
- Presupuesto de producción.
- Presupuesto de costos por centro de actividad productivo.
- Presupuesto de gastos por centro de actividad.
- Presupuesto de inversión.
- Estado de situación financiera presupuestado.
- Estado de resultados presupuestado.

## Análisis automático

Al registrar datos maestros se actualizan automáticamente:

- Estado de resultados y situación financiera.
- Análisis vertical y horizontal.
- Ratios financieros.
- Dupont.
- EVA.
- Costos fijos, variables, directos e indirectos.
- Variaciones presupuestado versus real.
- Tendencia y dashboard.
- Partidas críticas.

Cada análisis dispone de consulta en pantalla, impresión, Excel y PDF.

## Propuestas y correo

Las propuestas utilizan evidencia cuantitativa de las tablas maestras y registran impacto esperado en rentabilidad, responsable, prioridad, plazo y estado.

El envío por correo utiliza el presupuesto aprobado del centro registrado en las tablas maestras. El PDF se genera localmente antes del intento; si no existe internet, queda pendiente para reintento. La contraseña SMTP no se almacena.

La documentación detallada está en `README_CORRECCIONES.md`.

## Verificación

```bash
npm install
npm run verify
```

## Ejecutable Windows

```bash
npm run desktop:dist
```

GitHub Actions publica el artifact `PresuControl-Empresarial-Windows-Completo`, con el ejecutable portátil y la carpeta `win-unpacked` completa.
