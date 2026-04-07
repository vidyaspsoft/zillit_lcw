/**
 * Migration: Convert episodes array to single episode per document.
 *
 * Before: { episodes: ["1", "2", "3"], fileName: "Iron Pillar", ... }
 * After:  3 separate documents, each with { episode: "1" }, { episode: "2" }, { episode: "3" }
 *
 * Run: node scripts/migrateEpisodes.js
 */
require("dotenv").config();
const mongoose = require("mongoose");

async function migrate() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.DATABASE_URL);
  console.log("Connected to MongoDB");

  const db = mongoose.connection.db;
  const collection = db.collection("locations");

  // Find all documents that have `episodes` array field
  const docs = await collection.find({ episodes: { $exists: true } }).toArray();
  console.log(`Found ${docs.length} documents with episodes array`);

  let splitCount = 0;
  let convertedCount = 0;

  for (const doc of docs) {
    const episodes = doc.episodes || [];

    if (episodes.length <= 1) {
      // Single episode or empty — just rename field
      const ep = episodes[0] || "";
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: { episode: ep },
          $unset: { episodes: "" },
        }
      );
      convertedCount++;
    } else {
      // Multiple episodes — create copies and update original
      const firstEp = episodes[0];

      // Update original doc to have first episode
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: { episode: firstEp },
          $unset: { episodes: "" },
        }
      );
      convertedCount++;

      // Create new docs for remaining episodes
      for (let i = 1; i < episodes.length; i++) {
        const newDoc = { ...doc };
        delete newDoc._id;
        delete newDoc.__v;
        newDoc.episode = episodes[i];
        delete newDoc.episodes;
        newDoc.createdAt = new Date();
        newDoc.updatedAt = new Date();
        await collection.insertOne(newDoc);
        splitCount++;
      }
    }
  }

  console.log(`\nMigration complete!`);
  console.log(`  Converted: ${convertedCount} documents (episodes[] -> episode)`);
  console.log(`  Split: ${splitCount} new documents created from multi-episode entries`);
  console.log(`  Total documents now: ${await collection.countDocuments()}`);

  // Also clear FolderBadge collection to start fresh with correct keys
  const badgeCollection = db.collection("folderbadges");
  const deleted = await badgeCollection.deleteMany({});
  console.log(`  Cleared ${deleted.deletedCount} FolderBadge documents (will rebuild from activity)`);

  await mongoose.disconnect();
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
