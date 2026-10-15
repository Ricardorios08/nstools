const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const _pdfParseModule = require('pdf-parse');
// pdf-parse puede exportar la función directamente o como .default según la versión
const pdfParse = typeof _pdfParseModule === 'function'
    ? _pdfParseModule
    : (_pdfParseModule.default || _pdfParseModule.pdfParse || null);
const path = require('path');

// Multer: memoria (no escribe a disco)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
    fileFilter: (req, file, cb) => {
        const allowed = ['.xlsx', '.xls', '.pdf'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext)) cb(null, true);
        else cb(new Error('Solo se aceptan archivos Excel (.xlsx, .xls) o PDF (.pdf)'));
    }
});

// ─────────────────────────────────────────────────────────────
// PARSER EXCEL  (porta ExcelParserServiceImpl.java)
// ─────────────────────────────────────────────────────────────
function parseExcel(buffer) {
    const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    // Detectar formato Tarjeta Nación ("Reporte de Cuenta")
    // Tiene el header partido en 2 filas: fila con Fecha/Detalle y siguiente con Débito/Crédito
    if (rows.length > 8) {
        const r0 = normalizeText(rows[0].join(' '));
        if (r0.includes('reporte de cuenta')) {
            return parseTarjetaNacion(rows);
        }
    }

    // 1. Encontrar fila de encabezado
    let headerRowIdx = -1;
    for (let i = 0; i < rows.length; i++) {
        const joined = normalizeText(rows[i].join(' '));
        let hits = 0;
        if (joined.includes('fecha')) hits++;
        if (joined.includes('comprob')) hits++;
        if (joined.includes('concepto') || joined.includes('detalle') || joined.includes('descr') || joined.includes('movim')) hits++;
        if (joined.includes('importe') || joined.includes('monto') || joined.includes('valor')) hits++;
        if (joined.includes('debe') || joined.includes('debito') || joined.includes('cargo') || joined.includes('debitos')) hits++;
        if (joined.includes('haber') || joined.includes('credito') || joined.includes('abono') || joined.includes('creditos')) hits++;
        if (hits >= 2) { headerRowIdx = i; break; }
    }

    if (headerRowIdx < 0) throw new Error("No se encontró fila de encabezado con palabras clave (Fecha, Importe, Debe, Haber...)");

    // 2. Mapear columnas por keyword (normalizado sin tildes)
    // Si la siguiente fila también tiene encabezados (ej: "Débito"/"Crédito" bajo "$"),
    // fusionar ambas filas para obtener el header completo
    const nextRow = rows[headerRowIdx + 1] || [];
    const isSubHeader = nextRow.some(c => {
        const t = normalizeText(String(c));
        return t.includes('debito') || t.includes('credito') || t.includes('debe') || t.includes('haber');
    });
    const rawHeaders = rows[headerRowIdx];
    const headers = rawHeaders.map((h, i) => h || (isSubHeader ? nextRow[i] : ''));
    const dataStartRow = isSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;

    const cols = {};
    const headerNames = {};

    headers.forEach((h, idx) => {
        const t = normalizeText(String(h));
        headerNames[idx] = String(h).trim();
        if (t.includes('fecha')) cols.fecha = idx;
        else if (t.includes('comprob') || t === 'nro' || t.includes('referencia') || t.includes('transacc')) { if (cols.comprobante === undefined) cols.comprobante = idx; }
        else if (t.includes('importe') || t.includes('monto') || t.includes('valor')) cols.importe = idx;
        else if (t.includes('debito') || t === 'debe' || t.includes('cargo') || t === 'debitos') cols.debe = idx;
        else if (t.includes('credito') || t === 'haber' || t.includes('abono') || t === 'creditos') cols.haber = idx;
        else if (t.includes('saldo')) cols.saldo = idx;
        // Prioridad para descripción: 'descr' > 'detalle' > 'concepto'/'movim'
        // Se asigna solo si aún no está mapeada, recorriendo en ese orden
        else if (t.includes('descr')) {
            cols.detalle = idx; // primera aparición de 'descr' gana
        } else if ((t.includes('detalle') || t.includes('concept') || t.includes('movim') || t.includes('denominacion')) && cols.detalle === undefined) {
            cols.detalle = idx;
        }
    });

    // Si hay columna 'concepto' (col 0 en BNA Extracto) y también columna 'descr' (col 5),
    // guardar la col 0 como 'concepto' para poder incluirla en la descripción final
    if (cols.detalle !== undefined) {
        headers.forEach((h, idx) => {
            const t = normalizeText(String(h));
            if (idx !== cols.detalle && (t.includes('concept') || t.includes('movim')) && cols.concepto === undefined) {
                cols.concepto = idx;
            }
        });
    }

    if (cols.fecha === undefined) throw new Error("No se encontró columna de Fecha en el encabezado");

    // 3. Parsear filas de datos
    const resultado = [];
    for (let r = dataStartRow; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

        // Fecha — puede ser Date object (xlsx cellDates:true) o string
        const rawFecha = row[cols.fecha];
        const fecha = rawFecha instanceof Date ? rawFecha : parseDate(rawFecha);
        if (!fecha) continue;

        // Importe / Debe / Haber
        let debe = null, haber = null;
        if (cols.debe !== undefined && cols.haber !== undefined) {
            debe = parseNumber(row[cols.debe]);
            haber = parseNumber(row[cols.haber]);
            // Normalizar: 0 == null para el flag
            if (debe !== null && debe === 0) debe = null;
            if (haber !== null && haber === 0) haber = null;
        } else if (cols.importe !== undefined) {
            const imp = parseNumber(row[cols.importe]);
            if (imp !== null) {
                if (imp < 0) { debe = Math.abs(imp); haber = null; }
                else { haber = imp; debe = null; }
            }
        }
        // Saltar renglones sin importe válido
        if (debe === null && haber === null) continue;
        const importeVal = debe !== null ? debe : haber;
        if (importeVal === 0) continue;

        // Descripcion
        const descripcion = buildDescripcionExcel(row, cols, headerNames);

        // Referencia
        const referencia = cols.comprobante !== undefined
            ? String(row[cols.comprobante] || '').trim()
            : '';

        // Saldo
        const saldo = cols.saldo !== undefined ? parseNumber(row[cols.saldo]) : null;

        resultado.push({
            fecha: formatDate(fecha instanceof Date ? fecha : new Date(fecha)),
            referencia,
            codMov: (debe !== null && debe > 0) ? 'D' : 'H',
            descripcion: descripcion.substring(0, 255),
            importe: formatMonto(debe !== null ? debe : haber),
            saldo: saldo !== null ? formatMonto(saldo) : ''
        });
    }

    return resultado;
}

