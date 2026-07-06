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

## Acceso

El ejecutable abre directamente el panel principal. El sistema no utiliza login, cuentas de usuario, contraseñas, roles, permisos, sesiones ni tokens.

Los responsables son registros empresariales con nombre, cargo y correo; no son cuentas de acceso.

## Contexto presupuestal

La barra superior permite seleccionar empresa, ejercicio, periodo y versión. Los selectores son dependientes y conservan el contexto localmente.

### Información real

La pantalla **Información real** permite registrar o importar valores por empresa, ejercicio, versión original, periodo, centro, cuenta y tipo de presupuesto. Cada registro conserva:

- Valor presupuestado.
- Valor real.
- Clasificación de la fuente.
- Fuente o referencia.
- Periodo y fecha de la fuente.
- Responsable y comentario.

Los datos se distinguen como reales publicados, reales internos, derivados o demostrativos. El sistema no atribuye datos sintéticos a una empresa real.

### Forecast

La pantalla **Forecast** crea una revisión vinculada a una versión original aprobada o cerrada:

```text
Meses hasta el corte = información real
Meses posteriores al corte = proyección forecast
```

Cada revisión registra código, número de revisión, mes de corte, responsable, observación, estado y fecha. Los meses reales quedan protegidos y una versión aprobada queda bloqueada.

La documentación detallada está en `README_FASE_7.md`.

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
