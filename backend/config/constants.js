module.exports = {
    // JWT
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_ISSUER: 'network-analyzer-app',
    JWT_AUDIENCE: 'network-analyzer-users',
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
    REFRESH_TOKEN_EXPIRY_MS: 7 * 24 * 60 * 60 * 1000,

    // Database
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/network-analyzer',

    // Server
    PORT: process.env.PORT || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',

    // CORS
    ALLOWED_ORIGINS: ['http://localhost:3000', 'http://localhost:3001'],

    // File Upload
    MAX_FILE_SIZE: '10mb',

    // Analysis Status
    ANALYSIS_STATUS: {
        PENDING: 'pending',
        ANALYZING: 'analyzing',
        COMPLETED: 'completed',
        FAILED: 'failed',
    },

    // Roles
    ROLES: {
        ADMIN: 'admin',
        USER: 'user',
    },
};
