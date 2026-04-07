const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
require("dotenv").config();

const connectDB = require("./config/db");
const locationRoutes = require("./routes/locationRoutes");
const boxScheduleRoutes = require("./routes/boxScheduleRoutes");
const authRoutes = require("./routes/authRoutes");
const { authMiddleware } = require("./middleware/auth");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5003;

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Make io accessible in routes/controllers
app.set("io", io);

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Join project room for scoped broadcasts
  socket.on("join_project", (projectId) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project: ${projectId}`);
  });

  socket.on("leave_project", (projectId) => {
    socket.leave(projectId);
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Auth routes (public — no auth middleware)
app.use("/api/v2/auth", authRoutes);

// Routes — all location endpoints require auth
app.use("/api/v2/location", authMiddleware, locationRoutes);

// Box Schedule routes
app.use("/api/v2/box-schedule", authMiddleware, boxScheduleRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "Zillit Location Tool API is running" });
});

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Zillit LCW server running on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
