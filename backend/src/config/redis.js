const redis = require('redis');
const dotenv = require('dotenv');

dotenv.config();

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
});

client.on('error', (err) => console.error('Redis Client Error', err));
client.on('connect', () => console.log('✓ Redis connected'));

const connect = async () => {
  await client.connect();
};

module.exports = {
  client,
  connect
};
