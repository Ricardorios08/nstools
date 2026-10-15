import React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Constantes de diseño del PDF ────────────────────────────────────────────
const PDF_ACCENT = [30, 58, 138];
const PDF_SUCCESS = [22, 101, 52];
const PDF_WARNING = [146, 64, 14];
const PDF_ERROR = [153, 27, 27];
const PDF_INFO = [30, 64, 175];
const PDF_BG_LIGHT = [248, 250, 252];
const PDF_BORDER = [226, 232, 240];
const PDF_TEXT = [30, 41, 59];
const PDF_MUTED = [100, 116, 139];
const PAGE_W = 210;
const MARGIN = 18;
const CONTENT_W = PAGE_W - MARGIN * 2;

// Quita emojis y caracteres fuera del rango latin-1 que jsPDF no renderiza bien
function safe(str) {
  return (str || '').replace(/[^\u0000-\u00FF]/g, '').trim();
}

// ─── Helpers de dibujo ───────────────────────────────────────────────────────
function checkPageBreak(doc, y, needed = 20) {
  if (y + needed > doc.internal.pageSize.height - 20) {
    doc.addPage();
    return MARGIN + 6;
  }
  return y;
}

function drawSectionTitle(doc, y, title) {
  y = checkPageBreak(doc, y, 18);
  doc.setFillColor(...PDF_ACCENT);
  doc.rect(MARGIN, y, 4, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...PDF_ACCENT);
  doc.text(safe(title), MARGIN + 8, y + 6);
  doc.setDrawColor(...PDF_BORDER);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y + 10, MARGIN + CONTENT_W, y + 10);
  return y + 16;
}

function drawParagraph(doc, y, text, options = {}) {
  const { bold = false, color = PDF_TEXT, size = 9.5, indent = 0 } = options;
  y = checkPageBreak(doc, y, 12);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(safe(text), CONTENT_W - indent);
  doc.text(lines, MARGIN + indent, y);
  return y + lines.length * (size * 0.42) + 3;
}

function drawCallout(doc, y, type, title, body) {
  const cfg = {
    info:    { bg: [239, 246, 255], border: PDF_INFO,   title: PDF_INFO   },
    success: { bg: [240, 253, 244], border: PDF_SUCCESS, title: PDF_SUCCESS },
    warning: { bg: [255, 251, 235], border: PDF_WARNING, title: PDF_WARNING },
    error:   { bg: [254, 242, 242], border: PDF_ERROR,   title: PDF_ERROR   },
  }[type] || { bg: PDF_BG_LIGHT, border: PDF_MUTED, title: PDF_MUTED };

  const textX = MARGIN + 8;
  const textW = CONTENT_W - 10;
  const titleLines = title ? doc.setFontSize(9).splitTextToSize(safe(title), textW) : [];
  const bodyLines  = body  ? doc.setFontSize(8.5).splitTextToSize(safe(body), textW) : [];
  const boxH = (titleLines.length + bodyLines.length) * 4.2 + 10;

  y = checkPageBreak(doc, y, boxH + 4);

  doc.setFillColor(...cfg.bg);
  doc.setDrawColor(...cfg.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 2, 2, 'FD');
  doc.setFillColor(...cfg.border);
  doc.rect(MARGIN, y, 3, boxH, 'F');

  let ty = y + 6;
  if (titleLines.length) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...cfg.title);
    doc.text(titleLines, textX, ty);
    ty += titleLines.length * 4.2 + 1;
  }
  if (bodyLines.length) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...PDF_TEXT);
    doc.text(bodyLines, textX, ty);
  }
  return y + boxH + 4;
}

function drawStepList(doc, y, steps) {
  steps.forEach((step, i) => {
    y = checkPageBreak(doc, y, 14);
    doc.setFillColor(...PDF_ACCENT);
    doc.circle(MARGIN + 4, y + 2, 3.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text(String(i + 1), MARGIN + 4, y + 3, { align: 'center' });
    const clean = safe(step.replace(/<[^>]+>/g, ''));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...PDF_TEXT);
    const lines = doc.splitTextToSize(clean, CONTENT_W - 12);
    doc.text(lines, MARGIN + 11, y + 3);
    y += lines.length * 4.2 + 5;
  });
  return y + 2;
}

