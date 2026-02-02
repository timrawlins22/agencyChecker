const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T','_').split('Z')[0];
}
const safeValue = (val) => {
    if (val === "" || val === undefined || val === null) return null;
    // Special check for NaN after parseInt/parseFloat operations
    if (typeof val === 'number' && isNaN(val)) return null;
    return val;
};
function formatDateForMySQL(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;

    // Try parsing different formats
    let m;
    if (/^\d{8}$/.test(dateStr)) {
        // YYYYMMDD format
        m = moment(dateStr, 'YYYYMMDD');
    } else {
        // Try common slashed format
        m = moment(dateStr, ['M/D/YYYY', 'MM/DD/YYYY', 'M/D/YY', 'MM/DD/YY'], true);
    }

    // Check if valid
    if (!m.isValid()) return null;

    return m.format('YYYY-MM-DD');
}
function parseAppsignedDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;

    // Handle the YYYYMMDD format
    const m = moment(dateStr, 'YYYYMMDD', true); // strict parsing

    if (!m.isValid()) return null;

    return m.format('YYYY-MM-DD');
}
function readCsvStream(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', (error) => reject(error));
    });
}
async function processForestersData(filePath, agentId, connection) {
    let finalStatus = 'SUCCESS';

    try {
        // 1. Await the stream reading to get all rows
        const rows = await readCsvStream(filePath);
        console.log(`Foresters: Starting insertion of ${rows.length} rows.`);

        // 2. Process and insert each row sequentially
        for (const row of rows) {
            
            // --- DATA PREPARATION ---
            // Extract and clean key fields once
            const certificateNbr = safeValue(row.CertificateNbr);
            const status = safeValue(row.Status);
            const effectiveDate = formatDateForMySQL(row.EffectiveDate);
            const birthDt = formatDateForMySQL(row.BirthDt);
            const appSignedDate = parseAppsignedDate(row.AppSignedDate);
            const faceAmount = safeValue(parseInt(row.FaceAmount));
            const premium = safeValue(parseFloat(row.BaseModalPremium));
            const billingFrequency = safeValue(row.BaseMode); // Mapping Mode to Frequency

            // --- 2a. INSERT INTO foresters_certificates ---
            const forestersValues = [
                // 1-5
                agentId,
                certificateNbr, 
                safeValue(row.ActionNeeded),
                safeValue(row.FirstName),
                safeValue(row.LastName),
                // 6-10
                safeValue(row.Addr1),
                safeValue(row.Addr2),
                safeValue(row.Addr3),
                safeValue(row.City),
                safeValue(row.State),
                // 11-15
                safeValue(parseInt(row.ZIP)),
                safeValue(row.HomePhone),
                birthDt,
                safeValue(row.Email),
                safeValue(row.PreferredContact),
                // 16-20
                safeValue(row.NoPhone),
                safeValue(row.NoEmail),
                safeValue(row.NoMail),
                status,
                safeValue(row.PlanDescription),
                // 21-25
                safeValue(row.ProductCategory),
                appSignedDate,
                effectiveDate,
                safeValue(row.RatingClass),
                safeValue(row.SmokerClass),
                // 26-30
                safeValue(row.MEC),
                safeValue(row.NFO),
                safeValue(row.DividendOption),
                safeValue(row.CoverageType),
                safeValue(formatDateForMySQL(row.PaidToDate)),
                // 31-35
                premium,
                safeValue(row.BasePayMethod),
                safeValue(row.BaseMode),
                safeValue(row.PUARmodalPayAmount),
                safeValue(row.PUARpayMethod),
                // 36-40
                safeValue(row.PUARpayMode),
                safeValue(row.PDFmodalPayAmount),
                safeValue(row.PDFpayMethod),
                safeValue(row.PDFpayMode),
                faceAmount,
                // 41-45
                safeValue(formatDateForMySQL(row.PremiumTermination)),
                safeValue(formatDateForMySQL(row.CoverageTermination)),
                safeValue(row.ApprovedAnnualFlexiblePUAR),
                safeValue(parseInt(row.ProducerCode)),
                safeValue(row.ProducerFirstName),
                // 46-49
                safeValue(row.ProducerLastName),
                safeValue(parseAppsignedDate(row.NextDraftDateId)),
                safeValue(parseAppsignedDate(row.NextAnniversaryDateId)),
                safeValue(row.PaymentMethod)
            ];

            const forestersSql = `
                INSERT INTO foresters_certificates (
                    agent_id, CertificateNbr, ActionNeeded, FirstName, LastName, Addr1, Addr2, Addr3,
                    City, State, ZIP, HomePhone, BirthDt, Email, PreferredContact, NoPhone, NoEmail, NoMail, Status, PlanDescription, 
                    ProductCategory, AppSignedDate, EffectiveDate, RatingClass, SmokerClass, MEC, NFO, DividendOption, CoverageType, PaidToDate, 
                    BaseModalPremium, BasePayMethod, BaseMode, PUARmodalPayAmount, PUARpayMethod, PUARpayMode, PDFmodalPayAmount, PDFpayMethod, 
                    PDFpayMode, FaceAmount, PremiumTermination, CoverageTermination, ApprovedAnnualFlexiblePUAR, ProducerCode, ProducerFirstName, 
                    ProducerLastName, NextDraftDateId, NextAnniversaryDateId, PaymentMethod
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    ActionNeeded = VALUES(ActionNeeded), FirstName = VALUES(FirstName), LastName = VALUES(LastName), 
                    Addr1 = VALUES(Addr1), Addr2 = VALUES(Addr2), Addr3 = VALUES(Addr3), City = VALUES(City), State = VALUES(State), 
                    ZIP = VALUES(ZIP), HomePhone = VALUES(HomePhone), BirthDt = VALUES(BirthDt), Email = VALUES(Email), 
                    PreferredContact = VALUES(PreferredContact), NoPhone = VALUES(NoPhone), NoEmail = VALUES(NoEmail), NoMail = VALUES(NoMail), 
                    Status = VALUES(Status), PlanDescription = VALUES(PlanDescription), ProductCategory = VALUES(ProductCategory), 
                    AppSignedDate = VALUES(AppSignedDate), EffectiveDate = VALUES(EffectiveDate), RatingClass = VALUES(RatingClass), 
                    SmokerClass = VALUES(SmokerClass), MEC = VALUES(MEC), NFO = VALUES(NFO), DividendOption = VALUES(DividendOption), 
                    CoverageType = VALUES(CoverageType), PaidToDate = VALUES(PaidToDate), BaseModalPremium = VALUES(BaseModalPremium), 
                    BasePayMethod = VALUES(BasePayMethod), BaseMode = VALUES(BaseMode), PUARmodalPayAmount = VALUES(PUARmodalPayAmount), 
                    PUARpayMethod = VALUES(PUARpayMethod), PUARpayMode = VALUES(PUARpayMode), PDFmodalPayAmount = VALUES(PDFmodalPayAmount), 
                    PDFpayMethod = VALUES(PDFpayMethod), PDFpayMode = VALUES(PDFpayMode), FaceAmount = VALUES(FaceAmount), 
                    PremiumTermination = VALUES(PremiumTermination), CoverageTermination = VALUES(CoverageTermination), 
                    ApprovedAnnualFlexiblePUAR = VALUES(ApprovedAnnualFlexiblePUAR), ProducerCode = VALUES(ProducerCode), 
                    ProducerFirstName = VALUES(ProducerFirstName), ProducerLastName = VALUES(ProducerLastName), 
                    NextDraftDateId = VALUES(NextDraftDateId), NextAnniversaryDateId = VALUES(NextAnniversaryDateId), 
                    PaymentMethod = VALUES(PaymentMethod)
            `;
            
            await connection.execute(forestersSql, forestersValues);
            
            // --- 2b. INSERT INTO unified_policies ---
            const unifiedValues = [
                certificateNbr,
                'Foresters',
                agentId,
                status,
                safeValue(row.ProductCategory), 
                safeValue(row.PlanDescription), 
                safeValue(`${row.FirstName} ${row.LastName}`),
                birthDt,
                null, // Owner Name: Not available in this dataset
                faceAmount,
                premium,
                billingFrequency,
                appSignedDate, 
                effectiveDate,
                null // Term Duration: Not available in this dataset
            ];
            
            const unifiedSql = `
                INSERT INTO unified_policies (
                    policy_number, carrier, agent_id, policy_status, product_type,
                    product_name, insured_name, insured_birth, owner_name,
                    policy_face_amount, premium, billing_frequency, date_of_issue,
                    effective_date, term_duration
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                    carrier = VALUES(carrier), agent_id = VALUES(agent_id), 
                    policy_status = VALUES(policy_status), product_type = VALUES(product_type),
                    product_name = VALUES(product_name), insured_name = VALUES(insured_name), 
                    insured_birth = VALUES(insured_birth), owner_name = VALUES(owner_name),
                    policy_face_amount = VALUES(policy_face_amount), premium = VALUES(premium), 
                    billing_frequency = VALUES(billing_frequency), date_of_issue = VALUES(date_of_issue),
                    effective_date = VALUES(effective_date), term_duration = VALUES(term_duration)
            `;
            
            await connection.execute(unifiedSql, unifiedValues);
            
            // 3. Handle alert (Uncomment and ensure it's imported if needed)
            // if (certificateNbr && status) {
            //     await handleLapseAlert(certificateNbr, status, connection); 
            // }
        }
        console.log("Foresters data processed and inserted successfully.");

    } catch (error) {
        console.error(`FATAL ERROR processing Foresters data:`, error);
        finalStatus = 'FAILED';
        // Re-throw the error to be caught by the outer runner function
        throw error; 
    }
    
    return finalStatus;
}
async function runLoggedInFunctions(sleep, page, browser, connection, agentId) {
    console.log("Ready for post-login automation!");
    const [newPage] = await Promise.all([
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        page.click('a[title="Certificate Details"]') // click the link
    ]);
    console.log("opened")
    await newPage.bringToFront();
    console.log("brought to front");
    await sleep(15000)
    //await newPage.waitForNavigation({ waitUntil: 'networkidle0' });

    console.log("New tab loaded!");
    const downloadPath = path.resolve(__dirname, 'csv');

    // Make sure the folder exists, create if not
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath);
        console.log(`Created download folder at ${downloadPath}`);
    } else {
        console.log(`Download folder already exists at ${downloadPath}`);
    }
    await sleep(2000);
    await newPage._client().send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
    });
    function waitForNewFile(folder, existingFiles = [], timeout = 15000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const interval = setInterval(() => {
                const files = fs.readdirSync(folder);
                const newFiles = files.filter(f => !existingFiles.includes(f) && !f.endsWith('.crdownload'));
                if (newFiles.length > 0) {
                    clearInterval(interval);
                    resolve(newFiles[0]);
                } else if (Date.now() - start > timeout) {
                    clearInterval(interval);
                    reject(new Error('Download timed out'));
                }
            }, 500);
        });
    }
    await sleep(2000)
    const existingFiles = fs.readdirSync(downloadPath);
    await newPage.waitForSelector('button.btn.btn-secondary', { visible: true });
    await newPage.click('button.btn.btn-secondary');
    console.log("CSV export button clicked!");
    await sleep(15000);
    
    // Wait for the new file
    const downloadedFile = await waitForNewFile(downloadPath, existingFiles);

    console.log("Downloaded file detected:", downloadedFile);
    // Rename it
    const now = new Date();
    const timestamp = now.toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];
    const newFileName = `adluckie_${timestamp}.csv`;
    const oldPath = path.join(downloadPath, downloadedFile);
    const newPath = path.join(downloadPath, newFileName);

    fs.renameSync(oldPath, newPath);
    console.log(`CSV saved as ${newPath}`);
    //await processForestersData(filePath, agentId, connection);
    try {
        // Pass the final file path, Agent ID, and the active DB connection
        const insertStatus = await processForestersData(newPath, agentId, connection);
        console.log(`Data insertion status: ${insertStatus}`);
    } catch (dbError) {
        console.error("Foresters job failed during data insertion step.", dbError);
        // Handle failure if needed
    }
    await browser.close();
}
const formatDate = (dateStr) => {
  return moment(dateStr, "MM-DD-YYYY").format("YYYY-MM-DD");
};
async function insertToFandG(connection, agentId, XLSX, filePath, filename) {
    const thefile = path.join(filePath, filename);
    const workbook = XLSX.readFile(thefile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

    // Find the "real" header row by checking for multiple known columns
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

    for (let row of dataRows) {
        if (!row[0]) continue;

        if (row.every(cell => cell === null || (typeof cell === "string" && !cell.match(/\d/)))) {
            continue;
        }

        let record = {};
        headers.forEach((col, i) => {
            if (col) {
                let normalizedCol = col
                    .replace(/\//g, "")
                    .replace(/\s+/g, "")
                    .replace(/[^a-zA-Z0-9_]/g, "");

                let value = row[i] || null;

                // If it's one of our known date fields, reformat
                if (value && dateFields.includes(normalizedCol)) {
                    const formatted = moment(value, ["MM-DD-YYYY", "M-D-YYYY"], true);
                    value = formatted.isValid() ? formatted.format("YYYY-MM-DD") : null;
                }

                record[normalizedCol] = value;
            }
        });

        const cols = Object.keys(record);
        const vals = Object.values(record);

        const sql = `INSERT INTO policies_fandg (\`agent_id\`,${cols.join(",")}) VALUES (?,${cols.map(() => "?").join(",")})`;
        await connection.execute(sql, [agentId, ...vals]);
    }

    console.log("Import complete!");
    await connection.end();
}

async function exportExcel(downloadPath, agentID, sleep) {
    // detect file
    console.log(downloadPath)
    const before = fs.readdirSync(downloadPath);
    console.log(before);
    const fileName = await waitForDownloadComplete(downloadPath, before, agentID, sleep);
    console.log("✅ Downloaded & renamed:", fileName);
    return fileName;
}


async function waitForDownloadComplete(downloadDir, before, agentID, sleep, {
  timeout = 60000, poll = 500, stableMillis = 1500
    } = {}) {
        console.log()
    const start = Date.now();
    const known = new Set(before);

    while (Date.now() - start < timeout) {
        const files = fs.readdirSync(downloadDir);
        const newOnes = files.filter(f => !known.has(f) && !before.includes(f));

        if (newOnes.length > 0) {
        const found = newOnes[0];
        const full = path.join(downloadDir, found);
            console.log(full);
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
                const newName = `${agentID}${timestamp()}${ext}`;
                const newPath = path.join(downloadDir, newName);
                fs.renameSync(full, newPath);
                //const downloadPath = "/path/to/downloads";
                //const filename = "report.xlsx"; // from your waitForDownload()
                path.join(downloadPath, newName);
                //await processXlsxAndInsert(path.join(downloadPath, newName), agentID);
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


async function moveAndRenameFile(sourceFile, customFolder, newFileName, targetDir, connection, agentId, XLSX, sleep) {
  try {
    console.log("Staerting");
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
    console.log(`✅ File moved & renamed to: ${finalPath}`);
    await sleep(2000);
    await insertToFandG(connection, agentId, XLSX, targetDir,newFileName);
  } catch (err) {
    console.error("❌ Error moving and renaming file:", err);
  }
}

module.exports = {
    insertToFandG,
    moveAndRenameFile,
    formatDateForMySQL,
    parseAppsignedDate,
    runLoggedInFunctions,
    exportExcel
};