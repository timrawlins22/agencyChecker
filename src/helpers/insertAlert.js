// A list of keywords that indicate a lapsed or about-to-lapse policy status.
// You can customize this list based on the specific carriers.
const LAPSE_KEYWORDS = [
    'lapsed',
    'pending lapse',
    'termina', // Catches 'terminated' or 'termination'
    'cancelled for non-payment',
    'cxl for npy',
    'surrender',
    'no-forfeit', // Catches 'non-forfeiture'
];

/**
 * Checks a policy's status and creates or resolves alerts in the policy_alerts table.
 * @param {string} policyNumber The policy's unique number.
 * @param {string} newStatus The new policy status from the carrier data.
 * @param {object} connection The database connection object.
 */
async function handleLapseAlert(policyNumber, newStatus, connection) {
    if (!policyNumber || !newStatus) {
        console.warn("handleLapseAlert received invalid policy number or status.");
        return;
    }
    
    const statusLower = newStatus.toLowerCase();
    const isLapsed = LAPSE_KEYWORDS.some(keyword => statusLower.includes(keyword));
    
    // IMPORTANT: Note that the connection argument should be the single connection 
    // acquired from the pool in processXlsxAndInsert.

    try {
        // 1. SELECT: REMOVE the 'new Promise' wrapper and use await directly
        const [existingAlerts] = await connection.execute(
            `SELECT id, alert_status FROM policy_alerts WHERE policy_number = ? AND alert_type = 'lapsed' AND alert_status IN ('new', 'reported')`,
            [policyNumber]
        );
        // The mysql2/promise driver returns results as [rows, fields]. We destructure to get just [rows].
        // I've added destructuring to the results to be compatible with mysql2/promise.
        
        if (isLapsed) {
            // The policy is in a lapsed state
            if (existingAlerts.length === 0) {
                // No open alert exists, so create a new one
                console.log(`Alert: Policy ${policyNumber} has lapsed. Creating new alert.`);
                const insertSql = `
                    INSERT INTO policy_alerts (policy_number, alert_type, alert_status, start_date)
                    VALUES (?, 'lapsed', 'new', CURDATE())
                `;
                // 2. INSERT: No change needed to this line, as it already uses async/await correctly
                await connection.execute(insertSql, [policyNumber]);
            } else {
                // An open alert already exists, so no action is needed
                console.log(`Info: Policy ${policyNumber} is still lapsed. Alert already exists.`);
            }
        } else {
            // The policy is NOT in a lapsed state
            if (existingAlerts.length > 0) {
                // An open alert exists, so the policy has been reinstated. Resolve it.
                console.log(`Alert: Policy ${policyNumber} has been reinstated. Resolving existing alert.`);
                const updateSql = `
                    UPDATE policy_alerts SET alert_status = 'resolved', end_date = CURDATE() WHERE policy_number = ? AND alert_status IN ('new', 'reported')
                `;
                // 3. UPDATE: No change needed to this line, as it already uses async/await correctly
                await connection.execute(updateSql, [policyNumber]);
            } else {
                // Policy is not lapsed and no open alert exists, so no action is needed
            }
        }
    } catch (err) {
        console.error(`Error handling lapse alert for policy ${policyNumber}:`, err);
        // You might want to re-throw the error to ensure the calling function knows about the failure
        throw err;
    }
}

module.exports = {
    handleLapseAlert
};