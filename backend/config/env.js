const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

const envFilePath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFilePath)) {
  dotenv.config({ path: envFilePath });
}

const aliases = {
  MONGO_URI: ['MONGO_URI', 'MONGODB_URI', 'DATABASE_URL'],
};

const requiredKeys = [
  'MONGO_URI',
  'JWT_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'SUPPORT_EMAIL'
];

const optionalKeys = [
  'BREVO_API_KEY',
  'BREVO_FROM_EMAIL'
];

const getEnv = (keys) => keys
  .map((name) => process.env[name]?.trim())
  .find(Boolean);

const envValues = {
  MONGO_URI: getEnv(aliases.MONGO_URI),
  JWT_SECRET: process.env.JWT_SECRET?.trim(),
  RESEND_API_KEY: process.env.RESEND_API_KEY?.trim(),
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL?.trim(),
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL?.trim(),
  BREVO_API_KEY: process.env.BREVO_API_KEY?.trim(),
  BREVO_FROM_EMAIL: process.env.BREVO_FROM_EMAIL?.trim()
};

const missingRequired = requiredKeys.filter((key) => !envValues[key]);
const missingOptional = optionalKeys.filter((key) => !envValues[key]);
const isBrevoEnabled = Boolean(envValues.BREVO_API_KEY && envValues.BREVO_FROM_EMAIL);
const isResendEnabled = Boolean(envValues.RESEND_API_KEY && envValues.RESEND_FROM_EMAIL);

module.exports = {
  envValues,
  missingRequired,
  missingOptional,
  isBrevoEnabled,
  isResendEnabled,
  mongoUri: envValues.MONGO_URI
};
