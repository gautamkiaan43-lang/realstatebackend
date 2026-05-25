const mysql = require('mysql2/promise');

async function fix() {
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '' // Adjust if there's a password in .env
    });

    try {
        console.log('--- DB RECOVERY PROTOCOL START ---');
        await connection.execute('DROP DATABASE IF EXISTS ero_database');
        console.log('SUCCESS: Database "ero_database" dropped.');
        
        await connection.execute('CREATE DATABASE ero_database');
        console.log('SUCCESS: Database "ero_database" recreated.');
        
        console.log('--- RECOVERY COMPLETE: PLEASE RUN MIGRATION AGAIN ---');
    } catch (error) {
        console.error('FAILURE: Error during DB reset:', error.message);
    } finally {
        await connection.end();
    }
}

fix();
