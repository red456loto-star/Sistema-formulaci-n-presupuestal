# PresuControl Empresarial

Aplicación de escritorio local para formulación, control y evaluación presupuestal empresarial.

## Estado

- **Fase 0:** análisis funcional y arquitectura.
- **Fase 1:** base técnica React, TypeScript, Node.js, SQLite y Electron.
- **Fase 2 corregida:** empresas, responsables, centros y estructura presupuestal.
- **Fase 3:** ejercicios, periodos y versiones original/forecast.
- **Fases 4–10:** importación, presupuesto maestro, información real, forecast, análisis, dashboard, reportes, correo y propuestas.
- **Fase 11:** corrección de jerarquía, tipos de presupuesto, tablas maestras únicas por contexto y análisis automáticos.

## Acceso

El ejecutable abre directamente sin login. El sistema no utiliza cuentas de usuario, contraseñas, roles, permisos, sesiones ni tokens.

Los responsables son registros empresariales con nombre, cargo y correo; no son cuentas de acceso.

## Flujo obligatorio

El menú está organizado en este orden:

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

Las opciones posteriores permanecen bloqueadas hasta completar las anteriores. Variaciones y dashboard se calculan directamente desde las tablas maestras y no dependen de visitar previamente otras pantallas de análisis.

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

La documentación detallada está en `README_FASE_11.md`.

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
