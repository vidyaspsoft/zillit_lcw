const mongoose = require("mongoose");

const wardrobeUnitSchema = new mongoose.Schema(
  {
    projectId: { type: String, required: [true, "Project ID is required"], index: true },
    identifier: { type: String, required: [true, "Identifier is required"], trim: true },
    label: { type: String, required: [true, "Label is required"], trim: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

wardrobeUnitSchema.index({ projectId: 1, identifier: 1 }, { unique: true });
wardrobeUnitSchema.index({ projectId: 1, order: 1 });

module.exports = mongoose.model("WardrobeUnit", wardrobeUnitSchema);
