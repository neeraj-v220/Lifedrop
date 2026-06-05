const https = require('https');
const fs = require('fs');
const path = require('path');

const url = "https://raw.githubusercontent.com/adarshsingh1407/Indian-States-And-Districts/main/states-and-sub-districts.json";
// Let's try another popular one: 
const url2 = "https://raw.githubusercontent.com/adarshsingh1407/Indian-States-And-Districts/main/states-and-districts.json";

// I'll just use a local mapping script using the `cities.json` I fetched earlier from `Indian-Cities-JSON`. 
// It has `name` and `state`. Let's create a map: State -> "All Districts" -> [List of Cities matching the state grouped randomly into the districts? NO! The user wants ACCURATE cities per district].

// Wait! Actually, let's look for "india.json" by darshanbib.
const darshanUrl = "https://raw.githubusercontent.com/Zeeshan-2k2/India-State-District-City-JSON/master/india.json";

https.get(darshanUrl, (res) => {
    let rawData = '';
    res.on('data', chunk => rawData += chunk);
    res.on('end', () => {
        try {
            console.log("Status for Zeeshan repo:", res.statusCode);
            if(res.statusCode !== 200) {
                 // Try another one
                 const bhuvanesh = "https://raw.githubusercontent.com/Bhuvanesh-N/India-States-Districts-And-Cities-JSON/master/states-districts-cities.json";
                 https.get(bhuvanesh, (res2) => {
                     let raw = '';
                     res2.on('data', c => raw += c);
                     res2.on('end', () => {
                          console.log("Bhuvanesh:", res2.statusCode);
                     });
                 })
                 return;
            }
            const data = JSON.parse(rawData);
            console.log(Object.keys(data));
        } catch (e) { console.log(e); }
    });
});
