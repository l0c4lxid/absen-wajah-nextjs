
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.local' });

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Please define the MONGODB_URI environment variable inside .env.local');
  process.exit(1);
}

async function dbConnect() {
  const opts = {
    bufferCommands: false,
  };

  console.log('Connecting to MongoDB...');
  try {
    const conn = await mongoose.connect(MONGODB_URI, opts);
    return conn;
  } catch (e) {
    throw e;
  }
}

async function testConnection() {
  try {
    await dbConnect();
    console.log('Successfully connected to MongoDB!');
    
    const state = mongoose.connection.readyState;
    console.log(`Connection state: ${state} (1 = connected)`);
    
    if (state === 1) {
      console.log('Test PASSED');
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
