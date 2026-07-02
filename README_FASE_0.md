# Fase 0 — Análisis funcional, alcance, arquitectura y plan de desarrollo

## 1. Estado inicial del repositorio

Repositorio analizado:

- **Nombre:** `red456loto-star/Sistema-formulaci-n-presupuestal`
- **Rama principal:** `main`
- **Estado:** repositorio prácticamente vacío.
- **Contenido actual:** únicamente `README.md` con el título inicial del proyecto.

### Archivos que se mantienen

- `README.md`: se mantiene como portada general del repositorio.

### Archivos que deben eliminarse

En esta fase no existe ningún archivo que deba eliminarse.

### Archivo creado en esta fase

- `README_FASE_0.md`

No se crea todavía código fuente, base de datos, ejecutable, workflow ni estructura técnica definitiva.

---

## 2. Nombre propuesto para el sistema

### Nombre comercial principal

**PresuControl Empresarial**

El nombre comunica directamente las dos funciones centrales del sistema: formulación presupuestal y control de ejecución.

### Alternativas

1. **BudgetFlow Empresarial**
2. **PresuGestión 360**
3. **SIGEP — Sistema Integral de Gestión y Evaluación Presupuestal**

Para el desarrollo se usará provisionalmente el nombre técnico:

**Sistema Integral de Formulación, Control y Evaluación Presupuestal Empresarial**.

---

## 3. Resumen ejecutivo

El sistema resolverá la necesidad de formular, revisar, aprobar, ejecutar, controlar y evaluar presupuestos empresariales de forma integrada. Estará orientado a empresas que requieren administrar varias sedes, centros de actividad, responsables, cuentas y versiones presupuestales, manteniendo una separación estricta por empresa, ejercicio, periodo y versión.

La aplicación modernizará la lógica del prototipo presupuestal antiguo conservando su profundidad jerárquica:

`Empresa → Sede → Centro de actividad → Grupo presupuestal → Elemento presupuestal → Cuenta presupuestal`

La solución permitirá trabajar con presupuesto original, escenarios, forecast, información real, comprometido, disponible, presupuesto maestro, estados financieros, análisis de variaciones, indicadores financieros, dashboards, reportes, aprobaciones, correo y propuestas de mejora.

El sistema se desarrollará como aplicación de escritorio para Windows, con funcionamiento local y offline, utilizando React, TypeScript, Node.js, SQLite y Electron. El correo será la única función que podrá requerir internet. Si no existe conexión, el envío quedará pendiente y el documento se generará localmente.

---

## 4. Problema empresarial

Las empresas suelen elaborar sus presupuestos en archivos Excel independientes, correos y sistemas no integrados. Esto produce problemas como:

- Información dispersa entre áreas y responsables.
- Versiones duplicadas o sin trazabilidad.
- Dificultad para conocer cuál presupuesto está aprobado.
- Mezcla de información entre ejercicios, periodos o empresas.
- Pérdida de explicaciones sobre cambios y desviaciones.
- Demora en consolidar presupuestos por centro y cuenta.
- Falta de conexión entre ventas, producción, compras, inventarios, costos y estados financieros.
- Dependencia de plantillas rígidas.
- Poca capacidad de comparar presupuesto, forecast y real.
- Reportes tardíos o elaborados manualmente.
- Escasa visibilidad de centros críticos, sobreejecuciones y riesgos.
- Falta de control sobre aprobaciones y distribución del presupuesto.

El sistema centralizará estos procesos y proporcionará una fuente local única de información presupuestal.

---

## 5. Objetivo general

Desarrollar una aplicación empresarial integral que permita formular, revisar, aprobar, ejecutar, controlar y evaluar presupuestos, conectando la estructura organizacional, el presupuesto maestro, la información real, los forecast, los estados financieros y los análisis de gestión.

---

## 6. Objetivos específicos

1. Registrar múltiples empresas, sedes, centros y responsables.
2. Gestionar ejercicios y periodos presupuestales.
3. Administrar versiones, escenarios y estados de aprobación.
4. Formular presupuestos anuales con detalle mensual.
5. Registrar proyecciones anuales de tres años posteriores.
6. Elaborar forecast combinando valores reales y proyectados.
7. Importar Excel con estructuras variables.
8. Mantener datos presupuestados, reales y comprometidos.
9. Integrar los componentes del presupuesto maestro.
10. Generar estados financieros presupuestados y forecast.
11. Calcular variaciones, indicadores, Dupont y EVA.
12. Presentar dashboards ejecutivos y reportes exportables.
13. Gestionar observaciones, aprobaciones y cierres.
14. Distribuir presupuestos aprobados a responsables.
15. Generar propuestas de mejora sustentadas en datos.
16. Mantener auditoría y trazabilidad completa.
17. Funcionar sin internet y conservar la información localmente.

---

## 7. Alcance funcional

### Incluido

