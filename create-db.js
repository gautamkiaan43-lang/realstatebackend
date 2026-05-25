const mysql = require('mysql2/promise');
require('dotenv').config();

async function createDb() {
  const url = process.env.DATABASE_URL;
  // mysql://root:@127.0.0.1:3306/ero_database
  const dbName = url.substring(url.lastIndexOf('/') + 1);

  console.log(`Setting up database: ${dbName}...`);
  
  try {
    const connection = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3306,
      user: 'root',
      password: ''
    });
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    console.log(`Database ${dbName} ensured.`);
    await connection.end();
  } catch (error) {
    console.error('Error creating database:', error.message);
    process.exit(1);
  }
}

createDb();
