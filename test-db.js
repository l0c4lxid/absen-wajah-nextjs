
const dbConnect = require('./lib/db').default;
const mongoose = require('mongoose');

// Need to emulate Next.js environment for process.env
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await dbConnect();
    console.log('Successfully connected to MongoDB!');
    
    // Check connection state
    const state = mongoose.connection.readyState;
    console.log(`Connection state: ${state} (1 = connected)`);
    
    if (state === 1) {
      process.exit(0);
    } else {
      console.error('Connection state is not connected.');
      process.exit(1);
    }
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    process.exit(1);
  }
}

testConnection();
