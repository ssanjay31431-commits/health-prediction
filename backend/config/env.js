const path = require('path');
const envFilePath = path.join(__dirname, '..', '.env');
const result = { error: null };

const requiredVars = [
  'MONGO_URI',
  'BREVO_API_KEY',
  'BREVO_FROM_EMAIL',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL'
];

const missingVars = [];

console.log('===== EMAIL CONFIG =====');
requiredVars.forEach((key) => {
  const value = process.env[key]?.trim();
  if (value) {
    if (key.endsWith('_FROM_EMAIL')) {
      console.log(`${key}: ${value}`);
    } else {
      console.log(`${key}: Loaded`);
    }
  } else {
    console.log(`✗ ${key} Missing`);
    missingVars.push(key);
  }
});

if (result.error && result.error.code !== 'ENOENT') {
  console.error('Failed to load .env file:', result.error.message);
}

if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
}
console.log('========================');

module.exports = {
  missingVars,
  isEnvValid: missingVars.length === 0,
  env: process.env
};