// ─────────────────────────────────────────────────────────────
// PARSER TARJETA NACIÓN  (formato "Reporte de Cuenta" con header en 2 filas)
// ─────────────────────────────────────────────────────────────
// Estructura:
//   Fila N:   Fecha | Detalle de Operación | Nº Transacción | Observación | $ | <vacío>
//   Fila N+1: <vacío> | ...                | ...            | ...         | Débito | Crédito
//
// Las filas de movimientos tienen la fecha en col 0 con prefijo de guiones:
//   "-  DD/MM/YYYY"    → nivel 1 (transacciones de la cuenta raíz)
//   "--  DD/MM/YYYY"   → nivel 2 (sub-movimientos, duplicados con respecto al nivel 1)
//   "----  DD/MM/YYYY" → nivel 4, etc.
// Solo se toman las filas de nivel 1 para evitar duplicados.
function parseTarjetaNacion(rows) {
    // Localizar la fila de encabezado (la que contiene 'Fecha' como primer texto no vacío)
    let headerRowIdx = -1;
    for (let i = 0; i < rows.length; i++) {
        const t0 = normalizeText(String(rows[i][0]));
        if (t0 === 'fecha') { headerRowIdx = i; break; }
    }
    if (headerRowIdx < 0) throw new Error('Tarjeta Nación: no se encontró fila de encabezado');

    // La fila siguiente (headerRowIdx+1) tiene 'Débito'/'Crédito' en las últimas 2 cols
    const subRow = rows[headerRowIdx + 1] || [];
    const colCount = Math.max(rows[headerRowIdx].length, subRow.length);

    // Determinar índices de columnas
    // Fila principal: [Fecha, Detalle de Operación, Nº Transacción, Observación, $, <vacío>]
    const COL_FECHA_RAW = 0;   // texto: "-  DD/MM/YYYY"
    const COL_DETALLE = 1;   // descripción principal
    const COL_TRANSACC = 2;   // Nº Transacción (referencia)
    const COL_OBS = 3;   // Observación (complemento de descripción)
    // La sub-fila define qué columna es Débito y cuál es Crédito
    let COL_DEBITO = -1, COL_CREDITO = -1;
    for (let c = 0; c < colCount; c++) {
        const t = normalizeText(String(subRow[c] || ''));
        if (t.includes('debit') || t === 'debito' || t === 'debitos') COL_DEBITO = c;
        else if (t.includes('credit') || t === 'credito' || t === 'creditos' || t === 'haber') COL_CREDITO = c;
    }
    // Fallback si la sub-fila no detectó columnas: usar las últimas 2
    if (COL_DEBITO < 0) COL_DEBITO = colCount - 2;
    if (COL_CREDITO < 0) COL_CREDITO = colCount - 1;

    const DATE_IN_COL0 = /(\d{2}\/\d{2}\/\d{4})/;

    const resultado = [];
    for (let r = headerRowIdx + 2; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.every(c => c === '' || c === null || c === undefined)) continue;

        const col0 = String(row[COL_FECHA_RAW] || '').trim();

        // Solo procesar filas de nivel 1 (prefijo exacto "-  ")
        // Nivel 1 = exactamente un guion al inicio
        const nivelMatch = col0.match(/^(-+)\s+/);
        if (!nivelMatch || nivelMatch[1].length !== 1) continue;

        // Extraer fecha
        const dateMatch = col0.match(DATE_IN_COL0);
        if (!dateMatch) continue;
        const fecha = dateMatch[1]; // ya en formato dd/MM/yyyy

        // Débito / Crédito
        const rawDebe = parseNumber(row[COL_DEBITO]);
        const rawHaber = parseNumber(row[COL_CREDITO]);
        const debe = (rawDebe !== null && rawDebe > 0) ? rawDebe : null;
        const haber = (rawHaber !== null && rawHaber > 0) ? rawHaber : null;
        if (debe === null && haber === null) continue;

        // Referencia: Nº Transacción
        const referencia = String(row[COL_TRANSACC] || '').trim();

        // Descripción: Detalle + Observación (si la hay)
        const detalle = String(row[COL_DETALLE] || '').trim();
        const obs = String(row[COL_OBS] || '').trim();
        const descripcion = obs ? `${detalle} - ${obs}` : detalle;

        resultado.push({
            fecha,
            referencia,
            codMov: debe !== null ? 'D' : 'H',
            descripcion: descripcion.substring(0, 255),
            importe: formatMonto(debe !== null ? debe : haber),
            saldo: ''
        });
    }

    return resultado;
}

