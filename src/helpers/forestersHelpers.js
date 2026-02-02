const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const moment = require('moment');

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
async function checkLogin(page) {
    try {
        await page.waitForSelector('#sms', { timeout: 500 });
        return { loggedIn: true, allTheWay: false };
    } catch {}

    try {
        await page.waitForSelector('a[title="Certificate Details"]', { timeout: 500 });
        return { loggedIn: true, allTheWay: true };
    } catch {}
    

    return { loggedIn: false, allTheWay: false };
}
async function runLoggedInFunctions(sleep, page, browser, connection, agentId) {
    const [newPage] = await Promise.all([
        new Promise(resolve => browser.once('targetcreated', target => resolve(target.page()))),
        page.click('a[title="Certificate Details"]') // click the link
    ]);
    await newPage.bringToFront();
    console.log("bringing tab into view");
    
    //await newPage.waitForNetworkIdle();
    await newPage.waitForNetworkIdle({
        timeout: 80000, // 60 seconds
       // idleTime: 500   // optional: wait 500ms after last request
    });
    console.log("File Loaded");
    await newPage.setViewport({ width: 1880, height: 800 });
    //await newPage.evaluate(() => window.scrollBy(0, document.body.scrollHeight));
    //await newPage.waitForNavigation({ waitUntil: 'networkidle0' });

    const downloadPath = path.resolve(__dirname, '../csv/foresters');

    // Make sure the folder exists, create if not
    if (!fs.existsSync(downloadPath)) {
        fs.mkdirSync(downloadPath);
    } 
    await newPage._client().send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: downloadPath,
    });
    function waitForNewFile(folder, existingFiles = [], timeout = 80000) {
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
    
    const existingFiles = fs.readdirSync(downloadPath);
    await newPage.waitForSelector('button.btn.btn-secondary', { visible: true });
    await sleep(2000);
    await newPage.click('button.btn.btn-secondary');
    console.log("CSV export button clicked!");
    await sleep(15000);
    
    // Wait for the new file
    const downloadedFile = await waitForNewFile(downloadPath, existingFiles);

    // Rename it
    const now = new Date();
    const timestamp = now.toISOString().replace(/:/g, '-').replace('T', '_').split('.')[0];
    const newFileName = `adluckie_${timestamp}.csv`;
    const oldPath = path.join(downloadPath, downloadedFile);
    const newPath = path.join(downloadPath, newFileName);

    fs.renameSync(oldPath, newPath);


    fs.createReadStream(newPath)
    .pipe(csv())
    .on('data', (row) => {
        // Insert into MySQL
        const safeValue = (val) => (val === "" || val === undefined ? null : val);

        const sql = `
        INSERT INTO foresters_certificates (
            agent_id, CertificateNbr, ActionNeeded, FirstName, LastName, Addr1, Addr2, Addr3,
            City, State, ZIP, HomePhone, BirthDt, Email, PreferredContact,
            NoPhone, NoEmail, NoMail, Status, PlanDescription, ProductCategory,
            AppSignedDate, EffectiveDate, RatingClass, SmokerClass, MEC, NFO,
            DividendOption, CoverageType, PaidToDate, BaseModalPremium, BasePayMethod,
            BaseMode, PUARmodalPayAmount, PUARpayMethod, PUARpayMode, PDFmodalPayAmount,
            PDFpayMethod, PDFpayMode, FaceAmount, PremiumTermination, CoverageTermination,
            ApprovedAnnualFlexiblePUAR, ProducerCode, ProducerFirstName, ProducerLastName,
            NextDraftDateId, NextAnniversaryDateId, PaymentMethod
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            agent_id = VALUES(agent_id),
            ActionNeeded = VALUES(ActionNeeded),
            FirstName = VALUES(FirstName),
            LastName = VALUES(LastName),
            Addr1 = VALUES(Addr1),
            Addr2 = VALUES(Addr2),
            Addr3 = VALUES(Addr3),
            City = VALUES(City),
            State = VALUES(State),
            ZIP = VALUES(ZIP),
            HomePhone = VALUES(HomePhone),
            BirthDt = VALUES(BirthDt),
            Email = VALUES(Email),
            PreferredContact = VALUES(PreferredContact),
            NoPhone = VALUES(NoPhone),
            NoEmail = VALUES(NoEmail),
            NoMail = VALUES(NoMail),
            Status = VALUES(Status),
            PlanDescription = VALUES(PlanDescription),
            ProductCategory = VALUES(ProductCategory),
            AppSignedDate = VALUES(AppSignedDate),
            EffectiveDate = VALUES(EffectiveDate),
            RatingClass = VALUES(RatingClass),
            SmokerClass = VALUES(SmokerClass),
            MEC = VALUES(MEC),
            NFO = VALUES(NFO),
            DividendOption = VALUES(DividendOption),
            CoverageType = VALUES(CoverageType),
            PaidToDate = VALUES(PaidToDate),
            BaseModalPremium = VALUES(BaseModalPremium),
            BasePayMethod = VALUES(BasePayMethod),
            BaseMode = VALUES(BaseMode),
            PUARmodalPayAmount = VALUES(PUARmodalPayAmount),
            PUARpayMethod = VALUES(PUARpayMethod),
            PUARpayMode = VALUES(PUARpayMode),
            PDFmodalPayAmount = VALUES(PDFmodalPayAmount),
            PDFpayMethod = VALUES(PDFpayMethod),
            PDFpayMode = VALUES(PDFpayMode),
            FaceAmount = VALUES(FaceAmount),
            PremiumTermination = VALUES(PremiumTermination),
            CoverageTermination = VALUES(CoverageTermination),
            ApprovedAnnualFlexiblePUAR = VALUES(ApprovedAnnualFlexiblePUAR),
            ProducerCode = VALUES(ProducerCode),
            ProducerFirstName = VALUES(ProducerFirstName),
            ProducerLastName = VALUES(ProducerLastName),
            NextDraftDateId = VALUES(NextDraftDateId),
            NextAnniversaryDateId = VALUES(NextAnniversaryDateId),
            PaymentMethod = VALUES(PaymentMethod)
    `;

        const values = [
            safeValue(agentId), // agent_id
            safeValue(parseInt(row.CertificateNbr)),
            safeValue(row.ActionNeeded),
            safeValue(row.FirstName),
            safeValue(row.LastName),
            safeValue(row.Addr1),
            safeValue(row.Addr2),
            safeValue(row.Addr3),
            safeValue(row.City),
            safeValue(row.State),
            safeValue(parseInt(row.ZIP)),
            safeValue(row.HomePhone),
            safeValue(formatDateForMySQL(row.BirthDt)),
            safeValue(row.Email),
            safeValue(row.PreferredContact),
            safeValue(row.NoPhone),
            safeValue(row.NoEmail),
            safeValue(row.NoMail),
            safeValue(row.Status),
            safeValue(row.PlanDescription),
            safeValue(row.ProductCategory),
            safeValue(parseAppsignedDate(row.AppSignedDate)),
            safeValue(formatDateForMySQL(row.EffectiveDate)),
            safeValue(row.RatingClass),
            safeValue(row.SmokerClass),
            safeValue(row.MEC),
            safeValue(row.NFO),
            safeValue(row.DividendOption),
            safeValue(row.CoverageType),
            safeValue(formatDateForMySQL(row.PaidToDate)),
            safeValue(parseFloat(row.BaseModalPremium)),
            safeValue(row.BasePayMethod),
            safeValue(row.BaseMode),
            safeValue(row.PUARmodalPayAmount),
            safeValue(row.PUARpayMethod),
            safeValue(row.PUARpayMode),
            safeValue(row.PDFmodalPayAmount),
            safeValue(row.PDFpayMethod),
            safeValue(row.PDFpayMode),
            safeValue(parseInt(row.FaceAmount)),
            safeValue(formatDateForMySQL(row.PremiumTermination)),
            safeValue(formatDateForMySQL(row.CoverageTermination)),
            safeValue(row.ApprovedAnnualFlexiblePUAR),
            safeValue(parseInt(row.ProducerCode)),
            safeValue(row.ProducerFirstName),
            safeValue(row.ProducerLastName),
            safeValue(parseAppsignedDate(row.NextDraftDateId)),
            safeValue(parseAppsignedDate(row.NextAnniversaryDateId)),
            safeValue(row.PaymentMethod)
        ];

        connection.execute(sql, values, (err) => {
        if (err) console.error('Error inserting row:', err);
        });
    })
    .on('end', () => {

    });
    await page.close();
}
async function performLogin(page,USERNAME,PASSWORD) {
    await page.waitForSelector('input[name="username"]', { visible: true });

    await page.type('input[name="username"]', USERNAME, { delay: 120 });
    await page.type('input[name="password"]', PASSWORD, { delay: 100 });
    await Promise.all([
        page.click('input.btn.btn-primary.btn-block[value="Login"]'),
        page.waitForNavigation({ waitUntil: 'networkidle0' }) // or 'domcontentloaded'
    ]);

}
async function performMFA(page,sleep,USERNAME,PASSWORD,PIN) {

    let isChecked=false;

    try {
    // Try to find the element within a timeout
    const smsElement = await page.waitForSelector('#sms', { visible: true, timeout: 3000 });

    if (smsElement) {
        // Optional: wait for it to be visible
        await page.waitForSelector('#sms', { visible: true, timeout: 3000 });
        //await page.waitForTimeout(1000);

        isChecked = await page.$eval('#sms', el => el.checked);

    } else {
        console.log("No #sms element found, skipping...");
    }

    } catch (err) {
        console.log("Element not found or not visible, skipping...");
    }











   // await page.waitForSelector('#sms', { visible: true });
    //await sleep(1000);

   // const isChecked = await page.$eval('#sms', el => el.checked);
    if (!isChecked){
        await page.click('#sms')
        await sleep(1000);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button.button-primary[type="submit"]')
        ]);

        console.log("SMS option selected and PIN request sent!");

        // Enter PIN
        for (let i = 0; i < PIN.length; i++) {
            await page.type(`#pinText${['One','Two','Three','Four','Five','Six'][i]}`, PIN[i], { delay: 120 });
        }

        await sleep(15000);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button.button-primary.sendOtp')
        ]);

        console.log("PIN entered and Continue clicked!");
    }
}


module.exports = {
    performMFA,
    performLogin,
    checkLogin,
    runLoggedInFunctions
};