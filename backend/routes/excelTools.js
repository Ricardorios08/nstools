const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const upload = multer({ dest: 'uploads/' });

/**
 * Fill down logic for merged cells in Excel
 * @param {Array} data 2D array of rows
 * @returns {Array} Processed rows
 */
function fillDownMergedCells(data) {
    if (data.length === 0) return [];

    // Find header row (usually the first row that has substantial data)
    // For this specific file, we skip till we find actual headers
    let headerRowIndex = 0;
    while (headerRowIndex < data.length && data[headerRowIndex].filter(c => c !== null).length < 5) {
        headerRowIndex++;
    }

    if (headerRowIndex >= data.length) return data;

    const headers = data[headerRowIndex];
    const results = [];
    const seenRows = new Set();

    // Columns to KEEP (by partial name match, case insensitive)
    // Everything else is automatically excluded
    const keepPatterns = [
        'comercio', 'fantasia', 'estado',
        'cod. subrubro', 'cod.subrubro', 'categoría', 'categoria',
        'utm', 'porcentaje', 'subrubro'
    ];

    // Build keep indices dynamically based on header names
    const keepIndices = [];
    headers.forEach((h, idx) => {
        if (h === null || h === undefined) return;
        const headerLower = String(h).toLowerCase().trim();
        // Skip any header containing "total"
        if (headerLower.includes('total')) return;
        const match = keepPatterns.some(pattern => headerLower.includes(pattern));
        if (match) keepIndices.push(idx);
    });

    console.log('[ExcelTools] Headers found:', headers.map((h, i) => `${i}:${h}`).join(' | '));
    console.log('[ExcelTools] Keeping columns:', keepIndices.map(i => `${i}:${headers[i]}`).join(' | '));

    const filteredHeaders = keepIndices.map(idx => headers[idx]);

    let lastKnownRow = new Array(headers.length).fill(null);

    // Find the original index of "Comercio" and "Subrubro" columns for the unique key
    const comercioIdx = headers.findIndex(h => h && String(h).toLowerCase().includes('comercio') && !String(h).toLowerCase().includes('exp'));
    const subrubroIdx = headers.findIndex(h => h && String(h).toLowerCase() === 'subrubro');
    const codSubrubroIdx = headers.findIndex(h => h && String(h).toLowerCase().includes('cod') && String(h).toLowerCase().includes('subrubro'));

    for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];

        // Skip "Total" rows or empty rows
        if (!row || row.every(c => c === null || c === undefined || c === '')) continue;
        const rowFirstCell = String(row[0] || '').toLowerCase();
        if (rowFirstCell.includes('total') || row.some(c => String(c).toLowerCase().includes('grand total'))) continue;

        // Fill down and Process
        const fullRow = row.map((cell, colIndex) => {
            if (cell !== null && cell !== undefined && cell !== '') {
                lastKnownRow[colIndex] = cell;
                return cell;
            }
            return lastKnownRow[colIndex];
        });

        // Filter to keep only desired columns
        const filteredRow = keepIndices.map(idx => fullRow[idx]);

        // Grouping (Unique check based on Commerce + Cod.Subrubro + Subrubro)
        const keyParts = [
            comercioIdx >= 0 ? fullRow[comercioIdx] : '',
            codSubrubroIdx >= 0 ? fullRow[codSubrubroIdx] : '',
            subrubroIdx >= 0 ? fullRow[subrubroIdx] : ''
        ];
        const rowKey = keyParts.join('-');

        if (!seenRows.has(rowKey)) {
            results.push(filteredRow);
            seenRows.add(rowKey);
        }
    }

    return { headers: filteredHeaders, rows: results };
}

router.post('/parse-comercios', upload.single('file'), (req, res) => {
    // Solo superadmin puede procesar/parsear archivos de comercio
    if (!req.user || req.user.rol !== 'superadmin') {
        return res.status(403).json({ error: 'No autorizado. Se requieren permisos de superadministrador.' });
    }

    let filePath;

    if (req.file) {
        filePath = req.file.path;
    } else {
        // Option to use the local file specified by user
        filePath = 'C:\\nomade\\migracion\\comercios-subrubros\\COMERCIOS HABILITADOS 2026.xlsx';
    }

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    try {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // header: 1 returns 2D array
        const rawData = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: null });

        const processed = fillDownMergedCells(rawData);

        // Clean up temp file if uploaded
        if (req.file) fs.unlinkSync(req.file.path);

        res.json(processed);
    } catch (err) {
        console.error('Error parsing excel:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
