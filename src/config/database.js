// src/config/database.js
require('dotenv').config();
const mysql = require('mysql2/promise');

let pool;

// Prepare SSL options if a CA certificate is provided
let sslOptions = undefined;
if (process.env.MYSQL_CA_CERT) {
  // CA certificate content (including BEGIN/END lines) stored in env var
  sslOptions = {
    rejectUnauthorized: true,
    ca: process.env.MYSQL_CA_CERT
  };
  console.log('🔐 Using CA certificate for SSL');
} else {
  // Fallback: still try SSL with system certificates (may work for some providers)
  // For Aiven, this will likely fail – better to set MYSQL_CA_CERT.
  sslOptions = {
    rejectUnauthorized: true
  };
  console.log('⚠️  No MYSQL_CA_CERT provided – SSL may fail if server uses a custom CA');
}

if (process.env.MYSQL_PUBLIC_URL) {
  // Use the single connection string (public proxy)
  pool = mysql.createPool({
    uri: process.env.MYSQL_PUBLIC_URL,
    ssl: sslOptions
  });
  console.log('ℹ️  Using MYSQL_PUBLIC_URL for database connection');
} else {
  // Fallback to separate DB_* env vars
  pool = mysql.createPool({
    host:               process.env.DB_HOST,
    port:               process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : undefined,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    database:           process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit:    10,
    queueLimit:         0,
    ssl:                sslOptions
  });
  console.log('ℹ️  Using DB_HOST/DB_USER/DB_NAME etc. for database connection');
}

async function testConnection() {
  try {
    // Simple test query
    const [rows] = await pool.query('SELECT 1');
    console.log('✅ MySQL pool connected successfully.');
  } catch (err) {
    console.error('❌ MySQL pool connection failed:', err);
    process.exit(1);
  }
}

testConnection();

module.exports = pool;