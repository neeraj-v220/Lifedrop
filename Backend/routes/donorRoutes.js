const express = require("express");
const {
  registerDonor,
  toggleAvailability,
  searchDonors,
  getDonorByPhone
} = require("../controllers/donorController");

const router = express.Router();

router.post("/register", registerDonor);
router.put("/:id/availability", toggleAvailability);
router.get("/search", searchDonors);
router.get("/phone/:phone", getDonorByPhone);

module.exports = router;
