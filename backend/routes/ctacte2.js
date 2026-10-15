const express = require('express');
const router = express.Router();
const mariaDB = require('../db/maria');

const DB_NAME = 'recaudacion2'; // Solo para ctacte
const DB_RECAUDACION = 'recaudacion2'; 
const postgresDB = require('../db/postgres');

// Get list of offices
router.get('/offices', async (req, res) => {
    try {
        const offices = await mariaDB.queryRemote(`SELECT CodiOfic, DetaOfic FROM ${DB_RECAUDACION}.oficina ORDER BY CodiOfic`);
        const result = [...offices, { CodiOfic: 99, DetaOfic: 'CUIL/CUIT' }];
        res.json(result);
    } catch (err) {
        console.error('Error fetching offices:', err);
        res.status(500).json({ error: err.message });
    }
});

// Search persons by name, CUIT, DNI, or percod
router.get('/search-person', async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    try {
        const searchTerm = q.trim();
        let query;
        let params;

        // Detect search type
        const isNumeric = /^\d+$/.test(searchTerm);
        const isCuit = /^\d{2}-?\d{7,8}-?\d{1}$/.test(searchTerm);

        if (isCuit) {
            // Search by CUIT (with or without dashes)
            const clean = searchTerm.replace(/-/g, '');
            const tipo = parseInt(clean.substring(0, 2));
            const nro = parseInt(clean.substring(2, clean.length - 1));
            const dig = parseInt(clean.substring(clean.length - 1));

            query = `
                SELECT p.percod, TRIM(p.pernom) as pernom, 
                       p.percuiltipo, p.percuilnro, p.percuildigver,
                       CONCAT(p.percuiltipo, '-', p.percuilnro, '-', p.percuildigver) as cuit
                FROM public.persona p
                WHERE p.percuiltipo = $1 AND p.percuilnro = $2 AND p.percuildigver = $3
                LIMIT 20
            `;
            params = [tipo, nro, dig];
        } else if (isNumeric) {
            // Search by percod OR by DNI number (percuilnro)
            query = `
                SELECT p.percod, TRIM(p.pernom) as pernom,
                       p.percuiltipo, p.percuilnro, p.percuildigver,
                       CONCAT(p.percuiltipo, '-', p.percuilnro, '-', p.percuildigver) as cuit
                FROM public.persona p
                WHERE p.percod = $1 OR p.percuilnro = $1
                ORDER BY p.percod
                LIMIT 20
            `;
            params = [parseInt(searchTerm)];
        } else {
            // Search by name (partial, case insensitive)
            query = `
                SELECT p.percod, TRIM(p.pernom) as pernom,
                       p.percuiltipo, p.percuilnro, p.percuildigver,
                       CONCAT(p.percuiltipo, '-', p.percuilnro, '-', p.percuildigver) as cuit
                FROM public.persona p
                WHERE UPPER(p.pernom) LIKE UPPER($1)
                ORDER BY p.pernom
                LIMIT 20
            `;
            params = [`%${searchTerm}%`];
        }

        const result = await postgresDB.query(query, params);

        // For each person found, get their associated offices/accounts
        const enriched = await Promise.all(result.rows.map(async (person) => {
            const accQuery = `
                SELECT DISTINCT t.tbecod as account, tt.tpotribcod as "officeId", tt.tpotribnom as "officeName"
                FROM public.tribper tp
                JOIN public.tributo t ON tp.tribcod = t.tribcod
                JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod
                WHERE tp.percod = $1
                ORDER BY tt.tpotribcod
                LIMIT 20
            `;
            const accRes = await postgresDB.query(accQuery, [person.percod]);
            return {
                ...person,
                cuit: person.percuiltipo > 0 ? person.cuit : null,
                accounts: accRes.rows
            };
        }));

        res.json(enriched);
    } catch (err) {
        console.error('Error searching persons:', err);
        res.status(500).json({ error: err.message });
    }
});

