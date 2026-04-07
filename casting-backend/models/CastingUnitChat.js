const mongoose = require("mongoose");

/**
 * Casting Unit Chat — chat messages scoped to a tab/unit (select, shortlist, final).
 * Separate from casting-level CastingComment.
 */
const castingUnitChatSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: true,
      index: true,
    },
    // Which unit: select | shortlist | final
    unit: {
      type: String,
      enum: ["select", "shortlist", "final"],
      required: true,
    },
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    text: { type: String, required: true },
    attachments: [
      {
        media: { type: String, default: "" },
        thumbnail: { type: String, default: "" },
        content_type: { type: String, default: "" },
        content_subtype: { type: String, default: "" },
        caption: { type: String, default: "" },
        height: { type: Number, default: 0 },
        width: { type: Number, default: 0 },
        duration: { type: Number, default: 0 },
        bucket: { type: String, default: "" },
        region: { type: String, default: "" },
        name: { type: String, default: "" },
        file_size: { type: String, default: "0" },
      },
    ],
  },
  {
    timestamps: true,
  }
);

castingUnitChatSchema.index({ projectId: 1, unit: 1, createdAt: -1 });

module.exports = mongoose.model("CastingUnitChat", castingUnitChatSchema);
