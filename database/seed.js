const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const argon2 = require('argon2');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const schemaPath = path.join(__dirname, 'schema.sql');

async function seed() {
    try {
        console.log(`Connecting to database at ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}...`);
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 3306,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            multipleStatements: true // Required for schema.sql execution
        });

        // Create database if it doesn't exist
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME}\`;`);
        console.log(`Database ${process.env.DB_NAME} ensured.`);

        await connection.changeUser({ database: process.env.DB_NAME });

        // Read and Execute Schema
        console.log('Executing schema migration...');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        await connection.query(schema);
        console.log('Schema applied successfully.');

        // Check if demo agent exists
        const [rows] = await connection.execute('SELECT * FROM agents WHERE username = ?', ['demo_agent']);

        if (rows.length === 0) {
            console.log('Creating demo agent...');
            const hashedPassword = await argon2.hash('password123');

            await connection.execute(`
                INSERT INTO agents (username, password, name, email, role, tenant_id)
                VALUES (?, ?, ?, ?, ?, ?)
            `, ['demo_agent', hashedPassword, 'Demo Agent', 'demo@example.com', 'agent', 'demo_tenant']);

            console.log('Demo Agent created:');
            console.log('Username: demo_agent');
            console.log('Password: password123');

            // Seed some dummy dashboard data
            await seedDashboardData(connection);
        } else {
            console.log('Demo agent already exists. Skipping seed.');
        }

        await connection.end();
        console.log('Migration complete.');
        process.exit(0);
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    }
}

async function seedDashboardData(connection) {
    console.log('Seeding dummy dashboard data...');
    const [agent] = await connection.execute('SELECT id FROM agents WHERE username = ?', ['demo_agent']);
    const agentId = agent[0].id;

    // Policies
    await connection.execute(`
        INSERT INTO unified_policies (policy_number, carrier, agent_id, policy_status, policy_face_amount, premium, product_name)
        VALUES 
        ('POL-1001', 'FORESTERS', ?, 'In Force', 250000.00, 1200.00, 'Whole Life Advantage'),
        ('POL-1002', 'AMERICO', ?, 'Active', 150000.00, 850.00, 'Eagle Premier'),
        ('POL-1003', 'FANDG', ?, 'In Force', 500000.00, 3200.00, 'Everlasting UL'),
        ('POL-1004', 'FORESTERS', ?, 'Lapsed', 100000.00, 600.00, 'PlanRight')
    `, [agentId, agentId, agentId, agentId]);

    // Alerts
    await connection.execute(`
        INSERT INTO policy_alerts (agent_id, policy_number, alert_type, start_date)
        VALUES 
        (?, 'POL-1004', 'Policy Lapsed', DATE_SUB(NOW(), INTERVAL 2 DAY)),
        (?, 'POL-2022', 'Missed Premium', DATE_SUB(NOW(), INTERVAL 5 DAY))
    `, [agentId, agentId]);

    // Jobs
    await connection.execute(`
        INSERT INTO jobs (agent_id, company_id, status, end_time)
        VALUES 
        (?, 'FORESTERS', 'SUCCESS', NOW()),
        (?, 'AMERICO', 'FAILED', DATE_SUB(NOW(), INTERVAL 1 HOUR))
    `, [agentId, agentId]);

    console.log('Dummy data seeded.');
}

seed();
