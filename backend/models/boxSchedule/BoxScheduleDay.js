const mongoose = require("mongoose");

/**
 * BoxScheduleDay — Individual schedule day entries.
 * Each entry represents a block of scheduled days (e.g., "Shoot Week 1" covering Apr 8-12).
 * Stores denormalized type data (typeName, color) for fast calendar reads.
 */
const boxScheduleDaySchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      index: true,
    },
    title: {
      type: String,
      default: "",
      trim: true,
    },
    typeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BoxScheduleType",
      required: [true, "Schedule type is required"],
    },
    // Denormalized from BoxScheduleType for fast calendar rendering
    typeName: {
      type: String,
      default: "",
    },
    color: {
      type: String,
      default: "#3498DB",
    },
    // Date selection mode (matches Android app)
    dateRangeType: {
      type: String,
      enum: ["by_dates", "by_days"],
      default: "by_dates",
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    numberOfDays: {
      type: Number,
      default: 0,
    },
    // List of epoch timestamps for each day (Android compatibility)
    calendarDays: [
      {
        type: Number,
      },
    ],
    timezone: {
      type: String,
      default: "UTC",
    },
    // Conflict resolution action
    conflictAction: {
      type: String,
      enum: ["", "replace", "extend", "overlap"],
      default: "",
    },
    // Optimistic concurrency for Android compatibility
    version: {
      type: Number,
      default: 1,
    },
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
    // Soft delete timestamp
    deleted: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

boxScheduleDaySchema.index({ projectId: 1, startDate: 1 });
boxScheduleDaySchema.index({ projectId: 1, calendarDays: 1 });
boxScheduleDaySchema.index({ projectId: 1, typeId: 1 });
boxScheduleDaySchema.index({ projectId: 1, deleted: 1 });

module.exports = mongoose.model("BoxScheduleDay", boxScheduleDaySchema);
