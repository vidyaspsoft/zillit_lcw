const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  getWardrobeFolders,
  getWardrobes,
  getWardrobeById,
  createWardrobe,
  updateWardrobe,
  moveWardrobes,
  moveWardrobeFolder,
  deleteWardrobe,
  deleteWardrobeFolder,
  restoreWardrobe,
  getDeletedWardrobes,
  shareWardrobes,
  getWardrobeStats,
  getWardrobeUnitChats,
  createWardrobeUnitChat,
  getWardrobeComments,
  createWardrobeComment,
  updateWardrobeComment,
  deleteWardrobeComment,
  getWardrobeUnits,
  getWardrobeBadges,
  markWardrobeViewed,
  suggestWardrobes,
  syncWardrobes,
  syncWardrobeComments,
  syncWardrobeActivity,
  syncWardrobeUnitChats,
  bulkImport,
  chooseCast,
  getMeasurements,
  saveMeasurements,
  getTempCasts,
  createTempCast,
  deleteTempCast,
} = require("../controllers/wardrobeController");

const { getLinkPreview } = require("../controllers/linkPreviewController");
const { generatePDF } = require("../controllers/pdfController");

// ── Static routes (MUST be before /:id) ──
router.get("/units", getWardrobeUnits);
router.get("/stats", getWardrobeStats);
router.get("/folders", getWardrobeFolders);
router.get("/suggest", suggestWardrobes);
router.get("/badges", getWardrobeBadges);
router.post("/mark-viewed", markWardrobeViewed);
router.get("/deleted", getDeletedWardrobes);
router.post("/bulk-import", upload.array("files", 100), bulkImport);

// ── Choose Cast (from casting backend) ──
router.get("/choose-cast", chooseCast);

// ── Measurements ──
router.get("/measurements", getMeasurements);
router.post("/measurements", saveMeasurements);

// ── Temporary Cast ──
router.get("/temp-casts", getTempCasts);
router.post("/temp-casts", createTempCast);
router.delete("/temp-casts/:id", deleteTempCast);

// ── Sync API (mobile — timestamp-based cursor pagination) ──
router.get("/sync", syncWardrobes);
router.get("/sync/comments", syncWardrobeComments);
router.get("/sync/activity", syncWardrobeActivity);
router.get("/sync/unit-chats", syncWardrobeUnitChats);

// ── Move operations ──
router.put("/move/items", moveWardrobes);
router.put("/move/folder", moveWardrobeFolder);

// ── Restore ──
router.put("/restore/:id", restoreWardrobe);

// ── Delete folder ──
router.post("/delete-folder", deleteWardrobeFolder);

// ── Link preview (shared controller) ──
router.post("/link-preview", getLinkPreview);

// ── PDF generation ──
router.post("/generate-pdf", generatePDF);

// ── Share/distribute ──
router.post("/share", shareWardrobes);

// ── Unit Chat (tab-level chat) ──
router.get("/unit-chat", getWardrobeUnitChats);
router.post("/unit-chat", upload.array("files", 5), createWardrobeUnitChat);

// ── Comments update & delete (before /:wardrobeId/comments) ──
router.put("/comments/:id", updateWardrobeComment);
router.delete("/comments/:id", deleteWardrobeComment);

// ── Wardrobe CRUD ──
router.get("/", getWardrobes);
router.get("/:id", getWardrobeById);
router.post("/", upload.array("files", 10), createWardrobe);
router.put("/:id", upload.array("files", 10), updateWardrobe);
router.delete("/:id", deleteWardrobe);

// ── Comments ──
router.get("/:wardrobeId/comments", getWardrobeComments);
router.post("/:wardrobeId/comments", upload.array("files", 5), createWardrobeComment);

module.exports = router;
