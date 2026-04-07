const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      index: true,
    },
    // Location name (used for folder grouping)
    fileName: {
      type: String,
      default: "",
      trim: true,
    },
    sceneNumber: {
      type: String,
      default: "",
      trim: true,
    },
    // Single episode per document (multiple episodes = multiple documents)
    episode: {
      type: String,
      default: "",
      trim: true,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      default: "",
    },
    contactName: {
      type: String,
      default: "",
      trim: true,
    },
    phone: {
      type: String,
      default: "",
      trim: true,
    },
    countryCode: {
      type: String,
      default: "",
      trim: true,
    },
    email: {
      type: String,
      default: "",
      trim: true,
    },
    link: {
      type: String,
      default: "",
      trim: true,
    },
    // Link preview metadata
    linkPreview: {
      title: { type: String },
      description: { type: String },
      image: { type: String },
      siteName: { type: String },
    },
    // GPS coordinates
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    // Additional location details
    subLocation: {
      type: String,
      default: "",
      trim: true,
    },
    interiorExterior: {
      type: String,
      enum: ["", "interior", "exterior", "both"],
      default: "",
    },
    dayNight: {
      type: String,
      enum: ["", "day", "night", "both"],
      default: "",
    },
    parking: {
      type: String,
      default: "",
      trim: true,
    },
    permits: {
      type: String,
      default: "",
      trim: true,
    },
    notes: {
      type: String,
      default: "",
    },
    // Pipeline status — matches Unit.identifier (e.g., "library", "select", "shortlist", "final")
    status: {
      type: String,
      default: "select",
    },
    // Source location ID — tracks which original this was copied from
    // Used to detect duplicate moves (same image + same details to same unit)
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      default: null,
    },
    // All attachments (images/videos/pdfs)
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
    // Who uploaded
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    // Discussion enabled (image-level chat)
    discussion: {
      type: Boolean,
      default: false,
    },
    // Soft delete timestamp
    deleted: {
      type: Number,
      default: 0,
    },
    // Edited flag
    edited: {
      type: Boolean,
      default: false,
    },
    // (Legacy) badge fields removed — badges now live in FolderBadge collection
    // Track when item was last viewed by users (for badge calc)
    lastViewedBy: {
      type: Map,
      of: Date,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
locationSchema.index({ projectId: 1, status: 1 });
locationSchema.index({ projectId: 1, status: 1, fileName: 1 });
locationSchema.index({ projectId: 1, status: 1, sceneNumber: 1 });
locationSchema.index({ projectId: 1, status: 1, episode: 1 });
locationSchema.index({ projectId: 1, "createdBy.userId": 1 });
locationSchema.index({ projectId: 1, sourceId: 1, status: 1 });
// Sync index — efficient timestamp-based cursor pagination for mobile
locationSchema.index({ projectId: 1, status: 1, updatedAt: 1 });

module.exports = mongoose.model("Location", locationSchema);
