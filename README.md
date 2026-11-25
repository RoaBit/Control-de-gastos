# Claro — Control de gastos

App de finanzas personales en MXN. Funciona en el navegador y se puede instalar en el celular.

**Abrir la app:** https://roabit.github.io/Control-de-gastos/

- **Android (Chrome):** menú ⋮ → «Instalar app» o «Agregar a pantalla de inicio».
- **iPhone (Safari):** botón Compartir → «Agregar a inicio».

Tus datos se guardan solo en tu dispositivo. Descarga un respaldo de vez en cuando desde Configuración.

## Incluye

- Registro manual de ingresos, gastos e inversiones.
- Panel con saldo, categorías, flujo mensual y movimientos recientes.
- Gráfica real de ingresos, gastos y neto; excluye aportaciones para no confundir capital con gasto.
- Planes semanales, quincenales, mensuales o anuales y estimaciones separadas de movimientos reales.
- Presupuestos por categoría, metas de ahorro y recordatorios (pueden repetirse cada día, semana, quincena, mes o año). La gráfica de Límites resta del dinero disponible tus gastos recurrentes (renta, suscripciones) y tus límites; si un límite y un gasto recurrente tienen el mismo nombre, solo cuenta el límite.
- Capital inicial agregado por cuenta e inversión, con un desglose de cada cuenta.
- Portafolio por banco/producto y distribución que se actualiza al seleccionar un punto de la proyección.
- Gráfica de proyección en días, meses o años con una línea por producto y una línea total destacada.
- Tope opcional a las aportaciones de capital; el excedente de aportaciones planeadas puede redirigirse a otra inversión.
- Metas con origen y destino: el ahorro sale de una cuenta (por ejemplo, la nómina) y se guarda en una cuenta de débito o en una inversión; su saldo cuenta como avance. También se pueden vincular a una inversión, a sus intereses estimados o al portafolio completo; el vínculo solo muestra progreso, no aparta dinero.
- Tasas fijas o variables, capitalización, impuestos, comisiones y registro de aportaciones/retiros.
- Exportación e importación de respaldo en JSON, con un aviso en el inicio si llevas más de 14 días sin descargar uno.
- Gráfica principal con el saldo diario de cada banco (o cuenta/inversión) y el total, del día 1 al último día del mes; se puede ajustar qué líneas ver y la escala del eje vertical. El saldo de una cuenta es su punto de partida, no un ingreso.
- Movimientos, planes recurrentes (por ejemplo, la nómina) e inversiones conectables a una cuenta de banco. Después de hoy, la gráfica principal muestra con línea punteada un estimado del saldo con esos planes.
- Aportaciones futuras de una inversión en una sola opción: ninguna, monto fijo mensual o apartar de un ingreso recurrente.
- Inversiones que se pagan con un ingreso recurrente y proyección a 1 año por defecto.
- ISR estimado con la retención de México 2026 (0.9% anual sobre el saldo) como valor recomendado.
- Plan para reponer cuando un gasto supera su límite, apartando dinero de un ingreso recurrente.
- Explicaciones "?" en lenguaje sencillo en cada sección y campo; en el celular se abren debajo del campo, una a la vez.
- Tutorial breve de 6 pasos la primera vez que abres la app (se puede volver a ver en Configuración).
- Gráficas que se actualizan con tus propios registros y el mes actual.
- Funcionamiento local sin conexión una vez servida desde un hosting HTTPS.

## Estado de datos

En esta versión, los datos se guardan únicamente en el navegador de cada dispositivo. No hay cuenta ni sincronización todavía. Los avisos de recordatorios aparecen cuando abres la app en la fecha del recordatorio (o después); no pueden llegar mientras la app está cerrada.

La app inicia sin movimientos ni datos de muestra. Usa "Descargar respaldo" para guardar una copia de tus datos y "Cargar respaldo" (en Configuración) para recuperarla en este u otro dispositivo; cargar un respaldo reemplaza los datos actuales. La app pide al navegador que no borre sus datos automáticamente y avisa cuando hay una nueva versión disponible. El balance real del mes se calcula como ingresos menos gastos. Las inversiones y los planes recurrentes se muestran aparte; el primero no representa el saldo bancario total.

Las proyecciones son orientativas: tratan la tasa anual como nominal y la dividen según la frecuencia de capitalización (semanal incluida), suponen que la tasa actual permanece estable, calculan impuestos sobre rendimientos y descuentan la comisión anual de forma proporcional. Las sugerencias de tasa son ejemplos, no ofertas vigentes. Los planes recurrentes se administran desde Presupuestos y nunca se suman a movimientos reales. Los topes de aportación se configuran manualmente por producto; al alcanzarlos se detienen las aportaciones, mientras los intereses siguen el método compuesto o simple que se elija. El capital inicial total suma saldos iniciales de cuentas e inversiones; evita registrar dos veces el mismo dinero. Las aportaciones y retiros pueden reflejarse también en movimientos, pero la gráfica principal de ingreso/gasto los excluye.

La app incluye una página de privacidad, términos y aviso financiero en `legal.html`. Si se agregan cuentas, sincronización, analítica, publicidad, pagos o servicios de terceros, hay que actualizarla antes de activarlos.

## Publicación

La app se publica con GitHub Pages desde la rama `main`. Cada cambio en `main` se publica solo en uno o dos minutos. Al cambiar archivos, sube el número de versión en `service-worker.js` (`claro-vNN`) para que la app instalada avise que hay una versión nueva.

## Contacto

Responsable: Fernando Roa Castillo (RoaBit) · claros.help@gmail.com

## Licencia

© 2026 Fernando Roa Castillo. Todos los derechos reservados. El código es visible, pero no se permite copiarlo, modificarlo ni redistribuirlo sin permiso.