function drawDivider(doc, y) {
  y = checkPageBreak(doc, y, 8);
  doc.setDrawColor(...PDF_BORDER);
  doc.setLineWidth(0.4);
  doc.line(MARGIN, y, MARGIN + CONTENT_W, y);
  return y + 8;
}

function drawFaq(doc, y, q, a) {
  y = checkPageBreak(doc, y, 16);
  doc.setFillColor(...PDF_ACCENT);
  doc.roundedRect(MARGIN, y, 6, 5, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text('P', MARGIN + 3, y + 3.7, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PDF_TEXT);
  const qLines = doc.splitTextToSize(safe(q), CONTENT_W - 10);
  doc.text(qLines, MARGIN + 9, y + 3.7);
  y += qLines.length * 4.5 + 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...PDF_MUTED);
  const aLines = doc.splitTextToSize(safe(a), CONTENT_W - 10);
  doc.text(aLines, MARGIN + 9, y);
  return y + aLines.length * 4.2 + 6;
}

function addPageNumbers(doc) {
  const total = doc.internal.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.height;
    doc.setFillColor(...PDF_BG_LIGHT);
    doc.rect(0, h - 12, PAGE_W, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...PDF_MUTED);
    doc.text('Municipalidad de Guaymallen - Sistema de Migracion Contable', MARGIN, h - 4.5);
    doc.text(`Pag. ${i} / ${total}`, PAGE_W - MARGIN, h - 4.5, { align: 'right' });
  }
}

