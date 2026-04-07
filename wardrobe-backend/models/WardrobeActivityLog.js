const mongoose = require("mongoose");

const wardrobeActivityLogSchema = new mongoose.Schema(
  {
    wardrobeId: { type: mongoose.Schema.Types.ObjectId, ref: "Wardrobe" },
    projectId: { type: String },
    userId: { type: String },
    userName: { type: String, default: "" },
    action: { type: String, required: true },
    details: { type: String, default: "" },
    previousValue: { type: String, default: "" },
    newValue: { type: String, default: "" },
  },
  { timestamps: true }
);

wardrobeActivityLogSchema.index({ wardrobeId: 1, createdAt: -1 });
wardrobeActivityLogSchema.index({ projectId: 1, createdAt: -1 });

module.exports = mongoose.model("WardrobeActivityLog", wardrobeActivityLogSchema);