- Usuarios, roles y permisos.
- Empresas y sedes.
- Responsables y centros de actividad.
- Grupos, elementos y cuentas presupuestales.
- Ejercicios y periodos.
- Versiones y escenarios.
- Presupuesto original.
- Proyección de tres años.
- Importación de Excel.
- Información real y comprometida.
- Forecast.
- Presupuesto maestro.
- Estados financieros presupuestados.
- Análisis vertical y horizontal.
- Ratios financieros.
- Dupont y EVA.
- Control presupuesto versus real.
- Análisis de variaciones y relevancia.
- Dashboard.
- Reportes Excel y PDF.
- Flujo de aprobación.
- Correo y bandeja de pendientes.
- Propuestas de mejora.
- Auditoría, respaldo y restauración.
- Aplicación portable para Windows.

### Fuera del alcance inicial

- Contabilidad general completa.
- Facturación electrónica.
- Planillas y cálculo de remuneraciones.
- Gestión tributaria.
- Integración directa con SUNAT, bancos o ERP externos.
- Aplicación móvil nativa.
- Sincronización multiusuario en nube.

Estas funciones podrían plantearse como ampliaciones futuras.

---

## 8. Actores y roles

### 8.1 Administrador

Puede:

- Configurar el sistema.
- Crear empresas, usuarios y roles.
- Administrar copias de seguridad.
- Reabrir periodos con autorización.
- Consultar auditoría.
- Acceder a todos los módulos.

### 8.2 Analista de presupuestos

Puede:

- Formular presupuestos.
- Importar información.
- Crear versiones y forecast.
- Consolidar centros.
- Calcular presupuesto maestro.
- Generar análisis y reportes.
- Atender observaciones.

### 8.3 Responsable de centro de actividad

Puede:

- Consultar su centro.
- Formular o modificar partidas permitidas.
- Adjuntar sustentos.
- Enviar su presupuesto a revisión.
- Explicar desviaciones.
- Registrar acciones correctivas.

### 8.4 Revisor

Puede:

- Revisar presupuestos asignados.
- Formular observaciones.
- Devolver una versión para corrección.
- Recomendar aprobación.
- Consultar trazabilidad.

### 8.5 Aprobador o alta dirección

Puede:

- Consultar consolidaciones y dashboards.
- Aprobar o rechazar versiones.
- Cerrar presupuestos.
- Autorizar modificaciones.
- Aprobar propuestas de mejora.

### 8.6 Usuario de consulta

Puede:

- Visualizar información autorizada.
- Consultar reportes.
- Exportar información cuando su permiso lo permita.
- No puede modificar datos.

---

## 9. Módulos del sistema

1. **Autenticación y seguridad**
2. **Empresas y sedes**
3. **Usuarios, roles y responsables**
4. **Estructura presupuestal**
5. **Ejercicios y periodos**
6. **Versiones y escenarios**
7. **Importación de información**
8. **Presupuesto original**
9. **Presupuesto maestro**
10. **Información real y comprometida**
11. **Forecast**
12. **Control presupuestal**
13. **Estados financieros**
14. **Análisis financiero**
15. **Análisis de variaciones y relevancia**
16. **Dashboard ejecutivo**
17. **Reportes y exportaciones**
18. **Aprobaciones y auditoría**
19. **Correo y distribución**
20. **Propuestas de mejora**
21. **Configuración, respaldo y restauración**

---

## 10. Procesos principales

### 10.1 Configuración inicial

1. Crear empresa.
2. Registrar sedes.
3. Registrar usuarios y responsables.
4. Crear centros de actividad.
5. Configurar grupos, elementos y cuentas.
6. Definir monedas y parámetros.

### 10.2 Creación del ejercicio

1. Crear ejercicio presupuestal.
2. Generar enero a diciembre.
3. Definir tres años de proyección.
4. Abrir periodos.
5. Crear versión original.
6. Asignar responsables, revisores y aprobadores.

### 10.3 Formulación

1. Ingresar o importar supuestos.
2. Formular ventas e ingresos.
3. Calcular producción e inventarios.
4. Calcular compras y materiales.
5. Formular mano de obra y CIF.
6. Formular gastos, inversiones y financiamiento.
7. Consolidar presupuesto maestro.
8. Validar consistencia.
9. Enviar a revisión.

### 10.4 Revisión y aprobación

1. Revisor consulta versión.
2. Registra observaciones.
3. Responsable corrige.
4. Revisor recomienda aprobación.
5. Aprobador aprueba o rechaza.
6. El sistema bloquea la versión aprobada.
7. Se genera historial y documento distribuible.

### 10.5 Registro de información real

1. Importar o registrar valores reales.
2. Validar empresa, cuenta y periodo.
3. Registrar comprometido cuando corresponda.
4. Calcular disponible y ejecución.
5. Mantener trazabilidad del origen.

### 10.6 Forecast

1. Seleccionar presupuesto original.
2. Definir mes de corte.
3. Copiar valores reales hasta el corte.
4. Proyectar meses restantes.
5. Calcular total revisado.
6. Comparar original, forecast y real.
7. Registrar explicación de cambios.
8. Revisar, aprobar y cerrar.

