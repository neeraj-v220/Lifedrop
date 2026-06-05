const crypto = require("crypto");
const { ErrorHandler } = require("../utils/errorHandler");

// In-memory store: { phone: { otp: "123456", expiresAt: Date } }
const otpStore = new Map();

const OTP_EXPIRY_MINUTES = 5;

const generateOTP = () => {
  // Generate a random 6 digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
};

const twilio = require('twilio');



const sendOTP = async (phone) => {
  if (!phone) {
    throw new ErrorHandler("Phone number is required", 400);
  }

  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60000);

  otpStore.set(phone, { otp, expiresAt });

  // Use Textbelt for free out-of-the-box SMS (1 free SMS per day per IP)
  const https = require('https');
  const querystring = require('querystring');
  
  const postData = querystring.stringify({
      phone: phone.startsWith('+') ? phone : `+91${phone}`,
      message: `Your LifeDrop OTP is: ${otp}. It expires in ${OTP_EXPIRY_MINUTES} mins.`,
      key: 'textbelt',
  });

  const options = {
      hostname: 'textbelt.com',
      port: 443,
      path: '/text',
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': postData.length
      }
  };

  return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
          let body = '';
          res.on('data', (d) => body += d);
          res.on('end', () => {
              try {
                  const json = JSON.parse(body);
                  if(!json.success) {
                      console.log("Textbelt failed, falling back to console:", json);
                      // Fallback just so the app works even if quota is exceeded
                  } else {
                      console.log("Successfully sent free SMS via Textbelt");
                  }
                  resolve(otp);
              } catch(e) { resolve(otp); }
          });
      });
      req.on('error', (e) => reject(new ErrorHandler("SMS Service Failed", 500)));
      req.write(postData);
      req.end();
  });
};

const verifyOTP = (phone, userOtp) => {
  if (!phone || !userOtp) {
    throw new ErrorHandler("Phone and OTP are required", 400);
  }

  const record = otpStore.get(phone);

  if (!record) {
    throw new ErrorHandler("No OTP requested for this number or expired", 400);
  }

  if (new Date() > record.expiresAt) {
    otpStore.delete(phone);
    throw new ErrorHandler("OTP expired", 400);
  }

  if (record.otp !== userOtp.toString()) {
    throw new ErrorHandler("Invalid OTP", 400);
  }

  // OTP verified successfully
  otpStore.delete(phone);
  return true;
};

module.exports = {
  sendOTP,
  verifyOTP
};
