# PROMPT MAESTRO ACTUALIZADO — SISTEMA PRESUPUESTAL SIN LOGIN

## Proyecto

**Sistema Integral de Formulación, Control y Evaluación Presupuestal Empresarial**

Repositorio:

- `red456loto-star/Sistema-formulaci-n-presupuestal`
- `https://github.com/red456loto-star/Sistema-formulaci-n-presupuestal`

Actúa como arquitecto senior de software, analista funcional, especialista en contabilidad de costos, formulación presupuestal, control de gestión, planeamiento financiero, bases de datos, aplicaciones de escritorio offline, importación flexible de Excel y experiencia de usuario empresarial.

## Fuente de verdad

La única fuente funcional obligatoria es el PDF:

**MONOGRAFIA 02 GE704W 2026 01 (1).pdf**

No añadir módulos, pantallas ni requisitos que no sean necesarios para cumplir el PDF o para mantener técnicamente estable el aplicativo.

## Regla definitiva sobre acceso

El sistema será una aplicación local y offline de acceso directo.

Al abrir el ejecutable debe mostrarse inmediatamente el panel principal.

Queda prohibido implementar:

- Login.
- Registro de cuentas.
- Usuarios.
- Roles.
- Permisos.
- Contraseñas.
- Sesiones.
- Tokens.
- Recuperación de contraseña.
- Cierre de sesión.
- Autenticación externa.
- Perfiles privados.
- Cuenta obligatoria para responsables.

Los responsables son registros empresariales, no usuarios del sistema.

Cuando un flujo requiera identificar a una persona, se utilizará:

- Responsable seleccionado.
- Nombre registrado.
- Cargo.
- Correo.
- Fecha.
- Observación.

## Objetivo general

Construir una aplicación empresarial que permita:

- Registrar múltiples periodos presupuestales.
- Registrar múltiples versiones.
- Formular el presupuesto original anual con detalle mensual.
- Proyectar los tres años siguientes con detalle anual.
- Elaborar forecast con información real hasta un mes de corte y proyección en los meses restantes.
- Importar información desde Excel.
- Manejar campos presupuestados y reales.
- Elaborar el presupuesto maestro.
- Generar estados financieros presupuestados.
- Realizar análisis vertical, horizontal, ratios, Dupont y EVA.
- Analizar la relevancia de la estructura de costos.
- Analizar variaciones entre presupuesto, real y forecast.
- Presentar dashboard y reportes.
- Formular propuestas de mejora con impacto en la rentabilidad.
- Enviar por correo el presupuesto aprobado de cada centro a su responsable.
- Funcionar sin internet mediante un ejecutable portátil para Windows.

## Arquitectura técnica

Preferentemente:

- Frontend: React + TypeScript.
- Backend local: Node.js + TypeScript.
- API REST local.
- Base de datos: SQLite.
- Escritorio: Electron.
- Validación: Zod o equivalente.
- Excel: ExcelJS o equivalente.
- Word: docx o equivalente.
- PDF: biblioteca compatible con Electron.
- Gráficos: Recharts, Chart.js o equivalente.
- GitHub Actions para generar el ejecutable Windows.

## Reglas generales

1. Trabajar por fases.
2. No adelantar funciones de fases futuras.
3. Revisar el repositorio antes de modificarlo.
4. No añadir funcionalidades ajenas al PDF.
5. No implementar autenticación.
6. No volver a crear usuarios, roles o permisos.
7. Mantener consistencia entre frontend, backend y SQLite.
8. Mantener Electron y GitHub Actions operativos.
9. Mostrar errores comprensibles.
10. Separar la información por empresa, ejercicio, periodo y versión.
11. No presentar datos sintéticos como oficiales.
12. Diferenciar datos públicos reales, datos derivados y datos sintéticos.
13. Crear un README por fase.
14. Ejecutar pruebas, typecheck y build.
15. No declarar terminada una fase sin verificación.
16. Priorizar primero lo exigido por el PDF.
17. Evitar pantallas, botones y catálogos redundantes.

## Estructura funcional

`Empresa → Sede → Centro de actividad → Grupo presupuestal → Elemento presupuestal → Cuenta presupuestal`

Cada centro debe tener un responsable con correo para la distribución posterior del presupuesto.

## Módulos autorizados

1. Inicio y dashboard.
2. Empresas y sedes.
3. Responsables y centros de actividad.
4. Estructura presupuestal.
5. Ejercicios y periodos.
6. Versiones presupuestales.
7. Importación desde Excel.
8. Presupuesto original.
9. Información real.
10. Forecast.
11. Presupuesto maestro.
12. Estados financieros.
13. Análisis financiero.
14. Análisis de variaciones.
15. Análisis de relevancia.
16. Dashboard.
17. Reportes.
18. Aprobación por responsables registrados.
19. Correo y pendientes de envío.
20. Propuestas de mejora.
21. Configuración estrictamente necesaria para las funciones anteriores.

No existe un módulo de autenticación ni un módulo de usuarios y roles.

## Fases actualizadas

### Corrección de Fase 2 — Retiro total del login

