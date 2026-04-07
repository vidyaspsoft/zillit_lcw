const mongoose = require("mongoose");

/**
 * TalentMeasurements — per-talent body measurements for wardrobe.
 * One record per talent per project.
 */
const talentMeasurementsSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true },
    castId: { type: String, default: "" },
    talentName: { type: String, default: "", trim: true },
    characterName: { type: String, default: "", trim: true },

    // Body measurements
    height: { type: String, default: "" },
    weight: { type: String, default: "" },
    chest: { type: String, default: "" },
    waist: { type: String, default: "" },
    hips: { type: String, default: "" },
    inseam: { type: String, default: "" },
    outseam: { type: String, default: "" },
    neck: { type: String, default: "" },
    sleeveLength: { type: String, default: "" },
    shoulderWidth: { type: String, default: "" },
    shoeSize: { type: String, default: "" },
    hatSize: { type: String, default: "" },
    dressSize: { type: String, default: "" },
    gloveSize: { type: String, default: "" },
    notes: { type: String, default: "" },

    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

talentMeasurementsSchema.index({ projectId: 1, castId: 1 }, { unique: true });
talentMeasurementsSchema.index({ projectId: 1, talentName: 1 });

module.exports = mongoose.model("TalentMeasurements", talentMeasurementsSchema);
