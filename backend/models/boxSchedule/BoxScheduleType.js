const mongoose = require("mongoose");
const epochTimestamps = require("./_epochTimestamps");

/**
 * BoxScheduleType — Schedule type definitions (Prep, Shoot, Wrap, Day Off, Travel + custom).
 * System-defined types are seeded on first fetch and cannot be deleted.
 * Timestamps stored as epoch milliseconds (Number).
 */
const boxScheduleTypeSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Type title is required"],
      trim: true,
    },
    color: {
      type: String,
      default: "#3498DB",
      trim: true,
    },
    systemDefined: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Number,
      default: 0,
    },
    createdBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  { timestamps: false }
);

boxScheduleTypeSchema.plugin(epochTimestamps);

boxScheduleTypeSchema.index({ projectId: 1, title: 1 }, { unique: true });

/**
 * Seed system-defined types for a project if none exist.
 */
boxScheduleTypeSchema.statics.seedDefaults = async function (projectId, createdBy) {
  const existing = await this.countDocuments({ projectId });
  if (existing > 0) return;

  const defaults = [
    { title: "Prep", color: "#F39C12", order: 0 },
    { title: "Shoot", color: "#E74C3C", order: 1 },
    { title: "Wrap", color: "#27AE60", order: 2 },
    { title: "Day Off", color: "#95A5A6", order: 3 },
    { title: "Travel", color: "#3498DB", order: 4 },
  ];

  const docs = defaults.map((d) => ({
    ...d,
    projectId,
    systemDefined: true,
    createdBy: createdBy || { userId: "", name: "" },
  }));

  await this.insertMany(docs);
};

module.exports = mongoose.model("BoxScheduleType", boxScheduleTypeSchema);
