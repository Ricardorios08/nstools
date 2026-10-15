const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '.env') });

const setupDb = require('./db/setupDb');

const express = require('express');
const cors = require('cors');
const authParser = require('./middleware/authParser');

const app = express();
const PORT = process.env.PORT || 3007;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Parse tokens globally
app.use('/api', authParser);

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/conversor', require('./routes/conversor'));

// Servir frontend buildeado en producción
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
