const mongoose = require("mongoose");

const wardrobeSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      index: true,
    },
    // Tool identifier: "main" (Costume Main) or "background" (Costume Background)
    toolType: {
      type: String,
      enum: ["main", "background"],
      default: "main",
    },

    // ── Cast Link (from Casting module OR temporary) ──
    castId: { type: String, default: "" },
    characterName: { type: String, default: "", trim: true },
    talentName: { type: String, default: "", trim: true },
    gender: { type: String, default: "" },
    contactInfo: [
      {
        type: { type: String, default: "" },
        name: { type: String, default: "" },
        email: { type: String, default: "" },
        countryCode: { type: String, default: "" },
        phone: { type: String, default: "" },
        company: { type: String, default: "" },
      },
    ],
    // true = manually entered cast (not yet finalized in Casting module)
    // false = linked to a real finalized casting entry
    isTemporary: { type: Boolean, default: false },

    // ── Scene / Episode ──
    episode: { type: String, default: "", trim: true },
    sceneNumber: { type: String, default: "", trim: true },

    // ── Wardrobe Details ──
    description: { type: String, default: "" },
    link: { type: String, default: "", trim: true },
    linkPreview: {
      title: { type: String },
      description: { type: String },
      image: { type: String },
      siteName: { type: String },
    },

    // ── Continuity ──
    costumeState: { type: String, default: "" },
    continuityNotes: { type: String, default: "" },
    accessories: { type: String, default: "" },
    hairMakeupState: { type: String, default: "" },
    quickChange: { type: Boolean, default: false },
    changeNotes: { type: String, default: "" },

    // ── Fittings ──
    fittings: [
      {
        fittingType: { type: String, default: "" },
        date: { type: Number, default: null },
        time: { type: String, default: "" },
        location: { type: String, default: "" },
        status: { type: String, default: "" },
        alterations: { type: String, default: "" },
        designerNotes: { type: String, default: "" },
        photos: [
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
    ],

    // ── Pipeline ──
    status: { type: String, default: "select" },
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Wardrobe",
      default: null,
    },

    // ── Media (costume photos/videos — primary content) ──
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

    // ── Standard ──
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    discussion: { type: Boolean, default: false },
    deleted: { type: Number, default: 0 },
    edited: { type: Boolean, default: false },
    lastViewedBy: { type: Map, of: Date, default: {} },
  },
  { timestamps: true }
);

// Indexes
wardrobeSchema.index({ projectId: 1, toolType: 1, status: 1 });
wardrobeSchema.index({ projectId: 1, status: 1, characterName: 1 });
wardrobeSchema.index({ projectId: 1, status: 1, sceneNumber: 1 });
wardrobeSchema.index({ projectId: 1, status: 1, episode: 1 });
wardrobeSchema.index({ projectId: 1, "createdBy.userId": 1 });
wardrobeSchema.index({ projectId: 1, sourceId: 1, status: 1 });
wardrobeSchema.index({ projectId: 1, castId: 1 });
wardrobeSchema.index({ projectId: 1, status: 1, updatedAt: 1 });

module.exports = mongoose.model("Wardrobe", wardrobeSchema);
