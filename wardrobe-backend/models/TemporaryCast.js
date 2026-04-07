const mongoose = require("mongoose");

/**
 * TemporaryCast — temporary character entries for wardrobe.
 * Used when a character hasn't been finalized in Casting yet.
 */
const temporaryCastSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true },
    characterName: { type: String, required: true, trim: true },
    talentName: { type: String, default: "", trim: true },
    gender: { type: String, default: "" },
    notes: { type: String, default: "" },
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    deleted: { type: Number, default: 0 },
  },
  { timestamps: true }
);

temporaryCastSchema.index({ projectId: 1, deleted: 1 });
temporaryCastSchema.index({ projectId: 1, characterName: 1 });

module.exports = mongoose.model("TemporaryCast", temporaryCastSchema);
