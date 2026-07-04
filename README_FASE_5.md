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

El valor real puede permanecer vacío. La interfaz diferencia claramente el monto presupuestado, el real y la variación `real - presupuesto`.

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

## Base de datos

La migración 6 incorpora:

- `budget_original_lines`.
- `budget_original_monthly_values`.
- `budget_original_projections`.

El total anual no se almacena como un valor independiente: se deriva de la suma mensual para evitar inconsistencias.

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
- Total anual y variación.
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

## Fuera de alcance

No se implementan todavía:

- Forecast con valores.
- Importación de información real transaccional.
- Presupuesto maestro.
- Estados financieros presupuestados.
- Análisis financiero.
- Dashboard financiero.
- Correo y reportes finales.
