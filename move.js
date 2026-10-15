const fs = require('fs');
let code = fs.readFileSync('frontend/src/views/GastosApremioReport.jsx', 'utf8');

const calcTitle = '<Section title="Calculadora Viva de Gastos"';
const startIdx = code.indexOf(calcTitle);
const realStart = code.lastIndexOf('      <Section', startIdx);
const endIdx = code.indexOf('      </Section>', startIdx) + 16;

const calcBlock = code.substring(realStart, endIdx);

// Remove it
code = code.substring(0, realStart) + code.substring(endIdx);

// Insert before Resumen Ejecutivo
const targetIdx = code.indexOf('{/* 1. Resumen Ejecutivo */}');
code = code.substring(0, targetIdx) + calcBlock + '\n\n      ' + code.substring(targetIdx);

fs.writeFileSync('frontend/src/views/GastosApremioReport.jsx', code);
console.log('Moved calc block successfully');
