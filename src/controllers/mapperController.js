const db = require('../config/db');
const { saveLoginPattern } = require('../../utils/patternStorage');
const moment = require('moment');

const mapperController = {

    /**
     * GET /api/mapper/patterns
     * Lists all saved patterns (company_id, company name, step count, timestamps)
     */
    async getPatterns(req, res) {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    lp.id,
                    lp.agent_company_id AS companyId,
                    c.name AS companyName,
                    JSON_LENGTH(lp.pattern_json) AS stepCount,
                    lp.created_at AS createdAt,
                    lp.updated_at AS updatedAt
                FROM login_patterns lp
                JOIN companies c ON c.company_id = lp.agent_company_id
                ORDER BY lp.updated_at DESC
            `);

            res.json(rows);
        } catch (err) {
            console.error("Error fetching patterns:", err);
            res.status(500).json({ error: "Failed to fetch patterns." });
        }
    },

    /**
     * GET /api/mapper/patterns/:companyId
     * Returns the full pattern steps for a specific company
     */
    async getPatternByCompany(req, res) {
        const { companyId } = req.params;
        try {
            const [rows] = await db.execute(
                `SELECT lp.*, c.name AS companyName 
                 FROM login_patterns lp
                 JOIN companies c ON c.company_id = lp.agent_company_id
                 WHERE lp.agent_company_id = ?`,
                [companyId]
            );

            if (rows.length === 0) {
                return res.status(404).json({ error: "No pattern found for this company." });
            }

            const pattern = rows[0];
            res.json({
                id: pattern.id,
                companyId: pattern.agent_company_id,
                companyName: pattern.companyName,
                steps: typeof pattern.pattern_json === 'string' 
                    ? JSON.parse(pattern.pattern_json) 
                    : pattern.pattern_json,
                createdAt: pattern.created_at,
                updatedAt: pattern.updated_at
            });
        } catch (err) {
            console.error("Error fetching pattern:", err);
            res.status(500).json({ error: "Failed to fetch pattern." });
        }
    },

    /**
     * DELETE /api/mapper/patterns/:companyId
     * Deletes a saved pattern
     */
    async deletePattern(req, res) {
        const { companyId } = req.params;
        try {
            const [result] = await db.execute(
                'DELETE FROM login_patterns WHERE agent_company_id = ?',
                [companyId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({ error: "No pattern found to delete." });
            }

            res.json({ message: "Pattern deleted successfully.", companyId });
        } catch (err) {
            console.error("Error deleting pattern:", err);
            res.status(500).json({ error: "Failed to delete pattern." });
        }
    },

    /**
     * POST /api/mapper/patterns/:companyId
     * Save/update a pattern from manually provided steps (used by the recording UI)
     */
    async savePattern(req, res) {
        const { companyId } = req.params;
        const { steps } = req.body;

        if (!steps || !Array.isArray(steps) || steps.length === 0) {
            return res.status(400).json({ error: "Steps array is required." });
        }

        try {
            const patternJsonString = JSON.stringify(steps);

            await db.execute(
                `INSERT INTO login_patterns (agent_company_id, pattern_json)
                 VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE
                 pattern_json = VALUES(pattern_json),
                 updated_at = CURRENT_TIMESTAMP()`,
                [companyId, patternJsonString]
            );

            res.json({ message: "Pattern saved successfully.", companyId, stepCount: steps.length });
        } catch (err) {
            console.error("Error saving pattern:", err);
            if (err.code === 'ER_NO_REFERENCED_ROW_2') {
                return res.status(400).json({ error: `Company ID "${companyId}" not found.` });
            }
            res.status(500).json({ error: "Failed to save pattern." });
        }
    },

    /**
     * PUT /api/mapper/patterns/:companyId
     * Update an existing pattern (alias for savePattern since it upserts)
     */
    async updatePattern(req, res) {
        return mapperController.savePattern(req, res);
    },

    /**
     * PUT /api/mapper/companies/:companyId/mapping
     * Saves custom CSV/Table column mappings for a specific carrier.
     */
    async updateMapping(req, res) {
        const { companyId } = req.params;
        const { mapping } = req.body;

        if (!mapping || typeof mapping !== 'object') {
            return res.status(400).json({ error: "Mapping JSON object is required." });
        }

        try {
            await db.execute(
                `UPDATE companies SET data_mapping = ? WHERE company_id = ?`,
                [JSON.stringify(mapping), companyId]
            );
            res.json({ message: "Mapping updated successfully.", companyId });
        } catch (err) {
            console.error("Error updating mapping:", err);
            res.status(500).json({ error: "Failed to update custom data mapping." });
        }
    },

    /**
     * GET /api/mapper/companies
     * Lists all companies available for pattern mapping
     */
    async getCompanies(req, res) {
        try {
            const [rows] = await db.execute(`
                SELECT 
                    c.company_id AS id,
                    c.name,
                    c.data_mapping AS dataMapping,
                    lp.id IS NOT NULL AS hasPattern
                FROM companies c
                LEFT JOIN login_patterns lp ON lp.agent_company_id = c.company_id
                ORDER BY c.name ASC
            `);
            res.json(rows);
        } catch (err) {
            console.error("Error fetching companies:", err);
            res.status(500).json({ error: "Failed to fetch companies." });
        }
    },

    /**
     * POST /api/sync/upload
     * Receives scraped policy data from the Chrome extension and upserts into unified_policies.
     */
    async uploadSyncData(req, res) {
        const agentId = req.user?.sub;
        const { companyId, tables, pageTitle, url } = req.body;

        if (!agentId) {
            console.error('[Upload] Missing agentId (req.user.sub)');
            return res.status(401).json({ error: 'Unauthorized. Missing agent identity.' });
        }

        if (!companyId) {
            return res.status(400).json({ error: 'Missing companyId.' });
        }

        if (!tables || !Array.isArray(tables) || tables.length === 0) {
            return res.status(400).json({ error: 'No table data received.' });
        }

        try {
            console.log(`[Upload] Processing ${tables.length} tables for ${companyId} (Agent: ${agentId})`);
            
            // Get carrier name and custom data_mapping from companies table
            const [companyRows] = await db.execute(
                'SELECT name, data_mapping FROM companies WHERE company_id = ?',
                [companyId]
            );
            const carrierName = companyRows[0]?.name || companyId;
            const customMappingStr = companyRows[0]?.data_mapping || null;
            
            let customMapping = {};
            if (customMappingStr) {
                try { customMapping = typeof customMappingStr === 'string' ? JSON.parse(customMappingStr) : customMappingStr; } 
                catch (e) { console.warn('Failed to parse data_mapping for', companyId); }
            }

            let insertedCount = 0;

            for (const table of tables) {
                if (!table.rows || table.rows.length === 0) continue;

                // Column name mapping — generic fallback
                const fallbackMap = {
                    'policy_number': 'policy_number', 'policynumber': 'policy_number', 'policy #': 'policy_number',
                    'policy': 'policy_number', 'certificatenbr': 'policy_number', 'certificate': 'policy_number',
                    'contract': 'policy_number', 'contract number': 'policy_number',
                    'status': 'policy_status', 'policy_status': 'policy_status', 'policystatus': 'policy_status',
                    'current status': 'policy_status', 'currentstatus': 'policy_status', 'policy status': 'policy_status',
                    'product': 'product_name', 'product_name': 'product_name', 'productname': 'product_name',
                    'plan': 'product_name', 'plandescription': 'product_name', 'plan description': 'product_name',
                    'product type': 'product_type', 'producttype': 'product_type', 'productcategory': 'product_type',
                    'insured': 'insured_name', 'insured_name': 'insured_name', 'insuredname': 'insured_name',
                    'name': 'insured_name', 'client': 'insured_name', 'client name': 'insured_name',
                    'owner': 'owner_name', 'owner_name': 'owner_name', 'ownername': 'owner_name',
                    'writing agent': 'writing_agent', 'writing_agent': 'writing_agent', 'writingagent': 'writing_agent',
                    'producing agent': 'writing_agent', 'producingagent': 'writing_agent',
                    'face amount': 'policy_face_amount', 'faceamount': 'policy_face_amount',
                    'face_amount': 'policy_face_amount', 'death benefit': 'policy_face_amount',
                    'premium': 'premium', 'annual premium': 'premium', 'annualpremium': 'premium',
                    'basemodalepremium': 'premium', 'modal premium': 'premium',
                    'annualized premium': 'premium', 'annualizedpremium': 'premium',
                    'termination date': 'termination_date', 'termination_date': 'termination_date', 'terminationdate': 'termination_date',
                    'term date': 'termination_date', 'termdate': 'termination_date',
                    'issue date': 'date_of_issue', 'issuedate': 'date_of_issue', 'date_of_issue': 'date_of_issue',
                };

                for (const row of table.rows) {
                    // Map row keys to unified_policies columns
                    const mapped = {};
                    for (const [key, value] of Object.entries(row)) {
                        const exactKey = key.trim();
                        const normalizedKey = exactKey.toLowerCase();
                        
                        // Database Lookup Rules:
                        // 1. Exact custom mapping (e.g. "Cert Number")
                        // 2. Normalized custom mapping (e.g. "cert number")
                        // 3. Fallback generic mapping
                        const unifiedCol = customMapping[exactKey] || customMapping[normalizedKey] || fallbackMap[normalizedKey];
                        
                        if (unifiedCol && value && value.trim() !== '') {
                            mapped[unifiedCol] = value.trim();
                        }
                    }

                    // Helper to parse dates into YYYY-MM-DD
                    const parseDate = (val) => {
                        if (!val) return null;
                        // Use moment to parse common formats, including 2-digit years
                        const m = moment(val, ["MM/DD/YYYY", "M/D/YYYY", "M/D/YY", "MM/DD/YY", "YYYY-MM-DD"], true);
                        if (!m.isValid()) {
                            // Try fallback parsing for other formats
                            const fallback = moment(val);
                            return fallback.isValid() ? fallback.format('YYYY-MM-DD') : null;
                        }
                        return m.format('YYYY-MM-DD');
                    };

                    // Must have at least a policy number
                    if (!mapped.policy_number) continue;

                    // Clean numeric and date values
                    if (mapped.policy_face_amount) {
                        mapped.policy_face_amount = parseFloat(String(mapped.policy_face_amount).replace(/[^0-9.-]/g, '')) || null;
                    }
                    if (mapped.premium) {
                        mapped.premium = parseFloat(String(mapped.premium).replace(/[^0-9.-]/g, '')) || null;
                    }
                    if (mapped.insured_birth) {
                        mapped.insured_birth = parseDate(mapped.insured_birth);
                    }
                    if (mapped.effective_date) {
                        mapped.effective_date = parseDate(mapped.effective_date);
                    }
                    if (mapped.date_of_issue) {
                        mapped.date_of_issue = parseDate(mapped.date_of_issue);
                    }
                    if (mapped.termination_date) {
                        mapped.termination_date = parseDate(mapped.termination_date);
                    }

                    // Upsert into unified_policies
                    await db.execute(
                        `INSERT INTO unified_policies 
                            (policy_number, carrier, agent_id, writing_agent, policy_status, product_type, product_name,
                             insured_name, insured_birth, owner_name, policy_face_amount, premium, 
                             billing_frequency, payment_method, term_duration, effective_date, termination_date, date_of_issue)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                         ON DUPLICATE KEY UPDATE
                            carrier = VALUES(carrier), agent_id = VALUES(agent_id),
                            writing_agent = COALESCE(VALUES(writing_agent), writing_agent),
                            policy_status = COALESCE(VALUES(policy_status), policy_status),
                            product_type = COALESCE(VALUES(product_type), product_type),
                            product_name = COALESCE(VALUES(product_name), product_name),
                            insured_name = COALESCE(VALUES(insured_name), insured_name),
                            insured_birth = COALESCE(VALUES(insured_birth), insured_birth),
                            owner_name = COALESCE(VALUES(owner_name), owner_name),
                            policy_face_amount = COALESCE(VALUES(policy_face_amount), policy_face_amount),
                            premium = COALESCE(VALUES(premium), premium),
                            billing_frequency = COALESCE(VALUES(billing_frequency), billing_frequency),
                            payment_method = COALESCE(VALUES(payment_method), payment_method),
                            term_duration = COALESCE(VALUES(term_duration), term_duration),
                            effective_date = COALESCE(VALUES(effective_date), effective_date),
                            termination_date = COALESCE(VALUES(termination_date), termination_date),
                            date_of_issue = COALESCE(VALUES(date_of_issue), date_of_issue)`,
                        [
                            mapped.policy_number,
                            carrierName,
                            agentId,
                            mapped.writing_agent || null,
                            mapped.policy_status || null,
                            mapped.product_type || null,
                            mapped.product_name || null,
                            mapped.insured_name || null,
                            mapped.insured_birth || null,
                            mapped.owner_name || null,
                            mapped.policy_face_amount || null,
                            mapped.premium || null,
                            mapped.billing_frequency || null,
                            mapped.payment_method || null,
                            mapped.term_duration || null,
                            mapped.effective_date || null,
                            mapped.termination_date || null,
                            mapped.date_of_issue || null
                        ]
                    );
                    insertedCount++;
                }
            }

            // Insert sync job to record that this carrier was successfully updated
            await db.execute(`
                INSERT INTO jobs (agent_id, company_id, run_date, status, start_time, end_time)
                VALUES (?, ?, CURDATE(), 'SUCCESS', NOW(), NOW())
            `, [agentId, companyId]);

            res.json({ 
                message: `Sync complete. ${insertedCount} policies processed.`,
                companyId,
                processedCount: insertedCount
            });

        } catch (err) {
            console.error('Error uploading sync data:', err);
            res.status(500).json({ error: 'Failed to process sync data.', details: err.message });
        }
    }
};

module.exports = mapperController;
