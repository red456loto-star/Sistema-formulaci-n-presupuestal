# PROMPTS ACTUALIZADOS POR FASE — SISTEMA PRESUPUESTAL SIN LOGIN

## Instrucción común para todas las fases

Trabaja sobre el repositorio:

- `red456loto-star/Sistema-formulaci-n-presupuestal`
- Rama base: `main`

Antes de modificar:

1. Revisa el estado actual del repositorio.
2. Conserva React, TypeScript, Node.js, SQLite, Electron y GitHub Actions.
3. No implementes funciones pertenecientes a otra fase.
4. No añadas funcionalidades que no estén justificadas por el PDF `MONOGRAFIA 02 GE704W 2026 01 (1).pdf`.
5. Mantén el sistema local y offline, excepto la función de correo.
6. No implementes login, usuarios, cuentas, contraseñas, roles, permisos, sesiones, tokens ni cerrar sesión.
7. Los responsables son registros empresariales, no cuentas de acceso.
8. Cuando se deba identificar a una persona, utiliza responsable, nombre, cargo, correo, fecha y observación.
9. No presentes información sintética como si fuera oficial.
10. Ejecuta `npm run verify` antes de cerrar la fase.
11. Mantén operativo el build del ejecutable Windows.
12. Actualiza el README de la fase y agrega pruebas automáticas.

---

# PROMPT FASE 3 — MULTIPERIODOS Y MULTIVERSIONES

## Objetivo

Implementar la base temporal exigida por el PDF: múltiples periodos y múltiples versiones de presupuestación.

## Alcance obligatorio

### Ejercicios presupuestales

Crear un catálogo de ejercicios con:

- Empresa.
- Código.
- Año base.
- Año presupuestado.
- Fecha de inicio.
- Fecha de fin.
- Moneda.
- Estado activo o inactivo.
- Observación.

### Periodos

Al crear un ejercicio anual, generar automáticamente enero a diciembre con:

- Número de periodo del 1 al 12.
- Nombre del mes.
- Fecha inicial.
- Fecha final.
- Estado abierto o cerrado.

Permitir múltiples ejercicios y periodos sin mezclar empresas.

### Proyección de tres años

Registrar los tres años posteriores al año presupuestado. En esta fase solo se crea su estructura temporal; todavía no se capturan importes.

### Versiones presupuestales

Crear múltiples versiones vinculadas a:

- Empresa.
- Ejercicio.
- Periodo o alcance anual.
- Tipo: original o forecast.
- Código y nombre.
- Número de revisión.
- Fecha de creación.
- Estado.
- Observación.
- Responsable registrado, cuando corresponda.

No crear usuarios ni flujos por permisos.

### Estados mínimos

Utilizar únicamente estados necesarios para controlar la edición y reconocer un presupuesto aprobado:

- Borrador.
- Aprobado.
- Cerrado.
- Reemplazado.

Los estados adicionales solo se implementarán si son necesarios para el flujo real del sistema.

### Selectores

Convertir en funcionales los selectores superiores de:

- Empresa.
- Ejercicio.
- Periodo.
- Versión.

El contexto seleccionado debe persistir localmente.

## Validaciones

- Ejercicio único por empresa y año presupuestado.
- Doce periodos por ejercicio.
- Periodo perteneciente al ejercicio.
- Versión perteneciente a empresa y ejercicio.
- Una versión aprobada o cerrada no se modifica directamente.
- No mezclar datos entre empresas, ejercicios, periodos o versiones.

## Pruebas

- Crear varios ejercicios.
- Generar doce meses.
- Crear varias versiones.
- Cambiar selectores.
- Bloquear una versión aprobada.
- Confirmar persistencia al cerrar y abrir.
- Confirmar que no exista ninguna pantalla o endpoint de autenticación.

## Fuera de alcance

- Importes presupuestales.
- Importación Excel.
- Presupuesto original.
- Forecast con valores.
- Presupuesto maestro.

---

# PROMPT FASE 4 — IMPORTACIÓN DE TABLAS MAESTRAS DESDE EXCEL

