const mongoose = require("mongoose");

/**
 * ScriptBreakdown — Script scene data used by Location, Casting, and Costume tools.
 * Each entry represents a scene in the script with its metadata.
 */
const scriptBreakdownSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      index: true,
    },
    // Script info
    scriptName: { type: String, default: "" },
    episode: { type: String, default: "", trim: true },
    sceneNumber: { type: String, default: "", trim: true },

    // Scene details
    sceneTitle: { type: String, default: "" },
    sceneDescription: { type: String, default: "" },
    intExt: { type: String, default: "" }, // INT, EXT, INT/EXT
    dayNight: { type: String, default: "" }, // DAY, NIGHT, DAWN, DUSK
    locationName: { type: String, default: "" }, // scripted location name
    pageNumber: { type: String, default: "" },
    pageCount: { type: String, default: "" }, // e.g., "2 3/8"

    // Characters in this scene
    characters: [{ type: String }],

    // Additional
    notes: { type: String, default: "" },
    colorCode: { type: String, default: "" }, // page color (White, Blue, Pink, Yellow, Green)

    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

scriptBreakdownSchema.index({ projectId: 1, episode: 1 });
scriptBreakdownSchema.index({ projectId: 1, sceneNumber: 1 });
scriptBreakdownSchema.index({ projectId: 1, episode: 1, sceneNumber: 1 });

module.exports = mongoose.model("ScriptBreakdown", scriptBreakdownSchema);
