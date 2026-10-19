const fs = require("fs");
const path = require("path");
const Donor = require("../models/Donor");
const { isEligible } = require("../utils/eligibilityHelper");
const { ErrorHandler } = require("../utils/errorHandler");
const { getStoredSheetDonors, fetchGoogleSheetData } = require("../services/googleSheetService");

// Trigger background sync on module load
fetchGoogleSheetData().catch(() => {});

const officialDonorsPath = path.join(__dirname, '..', 'data', 'official_donors.json');


const cleanPhone = (phone) => {
  if (!phone) return "";
  return String(phone).replace(/\D/g, "");
};

const phoneMatches = (p1, p2) => {
  const clean1 = cleanPhone(p1);
  const clean2 = cleanPhone(p2);
  if (clean1.length >= 10 && clean2.length >= 10) {
    return clean1.slice(-10) === clean2.slice(-10);
  }
  return clean1 === clean2;
};


exports.registerDonor = async (req, res, next) => {
  try {
    const { name, bloodGroup, phone, state, district, city, lastDonationDate, donationExperience, location, consent } = req.body;

    if (!name || !bloodGroup || !phone || !state || !district || !city) {
      return next(new ErrorHandler("Please provide all required fields: Name, Blood Group, Phone, State, District, and City.", 400));
    }

    if (!consent) {
      return next(new ErrorHandler("User consent is required for registration.", 400));
    }

    const normalizedLastDonationDate = typeof lastDonationDate === "string" ? lastDonationDate.trim() : lastDonationDate; const hasLastDonationDate = normalizedLastDonationDate !== undefined && normalizedLastDonationDate !== null && normalizedLastDonationDate !== ""; const hasDonationExperience = donationExperience !== undefined && donationExperience !== null && donationExperience !== ""; const normalizedDonationExperience = hasDonationExperience ? donationExperience : (hasLastDonationDate ? "returning" : "first-time"); if (!["first-time", "returning"].includes(normalizedDonationExperience)) { return next(new ErrorHandler("Please select a valid donation history option.", 400)); } if (hasDonationExperience && normalizedDonationExperience === "returning" && !hasLastDonationDate) { return next(new ErrorHandler("Please provide your last donation date.", 400)); } if (normalizedDonationExperience === "first-time" && hasLastDonationDate) { return next(new ErrorHandler("A first-time donor cannot have a previous donation date.", 400)); }
    const isVerified = true;

    // Automatic availability logic based on 90-day medical constraint
    let available = true;
    if (normalizedDonationExperience === "returning" && hasLastDonationDate) {
      if (!isEligible(normalizedLastDonationDate)) {
        available = false; // Override true because < 90 days
      }
    }

    const donorData = {
      name,
      bloodGroup,
      phone,
      state,
      district,
      city,
      lastDonationDate: hasLastDonationDate ? normalizedLastDonationDate : undefined, donationExperience: normalizedDonationExperience,
      available,
      isVerified,
      consent,
    };

    // Manual check for existing phone number to overcome any MongoDB index failures
    const allDonorsList = await Donor.find({});
    const existingDonor = allDonorsList.find(d => phoneMatches(d.phone, phone));
    if (existingDonor) {
      return next(new ErrorHandler("Donor with this phone number is already exist", 400));
    }

    if (location && location.latitude && location.longitude) {
      donorData.location = {
        type: "Point",
        coordinates: [parseFloat(location.longitude), parseFloat(location.latitude)]
      };
    }

    const donor = new Donor(donorData);
    const savedDonor = await donor.save();

    res.status(201).json({
      success: true,
      message: "Donor registered successfully",
      donor: savedDonor
    });
  } catch (error) {
    if (error.code === 11000) {
      return next(new ErrorHandler("Donor with this phone number is already exist", 400));
    }
    next(error);
  }
};

exports.getDonorByPhone = async (req, res, next) => {
  try {
    const inputPhone = req.params.phone;
    // Find all verified donors and match phone using phoneMatches helper:
    const donors = await Donor.find({ isVerified: true });
    const donor = donors.find(d => phoneMatches(d.phone, inputPhone));
    if (!donor) {
      return res.status(404).json({ message: "Donor not found" });
    }
    res.status(200).json(donor);
  } catch (error) {
    next(error);
  }
};

exports.toggleAvailability = async (req, res, next) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) {
      return next(new ErrorHandler("Donor not found", 404));
    }

    // Changing available to TRUE -> check eligibility
    if (!donor.available) {
      if (donor.lastDonationDate && !isEligible(donor.lastDonationDate)) {
        return next(new ErrorHandler("Donor is not eligible yet (minimum 90 days required)", 400));
      }
    }

    donor.available = !donor.available;
    await donor.save();

    res.status(200).json({
      success: true,
      message: `Availability changed to ${donor.available}`,
      donor
    });
  } catch (error) {
    next(error);
  }
};

