
const path = require('path');
const { processDownloadedFile, login, downloadBOB } = require("./src/helpers/fandgHelpers.js");
const { loadCookies, saveCookies } = require('./src/helpers/genericHelpers.js');
const { decrypt } = require('./utils/crypto.js');
const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const USERNAME = '000392848';
const PASSWORD = 'Amadav13!!';
const PIN = '123455';
const carrier='fandg';
const downloadPath = path.resolve(__dirname,'csv/fg');

const agentId = 'ai_amanda';
module.exports = async function runFandG(job, carrierName) {
    //const browser = await puppeteer.launch({ headless: HEADLESS, defaultViewport: null });
    const agentId=job.agentId;
    const username=decrypt(job.username);
    const password=decrypt(job.password);
    console.log(job)
    console.log(carrierName);
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
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath });

    await loadCookies(page,agentId,carrier);

    await page.goto('https://saleslink.fglife.com/', { waitUntil: 'networkidle2' });
    const currentURL = page.url();

    if (currentURL === 'https://saleslink.fglife.com/home/home') {
        await saveCookies(context,agentId,carrier);
        const downloadedFile = await downloadBOB(page,downloadPath);
        await processDownloadedFile(downloadedFile,agentId,connection);
    }
    else{
        await login(page,username,password);
        await saveCookies(context,agentId,carrier);
        const downloadedFile = await downloadBOB(page,downloadPath);
        await processDownloadedFile(downloadedFile,agentId,connection);
    }
    await page.close();
}