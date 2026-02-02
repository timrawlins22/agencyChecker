const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;


module.exports = async function jwtAuthentication(req, res, next) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing_token' });

    const token = auth.slice('Bearer '.length);
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // Attach decoded payload to request (e.g., { sub, vendorId, role })
        next();
    } catch (err) {
        console.error('auth error', err);
        return res.status(401).json({ error: 'invalid_token' });
    }
};
