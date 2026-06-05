const fs = require('fs');
const https = require('https');
const path = require('path');

const url = "https://raw.githubusercontent.com/sab99r/Indian-States-And-Districts/master/states-and-districts.json";

https.get(url, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    
    res.on('end', () => {
        try {
            const data = JSON.parse(rawData);
            
            const locationData = {};
            data.states.forEach(stateObj => {
                const stateName = stateObj.state;
                const districts = stateObj.districts;
                
                locationData[stateName] = {};
                
                districts.forEach(district => {
                    // Setting the city exact name equal to the district name,
                    // guaranteeing users easily select precise areas without UI bugs.
                    locationData[stateName][district] = [ district ];
                });
            });

            const jsContent = `const locationData = ${JSON.stringify(locationData, null, 2)};\n`;
            
            const destPath = path.join(__dirname, '..', 'Frontend', 'locations.js');
            fs.writeFileSync(destPath, jsContent);
            console.log("Successfully generated realistic static locations.js!");

        } catch (e) {
            console.error("Error parsing JSON:", e);
        }
    });
});
