const express = require("express");
const router = express.Router();

const {
  getTypes, createType, updateType, deleteType,
  getDays, createDay, updateDay, deleteDay, removeDates, bulkUpdateDays,
  getEvents, createEvent, updateEvent, deleteEvent,
  getCalendar,
  getActivityLog,
  getRevisions, getCurrentRevision,
  duplicateDay,
  generateShareLink, getSharedSchedule,
} = require("../controllers/boxScheduleController");

// ── Schedule Types ──
router.get("/types", getTypes);
router.post("/types", createType);
router.put("/types/:id", updateType);
router.delete("/types/:id", deleteType);

// ── Calendar & Reports (static routes before :id) ──
router.get("/calendar", getCalendar);

// ── Activity Log ──
router.get("/activity-log", getActivityLog);

// ── Revisions ──
router.get("/revisions", getRevisions);
router.get("/revisions/current", getCurrentRevision);

// ── Share ──
router.post("/share/generate-link", generateShareLink);
router.get("/share/:token", getSharedSchedule);

// ── Schedule Days ──
router.get("/days", getDays);
router.post("/days", createDay);
router.post("/days/bulk", bulkUpdateDays);
router.post("/days/remove-dates", removeDates);
router.post("/days/duplicate", duplicateDay);
router.put("/days/:id", updateDay);
router.delete("/days/:id", deleteDay);

// ── Events ──
router.get("/events", getEvents);
router.post("/events", createEvent);
router.put("/events/:id", updateEvent);
router.delete("/events/:id", deleteEvent);

module.exports = router;
