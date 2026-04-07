const mongoose = require("mongoose");

const castingActivityLogSchema = new mongoose.Schema(
  {
    castingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Casting",
    },
    projectId: {
      type: String,
    },
    userId: {
      type: String,
    },
    userName: {
      type: String,
      default: "",
    },
    // Action types: created, edited, moved, deleted, restored, commented, shared, attachment_added
    action: {
      type: String,
      required: true,
    },
    details: {
      type: String,
      default: "",
    },
    previousValue: {
      type: String,
      default: "",
    },
    newValue: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

castingActivityLogSchema.index({ castingId: 1, createdAt: -1 });
castingActivityLogSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model("CastingActivityLog", castingActivityLogSchema);
