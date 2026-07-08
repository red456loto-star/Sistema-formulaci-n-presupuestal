# Fase 10 — Reportes, correo y propuestas de mejora

## Alcance

La Fase 10 completa la distribución y el uso gerencial de la información presupuestal mediante:

- Reportes en pantalla.
- Formatos imprimibles.
- Exportación Excel.
- Exportación PDF.
- Generación del presupuesto aprobado por centro.
- Envío por correo al responsable registrado.
- Cola local de envíos pendientes.
- Reintento posterior.
- Historial de resultados y errores.
- Propuestas de mejora sustentadas en evidencia cuantitativa.

El sistema continúa siendo local, offline y sin login. El correo es la única función que necesita conectividad.

## Reportes disponibles

1. Presupuesto original mensualizado.
2. Forecast.
3. Presupuesto maestro.
4. Estados y análisis financiero.
5. Variaciones.
6. Presupuesto por centros de actividad.
7. Resumen ejecutivo.
8. Dashboard presupuestal.
9. Propuestas de mejora.

Todos los reportes respetan el contexto de empresa, ejercicio, periodo, versión, centro y responsable. La vista previa utiliza el mismo modelo de datos que las exportaciones para evitar diferencias entre pantalla, Excel, PDF e impresión.

## Formatos

### Pantalla

Incluye título, contexto, indicadores de resumen, notas y tabla detallada con búsqueda.

### Impresión

La interfaz incluye estilos de impresión A4 horizontal. Los menús, botones y filtros no aparecen en el documento impreso.

### Excel

Cada archivo incluye:

- Hoja `Resumen` con contexto, indicadores y advertencias.
- Hoja `Detalle` con filtros, formatos numéricos y configuración de impresión.

### PDF

El PDF se genera localmente mediante PDFKit. Incluye encabezado empresarial, contexto, resumen, detalle tabular y advertencias. No requiere internet.

## Correo por centro

Solo se permite enviar versiones en estado `APROBADO` o `CERRADO`.

El destinatario se obtiene de:

`Centro de actividad → Responsable empresarial → Correo`

Antes del intento se valida:

- Empresa y ejercicio.
- Versión aprobada o cerrada.
- Centro perteneciente a la empresa.
- Responsable activo.
- Correo válido.
- PDF generado correctamente.

El documento se guarda primero en la carpeta local de salida. Después se intenta el envío SMTP.

### Sin conexión

Si no existe conectividad:

1. El PDF permanece generado localmente.
2. El registro queda en estado `PENDIENTE`.
3. Se conserva el error de conexión.
4. El usuario puede descargar el documento.
5. El usuario puede reintentar posteriormente.

### Historial

Se registra:

- Fecha de creación.
- Empresa y ejercicio.
- Periodo.
- Versión.
- Centro.
- Responsable.
- Cargo.
- Correo.
- Nombre del documento.
- Estado.
- Error.
- Número de reintentos.
- Fecha del último intento.
- Fecha de envío exitoso.

### Seguridad SMTP

Se pueden guardar host, puerto, modo seguro, usuario, nombre remitente y correo remitente. La contraseña o clave de aplicación se utiliza únicamente durante el envío o reintento actual y **no se almacena en SQLite**.

## Propuestas de mejora

Cada propuesta incluye:

- Problema identificado.
- Evidencia cuantitativa.
- Unidad y explicación de la evidencia.
- Centro, elemento o cuenta relacionados.
- Causa probable.
- Acción propuesta.
- Impacto esperado.
- Impacto esperado en rentabilidad.
- Responsable empresarial.
- Prioridad.
- Plazo.
- Estado.

Los estados disponibles son:

- Propuesta.
- Aprobada.
- En ejecución.
- Implementada.
- Descartada.

## Sugerencias automáticas

El sistema puede analizar la versión seleccionada y proponer acciones únicamente cuando encuentra desviaciones desfavorables cuantificables. Las sugerencias usan:

- Naturaleza de la cuenta.
- Variación monetaria.
- Variación porcentual.
- Participación dentro del impacto total.
- Centro y responsable.
- Efecto estimado en resultado y rentabilidad.

Las causas presentadas son hipótesis empresariales que deben confirmarse con el responsable. La sugerencia no se guarda automáticamente: primero debe ser revisada y registrada.

## Persistencia

La migración 11 crea:

- `smtp_settings`.
- `email_deliveries`.
- `improvement_proposals`.

Los reportes se calculan desde los datos existentes y no duplican cifras en SQLite. Los PDFs de correo se conservan en la carpeta local `phase10/outbox` dentro del directorio de datos del aplicativo.

## API local

### Reportes

- `GET /api/phase10/options`
- `POST /api/phase10/reports/preview`
- `POST /api/phase10/reports/excel`
- `POST /api/phase10/reports/pdf`

### Correo

- `GET /api/phase10/smtp-settings`
- `PUT /api/phase10/smtp-settings`
- `GET /api/phase10/email-history`
- `POST /api/phase10/email/send`
- `POST /api/phase10/email/:id/retry`
- `GET /api/phase10/email/:id/attachment`

### Propuestas

- `GET /api/phase10/proposals`
- `POST /api/phase10/proposals`
- `PATCH /api/phase10/proposals/:id`
- `POST /api/phase10/proposals/suggestions`

## Pruebas

La regresión `tests/phase10.test.mjs` valida:

- Acceso directo sin autenticación.
- Reportes en pantalla.
- Filtros por centro.
- Exportación Excel.
- Exportación PDF.
- Generación del documento por centro.
- Restricción a versiones aprobadas.
- Correo inválido.
- Falta de internet.
- Cola pendiente.
- Descarga del adjunto.
- Reintentos.
- Envío exitoso simulado.
- Propuestas con evidencia.
- Actualización de estado.
- Persistencia del historial.

```bash
npm install
npm run verify
```

## Entrega Windows completa

GitHub Actions publica un único artifact que contiene:

- El ejecutable portátil `.exe`.
- La carpeta `win-unpacked` completa.
- Todos los componentes necesarios de Electron, frontend, API y SQLite.

La carpeta descomprimida se incluye como respaldo técnico; el usuario final puede ejecutar directamente el `.exe` portátil.
