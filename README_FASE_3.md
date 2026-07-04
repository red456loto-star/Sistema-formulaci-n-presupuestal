# Fase 3 — Multiperiodos y multiversiones

## Objetivo

Implementar la base temporal y de versiones del sistema presupuestal, manteniendo el acceso local directo y sin registrar todavía importes.

## Funcionalidades

### Ejercicios presupuestales

- Ejercicios separados por empresa.
- Código y año presupuestado únicos por empresa.
- Moneda activa.
- Fechas anuales del 1 de enero al 31 de diciembre.
- Estado activo o inactivo.
- Observaciones y trazabilidad técnica.

Al crear un ejercicio se generan automáticamente:

- Doce periodos mensuales.
- Tres años posteriores de proyección.

### Periodos mensuales

- Enero a diciembre.
- Fechas calculadas con calendario real, incluyendo años bisiestos.
- Estados `ABIERTO` y `CERRADO`.
- Cierre y reapertura con responsable y observación.
- Los cierres quedan disponibles para bloquear movimientos en las fases siguientes.

### Años proyectados

Cada ejercicio incorpora tres años posteriores con orden, año, descripción y estado. En esta fase no se registran montos.

### Versiones presupuestales

Tipos:

- `ORIGINAL`.
- `FORECAST`.

Estados:

- `BORRADOR`.
- `APROBADO`.
- `CERRADO`.
- `REEMPLAZADO`.

Controles:

- Solo los borradores pueden editarse.
- Un forecast necesita un original aprobado o cerrado del mismo ejercicio.
- Se pueden copiar metadatos para generar una revisión.
- Una versión aprobada puede cerrarse.
- Una versión aprobada o cerrada puede marcarse como reemplazada por otra versión válida.
- Cada cambio de estado conserva responsable, fecha y observación.

### Contexto superior

Los selectores de la barra superior son funcionales y dependientes:

```text
Empresa → Ejercicio → Periodo
                    └→ Versión
```

La selección se conserva localmente. Al cambiar la empresa o el ejercicio se limpian selecciones incompatibles.

## Base de datos

La migración 4 incorpora:

- `budget_exercises`.
- `budget_periods`.
- `projection_years`.
- `budget_versions`.
- `version_status_history`.

Incluye claves foráneas, restricciones únicas, validaciones de estado e índices por empresa y ejercicio. No utiliza `user_id`.

## API local

### Ejercicios

- `GET /api/catalog/ejercicios`
- `POST /api/catalog/ejercicios`
- `PATCH /api/catalog/ejercicios/:id`
- `DELETE /api/catalog/ejercicios/:id`

### Periodos y proyección

- `GET /api/catalog/periodos`
- `POST /api/catalog/periodos/:id/cerrar`
- `POST /api/catalog/periodos/:id/reabrir`
- `GET /api/catalog/proyecciones`

### Versiones

- `GET /api/catalog/versiones`
- `POST /api/catalog/versiones`
- `PATCH /api/catalog/versiones/:id`
- `POST /api/catalog/versiones/:id/copiar`
- `POST /api/catalog/versiones/:id/aprobar`
- `POST /api/catalog/versiones/:id/cerrar`
- `POST /api/catalog/versiones/:id/reemplazar`
- `GET /api/catalog/versiones/:id/historial`

Todas las rutas funcionan sin token ni autenticación.

## Pruebas

Las pruebas cubren:

- Creación de ejercicios.
- Rechazo de años duplicados.
- Generación de doce meses.
- Año bisiesto.
- Tres años de proyección.
- Cierre y reapertura de periodos.
- Versión original.
- Bloqueo de una versión aprobada.
- Forecast vinculado al original.
- Copia y numeración de versiones.
- Reemplazo e historial.
- Persistencia después de reiniciar.
- Ausencia de endpoints de autenticación.
- Aplicación de la migración 4.

Comando:

```bash
npm run verify
```

## Datos demostrativos

El ejercicio 2027, sus periodos, años proyectados y versión inicial pertenecen únicamente a la empresa demostrativa y están identificados como datos sintéticos de validación. No representan información oficial de una empresa real.

## Fuera del alcance

No se implementan todavía:

- Importes presupuestales.
- Importación Excel.
- Presupuesto original mensual.
- Datos reales.
- Forecast con valores.
- Presupuesto maestro.
- Estados financieros.
- Dashboard.
- Reportes finales.
- Correo.
