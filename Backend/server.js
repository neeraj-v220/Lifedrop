require("dotenv").config();
console.log("🔥🔥🔥 DEPLOY TEST v1");

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
console.log("ENV:", process.env.MONGO_URI);
// ⚠️ Make sure this file exists: utils/errorHandler.js
const { errorMiddleware } = require("./utils/errorHandler");

const authRoutes = require("./routes/authRoutes");
const donorRoutes = require("./routes/donorRoutes");
const userAuthRoutes = require("./routes/userAuthRoutes");

const app = express();
console.log("🔥 NEW SERVER FILE LOADED");
app.get("/", (req, res) => {
  res.send("ROOT WORKING");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    time: new Date()
  });
});


// ✅ CORS (safe for now)
app.use(cors());

// ✅ JSON parser
app.use(express.json());


// ✅ MongoDB Connection (clean version — no deprecated options)
const DB_URI =
  process.env.MONGO_URI ||
  "mongodb+srv://NeerajV_2022:bloodconnect123@cluster0.jq2higo.mongodb.net/bloodconnect";

mongoose.connect(DB_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully");
  })
  .catch((error) => {
    console.log("MongoDB Connection Error:", error.message);
  });


// ✅ Test route
app.get("/", (req, res) => {
  res.send("🚀 LifeDrop Server Running");
});


// ✅ Routes
app.use("/api/auth", authRoutes);
app.use("/api/donor", donorRoutes);
app.use("/api/users", userAuthRoutes);


// ⚠️ OPTIONAL: Request feature (safe fallback)
app.post("/api/request", async (req, res, next) => {
  try {
    let Request, Donor;

    try {
      Request = require("./models/Request");
      Donor = require("./models/Donor");
    } catch (err) {
      console.log("❌ Load models error:", err);
      return res
        .status(501)
        .json({ message: "Request system not available yet." });
    }

    const request = new Request(req.body);
    const savedRequest = await request.save();

    const donors = await Donor.find({
      bloodGroup: req.body.bloodGroup,
      state: req.body.state,
      district: req.body.district,
      city: req.body.city,
      available: true,
    });

    res.status(201).json({
      request: savedRequest,
      matchingDonors: donors,
    });
  } catch (error) {
    console.log("❌ Request error:", error);
    next(error);
  }
});


// ⚠️ Error middleware (only if file exists)
if (errorMiddleware) {
  app.use(errorMiddleware);
}


// ✅ Start server
const PORT = process.env.PORT || 5000;

app.get("/", (req, res) => {
    res.send("🚀 LifeDrop Backend is Running Successfully");
});
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});