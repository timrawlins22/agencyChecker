const db = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { encrypt, decrypt } = require('../../utils/crypto');
const { addJobToQueue } = require('../../utils/jobQueue');

const JWT_SECRET = process.env.JWT_SECRET;

const agentController = {
    
    
    async login(req, res) {
        const { username, password } = req.body;

        try {
            const [rows] = await db.execute(
                'SELECT * FROM agents WHERE username = ?',
                [username]
            );
            if (!rows.length) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const agent = rows[0];

            if(!agent.password){
                const token = jwt.sign({ sub: agent.id, tenant:agent.tenant_id, externalId:agent.external_id, role:agent.role }, JWT_SECRET, { expiresIn: '8h' });
                const agentInfo = { id: agent.id, tenant:agent.tenant_id, externalId:agent.external_id, role:agent.role, email:agent.email, name:agent.name, active:agent.active, webhook_url:agent.webhook_url };
                res.json({token, agentInfo, error: 'reset' });
            }
            else{
                // Compare hashed password
                const validPassword = await bcrypt.compare(password, agent.password);
                if (!validPassword) {
                    return res.status(401).json({ error: 'Invalid credentials' });
                }

                // Generate JWT token
                const token = jwt.sign({ sub: agent.id, tenant:agent.tenant_id, externalId:agent.external_id, role:agent.role }, JWT_SECRET, { expiresIn: '8h' });
                const agentInfo = { id: agent.id, tenant:agent.tenant_id, externalId:agent.external_id, role:agent.role, email:agent.email, name:agent.name, active:agent.active, webhook_url:agent.webhook_url };

                res.json({ token, agentInfo });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Server error' });
        }
    },
    async getAgentLeads(req, res) {
        try {
            const { sub } = req.user;
            let { page = 1, pageSize = 10, sortField = "created_at", sortOrder = "desc" } = req.query;

            page = parseInt(page);
            pageSize = parseInt(pageSize);
            sortOrder = sortOrder.toLowerCase() === "asc" ? "ASC" : "DESC";

            // Validate sortField to prevent SQL injection
            const validFields = [
                "first_name",
                "last_name",
                "lead_type",
                "lead_level",
                "phone",
                "email",
                "assigned_to",
                "assigned_at",
                "created_at",
            ];
            if (!validFields.includes(sortField)) sortField = "created_at";

            // Count total leads for pagination
            const [countRows] = await db.execute(
                "SELECT COUNT(*) as total FROM leads WHERE assigned_agent_id = ?",
                [sub]
            );
            const totalLeads = countRows[0].total;
            const totalPages = Math.ceil(totalLeads / pageSize);

            // Fetch paginated leads
            const offset = (page - 1) * pageSize;
            const [leadsRows] = await db.execute(
                `SELECT 
                    l.*,
                    CONCAT(u.name) AS assigned_to
                FROM leads l
                LEFT JOIN agents u ON l.assigned_agent_id = u.id
                WHERE l.assigned_agent_id = ?
                ORDER BY ${sortField} ${sortOrder}
                LIMIT ${pageSize} OFFSET ${offset}`,
                [sub]
            );

            res.json({
                leads: leadsRows,
                totalPages,
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Failed to fetch vendor leads" });
        }
    },
    async uploadLeadsManual(req,res){
        try {
            const lead = req.body;

            const [result] = await pool.query(
            `INSERT INTO leads (first_name, last_name, email, phone, lead_type, lead_level, assigned_to, assigned_at, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                lead.first_name,
                lead.last_name,
                lead.email,
                lead.phone,
                lead.lead_type,
                lead.lead_level,
                lead.assigned_to,
                lead.assigned_at ? new Date(lead.assigned_at) : null,
            ]
            );

            res.json({ id: result.insertId, ...lead });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: "Failed to add manual lead" });
        }
    },
    async saveCarrierCredentials(req, res) {
        const agentId = req.user.sub; // The agent ID from the JWT payload
        const { companyId, username, password } = req.body;

        // 1. Input Validation
        if (!companyId || !username || !password) {
            return res.status(400).json({ error: 'Missing carrier ID, username, or password.' });
        }
        
        // Ensure companyId is an integer if you are using auto-parsing middleware
        const companyIdInt = parseInt(companyId);
        if (isNaN(companyIdInt)) {
            return res.status(400).json({ error: 'Invalid company ID format.' });
        }

        try {
            // --- Step 1: Encrypt the sensitive data ---
            const encryptedUsername = encrypt(username);
            const encryptedPassword = encrypt(password);
            
            // --- Step 2: Store/Update Credentials in agent_carrier_credentials (UPSERT) ---
            // This query inserts a NEW record OR updates the existing one based on the unique key (agent_id, company_id)
            const result = await db.execute(
                `INSERT INTO agent_companies (agent_id, company_id, is_enabled) 
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE is_enabled = 1, agent_company_id = LAST_INSERT_ID(agent_company_id)`,
                [agentId, companyIdInt]
            )
            const agentCompanyId = result[0].insertId;
            await db.execute(
                `INSERT INTO agent_carrier_credentials 
                    (agent_id, company_id, agent_company_id, login_username_encrypted, login_password_encrypted) 
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                    login_username_encrypted = VALUES(login_username_encrypted),
                    login_password_encrypted = VALUES(login_password_encrypted),
                    updated_at = NOW()`,
                [agentId, companyIdInt, agentCompanyId, encryptedUsername, encryptedPassword]
            );

            // --- Step 3: Ensure the carrier is enabled in the agent_companies table (UPSERT) ---
            // This link is required for the bot management system to know which carriers to run for the agent.
            
            
            
            await addJobToQueue(agentId, companyIdInt, agentCompanyId, 'INITIAL_SETUP', encryptedUsername, encryptedPassword);
            // Optional: Trigger the initial bot run here, if appropriate
            // runInitialBot(agentId, companyIdInt); 

            return res.json({ message: 'Carrier credentials saved and aggregation enabled.', companyId: companyIdInt });

        } catch (err) {
            console.error("Error saving carrier credentials:", err);
            
            // Check for the foreign key error explicitly, as it's the most common failure here.
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: `Carrier ID ${companyId} not found in master list. Please check the 'companies' table.` });
            }
            
            // General server error fallback
            return res.status(500).json({ error: 'Server error: Failed to securely save credentials.' });
        }
    },
    async uploadLeads(req,res){
        
        try {
            // Expect leads[] in the body (parsed by frontend)
            const { leads } = req.body;
            const { tenant, sub } = req.user;
            const vendor_profile_id=0;
            const vendor_id=0;
            if (!leads || !Array.isArray(leads) || leads.length === 0) {
            return res.status(400).json({ error: "No leads provided" });
            }

            // Prepare values for bulk insert
            const values = leads.map((lead) => [
                tenant,
                null,
                null,
                lead.first_name || null,
                lead.last_name || null,
                lead.phone || null,
                lead.address || null,
                lead.city || null,
                lead.zip || null,
                lead.state || null,
                lead.lead_type || 'manual',
                lead.lead_level || 'manual',
                lead.custom_fields ? JSON.stringify(lead.custom_fields) : null,
                lead.meta_data ? JSON.stringify(lead.meta_data) : null,
                lead.agent_id || sub,
                lead.assigned_at ? new Date(lead.assigned_at) : null,
                new Date(), // created_at
                "assigned",
            ]);

            // Insert into DB
            await db.query(
                `INSERT INTO leads
                    (tenant_id, vendor_profile_id, vendor_id, first_name, last_name, phone, address, city, zip, state,
                    lead_type, lead_level, custom_fields, meta_data, assigned_agent_id, assigned_at, created_at, distribution_status)
                VALUES ?`,
                [values]
            );

            res.json({ inserted: values.length });
        } catch (err) {
            console.error("Error uploading leads:", err);
            res.status(500).json({ error: "Failed to upload leads" });
        }
    },
    async updatePassword(req, res) {

        const { agentId } = req.params;
        const { currentPassword, newPassword } = req.body;

        if (!agentId) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        if (!newPassword) {
            return res.status(400).json({ error: "Both passwords are required" });
        }

        try {
            // 1. Get the existing password hash from DB
            const [rows] = await db.execute(
                "SELECT password FROM agents WHERE id = ?",
                [agentId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }

            const storedHash = rows[0].password;
            if(storedHash===null){
                const salt = await bcrypt.genSalt(10);
                const newHash = await bcrypt.hash(newPassword, salt);
                await db.execute(
                    "UPDATE agents SET password = ? WHERE id = ?",
                    [newHash, agentId]
                );
                return res.json({ message: "Password updated successfully" });
            }
            else{
                // 2. Compare current password with stored hash
                const isMatch = await bcrypt.compare(currentPassword, storedHash);
                if (!isMatch) {
                    return res.status(400).json({ error: "Current password is incorrect" });
                }

                // 3. Hash the new password
                const salt = await bcrypt.genSalt(10);
                const newHash = await bcrypt.hash(newPassword, salt);

                // 4. Update password in DB
                await db.execute(
                    "UPDATE agents SET password = ? WHERE id = ?",
                    [newHash, agentId]
                );

                return res.json({ message: "Password updated successfully" });
            }
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: "Failed to update password" });
        }
    },
    async getAgent(req, res) {
        const{ role }=req.user;
        if(role=== ('principal' || 'admin')){
            const { agentId } = req.params;
            const [rows] = await db.execute(
                `SELECT agents.*,
                GROUP_CONCAT(agent_states.state ORDER BY agent_states.state SEPARATOR ', ') AS states
                FROM agents
                LEFT JOIN agent_states
                ON agent_states.agent_id=agents.id
                WHERE agents.id = ?
                GROUP BY agents.id, agents.tenant_id, agents.external_id, agents.role, agents.username, agents.password, agents.name, agents.email, agents.max_leads_per_day, agents.max_leads_per_week, agents.active, agents.webhook_url, agents.created_at`,


                [agentId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: "User not found" });
            }
            else{
                const agent = rows[0];
                return res.json(agent);
            }

            
        }
    },
    async triggerManualSync(req, res) {
        const agentId = req.user.sub;
        const { companyId } = req.body; 

        try {
            if (companyId) {
                // Run a single carrier
               const [rows] = await db.execute(
                    'SELECT company_id, agent_company_id FROM agent_companies WHERE agent_id = ? AND company_id = ? AND is_enabled = 1',
                    [agentId, companyId]
                );
                
                for (const row of rows) {
                    await addJobToQueue(agentId, row.company_id, row.agent_company_id, 'MANUAL_SINGLE');
                }
            } else {
                // Run ALL enabled carriers for the agent
                const [rows] = await db.execute(
                    'SELECT company_id, agent_company_id FROM agent_companies WHERE agent_id = ? AND company_id = ? AND is_enabled = 1',
                    [agentId, companyId]
                );
                
                for (const row of rows) {
                    await addJobToQueue(agentId, row.company_id, row.agent_company_id, 'MANUAL_ALL');
                }
            }

            res.json({ message: 'Sync jobs added to queue successfully.' });

        } catch (err) {
            console.error("Error adding jobs to queue:", err);
            res.status(500).json({ error: 'Failed to trigger sync jobs.' });
        }
    },
    async getAgentCarriers(req, res) {
        const agentId = req.user.sub;
        try {
            // Query joins companies (names) with agent_carrier_credentials (status) and agent_companies (enabled status)
            const [rows] = await db.execute(`
                SELECT 
                    c.company_id AS id,
                    c.name AS carrier,
                    ac.is_enabled AS isEnabled,
                    acc.login_username_encrypted IS NOT NULL AS hasCredentials 
                FROM companies c
                LEFT JOIN agent_companies ac ON ac.company_id = c.company_id AND ac.agent_id = ?
                LEFT JOIN agent_carrier_credentials acc ON acc.company_id = c.company_id AND acc.agent_id = ?
                ORDER BY c.name ASC
            `, [agentId, agentId]);

            // Filter the list to only show carriers the agent has enabled or has credentials for
            const enabledCarriers = rows.filter(row => row.isEnabled || row.hasCredentials);

            res.json(enabledCarriers);
        } catch (err) {
            console.error("Error fetching agent carriers:", err);
            res.status(500).json({ error: 'Failed to fetch carrier list.' });
        }
    },

    // --- NEW: DELETE CREDENTIALS / DISABLE CARRIER ---
    async deleteCarrierCredentials(req, res) {
        const agentId = req.user.sub;
        const { companyId } = req.params;

        if (!companyId) {
            return res.status(400).json({ error: 'Missing company ID.' });
        }

        try {
            // Step 1: Delete the sensitive credentials first
            await db.execute(
                'DELETE FROM agent_carrier_credentials WHERE agent_id = ? AND company_id = ?',
                [agentId, companyId]
            );

            // Step 2: Disable the carrier in agent_companies (so the bot skips it)
            await db.execute(
                'DELETE FROM agent_companies WHERE agent_id = ? AND company_id = ?',
                [agentId, companyId]
            );

            return res.json({ message: 'Carrier disabled and credentials removed.', companyId });

        } catch (err) {
            console.error("Error deleting carrier credentials:", err);
            return res.status(500).json({ error: 'Server error: Failed to delete credentials.' });
        }
    }
};

module.exports = agentController;
