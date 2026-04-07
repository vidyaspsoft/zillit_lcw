const mongoose = require("mongoose");

/**
 * ProjectConfig — per-project field configuration.
 * Stores which fields are mandatory for each tool.
 * One config per project per tool.
 */
const projectConfigSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true },
    tool: { type: String, required: true }, // "location", "casting", "wardrobe"
    // Array of field names that are required
    requiredFields: [{ type: String }],
    updatedBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

projectConfigSchema.index({ projectId: 1, tool: 1 }, { unique: true });

module.exports = mongoose.model("ProjectConfig", projectConfigSchema);
