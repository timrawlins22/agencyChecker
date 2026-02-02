//const http = require('http'); 
const https = require('https');
const cors = require("cors");
const fs = require('fs');
const path = require('path');
const express = require('express'); 
const { Server } = require("socket.io"); 
//const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
require('dotenv').config();

const agentRoutes = require('./src/routes/agentRoutes.js');
const dashboardRoutes = require('./src/routes/dashboardRoutes.js'); 
const publicRoutes = require('./src/routes/publicRoutes.js');
const { initScheduler } = require('./utils/jobScheduler.js');


// Create a new Express app and HTTP server
const app = express();
app.use(cors());
app.use(express.json()); // To parse application/json bodies
app.use(express.urlencoded({ extended: true }));

//const server = http.createServer(app);
const CERT_DIR = path.resolve(__dirname, 'certs');
const KEY_PATH = path.join(CERT_DIR, 'server.key');
const CERT_PATH = path.join(CERT_DIR, 'server.crt');

const sslOptions = {
    key: fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH)
};

// Start HTTPS server
const server= https.createServer(sslOptions, app).listen(process.env.PORT, () => {
    console.log(`HTTPS server running on port ${process.env.PORT}`);
    initScheduler();
});
const io = new Server(server, { 
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
app.use('/api/agent', agentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/public', publicRoutes);
// A map to store active Puppeteer sessions
const sessions = new Map();

io.on('connection', socket => {
    console.log(`Client connected: ${socket.id}`);
    
    // Listen for a 'register' event from a Puppeteer bot
    socket.on('register', (data) => {
        console.log("I am here")
        if (data.sessionId) {
            sessions.set(data.sessionId, socket.id);
            console.log(`Puppeteer session ${data.sessionId} registered with socket ID ${socket.id}`);
        }
    });

    // 🚀 NEW: Listen for the 'mfa-needed' event from the Puppeteer bot
    socket.on('mfa-needed', (data) => {
        console.log(`MFA needed for session: ${data.sessionId} (${data.carrier}). Notifying frontend...`);

        // Emit an event that the frontend is listening for to prompt the user
        // io.emit sends the message to ALL connected clients (including the bot, but only the frontend should act on it)
        io.emit('request-mfa', { 
            sessionId: data.sessionId,
            carrier: data.carrier,
            message: `Please provide MFA code for ${data.carrier}`
        });
    });
  
    // Listen for an 'mfa-code' event from the user-facing client
    socket.on('mfa-code', (data) => {
        const puppeteerSocketId = sessions.get(data.sessionId);
        if (puppeteerSocketId) {
            // First, send the MFA code to the correct Puppeteer bot
            io.to(puppeteerSocketId).emit('mfa-code-received', { code: data.code });
            
            // Second, send a confirmation message back to the frontend client
            socket.emit('code-received', { sessionId: data.sessionId });
            
            console.log(`MFA code sent to bot session ${data.sessionId}`);
        } else {
            // Added check for missing session to confirm if the frontend needs re-submission
            console.warn(`MFA code received for unknown/disconnected session: ${data.sessionId}`);
            socket.emit('code-received', { sessionId: data.sessionId, error: "Session not active" });
        }
    });

    socket.on('disconnect', () => {
        let disconnectedSessionId;
        for (const [key, value] of sessions.entries()) {
          if (value === socket.id) {
            disconnectedSessionId = key;
            sessions.delete(key);
            break;
          }
        }
        console.log(`Client disconnected: ${socket.id}. Session ${disconnectedSessionId} removed.`);
    });
});

// Start the HTTP server on a specific port


function logMemoryUsage(label = "") {
    const used = process.memoryUsage();
    console.log(
        `[MEMORY${label ? " - " + label : ""}] ` +
        `RSS: ${(used.rss / 1024 / 1024).toFixed(2)} MB, ` +
        `Heap: ${(used.heapUsed / 1024 / 1024).toFixed(2)} / ${(used.heapTotal / 1024 / 1024).toFixed(2)} MB, ` +
        `External: ${(used.external / 1024 / 1024).toFixed(2)} MB`
    );
}

(async () => {
    
    logMemoryUsage("Startup");
    
    // Fix: Ensure only necessary arguments are passed.
   // await runCorebridge(browser, connection, 'CoreBridge');
    
    logMemoryUsage("Before shutdown");
    //await browser.close();
    //connection.end();
})();