### 10.7 Control y evaluación

1. Seleccionar filtros.
2. Comparar presupuesto, forecast y real.
3. Calcular variaciones y ejecución.
4. Clasificar favorable/desfavorable.
5. Detectar partidas relevantes.
6. Registrar explicaciones y acciones.
7. Generar reportes y dashboard.

### 10.8 Distribución

1. Seleccionar versión aprobada.
2. Generar reporte por centro.
3. Obtener responsable y correo.
4. Enviar o registrar como pendiente.
5. Mantener historial de envíos.

---

## 11. Entradas y salidas

### Entradas

- Datos de empresas y sedes.
- Usuarios y responsables.
- Catálogo de centros, grupos, elementos y cuentas.
- Archivos Excel.
- Supuestos de ventas, precios, producción e inventarios.
- Costos de materiales y mano de obra.
- Costos indirectos y gastos.
- Inversiones y financiamiento.
- Saldos contables.
- Valores reales y comprometidos.
- Observaciones y sustentos.
- Parámetros de forecast.

### Salidas

- Presupuesto original mensualizado.
- Proyección de tres años.
- Presupuesto maestro.
- Forecast.
- Presupuesto por centro, elemento y cuenta.
- Comparaciones presupuesto-real-forecast.
- Estados financieros.
- Indicadores financieros.
- Análisis de variaciones.
- Ranking de partidas relevantes.
- Dashboards.
- Reportes Excel y PDF.
- Documentos para correo.
- Propuestas de mejora.
- Historial de aprobaciones y auditoría.

---

## 12. Reglas de negocio

### Empresas y estructura

1. Cada dato pertenece a una sola empresa.
2. Una sede pertenece a una empresa.
3. Un centro pertenece a una sede y empresa.
4. Una cuenta debe pertenecer a una jerarquía válida.
5. Los códigos deben ser únicos dentro de su empresa y nivel.
6. Los registros inactivos no se usan en nuevas formulaciones.

### Periodos

7. Un ejercicio contiene doce periodos mensuales.
8. Un periodo cerrado no admite cambios ordinarios.
9. La reapertura exige permiso y queda auditada.
10. No se mezclan ejercicios en una misma versión.

### Versiones

11. Cada versión pertenece a empresa y ejercicio.
12. Una versión aprobada no se modifica.
13. Una modificación crea una nueva versión.
14. El forecast referencia a su presupuesto original.
15. Una versión cerrada solo puede consultarse.
16. Toda transición de estado debe registrarse.

### Presupuesto

17. Cada línea debe identificar centro, cuenta, versión y periodo.
18. El total anual debe ser la suma de enero a diciembre.
19. Las proyecciones posteriores se almacenan por año.
20. Los cálculos automáticos deben conservar su origen y fórmula.
21. Los datos reales no pueden convertirse en proyección sin una nueva versión.
22. El comprometido no puede ser negativo.
23. Disponible = Presupuesto vigente - Real - Comprometido, salvo configuración específica.

### Forecast

24. Los meses anteriores o iguales al corte usan real.
25. Los meses posteriores usan proyección forecast.
26. El forecast anual es real acumulado más proyección restante.
27. Cambiar el mes de corte debe recalcular y registrar el cambio.

### Aprobación

28. El responsable formula.
29. El revisor observa o recomienda.
30. Solo el aprobador aprueba.
31. No se puede aprobar una versión con errores críticos.
32. La aprobación bloquea la edición.

### Importación

33. Toda importación debe registrar archivo, usuario, fecha y contexto.
34. La carga no se confirma sin vista previa.
35. Los errores críticos impiden importar la fila.
36. Las observaciones pueden corregirse antes de confirmar.
37. La reversión debe eliminar únicamente los datos creados por esa carga, si no tienen dependencias posteriores.

### Variaciones

38. La clasificación favorable/desfavorable depende de la naturaleza de la cuenta.
39. En ingresos, superar el presupuesto suele ser favorable.
40. En costos y gastos, superar el presupuesto suele ser desfavorable.
41. El sistema debe permitir reglas excepcionales configurables.

---

## 13. Validaciones principales

- Campos obligatorios.
- Códigos duplicados.
- Correo válido.
- Fechas válidas.
- Periodo perteneciente al ejercicio.
- Versión perteneciente a la empresa.
- Cuenta perteneciente a la estructura activa.
- Valores numéricos y monedas válidas.
- División entre cero controlada.
- Importes negativos permitidos únicamente según naturaleza.
- Totales mensuales y anuales consistentes.
- Activo = Pasivo + Patrimonio.
- Flujo de caja conciliado.
- Producción no negativa.
- Inventario final no negativo.
- Mes de corte entre enero y diciembre.
- Forecast vinculado a un original.
- Versión aprobada no editable.
- Periodo cerrado no editable.
- Permiso suficiente para cada acción.
- Archivo Excel válido y no corrupto.
- Hoja y encabezado detectables.
- Duplicados de importación advertidos.
- Registro de auditoría obligatorio para acciones críticas.

