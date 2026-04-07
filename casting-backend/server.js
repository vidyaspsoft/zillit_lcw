const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
require("dotenv").config();

const connectDB = require("./config/db");
const castingRoutes = require("./routes/castingRoutes");
const authRoutes = require("./routes/authRoutes");
const { authMiddleware } = require("./middleware/auth");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5004;

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

// Casting routes — all require auth
app.use("/api/v2/casting", authMiddleware, castingRoutes);

// Health check
app.get("/", (req, res) => {
  res.json({ success: true, message: "Zillit Casting Tool API is running" });
});

const startServer = async () => {
  await connectDB();

  server.listen(PORT, () => {
    console.log(`Casting Tool server running on port ${PORT}`);
  });
};

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
