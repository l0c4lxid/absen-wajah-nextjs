
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: false
});

async function reset() {
  try {
    const response = await fetch('https://localhost:3000/api/reset-db', {
      method: 'POST',
      agent: agent
    });
    
    // fetch in Node 18+ might not support 'agent' option directly in the same way node-fetch does, 
    // but usually it accepts a dispatcher or we can just try without agent if we set NODE_TLS_REJECT_UNAUTHORIZED=0.
    // Let's try setting process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    
    const data = await response.json();
    console.log('Reset DB Response:', data);
  } catch (error) {
    console.error('Error resetting DB:', error);
  }
}

// Global override for self-signed certs
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
reset();
