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
            'http://localhost:5174',
            process.env.CLIENT_URL_DEV
        ].filter(Boolean),
        mongodbUri: process.env.MONGODB_URI_DEV,
        jwtSecret: process.env.JWT_SECRET_DEV || 'dev-secret-key-change-in-production',
        jwtExpire: process.env.JWT_EXPIRE || '7d',
        port: process.env.PORT || 5000,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
        maxAvatarSize: parseInt(process.env.MAX_AVATAR_SIZE) || 2097152, // 2MB
        email: {
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER
        },
        // AWS S3 configuration for file sharing
        aws: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'ap-south-1',
            s3Bucket: process.env.AWS_S3_BUCKET
        }
    },
    production: {
        serverUrl: process.env.SERVER_URL_PROD,
        clientUrl: process.env.CLIENT_URL_PROD,
        corsOrigins: process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',')
            : ['http://13.60.38.177'],
        mongodbUri: process.env.MONGODB_URI_PROD,
        jwtSecret: process.env.JWT_SECRET_PROD,
        jwtExpire: process.env.JWT_EXPIRE || '7d',
        port: process.env.PORT || 5000,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
        maxAvatarSize: parseInt(process.env.MAX_AVATAR_SIZE) || 2097152, // 2MB
        email: {
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
            from: process.env.EMAIL_FROM || process.env.EMAIL_USER
        },
        // AWS S3 configuration for file sharing
        aws: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
            region: process.env.AWS_REGION || 'ap-south-1',
            s3Bucket: process.env.AWS_S3_BUCKET
        }
    }
};

const env = process.env.NODE_ENV || 'development';
const errorMap = {
    "MONGODB_URI_PROD": 'ERROR: MONGODB_URI_PROD must be set in production environment',
    "JWT_SECRET_PROD": 'ERROR: JWT_SECRET_PROD must be set in production environment',
    "SERVER_URL_PROD": 'ERROR: SERVER_URL_PROD must be set in production environment',
    "CLIENT_URL_PROD": 'ERROR: CLIENT_URL_PROD must be set in production environment',
    "CORS_ORIGIN": 'ERROR: CORS_ORIGIN must be set in production environment',
    "EMAIL_HOST": 'ERROR: EMAIL_HOST must be set in production environment',
    "EMAIL_PORT": 'ERROR: EMAIL_PORT must be set in production environment',
    "EMAIL_USER": 'ERROR: EMAIL_USER must be set in production environment',
    "EMAIL_PASS": 'ERROR: EMAIL_PASS must be set in production environment',
    "EMAIL_FROM": 'ERROR: EMAIL_FROM must be set in production environment',
    "AWS_ACCESS_KEY_ID": 'ERROR: AWS_ACCESS_KEY_ID must be set in production environment',
    "AWS_SECRET_ACCESS_KEY": 'ERROR: AWS_SECRET_ACCESS_KEY must be set in production environment',
    "AWS_REGION": 'ERROR: AWS_REGION must be set in production environment',
    "AWS_S3_BUCKET": 'ERROR: AWS_S3_BUCKET must be set in production environment',
    "CLOUDFRONT_DOMAIN": 'ERROR: CLOUDFRONT_DOMAIN must be set in production environment',

};

if (env === 'production') {
    for (const key in errorMap) {
        if (!process.env[key]) {
            console.error(errorMap[key]);
            process.exit(1);
        }
    }
}

module.exports = config[env];
