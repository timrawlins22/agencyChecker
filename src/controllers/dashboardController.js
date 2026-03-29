// controllers/dashboardController.js
const db = require('../config/db'); // Your mysql2 connection
// ... potentially import your carrier names and IDs if needed

const dashboardController = {

    async getDashboardSummary(req, res) {
        // req.user is available due to the jwtAuthentication middleware
        const agentId = req.user.sub; 

        try {
            // --- 1. Fetch KPI Data ---
            const [kpiRows] = await db.execute(`
                SELECT 
                    COUNT(id) AS totalPolicies,
                    SUM(policy_face_amount) AS totalFaceAmount,
                    SUM(premium) AS totalAnnualPremium
                FROM unified_policies
                WHERE agent_id = ? AND policy_status IN ('In Force','Active');
            `, [agentId]);
            
            const kpis = kpiRows[0];
            
            // --- 2. Fetch Action Items (Lapsed & At-Risk Policies) ---
            const [actionRows] = await db.execute(`
                SELECT 
                    id, 
                    policy_number AS policy, 
                    carrier, 
                    owner_name AS client, 
                    insured_name,
                    insured_birth,
                    product_type,
                    product_name,
                    policy_face_amount,
                    billing_frequency,
                    effective_date,
                    termination_date,
                    term_duration,
                    payment_method,
                    policy_status AS status,
                    premium,
                    date_of_issue AS date,
                    writing_agent
                FROM unified_policies
                WHERE agent_id = ? 
                  AND policy_status IN ('Lapsed', 'Pending Lapse', 'Grace Period')
                ORDER BY date_of_issue DESC
                LIMIT 10;
            `, [agentId]);
            
            const [statusRows] = await db.execute(`
                SELECT 
                    policy_status AS status, 
                    COUNT(id) AS count
                FROM unified_policies
                WHERE agent_id = ?
                GROUP BY policy_status
                ORDER BY count DESC;
            `, [agentId]);

            // --- 4. Fetch Carrier Breakdown ---
            const [carrierRows] = await db.execute(`
                SELECT 
                    carrier, 
                    COUNT(id) AS count
                FROM unified_policies
                WHERE agent_id = ? AND policy_status IN ('In Force', 'Active')
                GROUP BY carrier
                ORDER BY count DESC;
            `, [agentId]);

            // --- 5. Fetch Premium Trend (Last 6 Months) ---
            const [trendRows] = await db.execute(`
                SELECT 
                    DATE_FORMAT(date_of_issue, '%Y-%m') as sortMonth,
                    DATE_FORMAT(date_of_issue, '%b') as month,
                    SUM(premium) as totalPremium
                FROM unified_policies
                WHERE agent_id = ? 
                  AND date_of_issue >= DATE_SUB(LAST_DAY(CURDATE() - INTERVAL 6 MONTH), INTERVAL DAY(LAST_DAY(CURDATE() - INTERVAL 6 MONTH))-1 DAY)
                  AND policy_status IN ('In Force', 'Active')
                GROUP BY sortMonth, month
                ORDER BY sortMonth ASC;
            `, [agentId]);

            res.json({
                // You can calculate trends later, start with raw numbers
                totalPolicies: kpis.totalPolicies || 0,
                totalFaceAmount: parseFloat(kpis.totalFaceAmount || 0).toFixed(2),
                totalAnnualPremium: parseFloat(kpis.totalAnnualPremium || 0).toFixed(2),
                
                actionItems: actionRows.map(item => ({
                    id: item.id,
                    type: item.status, 
                    policy: item.policy,
                    carrier: item.carrier,
                    client: item.client || item.insured_name || 'Unknown',
                    insuredName: item.insured_name,
                    insuredBirth: item.insured_birth ? new Date(item.insured_birth).toLocaleDateString() : 'N/A',
                    productType: item.product_type || 'N/A',
                    productName: item.product_name || 'N/A',
                    faceAmount: parseFloat(item.policy_face_amount || 0),
                    premium: parseFloat(item.premium || 0),
                    billingFreq: item.billing_frequency || 'N/A',
                    date: item.date ? new Date(item.date).toLocaleDateString() : 'N/A',
                    effectiveDate: item.effective_date ? new Date(item.effective_date).toLocaleDateString() : 'N/A',
                    terminationDate: item.termination_date ? new Date(item.termination_date).toLocaleDateString() : 'N/A',
                    termDuration: item.term_duration || 'N/A',
                    paymentMethod: item.payment_method || 'N/A',
                    writingAgent: item.writing_agent || 'N/A'
                })),

                policyStatusBreakdown: statusRows.map(row => ({
                    status: row.status,
                    count: row.count,
                })),

                carrierBreakdown: carrierRows.map(row => ({
                    carrier: row.carrier,
                    count: row.count,
                })),
                
                premiumTrend: trendRows.map(row => ({
                    month: row.month,
                    premium: parseFloat(row.totalPremium) || 0
                }))
            });

        } catch (err) {
            console.error("Error fetching dashboard summary:", err);
            res.status(500).json({ error: 'Failed to fetch dashboard data' });
        }
    },
   
    async getJobStatus(req, res) {
        const agentId = req.user.sub;
        
        try {
            // Get the LAST job run for each company for the agent, or NULL if none
            const [jobRows] = await db.execute(`
                SELECT 
                    c.name AS carrier,
                    c.company_id AS id,
                    j.status,
                    j.end_time
                FROM companies c
                LEFT JOIN (
                    SELECT company_id, status, end_time
                    FROM jobs
                    WHERE job_id IN (
                        SELECT MAX(job_id)
                        FROM jobs
                        WHERE agent_id = ?
                        GROUP BY company_id
                    )
                ) j ON c.company_id = j.company_id
                ORDER BY j.end_time DESC, c.name ASC;
            `, [agentId]);
            
            // Map the database results to the frontend's expected format
            const carrierStatus = jobRows.map(row => ({
                carrier: row.carrier,
                lastRun: row.end_time ? new Date(row.end_time).toLocaleString() : 'Never Run',
                status: row.status || 'PENDING', // PENDING serves as the default empty state
            }));
            
            res.json({ carrierStatus });
            
        } catch (err) {
            console.error("Error fetching job status:", err);
            res.status(500).json({ error: 'Failed to fetch job status' });
        }
    },

    async getAllPolicies(req, res) {
        const agentId = req.user.sub;
        
        try {
            const [policyRows] = await db.execute(`
                SELECT 
                    id, 
                    policy_number AS policy, 
                    carrier, 
                    owner_name AS client, 
                    insured_name,
                    insured_birth,
                    product_type,
                    product_name,
                    policy_face_amount,
                    billing_frequency,
                    effective_date,
                    termination_date,
                    term_duration,
                    payment_method,
                    policy_status AS status,
                    premium,
                    date_of_issue AS date,
                    writing_agent
                FROM unified_policies
                WHERE agent_id = ? 
                ORDER BY date_of_issue DESC, client ASC;
            `, [agentId]);
            
            const formattedPolicies = policyRows.map(item => ({
                id: item.id,
                type: item.status, 
                policy: item.policy,
                carrier: item.carrier,
                client: item.client || item.insured_name || 'Unknown',
                insuredName: item.insured_name,
                insuredBirth: item.insured_birth ? new Date(item.insured_birth).toLocaleDateString() : 'N/A',
                productType: item.product_type || 'N/A',
                productName: item.product_name || 'N/A',
                faceAmount: parseFloat(item.policy_face_amount || 0),
                premium: parseFloat(item.premium || 0),
                billingFreq: item.billing_frequency || 'N/A',
                date: item.date ? new Date(item.date).toLocaleDateString() : 'N/A',
                effectiveDate: item.effective_date ? new Date(item.effective_date).toLocaleDateString() : 'N/A',
                terminationDate: item.termination_date ? new Date(item.termination_date).toLocaleDateString() : 'N/A',
                termDuration: item.term_duration || 'N/A',
                paymentMethod: item.payment_method || 'N/A',
                writingAgent: item.writing_agent || 'N/A'
            }));
            
            res.json({ policies: formattedPolicies });
            
        } catch (err) {
            console.error("Error fetching all policies:", err);
            res.status(500).json({ error: 'Failed to fetch policy book of business' });
        }
    },

    async createPolicy(req, res) {
        const agentId = req.user.sub;
        const {
            policy_number,
            carrier,
            owner_name,
            insured_name,
            insured_birth,
            product_type,
            product_name,
            policy_status,
            policy_face_amount,
            premium,
            billing_frequency,
            payment_method,
            date_of_issue,
            effective_date,
            termination_date,
            term_duration,
            writing_agent
        } = req.body;

        if (!policy_number || !carrier || !owner_name) {
            return res.status(400).json({ error: 'Policy number, carrier, and owner name are required.' });
        }

        try {
            await db.execute(`
                INSERT INTO unified_policies (
                    policy_number, carrier, agent_id, writing_agent, policy_status, product_type, product_name,
                    insured_name, insured_birth, owner_name, policy_face_amount, premium,
                    billing_frequency, date_of_issue, effective_date, termination_date, term_duration, payment_method
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                policy_number, carrier, agentId, writing_agent || null, policy_status || 'Active', product_type || null, product_name || null,
                insured_name || owner_name, insured_birth || null, owner_name, policy_face_amount || 0, premium || 0,
                billing_frequency || null, date_of_issue || null, effective_date || null, termination_date || null, term_duration || null, payment_method || null
            ]);

            res.status(201).json({ message: 'Policy manually added to Book of Business successfully.' });
        } catch (err) {
            console.error("Error inserting manual policy:", err);
            // Handle duplicate policy number gracefully
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({ error: 'A policy with this policy number already exists.' });
            }
            res.status(500).json({ error: 'Failed to insert policy' });
        }
    }
};

module.exports = dashboardController;