// Resolve account: finds which offices an account exists in (MariaDB & Postgres)
router.get('/resolve-account/:account', async (req, res) => {
    const { account } = req.params;
    const { searchType } = req.query;
    let conn;
    try {
        const officesFound = new Set();

        if (searchType === 'person') {
            // Search in Postgres for all offices this person has (via movements or ownership)
            const pgQuery = `
                SELECT DISTINCT t.tpotribcod as "officeId"
                FROM public.generacioncuota gc
                JOIN public.tributo t ON gc.genctatribcod = t.tribcod
                WHERE gc.genctapercod = $1
                UNION
                SELECT DISTINCT t.tpotribcod as "officeId"
                FROM public.tribper tp
                JOIN public.tributo t ON tp.tribcod = t.tribcod
                WHERE tp.percod = $1
            `;
            const pgRes = await require('../db/postgres').query(pgQuery, [account]);
            pgRes.rows.forEach(r => officesFound.add(r.officeId.toString()));
        } else {
            // Default: Search by account in both DBs
            conn = await mariaDB.getRemoteConnection();
            const mariaOffices = await conn.query(`
                SELECT DISTINCT CodiOfic FROM ${DB_NAME}.ctacte WHERE CuenCtct = ?
            `, [account]);
            mariaOffices.forEach(r => officesFound.add(r.CodiOfic.toString()));

            try {
                const histoOffices = await conn.query(`
                    SELECT DISTINCT CodiOfic FROM recahisto.histoctacte WHERE CuenCtct = ?
                `, [account]);
                histoOffices.forEach(r => officesFound.add(r.CodiOfic.toString()));
            } catch (hErr) {
                console.log("Historical archive (recahisto) not available during account resolution.");
            }

            try {
                const boletoOffices = await conn.query(`
                    SELECT DISTINCT CodiOfic FROM ${DB_RECAUDACION}.boleto WHERE CuenCtct = ?
                `, [account]);
                boletoOffices.forEach(r => officesFound.add(r.CodiOfic.toString()));
            } catch (bErr) {
                console.log("Boleto table not available during account resolution.");
            }

            const pgQuery = `
                SELECT DISTINCT tt.tpotribcod as "officeId"
                FROM public.tributo t
                JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod
                WHERE t.tbecod = $1
            `;
            const pgRes = await require('../db/postgres').query(pgQuery, [account]);
            pgRes.rows.forEach(r => officesFound.add(r.officeId.toString()));
        }

        if (officesFound.size === 0) {
            return res.json([]);
        }

        const ids = Array.from(officesFound);
        let officeNames = [];

        try {
            if (!conn) conn = await mariaDB.getRemoteConnection();
            officeNames = await conn.query(`
                SELECT CodiOfic as id, DetaOfic as name 
                FROM ${DB_RECAUDACION}.oficina 
                WHERE CodiOfic IN (${ids.map(() => '?').join(',')})
            `, ids);
        } catch (mErr) {
            console.error('Error getting office names from MariaDB:', mErr.message);
            // Fallback: return IDs with generic names since MariaDB is down
            officeNames = ids.map(id => ({
                id: parseInt(id),
                name: `Oficina ${id} (Nombre no disponible)`
            }));
        }

        res.json(officeNames);
    } catch (err) {
        console.error('Error seeking account in databases:', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) try { conn.release(); } catch (e) { }
    }
});

