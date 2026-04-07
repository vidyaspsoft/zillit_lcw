const express = require("express");
const router = express.Router();
const { decryptModuleData } = require("../middleware/auth");
const Project = require("../models/Project");
const User = require("../models/User");

/**
 * GET /api/v2/auth/projects
 * List all projects (public — no auth needed for login screen).
 */
router.get("/projects", async (req, res) => {
  try {
    const projects = await Project.find().sort({ name: 1 });
    return res.json({ status: 1, message: "Success", data: projects });
  } catch (error) {
    console.error("Get projects error:", error.message);
    return res.status(500).json({ status: 0, message: "Failed to fetch projects" });
  }
});

/**
 * GET /api/v2/auth/projects/:projectId/users
 * List users for a specific project (public — no auth needed for login screen).
 */
router.get("/projects/:projectId/users", async (req, res) => {
  try {
    const users = await User.find({ projectId: req.params.projectId }).sort({ name: 1 });
    return res.json({ status: 1, message: "Success", data: users });
  } catch (error) {
    console.error("Get users error:", error.message);
    return res.status(500).json({ status: 0, message: "Failed to fetch users" });
  }
});

/**
 * POST /api/v2/auth/login
 * Validates userId exists in DB and belongs to the given project.
 */
router.post("/login", async (req, res) => {
  try {
    const { userId, projectId, deviceId } = req.body;

    if (!userId || !projectId || !deviceId) {
      return res.status(400).json({
        status: 0,
        message: "userId, projectId, and deviceId are required",
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ status: 0, message: "Project not found" });
    }

    const user = await User.findOne({ _id: userId, projectId: projectId });
    if (!user) {
      return res.status(404).json({ status: 0, message: "User not found in this project" });
    }

    // Validate moduledata encryption if present
    const moduleDataHeader = req.headers["moduledata"];
    if (moduleDataHeader) {
      try {
        const decryptedString = decryptModuleData(moduleDataHeader);
        const parsed = JSON.parse(decryptedString);
        if (parsed.user_id !== userId || parsed.project_id !== projectId || parsed.device_id !== deviceId) {
          return res.status(401).json({ status: 0, message: "Encryption validation failed" });
        }
      } catch (decryptError) {
        console.error("Login encryption validation failed:", decryptError.message);
        return res.status(401).json({ status: 0, message: "Encryption validation failed" });
      }
    }

    user.deviceId = deviceId;
    await user.save();

    return res.json({
      status: 1,
      message: "Login successful",
      data: {
        user: {
          userId: user._id.toString(),
          projectId: project._id.toString(),
          deviceId,
          name: user.name,
          projectName: project.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ status: 0, message: "Internal server error" });
  }
});

module.exports = router;
