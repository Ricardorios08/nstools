const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const { logAction } = require('../utils/logger');

// Ruta del archivo JSON para almacenar los tableros persistentes
const JSON_DB_PATH = path.join(__dirname, '../db/metabase_dashboards.json');

// Helper para leer del archivo JSON
const readDashboards = () => {
    try {
        if (!fs.existsSync(JSON_DB_PATH)) {
            const dir = path.dirname(JSON_DB_PATH);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(JSON_DB_PATH, JSON.stringify([], null, 2));
            return [];
        }
        const content = fs.readFileSync(JSON_DB_PATH, 'utf8');
        return JSON.parse(content || '[]');
    } catch (err) {
        console.error('[Metabase Setup] Error leyendo JSON DB:', err);
        return [];
    }
};

// Helper para guardar en el archivo JSON
const writeDashboards = (data) => {
    try {
        const dir = path.dirname(JSON_DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(JSON_DB_PATH, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('[Metabase Setup] Error escribiendo JSON DB:', err);
    }
};

// Middleware para verificar Superadmin
const requireSuperadmin = (req, res, next) => {
    if (!req.user || req.user.rol !== 'superadmin') {
        return res.status(403).json({ error: 'Acceso denegado: se requieren privilegios de super-administrador.' });
    }
    next();
};

// GET /api/metabase/dashboards - Listar todos los tableros guardados
router.get('/dashboards', requireSuperadmin, (req, res) => {
    try {
        const dashboards = readDashboards();
        res.json(dashboards);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/metabase/dashboards - Registrar un nuevo tablero
router.post('/dashboards', requireSuperadmin, (req, res) => {
    const { name, description, metabase_id, type } = req.body;
    if (!name || !metabase_id) {
        return res.status(400).json({ error: 'El nombre y el ID de Metabase son obligatorios.' });
    }
    try {
        const dashboards = readDashboards();
        const mId = parseInt(metabase_id);
        const dType = type || 'dashboard';

        // Generar un ID incremental local
        const newId = dashboards.length > 0 ? Math.max(...dashboards.map(d => d.id)) + 1 : 1;
        
        const newEntry = {
            id: newId,
            name,
            description: description || '',
            metabase_id: mId,
            type: dType,
            created_at: new Date().toISOString()
        };

        dashboards.push(newEntry);
        writeDashboards(dashboards);

        logAction(req.user.nombre_usuario, 'METABASE_DASHBOARD_CREATE', `Registrado tablero Metabase: ${name} (ID Metabase: ${mId})`, req);
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/metabase/dashboards/:id - Actualizar un tablero existente
router.put('/dashboards/:id', requireSuperadmin, (req, res) => {
    const { id } = req.params;
    const { name, description, metabase_id, type } = req.body;
    if (!name || !metabase_id) {
        return res.status(400).json({ error: 'El nombre y el ID de Metabase son obligatorios.' });
    }
    try {
        const dashboards = readDashboards();
        const targetId = parseInt(id);
        const index = dashboards.findIndex(d => d.id === targetId);

        if (index === -1) {
            return res.status(404).json({ error: 'Tablero no encontrado' });
        }

        const mId = parseInt(metabase_id);
        const dType = type || 'dashboard';

        dashboards[index] = {
            ...dashboards[index],
            name,
            description: description || '',
            metabase_id: mId,
            type: dType
        };

        writeDashboards(dashboards);

        logAction(req.user.nombre_usuario, 'METABASE_DASHBOARD_UPDATE', `Actualizado tablero Metabase ID: ${id} (${name})`, req);
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/metabase/dashboards/:id - Eliminar un tablero registrado
router.delete('/dashboards/:id', requireSuperadmin, (req, res) => {
    const { id } = req.params;
    try {
        const dashboards = readDashboards();
        const targetId = parseInt(id);
        const filtered = dashboards.filter(d => d.id !== targetId);

        writeDashboards(filtered);

        logAction(req.user.nombre_usuario, 'METABASE_DASHBOARD_DELETE', `Eliminado tablero Metabase ID: ${id}`, req);
        res.json({ message: 'OK' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/metabase/iframe-url/:id - Obtener URL firmada con JWT para embeber un tablero en iframe
router.get('/iframe-url/:id', requireSuperadmin, (req, res) => {
    const { id } = req.params;
    try {
        const dashboards = readDashboards();
        const targetId = parseInt(id);
        const dbEntry = dashboards.find(d => d.id === targetId);

        if (!dbEntry) {
            return res.status(404).json({ error: 'Tablero no encontrado' });
        }

        const siteUrl = process.env.METABASE_SITE_URL || 'http://localhost:3000';
        const secretKey = process.env.METABASE_SECRET_KEY;

        if (!secretKey) {
            return res.status(500).json({ error: 'Metabase Embedding Secret Key no está configurado (falta METABASE_SECRET_KEY en .env).' });
        }

        // Estructura de JWT requerida por Metabase para embedding firmado
        const payload = {
            resource: { [dbEntry.type]: parseInt(dbEntry.metabase_id) },
            params: {},
            exp: Math.round(Date.now() / 1000) + (10 * 60) // 10 minutos de expiración
        };

        const token = jwt.sign(payload, secretKey);
        // Embebemos con el tema oscuro por defecto y bordes/títulos activados
        const iframeUrl = `${siteUrl}/embed/${dbEntry.type}/${token}#theme=night&bordered=true&titled=true`;

        res.json({ iframeUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/metabase/sso-url - Obtener URL de inicio de sesión único (SSO) de Metabase
router.get('/sso-url', requireSuperadmin, (req, res) => {
    try {
        const siteUrl = process.env.METABASE_SITE_URL || 'http://localhost:3000';
        const ssoSecret = process.env.METABASE_JWT_SHARED_SECRET;

        if (!ssoSecret) {
            // Si no hay secreto SSO (versión Open Source), devolvemos la URL directa de Metabase
            return res.json({ ssoUrl: siteUrl });
        }

        // Estructura de JWT requerida por Metabase para SSO
        const payload = {
            email: `${req.user.nombre_usuario}@nomade.local`,
            first_name: req.user.nombre_usuario,
            last_name: `(${req.user.rol})`,
            exp: Math.round(Date.now() / 1000) + (15 * 60) // 15 minutos de expiración
        };

        const token = jwt.sign(payload, ssoSecret);
        const ssoUrl = `${siteUrl}/auth/sso?jwt=${token}`;

        res.json({ ssoUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
