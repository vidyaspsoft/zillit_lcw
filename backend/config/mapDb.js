const mongoose = require("mongoose");

/**
 * Separate connection to the map database (zillit-map)
 * for fetching Projects and Users during auth.
 * The location backend's main connection goes to zillit-location.
 */
const MAP_DB_URI = process.env.MONGODB_URI.replace("zillit-location", "zillit-map");

const mapConnection = mongoose.createConnection(MAP_DB_URI);

mapConnection.on("connected", () => {
  console.log("Connected to map database for auth");
});

mapConnection.on("error", (err) => {
  console.error("Map database connection error:", err.message);
});

module.exports = mapConnection;
