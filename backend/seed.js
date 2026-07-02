require('dotenv').config();
const mongoose = require('mongoose');
const Admin = require('./models/Admin');
const logger = require('./utils/logger');

const seedAdmin = async () => {
  try {
    // Connect to MongoDB
    const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    logger.info('Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ username: 'admin' });
    if (existingAdmin) {
      logger.info('Admin already exists. Skipping seed.');
      process.exit(0);
    }

    // Create default admin
    const admin = new Admin({
      fullName: 'System Administrator',
      username: 'admin',
      email: 'admin@healthprediction.com',
      mobile: '9999999999',
      password: 'Admin@123'
    });

    await admin.save();
    logger.info('✅ Default admin created successfully');
    logger.info('Username: admin');
    logger.info('Password: Admin@123');
    logger.info('⚠️  Please change the password after first login in production!');

    process.exit(0);
  } catch (error) {
    logger.error('Error seeding admin:', error);
    process.exit(1);
  }
};

seedAdmin();
