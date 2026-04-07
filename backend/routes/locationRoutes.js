const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  getFolders,
  getLocations,
  getLocationById,
  createLocation,
  updateLocation,
  moveLocations,
  moveFolder,
  deleteLocation,
  bulkDeleteLocations,
  deleteFolder,
  restoreLocation,
  getDeletedLocations,
  shareLocations,
  getStats,
  getUnitChats,
  createUnitChat,
  getComments,
  createComment,
  updateComment,
  deleteComment,
  getUnits,
  getBadges,
  markViewed,
  syncLocations,
  syncComments,
  syncActivity,
  syncUnitChats,
} = require("../controllers/locationController");

const { getLinkPreview } = require("../controllers/linkPreviewController");
const { generatePDF } = require("../controllers/pdfController");

// ── Script Breakdown + Project Config ──
const ScriptBreakdown = require("../models/ScriptBreakdown");
const ProjectConfig = require("../models/ProjectConfig");
const { sendSuccess: sendOk } = require("../utils/helpers");

router.get("/script-scenes", async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { episode, q } = req.query;
    const query = { projectId };
    if (episode) query.episode = episode;
    if (q) {
      query.$or = [
        { sceneNumber: { $regex: q, $options: "i" } },
        { sceneTitle: { $regex: q, $options: "i" } },
        { locationName: { $regex: q, $options: "i" } },
        { sceneDescription: { $regex: q, $options: "i" } },
      ];
    }
    const scenes = await ScriptBreakdown.find(query).sort({ episode: 1, sceneNumber: 1 }).lean();
    return sendOk(res, scenes);
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch script scenes" });
  }
});

router.get("/script-episodes", async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const episodes = await ScriptBreakdown.distinct("episode", { projectId });
    return sendOk(res, episodes.sort());
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch episodes" });
  }
});

// ── Project Field Configuration ──
router.get("/field-config", async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const config = await ProjectConfig.findOne({ projectId, tool: "location" }).lean();
    return sendOk(res, config || { requiredFields: [] });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to fetch config" });
  }
});

router.post("/field-config", async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { requiredFields } = req.body;

    const config = await ProjectConfig.findOneAndUpdate(
      { projectId, tool: "location" },
      {
        $set: {
          requiredFields: requiredFields || [],
          updatedBy: { userId, name: "" },
        },
      },
      { upsert: true, new: true }
    );

    return sendOk(res, config, "Configuration saved");
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to save config" });
  }
});

// ── Static routes (MUST be before /:id) ──
router.get("/units", getUnits);
router.get("/stats", getStats);
router.get("/folders", getFolders);
router.get("/badges", getBadges);
router.post("/mark-viewed", markViewed);
router.get("/deleted", getDeletedLocations);

// ── Sync API (mobile — timestamp-based cursor pagination) ──
router.get("/sync", syncLocations);
router.get("/sync/comments", syncComments);
router.get("/sync/activity", syncActivity);
router.get("/sync/unit-chats", syncUnitChats);

// ── Move operations ──
router.put("/move/items", moveLocations);
router.put("/move/folder", moveFolder);

// ── Restore ──
router.put("/restore/:id", restoreLocation);

// ── Delete folder ──
router.post("/delete-folder", deleteFolder);
router.post("/bulk-delete", bulkDeleteLocations);

// ── Link preview ──
router.post("/link-preview", getLinkPreview);

// ── PDF generation ──
router.post("/generate-pdf", generatePDF);

// ── Share/distribute ──
router.post("/share", shareLocations);

// ── Unit Chat (tab-level chat) ──
router.get("/unit-chat", getUnitChats);
router.post("/unit-chat", upload.array("files", 5), createUnitChat);

// ── Comments update & delete (before /:locationId/comments) ──
router.put("/comments/:id", updateComment);
router.delete("/comments/:id", deleteComment);

// ── Location CRUD ──
router.get("/", getLocations);
router.get("/:id", getLocationById);
router.post("/", upload.array("files", 10), createLocation);
router.put("/:id", upload.array("files", 10), updateLocation);
router.delete("/:id", deleteLocation);

// ── Comments ──
router.get("/:locationId/comments", getComments);
router.post("/:locationId/comments", upload.array("files", 5), createComment);

module.exports = router;
