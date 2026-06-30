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
const PORT_FROM_ENV = typeof process.env.PORT !== 'undefined';

app.use(cors());
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

  // Attempt to listen on PORT. If PORT was explicitly set via env, fail-fast on EADDRINUSE.
  const maxRetries = PORT_FROM_ENV ? 1 : 10;
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
        if (PORT_FROM_ENV) {
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
