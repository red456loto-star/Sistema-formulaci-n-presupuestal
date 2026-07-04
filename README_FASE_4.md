# Fase 4 — Importación de tablas maestras desde Excel

## Objetivo

La Fase 4 incorpora un flujo local para importar tablas maestras desde archivos `.xlsx`. No registra importes presupuestales, datos reales cuantitativos, forecast ni estados financieros. La aplicación continúa funcionando sin login, usuarios, roles, permisos, sesiones ni tokens.

## Flujo implementado

```text
Archivo → hojas → encabezados → mapeo → validación
→ corrección o exclusión → confirmación → resumen e historial
```

## Tablas importables

- Empresas, sedes, responsables y centros.
- Grupos, elementos y cuentas presupuestales.
- Monedas, tipos de cambio y unidades de medida.

Las tablas organizacionales y presupuestales respetan la empresa activa. Los parámetros transversales no mezclan identificadores empresariales.

## Flexibilidad

- Archivos `.xlsx` de hasta 20 MB.
- Hasta 5,000 filas por importación.
- Detección de encabezados en las primeras 20 filas.
- Columnas en distinto orden y columnas adicionales.
- Nombres equivalentes y mapeo manual.
- Selección de hoja, vista previa y plantillas descargables.

## Validaciones y resultados

Se controlan archivos corruptos, hojas inexistentes, campos obligatorios, correos, fechas, números, códigos, estados, duplicados y relaciones entre catálogos.

Las filas se clasifican como `VALIDO`, `OBSERVADO`, `RECHAZADO` o `EXCLUIDO`. Una fila rechazada debe corregirse o excluirse antes de confirmar. Los duplicados válidos pueden omitirse o actualizarse.

Cada importación diferencia filas leídas, válidas, observadas, rechazadas y excluidas, además de registros creados, actualizados y omitidos. El historial genera un Excel con errores y observaciones por fila.

## Base de datos

La migración 5 agrega:

- `import_batches`.
- `import_batch_rows`.
- `real_data_sources`.

No se utiliza `user_id`.

## API local

- `GET /api/import/catalogs`.
- `POST /api/import/inspect`.
- `GET /api/import/suggest/:target`.
- `POST /api/import/analyze`.
- `POST /api/import/confirm`.
- `GET /api/import/history`.
- `GET /api/import/history/:id/rows`.
- `GET /api/import/history/:id/errors`.
- `GET /api/import/template/:target`.
- `GET /api/import/sources`.

Todas las rutas funcionan sin autenticación.

## Empresa real documentada

La referencia seleccionada es **Corporación Aceros Arequipa S.A.**, usando su portal oficial de inversionistas en el dominio `investors.acerosarequipa.com`.

- Fecha de consulta: 4 de julio de 2026.
- Periodo documentado: Memoria Integrada 2025 y contenido corporativo publicado.
- Campos verificados: denominación corporativa, actividad siderúrgica y disponibilidad de la memoria integrada.
- Transformación: normalización de denominaciones para tablas maestras.

No se incorporaron importes financieros, RUC ni campos faltantes atribuyéndolos falsamente a la empresa. Los datos demostrativos permanecen diferenciados de la información pública real.

## Pruebas

Las pruebas cubren archivos válidos y corruptos, hojas inexistentes, columnas desordenadas o faltantes, duplicados, correos inválidos, relaciones incorrectas, creación, actualización, exclusión, persistencia y separación por empresa.

```bash
npm run verify
```

## Fuera de alcance

No se implementan todavía montos, presupuesto original mensual, datos reales cuantitativos, forecast con valores, presupuesto maestro, estados financieros, dashboard, reportes finales ni correo.
