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
    },

    async submitContactForm(req, res) {
        try {
            const { name, company, email, phone, message } = req.body;

            if (!name || !email || !message) {
                return res.status(400).json({ error: 'Name, email, and message are required fields.' });
            }

            const query = `
                INSERT INTO contact_requests (name, company, email, phone, message)
                VALUES (?, ?, ?, ?, ?)
            `;

            await db.execute(query, [name, company || '', email, phone || '', message]);

            res.status(201).json({ success: true, message: 'Contact request saved successfully.' });
        } catch (err) {
            console.error('Error saving contact request:', err);
            res.status(500).json({ error: 'Failed to save contact request.' });
        }
    }
};

module.exports = publicController;