const mongoose = require("mongoose");
const epochTimestamps = require("./_epochTimestamps");

const boxScheduleActivityLogSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ["created", "updated", "deleted", "duplicated", "shared"],
      required: true,
    },
    targetType: {
      type: String,
      enum: ["schedule_day", "schedule_type", "event", "note"],
      required: true,
    },
    targetId: { type: String, default: "" },
    targetTitle: { type: String, default: "" },
    details: { type: String, default: "" },
    performedBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  { timestamps: false }
);

boxScheduleActivityLogSchema.plugin(epochTimestamps);

boxScheduleActivityLogSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model("BoxScheduleActivityLog", boxScheduleActivityLogSchema);
