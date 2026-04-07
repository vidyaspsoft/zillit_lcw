const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");
require("dotenv").config();

const connectDB = require("./config/db");
const wardrobeRoutes = require("./routes/wardrobeRoutes");
const authRoutes = require("./routes/authRoutes");
const { authMiddleware } = require("./middleware/auth");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5005;

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
});

app.set("io", io);

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("join_project", (projectId) => {
    socket.join(projectId);
    console.log(`Socket ${socket.id} joined project: ${projectId}`);
  });
  socket.on("leave_project", (projectId) => socket.leave(projectId));
  socket.on("disconnect", () => console.log("Client disconnected:", socket.id));
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/v2/auth", authRoutes);
app.use("/api/v2/wardrobe", authMiddleware, wardrobeRoutes);

app.get("/", (req, res) => {
  res.json({ success: true, message: "Zillit Costume Tool API is running" });
});

const startServer = async () => {
  await connectDB();
  server.listen(PORT, () => console.log(`Costume Tool server running on port ${PORT}`));
};

if (require.main === module) startServer();

module.exports = { app, server, io };
