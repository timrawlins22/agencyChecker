const XLSX = require("xlsx");
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function waitForDownload(timeout, downloadPath) {
    const start = Date.now();
    const before = fs.readdirSync(downloadPath);

    while (Date.now() - start < timeout) {
        const after = fs.readdirSync(downloadPath);
        const diff = after.filter(f => !before.includes(f));
        if (diff.length) return path.join(downloadPath, diff[0]);
        await sleep(500);
    }
    throw new Error("Download timed out");
}
async function login(page,USERNAME,PASSWORD) {
    await page.waitForSelector('input[name="UserName"]', { visible: true });
    await page.type('input[name="UserName"]', USERNAME, { delay: 120 });
    await page.click('#btnSubmit');
    await page.waitForSelector('input[name="Password"]', { visible: true });
    await page.type('input[name="Password"]', PASSWORD, { delay: 120 });
    await page.click('#btnSubmit');
    await sleep(5000);
    return true;

}
async function downloadBOB(page,downloadPath) {
    await page.goto("https://saleslink.fglife.com/BookOfBusiness/Search", { waitUntil: "networkidle2" });
    await page.waitForSelector('#btnSearch', { visible: true });
    await page.click('#btnSearch');
    await page.waitForSelector('#btnDownloadReport-BOBSearchReport', { visible: true });
    console.log("Clicking Excel download link...");
    await page.click('#btnDownloadReport-BOBSearchReport');

    const downloadedFile = await waitForDownload(timeout = 60000,downloadPath);
    return downloadedFile;
}
async function processDownloadedFile(filePath,agentId,connection) {
    const customFolder = path.join(__dirname, "../csv/temp");
    const newFileName = `${agentId}${Date.now()}.xlsx`;
    const targetDir = path.join(__dirname, "../csv/fg");

    const finalFile = await moveAndRenameFile(
        filePath,
        customFolder,
        newFileName,
        targetDir,
        connection,
        agentId,
        XLSX,
        sleep
    );
}
async function moveAndRenameFile(sourceFile, customFolder, newFileName, targetDir, connection, agentId, XLSX, sleep) {
  try {
    // Make sure custom folder exists
    if (!fs.existsSync(customFolder)) {
      fs.mkdirSync(customFolder, { recursive: true });
    }

    // Build temp file path in custom folder
    const tempPath = path.join(customFolder, newFileName);

    // Rename (or copy) file to custom folder
    fs.renameSync(sourceFile, tempPath);

    // Make sure target directory exists
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Final destination
    const finalPath = path.join(targetDir, newFileName);

    // Move to target directory
    fs.renameSync(tempPath, finalPath);
    //await insertToFandG(connection, agentId, XLSX, targetDir,newFileName);
    await sleep(2000);
    await insertToFandG(connection, agentId, XLSX, targetDir,newFileName);
  } catch (err) {
    console.error("❌ Error moving and renaming file:", err);
  }
}
async function insertToFandG(connection, agentId, XLSX, filePath, filename) {
    const thefile = path.join(filePath, filename);
    const workbook = XLSX.readFile(thefile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Find the "real" header row (Logic remains the same)
    let headerRowIndex = rows.findIndex(
        r =>
            r.some(c => c && c.toString().trim() === "Writing Agent Name") &&
            r.some(c => c && c.toString().trim() === "Policy Number")
    );

    if (headerRowIndex === -1) throw new Error("Header row not found!");

    const headers = rows[headerRowIndex];
    const dataRows = rows.slice(headerRowIndex + 1);

    // Define the date fields we want to normalize
    const dateFields = [
        "PolicyIssuedDate",
        "PolicyEffectiveDate",
        "FirstPremiumPaymentDate",
        "OwnerDOB",
        "AnnuitantInsuredDOB"
    ];

    // --- Start Iterating and Upserting ---
    for (let row of dataRows) {
        // Skip empty or purely non-numeric rows (Your existing filter logic)
        if (!row[0] || row.every(cell => cell === null || (typeof cell === "string" && !cell.match(/\d/)))) {
            continue;
        }

        let record = {};
        let updateAssignments = []; // Array to build the UPDATE clause

        headers.forEach((col, i) => {
            if (col) {
                let normalizedCol = col
                    .replace(/\//g, "")
                    .replace(/\s+/g, "")
                    .replace(/[^a-zA-Z0-9_]/g, "");

                let value = row[i] || null;

                // Date normalization (Your existing date logic)
                if (value && dateFields.includes(normalizedCol)) {
                    const formatted = moment(value, ["MM-DD-YYYY", "M-D-YYYY"], true);
                    value = formatted.isValid() ? formatted.format("YYYY-MM-DD") : null;
                }

                record[normalizedCol] = value;
                
                // Build the assignment part of the UPDATE clause dynamically
                if (normalizedCol !== 'PolicyNumber') {
                    updateAssignments.push(`\`${normalizedCol}\` = VALUES(\`${normalizedCol}\`)`);
                }
            }
        });

        const cols = Object.keys(record);
        const vals = Object.values(record);
        
        // Ensure PolicyNumber is defined in your record, as it's the key.
        if (!record.PolicyNumber) {
            console.warn(`Skipping row due to missing PolicyNumber: ${JSON.stringify(record)}`);
            continue;
        }

        const insertColumns = [`agent_id`, ...cols];
        const placeholders = [`?`, ...cols.map(() => `?`)];
        const allValues = [agentId, ...vals];
        
        // CRITICAL: Check that updateAssignments is not empty.
        // It won't be empty unless the only column is PolicyNumber (which we exclude).
        if (updateAssignments.length === 0) {
            console.warn("Skipping row: No columns to update other than PolicyNumber.");
            continue;
        }

        // --- CONSTRUCT THE UPSERT SQL ---
        const sql = `
            INSERT INTO policies_fandg (\`${insertColumns.join("`,`")}\`) 
            VALUES (${placeholders.join(",")})
            ON DUPLICATE KEY UPDATE
            ${updateAssignments.join(",\n")}
        `;
        
        try {
            // Execute the promise-based query
            await connection.execute(sql, allValues);
            await insertUnifiedPolicy(connection, agentId, record);
        } catch (error) {
            console.error(`F&G DB Insert/Update error for Policy ${record.PolicyNumber}:`, error.message);
            // Optionally, log the specific row values that failed
            // console.error("Failing values:", allValues);
            // Re-throw if you want the entire job to fail on a single bad row
            // throw error; 
        }
    }
    console.log("F&G data processed and inserted/updated successfully.");
}
async function insertUnifiedPolicy(connection, agentId, record) {
    
    // --- Data Mapping and Preparation ---
    
    // Use the safeValue helper (assumed to be available/imported)
    const safeValue = (val) => {
        if (val === "" || val === undefined || val === null) return null;
        if (typeof val === 'number' && isNaN(val)) return null;
        return val;
    };
    
    // F&G field names mapped to unified_policies column names
    const unifiedValues = [
        safeValue(record.PolicyNumber),             // policy_number (UNIQUE KEY)
        'FandG',                                    // carrier
        agentId,                                    // agent_id
        safeValue(record.PolicyStatus),             // policy_status
        safeValue(record.ProductType),              // product_type
        safeValue(record.ProductName),              // product_name
        safeValue(record.OwnerName),                // insured_name (Using OwnerName as best available person)
        safeValue(record.OwnerDOB),                 // insured_birth
        safeValue(record.OwnerName),                // owner_name
        safeValue(record.FaceAmount),               // policy_face_amount
        safeValue(record.AnnualPremium),            // premium (Assuming AnnualPremium is a key premium figure)
        safeValue(record.BillingMode),              // billing_frequency (Using BillingMode as frequency)
        safeValue(record.PolicyIssuedDate),         // date_of_issue
        safeValue(record.PolicyEffectiveDate),      // effective_date
        safeValue(record.PolicyTerm)                // term_duration (Assuming PolicyTerm exists)
    ];

    // --- SQL Construction ---
    const unifiedSql = `
        INSERT INTO unified_policies (
            policy_number, carrier, agent_id, policy_status, product_type,
            product_name, insured_name, insured_birth, owner_name,
            policy_face_amount, premium, billing_frequency, date_of_issue,
            effective_date, term_duration
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            carrier = VALUES(carrier),
            agent_id = VALUES(agent_id),
            policy_status = VALUES(policy_status),
            product_type = VALUES(product_type),
            product_name = VALUES(product_name),
            insured_name = VALUES(insured_name),
            insured_birth = VALUES(insured_birth),
            owner_name = VALUES(owner_name),
            policy_face_amount = VALUES(policy_face_amount),
            premium = VALUES(premium),
            billing_frequency = VALUES(billing_frequency),
            date_of_issue = VALUES(date_of_issue),
            effective_date = VALUES(effective_date),
            term_duration = VALUES(term_duration)
    `;

    // --- Execution ---
    try {
        await connection.execute(unifiedSql, unifiedValues);
        // console.log(`Unified record processed for Policy: ${record.PolicyNumber}`); // Optional verbose logging
    } catch (error) {
        console.error(`Unified DB error for F&G Policy ${record.PolicyNumber}:`, error.message);
        // Re-throw to halt the loop in the calling function if a unified policy fails
        throw error; 
    }
}
module.exports = {
    waitForDownload,
    login,
    downloadBOB,
    processDownloadedFile
};