---

## 14. Estados de periodos y versiones

### Estados del periodo

- **Planificado:** creado, aún no disponible para captura.
- **Abierto:** permite registro y edición.
- **En cierre:** permite ajustes controlados.
- **Cerrado:** bloqueado para cambios ordinarios.
- **Reabierto:** habilitado excepcionalmente con auditoría.

### Estados de la versión

- **Borrador**
- **En revisión**
- **Observado**
- **Corregido**
- **Aprobado**
- **Cerrado**
- **Reemplazado**
- **Rechazado**

### Transiciones principales

`Borrador → En revisión → Observado → Corregido → En revisión → Aprobado → Cerrado`

Alternativamente:

`En revisión → Rechazado`

Una versión aprobada puede originar una nueva versión modificada, pero no regresar directamente a borrador.

---

## 15. Diseño del flujo de aprobación

### Nivel de centro

1. Responsable completa el presupuesto de su centro.
2. Ejecuta validaciones.
3. Envía a revisión.
4. Revisor revisa líneas y sustentos.
5. Puede observar o recomendar aprobación.
6. Responsable corrige las observaciones.
7. Revisor confirma el levantamiento.

### Nivel consolidado

1. Analista consolida los centros.
2. Revisa consistencia del presupuesto maestro.
3. Genera estados financieros.
4. Envía a alta dirección.
5. Aprobador aprueba o rechaza.
6. El sistema bloquea la versión aprobada.
7. Se registra la fecha y usuario de aprobación.

### Trazabilidad

Cada acción debe almacenar:

- Usuario.
- Rol.
- Fecha y hora.
- Estado anterior.
- Estado nuevo.
- Empresa.
- Ejercicio.
- Versión.
- Centro, si aplica.
- Observación.

---

## 16. Diseño del forecast

### Datos de origen

- Presupuesto original aprobado.
- Información real registrada.
- Supuestos revisados.
- Mes de corte.

### Lógica

Para cada línea y mes:

- Si el mes es menor o igual al corte: usar real.
- Si el mes es posterior al corte: usar valor proyectado.

### Resultado

- Real acumulado.
- Proyección pendiente.
- Forecast anual.
- Diferencia contra original.
- Diferencia contra real cuando exista.

### Versionamiento

Cada forecast tendrá:

- Código.
- Número de versión.
- Fecha.
- Mes de corte.
- Versión original relacionada.
- Supuestos.
- Estado.
- Responsable.
- Historial de cambios.

---

## 17. Relación presupuesto original, real y forecast

### Presupuesto original

Representa el plan aprobado para el ejercicio. Se mantiene inalterable después de aprobarse.

### Información real

Representa la ejecución efectiva. Se registra por empresa, periodo, centro y cuenta. No pertenece a una versión editable, aunque puede vincularse a la versión usada para la evaluación.

### Forecast

Representa una revisión del resultado esperado. Combina real acumulado y proyección futura.

### Comparaciones permitidas

- Original vs. real.
- Original vs. forecast.
- Forecast vs. real.
- Forecast 1 vs. Forecast 2.
- Periodo vs. periodo.

La comparación no modifica ninguna fuente; genera resultados derivados.

---

## 18. Diseño del presupuesto maestro

### Presupuesto de ventas

Entradas:

- Unidades.
- Precio.
- Producto.
- Cliente o canal.
- Mes.

Salida:

- Ventas por mes y total anual.

### Presupuesto de producción

Fórmula:

`Producción = Ventas + Inventario final deseado - Inventario inicial`

### Materiales directos

Entradas:

- Producción.
- Receta o consumo unitario.
- Costo unitario.

### Compras

Fórmula:

`Compras = Consumo requerido + Inventario final de materiales - Inventario inicial`

### Mano de obra directa

Entradas:

- Horas por unidad.
- Producción.
- Tarifa por hora.

### CIF

Entradas:

- Centros productivos.
- Elementos de costo indirecto.
- Base de asignación.
- Costos fijos y variables.

### Gastos operativos

- Administrativos.
- Ventas.
- Distribución.
- Servicio al cliente.

### Inversiones

- Activo.
- Fecha.
- Monto.
- Vida útil.
- Financiamiento.
- Depreciación.

### Presupuesto financiero

- Préstamos.
- Intereses.
- Pagos.
- Caja.
- Capital de trabajo.

### Estados resultantes

- Estado de resultados.
- Estado de situación financiera.
- Flujo de caja.

---

## 19. Diseño del análisis de variaciones

### Dimensiones

- Empresa.
- Sede.
- Ejercicio.
- Periodo.
- Versión.
- Centro.
- Grupo.
- Elemento.
- Cuenta.
- Responsable.

### Medidas

- Presupuesto.
- Real.
- Comprometido.
- Disponible.
- Forecast.
- Variación monetaria.
- Variación porcentual.
- Ejecución porcentual.
- Participación.
- Tendencia.

### Clasificación