## Objetivo

Implementar la importación de información para las tablas maestras utilizadas por el sistema, tal como solicita el PDF.

## Alcance obligatorio

Permitir seleccionar archivos `.xlsx` y `.xls` compatibles y realizar:

1. Lectura de hojas.
2. Selección de hoja.
3. Detección de encabezados.
4. Vista previa.
5. Mapeo de columnas.
6. Validación de datos.
7. Confirmación de importación.
8. Resumen de resultados.

### Tablas maestras iniciales

- Empresas, cuando corresponda.
- Sedes.
- Responsables.
- Centros de actividad.
- Grupos presupuestales.
- Elementos presupuestales.
- Cuentas presupuestales.
- Monedas.
- Tipos de cambio.
- Unidades de medida.

### Resultado de importación

Mostrar:

- Total de filas leídas.
- Filas válidas.
- Filas rechazadas.
- Duplicados.
- Errores por fila y columna.
- Registros creados.
- Registros actualizados, únicamente si el usuario confirma esa modalidad.

### Contexto

Toda importación debe respetar:

- Empresa activa.
- Tabla de destino.
- Fecha del archivo.
- Nombre del archivo.

No registrar usuario de importación. Se puede registrar responsable u operador como texto opcional.

## Validaciones

- Archivo válido y no corrupto.
- Hoja existente.
- Encabezados requeridos.
- Correo válido.
- Códigos únicos.
- Relaciones válidas entre empresa, centro, grupo, elemento y cuenta.
- No confirmar una importación con errores críticos.

## Entregables de la fase

- Plantillas Excel de ejemplo.
- Pantalla de importación.
- Vista previa.
- Pruebas con archivos válidos e inválidos.
- README de importación.

## Fuera de alcance

- Presupuesto original.
- Datos reales.
- Forecast.
- Presupuesto maestro.

---

# PROMPT FASE 5 — PRESUPUESTO ORIGINAL

## Objetivo

Implementar el presupuesto original del próximo periodo anual con detalle mensual y proyección anual de los tres años posteriores.

## Alcance obligatorio

### Dimensiones

Cada registro debe relacionarse con:

- Empresa.
- Ejercicio.
- Versión original.
- Centro de actividad.
- Grupo.
- Elemento.
- Cuenta.
- Unidad de medida, cuando corresponda.
- Moneda.

### Captura mensual

Incluir:

- Enero a diciembre.
- Total anual calculado.
- Campo presupuestado.
- Campo real disponible para la comparación posterior, aunque inicialmente pueda quedar vacío o en cero.
- Comentario o sustento.

### Proyección

Incluir tres columnas o registros anuales para:

- Año presupuestado + 1.
- Año presupuestado + 2.
- Año presupuestado + 3.

### Operaciones

- Captura manual.
- Copia de meses.
- Distribución uniforme de un total anual.
- Pegado desde portapapeles, si es estable.
- Totales por cuenta, elemento, grupo, centro y empresa.
- Guardado automático controlado o guardado explícito.

### Estados

Permitir marcar la versión original como aprobada para que posteriormente pueda enviarse por correo y servir como base del forecast.

La aprobación registra:

- Responsable seleccionado o nombre.
- Fecha.
- Observación.

No requiere cuenta de acceso.

## Validaciones

- Solo editar versiones en borrador.
- Importes numéricos.
- No mezclar versiones.
- Total anual igual a la suma mensual.
- Tres años de proyección completos.
- Centro y cuenta pertenecientes a la misma empresa.

## Pruebas

- Crear líneas mensuales.
- Calcular totales.
- Proyectar tres años.
- Cambiar filtros.
- Aprobar y bloquear una versión.

---

# PROMPT FASE 6 — PRESUPUESTO MAESTRO

## Objetivo

Implementar los componentes del presupuesto maestro solicitados expresamente por el PDF.

## Componentes obligatorios

