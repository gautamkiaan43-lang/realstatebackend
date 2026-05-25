const mariadb = require('mariadb');
require('dotenv').config();

async function testConn() {
  console.log('Testing MariaDB driver connection...');
  const pool = mariadb.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '',
    database: 'ero_database',
    connectionLimit: 5,
    connectTimeout: 10000
  });

  try {
    const conn = await pool.getConnection();
    console.log('✅ Connected successfully!');
    const rows = await conn.query('SELECT 1 as result');
    console.log('Query result:', rows);
    await conn.release();
    await pool.end();
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }
}

testConn();