- Favorable.
- Desfavorable.
- Neutra.
- Sin base comparable.

### Resultado gestionable

Cada desviación relevante podrá registrar:

- Explicación.
- Causa.
- Responsable.
- Acción correctiva.
- Plazo.
- Prioridad.
- Estado.

---

## 20. Diseño del análisis financiero

### Estados base

- Estado de resultados.
- Estado de situación financiera.
- Flujo de caja.

### Análisis vertical

Calcula la participación de cada cuenta respecto a una base:

- Ventas netas en resultados.
- Total activo en situación financiera.

### Análisis horizontal

Calcula variación monetaria y porcentual entre periodos o versiones.

### Ratios

- Liquidez corriente.
- Prueba ácida.
- Capital de trabajo.
- Rotación de inventarios.
- Rotación de cuentas por cobrar.
- Rotación de cuentas por pagar.
- Endeudamiento.
- Cobertura.
- Margen bruto.
- Margen operativo.
- Margen neto.
- ROA.
- ROE.

### Dupont

Descompone el ROE en margen, rotación y apalancamiento.

### EVA

Utiliza utilidad operativa después de impuestos, capital invertido y costo promedio ponderado de capital. Los supuestos deben ser visibles y editables por usuarios autorizados.

---

## 21. Diseño del dashboard

### Contexto obligatorio

- Empresa.
- Sede.
- Ejercicio.
- Periodo.
- Versión.

### Filtros adicionales

- Mes.
- Tipo de presupuesto.
- Centro.
- Grupo.
- Elemento.
- Cuenta.
- Responsable.

### Tarjetas

- Presupuesto anual.
- Presupuesto acumulado.
- Real acumulado.
- Forecast.
- Disponible.
- Ejecución.
- Variación.
- Ingresos.
- Costos.
- Gastos.
- Resultado.
- Rentabilidad.
- Inversiones.
- Centros críticos.

### Visualizaciones

- Barras presupuesto vs. real.
- Línea mensual.
- Circular por tipo de rubro.
- Variaciones por centro.
- Variaciones por cuenta.
- Original vs. forecast.
- Forecast vs. real.
- Ranking de desviaciones.
- Indicadores financieros.
- Estado de aprobación.

---

## 22. Diseño de la importación Excel

### Flujo

1. Seleccionar contexto.
2. Subir uno o varios archivos.
3. Detectar hojas.
4. Detectar encabezados.
5. Leer columnas.
6. Proponer equivalencias.
7. Permitir mapeo manual.
8. Validar filas.
9. Mostrar vista previa editable.
10. Confirmar carga.
11. Registrar auditoría.
12. Mostrar resultado.

### Estados de fila

- Aceptada.
- Observada.
- Rechazada.

### Trazabilidad

- Archivo.
- Hoja.
- Usuario.
- Fecha.
- Empresa.
- Ejercicio.
- Periodo.
- Versión.
- Destino.
- Cantidades por estado.
- Correcciones.

### Reversión

Una carga podrá revertirse cuando sus datos no hayan sido consolidados, aprobados o utilizados por procesos posteriores. Si existen dependencias, el sistema debe impedir la eliminación y explicar el motivo.

---

## 23. Diseño del proceso de correo

### Flujo

1. Seleccionar versión aprobada.
2. Seleccionar centros.
3. Generar reporte por centro.
4. Obtener responsable y correo.
5. Mostrar vista previa.
6. Enviar o guardar como pendiente.
7. Registrar resultado.

### Estados

- Pendiente.
- En cola.
- Enviado.
- Fallido.
- Cancelado.

### Modo offline

El sistema genera el adjunto y almacena el correo pendiente. Cuando exista conexión, el usuario puede reintentar.

---

## 24. Diseño de propuestas de mejora

### Fuentes

- Desviaciones relevantes.
- Sobreejecución.
- Baja ejecución.
- Centros críticos.
- Costos y gastos relevantes.
- Ingresos inferiores.
- Forecast desfavorable.
- Ratios.
- Dupont.
- EVA.

### Campos

- Título.
- Problema.
- Evidencia.
- Causa.
- Acción.
- Impacto esperado.
- Impacto en rentabilidad.
- Responsable.
- Prioridad.
- Plazo.
- Estado.
- Observaciones.

### Estados

- Borrador.
- Propuesta.
- Aprobada.
- En ejecución.
- Ejecutada.
- Rechazada.

---

## 25. Arquitectura técnica propuesta

### Estilo

Aplicación de escritorio modular con tres capas principales:

1. **Interfaz de usuario**
2. **API y lógica de negocio**
3. **Persistencia local**

### Frontend

- React.
- TypeScript.
- Enrutamiento interno.
- Componentes reutilizables.
- Estado de servidor mediante biblioteca de consultas.
- Formularios tipados y validados.
- Gráficos empresariales.

### Backend

- Node.js.
- TypeScript.
- API REST local.
- Servicios por dominio.
- Validación de solicitudes.
- Motores de cálculo separados de los controladores.
- Generadores de reportes.
- Cola local de correos.

