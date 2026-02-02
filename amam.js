const { runLoggedInFunctions } = require("./functions.js");
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const XLSX = require("xlsx");

const mysql = require('mysql2');
const connection = mysql.createConnection({
  host: '127.0.0.1',
  user: 'root',
  password: '',
  database: 'policyInfo'
});

// Helper sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const HEADLESS = false;
const USERNAME = '184958';
const PASSWORD = 'Amadav13!!!';
const PIN = '123455';
const downloadPath = path.resolve(__dirname, 'csv/corebridge');
const agentId='ai_amanda'
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T','_').split('Z')[0];
}

// --- main ---
(async () => {
  const browser = await puppeteer.launch({ headless: HEADLESS, defaultViewport: null });
  const page = await browser.newPage();
  const context = browser.defaultBrowserContext();
  const client = await page.target().createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath,
  });

  // Load cookies if available
  if (fs.existsSync("amam.json")) {
    try {
      const cookies = JSON.parse(fs.readFileSync("amam.json"));
      await page.setCookie(...cookies);
      console.log("Loaded cookies.");
    } catch (err) {
      console.error("Error loading cookies:", err);
    }
  }

  // Go to login page
  await page.goto('https://www.americanamicable.com/v4/AgentLogin.php', { waitUntil: 'networkidle2' });

  // Login form
  await page.waitForSelector('input[name="user"]', { visible: true });
  await page.type('input[name="user"]', USERNAME, { delay: 120 });
  await page.type('input[name="password"]', PASSWORD, { delay: 120 });
  await page.click('input[type="submit"][value="Submit"]');
/*
  // Save cookies
  const cookies = await context.cookies();
  fs.writeFileSync("coreBridgecookies.json", JSON.stringify(cookies, null, 2));

  // Go to My Business
  await page.waitForSelector('a[href="/life/connext-bob/app/home"]', { visible: true });
  await page.click('a[href="/life/connext-bob/app/home"]');
  console.log("here")
  await sleep(4000);

  // Switch to Inforce tab
  console.log("Switching to Inforce tab...");
  await page.waitForSelector('#inforce_tabTileContent', { visible: true });
  await page.click('#inforce_tabTileContent');
  await sleep(3000);

  // Export Excel
  await exportExcel(page);

  await browser.close();*/
   
})();
