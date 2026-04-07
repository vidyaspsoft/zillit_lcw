const mongoose = require("mongoose");

/**
 * FolderBadge — per-folder activity counter for badge computation.
 *
 * folderKey examples:
 *   "select"                         → tab-level
 *   "select|ep:1"                    → Episode 1 folder
 *   "select|fn:Iron Pillar"          → Location-name folder
 *   "select|ep:1|fn:Iron Pillar"     → Location-name inside Episode 1
 *   "select|ep:1|fn:Iron Pillar|sc:2"→ Scene 2 inside Episode 1 > Iron Pillar
 *
 * Badge for a user = activityCount − (viewedBy[userId] || 0)
 */
const folderBadgeSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true },
    folderKey: { type: String, required: true },
    activityCount: { type: Number, default: 0 },
    // When a user opens this folder, set viewedBy[userId] = activityCount
    viewedBy: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

folderBadgeSchema.index({ projectId: 1, folderKey: 1 }, { unique: true });

module.exports = mongoose.model("FolderBadge", folderBadgeSchema);
