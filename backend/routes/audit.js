const express = require('express');
const router = express.Router();
const maria = require('../db/maria');
const postgres = require('../db/postgres');

/**
 * GET /api/audit/missing-parity
 * Compares accounts with debt in both systems to find mismatches.
 */
router.get('/missing-parity', async (req, res) => {
    const { officeId } = req.query;
    
    if (!officeId) {
        return res.status(400).json({ error: 'officeId is required' });
    }

    try {
        console.log(`[AUDIT] Starting parity audit for Office ${officeId}`);

        // 1. Fetch MariaDB Accounts (Local + Remote)
        const mariaQuery = `
            SELECT DISTINCT CuenCtct 
            FROM ctacte 
            WHERE CodiOfic = ? 
            GROUP BY CuenCtct, PeriCtct, BimeCtct, PeriInfo, CodiConc
            HAVING SUM(DebeCtct - CredCtct) > 0.01
        `;

        const [mdLocal, mdRemote] = await Promise.all([
            maria.query(mariaQuery, [officeId]).catch(() => []),
            maria.queryRemote(mariaQuery, [officeId]).catch(() => [])
        ]);

        const mariaAccounts = new Set([
            ...mdLocal.map(r => r.CuenCtct.toString().trim()),
            ...mdRemote.map(r => r.CuenCtct.toString().trim())
        ]);

        // 2. Fetch Postgres Accounts
        const pgQuery = `
            SELECT DISTINCT t.tbecod::text as account
            FROM public.cuentacorriente cc
            INNER JOIN public.generacioncuota gc ON cc.genctacod = gc.genctacod
            INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
            WHERE t.tpotribcod = $1
            AND (cc.cabpgoctactecod IS NULL OR cc.cabpgoctactecod = 0)
        `;
        const pgRes = await postgres.query(pgQuery, [officeId]);
        const pgAccounts = new Set(pgRes.rows.map(r => r.account.trim()));

        // 3. Compare Sets
        const missingInPostgres = [];
        for (const acc of mariaAccounts) {
            if (!pgAccounts.has(acc)) {
                missingInPostgres.push(acc);
            }
        }

        const missingInMaria = [];
        for (const acc of pgAccounts) {
            if (!mariaAccounts.has(acc)) {
                missingInMaria.push(acc);
            }
        }

        // 4. Enrich Missing in Postgres with Person Data if possible
        let enrichedMissingInPG = [];
        if (missingInPostgres.length > 0) {
            const sample = missingInPostgres.slice(0, 100);
            const personQuery = `
                SELECT nro_padron as account, denominacion as name
                FROM vpadrones_persona
                WHERE nro_padron IN (${sample.map(() => '?').join(',')})
                AND principal = 'SI'
            `;
            // Try remote first as it's more likely to have full ctacte
            const pData = await maria.queryRemote(personQuery, sample).catch(() => []);
            enrichedMissingInPG = sample.map(acc => {
                const p = pData.find(pd => pd.account.toString().trim() === acc);
                return { account: acc, name: p ? p.name : 'N/A' };
            });
        }

        // 5. Enrich Missing in Maria with Person Data from Postgres
        let enrichedMissingInMaria = [];
        if (missingInMaria.length > 0) {
            const sample = missingInMaria.slice(0, 100);
            const pgPersonQuery = `
                SELECT DISTINCT t.tbecod::text as account, p.pernom as name
                FROM public.tributo t
                JOIN public.persona p ON t.percod = p.percod
                WHERE t.tbecod::text = ANY($1) AND t.tpotribcod = $2
            `;
            const pData = await postgres.query(pgPersonQuery, [sample, officeId]);
            enrichedMissingInMaria = sample.map(acc => {
                const p = pData.rows.find(pd => pd.account.trim() === acc);
                return { account: acc, name: p ? p.name : 'N/A' };
            });
        }

        res.json({
            summary: {
                totalMaria: mariaAccounts.size,
                totalPostgres: pgAccounts.size,
                missingInPostgresCount: missingInPostgres.length,
                missingInMariaCount: missingInMaria.length
            },
            missingInPostgres: enrichedMissingInPG,
            missingInMaria: enrichedMissingInMaria
        });

    } catch (err) {
        console.error('Error in parity audit:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
