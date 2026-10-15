const express = require('express');
const router = express.Router();
const mariaDB = require('../db/maria');
const postgres = require('../db/postgres');
const { logAction } = require('../utils/logger');
const jwt = require('jsonwebtoken');

const DB_NAME = 'recaudacion2';
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';
const ALLOWED_MARIA_DBS = ['infogov', 'contpres', 'municipiov1', 'personal3', 'recahisto', 'recaudacion', 'recaudacion2', DB_NAME];

// Middleware de seguridad
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

// List tables
router.get('/:engine/:db/tables', async (req, res) => {
    const { engine, db } = req.params;
    logAction(req.user.nombre_usuario, 'EXPLORER_LIST_TABLES', `Listando tablas en ${engine.toUpperCase()} / ${db}`, req);
    
    try {
        if (engine === 'pg') {
            const query = `SELECT table_name as "Name", (SELECT reltuples::bigint FROM pg_class WHERE relname = table_name) as "Rows", '' as "Comment", NULL as "Update_time" FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
            const result = await postgres.query(query);
            return res.json(result.rows.map(t => ({ name: t.Name, rows: t.Rows, comment: t.Comment, updated: t.Update_time })));
        }

        if (!ALLOWED_MARIA_DBS.includes(db)) return res.status(403).json({ error: 'Base de datos no permitida' });
        const result = await mariaDB.query(`SHOW TABLE STATUS FROM ${db}`);
        res.json(result.map(t => ({ name: t.Name, rows: t.Rows, comment: t.Comment, updated: t.Update_time })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dynamic Table Explorer
router.get('/:engine/:db/explore/:table', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const { engine, db, table } = req.params;
    const { q, limit = 100 } = req.query;
    
    logAction(req.user.nombre_usuario, 'EXPLORER_VIEW_DATA', `Consultando tabla: ${db}.${table} (${engine.toUpperCase()}) | Filtro: ${q || 'Ninguno'}`, req);

    if (!/^[a-zA-Z0-9_.]+$/.test(table)) return res.status(400).json({ error: 'Nombre de tabla inválido' });

    try {
        if (engine === 'pg') {
            let query = `SELECT * FROM "${table}"`;
            let params = [];
            if (q) {
                const colRes = await postgres.query(`SELECT column_name FROM information_schema.columns WHERE table_name = $1`, [table]);
                const searchable = colRes.rows.map(c => `CAST("${c.column_name}" AS TEXT) ILIKE $2`);
                if (searchable.length > 0) {
                    query += ` WHERE ${searchable.join(' OR ')}`;
                    params = [table, `%${q}%`];
                }
            }
            query += ` LIMIT ${parseInt(limit)}`;
            const result = await postgres.query(query, params);
            return res.json(result.rows);
        }

        if (!ALLOWED_MARIA_DBS.includes(db)) return res.status(403).json({ error: 'Base de datos no permitida' });
        let query = `SELECT * FROM ${db}.${table}`;
        let params = [];

        if (q) {
            const columns = await mariaDB.query(`SHOW COLUMNS FROM ${db}.${table}`);
            const searchableColumns = columns.filter(col => {
                const type = col.Type.toLowerCase();
                return type.includes('char') || type.includes('text') || type.includes('varchar') || type.includes('int') || type.includes('decimal');
            }).map(col => {
                const type = col.Type.toLowerCase();
                return type.includes('int') || type.includes('decimal') ? `CAST(${col.Field} AS CHAR) LIKE ?` : `${col.Field} LIKE ?`;
            });
            
            if (searchableColumns.length > 0) {
                query += ` WHERE ${searchableColumns.join(' OR ')}`;
                params = searchableColumns.map(() => `%${q}%`);
            }
        }

        query += ` LIMIT ${parseInt(limit)}`;
        const result = await mariaDB.query(query, params);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get columns of a table
router.get('/:engine/:db/columns/:table', async (req, res) => {
    const { engine, db, table } = req.params;
    if (!/^[a-zA-Z0-9_.]+$/.test(table)) return res.status(400).json({ error: 'Nombre de tabla inválido' });
    
    try {
        if (engine === 'pg') {
            const query = `
                SELECT column_name as "name", data_type as "type", is_nullable as "nullable"
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
            `;
            const result = await postgres.query(query, [table]);
            return res.json(result.rows.map(c => ({
                name: c.name,
                type: c.type,
                nullable: c.nullable
            })));
        }
        
        if (!ALLOWED_MARIA_DBS.includes(db)) return res.status(403).json({ error: 'Base de datos no permitida' });
        const result = await mariaDB.query(`SHOW COLUMNS FROM ${db}.${table}`);
        res.json(result.map(c => ({
            name: c.Field,
            type: c.Type,
            nullable: c.Null
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dynamic Aggregation Query Builder
router.post('/query', async (req, res) => {
    const { engine, db, table, selectColumns = [], aggregates = [], groupBy = [], filters = [], joins = [], limit = 100 } = req.body;
    
    if (!/^[a-zA-Z0-9_.]+$/.test(table)) return res.status(400).json({ error: 'Nombre de tabla inválido' });
    if (engine !== 'pg' && !ALLOWED_MARIA_DBS.includes(db)) return res.status(403).json({ error: 'Base de datos no permitida' });

    const sanitizeColumnName = (col) => col.replace(/[^a-zA-Z0-9_*.]/g, '');
    
    const formatIdentifierPg = (col) => {
        if (!col) return '';
        if (col === '*') return '*';
        const parts = col.split('.');
        return parts.map(p => p === '*' ? '*' : `"${p}"`).join('.');
    };
    
    try {
        const cleanSelect = selectColumns.map(sanitizeColumnName);
        const cleanGroupBy = groupBy.map(sanitizeColumnName);
        
        let projections = [];
        if (cleanSelect.length > 0) {
            if (engine === 'pg') {
                projections.push(...cleanSelect.map(formatIdentifierPg));
            } else {
                projections.push(...cleanSelect);
            }
        }
        
        aggregates.forEach(agg => {
            const op = agg.op.toUpperCase();
            if (!['SUM', 'COUNT', 'AVG', 'MIN', 'MAX'].includes(op)) return;
            const targetCol = agg.col === '*' ? '*' : sanitizeColumnName(agg.col);
            const alias = sanitizeColumnName(agg.alias || `${op}_${targetCol.replace('.', '_')}`);
            
            if (engine === 'pg') {
                projections.push(`${op}(${formatIdentifierPg(targetCol)}) as "${alias}"`);
            } else {
                projections.push(`${op}(${targetCol}) as "${alias}"`);
            }
        });
        
        if (projections.length === 0) {
            projections.push('*');
        }
        
        // Compile FROM and JOINs
        let fromClause = '';
        if (engine === 'pg') {
            fromClause = `FROM "${table}"`;
            joins.forEach(j => {
                const type = j.type || 'INNER JOIN';
                const rightTable = sanitizeColumnName(j.table);
                
                let onConditions = [];
                if (Array.isArray(j.leftCol) && Array.isArray(j.rightCol)) {
                    j.leftCol.forEach((lc, idx) => {
                        const rc = j.rightCol[idx];
                        if (lc && rc) {
                            onConditions.push(`"${table}"."${sanitizeColumnName(lc)}" = "${rightTable}"."${sanitizeColumnName(rc)}"`);
                        }
                    });
                } else {
                    const leftCol = sanitizeColumnName(j.leftCol);
                    const rightCol = sanitizeColumnName(j.rightCol);
                    onConditions.push(`"${table}"."${leftCol}" = "${rightTable}"."${rightCol}"`);
                }
                
                fromClause += ` ${type} "${rightTable}" ON ${onConditions.join(' AND ')}`;
            });
        } else {
            fromClause = `FROM ${db}.${table}`;
            joins.forEach(j => {
                const type = j.type || 'INNER JOIN';
                const rightTable = sanitizeColumnName(j.table);
                const rightTableQualified = rightTable.includes('.') ? rightTable : `${db}.${rightTable}`;
                
                let onConditions = [];
                if (Array.isArray(j.leftCol) && Array.isArray(j.rightCol)) {
                    j.leftCol.forEach((lc, idx) => {
                        const rc = j.rightCol[idx];
                        if (lc && rc) {
                            onConditions.push(`${db}.${table}.${sanitizeColumnName(lc)} = ${rightTableQualified}.${sanitizeColumnName(rc)}`);
                        }
                    });
                } else {
                    const leftCol = sanitizeColumnName(j.leftCol);
                    const rightCol = sanitizeColumnName(j.rightCol);
                    onConditions.push(`${db}.${table}.${leftCol} = ${rightTableQualified}.${rightCol}`);
                }
                
                fromClause += ` ${type} ${rightTableQualified} ON ${onConditions.join(' AND ')}`;
            });
        }
        
        let query = `SELECT ${projections.join(', ')} ${fromClause}`;
        
        let whereClauses = [];
        let params = [];
        
        filters.forEach((filter, idx) => {
            const col = sanitizeColumnName(filter.col);
            const op = filter.op;
            const val = filter.val;
            
            if (!col || !op) return;
            
            if (['=', '>', '<', '<=', '>=', '!=', 'LIKE'].includes(op)) {
                if (engine === 'pg') {
                    whereClauses.push(`${formatIdentifierPg(col)}::text ${op} $${params.length + 1}`);
                } else {
                    whereClauses.push(`${col} ${op} ?`);
                }
                params.push(op === 'LIKE' ? `%${val}%` : val);
            }
        });
        
        if (whereClauses.length > 0) {
            query += ` WHERE ${whereClauses.join(' AND ')}`;
        }
        
        if (cleanGroupBy.length > 0) {
            if (engine === 'pg') {
                query += ` GROUP BY ${cleanGroupBy.map(formatIdentifierPg).join(', ')}`;
            } else {
                query += ` GROUP BY ${cleanGroupBy.join(', ')}`;
            }
        }
        
        query += ` LIMIT ${Math.min(parseInt(limit) || 100, 5000)}`;
        
        console.log(`[DYNAMIC QUERY ENGINE] Running: "${query}" with params:`, params);
        
        let rows = [];
        if (engine === 'pg') {
            // Set statement timeout for PostgreSQL to 90 seconds
            await postgres.query(`SET statement_timeout = 90000`);
            const resData = await postgres.query(query, params);
            rows = resData.rows;
        } else {
            // Get connection from pool and query with a 90-second timeout
            let conn;
            try {
                conn = await mariaDB.getConnection();
                rows = await conn.query({ sql: query, timeout: 90000 }, params);
            } finally {
                if (conn) conn.release();
            }
        }
        
        res.json({
            success: true,
            queryExecuted: query,
            data: rows
        });
    } catch (err) {
        console.error('Dynamic Query Engine Error:', err);
        let errorMsg = err.message;
        if (
            err.code === 'ER_TIMEOUT' || 
            err.code === 'ER_STATEMENT_TIMEOUT' || 
            err.message.toLowerCase().includes('timeout') || 
            err.message.toLowerCase().includes('canceled') ||
            err.message.toLowerCase().includes('interrupted') ||
            err.message.toLowerCase().includes('exceeded')
        ) {
            errorMsg = 'La consulta excedió el tiempo límite de 90 segundos para evitar saturación del servidor. Por favor, selecciona dimensiones de agrupación más específicas o agrega filtros en la sección 4 (por ejemplo, filtrar por un CodiOfic o CuenCtct específico) para reducir el volumen de datos a procesar.';
        }
        res.status(500).json({ error: errorMsg });
    }
});

// Get matching relation tables for a table
router.get('/:engine/:db/relations/:table', async (req, res) => {
    const { engine, db, table } = req.params;
    if (!/^[a-zA-Z0-9_.]+$/.test(table)) return res.status(400).json({ error: 'Nombre de tabla inválido' });

    try {
        let columns = [];
        if (engine === 'pg') {
            const colRes = await postgres.query(`
                SELECT column_name as "name" 
                FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = $1
            `, [table]);
            columns = colRes.rows.map(c => c.name);
        } else {
            if (!ALLOWED_MARIA_DBS.includes(db)) return res.status(403).json({ error: 'Base de datos no permitida' });
            const colRes = await mariaDB.query(`SHOW COLUMNS FROM ${db}.${table}`);
            columns = colRes.map(c => c.Field);
        }

        if (columns.length === 0) {
            return res.json([]);
        }

        // Exclude common generic and administrative audit columns that would create false positive relationships
        const genericExclusions = [
            'id', 'created_at', 'updated_at', 'deleted_at', 'engine', 'source', 'usuario', 
            'fecha', 'time', 'date', 'observaciones', 'estado', 'monto', 'importe', 'deuda', 
            'interes', 'capital', 'saldo', 'total', 'vencimiento', 'desc', 'descripcion', 
            'observacion', 'obs', 'tipo', 'operacion', 'control', 'val', 'valor', 'num',
            'altausua', 'altafeho', 'modiusa', 'modifeho', 'terminal', 'alta_usua', 'alta_feho', 
            'modi_usua', 'modi_feho', 'auditoria', 'auditorias', 'altafech', 'alta_fech', 
            'modifech', 'modi_fech', 'modiusua', 'usuaalta', 'fehoalta', 'usuamodi', 'fehomodi'
        ];
        const candidateKeys = columns.filter(col => {
            const c = col.toLowerCase();
            return !genericExclusions.includes(c) && c.length > 2;
        });

        if (candidateKeys.length === 0) {
            return res.json([]);
        }

        // Query information_schema.columns to find matching columns in other tables
        let relations = [];
        if (engine === 'pg') {
            const placeholders = candidateKeys.map((_, idx) => `$${idx + 1}`).join(', ');
            const query = `
                SELECT table_name as "table", column_name as "column"
                FROM information_schema.columns
                WHERE table_schema = 'public' 
                  AND table_name != $${candidateKeys.length + 1}
                  AND LOWER(column_name) IN (${placeholders})
                ORDER BY table_name
            `;
            const params = [...candidateKeys.map(k => k.toLowerCase()), table];
            const pgRes = await postgres.query(query, params);
            relations = pgRes.rows.map(r => ({
                table: r.table,
                column: r.column,
                matchingCol: candidateKeys.find(k => k.toLowerCase() === r.column.toLowerCase())
            }));
        } else {
            // MariaDB - Search across allowed databases
            const dbList = ALLOWED_MARIA_DBS.map(d => `'${d}'`).join(', ');
            const placeholders = candidateKeys.map(() => '?').join(', ');
            const query = `
                SELECT TABLE_SCHEMA as "db", TABLE_NAME as "table", COLUMN_NAME as "column"
                FROM information_schema.columns
                WHERE TABLE_SCHEMA IN (${dbList})
                  AND NOT (TABLE_SCHEMA = ? AND TABLE_NAME = ?)
                  AND LOWER(COLUMN_NAME) IN (${placeholders})
                ORDER BY TABLE_NAME
            `;
            const params = [db, table, ...candidateKeys.map(k => k.toLowerCase())];
            const mariaRes = await mariaDB.query(query, params);
            relations = mariaRes.map(r => ({
                table: `${r.db}.${r.table}`,
                column: r.column,
                matchingCol: candidateKeys.find(k => k.toLowerCase() === r.column.toLowerCase())
            }));
        }

        res.json(relations);
    } catch (err) {
        console.error('Relations Discovery Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

