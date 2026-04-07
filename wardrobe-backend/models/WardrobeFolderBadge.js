const mongoose = require("mongoose");

const wardrobeFolderBadgeSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true },
    folderKey: { type: String, required: true },
    activityCount: { type: Number, default: 0 },
    viewedBy: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

wardrobeFolderBadgeSchema.index({ projectId: 1, folderKey: 1 }, { unique: true });

module.exports = mongoose.model("WardrobeFolderBadge", wardrobeFolderBadgeSchema);