function buildDescripcionExcel(row, cols, headerNames) {
    // Si hay columna de detalle explícita (ej: "Descripción" en BNA Extracto), usarla directamente
    if (cols.detalle !== undefined) {
        const val = String(row[cols.detalle] || '').trim();
        // Si además hay columna "Concepto/Cod.Op." (col concepto), prefixarla
        if (cols.concepto !== undefined) {
            const concepto = String(row[cols.concepto] || '').trim();
            if (val && concepto) return `${concepto} - ${val}`;
            if (val) return val;
            if (concepto) return concepto;
        }
        if (val) return val;
    }

    // Fallback: concatenar todas las columnas que NO son clave numérica
    const skipKeys = new Set(['fecha', 'comprobante', 'importe', 'debe', 'haber', 'saldo']);
    const skipIdxs = new Set(
        Object.entries(cols)
            .filter(([k]) => skipKeys.has(k))
            .map(([, v]) => v)
    );
    const parts = [];
    row.forEach((val, idx) => {
        if (skipIdxs.has(idx)) return;
        const v = String(val || '').trim();
        if (!v) return;
        const h = headerNames[idx] || '';
        parts.push(h ? `${h}: ${v}` : v);
    });
    return parts.join(' - ');
}

// ─────────────────────────────────────────────────────────────
// PARSER PDF  (porta PdfParserService.java)
// ─────────────────────────────────────────────────────────────
async function parsePdf(buffer) {
    if (!pdfParse) throw new Error('El módulo pdf-parse no está disponible. Reiniciá el servidor.');

    const data = await pdfParse(buffer);
    const lines = data.text.split('\n').map(l => l.trim()).filter(Boolean);

    const resultado = [];
    // Fecha en formato dd/MM/yyyy
    const DATE_RE = /\b(\d{2}\/\d{2}\/\d{4})\b/;
    // Monto europeo: dígitos con puntos de miles y coma decimal, ej: 1.234.567,89 o 121.815,93 o -1.234,56
    const MONTO_RE = /^-?[\d]{1,3}(?:\.\d{3})*,\d{2}$/;

    for (const line of lines) {
        const lower = line.toLowerCase();

        // Ignorar encabezados y resúmenes
        if (lower.includes('saldo inicial') || lower.includes('saldo final') || lower.includes('saldo al')) continue;
        if (lower.includes('datos actualizados') || lower.includes('fecha:') && lower.includes(':')) continue;
        if (lower.includes('desde') && lower.includes('hasta')) continue;
        if (lower.includes('fecha') && (lower.includes('importe') || lower.includes('debe') || lower.includes('concepto'))) continue;

        const dateMatch = line.match(DATE_RE);
        if (!dateMatch) continue;

        const fecha = dateMatch[1]; // ya en formato dd/MM/yyyy
        const tokens = line.split(/\s+/);

        // Identificar todos los montos en la línea
        const montos = tokens
            .filter(t => MONTO_RE.test(t))
            .map(t => ({ raw: t, val: parseNumber(t) }))
            .filter(m => m.val !== null);

        // Texto: todo lo que no es fecha ni monto numérico puro
        const textos = tokens.filter(t => !DATE_RE.test(t) && !MONTO_RE.test(t));

        // Comprobante: primer token solo numérico largo (sin coma/punto), después de la fecha
        let referencia = '';
        const compRe = /^\d{4,}$/;
        const textosFinales = textos.filter(t => {
            if (compRe.test(t) && !referencia) { referencia = t; return false; }
            return true;
        });

        // Para este banco: el importe viene como un solo monto positivo por fila
        // (no hay columnas Debe/Haber separadas en el PDF)
        // El primer monto de la línea es el importe del movimiento
        if (montos.length === 0) continue;

        const primerMonto = montos[0].val;
        let debe = null, haber = null;
        if (primerMonto < 0) {
            debe = Math.abs(primerMonto);
        } else {
            haber = primerMonto;
        }

        // Saldo: si hay un segundo monto, es el saldo
        const saldo = montos.length > 1 ? montos[1].val : null;

        const descripcion = textosFinales
            .filter(t => t.length > 1) // quitar tokens de 1 char
            .join(' ')
            .substring(0, 255);

        resultado.push({
            fecha,
            referencia,
            codMov: debe !== null ? 'D' : 'H',
            descripcion,
            importe: formatMonto(debe !== null ? debe : haber),
            saldo: saldo !== null ? formatMonto(saldo) : ''
        });
    }

    return resultado;
}

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

