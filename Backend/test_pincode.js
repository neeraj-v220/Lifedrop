const fs = require('fs');
const path = require('path');
const pincodeData = require('india-pincode');

try {
    // Determine the data. It might be an array, or an API wrapper.
    let records = [];
    if (Array.isArray(pincodeData)) {
        records = pincodeData;
    } else if (typeof pincodeData.getAll === 'function') {
        records = pincodeData.getAll();
    } else if(pincodeData.pincodes && Array.isArray(pincodeData.pincodes)) {
        records = pincodeData.pincodes;
    } else if(typeof pincodeData.getData === 'function') {
        records = pincodeData.getData();
    } else {
        console.log("Keys available in india-pincode:", Object.keys(pincodeData));
        process.exit();
    }

    const locationData = {};

    records.forEach(post => {
        let state = post.stateName || post.state || post.StateName || post.State;
        let district = post.districtName || post.district || post.DistrictName || post.District;
        let city = post.officeName || post.office || post.OfficeName || post.city || post.taluk || post.Taluk;

        // Some cleaning
        if (!state || !district || !city) return;
        state = state.trim();
        district = district.trim();
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

    const jsContent = `const locationData = ${JSON.stringify(finalData, null, 2)};\n`;
    const destPath = path.join(__dirname, '..', 'Frontend', 'locations.js');
    fs.writeFileSync(destPath, jsContent);
    console.log("Successfully extracted City-level data to locations.js!");
} catch (e) {
    console.error("Error:", e);
}
