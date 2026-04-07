#!/usr/bin/env node
/**
 * Seed ScriptBreakdown collection with sample data from "THE LAST WITNESS"
 * Usage: node scripts/seedScriptBreakdown.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const ScriptBreakdown = require("../models/ScriptBreakdown");

const PROJECT_ID = process.argv[2] || "6839c97eb54f09a51508a7c7";

const scenes = [
  // ═══ EPISODE 1 — "THE CALL" ═══
  {
    episode: "1", sceneNumber: "1", scriptName: "The Last Witness",
    sceneTitle: "Mumbai Skyline", sceneDescription: "Wide aerial shot of Mumbai skyline at night. City lights reflecting off the Arabian Sea.",
    intExt: "EXT", dayNight: "NIGHT", locationName: "Mumbai Skyline (Aerial)",
    pageNumber: "1", pageCount: "1/8", characters: [], colorCode: "White",
  },
  {
    episode: "1", sceneNumber: "2", scriptName: "The Last Witness",
    sceneTitle: "Ray's Apartment", sceneDescription: "Detective Ray Malik sits in a dimly lit apartment. Gets a call about a body found with a message written for him.",
    intExt: "INT", dayNight: "NIGHT", locationName: "Ray's Apartment",
    pageNumber: "1", pageCount: "1 2/8", characters: ["Detective Ray Malik"], colorCode: "White",
  },
  {
    episode: "1", sceneNumber: "3", scriptName: "The Last Witness",
    sceneTitle: "Crime Scene - Warehouse", sceneDescription: "Abandoned warehouse. Body found face-up. Message on wall: 'ASK MALIK WHAT HE BURIED'. Ray and Singh investigate.",
    intExt: "INT/EXT", dayNight: "NIGHT", locationName: "Abandoned Warehouse",
    pageNumber: "2", pageCount: "2 4/8", characters: ["Detective Ray Malik", "Officer Singh"], colorCode: "White",
  },
  {
    episode: "1", sceneNumber: "4", scriptName: "The Last Witness",
    sceneTitle: "Ray's Car - Flashback", sceneDescription: "Ray sits in parked car. Flashback to younger Ray running through a field, digging, a terrified face. Returns to present — receives threatening text.",
    intExt: "INT", dayNight: "NIGHT", locationName: "Ray's Car (Parked outside warehouse)",
    pageNumber: "4", pageCount: "1 1/8", characters: ["Detective Ray Malik", "Young Ray"], colorCode: "White",
  },
  {
    episode: "1", sceneNumber: "5", scriptName: "The Last Witness",
    sceneTitle: "Police Station - Morning", sceneDescription: "Busy police station. Sarah identifies victim as Arun Khanna, accountant. Confronts Ray about the message on the wall.",
    intExt: "INT", dayNight: "DAY", locationName: "Police Station",
    pageNumber: "5", pageCount: "1 6/8", characters: ["Detective Ray Malik", "Sarah Mitchell"], colorCode: "White",
  },
  {
    episode: "1", sceneNumber: "6", scriptName: "The Last Witness",
    sceneTitle: "Khanna Residence", sceneDescription: "Modest apartment. Mrs. Khanna describes husband's recent nervous behavior. Mentions locked study and secret meetings.",
    intExt: "INT", dayNight: "DAY", locationName: "Khanna Residence",
    pageNumber: "6", pageCount: "1 3/8", characters: ["Detective Ray Malik", "Sarah Mitchell", "Mrs. Khanna"], colorCode: "White",
  },
  {
    episode: "1", sceneNumber: "7", scriptName: "The Last Witness",
    sceneTitle: "Khanna's Study", sceneDescription: "Small study room. Ray finds a burner phone with messages mentioning 'Malik' and a transfer. Sarah suspicious.",
    intExt: "INT", dayNight: "DAY", locationName: "Khanna Residence - Study",
    pageNumber: "7", pageCount: "1 2/8", characters: ["Detective Ray Malik", "Sarah Mitchell"], colorCode: "White",
  },
  {
    episode: "1", sceneNumber: "8", scriptName: "The Last Witness",
    sceneTitle: "Mumbai Streets - Evening", sceneDescription: "Ray walks through crowded evening streets. Stops at chai stall. Receives threatening text demanding midnight meeting at Bandstand.",
    intExt: "EXT", dayNight: "EVENING", locationName: "Mumbai Streets / Chai Stall",
    pageNumber: "8", pageCount: "1",
    characters: ["Detective Ray Malik"], colorCode: "White",
  },

  // ═══ EPISODE 2 — "THE BURIED TRUTH" ═══
  {
    episode: "2", sceneNumber: "9", scriptName: "The Last Witness",
    sceneTitle: "Bandstand Promenade - Midnight", sceneDescription: "Ray arrives at Bandstand alone. Meets a shadowy figure who reveals knowledge of an incident 15 years ago.",
    intExt: "EXT", dayNight: "NIGHT", locationName: "Bandstand Promenade",
    pageNumber: "9", pageCount: "2 5/8", characters: ["Detective Ray Malik", "The Informant"], colorCode: "Blue",
  },
  {
    episode: "2", sceneNumber: "10", scriptName: "The Last Witness",
    sceneTitle: "Bar Scene", sceneDescription: "Ray goes to a bar to process what he's learned. Bartender Joe serves him and shares an unexpected piece of wisdom.",
    intExt: "INT", dayNight: "NIGHT", locationName: "Downtown Bar",
    pageNumber: "11", pageCount: "1 4/8", characters: ["Detective Ray Malik", "Bartender Joe"], colorCode: "Blue",
  },
  {
    episode: "2", sceneNumber: "11", scriptName: "The Last Witness",
    sceneTitle: "Police Station - Investigation", sceneDescription: "Singh presents forensic evidence. Fingerprints from the warehouse match a cold case from 15 years ago.",
    intExt: "INT", dayNight: "DAY", locationName: "Police Station - Lab",
    pageNumber: "12", pageCount: "2 1/8", characters: ["Detective Ray Malik", "Officer Singh", "Sarah Mitchell"], colorCode: "Blue",
  },
  {
    episode: "2", sceneNumber: "12", scriptName: "The Last Witness",
    sceneTitle: "Ray's Apartment - Flashback", sceneDescription: "Extended flashback: Young Ray at age 26, involved in a cover-up with powerful people. The incident that haunts him.",
    intExt: "INT", dayNight: "NIGHT", locationName: "Ray's Apartment (Past - 15 years ago)",
    pageNumber: "14", pageCount: "3 2/8", characters: ["Young Ray"], colorCode: "Blue",
  },
  {
    episode: "2", sceneNumber: "13", scriptName: "The Last Witness",
    sceneTitle: "Street Market Chase", sceneDescription: "Ray spots a suspect in a crowded street market. Foot chase through narrow lanes, vendors, auto-rickshaws.",
    intExt: "EXT", dayNight: "DAY", locationName: "Street Market",
    pageNumber: "17", pageCount: "1 6/8",
    characters: ["Detective Ray Malik", "Officer Singh"], colorCode: "Blue",
    notes: "Stunt coordination required. Close streets for chase sequence.",
  },
  {
    episode: "2", sceneNumber: "14", scriptName: "The Last Witness",
    sceneTitle: "Sarah's Apartment", sceneDescription: "Sarah researches Ray's past independently. Discovers connection between Ray and victim from 15 years ago.",
    intExt: "INT", dayNight: "NIGHT", locationName: "Sarah's Apartment",
    pageNumber: "19", pageCount: "1 3/8", characters: ["Sarah Mitchell"], colorCode: "Blue",
  },

  // ═══ EPISODE 3 — "THE LAST WITNESS" ═══
  {
    episode: "3", sceneNumber: "15", scriptName: "The Last Witness",
    sceneTitle: "Hospital Room", sceneDescription: "Ray visits an old colleague in the hospital who was involved in the cover-up. Begs for the truth before it's too late.",
    intExt: "INT", dayNight: "DAY", locationName: "City Hospital - Room 312",
    pageNumber: "20", pageCount: "2 1/8",
    characters: ["Detective Ray Malik", "Dr. Mehra", "Nurse Kelly"], colorCode: "Pink",
  },
  {
    episode: "3", sceneNumber: "16", scriptName: "The Last Witness",
    sceneTitle: "Courtroom", sceneDescription: "Judge Morrison presides over a hearing related to the cold case reopening. Dramatic testimony reveals hidden evidence.",
    intExt: "INT", dayNight: "DAY", locationName: "City Courthouse - Courtroom 4",
    pageNumber: "22", pageCount: "3 4/8",
    characters: ["Detective Ray Malik", "Sarah Mitchell", "Judge Morrison"], colorCode: "Pink",
  },
  {
    episode: "3", sceneNumber: "17", scriptName: "The Last Witness",
    sceneTitle: "Abandoned Factory - Climax", sceneDescription: "Ray confronts the mastermind at the same factory where it all began 15 years ago. Truth finally comes out.",
    intExt: "INT/EXT", dayNight: "NIGHT", locationName: "Abandoned Factory (Outskirts)",
    pageNumber: "25", pageCount: "4 2/8",
    characters: ["Detective Ray Malik", "The Informant", "Officer Singh"], colorCode: "Pink",
    notes: "Key climax scene. Requires extensive lighting setup. Stunt coordination for fight sequence.",
  },
  {
    episode: "3", sceneNumber: "18", scriptName: "The Last Witness",
    sceneTitle: "Ray's Mother's House", sceneDescription: "Ray visits his mother. Flashback intercut with present. Emotional reconciliation. She knew all along.",
    intExt: "INT", dayNight: "DAY", locationName: "Mrs. Malik's House",
    pageNumber: "29", pageCount: "2 5/8",
    characters: ["Detective Ray Malik", "Mrs. Malik (Ray's Mother)", "Young Ray"], colorCode: "Pink",
  },
  {
    episode: "3", sceneNumber: "19", scriptName: "The Last Witness",
    sceneTitle: "Police Station - Epilogue", sceneDescription: "Ray turns in his badge. Sarah watches him leave. Singh salutes. The case file closes.",
    intExt: "INT", dayNight: "DAY", locationName: "Police Station",
    pageNumber: "31", pageCount: "1 4/8",
    characters: ["Detective Ray Malik", "Sarah Mitchell", "Officer Singh"], colorCode: "Pink",
  },
  {
    episode: "3", sceneNumber: "20", scriptName: "The Last Witness",
    sceneTitle: "Mumbai Skyline - Closing", sceneDescription: "Wide aerial shot of Mumbai at dawn. Ray walks alone on Marine Drive. Voice of God narration closes the series.",
    intExt: "EXT", dayNight: "DAWN", locationName: "Marine Drive",
    pageNumber: "32", pageCount: "1/2",
    characters: ["Detective Ray Malik"], colorCode: "Pink",
    notes: "Mirror of opening shot. Golden hour required.",
  },
];

async function seed() {
  await connectDB();

  // Clear existing
  await ScriptBreakdown.deleteMany({ projectId: PROJECT_ID });
  console.log("Cleared existing script breakdowns");

  // Insert
  const docs = scenes.map((s) => ({
    ...s,
    projectId: PROJECT_ID,
    createdBy: { userId: "seed", name: "System" },
  }));

  const inserted = await ScriptBreakdown.insertMany(docs);
  console.log(`Seeded ${inserted.length} script breakdown scenes`);
  console.log("\nEpisode 1: 8 scenes (The Call)");
  console.log("Episode 2: 6 scenes (The Buried Truth)");
  console.log("Episode 3: 6 scenes (The Last Witness)");

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed error:", err);
  process.exit(1);
});
