const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envFilePath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

const aliases = {
  MONGO_URI: ['MONGO_URI', 'MONGODB_URI', 'DATABASE_URL'],
  BREVO_API_KEY: ['BREVO_API_KEY'],
  BREVO_FROM_EMAIL: ['BREVO_FROM_EMAIL'],
  RESEND_API_KEY: ['RESEND_API_KEY'],
  RESEND_FROM_EMAIL: ['RESEND_FROM_EMAIL']
};

const getEnv = (keys) => keys
  .map((name) => process.env[name]?.trim())
  .find(Boolean);

const envValues = {
  MONGO_URI: getEnv(aliases.MONGO_URI),
  BREVO_API_KEY: getEnv(aliases.BREVO_API_KEY),
  BREVO_FROM_EMAIL: getEnv(aliases.BREVO_FROM_EMAIL),
  RESEND_API_KEY: getEnv(aliases.RESEND_API_KEY),
  RESEND_FROM_EMAIL: getEnv(aliases.RESEND_FROM_EMAIL)
};

const missingVars = Object.keys(envValues).filter((key) => !envValues[key]);

console.log('===== EMAIL CONFIG =====');
Object.entries(envValues).forEach(([key, value]) => {
  if (value) {
    if (key.endsWith('_FROM_EMAIL')) {
      console.log(`${key}: ${value}`);
    } else {
      console.log(`${key}: Loaded`);
    }
  } else {
    console.log(`✗ ${key} Missing`);
  }
});

if (missingVars.length > 0) {
  console.error(`Missing required environment variables: ${missingVars.join(', ')}`);
}
console.log('========================');

module.exports = {
  missingVars,
  isEnvValid: missingVars.length === 0,
  env: process.env,
  mongoUri: envValues.MONGO_URI
};
