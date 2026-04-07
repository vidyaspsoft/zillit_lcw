const mongoose = require("mongoose");

/**
 * CharacterBreakdown — shared character details for a role.
 * One breakdown per character per project, shared across all talents auditioning for the same role.
 */
const characterBreakdownSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
    },
    characterName: {
      type: String,
      required: [true, "Character name is required"],
      trim: true,
    },
    characterDescription: {
      type: String,
      default: "",
    },
    ageRange: {
      type: String,
      default: "",
    },
    characterArc: {
      type: String,
      default: "",
    },
    sceneCount: {
      type: Number,
      default: 0,
    },
    relationships: {
      type: String,
      default: "",
    },
    episodes: [{ type: String }],
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  {
    timestamps: true,
  }
);

// One breakdown per character per project
characterBreakdownSchema.index({ projectId: 1, characterName: 1 }, { unique: true });

module.exports = mongoose.model("CharacterBreakdown", characterBreakdownSchema);
