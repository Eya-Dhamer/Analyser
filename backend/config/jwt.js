const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_ISSUER = process.env.JWT_ISSUER || 'netanalyzer';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'netanalyzer-users';

const generateAccessToken = (userId, role) => {
    return jwt.sign(
        { id: userId, role, type: 'access' },
        JWT_SECRET,
        {
            expiresIn: '15m',
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        }
    );
};

const generateRefreshToken = (userId) => {
    return jwt.sign(
        { id: userId, type: 'refresh', jti: randomUUID() },
        JWT_SECRET,
        {
            expiresIn: '7d',
            issuer: JWT_ISSUER,
            audience: JWT_AUDIENCE,
        }
    );
};

const verifyToken = (token, options = {}) => {
    return jwt.verify(token, JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
        ...options,
    });
};

module.exports = {
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
};
