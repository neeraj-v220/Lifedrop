const mongoose = require("mongoose");
const makeHybridModel = require("./hybridModel");

const requestSchema = new mongoose.Schema({
  patientName: {
    type: String,
    required: true,
    trim: true
  },
  bloodGroup: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  district: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  hospital: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  }
}, { timestamps: true });

const MongooseRequest = mongoose.model("Request", requestSchema);
module.exports = makeHybridModel("Request", MongooseRequest);

