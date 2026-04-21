#!/usr/bin/env node
/**
 * Seed projects + users into the zillit-map auth database.
 * Idempotent: re-running won't create duplicates.
 *
 * Usage: node scripts/seedAuthData.js
 */
require("dotenv").config();
const mapConnection = require("../config/mapDb");
const Project = require("../models/Project");
const User = require("../models/User");

const seedData = [
  {
    project: { name: "Zillit Film Production", description: "Film production and location scouting project" },
    users: [
      { name: "Vidya Sagar", email: "vidya@zillit.com", role: "admin" },
      { name: "Production Manager", email: "pm@zillit.com", role: "member" },
      { name: "Assistant Director", email: "ad@zillit.com", role: "member" },
    ],
  },
  {
    project: { name: "Metro Studios", description: "Studio management and coordination" },
    users: [
      { name: "Studio Head", email: "head@metro.com", role: "admin" },
      { name: "Coordinator", email: "coord@metro.com", role: "member" },
    ],
  },
];

async function seed() {
  await new Promise((resolve, reject) => {
    if (mapConnection.readyState === 1) return resolve();
    mapConnection.once("connected", resolve);
    mapConnection.once("error", reject);
  });

  console.log("Connected to zillit-map\n");

  for (const { project: projectData, users: usersData } of seedData) {
    const project = await Project.findOneAndUpdate(
      { name: projectData.name },
      { $set: projectData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    console.log(`Project: ${project.name} (${project._id})`);

    for (const userData of usersData) {
      const user = await User.findOneAndUpdate(
        { name: userData.name, projectId: project._id },
        { $set: { ...userData, projectId: project._id } },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      console.log(`  - ${user.name} [${user.role}] (${user._id})`);
    }
    console.log();
  }

  await mapConnection.close();
  console.log("Done.");
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
