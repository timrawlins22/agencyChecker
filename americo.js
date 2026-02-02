const { runLoggedInFunctions } = require("./functions.js");

const fs = require('fs');
const puppeteer = require('puppeteer-extra');
const { loadCookies, saveCookies } = require('./src/helpers/genericHelpers.js');
const { decrypt } = require('./utils/crypto.js');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
// Helper sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const HEADLESS = false; // true = headless
const USERNAME = '675294';
const PASSWORD = 'F@1M2EL1F2J';
const PIN='123455';

module.exports = async function runCorebridge(job, carrierName) {

    const agentId=job.agentId;
    const username=decrypt(job.username);
    const password=decrypt(job.password);

    puppeteer.use(StealthPlugin());
    const carrier=carrierName;
    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.5845.96 Safari/537.36',
            '--lang=en-US,en;q=0.9',
        ],
        defaultViewport: null,
    });
    
    const page = await browser.newPage();

    const context = browser.defaultBrowserContext();

    // Load cookies if available
    let cookiesLoaded = false;
    if (fs.existsSync("cookies.json")) {
        try {
        const cookies = JSON.parse(fs.readFileSync("AmericoCookies.json"));
        await page.setCookie(...cookies);
        console.log("Loaded cookies.");
        cookiesLoaded = true;
        } catch (err) {
        console.error("Error loading cookies:", err);
        }
    }

    // Try to visit the page with cookies
    await page.goto('https://account.americoagent.com/Identity/Account/Login/?returnUrl=https%3a%2f%2fportal.americoagent.com%2f', { waitUntil: 'networkidle2' });

    let loggedIn = false;
    let allTheWay = false;
    try {
        // Adjust this selector to something that only appears when logged in
        await page.waitForSelector('#sms', { timeout: 5000 });
        loggedIn = true;
        console.log("Login successful using cookies!");
    } catch {
        console.log("Not logged in, proceeding with MFA flow...");
    }



    try {
        // Adjust this selector to something that only appears when logged in
        
        await page.waitForSelector('a[title="Certificate Details"]', { timeout: 2000 });
        allTheWay = true;
        console.log("you are in in");
    } catch {
        console.log("Not logged in, proceeding with MFA flow...");
    }






    if (!loggedIn && !allTheWay) {
         // MFA Login Flow
        console.log("i'm at that point");
        //await page.click('a[href="/"]');
        await page.waitForSelector('input[name="Input.UserName"]', { visible: true });

        // Type username
        await page.focus('input[name="Input.UserName"]');
        await page.type('input[name="Input.UserName"]', username, { delay: 120 });

        // Ensure value is fully typed
        await page.waitForFunction(
        (selector, expected) => document.querySelector(selector)?.value === expected,
        {},
        'input[name="Input.UserName"]',
        username
        );

        // Type password
        await page.focus('input[name="Input.Password"]');
        await page.type('input[name="Input.Password"]', password, { delay: 100 });

        // Submit login
        await page.click('input.btn.btn-primary.btn-block[value="Login"]');

        let thisLogged = false;
        try {
            // Adjust this selector to something that only appears when logged in
            await page.waitForSelector('#sms', { timeout: 5000 });
            thisLogged = true;
            console.log("Login successful using cookies!");
        } catch {
            console.log("Not logged in, proceeding with MFA flow...");
        }

        if(thisLogged){
            // Wait for SMS option
            await page.waitForSelector('#sms', { visible: true });
            await sleep(1000);

            // Check and click if not selected
            const isChecked = await page.$eval('#sms', el => el.checked);
            if (!isChecked) {
            await page.click('#sms');
            }
            await sleep(1000);

            // Click Send PIN
            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('button.button-primary[type="submit"]')
            ]);

            console.log("SMS option selected and PIN request sent!");

            // Enter PIN
            await page.waitForSelector('#pinTextOne', { visible: true });

            await page.type('#pinTextOne', PIN[0], { delay: 120 });
            await page.type('#pinTextTwo', PIN[1], { delay: 120 });
            await page.type('#pinTextThree', PIN[2], { delay: 120 });
            await page.type('#pinTextFour', PIN[3], { delay: 120 });
            await page.type('#pinTextFive', PIN[4], { delay: 120 });
            await page.type('#pinTextSix', PIN[5], { delay: 120 });

            await sleep(15000);

            await Promise.all([
                page.waitForNavigation({ waitUntil: 'networkidle0' }),
                page.click('button.button-primary.sendOtp')
            ]);

            console.log("PIN entered and Continue clicked!");
            const cookies = await context.cookies();
            fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
            console.log("Cookies saved!");

            await runLoggedInFunctions(sleep, page, browser, connection);
        }
        else{
            const cookies = await context.cookies();
            fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
            console.log("Cookies saved!");

            await runLoggedInFunctions(sleep, page, browser,connection);
        }


    }
    else if(loggedIn && !allTheWay){
        console.log("i'm at this point");
        await page.waitForSelector('#sms', { visible: true });
        await sleep(1000);

        // Check and click if not selected
        const isChecked = await page.$eval('#sms', el => el.checked);
        if (!isChecked) {
        await page.click('#sms');
        }
        await sleep(1000);

        // Click Send PIN
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button.button-primary[type="submit"]')
        ]);

        console.log("SMS option selected and PIN request sent!");

        // Enter PIN
        await page.waitForSelector('#pinTextOne', { visible: true });

        await page.type('#pinTextOne', PIN[0], { delay: 120 });
        await page.type('#pinTextTwo', PIN[1], { delay: 120 });
        await page.type('#pinTextThree', PIN[2], { delay: 120 });
        await page.type('#pinTextFour', PIN[3], { delay: 120 });
        await page.type('#pinTextFive', PIN[4], { delay: 120 });
        await page.type('#pinTextSix', PIN[5], { delay: 120 });

        await sleep(15000);

        await Promise.all([
            page.waitForNavigation({ waitUntil: 'networkidle0' }),
            page.click('button.button-primary.sendOtp')
        ]);

        console.log("PIN entered and Continue clicked!");

        // Save cookies after successful login
        const cookies = await context.cookies();
        fs.writeFileSync("cookies.json", JSON.stringify(cookies, null, 2));
        console.log("Cookies saved!");
        loggedIn=true;
    }
    else if(allTheWay){

        // At this point, you're logged in (either via cookies or MFA)
        const status=await runLoggedInFunctions(sleep, page, browser,connection);
        return status
    }

}