// Quita tildes y pasa a minúsculas para comparación normalizada
function normalizeText(s) {
    return String(s)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')  // quita diacríticos (tildes)
        .trim();
}

function parseDate(val) {
    if (!val) return null;
    if (val instanceof Date && !isNaN(val)) return val;

    const s = String(val).trim().split('T')[0];
    // dd/MM/yyyy
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    // dd-MM-yyyy
    m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    // yyyy-MM-dd
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);

    const d = new Date(s);
    return isNaN(d) ? null : d;
}

function formatDate(d) {
    if (!d) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function parseNumber(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    let s = String(val).trim();
    if (!s) return null;
    // Quitar símbolos de moneda y espacios (ej: "$ -10,29" → "-10,29")
    s = s.replace(/[$€£\s]/g, '');
    if (!s) return null;
    // Formato europeo: puntos de miles, coma decimal → "1.234,56" → 1234.56
    const cleaned = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
}

function formatMonto(val) {
    if (val === null || val === undefined) return '';
    return Number(val).toFixed(2).replace('.', ',');
}

// ─────────────────────────────────────────────────────────────
// GENERAR ARCHIVO TXT en formato estrucutura_gen_financiero
// ─────────────────────────────────────────────────────────────
function generarTxt(filas, opciones = {}) {
    const { sucursal = '', cuenta = '', numHoja = '' } = opciones;
    const refLength = parseInt(opciones.refLength || 8, 10);

    // Helpers para padding y formateo
    const padLeft = (val, length, char = '0') => {
        const s = String(val === null || val === undefined ? '' : val).trim();
        const clean = s.replace(/[^a-zA-Z0-9]/g, ''); // limpia caracteres extraños
        if (clean.length >= length) return clean;
        return clean.padStart(length, char);
    };

    const padRightSpace = (val, length) => {
        const s = String(val === null || val === undefined ? '' : val).trim();
        return s.padEnd(length, ' ').slice(0, length);
    };

    const formatFecha = (fechaStr) => {
        if (!fechaStr) return '00000000';
        const s = String(fechaStr).trim();
        // Match DD/MM/YYYY o DD-MM-YYYY
        let m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
        if (m) {
            const dd = m[1].padStart(2, '0');
            const mm = m[2].padStart(2, '0');
            return `${m[3]}${mm}${dd}`;
        }
        // Match YYYY-MM-DD
        m = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
        if (m) {
            const mm = m[2].padStart(2, '0');
            const dd = m[3].padStart(2, '0');
            return `${m[1]}${mm}${dd}`;
        }
        return '00000000';
    };

    const formatMontoCents = (montoStr) => {
        if (!montoStr) return '000000000000000';
        let s = String(montoStr).trim();
        s = s.replace(/\./g, '').replace(',', '.');
        const n = parseFloat(s);
        if (isNaN(n)) return '000000000000000';
        const cents = Math.round(n * 100);
        return String(cents).padStart(15, '0');
    };

    const cleanRef = (ref) => {
        const zeros = ''.padStart(refLength, '0');
        if (!ref) return zeros;
        const clean = String(ref).trim().replace(/[^0-9]/g, '');
        return clean.padStart(refLength, '0').slice(-refLength);
    };

    const formatCodMov = (codMov, desc) => {
        const d = String(desc || '').toLowerCase();
        if (d.includes('saldo')) {
            return '502';
        }
        const c = String(codMov || '').trim();
        if (c === 'D') return '010';
        if (c === 'H') return '510';

        const numericOnly = c.replace(/[^0-9]/g, '');
        if (numericOnly) {
            if (numericOnly.length >= 3) return numericOnly;
            return numericOnly.padStart(3, '0');
        }
        return '000';
    };

    const sucursalPadded = padLeft(sucursal, 4);
    const cuentaPadded = padLeft(cuenta, 10);
    const numHojaPadded = padLeft(numHoja, 3);

    const lineas = [];

    // NOTA: no se incluye una línea de encabezado con nombres de columnas.
    // El sistema contable valida la primera línea del archivo como un registro
    // de datos real (no como títulos), así que una fila de etiquetas ahí
    // rompe la carga (errores de formato en cada columna). El archivo debe
    // empezar directamente con el registro de Apertura (001).

    // 1. Registro de Apertura / Fila 001
    const aperturaRow = [
        sucursalPadded,
        cuentaPadded,
        numHojaPadded,
        '001',
        '00000000',
        ''.padStart(refLength, '0'),
        '000',
        padRightSpace('', 20),
        '000000000000000',
        '000000000000000',
        '' // Trailing empty para terminar con ;
    ].join(';');
    lineas.push(aperturaRow);

    // 2. Movimientos / Filas 002 a N+1
    // Omitir filas sin importe válido; secuencia correlativa solo sobre las incluidas
    let secuenciaCounter = 2; // Comienza en 002
    filas.forEach((f) => {
        // Saltar renglones sin importe
        const importeRaw = String(f.importe || '').trim();
        if (!importeRaw || importeRaw === '0,00' || importeRaw === '0') return;

        const secuencia = padLeft(secuenciaCounter, 3);
        secuenciaCounter++;

        const fecha = formatFecha(f.fecha);
        const referencia = cleanRef(f.referencia);
        const codMov = formatCodMov(f.codMov, f.descripcion);
        const descripcion = padRightSpace(f.descripcion, 20);
        const importe = formatMontoCents(f.importe);
        const saldo = formatMontoCents(f.saldo);

        const row = [
            sucursalPadded,
            cuentaPadded,
            numHojaPadded,
            secuencia,
            fecha,
            referencia,
            codMov,
            descripcion,
            importe,
            saldo,
            '' // Trailing empty para terminar con ;
        ].join(';');
        lineas.push(row);
    });


    // 3. Registros de Cierre / Footer
    const footerSequences = ['999', '992', '993', '994', '995', '998', '996', '997'];
    footerSequences.forEach(seq => {
        const row = [
            sucursalPadded,
            cuentaPadded,
            numHojaPadded,
            seq,
            '00000000',
            ''.padStart(refLength, '0'),
            '000',
            padRightSpace('', 20),
            '000000000000000',
            '000000000000000',
            '' // Trailing empty para terminar con ;
        ].join(';');
        lineas.push(row);
    });

    return lineas.join('\r\n');
}

// ─────────────────────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────────────────────

function detectarCuentaTexto(text) {
    if (!text) return '';
    const m = text.match(/(?:cuenta|cta|c\/c|cc|c\.c|n\.? cta|nro\.? de cuenta|nro\.? cuenta)\s*[:$\s]*\s*([0-9./\-]+)/i);
    if (m) {
        return m[1].replace(/[^0-9]/g, '');
    }
    const m2 = text.match(/(\d{2,3}\.\d{3}\.\d{3}\/\d{2})/);
    if (m2) {
        return m2[1].replace(/[^0-9]/g, '');
    }
    return '';
}

function detectarCuentaExcel(rows) {
    if (!rows || !rows.length) return '';
    for (let i = 0; i < Math.min(rows.length, 25); i++) {
        const row = rows[i];
        if (!row) continue;
        const joined = row.join(' ');
        const c = detectarCuentaTexto(joined);
        if (c) return c;
    }
    return '';
}

// POST /api/conversor/upload — recibe uno o más archivos, devuelve filas JSON consolidadas
router.post('/upload', upload.any(), async (req, res) => {
    const files = req.files || (req.file ? [req.file] : []);
    if (files.length === 0) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    try {
        let todasLasFilas = [];
        let cuentaDetectada = '';
        let tipos = new Set();
        let nombresArchivos = [];

        for (const file of files) {
            // Decodificar el nombre original que Multer sube en ISO-8859-1 a UTF-8
            const decodedOriginalName = Buffer.from(file.originalname, 'binary').toString('utf8');

            // Sanitizar quitando tildes y caracteres problemáticos para descargas seguras
            const cleanName = decodedOriginalName
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Quita tildes
                .replace(/[^a-zA-Z0-9.\-_ ]/g, ''); // Solo deja caracteres ASCII seguros

            const ext = path.extname(cleanName).toLowerCase();
            tipos.add(ext === '.pdf' ? 'PDF' : 'Excel');
            nombresArchivos.push(cleanName);

            let filasFile = [];
            let cuentaFile = '';

            if (ext === '.pdf') {
                if (pdfParse) {
                    const data = await pdfParse(file.buffer);
                    cuentaFile = detectarCuentaTexto(data.text);
                }
                filasFile = await parsePdf(file.buffer);
            } else {
                const wb = XLSX.read(file.buffer, { type: 'buffer' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
                cuentaFile = detectarCuentaExcel(rows);
                filasFile = parseExcel(file.buffer);
            }

            if (cuentaFile && !cuentaDetectada) {
                cuentaDetectada = cuentaFile;
            }

            todasLasFilas.push(...filasFile);
        }

        if (todasLasFilas.length === 0) {
            return res.status(422).json({ error: 'No se encontraron movimientos válidos en los archivos subidos.' });
        }

        // Ordenar cronológicamente todas las filas de forma estable
        todasLasFilas.sort((a, b) => {
            const partsA = a.fecha.split('/');
            const partsB = b.fecha.split('/');
            const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
            const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
            return dateA - dateB;
        });

        let nombreArchivoConsolidado = '';
        if (nombresArchivos.length === 1) {
            nombreArchivoConsolidado = nombresArchivos[0];
        } else {
            nombreArchivoConsolidado = `Consolidado_${nombresArchivos.length}_archivos`;
        }

        res.json({
            tipo: Array.from(tipos).join(' + '),
            nombreArchivo: nombreArchivoConsolidado,
            totalFilas: todasLasFilas.length,
            cuentaDetectada,
            filas: todasLasFilas
        });
    } catch (err) {
        console.error('[conversor] Error al parsear:', err.message);
        res.status(500).json({ error: err.message });
    }
});



// POST /api/conversor/export — recibe filas + opciones, devuelve .txt
router.post('/export', express.json({ limit: '50mb' }), (req, res) => {
    const { filas, opciones, nombreBase } = req.body;
    if (!filas || !Array.isArray(filas)) return res.status(400).json({ error: 'Se requieren las filas' });

    try {
        const txt = generarTxt(filas, opciones || {});

        // Decodificar y sanitizar el nombre base para quitar tildes
        const decodedNombreBase = Buffer.from(nombreBase || 'extracto', 'binary').toString('utf8');
        const cleanNombreBase = decodedNombreBase
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9.\-_ ]/g, '');

        const refLength = parseInt(opciones?.refLength || 8, 10);
        const suffix = refLength === 15 ? '_convertido_ref15.txt' : '_convertido_ref8.txt';
        const nombre = cleanNombreBase.replace(/\.[^.]+$/, '') + suffix;

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
        res.send(txt);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/conversor/cuentas — devuelve la lista de cuentas bancarias parseadas del CSV
router.get('/cuentas', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const p = path.join(__dirname, '../../legacy/java-legacy/cuentas_bancarias.csv');

        if (!fs.existsSync(p)) {
            return res.json([]);
        }

        const content = fs.readFileSync(p, 'latin1');
        const lines = content.split(/\r?\n/);
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(';');
            if (parts.length < 8) continue;

            const numBanco = parts[0].trim();
            const nombre = parts[1].trim().replace(/\s+/g, ' ');
            const cuentaRaw = parts[2].trim();
            const cuenta = cuentaRaw.replace(/[^0-9]/g, '');
            const denominacion = parts[3].trim().replace(/\s+/g, ' ');
            const raf = parts[4].trim();
            const sucursal = parts[5].trim();
            const categoria = parts[6].trim().replace(/\s+/g, ' ');
            const activa = parts[7].trim();

            data.push({
                numBanco,
                nombre,
                cuenta,
                denominacion,
                raf,
                sucursal,
                categoria,
                activa: activa === 'S'
            });
        }
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

