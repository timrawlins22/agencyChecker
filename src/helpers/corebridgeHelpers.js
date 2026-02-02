const fs = require('fs');
const XLSX = require("xlsx");
const pool = require('../config/db');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const { handleLapseAlert } = require('./insertAlert');
async function login(USERNAME,PASSWORD,page){
    await page.waitForSelector('input[name="username"]', { visible: true });
    await page.type('input[name="username"]', USERNAME, { delay: 120 });
    await page.type('input[name="password"]', PASSWORD, { delay: 120 });
    await page.click('#btnSubmit');
}
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T','_').split('Z')[0];
}
async function processXlsxAndInsert(filePath, agentId) {
	let connection;

	try {
		connection = await pool.getConnection();
		// Read the file
		const workbook = XLSX.readFile(filePath);

		// Pick the first sheet
		const sheetName = workbook.SheetNames[0];

		const sheet = workbook.Sheets[sheetName];
		
		// Convert sheet to JSON
		const rows = XLSX.utils.sheet_to_json(sheet);

		// Insert into both corebridge_policies and unified_policies
		for (const row of rows) {
		// 1. Prepare values for corebridge_policies table
			const corebridgeValues = [
				agentId,
				row['Writing/Servicing Agent'] || null,
				row['Agent Number'] || null,
				row['Agency Number'] || null,
				row['Policy Number'] || null,
				row['Product Name'] || null,
				row['Insured Name'] || null,
				row['Insured Birth'] ? new Date(row['Insured Birth']) : null,
				row['Owner Name'] || null,
				row['Face Amount'] || null,
				row['Premium'] || null,
				row['Billable Premium'] || null,
				row['Billing Frequency'] || null,
				row['Billing Method'] || null,
				row['Policy Status'] || null,
				row['Product Type'] || null,
				row['Premium Due Date'] ? new Date(row['Premium Due Date']) : null,
				row['Date of Issue '] ? new Date(row['Date of Issue ']) : null,
				row['Effective Date'] ? new Date(row['Effective Date']) : null,
				row['Term Duration'] || null
			];

			// SQL query for corebridge_policies (original table)
			const corebridgeSql = `
				INSERT INTO corebridge_policies (
				agent_id, writing_servicing_agent, agent_number, agency_number, policy_number,
				product_name, insured_name, insured_birth, owner_name,
				face_amount, premium, billable_premium, billing_frequency,
				billing_method, policy_status, product_type, premium_due_date,
				date_of_issue, effective_date, term_duration
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE
				agent_id = VALUES(agent_id),
				writing_servicing_agent = VALUES(writing_servicing_agent),
				agent_number = VALUES(agent_number),
				agency_number = VALUES(agency_number),
				product_name = VALUES(product_name),
				insured_name = VALUES(insured_name),
				insured_birth = VALUES(insured_birth),
				owner_name = VALUES(owner_name),
				face_amount = VALUES(face_amount),
				premium = VALUES(premium),
				billable_premium = VALUES(billable_premium),
				billing_frequency = VALUES(billing_frequency),
				billing_method = VALUES(billing_method),
				policy_status = VALUES(policy_status),
				product_type = VALUES(product_type),
				premium_due_date = VALUES(premium_due_date),
				date_of_issue = VALUES(date_of_issue),
				effective_date = VALUES(effective_date),
				term_duration = VALUES(term_duration)
			`;
			
			// Execute the query for the Corebridge table
			try {
				// 1. Corebridge Insert
				await connection.execute(corebridgeSql, corebridgeValues);


				const policyNumber = row['Policy Number'] || null;
				const policyStatus = row['Policy Status'] || null;
				console.log(policyStatus);
				const effectiveDate = row['Effective Date'] ? new Date(row['Effective Date']) : null;
				// 2. Prepare values for unified_policies table
				const unifiedValues = [
					policyNumber, // policy_number
					'Corebridge',                  // carrier
					agentId,                       // agent_id
					policyStatus,  // policy_status
					row['Product Type'] || null,   // product_type
					row['Product Name'] || null,   // product_name
					row['Insured Name'] || null,   // insured_name
					row['Insured Birth'] ? new Date(row['Insured Birth']) : null, // insured_birth
					row['Owner Name'] || null,     // owner_name
					row['Face Amount'] || null,    // policy_face_amount
					row['Premium'] || null,        // premium
					row['Billing Frequency'] || null, // billing_frequency
					row['Date of Issue '] ? new Date(row['Date of Issue ']) : null, // date_of_issue
					effectiveDate, // effective_date
					row['Term Duration'] || null   // term_duration
				];
				
				// SQL query for unified_policies (new table)
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
				//console.log("herro")
				await connection.execute(unifiedSql, unifiedValues);

				// Execute the query for the unified table
				console.log(policyNumber);
				if (policyNumber && policyStatus) {
					console.log("I AM HERE")
					await handleLapseAlert(policyNumber, policyStatus, connection);
				}
				
			} catch (err) {
				// Crucial: Log the specific database error and re-throw
				console.error("Database operation failed for a row:", err);
				throw err; // Re-throw to be caught by the main try...catch and stop execution
			}

			
		}
		console.log("Corebridge data processed and inserted into both tables successfully.");

	} catch (err) {
		console.error("Error processing XLSX:", err);
	}
}

