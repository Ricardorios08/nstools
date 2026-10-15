// Force reload index.js
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const setupDb = require('./db/setupDb');

const express = require('express');
const cors = require('cors');
const mariaDB = require('./db/maria');
const postgresDB = require('./db/postgres');
const ctacteRoutes = require('./routes/ctacte');
const excelRoutes = require('./routes/excelTools');
const infogovRoutes = require('./routes/infogov');
const explorerRoutes = require('./routes/explorer');
const apremiosRoutes = require('./routes/apremios');
const authParser = require('./middleware/authParser');

// Fix for BigInt serialization
BigInt.prototype.toJSON = function () { return this.toString() };

const app = express();
const PORT = process.env.PORT || 3004; 

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Parse tokens globally and inject context
app.use('/api', authParser);

// API Routes
app.use('/api/ctacte', ctacteRoutes);
app.use('/api/ctacte-fn', require('./routes/ctacteFn'));
app.use('/api/ctacte2', require('./routes/ctacte2'));
app.use('/api/excel', excelRoutes);
app.use('/api/infogov', infogovRoutes);
app.use('/api/explorer', explorerRoutes);
app.use('/api/apremios', apremiosRoutes);
app.use('/api/apremio-config', require('./routes/apremioConfig'));
app.use('/api/comercio-rubros', require('./routes/comercioRubros'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/audit-snapshot', require('./routes/auditSnapshot'));
app.use('/api/boletos', require('./routes/boletos'));
app.use('/api/apremio-individual', require('./routes/apremioIndividual'));
app.use('/api/metabase', require('./routes/metabase'));
app.use('/api/conversor', require('./routes/conversor'));

// Endpoint to serve migration logic documentation
app.get('/api/docs/migration-logic', (req, res) => {
    try {
        const fs = require('fs');
        const path = require('path');
        const filePath = path.join(__dirname, 'migration_logic_doc.md');
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            res.json({ content });
        } else {
            res.status(404).json({ error: 'Manual no encontrado' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Health check / Connection test
app.get('/api/test-connections', async (req, res) => {
    let result = {
        maria: { status: 'testing', error: null },
        mariaRemote: { status: 'testing', error: null },
        postgres: { status: 'testing', error: null }
    };

    try {
        await mariaDB.query('SELECT 1');
        result.maria.status = 'connected';
    } catch (err) {
        result.maria.status = 'failed';
        result.maria.error = err.message;
    }

    try {
        await mariaDB.queryRemote('SELECT 1');
        result.mariaRemote.status = 'connected';
    } catch (err) {
        result.mariaRemote.status = 'failed';
        result.mariaRemote.error = err.message;
    }

    try {
        await postgresDB.query('SELECT 1');
        result.postgres.status = 'connected';
    } catch (err) {
        result.postgres.status = 'failed';
        result.postgres.error = err.message;
    }

    res.json(result);
});

// Servir frontend buildeado en producción
const fs = require('fs');
const frontendDist = path.join(__dirname, '../dist');
if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    // React Router: cualquier ruta no-API devuelve el index.html
    app.get('*splat', (req, res) => {
        res.sendFile(path.join(frontendDist, 'index.html'));
    });
    console.log('[STATIC] Sirviendo frontend desde:', frontendDist);
}

// Start server — esperar a que el SQLite esté inicializado
setupDb().then(() => {
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}`);
    });
}).catch(err => {
    console.error('[SETUP DB] Error fatal al inicializar SQLite:', err.message);
    process.exit(1);
});
