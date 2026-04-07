const mongoose = require("mongoose");

const wardrobeCommentSchema = new mongoose.Schema(
  {
    wardrobeId: { type: mongoose.Schema.Types.ObjectId, ref: "Wardrobe", required: true },
    projectId: { type: String, required: true },
    userId: { type: String, required: true },
    userName: { type: String, default: "" },
    text: { type: String, required: [true, "Comment text is required"] },
    replyTo: {
      commentId: { type: mongoose.Schema.Types.ObjectId, ref: "WardrobeComment", default: null },
      userName: { type: String, default: "" },
      text: { type: String, default: "" },
    },
    context: {
      episode: { type: String, default: "" },
      sceneNumber: { type: String, default: "" },
    },
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

wardrobeCommentSchema.index({ wardrobeId: 1, createdAt: 1 });
wardrobeCommentSchema.index({ projectId: 1, updatedAt: 1 });

module.exports = mongoose.model("WardrobeComment", wardrobeCommentSchema);
