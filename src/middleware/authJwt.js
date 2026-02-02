const jwt = require('jsonwebtoken');
const db = require('../config/db');
const JWT_SECRET = process.env.JWT_SECRET;


module.exports = async function authJwt(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing_token' });

    const token = auth.slice('Bearer '.length);
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        // payload.sub should be vendor id
        const [rows] = await db.execute(`SELECT * FROM vendors WHERE id = ?`, [payload.sub]);
        if (!rows.length) return res.status(401).json({ error: 'invalid_token' });

        req.vendor = rows[0]; // attach vendor to request
        next();
    } catch (err) {
        console.error('auth error', err);
        return res.status(401).json({ error: 'invalid_token' });
    }
};
