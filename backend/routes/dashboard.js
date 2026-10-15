const express = require('express');
const router = express.Router();
const maria = require('../db/maria');
const postgres = require('../db/postgres');

const DB_NAME = 'recaudacion2'; // Solo para ctacte
const DB_RECAUDACION = 'recaudacion2'; // Para el resto (oficina, recaudador, apremio, etc.)

// In-memory cache for background audit
let auditState = {
    status: 'idle', // idle, calculating, ready
    lastUpdated: null,
    startTime: null,
    summary: [],
    debt: [],
    recaudadores: [],
    gc: [],
    error: null
};

// Start a background calculation
const startBackgroundAudit = async () => {
    if (auditState.status === 'calculating') return;

    auditState.status = 'calculating';
    auditState.startTime = new Date();
    auditState.error = null;

    try {
        console.log('[DASHBOARD] Starting multi-database audit at:', auditState.startTime);
        
        // 1. Summary (Fast)
        const offices = await maria.query(`SELECT CodiOfic as id, DetaOfic as name FROM ${DB_RECAUDACION}.oficina`);
        
        const fetchMdCounts = async (queryFn) => {
            return queryFn(`
                SELECT CodiOfic as id, COUNT(DISTINCT CuenCtct) as count 
                FROM ${DB_NAME}.ctacte 
                GROUP BY CodiOfic
            `);
        };

        console.log('[DASHBOARD] Fetching MD counts...');
        console.log('[DASHBOARD] Fetching MD counts...');
        const [pgCounts, mdCounts] = await Promise.all([
            postgres.query(`
                SELECT tpotribcod as id, COUNT(*) as count 
                FROM tributo 
                GROUP BY tpotribcod
            `),
            maria.query(`
                SELECT CodiOfic as id, COUNT(DISTINCT CuenCtct) as count 
                FROM ${DB_NAME}.ctacte 
                GROUP BY CodiOfic
            `).catch(e => { console.error('MD Counts Error:', e); return []; })
        ]);

        console.log('[DASHBOARD] MD Counts:', mdCounts.length);

        auditState.summary = offices.map(off => {
            const pgC = pgCounts.rows.find(c => parseInt(c.id) === off.id) || { count: 0 };
            const mdC = mdCounts.find(c => c.id === off.id) || { count: 0 };

            return { 
                id: off.id, 
                name: off.name, 
                accountsMigrated: parseInt(pgC.count),
                accountsMaria: parseInt(mdC.count)
            };
        });

        // 2. Recaudadores (Medium) - Local + Remote
        const fetchReca = async (queryFn) => {
            return queryFn(`
                SELECT r.CodiReca, r.DetaReca, 
                       COUNT(a.NumeApre) as CantApremios,
                       SUM(a.TotaApre) as TotalApre
                FROM ${DB_RECAUDACION}.recaudador r
                LEFT JOIN ${DB_RECAUDACION}.apremio a ON r.CodiReca = a.CodiReca
                WHERE a.CancApre = 0 OR a.NumeApre IS NULL
                GROUP BY r.CodiReca, r.DetaReca
            `);
        };

        const recaLocal = await fetchReca(maria.query).catch(() => []);
        auditState.recaudadores = recaLocal.map(r => ({ ...r, CantApremios: Number(r.CantApremios), TotalApre: parseFloat(r.TotalApre || 0) })).sort((a, b) => b.TotalApre - a.TotalApre);

        // 3. Grandes Contribuyentes (Top 20 Debtors)
        console.log('[DASHBOARD] Calculating Grandes Contribuyentes...');
        const pgGCRes = await postgres.query(`
            SELECT p.pernom, p.percuilnro, sum(g.genctaimpcta) as pgdebt 
            FROM generacioncuota g 
            JOIN persona p ON g.genctapercod = p.percod 
            GROUP BY p.pernom, p.percuilnro 
            ORDER BY pgdebt DESC 
            LIMIT 20
        `);

        // Look them up in MariaDB to compare (SEARCH IN BOTH Local and Remote)
        const gcResults = [];
        for (const pgPerson of pgGCRes.rows) {
            const cuit = pgPerson.percuilnro;
            if (cuit) {
                // Find in MariaDB by CUIT (Both Local and Remote)
                const mdPLocal = await maria.query(`SELECT nro_padron FROM ${DB_RECAUDACION}.vpadrones_persona WHERE CUIT = ?`, [cuit]).catch(() => []);

                let totalMdDebt = 0;
                
                // Fetch debt for all pads found in Local
                if (mdPLocal.length > 0) {
                    const pads = mdPLocal.map(p => p.nro_padron);
                    const res = await maria.query(`
                        SELECT SUM(DebeCtct - CredCtct) as total 
                        FROM ${DB_NAME}.ctacte 
                        WHERE TRIM(CuenCtct) IN (${pads.map(p => `'${p}'`).join(',')}) AND DebeCtct > CredCtct
                    `);
                    totalMdDebt += parseFloat(res[0]?.total || 0);
                }

                gcResults.push({
                    name: pgPerson.pernom,
                    cuit: cuit,
                    pgDebt: parseFloat(pgPerson.pgdebt),
                    mdDebt: totalMdDebt,
                    diff: Math.abs(parseFloat(pgPerson.pgdebt) - totalMdDebt)
                });
            }
        }
        auditState.gc = gcResults;

        // 4. Debt Comparison (Very Slow) - Local + Remote
        const fetchDebt = async (queryFn) => {
            const dateStr = new Date().toISOString().split('T')[0];
            return queryFn(`
                SELECT CodiOfic as id, 
                       SUM(DebeCtct - CredCtct) as capital, 
                       SUM(
                           CASE 
                               WHEN FeveCtct >= '2014-07-01' THEN
                                   (DebeCtct - CredCtct) * (
                                       LEAST(DATEDIFF(?, FeveCtct), DATEDIFF('2024-05-06', FeveCtct)) * (3.0 / 3000) +
                                       GREATEST(0, DATEDIFF(?, GREATEST(FeveCtct, '2024-05-06'))) * (8.0 / 3000)
                                   )
                               ELSE
                                   (DebeCtct - CredCtct) * (DATEDIFF(?, FeveCtct) / 30) * (1.5 / 100)
                           END
                       ) as interest 
                FROM ${DB_NAME}.ctacte 
                WHERE DebeCtct > CredCtct 
                GROUP BY CodiOfic
            `, [dateStr, dateStr, dateStr]);
        };

        const [mdDebtLocal, pgDebt] = await Promise.all([
            fetchDebt(maria.query).catch(e => { console.error('MD Debt Error:', e); return []; }),
            postgres.query(`
                SELECT t.tpotribcod as id, 
                       SUM(genctaimpcta) as capital, 
                       SUM(genctaintpcta) as interest
                FROM generacioncuota g
                JOIN tributo t ON g.genctatribcod = t.tribcod
                WHERE NOT EXISTS (
                    SELECT 1 FROM cuentacorriente cc 
                    WHERE cc.genctacod = g.genctacod 
                    AND cc.cabpgoctactecod != 0
                )
                GROUP BY t.tpotribcod
            `).catch(e => { console.error('PG Debt Error:', e); return { rows: [] }; })
        ]);

        console.log('[DASHBOARD] mdDebtLocal:', mdDebtLocal.length);

        auditState.debt = auditState.summary.map(item => {
            const l = (mdDebtLocal || []).find(d => d.id === item.id) || { capital: 0, interest: 0 };
            const pD = pgDebt.rows.find(d => parseInt(d.id) === item.id) || { capital: 0, interest: 0 };
            
            const mCap = parseFloat(l.capital || 0);
            const mInt = parseFloat(l.interest || 0);
            const pCap = parseFloat(pD.capital || 0);
            const pInt = parseFloat(pD.interest || 0);

            return {
                id: item.id,
                mariaCapital: mCap,
                mariaInterest: mInt,
                mariaPending: mCap + mInt,
                postgresCapital: pCap,
                postgresInterest: pInt,
                postgresTotal: pCap + pInt
            };
        });



        auditState.status = 'ready';
        auditState.lastUpdated = new Date();
        console.log('[DASHBOARD] Multi-database audit complete.');
    } catch (err) {
        console.error('[DASHBOARD] Error in background audit:', err);
        auditState.status = 'idle';
        auditState.error = err.message;
    }
};

// GET status and results
router.get('/status', (req, res) => {
    res.json(auditState);
});

// POST trigger calculation
router.post('/calculate', (req, res) => {
    const force = req.query.force === 'true';
    
    if (force) {
        auditState.status = 'idle'; // Reset to allow restart
    }

    if (auditState.status !== 'calculating') {
        startBackgroundAudit(); // Don't await
        res.json({ message: 'Calculation started in background' });
    } else {
        res.json({ message: 'Calculation already in progress' });
    }
});

module.exports = router;
