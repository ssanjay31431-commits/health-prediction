const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const patientRoutes = require('./routes/patientRoutes');
const predictRoutes = require('./routes/predictRoutes');
const authRoutes = require('./routes/authRoutes');
const emailRoutes = require('./routes/emailRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingRoutes = require('./routes/settingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const pendingRequestRoutes = require('./routes/pendingRequestRoutes');
const authenticateToken = require('./middleware/authenticateToken');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// Log incoming requests (method, path, origin) to help diagnose CORS/preflight issues
app.use((req, res, next) => {
  try {
    const origin = req.headers.origin || 'no-origin-header';
    logger.info(`Incoming request: ${req.method} ${req.originalUrl} - Origin: ${origin}`);
  } catch (err) {
    logger.warn('Error logging request', err);
  }
  next();
});

const allowedOrigins = [
  'http://localhost:5173',
  'https://healthpredict.netlify.app',
  'https://phenomenal-tiramisu-43fd29.netlify.app',
  'https://health-prediction-kl7y.onrender.com',
  process.env.FRONTEND_URL,
].filter(Boolean);

const normalizedOrigin = (origin) => (origin || '').trim();
const isNetlifyOrigin = (origin) => /^https:\/\/[A-Za-z0-9-]+\.netlify\.app$/.test(origin);
const isRenderOrigin = (origin) => /^https:\/\/[A-Za-z0-9-]+\.onrender\.com$/.test(origin);

const corsOptions = {
  origin: (origin, callback) => {
    const normalized = normalizedOrigin(origin);
    if (!normalized || allowedOrigins.includes(normalized) || isNetlifyOrigin(normalized) || isRenderOrigin(normalized) || process.env.ALLOW_ANY_ORIGIN === 'true') {
      callback(null, true);
      return;
    }

    callback(new Error(`CORS policy blocked origin: ${normalized}`));
  },
  // Ensure legacy browsers and some preflight checks receive a 200 OK
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
// Ensure preflight (OPTIONS) requests receive the CORS headers
app.options('*', cors(corsOptions));
app.use(express.json());

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
  const dbStatus = await connectDB(process.env.MONGO_URI);
  if (!dbStatus?.connected) {
    logger.warn('Server starting without database connection. Some endpoints may be unavailable.');
    if (dbStatus?.error) logger.warn(dbStatus.error.message || dbStatus.error);
  }

  // Attempt to listen on the requested port, but fall back to the next available port if it is already busy.
  const maxRetries = 100;
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
