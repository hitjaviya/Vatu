// Diagnostic script to check environment variables
require('dotenv').config();

console.log('=== Environment Variables Check ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('MONGODB_URI_DEV:', process.env.MONGODB_URI_DEV ? '✓ Set' : '✗ Not set');
console.log('MONGODB_URI_PROD:', process.env.MONGODB_URI_PROD ? '✓ Set' : '✗ Not set');
console.log('JWT_SECRET_DEV:', process.env.JWT_SECRET_DEV ? '✓ Set' : '✗ Not set');
console.log('JWT_SECRET_PROD:', process.env.JWT_SECRET_PROD ? '✓ Set' : '✗ Not set');
console.log('SERVER_URL_PROD:', process.env.SERVER_URL_PROD);
console.log('CLIENT_URL_PROD:', process.env.CLIENT_URL_PROD);
console.log('\n=== Config Loading Test ===');

const config = require('./config/config');
console.log('Active config mongodbUri:', config.mongodbUri);
console.log('Active config serverUrl:', config.serverUrl);
console.log('Active config clientUrl:', config.clientUrl);
