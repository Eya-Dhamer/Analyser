const User = require('../models/User');
const { verifyToken } = require('../config/jwt');


const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const decoded = verifyToken(token);
        if (decoded.type !== 'access') {
            return res.status(401).json({ error: 'Invalid token type' });
        }

        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        if (!user.role) {
            user.role = 'user';
            await user.save();
        }

        req.user = user;
        next();
    } catch (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
};

module.exports = {
    authMiddleware,
};
