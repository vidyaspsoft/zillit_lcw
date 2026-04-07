const mongoose = require("mongoose");

/**
 * BoxScheduleEvent — Events and notes attached to schedule days.
 *
 * Two types:
 * - "event" = Full calendar event (time, location, reminder, repeat)
 * - "note"  = Quick note (just title + text)
 */
const boxScheduleEventSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      index: true,
    },
    scheduleDayId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoxScheduleDay",
      default: null,
    },
    // Epoch timestamp of the schedule day this belongs to
    date: {
      type: Number,
      default: 0,
    },
    // Event type
    eventType: {
      type: String,
      enum: ["event", "note"],
      default: "note",
    },

    // ── Common fields ──
    title: {
      type: String,
      default: "",
      trim: true,
    },
    color: {
      type: String,
      default: "#3498DB",
      trim: true,
    },

    // ── Event-only fields (eventType = "event") ──
    description: {
      type: String,
      default: "",
    },
    startDateTime: {
      type: Date,
      default: null,
    },
    endDateTime: {
      type: Date,
      default: null,
    },
    fullDay: {
      type: Boolean,
      default: false,
    },
    location: {
      type: String,
      default: "",
      trim: true,
    },
    reminder: {
      type: String,
      enum: ["none", "at_time", "5min", "15min", "30min", "1hr", "1day"],
      default: "none",
    },
    repeatStatus: {
      type: String,
      enum: ["none", "daily", "weekly", "monthly"],
      default: "none",
    },
    repeatEndDate: {
      type: Date,
      default: null,
    },
    // Timezone (e.g., "Asia/Calcutta", "America/Los_Angeles")
    timezone: {
      type: String,
      default: "",
      trim: true,
    },
    // Call type
    callType: {
      type: String,
      enum: ["", "meet_in_person", "audio", "video"],
      default: "",
    },
    // Text color (separate from background color)
    textColor: {
      type: String,
      default: "",
      trim: true,
    },
    // Location coordinates
    locationLat: {
      type: Number,
      default: null,
    },
    locationLng: {
      type: Number,
      default: null,
    },
    // Distribution — who gets notified (placeholder for future integration)
    distributeTo: {
      type: String,
      enum: ["", "self", "users", "departments", "all_departments"],
      default: "",
    },
    distributeUserIds: [{ type: String }],
    distributeDepartmentIds: [{ type: String }],
    // Organizer exclusion
    organizerExcluded: {
      type: Boolean,
      default: false,
    },
    // Advanced fields enabled (the "check this box" toggle)
    advancedEnabled: {
      type: Boolean,
      default: false,
    },

    // ── Note-only fields (eventType = "note") ──
    notes: {
      type: String,
      default: "",
    },

    // ── Meta ──
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    deleted: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

boxScheduleEventSchema.index({ projectId: 1, date: 1 });
boxScheduleEventSchema.index({ projectId: 1, scheduleDayId: 1 });
boxScheduleEventSchema.index({ projectId: 1, eventType: 1 });

module.exports = mongoose.model("BoxScheduleEvent", boxScheduleEventSchema);
