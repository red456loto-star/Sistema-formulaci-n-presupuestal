# Fase 5 — Presupuesto original

## Objetivo

Implementar el presupuesto original anual del ejercicio activo con detalle mensual de enero a diciembre, total anual calculado, valor real diferenciado y proyección anual de los tres años posteriores.

La aplicación continúa siendo local, offline y de acceso directo, sin login, usuarios, roles, permisos, sesiones ni tokens.

## Contexto obligatorio

Cada línea presupuestal se relaciona con:

```text
Empresa
+ Ejercicio
+ Versión ORIGINAL
+ Centro
+ Grupo
+ Elemento
+ Cuenta
+ Periodo
+ Moneda
+ Unidad de medida opcional
```

El grupo y el elemento se obtienen de la cuenta seleccionada. El centro y la cuenta deben pertenecer a la misma empresa y estar relacionados mediante `center_accounts`.

## Datos registrados

Por cada línea:

- Centro, grupo, elemento y cuenta.
- Moneda.
- Unidad de medida opcional.
- Responsable empresarial opcional.
- Comentario.
- Sustento.
- Fuente.
- Valor presupuestado mensual.
- Valor real mensual opcional.
- Tres valores anuales proyectados.

El valor real puede permanecer vacío. La interfaz diferencia claramente:

- Presupuesto anual: suma de enero a diciembre.
- Real registrado: suma de los meses que contienen valor real.
- Presupuesto comparable: presupuesto correspondiente únicamente a los meses que contienen valor real.
- Variación comparable: `real registrado - presupuesto comparable`.

Este criterio evita comparar, por ejemplo, el real disponible solo hasta enero contra el presupuesto completo de enero a diciembre.

## Operaciones

- Captura manual de valores mensuales.
- Edición de metadatos y sustento.
- Total anual automático como suma de los doce meses.
- Distribución de un total anual entre los periodos abiertos.
- Conservación de periodos cerrados durante la distribución.
- Copia de valores entre líneas de la misma empresa, ejercicio y versión.
- Copia opcional de valores reales.
- Proyección de tres años mediante tasas de crecimiento acumulativas.
- Edición manual de las tres proyecciones.
- Filtros por centro, grupo, elemento y cuenta.
- Aprobación mediante responsable registrado.
- Bloqueo de edición cuando la versión deja de estar en borrador.

## Validaciones

- Solo se utilizan versiones de tipo `ORIGINAL`.
- La versión debe pertenecer a la empresa y ejercicio activos.
- La versión debe tener alcance anual.
- Solo una línea por combinación de versión, centro y cuenta.
- El centro, la cuenta, el responsable, la moneda y la unidad deben ser válidos.
- Se generan exactamente doce registros mensuales por línea.
- Se generan exactamente tres registros anuales de proyección por línea.
- Los importes deben ser numéricos finitos.
- Los periodos cerrados no admiten cambios.
- Las versiones aprobadas, cerradas o reemplazadas son de solo consulta.
- La copia de valores no puede mezclar empresas, ejercicios ni versiones.
- La aprobación exige al menos una línea completa.
- Una variación total solo se presenta cuando existe información real; se compara contra el presupuesto de esos mismos meses.

## Base de datos

La migración 6 incorpora:

- `budget_original_lines`.
- `budget_original_monthly_values`.
- `budget_original_projections`.

El total anual, el presupuesto comparable y la variación no se almacenan como valores independientes: se derivan de los registros mensuales para evitar inconsistencias.

## API local

- `GET /api/budget-original/lines`.
- `GET /api/budget-original/lines/:id`.
- `GET /api/budget-original/summary`.
- `POST /api/budget-original/lines`.
- `PATCH /api/budget-original/lines/:id`.
- `DELETE /api/budget-original/lines/:id`.
- `POST /api/budget-original/lines/:id/distribute`.
- `POST /api/budget-original/lines/:id/project`.
- `POST /api/budget-original/lines/:id/copy`.
- `POST /api/budget-original/approve`.

Todas las rutas funcionan sin autenticación.

## Pruebas automatizadas

La suite comprueba:

- Registro de una línea y generación de doce meses.
- Generación de tres años proyectados.
- Captura de presupuesto y valor real.
- Total anual.
- Presupuesto comparable cuando el real es parcial.
- Variación comparable.
- Ausencia de variación cuando no existe valor real.
- Distribución del total anual.
- Proyección con tasas.
- Copia de valores.
- Bloqueo de periodos cerrados.
- Aprobación y bloqueo de versión.
- Separación empresarial.
- Persistencia después de reiniciar.
- Ausencia de login.

```bash
npm run verify
```

## Versión corregida

La corrección del cálculo comparable se publica como versión `0.5.1` para distinguirla del ejecutable inicial `0.5.0`.

## Fuera de alcance

No se implementan todavía:

- Forecast con valores.
- Importación de información real transaccional.
- Presupuesto maestro.
- Estados financieros presupuestados.
- Análisis financiero.
- Dashboard financiero.
- Correo y reportes finales.
