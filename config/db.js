const mongoose = require('mongoose');

async function connectDb(uri) {
  const MONGODB_URI = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/my_database';

  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000
  });

  return mongoose.connection;
}

module.exports = { connectDb };