### Base de datos

- SQLite.
- Migraciones versionadas.
- Claves foráneas.
- Índices por empresa, ejercicio, periodo y versión.
- Transacciones para importaciones y aprobaciones.
- Registro de auditoría.

### Escritorio

- Electron.
- Inicio controlado del backend local.
- Ventana principal segura.
- Recursos incluidos en el paquete.
- Base de datos almacenada en el directorio de usuario.
- Exportaciones mediante diálogo de guardado.

### Integración

`Electron → Frontend React → API local → Servicios → SQLite`

### Seguridad local

- Contraseñas cifradas mediante hash.
- Sesión local.
- Control de permisos en frontend y backend.
- Validación de rutas.
- Auditoría de acciones críticas.

### Respaldo

- Copia manual.
- Copia automática configurable.
- Restauración con validación.
- Registro de fecha y versión de esquema.

---

## 26. Estructura de carpetas propuesta

```text
Sistema-formulaci-n-presupuestal/
├── apps/
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   ├── pages/
│   │   │   ├── layouts/
│   │   │   ├── hooks/
│   │   │   ├── lib/
│   │   │   └── styles/
│   │   └── package.json
│   ├── api/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   ├── engines/
│   │   │   ├── validators/
│   │   │   ├── exporters/
│   │   │   └── server.ts
│   │   └── package.json
│   └── desktop/
│       ├── main/
│       ├── preload/
│       └── package.json
├── packages/
│   ├── database/
│   │   ├── src/
│   │   │   ├── schema/
│   │   │   ├── migrations/
│   │   │   ├── seeds/
│   │   │   └── client.ts
│   ├── shared/
│   ├── calculations/
│   ├── ui/
│   └── config/
├── scripts/
├── docs/
├── tests/
├── .github/
│   └── workflows/
├── package.json
├── workspace.yaml
├── README.md
└── README_FASE_*.md
```

La estructura definitiva se confirmará en la Fase 1 según las herramientas seleccionadas.

---

## 27. Mapa de navegación

```text
Inicio / Dashboard
│
├── Empresas
│   ├── Empresas
│   ├── Sedes
│   ├── Responsables
│   └── Usuarios y roles
│
├── Estructura presupuestal
│   ├── Centros de actividad
│   ├── Grupos presupuestales
│   ├── Elementos presupuestales
│   ├── Cuentas presupuestales
│   └── Árbol jerárquico
│
├── Planificación
│   ├── Ejercicios
│   ├── Periodos
│   ├── Versiones y escenarios
│   └── Flujo de aprobación
│
├── Importación de información
│   ├── Nueva importación
│   ├── Mapeo
│   ├── Vista previa
│   ├── Historial
│   └── Reversión
│
├── Formulación presupuestal
│   ├── Presupuesto original
│   ├── Ventas e ingresos
│   ├── Producción e inventarios
│   ├── Compras y materiales
│   ├── Mano de obra
│   ├── CIF
│   ├── Gastos
│   ├── Inversiones
│   └── Financiamiento
│
├── Forecast
│   ├── Crear forecast
│   ├── Mes de corte
│   ├── Proyección
│   └── Comparación
│
├── Presupuesto maestro
│   ├── Consolidado
│   ├── Estado de resultados
│   ├── Situación financiera
│   └── Flujo de caja
│
├── Control presupuestal
│   ├── Presupuesto vs. real
│   ├── Comprometido y disponible
│   ├── Ejecución mensual
│   └── Ejecución acumulada
│
├── Análisis
│   ├── Variaciones
│   ├── Relevancia
│   ├── Vertical y horizontal
│   ├── Ratios
│   ├── Dupont
│   └── EVA
│
├── Reportes
│   ├── Reportes presupuestales
│   ├── Estados financieros
│   ├── Exportaciones
│   └── Impresión
│
├── Distribución
│   ├── Correos
│   ├── Pendientes
│   └── Historial
│
├── Propuestas de mejora
│
└── Configuración
    ├── Parámetros
    ├── Monedas
    ├── Copias de seguridad
    ├── Restauración
    ├── Auditoría
    └── Estado del sistema
```

---

## 28. Modelo conceptual de datos

### Seguridad

- Usuario
- Rol
- Permiso
- UsuarioRol
- RolPermiso
- Sesión

### Organización

- Empresa
- Sede
- Responsable
- CentroActividad

### Estructura presupuestal

- GrupoPresupuestal
- ElementoPresupuestal
- CuentaPresupuestal
- CentroCuenta

### Tiempo y versiones

- EjercicioPresupuestal
- PeriodoPresupuestal
- VersionPresupuestal
- VersionRelacion
- EstadoVersion

### Formulación

- DocumentoPresupuestal
- LineaPresupuestal
- ValorMensualPresupuestal
- ProyeccionAnual
- SupuestoPresupuestal
- Sustento

### Presupuesto maestro

