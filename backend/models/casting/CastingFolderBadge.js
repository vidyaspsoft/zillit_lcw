const mongoose = require("mongoose");

/**
 * CastingFolderBadge — per-folder activity counter for badge computation.
 *
 * folderKey examples:
 *   "select"                              → tab-level
 *   "select|ep:EP01"                      → Episode 01 folder
 *   "select|ch:Detective Ray"             → Character folder
 *   "select|ep:EP01|ch:Detective Ray"     → Character inside Episode
 *   "select|ep:EP01|ch:Detective Ray|tl:Riz Ahmed" → Talent inside Character inside Episode
 *
 * Badge for a user = activityCount - (viewedBy[userId] || 0)
 */
const castingFolderBadgeSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true },
    folderKey: { type: String, required: true },
    activityCount: { type: Number, default: 0 },
    // When a user opens this folder, set viewedBy[userId] = activityCount
    viewedBy: { type: Map, of: Number, default: {} },
  },
  { timestamps: true }
);

castingFolderBadgeSchema.index({ projectId: 1, folderKey: 1 }, { unique: true });

module.exports = mongoose.model("CastingFolderBadge", castingFolderBadgeSchema);
