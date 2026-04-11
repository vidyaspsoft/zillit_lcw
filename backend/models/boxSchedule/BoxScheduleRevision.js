const mongoose = require("mongoose");
const epochTimestamps = require("./_epochTimestamps");

const REVISION_COLORS = ["White", "Blue", "Pink", "Yellow", "Green", "Goldenrod"];

const boxScheduleRevisionSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: true, index: true },
    revisionNumber: { type: Number, required: true },
    revisionColor: { type: String, default: "White" },
    typeColor: { type: String, default: "" }, // HEX color of the schedule type
    description: { type: String, default: "" },
    snapshotSummary: { type: String, default: "" },
    changedBy: {
      userId: { type: String, default: "" },
      name: { type: String, default: "" },
    },
  },
  { timestamps: false }
);

boxScheduleRevisionSchema.plugin(epochTimestamps);

boxScheduleRevisionSchema.index({ projectId: 1, revisionNumber: -1 });

boxScheduleRevisionSchema.statics.REVISION_COLORS = REVISION_COLORS;

boxScheduleRevisionSchema.statics.createRevision = async function (projectId, description, changedBy, typeColor) {
  const latest = await this.findOne({ projectId }).sort({ revisionNumber: -1 }).lean();
  const nextNum = (latest?.revisionNumber || 0) + 1;
  const colorIndex = (nextNum - 1) % REVISION_COLORS.length;

  return this.create({
    projectId,
    revisionNumber: nextNum,
    revisionColor: REVISION_COLORS[colorIndex],
    typeColor: typeColor || "",
    description,
    changedBy,
  });
};

module.exports = mongoose.model("BoxScheduleRevision", boxScheduleRevisionSchema);
