const mapConnection = require("../config/mapDb");
const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mapConnection.model("Project", projectSchema);
