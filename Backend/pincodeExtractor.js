const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const dataPath = path.join(__dirname, 'node_modules', 'india-pincode', 'data', 'pincodes.json.gz');

try {
    const fileBuffer = fs.readFileSync(dataPath);
    const unzipped = zlib.unzipSync(fileBuffer);
    const pincodes = JSON.parse(unzipped.toString());

    const locationData = {};

    pincodes.forEach(post => {
        let state = post.s;
        let district = post.d;
        let city = post.o;

        if (!state || !district || !city) return;
        
        // Capitalize Properly
        state = state.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        district = district.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
        city = city.trim();

        // Remove things like BO, SO, HO
        city = city.replace(/\s(B\.O|S\.O|H\.O|B O|S O|H O)$/i, '').trim();

        if (!locationData[state]) locationData[state] = {};
        if (!locationData[state][district]) locationData[state][district] = new Set();
        
        locationData[state][district].add(city);
    });

    const finalData = {};
    for (let s in locationData) {
        finalData[s] = {};
        for (let d in locationData[s]) {
            let cities = Array.from(locationData[s][d]).sort();
            finalData[s][d] = cities;
        }
    }

    const destPath = path.join(__dirname, '..', 'Frontend', 'locations.js');
    const jsContent = `const locationData = ${JSON.stringify(finalData, null, 2)};\n`;
    fs.writeFileSync(destPath, jsContent);
    console.log("Successfully mapped State -> District -> Exact Cities to locations.js!");

} catch(e) {
    console.log(e);
}
