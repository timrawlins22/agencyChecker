// create_contact_table.js
const db = require('./src/config/db');

async function createTable() {
    try {
        const query = `
            CREATE TABLE IF NOT EXISTS contact_requests (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                company VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                message TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;
        
        await db.query(query);
        console.log('Successfully created contact_requests table.');
    } catch (error) {
        console.error('Error creating table:', error);
    } finally {
        process.exit();
    }
}

createTable();