// ─── Función principal de generación ─────────────────────────────────────────
function generarPDF() {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = MARGIN;

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...PDF_ACCENT);
  doc.rect(0, 0, PAGE_W, 52, 'F');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 200, 240);
  doc.text('GUIA DEL OPERADOR', MARGIN, 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.text('Conversor de Extractos Bancarios', MARGIN, 26);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(180, 200, 240);
  doc.text('Todo lo que necesitas saber para usar el conversor correctamente', MARGIN, 34);

  doc.setFontSize(8);
  doc.setTextColor(140, 170, 220);
  doc.text('Septiembre 2026  |  Municipalidad de Guaymallen  |  Version 1.0', MARGIN, 44);

  y = 62;

  // ── SECCIÓN 1: Para que sirve ───────────────────────────────────────────────
  y = drawSectionTitle(doc, y, 'Para que sirve el conversor');
  y = drawParagraph(doc, y,
    'El conversor toma el extracto bancario que descargas del banco (en formato Excel o PDF) y lo transforma en un archivo de texto (.txt) con el formato que necesita el sistema contable de la Municipalidad para registrar los movimientos.'
  );
  y = drawParagraph(doc, y,
    'Sin el conversor, tendrias que tipear a mano cada movimiento. Con el conversor, el proceso es automatico y lleva solo unos segundos.'
  );

  // Diagrama de flujo
  y += 2;
  const boxes = [
    { label: 'Extracto del banco', sub: '(.xlsx / .xls / .pdf)' },
    null,
    { label: 'Conversor', sub: '' },
    null,
    { label: 'Archivo listo', sub: '(.txt para el sistema)' },
  ];
  const boxW = 42; const boxH = 12; const gap = 8; const arrowW = 12;
  const totalW = boxes.filter(b => b).length * boxW + boxes.filter(b => !b).length * arrowW + gap * 2;
  let bx = MARGIN + (CONTENT_W - totalW) / 2;
  const by = y;
  boxes.forEach(box => {
    if (!box) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...PDF_MUTED);
      doc.text('->', bx + arrowW / 2, by + boxH / 2 + 2, { align: 'center' });
      bx += arrowW + gap / 2;
    } else {
      doc.setFillColor(...PDF_BG_LIGHT);
      doc.setDrawColor(...PDF_BORDER);
      doc.setLineWidth(0.4);
      doc.roundedRect(bx, by, boxW, boxH, 2, 2, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(...PDF_TEXT);
      doc.text(safe(box.label), bx + boxW / 2, by + 5, { align: 'center' });
      if (box.sub) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        doc.setTextColor(...PDF_MUTED);
        doc.text(safe(box.sub), bx + boxW / 2, by + 9.5, { align: 'center' });
      }
      bx += boxW + gap / 2;
    }
  });
  y = by + boxH + 8;
  y = drawDivider(doc, y);

  // ── SECCIÓN 2: Como usar ────────────────────────────────────────────────────
  y = drawSectionTitle(doc, y, 'Como usar el conversor, paso a paso');
  y = drawStepList(doc, y, [
    'Descarga el extracto del banco. Entra al home banking y descarga el extracto del periodo que necesitas. Guardalo en tu computadora (generalmente en la carpeta Descargas). Puede ser Excel (.xlsx) o PDF.',
    'Abri el conversor desde el navegador y hace clic en "Seleccionar archivo".',
    'Elegi el archivo que descargaste del banco. Si tenes varios meses, podes subirlos todos juntos y el conversor los une en orden cronologico.',
    'Verifica que los datos se vean bien en la tabla de previsualizacion. Controla que las fechas, los importes y los movimientos sean los correctos.',
    'Completa los datos del banco (sucursal, numero de cuenta, numero de hoja) si no se completaron solos.',
    'Hace clic en "Descargar .txt". Se va a guardar el archivo final listo para importar al sistema contable.',
  ]);
  y = drawDivider(doc, y);

  // ── SECCIÓN 3: Tipos de movimiento ─────────────────────────────────────────
  y = drawSectionTitle(doc, y, 'Tipos de movimiento: Debito y Haber');
  y = drawParagraph(doc, y,
    'Cada movimiento del extracto es clasificado automaticamente como Debito (plata que sale) o Haber (plata que entra). Esto se determina por el signo del importe en el extracto:'
  );
  y += 2;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    head: [['Importe en el extracto', 'Tipo de movimiento', 'Codigo', 'Significado']],
    body: [
      ['Numero negativo  (ej: -120.000)', 'Debito (D)', '010', 'Plata que salio de la cuenta'],
      ['Numero positivo  (ej: +50.000)',  'Haber (H)',  '510', 'Plata que entro a la cuenta'],
      ['Descripcion: "saldo"',            'Saldo',      '502', 'Registro de saldo (no es movimiento)'],
      ['Vacio o cero',                    '-',          'Se descarta', 'La linea se ignora'],
    ],
    headStyles: { fillColor: PDF_ACCENT, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: PDF_TEXT },
    alternateRowStyles: { fillColor: PDF_BG_LIGHT },
    columnStyles: { 2: { fontStyle: 'bold', halign: 'center' } },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 4;
  y = drawCallout(doc, y, 'info',
    'Por que algunos bancos tienen columnas separadas?',
    'Algunos extractos tienen columnas "Debe" y "Haber" por separado. Otros (como Supervielle) tienen una sola columna "Importe" con numeros positivos y negativos. El conversor detecta automaticamente que formato usa cada banco.'
  );
  y = drawDivider(doc, y);

  // ── SECCIÓN 4: Que filas se incluyen ───────────────────────────────────────
  y = drawSectionTitle(doc, y, 'Que lineas se incluyen y cuales se descartan');
  y = drawParagraph(doc, y,
    'No todas las lineas del extracto bancario se convierten. El conversor aplica filtros para quedarse solo con los movimientos reales:'
  );
  y = drawCallout(doc, y, 'success',
    'Se incluyen las filas que tienen:',
    'Una fecha valida (dia/mes/anio) Y un importe distinto de cero.'
  );
  y = drawCallout(doc, y, 'error',
    'Se descartan automaticamente las filas que tienen:',
    'Fecha vacia, importe vacio, importe igual a cero, o filas completamente en blanco (como encabezados, saldos de apertura, titulos del banco, etc.).'
  );
  y = drawCallout(doc, y, 'warning',
    'Si la cantidad de lineas no coincide con el extracto original:',
    'Es normal que haya menos lineas, porque las filas vacias, los titulos y los saldos iniciales/finales se filtran. Si aparecen mas lineas de las esperadas, es probable que el archivo Excel tenga filas ocultas o datos de fechas que no corresponden al periodo que queres.'
  );
  y = drawDivider(doc, y);

  // ── SECCIÓN 5: Bancos soportados ───────────────────────────────────────────
  y = drawSectionTitle(doc, y, 'Bancos y formatos soportados');
  y = drawParagraph(doc, y,
    'El conversor puede leer extractos de distintos bancos. Detecta automaticamente el formato, pero es importante subir el archivo tal como lo descargas del banco, sin modificar la estructura.'
  );
  y += 2;
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    head: [['Banco / Formato', 'Tipo de archivo', 'Observaciones']],
    body: [
      ['Banco Nacion',    'Excel (.xlsx)', 'Tiene columnas Debe / Haber separadas'],
      ['Supervielle',     'Excel (.xlsx)', 'Importe unico con signo positivo/negativo'],
      ['Galicia',         'Excel (.xlsx)', 'Similar a Supervielle'],
      ['Credicoop',       'Excel (.xlsx)', 'Similar a Supervielle'],
      ['Tarjeta Nacion',  'Excel (.xlsx)', 'Formato especial "Reporte de Cuenta", se detecta automaticamente'],
      ['Cualquier banco', 'PDF',           'Compatible si el PDF tiene texto seleccionable (no escaneado)'],
    ],
    headStyles: { fillColor: PDF_ACCENT, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: PDF_TEXT },
    alternateRowStyles: { fillColor: PDF_BG_LIGHT },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 4;
  y = drawDivider(doc, y);

  // ── SECCIÓN 6: Preguntas frecuentes ────────────────────────────────────────
  y = drawSectionTitle(doc, y, 'Preguntas frecuentes');
  const faqs = [
    {
      q: 'El conversor trajo muchas mas lineas de las que esperaba. Por que?',
      a: 'Si editaste el Excel antes de subirlo, verifica que no haya quedado informacion de otras fechas o meses anteriores en el archivo. Tambien puede pasar si el extracto cubre un rango de fechas mas amplio del que necesitas. En ese caso, podes filtrar las fechas directamente en la tabla de previsualizacion antes de descargar el .txt.',
    },
    {
      q: 'Me aparece el error "No se encontraron movimientos validos". Que hago?',
      a: 'Significa que el conversor no pudo identificar ninguna fila con fecha e importe validos. Verifica que el archivo no este vacio o que no sea un formato de extracto que el sistema aun no reconoce. Consulta con el responsable del sistema.',
    },
    {
      q: 'Puedo subir varios meses de una vez?',
      a: 'Si. Podes seleccionar multiples archivos y el conversor los procesa todos juntos, ordenando los movimientos por fecha cronologicamente de forma automatica.',
    },
    {
      q: 'Que son los campos "Sucursal", "Cuenta" y "Numero de Hoja"?',
      a: 'Son datos del banco que van al inicio de cada linea del archivo final y que el sistema contable usa para identificar de que cuenta bancaria provienen los movimientos. En muchos casos el conversor los detecta solo del extracto; si no, los completas manualmente antes de descargar.',
    },
    {
      q: 'Para que sirven los registros 001, 999, 992... al inicio y fin del archivo?',
      a: 'Son registros de apertura y cierre que el sistema contable requiere para saber donde empieza y termina el bloque de movimientos. Se generan automaticamente, no hace falta que los toques. Los movimientos reales van entre el 002 y el anterior al 999.',
    },
    {
      q: 'Las fechas aparecen en un formato raro (ej: 20260302). Es correcto?',
      a: 'Si, es correcto. El archivo .txt usa el formato AAAAMMDD (anio, mes, dia sin separadores) que es el formato que espera el sistema contable. La fecha 20260302 significa 02 de marzo de 2026.',
    },
    {
      q: 'Los importes en el .txt tienen 15 digitos y parecen muy grandes. Estan bien?',
      a: 'Si, es correcto. Los importes se guardan en centavos para evitar decimales. Por ejemplo, $1.234,56 se guarda como 000000000123456. El sistema contable los interpreta dividiendo por 100 automaticamente.',
    },
  ];
  faqs.forEach(({ q, a }) => { y = drawFaq(doc, y, q, a); });
  y = drawDivider(doc, y);

  // ── SECCIÓN 7: Glosario ────────────────────────────────────────────────────
  y = drawSectionTitle(doc, y, 'Glosario de términos');
  autoTable(doc, {
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    tableWidth: CONTENT_W,
    head: [['Término', 'Descripción']],
    body: [
      ['Comprobante / Referencia', 'Número que identifica cada operación. Sirve para rastrear el movimiento en el banco'],
      ['Archivo .txt', 'El archivo de texto que genera el conversor y que se importa al sistema contable'],
      ['Sucursal', 'Número de la sucursal bancaria donde está radicada la cuenta'],
    ],
    headStyles: { fillColor: PDF_ACCENT, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    bodyStyles: { fontSize: 8.5, textColor: PDF_TEXT },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 52 } },
    alternateRowStyles: { fillColor: PDF_BG_LIGHT },
    theme: 'grid',
  });
  y = doc.lastAutoTable.finalY + 4;

  // ── NUMERACIÓN DE PÁGINAS ─────────────────────────────────────────────────
  addPageNumbers(doc);

  doc.save('Ayuda-Conversor-Extractos-Bancarios.pdf');
}

