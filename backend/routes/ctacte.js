const express = require('express');
const router = express.Router();
const mariaDB = require('../db/maria');
const { logAction } = require('../utils/logger');
const jwt = require('jsonwebtoken');

const DB_NAME = 'recaudacion2';
const DB_RECAUDACION = 'recaudacion2'; 
const postgresDB = require('../db/postgres');
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Middleware estricto para este router
const ensureAuth = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Sesión expirada' });
        req.user = user;
        next();
    });
};

router.use(ensureAuth);

// Get list of offices
router.get('/offices', async (req, res) => {
    try {
        const offices = await mariaDB.queryRemote(`SELECT CodiOfic, DetaOfic FROM ${DB_RECAUDACION}.oficina ORDER BY CodiOfic`);
        const result = [...offices, { CodiOfic: 99, DetaOfic: 'CUIL/CUIT' }];
        res.json(result);
    } catch (err) {
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

        const isNumeric = /^\d+$/.test(searchTerm);
        const isCuit = /^\d{2}-?\d{7,8}-?\d{1}$/.test(searchTerm);

        if (isCuit) {
            const clean = searchTerm.replace(/-/g, '');
            const tipo = parseInt(clean.substring(0, 2));
            const nro = parseInt(clean.substring(2, clean.length - 1));
            const dig = parseInt(clean.substring(clean.length - 1));
            query = `SELECT p.percod, TRIM(p.pernom) as pernom, p.percuiltipo, p.percuilnro, p.percuildigver, CONCAT(p.percuiltipo, '-', p.percuilnro, '-', p.percuildigver) as cuit FROM public.persona p WHERE p.percuiltipo = $1 AND p.percuilnro = $2 AND p.percuildigver = $3 LIMIT 20`;
            params = [tipo, nro, dig];
        } else if (isNumeric) {
            query = `SELECT p.percod, TRIM(p.pernom) as pernom, p.percuiltipo, p.percuilnro, p.percuildigver, CONCAT(p.percuiltipo, '-', p.percuilnro, '-', p.percuildigver) as cuit FROM public.persona p WHERE p.percod = $1 OR p.percuilnro = $1 ORDER BY p.percod LIMIT 20`;
            params = [parseInt(searchTerm)];
        } else {
            query = `SELECT p.percod, TRIM(p.pernom) as pernom, p.percuiltipo, p.percuilnro, p.percuildigver, CONCAT(p.percuiltipo, '-', p.percuilnro, '-', p.percuildigver) as cuit FROM public.persona p WHERE UPPER(p.pernom) LIKE UPPER($1) ORDER BY p.pernom LIMIT 20`;
            params = [`%${searchTerm}%`];
        }

        const result = await postgresDB.query(query, params);
        const enriched = await Promise.all(result.rows.map(async (person) => {
            const accRes = await postgresDB.query(`SELECT DISTINCT t.tbecod as account, tt.tpotribcod as "officeId", tt.tpotribnom as "officeName" FROM public.tribper tp JOIN public.tributo t ON tp.tribcod = t.tribcod JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod WHERE tp.percod = $1 ORDER BY tt.tpotribcod LIMIT 20`, [person.percod]);
            return { ...person, cuit: person.percuiltipo > 0 ? person.cuit : null, accounts: accRes.rows };
        }));

        logAction(req.user.nombre_usuario, 'SEARCH_PERSON', `Query: ${q}`, req);
        res.json(enriched);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Resolve account
router.get('/resolve-account/:account', async (req, res) => {
    const { account } = req.params;
    const { searchType } = req.query;
    try {
        const officesFound = new Set();
        if (searchType === 'person') {
            const pgRes = await postgresDB.query(`SELECT DISTINCT t.tpotribcod as "officeId" FROM public.generacioncuota gc JOIN public.tributo t ON gc.genctatribcod = t.tribcod WHERE gc.genctapercod = $1 UNION SELECT DISTINCT t.tpotribcod as "officeId" FROM public.tribper tp JOIN public.tributo t ON tp.tribcod = t.tribcod WHERE tp.percod = $1`, [account]);
            pgRes.rows.forEach(r => officesFound.add(r.officeId.toString()));
        } else {
            const variants = [];
            for (let i = 0; i <= 11; i++) variants.push(account.padStart(i, ' '));
            const uniqueVariants = [...new Set(variants)];
            const inPlaceholders = uniqueVariants.map(() => '?').join(',');
            const officesToTest = Array.from({length: 30}, (_, i) => i + 1);

            let remoteConn;
            try {
                remoteConn = await mariaDB.getRemoteConnection();
                for (const off of officesToTest) {
                    const res = await remoteConn.query(`SELECT DISTINCT CodiOfic FROM ${DB_NAME}.ctacte WHERE CodiOfic = ? AND CuenCtct IN (${inPlaceholders}) LIMIT 1`, [off, ...uniqueVariants]);
                    if (res.length > 0) officesFound.add(res[0].CodiOfic.toString());
                }
            } finally { if (remoteConn) remoteConn.release(); }

            const pgRes = await postgresDB.query(`SELECT DISTINCT tt.tpotribcod as "officeId" FROM public.tributo t JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod WHERE t.tbecod = ANY($1)`, [uniqueVariants]);
            pgRes.rows.forEach(r => officesFound.add(r.officeId.toString()));
        }

        const ids = Array.from(officesFound);
        let officeNames = [];
        try {
            officeNames = await mariaDB.queryRemote(`SELECT CodiOfic as id, DetaOfic as name FROM ${DB_RECAUDACION}.oficina WHERE CodiOfic IN (${ids.map(() => '?').join(',')})`, ids);
        } catch (e) {
            officeNames = ids.map(id => ({ id: parseInt(id), name: `Oficina ${id}` }));
        }

        logAction(req.user.nombre_usuario, 'RESOLVE_ACCOUNT', `Account: ${account} (${officesFound.size} found)`, req);
        res.json(officeNames);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Legacy Search
router.get('/legacy/search', async (req, res) => {
    const { officeId, account, onlyDebt, toDate, type, fealCorte } = req.query;
    let conn;
    try {
        conn = await mariaDB.getRemoteConnection();
        const accList = Array.isArray(account) ? account : (account ? [account.toString().trim()] : []);
        const dateStr = toDate || new Date().toISOString().split('T')[0];

        // Dynamic Legacy Account Mapper (Smart Resolver for Office 3 & 5)
        const mappedAccList = [];
        const originalToMappedMap = {}; // Maps mapped account -> search key

        for (const acc of accList) {
            let mappedAcc = acc;
            
            // If the query is for Deudores Varios (Office 3) or Ingresos Varios (Office 5)
            if ((officeId == '3' || officeId == '5') && /^\d+$/.test(acc)) {
                try {
                    // 1. Find if this is a valid Postgres percod
                    const pgRes = await postgresDB.query(
                        "SELECT percuiltipo, percuilnro, percuildigver FROM public.persona WHERE percod = $1",
                        [acc]
                    );
                    
                    if (pgRes.rows.length > 0) {
                        const { percuiltipo, percuilnro, percuildigver } = pgRes.rows[0];
                        const fullCuit = `${percuiltipo}${percuilnro}${percuildigver}`;
                        
                        // 2. Find corresponding legacy citizen CucuPers in infogov
                        const mariaPers = await conn.query(
                            "SELECT CucuPers FROM infogov.persona WHERE CucuPers = ? OR CuitPers = ?",
                            [fullCuit, fullCuit]
                        );
                        
                        if (mariaPers.length > 0) {
                            const cucuPers = mariaPers[0].CucuPers;
                            
                            // 3. Find CuenCtct in relacion for this office and citizen
                            const relRes = await conn.query(
                                "SELECT CuenCtct FROM relacion WHERE CodiOfic = ? AND CucuPers = ?",
                                [officeId, cucuPers]
                            );
                            
                            if (relRes.length > 0) {
                                mappedAcc = relRes[0].CuenCtct.toString().trim();
                                console.log(`[SMART RESOLVER] Resolved search account '${acc}' to legacy account '${mappedAcc}'`);
                            }
                        }
                    }
                } catch (err) {
                    console.error("[SMART RESOLVER ERROR]:", err);
                }
            }
            
            mappedAccList.push(mappedAcc);
            originalToMappedMap[mappedAcc] = acc;
        }

        if (onlyDebt === 'true') {
            const allResults = [];
            for (const acc of mappedAccList) {
                const results = await conn.query(`SELECT t.PeriCtct, t.BimeCtct, MAX(t.CuotDefa) as CuotDefa, MAX(t.FeveCtct) as FeveCtct, MAX(IFNULL(c.DetaConc, t.DetaCtct)) as DetaCtct, SUM(IFNULL(t.DebeCtct, 0)) - SUM(IFNULL(t.CredCtct, 0)) as DebeCtct, IF(MAX(t.FeveCtct) < ?, (SUM(IFNULL(t.DebeCtct, 0)) - SUM(IFNULL(t.CredCtct, 0))) * CEIL(DATEDIFF(?, MAX(t.FeveCtct)) / 30) * 0.03, 0) as RecaCtct, MAX(t.NumeAcpa) as NumeAcpa, MAX(t.FeenAcpa) as FechaPago, MAX(t.NumeBole) as NumeBole, MAX(t.NumeApre) as NumeApre, MAX(t.CodiFapa) as CodiFapa, (MAX(t.NumeApre) > 0) as hasApremio, (MAX(t.CodiFapa) > 0) as hasPlan FROM ${DB_NAME}.ctacte t LEFT JOIN ${DB_RECAUDACION}.concepto c ON c.PeriInfo = t.PeriInfo AND c.CodiConc = t.CodiConc WHERE t.CodiOfic = ? AND t.CuenCtct = ? GROUP BY t.PeriCtct, t.BimeCtct HAVING (SUM(IFNULL(t.DebeCtct, 0)) - SUM(IFNULL(t.CredCtct, 0))) > 0.01 ORDER BY t.PeriCtct DESC, t.BimeCtct ASC`, [dateStr, dateStr, officeId, acc]);
                
                // Keep the search key in the response for alignment
                const searchAcc = originalToMappedMap[acc] || acc;
                allResults.push(...results.map(r => ({ ...r, DebeCtct: parseFloat(r.DebeCtct), RecaCtct: parseFloat(r.RecaCtct), TotaCtct: parseFloat(r.DebeCtct) + parseFloat(r.RecaCtct), CuenCtct: searchAcc })));
            }
            logAction(req.user.nombre_usuario, 'SEARCH_LEGACY', `Account: ${account} | Debt Only`, req);
            res.json(allResults);
        } else {
            const accPlaceholders = mappedAccList.map(() => '?').join(',');
            const fealCorteFilter = fealCorte ? 'AND FealCtct <= ?' : '';
            const mainParams = [officeId, ...mappedAccList];
            if (fealCorte) mainParams.push(fealCorte);

            const results = await conn.query(`SELECT tmp.CuenCtct, tmp.PeriCtct, tmp.BimeCtct, tmp.CuotDefa, tmp.FeveCtct, IFNULL(c.DetaConc, tmp.DetaCtct) as DetaCtct, tmp.DebeCtct, tmp.CredCtct, 0 as RecaCtct, (tmp.DebeCtct - tmp.CredCtct) as TotaCtct, tmp.NumeAcpa, tmp.FechaPago, tmp.NumeApre, tmp.CodiFapa, (tmp.NumeApre > 0) as hasApremio, (tmp.CodiFapa > 0) as hasPlan FROM (SELECT CuenCtct, PeriCtct, BimeCtct, CuotDefa, FeveCtct, DetaCtct, DebeCtct, CredCtct, NumeApre, CodiFapa, PeriInfo, CodiConc, NumeAcpa, FeenAcpa as FechaPago FROM ${DB_NAME}.ctacte WHERE CodiOfic = ? AND CuenCtct IN (${accPlaceholders}) ${fealCorteFilter} UNION ALL SELECT CuenCtct, PeriCtct, BimeCtct, CuotDefa, FeveCtct, DetaCtct, DebeCtct, CredCtct, NumeApre, CodiFapa, PeriInfo, CodiConc, NumeAcpa, FeenAcpa as FechaPago FROM recahisto.histoctacte WHERE CodiOfic = ? AND CuenCtct IN (${accPlaceholders}) ${fealCorteFilter}) tmp LEFT JOIN ${DB_RECAUDACION}.concepto c ON c.PeriInfo = tmp.PeriInfo AND c.CodiConc = tmp.CodiConc ORDER BY tmp.PeriCtct DESC, tmp.BimeCtct ASC, tmp.FeveCtct ASC LIMIT 2000`, [...mainParams, ...mainParams]);
            
            // Keep the search key in the response for alignment
            res.json(results.map(r => {
                const searchAcc = originalToMappedMap[r.CuenCtct.toString().trim()] || r.CuenCtct;
                return { 
                    ...r, 
                    DebeCtct: parseFloat(r.DebeCtct), 
                    CredCtct: parseFloat(r.CredCtct), 
                    TotaCtct: parseFloat(r.DebeCtct) - parseFloat(r.CredCtct),
                    CuenCtct: searchAcc
                };
            }));
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    } finally { if (conn) conn.release(); }
});

// Postgres Search
router.get('/new/search', async (req, res) => {
    const { officeId, account, searchType, percod, toDate, onlyDebt, showQuotaDetail } = req.query;
    try {
        let accountList = account ? [account] : [];
        if (searchType === 'person' && percod) {
            const resolutionRes = await postgresDB.query(`SELECT DISTINCT t.tbecod FROM public.generacioncuota gc JOIN public.tributo t ON gc.genctatribcod = t.tribcod WHERE gc.genctapercod = $1`, [percod]);
            accountList = resolutionRes.rows.map(r => r.tbecod);
        }
        if (accountList.length === 0) return res.json([]);

        const placeholders = accountList.map((_, i) => `$${i + 1}`).join(',');
        const query = `SELECT cc.ctactecod, gc.genctaancta as "PeriCtct", gc.genctanrocta as "BimeCtct", gc.genctafchvto as "FeveCtct", gc.genctaimpcta as "DebeCtct", gc.genctacednro as "NumeApre", cc.cabpgoctactecod as "NumeAcpa", t.tbecod as "CuenCtct", tt.tpotribnom as "TipoTributo", p.pernom as "OwnerName" FROM public.cuentacorriente cc INNER JOIN public.generacioncuota gc ON cc.genctacod = gc.genctacod INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod INNER JOIN public.tipotributo tt ON t.tpotribcod = tt.tpotribcod LEFT JOIN public.persona p ON gc.genctapercod = p.percod WHERE t.tbecod IN (${placeholders}) AND tt.tpotribcod = $${accountList.length + 1} ORDER BY gc.genctaancta DESC, gc.genctanrocta ASC LIMIT 2000`;
        const result = await postgresDB.query(query, [...accountList, officeId]);
        
        logAction(req.user.nombre_usuario, 'SEARCH_POSTGRES', `Account: ${account} | Office: ${officeId}`, req);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
