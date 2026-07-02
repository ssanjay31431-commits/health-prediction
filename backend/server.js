const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const envConfig = require('./config/env');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

console.log('Backend version:', process.env.RENDER_GIT_COMMIT || 'unknown');

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const PORT_FAIL_FAST = typeof process.env.PORT !== 'undefined' && process.env.PORT !== '';

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

const reportLines = ['=================================', 'Environment Variable Check', '================================='];
requiredKeys.forEach((key) => {
  const value = envConfig.envValues[key];
  reportLines.push(value ? `✓ ${key}` : `✗ ${key}`);
});
optionalKeys.forEach((key) => {
  const value = envConfig.envValues[key];
  reportLines.push(value ? `✓ ${key} (optional)` : `✗ ${key} (optional)`);
});
reportLines.push('=================================');
console.log(reportLines.join('\n'));

const missingRequired = envConfig.missingRequired;
const missingOptional = envConfig.missingOptional;
const brevoEnabled = envConfig.isBrevoEnabled;
const resendOk = envConfig.isResendEnabled;

console.log(`MongoDB: ${envConfig.envValues.MONGO_URI ? 'OK' : 'Missing'}`);
console.log(`Resend: ${resendOk ? 'OK' : 'Missing'}`);
console.log(`Brevo: ${brevoEnabled ? 'Enabled' : 'Disabled'}`);

if (missingRequired.length > 0) {
  missingRequired.forEach((key) => console.error(`Missing required environment variable: ${key}`));
  process.exit(1);
}

if (!brevoEnabled && missingOptional.length > 0) {
  console.log('Brevo is disabled. Using Resend only.');
}

app.use(cors());
app.use(express.json());

const patientRoutes = require('./routes/patientRoutes');
const predictRoutes = require('./routes/predictRoutes');
const authRoutes = require('./routes/authRoutes');
const emailRoutes = require('./routes/emailRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingRoutes = require('./routes/settingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const pendingRequestRoutes = require('./routes/pendingRequestRoutes');
const authenticateToken = require('./middleware/authenticateToken');

// Auth routes (public)
app.use('/api/auth', authRoutes);

// Pending request routes (public for email links, protected for admin)
app.use('/api/pending-requests', pendingRequestRoutes);

// Protected routes - require authentication
app.use('/api/patients', authenticateToken, patientRoutes);
app.use('/api/predict', authenticateToken, predictRoutes);
app.use('/api/email', authenticateToken, emailRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/dashboard', dashboardRoutes);

app.get('/', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const start = async () => {
  const dbStatus = await connectDB(envConfig.mongoUri);
  if (!dbStatus?.connected) {
    logger.warn('Server starting without database connection. Some endpoints may be unavailable.');
    if (dbStatus?.error) logger.warn(dbStatus.error.message || dbStatus.error);
  }

  // Attempt to listen on PORT. Fail fast only when Render explicitly defines PORT.
  const maxRetries = PORT_FAIL_FAST ? 1 : 10;
  let attempt = 0;
  let currentPort = PORT;

  const tryListen = () => {
    attempt += 1;
    const server = app.listen(currentPort);

    server.on('listening', () => {
      logger.info(`Server running on port ${currentPort}`);
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        if (PORT_FAIL_FAST) {
          logger.error(`Port ${currentPort} is already in use. Stop the process using it or set a different PORT environment variable.`);
          process.exit(1);
        }

        logger.warn(`Port ${currentPort} in use, attempting next port... (attempt ${attempt}/${maxRetries})`);
        server.close?.();
        if (attempt < maxRetries) {
          currentPort += 1;
          setTimeout(tryListen, 200);
        } else {
          logger.error('All retry attempts failed. Exiting.');
          process.exit(1);
        }
      } else {
        logger.error('Server error', err);
        process.exit(1);
      }
    });
  };

  tryListen();
};

start();

// nodemon reload marker
