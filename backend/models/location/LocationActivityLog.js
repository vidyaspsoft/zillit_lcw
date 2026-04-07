const mongoose = require("mongoose");

const locationActivityLogSchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
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
    // Action types: created, status_changed, edited, commented, attachment_added, deleted, moved
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

locationActivityLogSchema.index({ locationId: 1, createdAt: -1 });
locationActivityLogSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model("LocationActivityLog", locationActivityLogSchema);
