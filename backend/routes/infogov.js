const express = require('express');
const router = express.Router();
const mariaDB = require('../db/maria');

// Search persons in infogov.persona (Specific feature)
router.get('/search-persona', async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    try {
        const searchTerm = q.trim();
        const isNumeric = /^\d+$/.test(searchTerm);

        let query;
        let params;

        if (isNumeric) {
            // Search by CucuPers (ID/CUIT) or NudoPers (Document)
            query = `
                SELECT 
                    CucuPers, CcokPers, DetaPers, NudoPers, CuitPers, MailPers, TelePers,
                    JuriPers, SexoPers, CeluPers, FenaPers, DecrPers, NurePers, DebrPers, 
                    UbrePers, ObsePers, AltaFeho
                FROM infogov.persona 
                WHERE CucuPers = ? OR NudoPers = ? OR CuitPers LIKE ? OR DetaPers LIKE ?
                LIMIT 50
            `;
            params = [searchTerm, searchTerm, `%${searchTerm}%`, `%${searchTerm}%`];
        } else {
            // Search by DetaPers (Name)
            query = `
                SELECT 
                    CucuPers, CcokPers, DetaPers, NudoPers, CuitPers, MailPers, TelePers,
                    JuriPers, SexoPers, CeluPers, FenaPers, DecrPers, NurePers, DebrPers, 
                    UbrePers, ObsePers, AltaFeho
                FROM infogov.persona 
                WHERE DetaPers LIKE ? 
                LIMIT 50
            `;
            params = [`%${searchTerm}%`];
        }

        const result = await mariaDB.query(query, params);
        res.json(result);
    } catch (err) {
        console.error('Error searching in infogov.persona:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
