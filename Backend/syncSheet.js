const fs = require("fs");
const path = require("path");
const { fetchGoogleSheetData, extractDonorsFromCSV } = require("./services/googleSheetService");

const sheetDonorsPath = path.join(__dirname, "data", "sheet_donors.json");

const arg = process.argv[2];

if (arg) {
  if (fs.existsSync(arg)) {
    console.log(`📁 Reading local CSV file: ${arg}...`);
    const csvContent = fs.readFileSync(arg, "utf8");
    const donors = extractDonorsFromCSV(csvContent);
    fs.writeFileSync(sheetDonorsPath, JSON.stringify(donors, null, 2));
    console.log(`✅ Successfully imported ${donors.length} donors from ${arg}!`);
  } else {
    console.log(`🌐 Syncing from custom Sheet URL/ID: ${arg}...`);
    fetchGoogleSheetData(arg).then(donors => {
      console.log(`✅ Finished sync. Total donors: ${donors.length}`);
    });
  }
} else {
  console.log("🌐 Syncing from default Google Sheet...");
  fetchGoogleSheetData().then(donors => {
    console.log(`✅ Finished sync. Total donors: ${donors.length}`);
  });
}
