/**
 * Mongoose plugin: store createdAt/updatedAt as epoch numbers (ms) instead of Dates.
 * Use in place of { timestamps: true } to keep all BoxSchedule date fields as Number.
 */
module.exports = function epochTimestamps(schema) {
  schema.add({
    createdAt: { type: Number, default: () => Date.now() },
    updatedAt: { type: Number, default: () => Date.now() },
  });

  schema.pre("save", async function () {
    const now = Date.now();
    if (this.isNew && !this.createdAt) this.createdAt = now;
    this.updatedAt = now;
  });

  const setUpdatedAt = async function () {
    const update = this.getUpdate() || {};
    if (!update.$set) update.$set = {};
    update.$set.updatedAt = Date.now();
    this.setUpdate(update);
  };

  schema.pre("updateOne", setUpdatedAt);
  schema.pre("updateMany", setUpdatedAt);
  schema.pre("findOneAndUpdate", setUpdatedAt);
};
