const express = require('express');
const router = express.Router();
const snapshotWorker = require('../utils/snapshotWorker');
const userDb = require('../db/userDb');

// Trigger snapshot
router.post('/run', (req, res) => {
    const { officeId } = req.body;
    console.log('[AUDIT-SNAPSHOT] RECEIVED RUN REQUEST for office:', officeId);
    snapshotWorker.runSnapshot(officeId); // Runs in background
    res.json({ message: 'Snapshot process started' });
});

// Get progress/status
router.get('/status', (req, res) => {
    res.json(snapshotWorker.getStatus());
});

// Comparison Report based on snapshots
router.get('/report', async (req, res) => {
    const { officeId } = req.query;
    
    if (!officeId) return res.status(400).json({ error: 'officeId is required' });

    try {
        // This query finds:
        // 1. Accounts in MariaDB not in Postgres
        // 2. Accounts in Postgres not in MariaDB
        // 3. Accounts in both with difference in total > 1
        
        const diffQuery = `
            SELECT 
                COALESCE(m.cuenta, p.cuenta) as cuenta,
                COALESCE(m.percod, p.percod) as percod,
                COALESCE(m.nombre, p.nombre) as nombre,
                m.total as maria_total,
                p.total as pg_total,
                ABS(IFNULL(m.total, 0) - IFNULL(p.total, 0)) as diff,
                CASE 
                    WHEN p.cuenta IS NULL THEN 'Missing in Postgres'
                    WHEN m.cuenta IS NULL THEN 'Missing in MariaDB'
                    ELSE 'Balance Mismatch'
                END as type
            FROM (SELECT * FROM listado_historico_mariadb WHERE office_id = ?) m
            LEFT JOIN (SELECT * FROM listado_historico_postgres WHERE office_id = ?) p ON m.cuenta = p.cuenta
            
            UNION
            
            SELECT 
                COALESCE(m.cuenta, p.cuenta) as cuenta,
                COALESCE(m.percod, p.percod) as percod,
                COALESCE(m.nombre, p.nombre) as nombre,
                m.total as maria_total,
                p.total as pg_total,
                ABS(IFNULL(m.total, 0) - IFNULL(p.total, 0)) as diff,
                CASE 
                    WHEN p.cuenta IS NULL THEN 'Missing in Postgres'
                    WHEN m.cuenta IS NULL THEN 'Missing in MariaDB'
                    ELSE 'Balance Mismatch'
                END as type
            FROM (SELECT * FROM listado_historico_mariadb WHERE office_id = ?) m
            RIGHT JOIN (SELECT * FROM listado_historico_postgres WHERE office_id = ?) p ON m.cuenta = p.cuenta
            WHERE m.cuenta IS NULL
            
            HAVING diff > 1.0
            ORDER BY diff DESC
            LIMIT 500
        `;

        const results = await userDb.query(diffQuery, [officeId, officeId, officeId, officeId]);
        res.json(results);

    } catch (err) {
        console.error('Error fetching snapshot report:', err);
        res.status(500).json({ error: err.message });
    }
});

// View full snapshot (MariaDB)
router.get('/list-maria', async (req, res) => {
    const { officeId } = req.query;
    try {
        const results = await userDb.query('SELECT * FROM listado_historico_mariadb WHERE office_id = ? LIMIT 2000', [officeId]);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// View combined list (UNION ALL) for side-by-side comparison
router.get('/list-combined', async (req, res) => {
    const { officeId, onlyDiff } = req.query;
    try {
        let query;
        let params = [officeId, officeId, officeId, officeId];

        if (onlyDiff === 'true') {
            query = `
                WITH diff_accounts AS (
                    SELECT cuenta FROM (
                        SELECT cuenta, total, percod FROM listado_historico_mariadb WHERE office_id = ?
                        UNION ALL
                        SELECT cuenta, total, percod FROM listado_historico_postgres WHERE office_id = ?
                    ) t
                    GROUP BY cuenta
                    HAVING COUNT(*) < 2 
                       OR ABS(MAX(total) - MIN(total)) > 0.05
                       OR COUNT(DISTINCT percod) > 1
                )
                SELECT sistema, cuenta, percod, nombre, capital, interes, total, fecha_actualizacion
                FROM (
                    SELECT 'M' as sistema, cuenta, percod, nombre, capital, interes, total, fecha_actualizacion, office_id 
                    FROM listado_historico_mariadb
                    UNION ALL
                    SELECT 'P' as sistema, cuenta, percod, nombre, capital, interes, total, fecha_actualizacion, office_id
                    FROM listado_historico_postgres
                ) all_data
                WHERE office_id = ? AND cuenta IN (SELECT cuenta FROM diff_accounts)
                ORDER BY cuenta, sistema
                LIMIT 4000
            `;
            // For the CTE and the main query
            params = [officeId, officeId, officeId];
        } else {
            query = `
                SELECT 'M' as sistema, cuenta, percod, nombre, capital, interes, total, fecha_actualizacion
                FROM listado_historico_mariadb
                WHERE office_id = ?
                UNION ALL
                SELECT 'P' as sistema, cuenta, percod, nombre, capital, interes, total, fecha_actualizacion
                FROM listado_historico_postgres
                WHERE office_id = ?
                ORDER BY cuenta, sistema
                LIMIT 4000
            `;
            params = [officeId, officeId];
        }

        const results = await userDb.query(query, params);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
