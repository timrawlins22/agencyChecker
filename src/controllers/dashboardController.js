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
                    policy_status AS status,
                    premium,
                    date_of_issue AS date
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
                    type: item.status, // e.g., 'Lapsed', 'Grace Period'
                    policy: item.policy,
                    carrier: item.carrier,
                    client: item.client,
                    premium: parseFloat(item.premium || 0),
                    date: item.date ? new Date(item.date).toLocaleDateString() : 'N/A',
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
            // This complex query gets the LAST job run for each company for the agent
            const [jobRows] = await db.execute(`
                SELECT 
                    c.name AS carrier,
                    j.status,
                    j.end_time
                FROM jobs j
                JOIN companies c ON j.company_id = c.company_id
                WHERE j.job_id IN (
                    SELECT MAX(job_id)
                    FROM jobs
                    WHERE agent_id = ?
                    GROUP BY company_id
                )
                ORDER BY j.end_time DESC;
            `, [agentId]);
            
            // Map the database results to the frontend's expected format
            const carrierStatus = jobRows.map(row => ({
                carrier: row.carrier,
                lastRun: row.end_time ? new Date(row.end_time).toLocaleString() : 'Never Run',
                status: row.status, // Should match 'SUCCESS', 'MFA_WAIT', 'FAILED'
            }));
            
            res.json({ carrierStatus });
            
        } catch (err) {
            console.error("Error fetching job status:", err);
            res.status(500).json({ error: 'Failed to fetch job status' });
        }
    }
};

module.exports = dashboardController;