exports.searchDonors = async (req, res, next) => {
  try {
    const { bloodGroup, state, district, city, lat, lng, distance = 10000 } = req.query;

    const query = {
    available: true,
    $or: [
        { isVerified: true },
        { isVerified: { $exists: false } }
    ]
};
    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (state) query.state = new RegExp(`^${state}$`, 'i');
    if (district) {
      if (district.toLowerCase() === 'trivandrum' || district.toLowerCase() === 'thiruvananthapuram') {
        query.district = new RegExp('^(trivandrum|thiruvananthapuram)$', 'i');
      } else {
        query.district = new RegExp(`^${district}$`, 'i');
      }
    }
    if (city) query.city = new RegExp(city, 'i');

    // Geospatial support if lat/lng are provided
    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(distance)
        }
      };
    }

    let dbDonors = [];
    try {
      dbDonors = await Donor.find(query).select('-createdAt -updatedAt -__v -isVerified -consent').lean();
    } catch (dbErr) {
      console.warn("MongoDB query failed, falling back to in-memory filtering:", dbErr.message);
      let allDb = [];
      try {
        allDb = await Donor.find({}).lean();
      } catch (fallbackErr) {
        console.error("Fallback query failed:", fallbackErr.message);
      }

      dbDonors = allDb.filter(d => {
        if (d.available === false) return false;
        
        // Match blood group
        if (bloodGroup && d.bloodGroup !== bloodGroup) return false;

        // Match state
        if (state) {
          if (!d.state) return false;
          const re = new RegExp(`^${state}$`, 'i');
          if (!re.test(d.state)) return false;
        }

        // Match district
        if (district) {
          if (!d.district) return false;
          const dLower = district.toLowerCase();
          const distL = d.district.toLowerCase();
          if (dLower === 'trivandrum' || dLower === 'thiruvananthapuram') {
            if (distL !== 'trivandrum' && distL !== 'thiruvananthapuram') return false;
          } else {
            const re = new RegExp(`^${district}$`, 'i');
            if (!re.test(d.district)) return false;
          }
        }

        // Match city
        if (city) {
          if (!d.city) return false;
          const re = new RegExp(city, 'i');
          if (!re.test(d.city)) return false;
        }

        return true;
      });
    }

    let officialDonors = [];
    try {
      if (fs.existsSync(officialDonorsPath)) {
        const data = fs.readFileSync(officialDonorsPath, 'utf8');
        let parsed = JSON.parse(data);

        parsed = parsed.filter(d => d.available === true);
        if (bloodGroup) parsed = parsed.filter(d => d.bloodGroup === bloodGroup);
        if (state) parsed = parsed.filter(d => d.state && d.state.toLowerCase() === state.toLowerCase());
        if (district) {
          const dLower = district.toLowerCase();
          parsed = parsed.filter(d => {
            if (!d.district) return false;
            const distL = d.district.toLowerCase();
            if (dLower === 'trivandrum' || dLower === 'thiruvananthapuram') {
              return distL === 'trivandrum' || distL === 'thiruvananthapuram';
            }
            return distL === dLower;
          });
        }
        if (city) parsed = parsed.filter(d => d.city && d.city.toLowerCase().includes(city.toLowerCase()));

        // Mark as official
        parsed = parsed.map(d => ({ ...d, isOfficial: true }));
        officialDonors = parsed;
      }
    } catch (err) {
      console.error("Error reading official donors JSON:", err);
    }

    let sheetDonors = [];
    try {
      let rawSheet = getStoredSheetDonors();
      if (rawSheet && rawSheet.length > 0) {
        rawSheet = rawSheet.filter(d => d.available !== false);
        if (bloodGroup) rawSheet = rawSheet.filter(d => d.bloodGroup === bloodGroup);
        if (state) rawSheet = rawSheet.filter(d => d.state && d.state.toLowerCase() === state.toLowerCase());
        if (district) {
          const dLower = district.toLowerCase();
          rawSheet = rawSheet.filter(d => {
            if (!d.district) return false;
            const distL = d.district.toLowerCase();
            if (dLower === 'trivandrum' || dLower === 'thiruvananthapuram') {
              return distL === 'trivandrum' || distL === 'thiruvananthapuram';
            }
            return distL === dLower;
          });
        }
        if (city) rawSheet = rawSheet.filter(d => d.city && d.city.toLowerCase().includes(city.toLowerCase()));
        sheetDonors = rawSheet.map(d => ({ ...d, isOfficial: true }));
      }
    } catch (err) {
      console.error("Error processing sheet donors:", err);
    }

    const allDonors = [...dbDonors, ...officialDonors, ...sheetDonors];

    const uniqueDonors = [];
    const seenPhones = new Set();
    const seenNameCity = new Set();
    
    allDonors.forEach(donor => {
      const normalizedPhone = donor.phone ? String(donor.phone).replace(/\s+/g, '') : null;
      const nameKey = donor.name ? donor.name.toLowerCase().replace(/\s+/g, '') : '';
      const cityKey = donor.city ? donor.city.toLowerCase().replace(/\s+/g, '') : '';
      const nameCityKey = `${nameKey}_${cityKey}`;

      let isDuplicate = false;

      if (normalizedPhone && seenPhones.has(normalizedPhone)) {
        isDuplicate = true;
      }
      
      if (nameKey && cityKey && seenNameCity.has(nameCityKey)) {
        isDuplicate = true;
      }

      if (!isDuplicate) {
        if (normalizedPhone) seenPhones.add(normalizedPhone);
        if (nameKey && cityKey) seenNameCity.add(nameCityKey);
        uniqueDonors.push(donor);
      }
    });

    res.status(200).json({
      success: true,
      count: uniqueDonors.length,
      data: uniqueDonors
    });
  } catch (error) {
    next(error);
  }
};
