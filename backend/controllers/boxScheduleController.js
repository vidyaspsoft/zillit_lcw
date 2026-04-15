const BoxScheduleType = require("../models/boxSchedule/BoxScheduleType");
const BoxScheduleDay = require("../models/boxSchedule/BoxScheduleDay");
const BoxScheduleEvent = require("../models/boxSchedule/BoxScheduleEvent");
const BoxScheduleActivityLog = require("../models/boxSchedule/BoxScheduleActivityLog");
const BoxScheduleRevision = require("../models/boxSchedule/BoxScheduleRevision");
const BoxScheduleShare = require("../models/boxSchedule/BoxScheduleShare");
const { sendSuccessV2: sendSuccess, sendErrorV2: sendError, isValidObjectId } = require("../utils/helpers");
const { v4: uuidv4 } = require("uuid");

// ── Helper: Convert any date-like input (number, ISO string, Date) to epoch ms ──
const toEpoch = (v) => {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  const ms = new Date(v).getTime();
  return isNaN(ms) ? 0 : ms;
};

// ── Helper: Format an epoch ms as "Mon D" ──
const fmtShortDate = (ms) => {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`;
};

// ── Helper: Normalise a color string so hex/rgb compare equally ──
//    "#FF0000", "#ff0000", "rgb(255, 0, 0)", " #ff0000 " → "#ff0000"
const normaliseColor = (c) => {
  if (!c || typeof c !== "string") return "";
  const trimmed = c.trim().toLowerCase();
  // rgb(r,g,b) or rgba(r,g,b,a) → hex
  const rgb = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) {
    const r = Math.max(0, Math.min(255, parseInt(rgb[1], 10))).toString(16).padStart(2, "0");
    const g = Math.max(0, Math.min(255, parseInt(rgb[2], 10))).toString(16).padStart(2, "0");
    const b = Math.max(0, Math.min(255, parseInt(rgb[3], 10))).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  }
  // Short hex (#abc) → full hex (#aabbcc)
  const short = trimmed.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  return trimmed;
};

// ── Helper: Build a human-readable identifier for a schedule day ──
//    Prefers the day's title, else falls back to "TypeName · Apr 8 – Apr 12".
const dayIdentifier = (title, typeName, startDate, endDate) => {
  if (title) return title;
  if (startDate && endDate) {
    const range = startDate === endDate
      ? fmtShortDate(startDate)
      : `${fmtShortDate(startDate)} – ${fmtShortDate(endDate)}`;
    return `${typeName} · ${range}`;
  }
  return typeName || "";
};

// ── Helper: Log activity ──
const logActivity = async (projectId, action, targetType, targetId, targetTitle, details, performedBy) => {
  try {
    await BoxScheduleActivityLog.create({ projectId, action, targetType, targetId: String(targetId), targetTitle, details, performedBy });
  } catch (err) { console.error("logActivity error:", err.message); }
};

// ── Helper: Create revision after schedule changes ──
const bumpRevision = async (projectId, description, changedBy, typeColor) => {
  try {
    await BoxScheduleRevision.createRevision(projectId, description, changedBy, typeColor);
  } catch (err) { console.error("bumpRevision error:", err.message); }
};

// ═══════════════════════ SCHEDULE TYPES ═══════════════════════

const getTypes = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const createdBy = { userId: req.moduleData.user_id, name: req.body?.userName || "" };
    await BoxScheduleType.seedDefaults(projectId, createdBy);
    const types = await BoxScheduleType.find({ projectId }).sort({ order: 1, createdAt: 1 }).lean();
    return sendSuccess(res, types);
  } catch (error) {
    console.error("getTypes error:", error);
    return sendError(res, 500, "Failed to fetch schedule types");
  }
};

const createType = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { title, color, userName } = req.body;
    if (!title || !title.trim()) return sendError(res, 400, "Type title is required");

    const existing = await BoxScheduleType.findOne({ projectId, title: title.trim() });
    if (existing) return sendError(res, 400, "A type with this name already exists");

    // Color uniqueness — every type in the project must have a different color
    const finalColor = color || "#3498DB";
    const normalised = normaliseColor(finalColor);
    const allTypes = await BoxScheduleType.find({ projectId }).select("title color").lean();
    const colorClash = allTypes.find((t) => normaliseColor(t.color) === normalised);
    if (colorClash) {
      return sendError(
        res, 400,
        `That color is already used by "${colorClash.title}". Please pick a different color.`
      );
    }

    const maxOrder = await BoxScheduleType.findOne({ projectId }).sort({ order: -1 }).select("order").lean();
    const type = await BoxScheduleType.create({
      projectId, title: title.trim(), color: finalColor,
      systemDefined: false, order: (maxOrder?.order ?? -1) + 1,
      createdBy: { userId, name: userName || "" },
    });

    const performer = { userId, name: userName || "" };
    await logActivity(projectId, "created", "schedule_type", type._id, type.title, "", performer);
    return sendSuccess(res, type, "schedule_type_created", 201);
  } catch (error) {
    console.error("createType error:", error);
    return sendError(res, 500, "Failed to create schedule type");
  }
};

const updateType = async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { title, color, order, userName } = req.body;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid type ID");

    const type = await BoxScheduleType.findOne({ _id: id, projectId });
    if (!type) return sendError(res, 404, "Schedule type not found");
    if (type.systemDefined && title && title.trim() !== type.title) return sendError(res, 400, "Cannot rename system-defined types");

    // Name uniqueness (when renaming)
    if (title && title.trim() !== type.title) {
      const nameClash = await BoxScheduleType.findOne({
        projectId, title: title.trim(), _id: { $ne: type._id },
      });
      if (nameClash) return sendError(res, 400, "A type with this name already exists");
    }

    // Color uniqueness (when changing color) — must differ from every OTHER type
    if (color && normaliseColor(color) !== normaliseColor(type.color)) {
      const others = await BoxScheduleType.find({
        projectId, _id: { $ne: type._id },
      }).select("title color").lean();
      const target = normaliseColor(color);
      const clash = others.find((t) => normaliseColor(t.color) === target);
      if (clash) {
        return sendError(
          res, 400,
          `That color is already used by "${clash.title}". Please pick a different color.`
        );
      }
    }

    const changes = [];
    const oldTitle = type.title;
    const oldColor = type.color;
    if (title && title.trim() !== oldTitle) { type.title = title.trim(); changes.push("renamed"); }
    if (color && color !== oldColor) { type.color = color; changes.push("color changed"); }
    if (order !== undefined) type.order = order;
    await type.save();

    await BoxScheduleDay.updateMany({ projectId, typeId: id }, { $set: { typeName: type.title, color: type.color } });

    if (changes.length > 0) {
      const performer = { userId, name: userName || "" };
      await logActivity(projectId, "updated", "schedule_type", type._id, type.title, changes.join(", "), performer);
    }
    return sendSuccess(res, type, "schedule_type_updated");
  } catch (error) {
    console.error("updateType error:", error);
    return sendError(res, 500, "Failed to update schedule type");
  }
};

const deleteType = async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { userName } = req.body;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid type ID");

    const type = await BoxScheduleType.findOne({ _id: id, projectId });
    if (!type) return sendError(res, 404, "Schedule type not found");
    if (type.systemDefined) return sendError(res, 400, "Cannot delete system-defined types");

    const daysUsingType = await BoxScheduleDay.countDocuments({ projectId, typeId: id, deleted: 0 });
    if (daysUsingType > 0) return sendError(res, 400, `Cannot delete — ${daysUsingType} schedule day(s) use this type`);

    const typeTitle = type.title;
    await BoxScheduleType.deleteOne({ _id: id });

    const performer = { userId, name: userName || "" };
    await logActivity(projectId, "deleted", "schedule_type", id, typeTitle, "", performer);
    return sendSuccess(res, { id }, "schedule_type_deleted");
  } catch (error) {
    console.error("deleteType error:", error);
    return sendError(res, 500, "Failed to delete schedule type");
  }
};

// ═══════════════════════ SCHEDULE DAYS ═══════════════════════

const getDays = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { startDate, endDate, typeId } = req.query;
    const query = { projectId, deleted: 0 };
    if (typeId && isValidObjectId(typeId)) query.typeId = typeId;
    if (startDate || endDate) {
      query.calendarDays = {};
      if (startDate) query.calendarDays.$gte = Number(startDate);
      if (endDate) query.calendarDays.$lte = Number(endDate);
    }
    const days = await BoxScheduleDay.find(query).sort({ startDate: 1 }).lean();
    return sendSuccess(res, days);
  } catch (error) {
    console.error("getDays error:", error);
    return sendError(res, 500, "Failed to fetch schedule days");
  }
};

const createDay = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { title, typeId, dateRangeType, calendarDays, timezone, conflictAction, userName } = req.body;

    if (!typeId || !isValidObjectId(typeId)) return sendError(res, 400, "Valid schedule type is required");
    const type = await BoxScheduleType.findOne({ _id: typeId, projectId });
    if (!type) return sendError(res, 404, "Schedule type not found");
    if (!calendarDays || !Array.isArray(calendarDays) || calendarDays.length === 0) return sendError(res, 400, "At least one calendar day is required");

    const requestedDays = calendarDays.map(Number);

    // Conflict detection
    const conflicting = await BoxScheduleDay.find({ projectId, calendarDays: { $in: requestedDays }, deleted: 0 }).lean();

    if (conflicting.length > 0 && !conflictAction) {
      const conflictDays = [];
      for (const day of conflicting) {
        for (const cd of day.calendarDays) {
          if (requestedDays.includes(cd)) {
            conflictDays.push({ date: cd, existingType: day.typeName, existingColor: day.color, existingTitle: day.title, existingDayId: day._id });
          }
        }
      }
      return res.status(409).json({ status: 0, message: "schedule_day_conflict", messageElements: [], data: { conflicts: conflictDays } });
    }

    let finalDays = requestedDays;
    if (conflicting.length > 0 && conflictAction) {
      const conflictingDayValues = new Set();
      conflicting.forEach((d) =>
        d.calendarDays.forEach((cd) => {
          if (requestedDays.includes(cd)) conflictingDayValues.add(cd);
        })
      );
      const perf = { userId, name: userName || "" };

      // ─────────────────────────── REPLACE ───────────────────────────
      // Kick out the overlap from existing blocks. The new schedule
      // takes every requested day; existing blocks shrink or get deleted.
      if (conflictAction === "replace") {
        finalDays = requestedDays;

        for (const day of conflicting) {
          const stolen = day.calendarDays.filter((cd) => conflictingDayValues.has(cd));
          if (stolen.length === 0) continue;

          const remaining = day.calendarDays.filter((cd) => !conflictingDayValues.has(cd));
          const ident = dayIdentifier(day.title, day.typeName, day.startDate, day.endDate);

          if (remaining.length === 0) {
            // Block entirely overwritten → soft-delete it + its events
            await BoxScheduleDay.updateOne(
              { _id: day._id },
              { $set: { deleted: Date.now() }, $inc: { version: 1 } }
            );
            await BoxScheduleEvent.updateMany(
              { scheduleDayId: day._id, deleted: 0 },
              { $set: { deleted: Date.now() } }
            );
            await logActivity(
              projectId, "deleted", "schedule_day", day._id, ident,
              `replaced by ${type.title}`, perf
            );
            await bumpRevision(
              projectId, `Replaced ${day.typeName} "${ident}" with ${type.title}`,
              perf, day.color
            );
          } else {
            // Block partially overwritten → shrink it
            await BoxScheduleDay.updateOne(
              { _id: day._id },
              { $set: {
                calendarDays: remaining,
                startDate: Math.min(...remaining),
                endDate: Math.max(...remaining),
                numberOfDays: remaining.length,
              }, $inc: { version: 1 } }
            );
            await logActivity(
              projectId, "updated", "schedule_day", day._id, ident,
              `${stolen.length} day(s) replaced by ${type.title}`, perf
            );
          }
        }
      }

      // ─────────────────────────── EXTEND ───────────────────────────
      // The new schedule takes every requested day. Every affected
      // existing block loses the overlap and grows by the same count
      // at its end, so its total day count stays the same.
      else if (conflictAction === "extend") {
        finalDays = requestedDays;
        const ONE_DAY_MS = 86400000;

        for (const day of conflicting) {
          const stolen = day.calendarDays.filter((cd) => conflictingDayValues.has(cd));
          if (stolen.length === 0) continue;

          const remaining = day.calendarDays.filter((cd) => !conflictingDayValues.has(cd));
          const anchor = Math.max(...day.calendarDays);
          const appended = [];
          for (let i = 1; i <= stolen.length; i++) {
            appended.push(anchor + i * ONE_DAY_MS);
          }
          const newDays = [...remaining, ...appended].sort((a, b) => a - b);
          const ident = dayIdentifier(day.title, day.typeName, day.startDate, day.endDate);

          await BoxScheduleDay.updateOne(
            { _id: day._id },
            { $set: {
              calendarDays: newDays,
              startDate: Math.min(...newDays),
              endDate: Math.max(...newDays),
              numberOfDays: newDays.length,
            }, $inc: { version: 1 } }
          );
          await logActivity(
            projectId, "updated", "schedule_day", day._id, ident,
            `extended by ${stolen.length} day(s) to make room for ${type.title}`, perf
          );
        }
      }

      // ─────────────────────────── OVERLAP ───────────────────────────
      // Keep every existing block exactly as it is. The new schedule
      // is created alongside and both types will render on the same day.
      else if (conflictAction === "overlap") {
        finalDays = requestedDays;
        // no-op on existing blocks
      }
    }

    const newDay = await BoxScheduleDay.create({
      projectId, title: title || "", typeId: type._id, typeName: type.title, color: type.color,
      dateRangeType: dateRangeType || "by_dates",
      startDate: Math.min(...finalDays), endDate: Math.max(...finalDays),
      numberOfDays: finalDays.length, calendarDays: finalDays, timezone: timezone || "UTC",
      conflictAction: conflictAction || "", version: 1, createdBy: { userId, name: userName || "" },
    });

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("box_schedule_day_added", { day: newDay });
    const performer = { userId, name: userName || "" };
    await logActivity(projectId, "created", "schedule_day", newDay._id, title || type.title, `${finalDays.length} day(s)`, performer);
    await bumpRevision(projectId, `Added ${type.title} schedule: ${title || type.title}`, performer, type.color);
    return sendSuccess(res, newDay, "schedule_day_created", 201);
  } catch (error) {
    console.error("createDay error:", error);
    return sendError(res, 500, "Failed to create schedule");
  }
};

const updateDay = async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { title, typeId, calendarDays, startDate, endDate, numberOfDays, dateRangeType, timezone, userName } = req.body;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid schedule day ID");

    const day = await BoxScheduleDay.findOne({ _id: id, projectId, deleted: 0 });
    if (!day) return sendError(res, 404, "Schedule day not found");

    const changes = [];
    const oldTitle = day.title;
    const oldTypeName = day.typeName;
    const oldStartDate = day.startDate;
    const oldEndDate = day.endDate;
    const oldCalendarDays = [...(day.calendarDays || [])];

    if (typeId && isValidObjectId(typeId) && typeId !== String(day.typeId)) {
      const type = await BoxScheduleType.findOne({ _id: typeId, projectId });
      if (!type) return sendError(res, 404, "Schedule type not found");
      day.typeId = type._id; day.typeName = type.title; day.color = type.color;
      changes.push(`type changed from "${oldTypeName}" to "${type.title}"`);
    }
    if (title !== undefined && title !== oldTitle) {
      day.title = title;
      changes.push(oldTitle ? `title renamed from "${oldTitle}" to "${title}"` : `title set to "${title}"`);
    }
    if (calendarDays && Array.isArray(calendarDays)) {
      const newDays = calendarDays.map(Number);
      const oldSet = new Set(oldCalendarDays.map(Number));
      const newSet = new Set(newDays);
      if (newDays.length !== oldCalendarDays.length ||
          newDays.some((d) => !oldSet.has(d)) ||
          oldCalendarDays.some((d) => !newSet.has(Number(d)))) {
        const diff = newDays.length - oldCalendarDays.length;
        if (diff > 0) changes.push(`${diff} day(s) added`);
        else if (diff < 0) changes.push(`${-diff} day(s) removed`);
        else changes.push("dates shifted");
      }
      day.calendarDays = newDays;
      day.startDate = Math.min(...day.calendarDays);
      day.endDate = Math.max(...day.calendarDays);
      day.numberOfDays = day.calendarDays.length;
    }
    if (startDate) day.startDate = toEpoch(startDate);
    if (endDate) day.endDate = toEpoch(endDate);
    if (numberOfDays !== undefined) day.numberOfDays = numberOfDays;
    if (dateRangeType) day.dateRangeType = dateRangeType;
    if (timezone) day.timezone = timezone;
    day.version += 1;
    await day.save();

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("box_schedule_day_updated", { day });

    if (changes.length > 0) {
      // Use the ORIGINAL title/typeName/date range so the user recognises
      // the entry even if they just renamed it.
      const identifier = dayIdentifier(oldTitle, oldTypeName, oldStartDate, oldEndDate);
      const performer = { userId, name: userName || "" };
      await logActivity(projectId, "updated", "schedule_day", day._id, identifier, changes.join(" · "), performer);
    }
    return sendSuccess(res, day, "schedule_day_updated");
  } catch (error) {
    console.error("updateDay error:", error);
    return sendError(res, 500, "Failed to update schedule");
  }
};

const deleteDay = async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.moduleData.project_id;
    const { userName } = req.body || {};
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid schedule day ID");

    const day = await BoxScheduleDay.findOne({ _id: id, projectId, deleted: 0 });
    if (!day) return sendError(res, 404, "Schedule day not found");

    day.deleted = Date.now();
    await day.save();
    await BoxScheduleEvent.updateMany({ scheduleDayId: id, deleted: 0 }, { $set: { deleted: Date.now() } });

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("box_schedule_day_deleted", { dayId: id });
    const performer = { userId: req.moduleData.user_id, name: userName || "" };
    const identifier = dayIdentifier(day.title, day.typeName, day.startDate, day.endDate);
    await logActivity(projectId, "deleted", "schedule_day", id, identifier, "", performer);
    await bumpRevision(projectId, `Deleted ${day.typeName} schedule: ${identifier}`, performer, day.color);
    return sendSuccess(res, { id }, "schedule_day_deleted");
  } catch (error) {
    console.error("deleteDay error:", error);
    return sendError(res, 500, "Failed to delete schedule");
  }
};

const removeDates = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { entries, userName } = req.body;
    if (!Array.isArray(entries) || entries.length === 0) return sendError(res, 400, "Entries array is required");

    const performer = { userId, name: userName || "" };
    const results = { updated: [], deleted: [] };
    for (const entry of entries) {
      if (!entry.id || !isValidObjectId(entry.id)) continue;
      if (!Array.isArray(entry.dates) || entry.dates.length === 0) continue;

      const day = await BoxScheduleDay.findOne({ _id: entry.id, projectId, deleted: 0 });
      if (!day) continue;

      const removedCount = entry.dates.length;
      const datesToRemove = new Set(entry.dates.map((d) => Number(d)));
      const remaining = day.calendarDays.map((cd) => Number(cd)).filter((cd) => !datesToRemove.has(cd));

      // Capture identifier BEFORE mutation so "from" state is preserved
      const identifier = dayIdentifier(day.title, day.typeName, day.startDate, day.endDate);

      if (remaining.length === 0) {
        day.deleted = Date.now();
        await day.save();
        await BoxScheduleEvent.updateMany({ scheduleDayId: day._id, deleted: 0 }, { $set: { deleted: Date.now() } });
        results.deleted.push(String(day._id));
        await logActivity(projectId, "deleted", "schedule_day", day._id, identifier, "all days removed", performer);
        await bumpRevision(projectId, `Deleted ${day.typeName} schedule: ${identifier}`, performer, day.color);
      } else {
        day.calendarDays = remaining;
        day.startDate = Math.min(...remaining);
        day.endDate = Math.max(...remaining);
        day.numberOfDays = remaining.length;
        day.version += 1;
        await day.save();
        results.updated.push(String(day._id));
        const dayWord = removedCount === 1 ? "day" : "days";
        await logActivity(projectId, "updated", "schedule_day", day._id, identifier, `${removedCount} ${dayWord} removed`, performer);
      }
    }

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("box_schedule_day_updated", { results });
    return sendSuccess(res, results, "schedule_day_dates_removed");
  } catch (error) {
    console.error("removeDates error:", error);
    return sendError(res, 500, "Failed to remove dates");
  }
};

const bulkUpdateDays = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) return sendError(res, 400, "Updates array is required");

    const results = [];
    for (const update of updates) {
      if (!update.id || !isValidObjectId(update.id)) continue;
      const setFields = {};
      if (update.calendarDays && Array.isArray(update.calendarDays)) {
        const days = update.calendarDays.map(Number);
        setFields.calendarDays = days;
        setFields.startDate = Math.min(...days);
        setFields.endDate = Math.max(...days);
        setFields.numberOfDays = days.length;
      }
      if (Object.keys(setFields).length > 0) {
        const updated = await BoxScheduleDay.findOneAndUpdate(
          { _id: update.id, projectId, deleted: 0 },
          { $set: setFields, $inc: { version: 1 } },
          { new: true }
        );
        if (updated) results.push(updated);
      }
    }

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("box_schedule_day_updated", { days: results });
    return sendSuccess(res, results, "schedule_days_bulk_updated");
  } catch (error) {
    console.error("bulkUpdateDays error:", error);
    return sendError(res, 500, "Failed to bulk update schedules");
  }
};

// ═══════════════════════ EVENTS ═══════════════════════

const getEvents = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { startDate, endDate, scheduleDayId, eventType } = req.query;
    const query = { projectId, deleted: 0 };

    if (scheduleDayId && isValidObjectId(scheduleDayId)) query.scheduleDayId = scheduleDayId;
    if (eventType) query.eventType = eventType;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = Number(startDate);
      if (endDate) query.date.$lte = Number(endDate);
    }

    const events = await BoxScheduleEvent.find(query).sort({ date: 1, startDateTime: 1, createdAt: 1 }).lean();
    return sendSuccess(res, events);
  } catch (error) {
    console.error("getEvents error:", error);
    return sendError(res, 500, "Failed to fetch events");
  }
};

const createEvent = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const {
      scheduleDayId, date, eventType, title, color,
      description, startDateTime, endDateTime, fullDay, location, reminder, repeatStatus, repeatEndDate,
      timezone, callType, textColor, locationLat, locationLng,
      distributeTo, distributeUserIds, distributeDepartmentIds, organizerExcluded, advancedEnabled,
      notes, userName,
    } = req.body;

    if (!title || !title.trim()) return sendError(res, 400, "Title is required");

    // scheduleDayId is optional — events can exist without a linked schedule day
    let resolvedScheduleDayId = null;
    if (scheduleDayId && isValidObjectId(scheduleDayId)) {
      const day = await BoxScheduleDay.findOne({ _id: scheduleDayId, projectId, deleted: 0 });
      if (day) resolvedScheduleDayId = day._id;
    }

    const type = eventType || "note";
    const resolvedDate = date ? Number(date) : Date.now();

    const eventData = {
      projectId, scheduleDayId: resolvedScheduleDayId, date: resolvedDate, eventType: type,
      title: title.trim(), color: color || "#3498DB",
      createdBy: { userId, name: userName || "" },
    };

    if (type === "event") {
      eventData.description = description || "";
      eventData.startDateTime = toEpoch(startDateTime);
      eventData.endDateTime = toEpoch(endDateTime);
      eventData.fullDay = fullDay || false;
      eventData.location = location || "";
      eventData.locationLat = locationLat || null;
      eventData.locationLng = locationLng || null;
      eventData.reminder = reminder || "none";
      eventData.repeatStatus = repeatStatus || "none";
      eventData.repeatEndDate = toEpoch(repeatEndDate);
      eventData.timezone = timezone || "";
      eventData.callType = callType || "";
      eventData.textColor = textColor || "";
      eventData.distributeTo = distributeTo || "";
      eventData.distributeUserIds = distributeUserIds || [];
      eventData.distributeDepartmentIds = distributeDepartmentIds || [];
      eventData.organizerExcluded = organizerExcluded || false;
      eventData.advancedEnabled = advancedEnabled || false;
    } else {
      eventData.notes = notes || "";
    }

    const event = await BoxScheduleEvent.create(eventData);

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("box_schedule_event_added", { event });
    await logActivity(projectId, "created", type === "event" ? "event" : "note", event._id, title.trim(), "", { userId, name: userName || "" });
    return sendSuccess(res, event, "event_created", 201);
  } catch (error) {
    console.error("createEvent error:", error);
    return sendError(res, 500, "Failed to create event");
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid event ID");

    const event = await BoxScheduleEvent.findOne({ _id: id, projectId, deleted: 0 });
    if (!event) return sendError(res, 404, "Event not found");

    const {
      title, color, description, startDateTime, endDateTime, fullDay, location, reminder, repeatStatus, repeatEndDate,
      timezone, callType, textColor, locationLat, locationLng,
      distributeTo, distributeUserIds, distributeDepartmentIds, organizerExcluded, advancedEnabled,
      notes, date, userName,
    } = req.body;

    const changes = [];
    const oldTitle = event.title;
    const oldDescription = event.description;
    const oldLocation = event.location;
    const oldStart = event.startDateTime || 0;
    const oldEnd = event.endDateTime || 0;

    if (title !== undefined && title !== oldTitle) { event.title = title; changes.push("title updated"); }
    if (color !== undefined) event.color = color;
    if (date !== undefined) event.date = Number(date);

    if (event.eventType === "event") {
      if (description !== undefined && description !== oldDescription) { event.description = description; changes.push("description changed"); }
      if (startDateTime !== undefined) {
        const newStart = toEpoch(startDateTime);
        if (newStart !== oldStart) changes.push("start time changed");
        event.startDateTime = newStart;
      }
      if (endDateTime !== undefined) {
        const newEnd = toEpoch(endDateTime);
        if (newEnd !== oldEnd) changes.push("end time changed");
        event.endDateTime = newEnd;
      }
      if (fullDay !== undefined) event.fullDay = fullDay;
      if (location !== undefined && location !== oldLocation) { event.location = location; changes.push("location changed"); }
      if (locationLat !== undefined) event.locationLat = locationLat;
      if (locationLng !== undefined) event.locationLng = locationLng;
      if (timezone !== undefined) event.timezone = timezone;
      if (callType !== undefined) event.callType = callType;
      if (textColor !== undefined) event.textColor = textColor;
      if (distributeTo !== undefined) event.distributeTo = distributeTo;
      if (distributeUserIds !== undefined) event.distributeUserIds = distributeUserIds;
      if (distributeDepartmentIds !== undefined) event.distributeDepartmentIds = distributeDepartmentIds;
      if (organizerExcluded !== undefined) event.organizerExcluded = organizerExcluded;
      if (advancedEnabled !== undefined) event.advancedEnabled = advancedEnabled;
      if (reminder !== undefined) event.reminder = reminder;
      if (repeatStatus !== undefined) event.repeatStatus = repeatStatus;
      if (repeatEndDate !== undefined) event.repeatEndDate = toEpoch(repeatEndDate);
    } else {
      if (notes !== undefined && notes !== event.notes) { event.notes = notes; changes.push("notes updated"); }
    }

    await event.save();

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("box_schedule_event_updated", { event });

    if (changes.length > 0) {
      const performer = { userId, name: userName || "" };
      await logActivity(projectId, "updated", event.eventType === "event" ? "event" : "note", event._id, event.title, changes.join(", "), performer);
    }
    return sendSuccess(res, event, "event_updated");
  } catch (error) {
    console.error("updateEvent error:", error);
    return sendError(res, 500, "Failed to update event");
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { userName } = req.body || {};
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid event ID");

    const event = await BoxScheduleEvent.findOne({ _id: id, projectId, deleted: 0 });
    if (!event) return sendError(res, 404, "Event not found");

    const eventTitle = event.title;
    const eventType = event.eventType === "event" ? "event" : "note";
    event.deleted = Date.now();
    await event.save();

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("box_schedule_event_deleted", { eventId: id });

    const performer = { userId, name: userName || "" };
    await logActivity(projectId, "deleted", eventType, id, eventTitle, "", performer);
    return sendSuccess(res, { id }, "event_deleted");
  } catch (error) {
    console.error("deleteEvent error:", error);
    return sendError(res, 500, "Failed to delete event");
  }
};

// ═══════════════════════ CALENDAR ═══════════════════════

const getCalendar = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { startDate, endDate } = req.query;

    const dayQuery = { projectId, deleted: 0 };
    if (startDate || endDate) {
      dayQuery.calendarDays = {};
      if (startDate) dayQuery.calendarDays.$gte = Number(startDate);
      if (endDate) dayQuery.calendarDays.$lte = Number(endDate);
    }

    const [days, events] = await Promise.all([
      BoxScheduleDay.find(dayQuery).sort({ startDate: 1 }).lean(),
      BoxScheduleEvent.find({
        projectId, deleted: 0,
        ...(startDate || endDate ? { date: { ...(startDate ? { $gte: Number(startDate) } : {}), ...(endDate ? { $lte: Number(endDate) } : {}) } } : {}),
      }).sort({ date: 1, startDateTime: 1 }).lean(),
    ]);

    const eventsByDay = {};
    events.forEach((e) => {
      const key = String(e.scheduleDayId);
      if (!eventsByDay[key]) eventsByDay[key] = { events: [], notes: [] };
      if (e.eventType === "event") eventsByDay[key].events.push(e);
      else eventsByDay[key].notes.push(e);
    });

    const calendarData = days.map((d) => ({
      ...d,
      events: eventsByDay[String(d._id)]?.events || [],
      notes: eventsByDay[String(d._id)]?.notes || [],
    }));

    return sendSuccess(res, calendarData);
  } catch (error) {
    console.error("getCalendar error:", error);
    return sendError(res, 500, "Failed to fetch calendar data");
  }
};

// ═══════════════════════ ACTIVITY LOG ═══════════════════════

const getActivityLog = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { limit = 50, page = 0, startDate, endDate } = req.query;
    const skip = Number(page) * Number(limit);

    const filter = { projectId };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = Number(startDate);
      if (endDate) filter.createdAt.$lte = Number(endDate);
    }

    const [logs, total] = await Promise.all([
      BoxScheduleActivityLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      BoxScheduleActivityLog.countDocuments(filter),
    ]);

    return sendSuccess(res, { logs, total, page: Number(page), limit: Number(limit) });
  } catch (error) {
    console.error("getActivityLog error:", error);
    return sendError(res, 500, "Failed to fetch activity log");
  }
};

// ═══════════════════════ REVISIONS ═══════════════════════

const getRevisions = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { startDate, endDate } = req.query;

    const filter = { projectId };
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = Number(startDate);
      if (endDate) filter.createdAt.$lte = Number(endDate);
    }

    const revisions = await BoxScheduleRevision.find(filter).sort({ revisionNumber: -1 }).lean();
    return sendSuccess(res, revisions);
  } catch (error) {
    console.error("getRevisions error:", error);
    return sendError(res, 500, "Failed to fetch revisions");
  }
};

const getCurrentRevision = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const latest = await BoxScheduleRevision.findOne({ projectId }).sort({ revisionNumber: -1 }).lean();
    return sendSuccess(res, latest || { revisionNumber: 0, revisionColor: "White" });
  } catch (error) {
    console.error("getCurrentRevision error:", error);
    return sendError(res, 500, "Failed to fetch current revision");
  }
};

// ═══════════════════════ DUPLICATE ═══════════════════════

const duplicateDay = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { sourceDayId, newStartDate, userName } = req.body;

    if (!sourceDayId || !isValidObjectId(sourceDayId)) return sendError(res, 400, "Valid source day ID is required");
    if (!newStartDate) return sendError(res, 400, "New start date is required");

    const source = await BoxScheduleDay.findOne({ _id: sourceDayId, projectId, deleted: 0 }).lean();
    if (!source) return sendError(res, 404, "Source schedule not found");

    // Calculate date offset
    const oldStart = Math.min(...source.calendarDays);
    const newStart = Number(newStartDate);
    const offset = newStart - oldStart;

    const newCalendarDays = source.calendarDays.map((cd) => cd + offset);

    const newDay = await BoxScheduleDay.create({
      projectId, title: source.title ? `${source.title} (Copy)` : `${source.typeName} (Copy)`,
      typeId: source.typeId, typeName: source.typeName, color: source.color,
      dateRangeType: source.dateRangeType,
      startDate: Math.min(...newCalendarDays),
      endDate: Math.max(...newCalendarDays),
      numberOfDays: newCalendarDays.length,
      calendarDays: newCalendarDays,
      timezone: source.timezone, version: 1,
      createdBy: { userId, name: userName || "" },
    });

    // Copy events with adjusted dates
    const sourceEvents = await BoxScheduleEvent.find({ scheduleDayId: sourceDayId, projectId, deleted: 0 }).lean();
    for (const evt of sourceEvents) {
      const newEvt = { ...evt };
      delete newEvt._id;
      delete newEvt.__v;
      newEvt.scheduleDayId = newDay._id;
      newEvt.date = evt.date + offset;
      if (newEvt.startDateTime) newEvt.startDateTime = toEpoch(newEvt.startDateTime) + offset;
      if (newEvt.endDateTime) newEvt.endDateTime = toEpoch(newEvt.endDateTime) + offset;
      newEvt.createdBy = { userId, name: userName || "" };
      await BoxScheduleEvent.create(newEvt);
    }

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("box_schedule_day_added", { day: newDay });

    const performer = { userId, name: userName || "" };
    await logActivity(projectId, "duplicated", "schedule_day", newDay._id, newDay.title, `Duplicated from ${source.title || source.typeName}`, performer);
    await bumpRevision(projectId, `Duplicated ${source.typeName}: ${source.title || source.typeName}`, performer, source.color);

    return sendSuccess(res, newDay, "schedule_day_duplicated", 201);
  } catch (error) {
    console.error("duplicateDay error:", error);
    return sendError(res, 500, "Failed to duplicate schedule");
  }
};

// ═══════════════════════ SHARE ═══════════════════════

const generateShareLink = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { userName } = req.body;

    const token = uuidv4();
    const share = await BoxScheduleShare.create({
      projectId, token,
      createdBy: { userId, name: userName || "" },
    });

    await logActivity(projectId, "shared", "schedule_day", "", "Schedule", "Generated share link", { userId, name: userName || "" });

    return sendSuccess(res, { token, shareUrl: `/shared/box-schedule/${token}` }, "share_link_generated");
  } catch (error) {
    console.error("generateShareLink error:", error);
    return sendError(res, 500, "Failed to generate share link");
  }
};

const getSharedSchedule = async (req, res) => {
  try {
    const { token } = req.params;
    const share = await BoxScheduleShare.findOne({ token, active: true }).lean();
    if (!share) return sendError(res, 404, "Share link not found or expired");

    if (share.expiresAt && share.expiresAt > 0 && share.expiresAt < Date.now()) {
      return sendError(res, 410, "Share link has expired");
    }

    const projectId = share.projectId;
    const [days, events, types] = await Promise.all([
      BoxScheduleDay.find({ projectId, deleted: 0 }).sort({ startDate: 1 }).lean(),
      BoxScheduleEvent.find({ projectId, deleted: 0 }).sort({ date: 1, startDateTime: 1 }).lean(),
      BoxScheduleType.find({ projectId }).sort({ order: 1 }).lean(),
    ]);

    return sendSuccess(res, { days, events, types, projectId });
  } catch (error) {
    console.error("getSharedSchedule error:", error);
    return sendError(res, 500, "Failed to fetch shared schedule");
  }
};

module.exports = {
  getTypes, createType, updateType, deleteType,
  getDays, createDay, updateDay, deleteDay, removeDates, bulkUpdateDays,
  getEvents, createEvent, updateEvent, deleteEvent,
  getCalendar,
  getActivityLog,
  getRevisions, getCurrentRevision,
  duplicateDay,
  generateShareLink, getSharedSchedule,
};
