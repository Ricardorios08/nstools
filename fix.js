const fs = require('fs');
const lines = fs.readFileSync('frontend/src/views/GastosApremioReport.jsx', 'utf8').split('\n');

// 1. Remove the setShowSqlModal line
const noModal = lines.map(l => l.replace('setShowSqlModal(true); // Mostrar el modal al buscar', ''));

// 2. Find Calculadora section
const startCalc = noModal.findIndex(l => l.includes('<Section title="Calculadora Viva de Gastos"'));
const endCalc = noModal.findIndex((l, i) => i > startCalc && l.includes('</Section>'));
const calcSection = noModal.slice(startCalc, endCalc + 1);

// 3. Remove Calculadora section from array
const withoutCalc = [...noModal.slice(0, startCalc), ...noModal.slice(endCalc + 1)];

// 4. Insert at Resumen Ejecutivo
const insertAt = withoutCalc.findIndex(l => l.includes('{/* 1. Resumen Ejecutivo */}'));
const newLines = [...withoutCalc.slice(0, insertAt), ...calcSection, '', ...withoutCalc.slice(insertAt)];

// 5. Replace parseFloat
const finalLines = newLines.map(l => 
    l.replace(/p\.CamiPaap/g, '(parseFloat(p.CamiPaap)||0)')
     .replace(/p\.HrmiPaap/g, '(parseFloat(p.HrmiPaap)||0)')
     .replace(/p\.TajuPaap/g, '(parseFloat(p.TajuPaap)||0)')
     .replace(/p\.AplePaap/g, '(parseFloat(p.AplePaap)||0)')
);

// 6. Find Modal Debug section at bottom to remove
const modalStart = finalLines.findIndex(l => l.includes('{/* Modal SQL Debug */}'));
const modalEnd = finalLines.findIndex((l, i) => i > modalStart && l.trim() === ')}');

let beforeModal = finalLines;
let afterModal = [];
if (modalStart !== -1 && modalEnd !== -1) {
    beforeModal = finalLines.slice(0, modalStart);
    afterModal = finalLines.slice(modalEnd + 1);
}

// 7. Add debug text right before the </Section> of Calculadora Viva de Gastos
const calcEndInNew = beforeModal.findIndex((l, i) => i > insertAt && l.includes('</Section>'));
const textToAppend = `      {debugInfo.sql && (
        <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
          <p style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-dim)', marginBottom: '0.5rem' }}>SQL Ejecutado para Búsqueda:</p>
          <pre style={{ background: '#1a1f2e', padding: '1rem', borderRadius: '8px', color: '#a5b4fc', fontSize: '0.75rem', overflowX: 'auto', whiteSpace: 'pre-wrap', margin: 0 }}>
            {debugInfo.sql}
          </pre>
          {debugInfo.params && debugInfo.params.length > 0 && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Parámetros: </strong>
              <code style={{ color: '#10b981', fontSize: '0.75rem' }}>{JSON.stringify(debugInfo.params)}</code>
            </div>
          )}
        </div>
      )}`;

beforeModal.splice(calcEndInNew, 0, textToAppend);

fs.writeFileSync('frontend/src/views/GastosApremioReport.jsx', [...beforeModal, ...afterModal].join('\n'));
console.log('Done!');
