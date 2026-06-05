const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const dataPath = path.join(__dirname, 'node_modules', 'india-pincode', 'data', 'pincodes.json.gz');

try {
    const fileBuffer = fs.readFileSync(dataPath);
    const unzipped = zlib.unzipSync(fileBuffer);
    const pincodes = JSON.parse(unzipped.toString());
    
    console.log("Total entries:", pincodes.length);
    if (pincodes.length > 0) {
        console.log("Sample entry structure:", pincodes[0]);
    }
} catch(e) {
    console.log(e);
}