async function navigateToInforce(page){
    await page.waitForSelector('a[href="/life/connext-bob/app/home"]', { visible: true });
    //await page.click('a[href="/life/connext-bob/app/home"]');
    await sleep(4000);
    await page.setViewport({ width: 1880, height: 800 });
    // Switch to Inforce tab
    console.log("Switching to Inforce tab...");
    //await page.waitForSelector('#inforce_tabTileContent', { visible: true });

    await page.waitForSelector('#inforce_tabTileContent', { 
      visible: true, 
      timeout: 60000 // 60 seconds
  });
    await page.click('#inforce_tabTileContent');
    await sleep(3000);
}
async function exportExcel(page,downloadPath,agentId,path) {
    await page.waitForSelector('#divExport button.dropdown-toggle', { visible: true });
    await page.click('#divExport button.dropdown-toggle');
    
    await sleep(2000);

    const excelButton = await page.evaluateHandle(() => {
        return Array.from(document.querySelectorAll('a'))
        .find(a => a.innerText.includes('Excel'));
    });
    await excelButton.click();
    console.log("download clicked");
    console.log('intercepting file')
    // detect file
	
    const before = fs.readdirSync(downloadPath);

    const fileName = await waitForDownloadComplete(downloadPath, before, agentId, path);

    return fileName;
}
async function waitForDownloadComplete(downloadDir, before, agentId, path, {
  timeout = 60000, poll = 500, stableMillis = 1500
} = {}) {
  const start = Date.now();
  const known = new Set(before);
  while (Date.now() - start < timeout) {
    const files = fs.readdirSync(downloadDir);

    const newOnes = files.filter(f => !known.has(f) && !f.endsWith('.crdownload'));

    if (newOnes.length > 0) {
      const found = newOnes[0];
      const full = path.join(downloadDir, found);

      // ✅ wait until file size stops growing
      let lastSize = -1;
      let stableSince = null;
      while (Date.now() - start < timeout) {
        const { size } = fs.statSync(full);
        if (size === lastSize) {
          if (stableSince == null) stableSince = Date.now();
          if (Date.now() - stableSince >= stableMillis) {
            // rename with timestamp
            const ext = path.extname(found) || '.xlsx';
            const newName = `${agentId}${timestamp()}${ext}`;
            const newPath = path.join(downloadDir, newName);
            fs.renameSync(full, newPath);

            //const downloadPath = "/path/to/downloads";
            //const filename = "report.xlsx"; // from your waitForDownload()
            await processXlsxAndInsert(path.join(downloadDir, newName),agentId);
            return newName;
          }
        } else {
          lastSize = size;
          stableSince = null;
        }
        await sleep(poll);
      }
    }
    await sleep(poll);
  }
  throw new Error("Download timed out");
}
module.exports = {
    processXlsxAndInsert,
    navigateToInforce,
    login,
    exportExcel
};