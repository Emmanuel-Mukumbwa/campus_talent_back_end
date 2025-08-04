// src/config/database.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:            process.env.DB_HOST,
  user:            process.env.DB_USER,
  password:        process.env.DB_PASSWORD,
  database:        process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, 
  queueLimit:      0 
});

async function testConnection() {
  try {
    const [rows] = await pool.query('SELECT 1');
    console.log('✅ MySQL pool connected successfully.');
  } catch (err) {
    console.error('❌ MySQL pool connection failed:', err);
    process.exit(1);
  }
}

testConnection();

module.exports = pool;
