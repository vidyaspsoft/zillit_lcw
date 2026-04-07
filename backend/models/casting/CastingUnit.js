const mongoose = require("mongoose");

const castingUnitSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      index: true,
    },
    identifier: {
      type: String,
      required: [true, "Identifier is required"],
      trim: true,
    },
    label: {
      type: String,
      required: [true, "Label is required"],
      trim: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index: unique identifier per project
castingUnitSchema.index({ projectId: 1, identifier: 1 }, { unique: true });
castingUnitSchema.index({ projectId: 1, order: 1 });

module.exports = mongoose.model("CastingUnit", castingUnitSchema);
