const db = require('../config/db');

const publicController = {
    async getCompanyList(req, res) {
        try {
            // Fetch company_id and name for the dropdown
            const [rows] = await db.execute(
                'SELECT company_id as id, name FROM companies ORDER BY name ASC'
            );
            
            res.json(rows);
        } catch (err) {
            console.error('Error fetching company list:', err);
            res.status(500).json({ error: 'Failed to fetch company list.' });
        }
    }
};

module.exports = publicController;