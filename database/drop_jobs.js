const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function reset() {
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME
        });

        console.log('Dropping jobs table...');
        await connection.query('DROP TABLE IF EXISTS jobs');
        console.log('Jobs table dropped.');

        await connection.end();
        process.exit(0);
    } catch (err) {
        console.error('Reset failed:', err);
        process.exit(1);
    }
}

reset();
