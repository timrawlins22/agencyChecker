const fs = require('fs');
const path = require('path');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
// Get the base directory for cookies (relative to the current file)
const getCookiePath = (agentId, carrier) => {
    // This is the correct, consistent way to resolve the path
    const dir = path.join(__dirname, '..', `cookies/${agentId}`, carrier);
    return path.join(dir, `${agentId}cookies.json`);
};
function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').replace('T','_').split('Z')[0];
}
async function loadCookies(page, agentId, carrier) {
    const filePath = getCookiePath(agentId, carrier); // Use the consistent path helper
    
    if (fs.existsSync(filePath)) {
        try {
            const cookies = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            await page.setCookie(...cookies);
            return true;
        } catch (err) {
            console.error("Error loading cookies:", err);
        }
    }
    return false;
}

async function saveCookies(context, agentId, carrier) {
    const cookies = await context.cookies();
    
    // The directory and file logic can be consolidated using the helper or kept as is
    //const dir = path.join(__dirname, '..', 'cookies', carrier);
    const dir = path.join(__dirname, '..', `cookies/${agentId}`, carrier);
    //console.log(dir);
    //console.log(dir2);
    fs.mkdirSync(dir, { recursive: true });
    
    const filePath = path.join(dir, `${agentId}cookies.json`); // This path is consistent
    
    fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));
}
async function waitForDownloadComplete(downloadDir, before, agentId, {
  timeout = 60000, poll = 500, stableMillis = 1500
} = {}) {

  const start = Date.now();
  const known = new Set(before);

const TARGET_EXTENSIONS = ['.csv', '.xlsx'];
    
    // Extensions that indicate a file is still downloading or is a system file
const IGNORE_EXTENSIONS = ['.crdownload', '.tmp'];
  while (Date.now() - start < timeout) {
    // Read the directory contents
    const files = fs.readdirSync(downloadDir);
    console.log(files);
    const newOnes = files.filter(f => {
        // 1. Exclude files already known (from before this function started)
        if (known.has(f)) return false;
        
        // 2. Exclude hidden/system files (starting with '.')
        if (f.startsWith('.')) return false; 
        
        // 3. Exclude files that are still downloading/temporary
        if (IGNORE_EXTENSIONS.some(ext => f.endsWith(ext))) return false;
        
        // 4. FOCUS: Only accept files that end with a target extension
        const fileExt = path.extname(f).toLowerCase();
        return TARGET_EXTENSIONS.includes(fileExt);
    });
    if (newOnes.length > 0) {
        console.log("there is")
      const found = newOnes[0];
      const full = path.join(downloadDir, found);

      // ✅ Wait until file size stops growing
      let lastSize = -1;
      let stableSince = null;
      while (Date.now() - start < timeout) {
        // Check if the file still exists and get its size
        if (!fs.existsSync(full)) {
             await sleep(poll); // File was moved or deleted, wait and re-check
             break;
        }
        
        const { size } = fs.statSync(full);
        
        if (size === lastSize) {
          if (stableSince == null) stableSince = Date.now();
          if (Date.now() - stableSince >= stableMillis) {
            console.log("in this spot!");
            // --- Generalization ---
            // 1. DETERMINE EXTENSION: Use whatever extension the file actually has.
            const ext = path.extname(found); // e.g., '.xlsx', '.csv', or ''
            
            // 2. RENAME GENERICALLY: Using the actual extension.
            // (Assumes timestamp() is a globally accessible/imported function)
            const newName = `${agentId}_${timestamp()}${ext}`; 
            console.log(newName)
            const newPath = path.join(downloadDir, newName);
            fs.renameSync(full, newPath);

            // 3. GENERIC PROCESSING CALL: Change the function name to reflect generic handling.
            // You must ensure this new function handles different file types (xlsx, csv) internally.
           // await processDownloadedFileAndInsert(newPath, agentId); 
            // --- End Generalization ---
            console.log("DONE BITCH")
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
    saveCookies,
    loadCookies,
    waitForDownloadComplete
};