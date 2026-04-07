const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");

const {
  getCastingFolders,
  getCastings,
  getCastingById,
  createCasting,
  updateCasting,
  validateCharacterNumber,
  moveCastings,
  moveCastingFolder,
  deleteCasting,
  deleteCastingFolder,
  restoreCasting,
  getDeletedCastings,
  shareCastings,
  getCastingStats,
  getCastingUnitChats,
  createCastingUnitChat,
  getCastingComments,
  createCastingComment,
  updateCastingComment,
  deleteCastingComment,
  getCastingUnits,
  getCastingBadges,
  markCastingViewed,
  syncCastings,
  syncCastingComments,
  syncCastingActivity,
  syncCastingUnitChats,
} = require("../controllers/castingController");

const { getLinkPreview } = require("../controllers/linkPreviewController");

// ── Static routes (MUST be before /:id) ──
router.get("/units", getCastingUnits);
router.get("/stats", getCastingStats);
router.get("/folders", getCastingFolders);
router.get("/badges", getCastingBadges);
router.post("/mark-viewed", markCastingViewed);
router.get("/deleted", getDeletedCastings);

// ── Sync API (mobile — timestamp-based cursor pagination) ──
router.get("/sync", syncCastings);
router.get("/sync/comments", syncCastingComments);
router.get("/sync/activity", syncCastingActivity);
router.get("/sync/unit-chats", syncCastingUnitChats);

// ── Move operations ──
router.put("/move/items", moveCastings);
router.put("/move/folder", moveCastingFolder);

// ── Restore ──
router.put("/restore/:id", restoreCasting);

// ── Delete folder ──
router.post("/delete-folder", deleteCastingFolder);

// ── Character number validation ──
router.post("/validate-character-number", validateCharacterNumber);

// ── Link preview (shared controller) ──
router.post("/link-preview", getLinkPreview);

// ── Share/distribute ──
router.post("/share", shareCastings);

// ── Unit Chat (tab-level chat) ──
router.get("/unit-chat", getCastingUnitChats);
router.post("/unit-chat", upload.array("files", 5), createCastingUnitChat);

// ── Comments update & delete (before /:castingId/comments) ──
router.put("/comments/:id", updateCastingComment);
router.delete("/comments/:id", deleteCastingComment);

// ── Casting CRUD ──
router.get("/", getCastings);
router.get("/:id", getCastingById);
router.post("/", upload.array("files", 10), createCasting);
router.put("/:id", upload.array("files", 10), updateCasting);
router.delete("/:id", deleteCasting);

// ── Comments ──
router.get("/:castingId/comments", getCastingComments);
router.post("/:castingId/comments", upload.array("files", 5), createCastingComment);

module.exports = router;