- Abrir directamente el dashboard.
- Eliminar login, usuarios, roles, permisos, contraseñas, sesiones y tokens del flujo activo.
- Eliminar el menú “Usuarios y roles”.
- Eliminar el bloque de usuario y cerrar sesión.
- Mantener empresas, sedes, responsables, centros, jerarquía, monedas, tipos de cambio y unidades.
- Ajustar API para uso local directo.
- Actualizar pruebas y documentación.
- Generar un nuevo `.exe`.

### Fase 3 — Ejercicios, periodos y versiones

Implementar únicamente:

- Ejercicios presupuestales.
- Año presupuestado.
- Enero a diciembre.
- Tres años posteriores de proyección.
- Apertura y cierre de periodos.
- Bloqueo de periodos cerrados.
- Múltiples versiones por periodo.
- Presupuesto original.
- Presupuesto modificado.
- Forecast.
- Estados: borrador, en revisión, observado, aprobado, cerrado y reemplazado.
- Copia de versiones.
- Historial.
- Relación del forecast con su presupuesto original.
- Selectores reales de ejercicio, periodo y versión.

Las acciones de revisión o aprobación deben registrar responsable, fecha, observación y estado, sin cuentas de usuario.

### Fase 4 — Importación flexible de Excel

- Selección de uno o varios archivos.
- Lectura de una o varias hojas.
- Detección de encabezados.
- Reconocimiento de columnas.
- Mapeo automático y manual.
- Vista previa editable.
- Validaciones.
- Corrección de celdas.
- Eliminación de filas.
- Confirmación.
- Reversión.
- Historial de cargas.
- Registros aceptados, observados y rechazados.
- Contexto de empresa, ejercicio, periodo, versión y tabla destino.

No registrar “usuario de importación”; registrar fecha, archivo y responsable u operador textual cuando sea necesario.

### Fase 5 — Presupuesto original

- Presupuesto anual mensualizado.
- Enero a diciembre.
- Total anual.
- Proyección de tres años.
- Centro.
- Grupo.
- Elemento.
- Cuenta.
- Presupuestado.
- Real, cuando corresponda para comparación.
- Comentario.
- Responsable.
- Versión.
- Validaciones y totales.

### Fase 6 — Presupuesto maestro

Como mínimo:

1. Ventas.
2. Inventarios.
3. Compras.
4. Producción.
5. Materiales directos.
6. Mano de obra directa.
7. Costos indirectos de fabricación.
8. Costos por centro productivo.
9. Gastos por centro de actividad.
10. Inversiones.
11. Estado de resultados presupuestado.
12. Estado de situación financiera presupuestado.

Mantener relaciones y fórmulas entre los componentes.

### Fase 7 — Información real y forecast

- Registro o importación de datos reales.
- Mes de corte.
- Meses anteriores o iguales al corte con información real.
- Meses posteriores con proyección.
- Total forecast.
- Comparación forecast versus original.
- Comparación forecast versus real.
- Múltiples revisiones.
- Explicación de cambios.
- Responsable, fecha y estado.

### Fase 8 — Análisis financiero

- Análisis vertical.
- Análisis horizontal.
- Ratios de liquidez.
- Ratios de gestión.
- Ratios de endeudamiento y solvencia.
- Ratios de rentabilidad.
- Dupont.
- EVA.
- Fórmula.
- Variables.
- Resultado.
- Interpretación.
- Comparación.
- Estado favorable o desfavorable.

### Fase 9 — Variaciones, relevancia y dashboard

Variaciones:

- Original versus real.
- Original versus forecast.
- Forecast versus real.
- Periodo versus periodo.
- Versión versus versión.
- Centro, grupo, elemento y cuenta.

Cálculos:

- Variación monetaria.
- Variación porcentual.
- Porcentaje de ejecución.
- Participación.
- Tendencia.
- Impacto en resultados y rentabilidad.

Dashboard:

- KPI ejecutivos.
- Presupuesto.
- Real.
- Forecast.
- Variación.
- Ejecución.
- Ventas.
- Costos.
- Gastos.
- Resultado.
- Rentabilidad.
- Centros críticos.
- Gráficos y filtros.

### Fase 10 — Reportes, correo y propuestas

Reportes:

- En pantalla.
- Impresos.
- Excel.
- PDF.

Correo:

- Presupuesto aprobado por centro.
- Responsable y correo del catálogo.
- Documento adjunto.
- Fecha.
- Estado.
- Error.
- Pendiente si no existe internet.
- Reintento.

Propuestas:

- Problema.
- Evidencia cuantitativa.
- Causa.
- Acción.
- Impacto esperado.
- Impacto en rentabilidad.
- Responsable.
- Prioridad.
- Plazo.
- Estado.

### Fase final — Documentación y entrega

Generar:

- Word de análisis funcional, base de datos, diseño y casos de uso.
- Word con códigos de programación.
- Excel de datos importados.
- Manual descriptivo.
- Manual de usuario.
- Ejecutable portátil.
- Excel de reportes.
- Informe de pruebas.
- Excel del presupuesto maestro y variaciones.
- Word de propuestas y versiones finales original y forecast.
- ZIP o RAR final.

## Criterio de aceptación global

El sistema se considera terminado cuando cumple todas las funciones solicitadas en el PDF, abre directamente sin login, funciona offline, conserva datos en SQLite, genera reportes y ejecutable, y supera pruebas funcionales y técnicas.

No añadir funcionalidades ajenas al enunciado.
