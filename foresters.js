const {     
    performMFA,
    checkLogin,
    runLoggedInFunctions, 
    performLogin
} = require("./src/helpers/forestersHelpers.js");
const {     
    saveCookies,
    loadCookies
} = require("./src/helpers/genericHelpers.js");

// Helper sleep function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const USERNAME = '675294';
const PASSWORD = 'F@1M2EL1F2J';
const PIN='409413';
const agentId='ai_amanada';
const carrier='foresters';

module.exports = async function runForesters(browser, connection) {
   // const browser = await puppeteer.launch({ headless: HEADLESS, defaultViewport: null });
    const page = await browser.newPage();
    const context = browser.defaultBrowserContext();
    console.log("foresters starting");
    await loadCookies(page,agentId,carrier);
    await page.goto('https://myezbiz.foresters.com/my.policy', { waitUntil: 'networkidle2' });
    const currentURL = page.url();
    if (currentURL.includes("https://myezbiz.foresters.com/my.logout.php")) {
        await page.click('a[href="/"]');
        await performLogin(page,USERNAME,PASSWORD)
    } 
    let { loggedIn, allTheWay } = await checkLogin(page);

    if (!loggedIn && !allTheWay) {
        await performMFA(page,sleep,USERNAME,PASSWORD,PIN);
        await saveCookies(context,agentId,carrier);
        console.log("I am running 1")
        await runLoggedInFunctions(sleep, page, browser, connection,agentId);
    } else if (loggedIn && !allTheWay) {
        await performMFA(page,sleep,USERNAME,PASSWORD,PIN);
        await saveCookies(context,agentId,carrier);
        console.log("I am running 2")
        await runLoggedInFunctions(sleep, page, browser, connection,agentId);
    } else if (allTheWay) {
        await saveCookies(context,agentId,carrier);
        console.log("I am running login Functions")
        await runLoggedInFunctions(sleep, page, browser, connection,agentId);
    }
}