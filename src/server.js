require('dotenv').config();

const { seedDatabase } = require('../seed/seedDatabase');
const { connectDb } = require('../config/db');
const { createApp } = require('./app');

const PORT = process.env.PORT || 3001;
const SEED_ON_START = String(process.env.SEED_ON_START || '').toLowerCase() === 'true';

async function start() {
  try {
    const db = await connectDb();
    console.log('Connected to MongoDB');

    if (SEED_ON_START) {
      // Don't wait for seed to finish
      seedDatabase().catch((err) => console.error('Seeding error:', err));
    }

    const app = createApp();
    const server = app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log('Admin Account: 12345@123.com / 12345');
    });

    server.on('error', async (err) => {
      if (err?.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`);
      } else {
        console.error('Server error:', err);
      }

      try {
        await db.close();
      } catch (e) {
        // ignore
      }

      process.exitCode = 1;
    });
  } catch (err) {
    console.error('Startup failed:', err);
    process.exitCode = 1;
  }
}

start();
