const express = require('express');
const router = express.Router();
const mariaDB = require('../db/maria');
const postgresDB = require('../db/postgres');
const { logAction } = require('../utils/logger');
const jwt = require('jsonwebtoken');

const SCHEMA = 'recaudacion2';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

// Middleware para asegurar que el usuario esté logueado en este router
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

// Aplicar a todas las rutas de este router
router.use(ensureAuth);

// 1. Lista de estados
router.get('/statuses', async (req, res) => {
    try {
        const results = await mariaDB.query(`SELECT * FROM ${SCHEMA}.estadoapremio ORDER BY DetaEsap ASC`);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Exportación
router.get('/export', async (req, res) => {
    const { q, status } = req.query;
    logAction(req.user.nombre_usuario, 'APREMIO_EXPORT', `Exportando búsqueda: Q="${q || ''}", Estado=${status}`, req);
    
    try {
        let whereClauses = [];
        let params = [];

        if (q) {
            const isNumeric = /^\d+$/.test(q);
            if (isNumeric) {
                whereClauses.push(`(a.NumeApre = ? OR a.CuenCtct = ?)`);
                params.push(q, q);
            } else {
                whereClauses.push(`a.TituApre LIKE ?`);
                params.push(`%${q}%`);
            }
        }

        if (status && status !== 'all') {
            whereClauses.push(`a.EstaApre = ?`);
            params.push(status);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT a.NumeApre as Numero, a.CuenCtct as Cuenta, a.TituApre as Titular, 
                   ea.DetaEsap as Estado, a.AutoApre as Autos, a.FealApre as Fecha_Alta,
                   a.TotaApre as Total, p.DetaReca as Recaudador, oj.DetaOfju as Oficial_Justicia,
                   o.DetaOfic as Oficina
            FROM ${SCHEMA}.apremio a
            LEFT JOIN ${SCHEMA}.recaudador p ON a.CodiReca = p.CodiReca
            LEFT JOIN ${SCHEMA}.oficjust oj ON a.CodiOfju = oj.CodiOfju
            LEFT JOIN ${SCHEMA}.oficina o ON a.CodiOfic = o.CodiOfic
            LEFT JOIN ${SCHEMA}.estadoapremio ea ON a.EstaApre = ea.CodiEsap
            ${whereSql}
            ORDER BY a.NumeApre DESC
        `;
        
        const results = await mariaDB.query(query, params);
        res.json(results);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Buscador
router.get('/search', async (req, res) => {
    const { q, page = 1, status } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;

    try {
        let whereClauses = [];
        let params = [];

        if (q) {
            const isNumeric = /^\d+$/.test(q);
            if (isNumeric) {
                whereClauses.push(`(a.NumeApre = ? OR a.CuenCtct = ?)`);
                params.push(q, q);
            } else {
                whereClauses.push(`a.TituApre LIKE ?`);
                params.push(`%${q}%`);
            }
        }

        if (status && status !== 'all') {
            whereClauses.push(`a.EstaApre = ?`);
            params.push(status);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        const query = `
            SELECT a.*, p.DetaReca as Recaudador, oj.DetaOfju as OficialJusticia,
                   o.DetaOfic as Oficina, ea.DetaEsap as EstadoDeta,
                   (SELECT GROUP_CONCAT(DISTINCT PeriCtct ORDER BY PeriCtct ASC SEPARATOR ', ') 
                    FROM ${SCHEMA}.ctacte 
                    WHERE CodiOfic = a.CodiOfic AND CuenCtct = a.CuenCtct AND NumeApre = a.NumeApre AND BimeCtct > 0) as PeriodosSummary
            FROM ${SCHEMA}.apremio a
            LEFT JOIN ${SCHEMA}.recaudador p ON a.CodiReca = p.CodiReca
            LEFT JOIN ${SCHEMA}.oficjust oj ON a.CodiOfju = oj.CodiOfju
            LEFT JOIN ${SCHEMA}.oficina o ON a.CodiOfic = o.CodiOfic
            LEFT JOIN ${SCHEMA}.estadoapremio ea ON a.EstaApre = ea.CodiEsap
            ${whereSql}
            ORDER BY a.NumeApre DESC
            LIMIT ? OFFSET ?
        `;
        
        const [results, countResults] = await Promise.all([
            mariaDB.query(query, [...params, limit, offset]),
            mariaDB.query(`SELECT COUNT(*) as total FROM ${SCHEMA}.apremio a ${whereSql}`, params)
        ]);

        if (page == 1) {
            logAction(req.user.nombre_usuario, 'APREMIO_SEARCH', `Búsqueda: Q="${q || ''}", Estado=${status}`, req);
        }

        res.json({
            data: results,
            total: countResults[0].total,
            page: parseInt(page),
            limit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Detalle
router.get('/detail/:numeApre', async (req, res) => {
    const { numeApre } = req.params;
    logAction(req.user.nombre_usuario, 'APREMIO_DETAIL', `Viendo detalle apremio #${numeApre}`, req);

    try {
        const apreResults = await mariaDB.query(`
            SELECT a.*, p.DetaReca as Recaudador, oj.DetaOfju as OficialJusticia,
                   o.DetaOfic as Oficina, ea.DetaEsap as EstadoDeta
            FROM ${SCHEMA}.apremio a
            LEFT JOIN ${SCHEMA}.recaudador p ON a.CodiReca = p.CodiReca
            LEFT JOIN ${SCHEMA}.oficjust oj ON a.CodiOfju = oj.CodiOfju
            LEFT JOIN ${SCHEMA}.oficina o ON a.CodiOfic = o.CodiOfic
            LEFT JOIN ${SCHEMA}.estadoapremio ea ON a.EstaApre = ea.CodiEsap
            WHERE a.NumeApre = ?
        `, [numeApre]);

        if (apreResults.length === 0) return res.status(404).json({ error: 'Apremio no encontrado' });
        
        const apremio = apreResults[0];

        // Buscar CodiFapa de forma optimizada
        let codiFapa = 0;
        const fromPago = await mariaDB.query(`SELECT CodiFapa FROM ${SCHEMA}.pagoapre WHERE NumeApre = ? AND CodiFapa > 0 LIMIT 1`, [numeApre]);
        
        if (fromPago.length > 0) {
            codiFapa = fromPago[0].CodiFapa;
        } else {
            // Buscamos en ctacte pero USANDO ÍNDICES (Oficina y Cuenta) para que sea instantáneo
            const fromCtacte = await mariaDB.query(`
                SELECT CodiFapa FROM ${SCHEMA}.ctacte 
                WHERE CodiOfic = ? AND CuenCtct = ? AND NumeApre = ? AND CodiFapa > 0 
                LIMIT 1
            `, [apremio.CodiOfic, apremio.CuenCtct, numeApre]);
            if (fromCtacte.length > 0) codiFapa = fromCtacte[0].CodiFapa;
        }

        let paymentPlan = null;
        if (codiFapa > 0) {
            const [header, installments] = await Promise.all([
                mariaDB.query(`SELECT * FROM ${SCHEMA}.facipago WHERE CodiFapa = ?`, [codiFapa]),
                mariaDB.query(`SELECT * FROM ${SCHEMA}.faciapre WHERE CodiFapa = ? AND NumeApre = ? ORDER BY CuotDefa ASC`, [codiFapa, numeApre])
            ]);
            paymentPlan = { header: header[0], installments };
        }

        const apredetaQuery = `
            SELECT 
                ad.PeriCtct, ad.BimeCtct,
                SUM(CASE WHEN c.MoviCtct = 1 THEN c.DebeCtct ELSE 0 END) as Capital,
                SUM(CASE WHEN c.MoviCtct > 1 THEN c.DebeCtct ELSE 0 END) as Recargo,
                SUM(c.DebeCtct) as Total,
                MAX(c.DetaCtct) as Concepto,
                MAX(c.CodiConc) as CodiConc
            FROM ${SCHEMA}.apredeta ad
            LEFT JOIN ${SCHEMA}.ctacte c ON 
                ad.CodiOfic = c.CodiOfic AND 
                TRIM(ad.CuenCtct) = TRIM(c.CuenCtct) AND 
                ad.PeriCtct = c.PeriCtct AND 
                ad.BimeCtct = c.BimeCtct AND 
                ad.NumeCtct = c.NumeCtct
            WHERE ad.NumeApre = ?
            GROUP BY ad.PeriCtct, ad.BimeCtct, ad.NumeCtct
            ORDER BY ad.PeriCtct DESC, ad.BimeCtct DESC
        `;

        const [instances, debt, payments, boletoInfo, claimedInstallments] = await Promise.all([
            mariaDB.query(`
                SELECT ip.*, ij.DetaInju
                FROM ${SCHEMA}.instapre ip
                LEFT JOIN ${SCHEMA}.instjudi ij ON ip.CodiInju = ij.CodiInju
                WHERE ip.NumeApre = ?
                ORDER BY ip.FechInap DESC, ip.CodiInju DESC
            `, [numeApre]),
            mariaDB.query(`
                SELECT * FROM ${SCHEMA}.ctacte 
                WHERE CodiOfic = ? AND CuenCtct = ? AND NumeApre = ?
                ORDER BY PeriCtct DESC, BimeCtct DESC
            `, [apremio.CodiOfic, apremio.CuenCtct, numeApre]),
            mariaDB.query(`
                SELECT * FROM ${SCHEMA}.pagoapre
                WHERE NumeApre = ?
                ORDER BY FeacPaap DESC, NumePaag ASC
            `, [numeApre]),
            mariaDB.query(`
                SELECT b.*, p.FeenAcpa as FechaPago, p.CodiUsua as UsuarioPago, p.NumeAcpa as ActaPago
                FROM ${SCHEMA}.boleto b
                LEFT JOIN ${SCHEMA}.pago p ON b.PeriBole = p.PeriBole AND b.NumeBole = p.NumeBole
                WHERE b.PeriBole = ? AND b.NumeBole = ?
                LIMIT 1
            `, [apremio.PeriBole, apremio.NumeBole]),
            mariaDB.query(apredetaQuery, [numeApre])
        ]);

        res.json({ 
            apremio, 
            instances, 
            debt, 
            payments, 
            boleto: boletoInfo[0] || null,
            paymentPlan,
            claimedInstallments,
            debug: {
                apredetaSql: apredetaQuery,
                params: [numeApre]
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/apremio-individual/postgres-detail/:numeApre
router.get('/postgres-detail/:numeApre', async (req, res) => {
    const { numeApre } = req.params;
    logAction(req.user.nombre_usuario, 'APREMIO_POSTGRES_DETAIL', `Consultando detalle de cédula de Rentas (Postgres) para: ${numeApre}`, req);

    try {
        // 1. Consultar public.cedula y MariaDB apremio en paralelo usando numeApre
        const [cedulaRes, legacyApremioRes] = await Promise.all([
            postgresDB.query(`
                SELECT c.*, TRIM(p.pernom) as pernom 
                FROM public.cedula c 
                LEFT JOIN public.persona p ON c.cedpercod = p.percod 
                WHERE c.cedid = $1 OR CAST(c.cednro AS TEXT) = $1
            `, [numeApre]),
            mariaDB.query(`
                SELECT * FROM ${SCHEMA}.apremio WHERE NumeApre = ?
            `, [numeApre])
        ]);

        if (cedulaRes.rows.length === 0) {
            return res.status(404).json({ error: 'Cédula no encontrada en PostgreSQL para este Apremio.' });
        }

        const cedula = cedulaRes.rows[0];
        const legacyApremio = legacyApremioRes[0] || null;
        const { cednro, cedtpo, cedmotfin, cedseccod } = cedula;

        // Consultas en paralelo de las tablas vinculadas
        const [instancesRes, tipCedulaRes, cedMotFinRes, sectorRes, cuotasRes] = await Promise.all([
            // 2 y 4. cedinstancia + tipcedinstancia (Historial)
            postgresDB.query(`
                SELECT ci.*, TRIM(tci.tipcedinsdsc) as tipcedinsdsc, tci.tipcedinstrabar, tci.tipcedinsmedcau 
                FROM public.cedinstancia ci 
                LEFT JOIN public.tipcedinstancia tci ON ci.tipcedinscod = tci.tipcedinscod 
                WHERE ci.cednro = $1 
                ORDER BY ci.cedinsfec ASC, ci.cedinscod ASC
            `, [cednro]),
            // 5. tipcedula
            postgresDB.query(`SELECT * FROM public.tipcedula WHERE tipcedid = $1`, [cedtpo]),
            // 6. cedmotfin (si existe)
            cedmotfin != null ? postgresDB.query(`SELECT * FROM public.cedmotfin WHERE motfincod = $1`, [cedmotfin]) : { rows: [] },
            // 7. tipocedulasector
            cedtpo != null && cedseccod != null ? postgresDB.query(`SELECT * FROM public.tipocedulasector WHERE tipcedid = $1 AND tipcedseccod = $2`, [cedtpo, parseInt(cedseccod)]) : { rows: [] },
            // 8. tcedulacedcuo
            postgresDB.query(`SELECT * FROM public.tcedulacedcuo WHERE cednro = $1`, [cednro])
        ]);

        // 3. instanciacosto para las instancias que están presentes en el historial de esta cédula
        const tipcedinscods = [...new Set(instancesRes.rows.map(r => r.tipcedinscod))];
        let costs = [];
        if (tipcedinscods.length > 0) {
            const costsRes = await postgresDB.query(`
                SELECT ic.*, TRIM(tci.tipcedinsdsc) as tipcedinsdsc 
                FROM public.instanciacosto ic 
                LEFT JOIN public.tipcedinstancia tci ON ic.tipcedinscod = tci.tipcedinscod 
                WHERE ic.tipcedinscod = ANY($1)
                ORDER BY ic.tipcedinscod ASC, ic.inscosalta DESC
            `, [tipcedinscods]);
            costs = costsRes.rows;
        }

        res.json({
            cedula,
            legacyApremio,
            instances: instancesRes.rows,
            costs,
            tipCedula: tipCedulaRes.rows[0] || null,
            cedMotFin: cedMotFinRes.rows[0] || null,
            sector: sectorRes.rows[0] || null,
            cuotas: cuotasRes.rows
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
