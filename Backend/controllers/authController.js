const otpService = require("../services/otpService");

exports.sendOTP = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const generatedOtp = await otpService.sendOTP(phone);
    // Dev Mode Fallback: Free SMS APIs drop 90% of texts. Passing OTP explicitly in response payload for alert display.
    res.status(200).json({ success: true, message: "OTP sent successfully via SMS", otp: generatedOtp });
  } catch (error) {
    next(error);
  }
};

exports.verifyOTP = (req, res, next) => {
  try {
    const { phone, otp } = req.body;
    otpService.verifyOTP(phone, otp);
    res.status(200).json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    next(error);
  }
};