// ─── Componentes visuales (sin cambios) ──────────────────────────────────────
const Section = ({ icon, title, children }) => (
  <div style={{ marginBottom: '2rem' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem', paddingBottom: '10px', borderBottom: '2px solid var(--border)' }}>
      <span style={{ fontSize: '1.4rem' }}>{icon}</span>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{title}</h2>
    </div>
    {children}
  </div>
);

const Callout = ({ type, icon, title, children }) => {
  const styles = {
    info: { bg: 'rgba(25, 118, 210, 0.08)', border: '#1976d2' },
    success: { bg: 'rgba(56, 142, 60, 0.08)', border: '#388e3c' },
    warning: { bg: 'rgba(249, 168, 37, 0.10)', border: '#f9a825' },
    error: { bg: 'rgba(198, 40, 40, 0.08)', border: '#c62828' },
  };
  const s = styles[type] || styles.info;
  return (
    <div style={{ background: s.bg, borderLeft: `4px solid ${s.border}`, borderRadius: '8px', padding: '12px 16px', margin: '12px 0', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
      <span style={{ fontSize: '1.2rem', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <div style={{ lineHeight: 1.65, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        {title && <strong style={{ display: 'block', marginBottom: '4px', color: 'var(--text-primary)' }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
};

const Pill = ({ color, children }) => {
  const colors = {
    red: { bg: 'rgba(198,40,40,0.12)', text: '#ef5350' },
    green: { bg: 'rgba(56,142,60,0.12)', text: '#66bb6a' },
    blue: { bg: 'rgba(25,118,210,0.12)', text: '#42a5f5' },
    gray: { bg: 'rgba(128,128,128,0.15)', text: 'var(--text-secondary)' },
  };
  const c = colors[color] || colors.gray;
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 600, background: c.bg, color: c.text }}>{children}</span>
  );
};

const StepList = ({ steps }) => (
  <ol style={{ listStyle: 'none', padding: 0, margin: 0 }}>
    {steps.map((step, i) => (
      <li key={i} style={{ display: 'flex', gap: '14px', marginBottom: '14px', alignItems: 'flex-start' }}>
        <span style={{ minWidth: '26px', height: '26px', background: 'var(--accent)', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>
          {i + 1}
        </span>
        <span style={{ lineHeight: 1.65, fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '3px' }} dangerouslySetInnerHTML={{ __html: step }} />
      </li>
    ))}
  </ol>
);

const Table = ({ headers, rows }) => (
  <div style={{ overflowX: 'auto', marginTop: '12px' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
      <thead>
        <tr style={{ background: 'var(--accent)' }}>
          {headers.map((h, i) => (
            <th key={i} style={{ padding: '10px 14px', textAlign: 'left', color: 'white', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)' }}>
            {row.map((cell, j) => (
              <td key={j} style={{ padding: '9px 14px', color: 'var(--text-secondary)', verticalAlign: 'top' }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const FaqItem = ({ q, a }) => (
  <div style={{ marginBottom: '1.25rem' }}>
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', marginBottom: '6px' }}>
      <span style={{ background: 'var(--accent)', color: 'white', borderRadius: '6px', padding: '1px 7px', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0, marginTop: '2px' }}>P</span>
      <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{q}</strong>
    </div>
    <p style={{ margin: 0, paddingLeft: '28px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.65 }}>{a}</p>
  </div>
);

export default function AyudaConversor() {
  const handlePrint = () => generarPDF();

  return (
    <div style={{ maxWidth: '860px', margin: '0 auto', padding: '1.5rem' }}>

      {/* Cabecera */}
      <div style={{
        background: 'linear-gradient(135deg, #1a1a5e 0%, #16213e 60%, #0f3460 100%)',
        borderRadius: '16px',
        padding: '40px 40px 36px',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '300px', height: '300px', background: 'rgba(255,255,255,0.03)', borderRadius: '50%', transform: 'translate(80px,-80px)' }} />
        <div style={{ display: 'inline-block', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '20px', padding: '3px 14px', fontSize: '0.7rem', letterSpacing: '1px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', marginBottom: '14px' }}>
          Guía del operador
        </div>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'white', margin: '0 0 8px', lineHeight: 1.25 }}>
          Conversor de Extractos Bancarios
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.65)', margin: '0 0 24px', fontSize: '0.95rem' }}>
          Todo lo que necesitás saber para usar el conversor correctamente
        </p>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {['📅 Septiembre 2026', '🏛️ Municipalidad de Guaymallén', '📄 Versión 1.0'].map(m => (
            <span key={m} style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)' }}>{m}</span>
          ))}
        </div>
        <button
          onClick={handlePrint}
          style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', color: 'white', padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          📥 Descargar PDF
        </button>
      </div>

      {/* Card contenedor */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', padding: '2.5rem', display: 'flex', flexDirection: 'column', gap: '0' }}>

        {/* ¿Para qué sirve? */}
        <Section icon="🔄" title="¿Para qué sirve el conversor?">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            El conversor toma el <strong>extracto bancario</strong> que descargás del banco (en formato Excel o PDF)
            y lo transforma en un <strong>archivo de texto (.txt)</strong> con el formato que necesita el sistema
            contable de la Municipalidad para registrar los movimientos.
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '16px' }}>
            Sin el conversor, tendrías que tipear a mano cada movimiento. Con el conversor, el proceso es
            automático y lleva solo unos segundos.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', margin: '16px 0' }}>
            {[
              { label: '📊 Extracto del banco', sub: '(.xlsx / .xls / .pdf)' },
              { arrow: true },
              { label: '⚙️ Conversor', sub: '' },
              { arrow: true },
              { label: '📄 Archivo listo', sub: '(.txt para el sistema)' },
            ].map((item, i) =>
              item.arrow
                ? <span key={i} style={{ fontSize: '1.4rem', color: 'var(--text-muted)', fontWeight: 700 }}>→</span>
                : <div key={i} style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--border)', borderRadius: '10px', padding: '10px 18px', textAlign: 'center', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', minWidth: '110px' }}>
                  {item.label}<br /><span style={{ fontWeight: 400, fontSize: '0.72rem', opacity: 0.7 }}>{item.sub}</span>
                </div>
            )}
          </div>
        </Section>

        <hr style={{ border: 'none', borderTop: '2px solid var(--border)', margin: '1.5rem 0' }} />

        {/* Cómo usar */}
        <Section icon="📋" title="Cómo usar el conversor, paso a paso">
          <StepList steps={[
            'Descargá el extracto del banco. Entrá al home banking y descargá el extracto del período que necesitás. Guardalo en tu computadora (generalmente en la carpeta Descargas). Puede ser Excel (.xlsx) o PDF.',
            'Abrí el conversor desde el navegador y hacé clic en <strong>"Seleccionar archivo"</strong>.',
            'Elegí el archivo que descargaste del banco. Si tenés varios meses, podés subirlos todos juntos y el conversor los une en orden cronológico.',
            'Verificá que los datos se vean bien en la tabla de previsualización. Controlá que las fechas, los importes y los movimientos sean los correctos.',
            'Completá los datos del banco (sucursal, número de cuenta, número de hoja) si no se completaron solos.',
            'Hacé clic en <strong>"Descargar .txt"</strong>. Se va a guardar el archivo final listo para importar al sistema contable.',
          ]} />
        </Section>

        <hr style={{ border: 'none', borderTop: '2px solid var(--border)', margin: '1.5rem 0' }} />

        {/* Tipos de movimiento */}
        <Section icon="💰" title="Tipos de movimiento: Débito y Haber">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            Cada movimiento del extracto es clasificado automáticamente como <strong>Débito</strong> (plata que sale)
            o <strong>Haber</strong> (plata que entra). Esto se determina por el signo del importe en el extracto:
          </p>
          <Table
            headers={['Importe en el extracto', 'Tipo de movimiento', 'Código en el archivo', 'Significado']}
            rows={[
              [<><Pill color="red">Número negativo</Pill> &nbsp; ej: -120.000</>, 'Débito (D)', <strong>010</strong>, 'Plata que salió de la cuenta'],
              [<><Pill color="green">Número positivo</Pill> &nbsp; ej: +50.000</>, 'Haber (H)', <strong>510</strong>, 'Plata que entró a la cuenta'],
              [<><Pill color="blue">Descripción: "saldo"</Pill></>, 'Saldo', <strong>502</strong>, 'Registro de saldo (no es movimiento)'],
              [<><Pill color="gray">Vacío o cero</Pill></>, '—', 'Se descarta', 'La línea se ignora, no aparece'],
            ]}
          />
          <Callout type="info" icon="ℹ️" title="¿Por qué algunos bancos tienen columnas separadas?">
            Algunos extractos tienen columnas "Debe" y "Haber" por separado. Otros (como Supervielle) tienen
            una sola columna "Importe" con números positivos y negativos. El conversor detecta automáticamente
            qué formato usa cada banco.
          </Callout>
        </Section>

        <hr style={{ border: 'none', borderTop: '2px solid var(--border)', margin: '1.5rem 0' }} />

        {/* Qué filas se incluyen */}
        <Section icon="🔍" title="¿Qué líneas se incluyen y cuáles se descartan?">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '8px' }}>
            No todas las líneas del extracto bancario se convierten. El conversor aplica filtros para
            quedarse solo con los movimientos reales:
          </p>
          <Callout type="success" icon="✅" title="Se incluyen las filas que tienen:">
            Una fecha válida (día/mes/año) <strong>Y</strong> un importe distinto de cero.
          </Callout>
          <Callout type="error" icon="❌" title="Se descartan automáticamente las filas que tienen:">
            Fecha vacía, importe vacío, importe igual a cero, o filas completamente en blanco
            (como encabezados, saldos de apertura, títulos del banco, etc.).
          </Callout>
          <Callout type="warning" icon="⚠️" title="Si la cantidad de líneas no coincide con el extracto original:">
            Es normal que haya <em>menos</em> líneas, porque las filas vacías, los títulos y los saldos
            iniciales/finales se filtran. Si aparecen <em>más</em> líneas de las esperadas, es probable que
            el archivo Excel tenga filas ocultas o datos de fechas que no corresponden al período que querés.
          </Callout>
        </Section>

        <hr style={{ border: 'none', borderTop: '2px solid var(--border)', margin: '1.5rem 0' }} />

        {/* Bancos soportados */}
        <Section icon="🏦" title="Bancos y formatos soportados">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '12px' }}>
            El conversor puede leer extractos de distintos bancos. Detecta automáticamente el formato,
            pero es importante subir el archivo <strong>tal como lo descargás del banco</strong>, sin modificar la estructura.
          </p>
          <Table
            headers={['Banco / Formato', 'Tipo de archivo', 'Observaciones']}
            rows={[
              ['Banco Nación', <Pill color="green">Excel (.xlsx)</Pill>, 'Tiene columnas Debe / Haber separadas'],
              ['Supervielle', <Pill color="green">Excel (.xlsx)</Pill>, 'Importe único con signo positivo/negativo'],
              ['Galicia', <Pill color="green">Excel (.xlsx)</Pill>, 'Similar a Supervielle'],
              ['Credicoop', <Pill color="green">Excel (.xlsx)</Pill>, 'Similar a Supervielle'],
              ['Tarjeta Nación', <Pill color="green">Excel (.xlsx)</Pill>, 'Formato especial "Reporte de Cuenta", se detecta automáticamente'],
              ['Cualquier banco', <Pill color="blue">PDF</Pill>, 'Compatible si el PDF tiene texto seleccionable (no escaneado)'],
            ]}
          />
        </Section>

        <hr style={{ border: 'none', borderTop: '2px solid var(--border)', margin: '1.5rem 0' }} />

        {/* Preguntas frecuentes */}
        <Section icon="❓" title="Preguntas frecuentes">
          <FaqItem
            q="El conversor trajo muchas más líneas de las que esperaba. ¿Por qué?"
            a="Si editaste el Excel antes de subirlo, verificá que no haya quedado información de otras fechas o meses anteriores en el archivo. También puede pasar si el extracto cubre un rango de fechas más amplio del que necesitás. En ese caso, podés filtrar las fechas directamente en la tabla de previsualización antes de descargar el .txt."
          />
          <FaqItem
            q='Me aparece el error "No se encontraron movimientos válidos". ¿Qué hago?'
            a="Significa que el conversor no pudo identificar ninguna fila con fecha e importe válidos. Verificá que el archivo no esté vacío o que no sea un formato de extracto que el sistema aún no reconoce. Consultá con el responsable del sistema."
          />
          <FaqItem
            q="¿Puedo subir varios meses de una vez?"
            a="Sí. Podés seleccionar múltiples archivos y el conversor los procesa todos juntos, ordenando los movimientos por fecha cronológicamente de forma automática."
          />
          <FaqItem
            q='¿Qué son los campos "Sucursal", "Cuenta" y "Número de Hoja"?'
            a="Son datos del banco que van al inicio de cada línea del archivo final y que el sistema contable usa para identificar de qué cuenta bancaria provienen los movimientos. En muchos casos el conversor los detecta solo del extracto; si no, los completás manualmente antes de descargar."
          />
          <FaqItem
            q="¿Para qué sirven los registros 001, 999, 992... al inicio y fin del archivo?"
            a="Son registros de apertura y cierre que el sistema contable requiere para saber dónde empieza y termina el bloque de movimientos. Se generan automáticamente, no hace falta que los toques. Los movimientos reales van entre el 002 y el anterior al 999."
          />
          <FaqItem
            q="Las fechas aparecen en un formato raro (ej: 20260302). ¿Es correcto?"
            a="Sí, es correcto. El archivo .txt usa el formato AAAAMMDD (año, mes, día sin separadores) que es el formato que espera el sistema contable. La fecha 20260302 significa 02 de marzo de 2026."
          />
          <FaqItem
            q="Los importes en el .txt tienen 15 dígitos y parecen muy grandes. ¿Están bien?"
            a="Sí, es correcto. Los importes se guardan en centavos para evitar decimales. Por ejemplo, $1.234,56 se guarda como 000000000123456. El sistema contable los interpreta dividiendo por 100 automáticamente."
          />
        </Section>

        <hr style={{ border: 'none', borderTop: '2px solid var(--border)', margin: '1.5rem 0' }} />

        {/* Glosario */}
        <Section icon="📖" title="Glosario de términos">
          <Table
            headers={['Término', 'Qué significa']}
            rows={[
              [<strong>Extracto bancario</strong>, 'El listado de todos los movimientos de una cuenta bancaria en un período'],
              [<strong>Débito (D / 010)</strong>, 'Plata que salió de la cuenta (egreso, pago, transferencia enviada)'],
              [<strong>Haber (H / 510)</strong>, 'Plata que entró a la cuenta (cobro, depósito, transferencia recibida)'],
              [<strong>Saldo (502)</strong>, 'El saldo de la cuenta en un momento dado. No es un movimiento, es una foto del estado de la cuenta'],
              [<strong>Comprobante / Referencia</strong>, 'Número que identifica cada operación. Sirve para rastrear el movimiento en el banco'],
              [<strong>Archivo .txt</strong>, 'El archivo de texto que genera el conversor y que se importa al sistema contable'],
              [<strong>Sucursal</strong>, 'Número de la sucursal bancaria donde está radicada la cuenta'],
            ]}
          />
        </Section>

      </div>

      {/* Footer */}
      <div style={{ marginTop: '1.5rem', padding: '16px 24px', background: 'var(--bg-secondary)', borderRadius: '10px', border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
        <span>Municipalidad de Guaymallén — Sistema de Migración Contable</span>
        <span>Para consultas técnicas, contactar al área de Sistemas</span>
      </div>

    </div>
  );
}
