const fs = require('fs');

const file = 'frontend/src/views/GastosApremioReport.jsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Add debugInfo state
code = code.replace(
  "const [searching, setSearching] = useState(false);",
  "const [searching, setSearching] = useState(false);\n  const [debugInfo, setDebugInfo] = useState({ sql: '', params: [] });"
);

// 2 & 3. Update handleSearch
const oldSearch = `      const isAccount = searchQuery.includes('-') || searchQuery.length > 8;
      const param = isAccount ? \`cuenCtct=\${searchQuery}\` : \`numeApre=\${searchQuery}\`;
      const res = await axios.get(\`\${API_URL}/apremio-config/debt?\${param}\`);
      if (res.data.capital > 0) {`;

const newSearch = `      const res = await axios.get(\`\${API_URL}/apremio-config/debt?q=\${searchQuery}\`);
      setDebugInfo({ sql: res.data.debugSql, params: res.data.debugParams });
      if (res.data.capital > 0) {`;

code = code.replace(oldSearch, newSearch);

// 4. Update Calculadora Logic (parseFloat)
code = code.replace(/p\.CamiPaap/g, "(parseFloat(p.CamiPaap)||0)");
code = code.replace(/p\.HrmiPaap/g, "(parseFloat(p.HrmiPaap)||0)");
code = code.replace(/p\.TajuPaap/g, "(parseFloat(p.TajuPaap)||0)");
code = code.replace(/p\.AplePaap/g, "(parseFloat(p.AplePaap)||0)");

// 5. Update Resumen de Boleta
const oldResumen = `                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span color="var(--text-dim)">Total Gastos:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                    {selectedCase === 1 && '$15,066.00'}
                    {selectedCase === 2 && '$43,882.77'}
                    {selectedCase === 3 && '$43,931.18'}
                    {selectedCase === 4 && '$24,335.18'}
                    {selectedCase === 5 && '$43,830.00'}
                    {selectedCase === 'large' && '$1,140,600.00'}
                  </span>
                </div>`;

const newResumen = `                {(() => {
                  const base = liveDebt ? (liveDebt.capital + liveDebt.recargo) : 0;
                  const p = (liveParams && liveParams.length > 0) ? liveParams[0] : { CamiPaap: 0, CamaPaap: 0, HrmiPaap: 0, TajuPaap: 0, AplePaap: 0 };
                  const format = (v) => '$' + (v || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 });
                  
                  let admin = 0, honorarios = 0, tasa = 0, aporte = 0, movilidad = 0;
                  
                  if (selectedCase === 'large') {
                    admin = 505000;
                    honorarios = 600000;
                    tasa = 18600;
                    aporte = 17000;
                  } else {
                    admin = Math.max(base * 0.03, parseFloat(p.CamiPaap)||0);
                    if (selectedCase === 1) {
                      movilidad = 66;
                    } else if (selectedCase === 2) {
                      honorarios = Math.max(base * 0.03, parseFloat(p.HrmiPaap)||0);
                      tasa = parseFloat(p.TajuPaap)||0;
                      aporte = Math.min(base * 0.02, parseFloat(p.AplePaap)||0);
                    } else if (selectedCase === 3) {
                      honorarios = Math.max(base * 0.03, parseFloat(p.HrmiPaap)||0);
                      movilidad = 66;
                    } else if (selectedCase === 4) {
                      honorarios = Math.max(base * 0.05, parseFloat(p.HrmiPaap)||0);
                      aporte = Math.min(base * 0.02, parseFloat(p.AplePaap)||0);
                    } else if (selectedCase === 5) {
                      honorarios = Math.max(base * 0.07, parseFloat(p.HrmiPaap)||0);
                      tasa = parseFloat(p.TajuPaap)||0;
                    }
                  }
                  
                  const totalGastos = admin + honorarios + tasa + aporte + movilidad;

                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-dim)' }}>Total Gastos:</span>
                      <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                        {format(totalGastos)}
                      </span>
                    </div>
                  );
                })()}`;

code = code.replace(oldResumen, newResumen);

// 6 & 7. Move Calculadora Viva de Gastos to Top and append Debug Block
const calcStartMarker = '<Section title="Calculadora Viva de Gastos"';
const calcStartIdx = code.indexOf(calcStartMarker);

// Find the precise opening <Section>
const realCalcStartIdx = code.lastIndexOf('      <Section', calcStartIdx);

// Find the precise closing </Section>
const calcEndIdx = code.indexOf('      </Section>', calcStartIdx) + 16;

const debugBlock = `
        {debugInfo.sql && (
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
        )}
`;

let calcBlock = code.substring(realCalcStartIdx, calcEndIdx);
// Append the debugBlock inside the Section before it closes
calcBlock = calcBlock.replace('      </Section>', debugBlock + '      </Section>');

// Remove from old location
code = code.substring(0, realCalcStartIdx) + code.substring(calcEndIdx);

// Insert right before Resumen Ejecutivo
const resumenIdx = code.indexOf('{/* 1. Resumen Ejecutivo */}');
code = code.substring(0, resumenIdx) + calcBlock + '\n\n      ' + code.substring(resumenIdx);

fs.writeFileSync(file, code);
console.log('Refactoring completed successfully.');
