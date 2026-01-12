/**
 * Centralized configuration for the chat application
 * Switch between dev and production by changing NODE_ENV
 */

const config = {
    development: {
        serverUrl: process.env.SERVER_URL_DEV || 'http://localhost:5000',
        clientUrl: process.env.CLIENT_URL_DEV || 'http://localhost:5173',
        corsOrigins: [
            'http://localhost:3000',
            'http://localhost:5173',
            process.env.CLIENT_URL_DEV
        ].filter(Boolean),
        mongodbUri: process.env.MONGODB_URI_DEV || 'mongodb://localhost:27017/chat-app-dev',
        jwtSecret: process.env.JWT_SECRET_DEV || 'dev-secret-key-change-in-production',
        jwtExpire: process.env.JWT_EXPIRE || '7d',
        port: process.env.PORT || 5000,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
        maxAvatarSize: parseInt(process.env.MAX_AVATAR_SIZE) || 2097152, // 2MB
    },
    production: {
        serverUrl: process.env.SERVER_URL_PROD || 'http://13.62.127.219',
        clientUrl: process.env.CLIENT_URL_PROD || 'http://13.62.127.219',
        corsOrigins: process.env.CORS_ORIGIN 
            ? process.env.CORS_ORIGIN.split(',')
            : ['http://13.62.127.219'],
        mongodbUri: process.env.MONGODB_URI_PROD ,
        jwtSecret: process.env.JWT_SECRET_PROD ,
        jwtExpire: process.env.JWT_EXPIRE || '7d',
        port: process.env.PORT || 5000,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
        maxAvatarSize: parseInt(process.env.MAX_AVATAR_SIZE) || 2097152, // 2MB
    }
};

const env = process.env.NODE_ENV || 'development';

if (env === 'production' && !process.env.MONGODB_URI_PROD) {
    console.error('ERROR: MONGODB_URI_PROD must be set in production environment');
    process.exit(1);
}

if (env === 'production' && !process.env.JWT_SECRET_PROD) {
    console.error('ERROR: JWT_SECRET_PROD must be set in production environment');
    process.exit(1);
}

module.exports = config[env];
