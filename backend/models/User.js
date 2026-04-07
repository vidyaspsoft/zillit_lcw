const mapConnection = require("../config/mapDb");
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: "" },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    role: { type: String, default: "member" },
    deviceId: { type: String, default: "" },
  },
  { timestamps: true }
);

userSchema.index({ projectId: 1 });

module.exports = mapConnection.model("User", userSchema);
