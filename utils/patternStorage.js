// patternStorage.js
// Assumes the promise-based database pool is available or passed in.

/**
 * Saves the recorded login pattern to the login_patterns table.
 * It uses an upsert (INSERT ON DUPLICATE KEY UPDATE) based on agent_company_id.
 * * @param {object} connection - The active, promise-based DB connection.
 * @param {bigint} agentCompanyId - The ID linking the pattern to the agent/carrier.
 * @param {Array<object>} recordedSteps - The array of steps captured by the recorder.
 * @returns {Promise<void>}
 */
async function saveLoginPattern(connection, recordedSteps, name) {
    console.log('savePattern')
    if (!recordedSteps || recordedSteps.length === 0) {
        console.warn(`Attempted to save an empty pattern for company: ${name}`);
        return;
    }
    const scriptName = 'run' + name.trim().split(/[\s_-]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    console.log(scriptName)
    try {
        // Stringify the JavaScript array into a JSON string for the database
        const patternJsonString = JSON.stringify(recordedSteps);
        const [result] = await connection.execute(
            'INSERT INTO companies (name, bot_script_name) VALUES (?, ?)',
            [name, scriptName]
        );
        console.log('Inserted company ID:', result.insertId);

        // Execute the upsert operation
        //await connection.execute(sql2, values2);

        const sql = `
            INSERT INTO login_patterns (agent_company_id, pattern_json)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE
            pattern_json = VALUES(pattern_json),
            updated_at = CURRENT_TIMESTAMP()
        `;

        const values = [
            result.insertId, 
            patternJsonString
        ];

        // Execute the upsert operation
        await connection.execute(sql, values);
        
        console.log(`Successfully saved/updated login pattern for company: ${name}`);

    } catch (error) {
        console.error(`Error saving login pattern to database for company ${name}:`, error);
        throw new Error("Failed to save login pattern to database.");
    }
}

module.exports = { saveLoginPattern };