const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

const sheetDonorsPath = path.join(__dirname, "..", "data", "sheet_donors.json");
const SHEET_ID = "1bP5UiQDfBeR-kdmshL3XKOGEaR04wS6GqaeTuQw8D5Y";

function parseCSV(text) {
  const lines = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      row.push(cell.trim());
      if (row.some(c => c.length > 0)) {
        lines.push(row);
      }
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell || row.length > 0) {
    row.push(cell.trim());
    if (row.some(c => c.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

function normalizeBloodGroup(bg) {
  if (!bg) return "";
  const cleaned = bg.toUpperCase().replace(/\s+/g, "").replace(/POSITIVE/gi, "+").replace(/NEGATIVE/gi, "-");
  const match = cleaned.match(/(A|B|AB|O)[\+\-]/);
  return match ? match[0] : bg.trim();
}

function extractDonorsFromCSV(csvText) {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase());

  const findCol = (patterns) => {
    return headers.findIndex(h => patterns.some(p => p.test(h)));
  };

  const nameIdx = findCol([/name/i, /donor/i, /full\s*name/i]);
  const bloodIdx = findCol([/blood/i, /group/i, /b\.?g/i]);
  const phoneIdx = findCol([/phone/i, /mobile/i, /contact/i, /number/i, /tel/i]);
  const stateIdx = findCol([/state/i, /region/i]);
  const districtIdx = findCol([/district/i, /county/i]);
  const cityIdx = findCol([/city/i, /town/i, /place/i, /address/i, /location/i]);

  const donors = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const name = nameIdx !== -1 && r[nameIdx] ? r[nameIdx] : "";
    const bloodGroup = bloodIdx !== -1 && r[bloodIdx] ? normalizeBloodGroup(r[bloodIdx]) : "";
    const phone = phoneIdx !== -1 && r[phoneIdx] ? r[phoneIdx] : "";
    const state = stateIdx !== -1 && r[stateIdx] ? r[stateIdx] : "";
    const district = districtIdx !== -1 && r[districtIdx] ? r[districtIdx] : "";
    const city = cityIdx !== -1 && r[cityIdx] ? r[cityIdx] : "";

    if (name || phone || bloodGroup) {
      donors.push({
        name: name || "Anonymous Donor",
        bloodGroup: bloodGroup || "O+",
        phone: phone || "N/A",
        state: state || "",
        district: district || "",
        city: city || "",
        available: true,
        isOfficial: true,
        source: "GoogleSheet"
      });
    }
  }

  return donors;
}

function fetchGoogleSheetData(sheetId = SHEET_ID) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;

  return new Promise((resolve) => {
    https.get(url, (res) => {
      if (res.statusCode === 200) {
        let data = "";
        res.on("data", chunk => data += chunk);
        res.on("end", () => {
          try {
            const donors = extractDonorsFromCSV(data);
            if (donors.length > 0) {
              fs.writeFileSync(sheetDonorsPath, JSON.stringify(donors, null, 2));
              console.log(`✅ Successfully synced ${donors.length} donors from Google Sheet!`);
            }
            resolve(donors);
          } catch (e) {
            console.error("Error parsing Google Sheet CSV:", e.message);
            resolve(getStoredSheetDonors());
          }
        });
      } else {
        // Status non-200 (e.g. 401 restricted access)
        resolve(getStoredSheetDonors());
      }
    }).on("error", (err) => {
      console.warn("Could not fetch Google Sheet online, using local cache:", err.message);
      resolve(getStoredSheetDonors());
    });
  });
}

function getStoredSheetDonors() {
  if (fs.existsSync(sheetDonorsPath)) {
    try {
      const content = fs.readFileSync(sheetDonorsPath, "utf8");
      return JSON.parse(content);
    } catch (e) {
      return [];
    }
  }
  return [];
}

module.exports = {
  fetchGoogleSheetData,
  getStoredSheetDonors,
  extractDonorsFromCSV
};
