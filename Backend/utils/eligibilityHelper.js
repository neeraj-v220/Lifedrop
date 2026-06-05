const { ErrorHandler } = require("./errorHandler");

/**
 * Checks if 90 days have passed since the last donation date.
 * @param {Date|string} lastDonationDate 
 * @returns {boolean} 
 */
function isEligible(lastDonationDate) {
  if (!lastDonationDate) return true;

  const donationDate = new Date(lastDonationDate);
  if (isNaN(donationDate)) {
    throw new ErrorHandler("Invalid last donation date", 400);
  }

  const currentDate = new Date();
  const diffTime = Math.abs(currentDate - donationDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 

  return diffDays >= 90;
}

module.exports = { isEligible };
