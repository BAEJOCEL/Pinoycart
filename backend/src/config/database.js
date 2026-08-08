const pgPromise = require('pg-promise');
const dotenv = require('dotenv');

dotenv.config();

const pgp = pgPromise();

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pinoycart_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: parseInt(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
};

const db = pgp(config);

const connect = async () => {
  try {
    await db.connect();
    console.log('✓ Database connected successfully');
    return true;
  } catch (error) {
    console.error('✗ Database connection error:', error.message);
    throw error;
  }
};

// Test connection
const testConnection = async () => {
  try {
    const result = await db.one('SELECT NOW() as now');
    console.log('✓ Database ping successful:', result.now);
  } catch (error) {
    console.error('✗ Database ping failed:', error.message);
  }
};

module.exports = {
  db,
  pgp,
  connect,
  testConnection
};
