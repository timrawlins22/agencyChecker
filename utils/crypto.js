// utils/crypto.js

const crypto = require('crypto');
require('dotenv').config(); // Ensure your .env variables are loaded

// CRITICAL: The ENCRYPTION_KEY MUST be a 32-byte (256-bit) string for AES-256-CBC
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES requires a 16-byte initialization vector

if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length !== 32) {
    console.error("CRITICAL ERROR: ENCRYPTION_KEY missing or not 32 bytes long. Bot credentials CANNOT be stored securely.");
    // In a production app, you would stop the server here.
}

/**
 * Encrypts a plain text string using AES-256-CBC.
 * @param {string} text 
 * @returns {string} Encrypted string (IV:CipherText)
 */
function encrypt(text) {
    if (!ENCRYPTION_KEY) return text; // Fallback (should crash in prod)

    // Generate a random initialization vector (IV) for security
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Return the IV along with the ciphertext, separated by a colon
    return iv.toString('hex') + ':' + encrypted;
}

// NOTE: Decrypt function is for the BOT/Puppeteer script, not needed in the controller, 
// but included for completeness.
 function decrypt(text) {
     if (!ENCRYPTION_KEY) return text; 
     const parts = text.split(':');
     const iv = Buffer.from(parts[0], 'hex');
     const encryptedText = parts[1];
     const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY), iv);
     let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
     decrypted += decipher.final('utf8');
     return decrypted;
 }

module.exports = { encrypt , decrypt };