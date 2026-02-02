const path = require('path');
const io = require('socket.io-client'); // Import the client library
const { v4: uuidv4 } = require('uuid'); // Import the UUID generator
const puppeteer = require('puppeteer-extra');

const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { login, navigateToInforce, exportExcel } = require("./src/helpers/corebridgeHelpers.js");
const { loadCookies, saveCookies } = require('./src/helpers/genericHelpers.js');
const { decrypt } = require('./utils/crypto.js');

/*const USERNAME = 'adluckie.sfg@gmail.com';
const PASSWORD = 'Catpoop25!';
const PIN = '123455';
const agentId = 'ai_amanda';*/

const downloadPath = path.resolve(__dirname, 'csv/corebridge');

// The URL of your main server that is running the Socket.IO instance
const SERVER_URL = 'http://localhost:3443';

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

   // console.log("corebridge starting");

    // Create a unique session ID for this bot run
    const sessionId = uuidv4();
    
    // Create a client-side socket connection to your server
   /* const socket = io(SERVER_URL);
    
    // Create a promise to wait for the MFA code
    let mfaCodePromiseResolve;
    const mfaCodePromise = new Promise(resolve => {
        mfaCodePromiseResolve = resolve;
    });*/

    // Event listener to receive the MFA code from the server
    /*socket.on('mfa-code-received', (data) => {
        console.log(`MFA code received from frontend: ${data.code}`);
        mfaCodePromiseResolve(data.code);
    });*/

    /*await new Promise((resolve, reject) => {
        socket.on('connect', () => {
            console.log(`Puppeteer bot connected to server with ID ${socket.id}`);
            // Register this bot session with the server using the unique sessionId
            socket.emit('register', { sessionId });
            resolve(); // Resolve the promise once connected and registered
        });
        socket.on('connect_error', (err) => {
            console.error('Socket connection error:', err);
            reject(err);
        });
    });*/

    const page = await browser.newPage();
    const context = browser.defaultBrowserContext();

    // Enable downloads
    const client = await page.target().createCDPSession();
    await client.send("Page.setDownloadBehavior", { behavior: "allow", downloadPath });

    await loadCookies(page, agentId, carrier);
    await page.goto('https://www.connext.corebridgefinancial.com/life/connext-bob/app/home', { waitUntil: 'networkidle2' });

    const currentURL = page.url();
    if (currentURL.includes("https://www.connext.corebridgefinancial.com/life/connext-bob/public/login")) {
        // Here, the bot detects it needs to log in, and should request the MFA code

        
        // This is the crucial line: Emit the event to the server
       // socket.emit('mfa-needed', { sessionId, carrier }); // This is what the server now listens for
        
        // Wait for the MFA code from the frontend
        //const mfaCode = await mfaCodePromise;
        
        // Now use the received code to continue the login
        await login(username, password, page);
    }
    

    await navigateToInforce(page);
    await saveCookies(context, agentId, carrier);
    await exportExcel(page, downloadPath, agentId, path);

    await page.close();
    return "SUCCESS"
    // Disconnect the socket when the job is done
   // socket.disconnect();
    
}