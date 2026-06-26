require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const { errorMiddleware } = require("./utils/errorHandler");

const authRoutes = require("./routes/authRoutes");
const donorRoutes = require("./routes/donorRoutes");
const userAuthRoutes = require("./routes/userAuthRoutes");

const app = express();

console.log("🔥 NEW SERVER FILE LOADED");

// =============================
// Middleware
// =============================
app.use(cors());
app.use(express.json());

// =============================
// Test Routes
// =============================
app.get("/", (req, res) => {
  res.send("🚀 LifeDrop Backend is Running Successfully");
});

app.get("/ping", (req, res) => {
  res.send("PONG");
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    message: "LifeDrop Backend Healthy",
    time: new Date(),
  });
});

// =============================
// MongoDB Connection
// =============================
const DB_URI = process.env.MONGO_URI;

if (!DB_URI) {
  console.error("❌ MONGO_URI is missing in environment variables.");
  process.exit(1);
}

mongoose
  .connect(DB_URI)
  .then(() => {
    console.log("✅ MongoDB Connected Successfully");
  })
  .catch((error) => {
    console.error("❌ MongoDB Connection Error:", error.message);
  });

// =============================
// API Routes
// =============================
app.use("/api/auth", authRoutes);
app.use("/api/donor", donorRoutes);
app.use("/api/users", userAuthRoutes);

// =============================
// Blood Request Route
// =============================
app.post("/api/request", async (req, res, next) => {
  try {
    let Request, Donor;

    try {
      Request = require("./models/Request");
      Donor = require("./models/Donor");
    } catch (err) {
      console.error("❌ Model Load Error:", err);
      return res.status(501).json({
        message: "Request system not available yet.",
      });
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
    next(error);
  }
});

// =============================
// Error Middleware
// =============================
if (errorMiddleware) {
  app.use(errorMiddleware);
}

// =============================
// Start Server
// =============================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});