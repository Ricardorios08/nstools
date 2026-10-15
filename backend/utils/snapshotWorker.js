const userDb = require('../db/userDb');
const maria = require('../db/maria');
const postgres = require('../db/postgres');
const { calculateLegacyInterest } = require('./interestUtils');

let snapshotState = {
    status: 'idle', // idle, running, completed, error
    progress: 0,
    currentOffice: null,
    lastStarted: null,
    lastFinished: null,
    error: null,
    results: {
        mariaCount: 0,
        pgCount: 0
    }
};

const runSnapshot = async (forceOfficeId = null) => {
    if (snapshotState.status === 'running') return;

    snapshotState.status = 'running';
    snapshotState.progress = 0;
    snapshotState.lastStarted = new Date();
    snapshotState.error = null;
    console.log('[SNAPSHOT] STARTING PROCESS - VERSION WITH NO-CREATE');

    try {
        /* 
        // 1. Ensure tables exist in 'user' database
        await userDb.query(`
            CREATE TABLE IF NOT EXISTS listado_historico_mariadb (
                id INT AUTO_INCREMENT PRIMARY KEY,
                office_id INT,
                cuenta VARCHAR(50),
                percod VARCHAR(50),
                nombre VARCHAR(255),
                capital DECIMAL(20,2),
                interes DECIMAL(20,2),
                total DECIMAL(20,2),
                fecha_actualizacion DATETIME,
                INDEX idx_office_cuenta (office_id, cuenta)
            )
        `);

        await userDb.query(`
            CREATE TABLE IF NOT EXISTS listado_historico_postgres (
                id INT AUTO_INCREMENT PRIMARY KEY,
                office_id INT,
                cuenta VARCHAR(50),
                percod VARCHAR(50),
                nombre VARCHAR(255),
                capital DECIMAL(20,2),
                interes DECIMAL(20,2),
                total DECIMAL(20,2),
                fecha_actualizacion DATETIME,
                INDEX idx_office_cuenta (office_id, cuenta)
            )
        `);

        // Ensure columns exist if table was created previously (more compatible than IF NOT EXISTS)
        const checkAndAddColumns = async (tableName) => {
            const columns = await userDb.query(`
                SELECT COLUMN_NAME FROM information_schema.columns 
                WHERE table_name = ? AND table_schema = 'user'
            `, [tableName]);
            const colNames = columns.map(c => c.COLUMN_NAME.toLowerCase());
            
            if (!colNames.includes('percod')) {
                await userDb.query(`ALTER TABLE ${tableName} ADD COLUMN percod VARCHAR(50)`);
            }
            if (!colNames.includes('nombre')) {
                await userDb.query(`ALTER TABLE ${tableName} ADD COLUMN nombre VARCHAR(255)`);
            }
        };

        try {
            await checkAndAddColumns('listado_historico_mariadb');
            await checkAndAddColumns('listado_historico_postgres');
        } catch (e) {
            console.log('[SNAPSHOT] Note: Column check/add failed', e.message);
        }
        */

        // 2. Get offices to process
        let offices = await maria.queryRemote('SELECT CodiOfic as id, DetaOfic as name FROM oficina');
        
        if (forceOfficeId) {
            offices = offices.filter(o => o.id === parseInt(forceOfficeId));
        }

        const totalOffices = offices.length;
        let processed = 0;

        for (const office of offices) {
            snapshotState.currentOffice = office.name;
            snapshotState.progress = Math.round((processed / totalOffices) * 100);

            console.log(`[SNAPSHOT] Processing Office ${office.id}: ${office.name}`);

            // Truncate previous data for this office
            await userDb.query('DELETE FROM listado_historico_mariadb WHERE office_id = ?', [office.id]);
            await userDb.query('DELETE FROM listado_historico_postgres WHERE office_id = ?', [office.id]);

            // --- MARIA DB AGGREGATION ---
            // 1. Fetch main debt (ctacte)
            const mariaData = await maria.queryRemote(`
                SELECT t.CuenCtct as cuenta, 
                       t.FeveCtct as dueDate,
                       SUM(t.DebeCtct - t.CredCtct) as capital,
                       MAX(p.nro_doc) as percod,
                       MAX(p.denominacion) as nombre
                FROM ctacte t
                LEFT JOIN vpadrones_persona p ON t.CuenCtct = p.nro_padron AND p.principal = 'SI'
                WHERE t.CodiOfic = ? 
                GROUP BY t.CuenCtct, t.FeveCtct
                HAVING SUM(t.DebeCtct - t.CredCtct) > 0.01
            `, [office.id]);

            // 2. Fetch plan debt (facipago/detafapa)
            const mariaPlans = await maria.queryRemote(`
                SELECT f.CuenCtct as cuenta, 
                       d.FeveDefa as dueDate,
                       SUM(d.TotaDefa) as capital,
                       MAX(p.nro_doc) as percod,
                       MAX(p.denominacion) as nombre
                FROM facipago f
                INNER JOIN detafapa d ON d.CodiFapa = f.CodiFapa
                LEFT JOIN vpadrones_persona p ON f.CuenCtct = p.nro_padron AND p.principal = 'SI'
                WHERE f.CodiOfic = ? AND f.EstaFapa = 'Activa' AND d.FepaDefa IS NULL
                GROUP BY f.CuenCtct, d.FeveDefa
                HAVING SUM(d.TotaDefa) > 0.01
            `, [office.id]);

            const today = new Date().toISOString().split('T')[0];
            const mariaAggregated = {};
            
            // Helper to add results
            const addResult = (rows) => {
                rows.forEach(r => {
                    const acc = r.cuenta.trim();
                    const cap = parseFloat(r.capital);
                    const int = calculateLegacyInterest(r.dueDate, today, cap);
                    
                    if (!mariaAggregated[acc]) {
                        mariaAggregated[acc] = { cap: 0, int: 0, percod: r.percod, nombre: r.nombre };
                    }
                    mariaAggregated[acc].cap += cap;
                    mariaAggregated[acc].int += int;
                    // If we found a name but current one is N/A, update
                    if (r.nombre && (!mariaAggregated[acc].nombre || mariaAggregated[acc].nombre === 'N/A')) {
                        mariaAggregated[acc].nombre = r.nombre;
                        mariaAggregated[acc].percod = r.percod;
                    }
                });
            };

            addResult(mariaData);
            addResult(mariaPlans);

            // Bulk Insert MariaDB
            if (Object.keys(mariaAggregated).length > 0) {
                const values = Object.entries(mariaAggregated).map(([acc, vals]) => [
                    office.id, acc, vals.percod || 'N/A', vals.nombre || 'N/A', vals.cap, vals.int, vals.cap + vals.int, snapshotState.lastStarted
                ]);
                
                for (let i = 0; i < values.length; i += 5000) {
                    const chunk = values.slice(i, i + 5000);
                    await userDb.batch('INSERT INTO listado_historico_mariadb (office_id, cuenta, percod, nombre, capital, interes, total, fecha_actualizacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', chunk);
                }
            }

            // --- POSTGRES AGGREGATION ---
            const pgRes = await postgres.query(`
                SELECT t.tbecod::text as cuenta, 
                       p.percod::text as percod,
                       p.pernom as nombre,
                       gc.genctafchvto as "dueDate",
                       SUM(gc.genctaimpcta) as capital
                FROM public.cuentacorriente cc
                INNER JOIN public.generacioncuota gc ON cc.genctacod = gc.genctacod
                INNER JOIN public.tributo t ON gc.genctatribcod = t.tribcod
                INNER JOIN public.persona p ON gc.genctapercod = p.percod
                WHERE t.tpotribcod = $1
                AND (cc.cabpgoctactecod IS NULL OR cc.cabpgoctactecod = 0)
                GROUP BY t.tbecod, p.percod, p.pernom, gc.genctafchvto
            `, [office.id]);

            const pgAggregated = {};
            pgRes.rows.forEach(r => {
                const acc = r.cuenta.trim();
                const cap = parseFloat(r.capital);
                const int = calculateLegacyInterest(r.dueDate, today, cap);
                
                if (!pgAggregated[acc]) {
                    pgAggregated[acc] = { cap: 0, int: 0, percod: r.percod, nombre: r.nombre };
                }
                pgAggregated[acc].cap += cap;
                pgAggregated[acc].int += int;
            });

            // Bulk Insert Postgres
            if (Object.keys(pgAggregated).length > 0) {
                const pgValues = Object.entries(pgAggregated).map(([acc, vals]) => [
                    office.id, acc, vals.percod, vals.nombre.trim(), vals.cap, vals.int, vals.cap + vals.int, snapshotState.lastStarted
                ]);

                for (let i = 0; i < pgValues.length; i += 5000) {
                    const chunk = pgValues.slice(i, i + 5000);
                    await userDb.batch('INSERT INTO listado_historico_postgres (office_id, cuenta, percod, nombre, capital, interes, total, fecha_actualizacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', chunk);
                }
            }

            processed++;
        }

        snapshotState.progress = 100;
        snapshotState.status = 'completed';
        snapshotState.lastFinished = new Date();
        console.log(`[SNAPSHOT] Completed successfully.`);

    } catch (err) {
        console.error('[SNAPSHOT] Error:', err);
        snapshotState.status = 'error';
        snapshotState.error = err.message;
    }
};

module.exports = {
    getStatus: () => snapshotState,
    runSnapshot
};
