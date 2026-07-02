const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async (uri) => {
  uri = uri?.trim() || process.env.MONGODB_URI?.trim() || process.env.DATABASE_URL?.trim();
  if (!uri || !/^mongodb(\+srv)?:\/\//i.test(uri)) {
    logger.warn('MONGO_URI not set or invalid. Skipping MongoDB connection.');
    return { connected: false };
  }

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
    });
    logger.info('MongoDB connected successfully');
    return { connected: true };
  } catch (err) {
    logger.error('MongoDB connection error:', err.message);
    logger.error('Connection string:', uri.replace(/:[^:]*@/, ':***@'));
    return { connected: false, error: err };
  }
};

module.exports = connectDB;
