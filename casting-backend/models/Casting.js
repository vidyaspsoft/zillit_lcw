const mongoose = require("mongoose");

const castingSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      index: true,
    },
    // Tool identifier: "main" (Main Casting) or "background" (Background/Extras Casting)
    toolType: {
      type: String,
      enum: ["main", "background"],
      default: "main",
    },
    // Character being cast (used for folder grouping)
    characterName: {
      type: String,
      default: "",
      trim: true,
    },
    // Actor/talent auditioning for the role
    talentName: {
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
    // Gender of the talent
    gender: {
      type: String,
      default: "",
    },
    // ── Talent Profile / Resume ──
    age: { type: Number, default: null },
    ethnicity: { type: String, default: "" },
    height: { type: String, default: "" },
    build: { type: String, default: "" },
    hairColor: { type: String, default: "" },
    eyeColor: { type: String, default: "" },
    specialSkills: { type: String, default: "" },
    unionStatus: { type: String, default: "" },
    // ── Audition ──
    auditionType: { type: String, default: "" },
    auditionDate: { type: Number, default: null },
    auditionTime: { type: String, default: "" },
    auditionLocation: { type: String, default: "" },
    auditionStatus: { type: String, default: "" },
    auditionRating: { type: Number, default: 0 },
    auditionNotes: { type: String, default: "" },
    callbackRound: { type: Number, default: 0 },
    sides: { type: String, default: "" },
    // ── Director's Pick ──
    directorPick: { type: Boolean, default: false },
    // Main cast or background/extra
    castType: {
      type: String,
      default: "",
    },
    // Production ranking number (#1 = lead, #2 = second lead, etc.)
    // Belongs to the CHARACTER, not the talent — if actor is replaced, number stays.
    // Unique per characterName within a project.
    // Usually empty in Selects/Shortlisted, assigned when Finalized.
    characterNumber: {
      type: Number,
      default: null,
    },
    // How often the talent works
    jobFrequency: {
      type: String,
      default: "",
    },
    // Audition notes, director feedback, deal terms
    description: {
      type: String,
      default: "",
    },
    // External link (IMDb, demo reel, casting profile)
    link: {
      type: String,
      default: "",
      trim: true,
    },
    // Link preview metadata (OG tags)
    linkPreview: {
      title: { type: String },
      description: { type: String },
      image: { type: String },
      siteName: { type: String },
    },
    // Multiple contacts: agent, manager, talent direct, etc.
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
    // When is this talent free to shoot? (stored as epoch timestamps in milliseconds)
    availabilityDates: [{ type: Number }],
    // Pipeline status — matches CastingUnit.identifier (select, shortlist, final)
    status: {
      type: String,
      default: "select",
    },
    // Source casting ID — tracks which original this was copied from
    // Used to detect duplicate moves (same talent + same character to same unit)
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Casting",
      default: null,
    },
    // All attachments (headshots, audition tapes, self-tapes, resumes, PDFs)
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
    // Discussion enabled (casting-level chat)
    discussion: {
      type: Boolean,
      default: false,
    },
    // Soft delete timestamp (0 = active, timestamp = deleted)
    deleted: {
      type: Number,
      default: 0,
    },
    // Edited flag
    edited: {
      type: Boolean,
      default: false,
    },
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
castingSchema.index({ projectId: 1, toolType: 1, status: 1 });
castingSchema.index({ projectId: 1, status: 1, characterName: 1 });
castingSchema.index({ projectId: 1, status: 1, talentName: 1 });
castingSchema.index({ projectId: 1, status: 1, episode: 1 });
castingSchema.index({ projectId: 1, "createdBy.userId": 1 });
castingSchema.index({ projectId: 1, sourceId: 1, status: 1 });
// Character number uniqueness validation queries
castingSchema.index({ projectId: 1, characterNumber: 1 });
// Sync index — efficient timestamp-based cursor pagination for mobile
castingSchema.index({ projectId: 1, status: 1, updatedAt: 1 });

module.exports = mongoose.model("Casting", castingSchema);
