const mongoose = require("mongoose");

const boxScheduleShareSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BoxScheduleShare", boxScheduleShareSchema);