1. Presupuesto de ventas.
2. Presupuesto de inventarios.
3. Presupuesto de compras.
4. Presupuesto de producción.
5. Presupuesto de costos por centro de actividad productivo.
6. Presupuesto de gastos por centro de actividad.
7. Presupuesto de inversión.
8. Estado de resultados presupuestado.
9. Estado de situación financiera presupuestado.

## Reglas de cálculo

### Ventas

- Cantidad.
- Precio.
- Ingreso presupuestado.
- Detalle mensual.

### Inventarios

- Inventario inicial.
- Inventario final deseado.
- Entradas.
- Salidas.

### Compras

Relacionar necesidades, inventarios y compras.

### Producción

Utilizar la relación:

`Ventas presupuestadas + inventario final deseado - inventario inicial`.

### Costos por centro productivo

Permitir materiales, mano de obra y costos indirectos o las categorías definidas en las tablas maestras.

### Gastos por centro

Consolidar cuentas de gasto por centro de actividad.

### Inversión

- Descripción.
- Fecha o periodo.
- Importe.
- Vida útil, si corresponde.
- Depreciación presupuestada, si se utiliza en los estados financieros.

### Estados financieros

Los estados deben generarse desde los presupuestos, no mediante cifras escritas manualmente sin vínculo.

## Reportes de fase

- Pantalla de cada componente.
- Consolidado mensual.
- Total anual.
- Exportación Excel de cada componente.

## Validaciones

- Fórmulas consistentes.
- Producción e inventarios no negativos.
- Estados financieros balanceados.
- Totales rastreables hasta el centro y cuenta.

---

# PROMPT FASE 7 — INFORMACIÓN REAL Y FORECAST

## Objetivo

Implementar los dos campos solicitados, presupuestado y real, y elaborar el presupuesto revisado o forecast.

## Información real

Permitir registrar o importar valores reales por:

- Empresa.
- Ejercicio.
- Periodo.
- Centro.
- Elemento.
- Cuenta.
- Tipo de presupuesto.

## Forecast

Seleccionar:

- Presupuesto original de origen.
- Mes de corte.

Regla:

- Meses hasta el corte: información real.
- Meses posteriores al corte: valores proyectados.

Mostrar:

- Presupuesto original.
- Real.
- Forecast.
- Total anual revisado.
- Diferencia respecto al original.
- Comentario explicativo.

Permitir múltiples versiones forecast por periodo, sin usuarios ni roles.

## Aprobación

La versión final forecast puede marcarse como aprobada registrando responsable, fecha y observación.

## Validaciones

- Mes de corte entre enero y diciembre.
- Forecast vinculado a un original.
- Datos reales no duplicados.
- Meses posteriores al corte no deben reemplazar los valores reales anteriores.
- Totales consistentes.

---

# PROMPT FASE 8 — ESTADOS FINANCIEROS Y ANÁLISIS INTEGRAL

## Objetivo

Implementar los análisis financieros solicitados por el PDF.

## Estados financieros

- Estado de resultados presupuestado.
- Estado de situación financiera presupuestado.
- Versiones original y forecast.
- Comparación con información real cuando exista.

## Análisis vertical

- Base de comparación visible.
- Porcentaje por partida.
- Total de base igual a 100 %.

## Análisis horizontal

- Diferencia monetaria.
- Variación porcentual.
- Comparación entre periodos o versiones.

## Ratios

Como mínimo, cuando los datos estén disponibles:

- Liquidez.
- Gestión.
- Endeudamiento o solvencia.
- Rentabilidad.

Cada ratio debe mostrar:

- Nombre.
- Fórmula.
- Variables utilizadas.
- Resultado.
- Interpretación.

## Dupont

Mostrar sus componentes y relación con la rentabilidad.

## EVA

Mostrar:

- Utilidad operativa después de impuestos.
- Capital invertido.
- Costo de capital utilizado.
- EVA calculado.
- Interpretación.

Los supuestos deben ser visibles y editables sin depender de permisos.

---

# PROMPT FASE 9 — RELEVANCIA, VARIACIONES Y DASHBOARD

## Objetivo

