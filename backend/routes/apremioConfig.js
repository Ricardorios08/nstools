const express = require('express');
const router = express.Router();
const maria = require('../db/maria');

const DB_NAME = 'recaudacion2';
const DB_RECAUDACION = 'recaudacion2'; 
const DB_APRE_CONFIG = 'recaudacion2'; 

// GET /apremio-config/paraapre
router.get('/paraapre', async (req, res) => {
    try {
        const rows = await maria.query(`SELECT * FROM ${DB_APRE_CONFIG}.paraapre`);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching paraapre:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /apremio-config/instjudi
router.get('/instjudi', async (req, res) => {
    try {
        const rows = await maria.query(`SELECT * FROM ${DB_APRE_CONFIG}.instjudi ORDER BY CodiInju`);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching instjudi:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /apremio-config/escaapre
router.get('/escaapre', async (req, res) => {
    try {
        const rows = await maria.query(`SELECT * FROM ${DB_APRE_CONFIG}.escaapre ORDER BY CodiPaap, CodiEsap`);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching escaapre:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /apremio-config/boleapre-sample?limit=10
router.get('/boleapre-sample', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit) || 10, 50);
        const rows = await maria.query(`SELECT * FROM ${DB_APRE_CONFIG}.boleapre WHERE CoadBoap > 0 LIMIT ?`, [limit]);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching boleapre sample:', err);
        res.status(500).json({ error: err.message });
    }
});

router.get('/debt', async (req, res) => {
    try {
        const { numeApre, cuenCtct, q } = req.query;
        console.log(`[DEBT CALC] URL: ${req.originalUrl}`);
        console.log(`[DEBT CALC] Query object:`, req.query);
        console.log(`[DEBT CALC] Request for numeApre: ${numeApre}, cuenCtct: ${cuenCtct}, q: ${q}`);
        
        let sql = '';
        let params = [];
        const searchVal = numeApre || cuenCtct || q;
        
        if (!searchVal) {
            console.log(`[DEBT CALC] Returning 400 because searchVal is empty.`);
            return res.status(400).json({ error: 'No se encontró el apremio o cuenta especificada' });
        }

        // Primero intentamos como NumeApre
        sql = `
            SELECT a.NumeApre, a.CuenCtct, a.CodiOfic, a.TotaApre, ea.DetaEsap as EstadoDeta, a.CapiApre as Capital, a.RecaApre as Recargo
            FROM ${DB_RECAUDACION}.apremio a
            LEFT JOIN ${DB_RECAUDACION}.estadoapremio ea ON a.EstaApre = ea.CodiEsap
            WHERE a.NumeApre = ?
        `;
        params = [searchVal];
        
        let rows = await maria.query(sql, params);
        
        // Si no encontró nada, intentamos como CuenCtct
        if (rows.length === 0) {
            sql = `
                SELECT a.NumeApre, a.CuenCtct, a.CodiOfic, a.TotaApre, ea.DetaEsap as EstadoDeta, a.CapiApre as Capital, a.RecaApre as Recargo
                FROM ${DB_RECAUDACION}.apremio a
                LEFT JOIN ${DB_RECAUDACION}.estadoapremio ea ON a.EstaApre = ea.CodiEsap
                WHERE a.CuenCtct = ?
                ORDER BY a.NumeApre DESC
                LIMIT 1
            `;
            params = [searchVal];
            rows = await maria.query(sql, params);
        }
        
        if (rows.length === 0) {
            return res.json({
                capital: 0,
                recargo: 0,
                numeApre: null,
                cuenCtct: null,
                codiOfic: null,
                debugSql: sql,
                debugParams: params
            });
        }

        res.json({
            capital: parseFloat(rows[0].Capital || 0),
            recargo: parseFloat(rows[0].Recargo || 0),
            numeApre: rows[0].NumeApre,
            cuenCtct: rows[0].CuenCtct,
            codiOfic: rows[0].CodiOfic,
            debugSql: sql,
            debugParams: params
        });
    } catch (err) {
        console.error('Error fetching debt:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