// Search legacy (MariaDB) - FIXED TO USE fnDeuda Stored Procedure
router.get('/legacy/search', async (req, res) => {
    const { officeId, account, onlyDebt, toDate, type, fealCorte } = req.query;
    let conn;

    try {
        conn = await mariaDB.getRemoteConnection();
        await conn.query(`USE ${DB_NAME}`);

        // Normalize account to an array
        const accList = Array.isArray(account) ? account : (account ? [account.toString().trim()] : []);
        const dateStr = toDate || new Date().toISOString().split('T')[0];

        if (onlyDebt === 'true') {
            const allResults = [];
            for (const acc of accList) {
                // Single SELECT query to calculate everything without temp tables or stored procedures
                const debtQuery = `
                    SELECT 
                        t.PeriCtct, t.BimeCtct, MAX(t.CuotDefa) as CuotDefa, MAX(t.FeveCtct) as FeveCtct, 
                        MAX(IFNULL(c.DetaConc, t.DetaCtct)) as DetaCtct, 
                        SUM(IFNULL(t.DebeCtct, 0)) - SUM(IFNULL(t.CredCtct, 0)) as DebeCtct, 
                        IF(MAX(t.FeveCtct) < ?, 
                           (SUM(IFNULL(t.DebeCtct, 0)) - SUM(IFNULL(t.CredCtct, 0))) * CEIL(DATEDIFF(?, MAX(t.FeveCtct)) / 30) * 0.03, 
                           0) as RecaCtct,
                        0 as NumeAcpa,
                        MAX(t.FeenAcpa) as FechaPago,
                        MAX(t.NumeBole) as NumeBole,
                        MAX(t.NumeApre) as NumeApre,
                        MAX(t.CodiFapa) as CodiFapa,
                        (MAX(t.NumeApre) > 0) as hasApremio,
                        (MAX(t.CodiFapa) > 0) as hasPlan
                    FROM ${DB_NAME}.ctacte t
                    LEFT JOIN ${DB_RECAUDACION}.concepto c ON c.PeriInfo = t.PeriInfo AND c.CodiConc = t.CodiConc
                    WHERE t.CodiOfic = ? AND t.CuenCtct = ?
                    GROUP BY t.PeriCtct, t.BimeCtct
                    HAVING (SUM(IFNULL(t.DebeCtct, 0)) - SUM(IFNULL(t.CredCtct, 0))) > 0.01
                    ORDER BY t.PeriCtct DESC, t.BimeCtct ASC
                `;

                const results = await conn.query(debtQuery, [dateStr, dateStr, officeId, acc]);
                
                // Map results to add TotaCtct and ensure numeric types
                const formatted = results.map(r => ({
                    ...r,
                    DebeCtct: parseFloat(r.DebeCtct || 0),
                    RecaCtct: parseFloat(r.RecaCtct || 0),
                    CredCtct: 0,
                    TotaCtct: parseFloat(r.DebeCtct || 0) + parseFloat(r.RecaCtct || 0),
                    hasApremio: !!r.hasApremio,
                    hasPlan: !!r.hasPlan
                }));
                
                allResults.push(...formatted);
            }
            res.json(allResults);
        } else {
            // Unified Historical View using direct SELECT/UNION to avoid temp tables
            const accPlaceholders = accList.map(() => '?').join(',');
            const fealCorteFilter = fealCorte ? 'AND FealCtct <= ?' : '';
            const mainParams = [officeId, ...accList];
            if (fealCorte) mainParams.push(fealCorte);

            const histQuery = `
                SELECT 
                    tmp.PeriCtct, tmp.BimeCtct, tmp.CuotDefa, tmp.FeveCtct, 
                    IFNULL(c.DetaConc, tmp.DetaCtct) as DetaCtct, 
                    tmp.DebeCtct, tmp.CredCtct, 
                    0 as RecaCtct,
                    (tmp.DebeCtct - tmp.CredCtct) as TotaCtct,
                    tmp.NumeAcpa,
                    tmp.FechaPago,
                    tmp.NumeApre,
                    tmp.CodiFapa,
                    (tmp.NumeApre > 0) as hasApremio,
                    (tmp.CodiFapa > 0) as hasPlan
                FROM (
                    SELECT PeriCtct, BimeCtct, CuotDefa, FeveCtct, DetaCtct, DebeCtct, CredCtct, NumeApre, CodiFapa, PeriInfo, CodiConc, NumeAcpa, FeenAcpa as FechaPago
                    FROM ${DB_NAME}.ctacte
                    WHERE CodiOfic = ? AND CuenCtct IN (${accPlaceholders}) ${fealCorteFilter}
                    UNION ALL
                    SELECT PeriCtct, BimeCtct, CuotDefa, FeveCtct, DetaCtct, DebeCtct, CredCtct, NumeApre, CodiFapa, PeriInfo, CodiConc, NumeAcpa, FeenAcpa as FechaPago
                    FROM recahisto.histoctacte
                    WHERE CodiOfic = ? AND CuenCtct IN (${accPlaceholders}) ${fealCorteFilter}
                ) tmp
                LEFT JOIN ${DB_RECAUDACION}.concepto c ON c.PeriInfo = tmp.PeriInfo AND c.CodiConc = tmp.CodiConc
                ORDER BY tmp.PeriCtct DESC, tmp.BimeCtct ASC, tmp.FeveCtct ASC
                LIMIT 2000
            `;
            
            const results = await conn.query(histQuery, [...mainParams, ...mainParams]);
            res.json(results);
        }
    } catch (err) {
        console.error('Error in complex search (ctacte2):', err);
        res.status(500).json({ error: err.message });
    } finally {
        if (conn) conn.release();
    }
});

// Search new (PostgreSQL) - Same as ctacte.js
router.get('/new/search', async (req, res) => {
    // ... keep same as original ...
    const { officeId, account, accounts, searchType, percod, toDate, onlyDebt, showQuotaDetail } = req.query;
    try {
        let accountList = accounts ? (Array.isArray(accounts) ? accounts : [accounts]) : (account ? [account] : []);
        const placeholders = accountList.map((_, i) => `$${i + 1}`).join(',');
        
        let query = `
            SELECT 
                cc.ctactecod, gc.genctaancta as "PeriCtct", gc.genctanrocta as "BimeCtct", 
                gc.genctafchvto as "FeveCtct", gc.genctaimpcta as "DebeCtct",
                gc.genctacednro as "NumeApre", t.tbecod as "CuenCtct", tt.tpotribnom as "TipoTributo",
                cc.cabpgoctactecod as "NumeAcpa", pgo.cabpgoctactefchpgo as "FechaPago"
            FROM public.cuentacorriente cc
            INNER JOIN public.generacioncuota gc ON cc.genctacod = gc.genctacod
            INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
            INNER JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod
            LEFT JOIN public.cabecerapagoctacte pgo ON cc.cabpgoctactecod = pgo.cabpgoctactecod
            WHERE t.tbecod IN (${placeholders}) AND tt.tpotribcod = $${accountList.length + 1}
            ORDER BY gc.genctaancta DESC, gc.genctanrocta ASC
        `;
        const result = await postgresDB.query(query, [...accountList, officeId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
