const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;

(async () => {
  if (!uri) {
    console.error('MONGO_URI not set in backend/.env');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 15000,
    });

    const db = mongoose.connection.db;
    const cols = await db.listCollections().toArray();
    console.log('MongoDB connected. Collections:');
    cols.forEach(c => console.log('-', c.name));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('MongoDB connection failed:', err.message || err);
    process.exit(2);
  }
})();
