const mongoose = require("mongoose");

const wardrobeUnitChatSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    unit: { type: String, enum: ["select", "shortlist", "final"], required: true },
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
  { timestamps: true }
);

wardrobeUnitChatSchema.index({ projectId: 1, unit: 1, createdAt: -1 });

module.exports = mongoose.model("WardrobeUnitChat", wardrobeUnitChatSchema);
