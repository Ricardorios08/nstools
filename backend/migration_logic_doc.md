# Lógica de Composición de Deuda y Mapeo de Tablas

Esta guía explica cómo se calcula la deuda en el sistema de migración actual, comparando los orígenes en **MariaDB (Legado)** y los destinos en **PostgreSQL (Nuevo)**.

---

## 1. Mapeo General de Tributos

Dependiendo de la oficina (tributo), el sistema debe consultar diferentes tablas en MariaDB. En PostgreSQL, la estructura está unificada.

| Tributo | Oficina | Tabla Origen (MariaDB) | Tabla Destino (PostgreSQL) |
| :--- | :--- | :--- | :--- |
| **Inmuebles** | 1 | `recaudacion.ctacte` | `public.cuentacorriente` |
| **Comercio** | 2 | `recaudacion.boleto` + `liqucome` | `public.cuentacorriente` |
| **Cementerio** | 4 | `recaudacion.boleto` + `liquceme` | `public.cuentacorriente` |
| **Multas** | 5 | `recaudacion.multas` | `public.cuentacorriente` |
| **Publicidad** | 6 | `recaudacion.boleto` + `liqupubl` | `public.cuentacorriente` |
| **Antenas** | 7 | `recaudacion.boleto` + `liquante` | `public.cuentacorriente` |

---

## 2. Definición de "Deuda"

### En MariaDB (Legado)
Para las oficinas que usan la tabla `boleto` (Comercio, Antenas, etc.), un registro se considera **Deuda** si cumple estas condiciones:
1.  **Estado**: `EstaBole` no es 'Pagado', 'De baja' ni 'Anulado'.
2.  **Sin Recibo**: El `NumeBole` no debe existir en la tabla `recaudacion.pago`.
    *   *Nota*: En el sistema viejo, a veces el estado queda como 'Actualizado' o 'Emitido' incluso si ya se pagó. La fuente de verdad es la tabla `pago`.

### En PostgreSQL (Nuevo)
Un registro se considera **Deuda** si:
1.  **Sin Vínculo de Pago**: El campo `cabpgoctactecod` en la tabla `public.cuentacorriente` es `NULL` o `0`.
2.  **Estado de Instancia**: Si existe en `cedinstancia`, el `tipcedinscod` suele ser 1 (Emisión).

---

## 3. Composición del Monto (Debe/Haber/Interés)

### MariaDB
*   **Capital (Debe)**: Proviene del campo `TotaBole` (para boletos) o `DebeCtct` (para Inmuebles).
*   **Recargo (Surcharge)**: Si el registro no está pago y la fecha de vencimiento ya pasó, se calcula un **3% mensual** sobre el capital.
*   **Total**: `Capital + Recargo`.

### PostgreSQL
*   **Capital (Debe)**: Proviene del campo `genctaimpcta` en la tabla `generacioncuota`.
*   **Interés (Interest)**: Se calcula dinámicamente comparando la fecha de vencimiento (`genctafchvto`) contra la fecha seleccionada.
*   **Total**: `Capital + Interés`.

---

## 4. Resolución de Cuentas (Nro. Cuenta vs Tributo)

En la migración, el **Número de Cuenta** (ej: 25100) puede estar repetido entre oficinas.
*   Para **Inmuebles**, el Nro. de Cuenta es la nomenclatura o el padrón.
*   Para **Comercio**, es el código de comercio (`CodiCome`).
*   Para **Antenas**, es el código de antena (`CodiCome` en tabla `antena`).

El sistema de auditoría utiliza el `officeId` para filtrar correctamente en ambas bases de datos y evitar colisiones de IDs.
