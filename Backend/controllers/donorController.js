const fs = require("fs");
const path = require("path");
const Donor = require("../models/Donor");
const { isEligible } = require("../utils/eligibilityHelper");
const { ErrorHandler } = require("../utils/errorHandler");

const officialDonorsPath = path.join(__dirname, '..', 'data', 'official_donors.json');

exports.registerDonor = async (req, res, next) => {
  try {
    const { name, bloodGroup, phone, state, district, city, lastDonationDate, location, consent } = req.body;

    if (!name || !bloodGroup || !phone || !state || !district || !city) {
      return next(new ErrorHandler("Please provide all required fields: Name, Blood Group, Phone, State, District, and City.", 400));
    }

    if (!consent) {
      return next(new ErrorHandler("User consent is required for registration.", 400));
    }

    // Client must have verified OTP to reach here (for this integration scope)
    const isVerified = true;

    // Automatic availability logic based on 90-day medical constraint
    let available = true;
    if (lastDonationDate) {
      if (!isEligible(lastDonationDate)) {
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
      lastDonationDate,
      available,
      isVerified,
      consent,
    };

    // Manual check for existing phone number to overcome any MongoDB index failures
    const existingDonor = await Donor.findOne({ phone: phone });
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
    // Only return verified donors
    const donor = await Donor.findOne({ phone: req.params.phone, isVerified: true });
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

    const query = { available: true, isVerified: true };
    if (bloodGroup) query.bloodGroup = bloodGroup;
    if (state) query.state = new RegExp(`^${state}$`, 'i');
    if (district) query.district = new RegExp(`^${district}$`, 'i');
    if (city) query.city = new RegExp(`^${city}$`, 'i');

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

    const dbDonors = await Donor.find(query).select('-createdAt -updatedAt -__v -isVerified -consent').lean();

    let officialDonors = [];
    try {
      if (fs.existsSync(officialDonorsPath)) {
        const data = fs.readFileSync(officialDonorsPath, 'utf8');
        let parsed = JSON.parse(data);

        parsed = parsed.filter(d => d.available === true);
        if (bloodGroup) parsed = parsed.filter(d => d.bloodGroup === bloodGroup);
        if (state) parsed = parsed.filter(d => d.state && d.state.toLowerCase() === state.toLowerCase());
        if (district) parsed = parsed.filter(d => d.district && d.district.toLowerCase() === district.toLowerCase());
        if (city) parsed = parsed.filter(d => d.city && d.city.toLowerCase() === city.toLowerCase());

        // Mark as official
        parsed = parsed.map(d => ({ ...d, isOfficial: true }));
        officialDonors = parsed;
      }
    } catch (err) {
      console.error("Error reading official donors JSON:", err);
    }

    const allDonors = [...dbDonors, ...officialDonors];
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
