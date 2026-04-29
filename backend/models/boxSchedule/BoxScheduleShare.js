const mongoose = require("mongoose");
const epochTimestamps = require("./_epochTimestamps");

// Embedded attachment — shape matches the cross-platform Zillit attachment model.
const attachmentSchema = new mongoose.Schema(
  {
    bucket: { type: String, default: "" },
    region: { type: String, default: "" },
    content_type: { type: String, default: "document" },
    content_subtype: { type: String, default: "pdf" },
    media: { type: String, default: "" },          // S3 key (path inside the bucket)
    thumbnail: { type: String, default: "" },      // S3 key
    name: { type: String, default: "" },
    file_size: { type: String, default: "0" },     // string per legacy model
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
  },
  { _id: false }
);

const boxScheduleShareSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    token: { type: String, required: true, unique: true, index: true },
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    // Generated PDF — present when share-link generation produced one.
    attachment: { type: attachmentSchema, default: null },
    pdfGeneratedAt: { type: Number, default: 0 }, // Epoch ms
    // Epoch ms (0 = no expiration)
    expiresAt: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: false }
);

boxScheduleShareSchema.plugin(epochTimestamps);

module.exports = mongoose.model("BoxScheduleShare", boxScheduleShareSchema);