Implementar el análisis de relevancia de costos, las variaciones presupuestado versus real y el dashboard.

## Análisis de relevancia

Evaluar la participación e impacto de:

- Costos variables.
- Costos fijos.
- Costos directos.
- Costos indirectos.
- Costos por centro.
- Elementos y cuentas relevantes.

## Variaciones

Calcular por cada periodo, tipo de presupuesto, elemento y centro:

- Presupuestado versus real.
- Original versus forecast.
- Variación monetaria.
- Variación porcentual.
- Porcentaje de ejecución.
- Participación dentro del total.

Permitir filtros por:

- Empresa.
- Ejercicio.
- Periodo.
- Versión.
- Tipo de presupuesto.
- Centro.
- Grupo.
- Elemento.
- Cuenta.

## Dashboard

Incluir únicamente indicadores útiles para la toma de decisiones:

- Ventas presupuestadas y reales.
- Costos presupuestados y reales.
- Gastos presupuestados y reales.
- Resultado presupuestado, real y forecast.
- Variación total.
- Ejecución porcentual.
- Rentabilidad.
- Centros con mayores desviaciones.
- Elementos con mayor impacto.
- Tendencia mensual.

Utilizar tarjetas, tablas y gráficos claros. Evitar decoración sin utilidad.

---

# PROMPT FASE 10 — REPORTES, CORREO Y PROPUESTAS DE MEJORA

## Objetivo

Completar reportes, envío del presupuesto aprobado por centro y propuestas de mejora.

## Reportes

Crear reportes:

- En pantalla.
- Para impresión.
- Exportables a Excel.
- PDF cuando sea necesario para impresión o correo.

Incluir reportes relevantes de:

- Presupuesto original.
- Forecast.
- Presupuesto maestro.
- Estados financieros.
- Variaciones.
- Centros de actividad.
- Dashboard o resumen ejecutivo.

## Correo

Enviar el presupuesto aprobado de cada centro al responsable registrado.

Usar:

- Nombre del responsable.
- Cargo.
- Correo.
- Centro.
- Versión aprobada.
- Documento adjunto.

Si no hay internet:

- Generar el documento localmente.
- Mostrar que el envío no pudo completarse.
- Permitir reintentar.

No crear cuenta para el responsable.

## Propuestas de mejora

Cada propuesta debe incluir:

- Problema identificado.
- Evidencia cuantitativa.
- Centro, elemento o cuenta afectada.
- Causa probable.
- Acción propuesta.
- Impacto esperado.
- Impacto positivo esperado en rentabilidad.
- Responsable empresarial.
- Plazo.
- Estado.

Generar un informe con propuestas para:

- Presupuesto original.
- Presupuesto revisado forecast.

---

# PROMPT FASE FINAL — DOCUMENTACIÓN, PRUEBAS Y ENTREGA

## Objetivo

Generar todos los entregables solicitados por el PDF.

## Entregables obligatorios

1. Word con análisis funcional, diseño de base de datos, diseño del sistema y diagramas de caso de uso.
2. Word con los códigos de programación.
3. Excel con tablas de datos utilizadas e importadas.
4. Manual descriptivo en Word.
5. Manual de usuario en Word.
6. Ejecutable `.exe` portable, offline y sin instalación de software adicional.
7. Excel con reportes generados.
8. Informe de pruebas en Word.
9. Excel exportado de los componentes del presupuesto maestro y del análisis de variaciones.
10. Word con propuestas de mejora y versiones finales del presupuesto original y forecast.
11. ZIP o RAR final organizado.

## Revisión final

Comprobar:

- El ejecutable abre directamente sin login.
- No existen usuarios, roles, contraseñas ni permisos.
- Todas las funciones del PDF están presentes.
- La información real utilizada tiene fuente documentada.
- El dashboard es útil.
- Los reportes funcionan en pantalla y Excel.
- Todas las pruebas están documentadas.
- El sistema funciona sin internet, excepto el envío de correo.
- El ZIP final no incluye secretos, archivos temporales ni `node_modules`.