- Producto
- ClienteCanal
- PresupuestoVenta
- InventarioPresupuestado
- PresupuestoProduccion
- Material
- RecetaMaterial
- PresupuestoCompra
- PresupuestoMaterial
- PresupuestoManoObra
- PresupuestoCIF
- PresupuestoGasto
- PresupuestoInversion
- PresupuestoFinanciero

### Ejecución

- MovimientoReal
- MovimientoComprometido
- SaldoPresupuestal
- FuenteDato

### Forecast

- Forecast
- ForecastDetalle
- SupuestoForecast

### Estados financieros

- EstadoFinanciero
- EstadoFinancieroLinea
- IndicadorFinanciero
- ResultadoIndicador

### Control y análisis

- ResultadoVariacion
- ExplicacionVariacion
- AccionCorrectiva
- AnalisisRelevancia

### Aprobación

- FlujoAprobacion
- PasoAprobacion
- HistorialAprobacion
- ObservacionRevision

### Importación

- Importacion
- ImportacionArchivo
- ImportacionHoja
- MapeoColumna
- ImportacionFila
- ImportacionError

### Comunicación

- CorreoPresupuestal
- AdjuntoCorreo
- IntentoEnvio

### Mejora

- PropuestaMejora
- EvidenciaPropuesta
- SeguimientoPropuesta

### Auditoría

- AuditoriaEvento
- RespaldoBaseDatos

---

## 29. Relaciones conceptuales principales

- Empresa tiene muchas Sedes.
- Empresa tiene muchos Usuarios y Responsables.
- Sede tiene muchos Centros de actividad.
- Centro pertenece a una jerarquía de grupos, elementos y cuentas.
- Empresa tiene muchos Ejercicios.
- Ejercicio tiene doce Periodos.
- Ejercicio tiene muchas Versiones.
- Versión tiene muchos Documentos presupuestales.
- Documento tiene muchas Líneas.
- Línea tiene valores mensuales y proyecciones anuales.
- Cuenta recibe valores presupuestados, reales y comprometidos.
- Forecast referencia a una Versión original.
- Importación genera datos trazables en diferentes tablas.
- Versión tiene un Flujo de aprobación.
- Variación relaciona dos fuentes comparables.
- Propuesta de mejora puede originarse en una variación, indicador o centro crítico.

---

## 30. Diseño de separación de datos

Todas las entidades transaccionales deberán incluir, directamente o mediante relaciones obligatorias:

- `empresa_id`
- `ejercicio_id`
- `periodo_id`, cuando corresponda
- `version_id`, cuando corresponda
- `centro_id`, cuando corresponda
- usuario creador y modificador
- fecha de creación y modificación

La API no aceptará únicamente identificadores enviados por la interfaz; verificará que todos pertenezcan al mismo contexto empresarial.

---

## 31. Plan de desarrollo por fases

### Fase 0 — Análisis y arquitectura

Define alcance, procesos, arquitectura, modelo conceptual y plan.

### Fase 1 — Base técnica y escritorio

Crea frontend, API, SQLite, Electron, navegación, logs, respaldos y CI inicial.

### Fase 2 — Usuarios, empresas y estructura

Implementa seguridad, organización y jerarquía presupuestal.

### Fase 3 — Periodos, versiones y aprobación

Implementa ejercicios, periodos, escenarios, estados y trazabilidad.

### Fase 4 — Importación inteligente

Implementa lectura, detección, mapeo, validación, vista previa, carga y reversión.

### Fase 5 — Presupuesto original y maestro

Implementa formulación operativa y financiera del presupuesto original.

### Fase 6 — Forecast y control

Implementa presupuesto revisado, datos reales, comprometido, disponible y variaciones básicas.

### Fase 7 — Estados financieros y análisis

Implementa estados financieros, análisis vertical/horizontal, ratios, Dupont y EVA.

### Fase 8 — Variaciones y relevancia

Implementa análisis multidimensional, ranking, explicaciones y acciones correctivas.

### Fase 9 — Dashboard, reportes y correo

Implementa visualización ejecutiva, exportaciones, impresión y distribución.

### Fase 10 — Propuestas, estabilización y ejecutable

Implementa propuestas, pruebas integrales, correcciones y ejecutable final.

---

## 32. Dependencias entre fases

```text
Fase 0
  ↓
Fase 1
  ↓
Fase 2
  ↓
Fase 3
  ↓
Fase 4 ───────────┐
  ↓               │
Fase 5            │
  ↓               │
Fase 6            │
  ↓               │
Fase 7            │
  ↓               │
Fase 8            │
  ↓               │
Fase 9 ←──────────┘
  ↓
Fase 10
```

La Fase 4 puede seguir ampliándose conforme se incorporen destinos de importación, pero debe estar operativa antes de la formulación completa.

---

## 33. Criterios de aceptación por fase

### Fase 0

- Alcance definido.
- Arquitectura propuesta.
- Modelo conceptual documentado.
- Fases y riesgos identificados.

### Fase 1

- Frontend, API y SQLite funcionan.
- Electron abre.
- Navegación base funciona.
- GitHub Actions genera artifact inicial.

