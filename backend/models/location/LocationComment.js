const mongoose = require("mongoose");

const locationCommentSchema = new mongoose.Schema(
  {
    locationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },
    projectId: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    userName: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      required: [true, "Comment text is required"],
    },
    // Reply to another comment (threading)
    replyTo: {
      commentId: { type: mongoose.Schema.Types.ObjectId, ref: "LocationComment", default: null },
      userName: { type: String, default: "" },
      text: { type: String, default: "" },
    },
    // Context: which episode/scene this comment relates to
    // Allows filtering discussions per episode/scene folder
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
  {
    timestamps: true,
  }
);

locationCommentSchema.index({ locationId: 1, createdAt: 1 });
locationCommentSchema.index({ locationId: 1, "context.episode": 1 });
locationCommentSchema.index({ locationId: 1, "context.sceneNumber": 1 });
// Sync index — for mobile timestamp-based sync
locationCommentSchema.index({ projectId: 1, updatedAt: 1 });

module.exports = mongoose.model("LocationComment", locationCommentSchema);
