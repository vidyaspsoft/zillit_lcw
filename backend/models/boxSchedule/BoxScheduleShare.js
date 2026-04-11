const mongoose = require("mongoose");
const epochTimestamps = require("./_epochTimestamps");

const boxScheduleShareSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    // Epoch ms (0 = no expiration)
    expiresAt: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: false }
);

boxScheduleShareSchema.plugin(epochTimestamps);

module.exports = mongoose.model("BoxScheduleShare", boxScheduleShareSchema);