### Fase 2

- Usuarios y permisos funcionan.
- Empresas no mezclan información.
- Jerarquía completa y navegable.

### Fase 3

- Periodos y versiones funcionan.
- Flujo de aprobación operativo.
- Versiones aprobadas bloqueadas.

### Fase 4

- Se importan Excel variables.
- Existe mapeo manual.
- Vista previa y reversión funcionan.

### Fase 5

- Presupuesto original mensualizado.
- Presupuesto maestro consistente.
- Proyección de tres años disponible.

### Fase 6

- Forecast combina real y proyección.
- Control calcula variaciones, ejecución y disponible.

### Fase 7

- Estados financieros cuadran.
- Indicadores, Dupont y EVA funcionan.

### Fase 8

- Variaciones multidimensionales correctas.
- Relevancia y acciones disponibles.

### Fase 9

- Dashboard utiliza datos reales.
- Reportes y correo funcionan.
- Modo offline registra pendientes.

### Fase 10

- Integración completa.
- Pruebas superadas.
- Datos persistentes.
- EXE funciona sin Node.js.
- GitHub Actions termina correctamente.

---

## 34. Riesgos técnicos

### Complejidad del presupuesto maestro

**Riesgo:** fórmulas dependientes y diferencias según empresa.

**Mitigación:** motores de cálculo separados, parámetros configurables y pruebas por componente.

### Importación Excel variable

**Riesgo:** archivos con estructuras impredecibles.

**Mitigación:** detección por aliases, mapeo manual, vista previa, validación y reversión.

### Empaquetado de dependencias

**Riesgo:** módulos nativos faltantes en el EXE.

**Mitigación:** probar empaquetado desde la Fase 1, evitar dejarlo para el final y verificar recursos de producción.

### Integridad de SQLite

**Riesgo:** corrupción o pérdida de información local.

**Mitigación:** transacciones, copias automáticas, restauración y cierre controlado.

### Rendimiento

**Riesgo:** gran volumen de líneas presupuestales y reportes lentos.

**Mitigación:** índices, consultas agregadas, paginación y cálculos por lotes.

### Exportaciones

**Riesgo:** archivos grandes o formatos inconsistentes.

**Mitigación:** servicios especializados y pruebas con volúmenes altos.

### Correo

**Riesgo:** configuración SMTP, falta de internet o bloqueo del proveedor.

**Mitigación:** cola local, reintentos, configuración validada y exportación manual alternativa.

---

## 35. Riesgos funcionales

### Ambigüedad de reglas contables

**Mitigación:** mostrar fórmulas y permitir parámetros autorizados.

### Cambios de alcance

**Mitigación:** aprobar cada fase y no adelantar módulos.

### Confusión entre presupuesto y real

**Mitigación:** fuentes separadas, etiquetas claras y trazabilidad.

### Mezcla de versiones

**Mitigación:** contexto obligatorio y filtros validados en backend.

### Aprobaciones informales

**Mitigación:** bloqueo por estado y registro obligatorio de acciones.

### Datos sintéticos confundidos con oficiales

**Mitigación:** etiquetar origen público, derivado o sintético.

---

## 36. Decisiones que se confirmarán en la Fase 1

- Gestor de paquetes y configuración del monorepo.
- ORM o capa de acceso a SQLite.
- Biblioteca visual base.
- Biblioteca de formularios.
- Biblioteca de gráficos.
- Estrategia de migraciones.
- Estrategia de actualización del esquema en producción.
- Mecanismo de comunicación Electron-backend.
- Ubicación de base de datos, logs y respaldos.
- Formato inicial del workflow de Windows.

---

## 37. Archivos previstos para la Fase 1

La Fase 1 debería crear, como mínimo:

```text
package.json
workspace.yaml o configuración equivalente
.gitignore
.env.example
apps/frontend/package.json
apps/frontend/src/main.tsx
apps/frontend/src/App.tsx
apps/frontend/src/layouts/
apps/frontend/src/pages/
apps/api/package.json
apps/api/src/server.ts
apps/api/src/routes/health.ts
apps/desktop/package.json
apps/desktop/main/
apps/desktop/preload/
packages/database/package.json
packages/database/src/client.ts
packages/database/src/schema/
packages/database/src/migrations/
packages/shared/
scripts/
.github/workflows/build-windows.yml
README_FASE_1.md
```

La lista definitiva deberá presentarse antes de modificar el repositorio en la Fase 1.

---

## 38. Conclusión de la Fase 0

El repositorio está en condiciones adecuadas para iniciar un desarrollo desde cero. No existen archivos heredados que condicionen la arquitectura.

La solución se diseñará como una aplicación empresarial de escritorio modular, con funcionamiento offline, control de versiones, importación flexible, cálculos presupuestales, análisis financiero, reportes y trazabilidad.

La siguiente fase debe limitarse a construir la base técnica y la navegación, sin implementar todavía los cálculos completos del presupuesto maestro.
