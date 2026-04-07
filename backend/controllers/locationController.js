const Location = require("../models/location/Location");
const LocationComment = require("../models/location/LocationComment");
const LocationActivityLog = require("../models/location/LocationActivityLog");
const UnitChat = require("../models/location/UnitChat");
const FolderBadge = require("../models/location/FolderBadge");
const Unit = require("../models/location/Unit");
const { sendSuccess, sendError, isValidObjectId } = require("../utils/helpers");
const { buildAttachment, buildAttachmentFromDownload } = require("../utils/s3Upload");
const fetch = require("node-fetch");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// ── Helper: download image from URL and save to uploads ──
const downloadImage = async (imageUrl) => {
  try {
    const response = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZillitBot/1.0)" },
      timeout: 10000,
    });
    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/")) return null;

    const ext = contentType.includes("png") ? ".png" : contentType.includes("gif") ? ".gif" : contentType.includes("webp") ? ".webp" : ".jpg";
    const filename = `link-preview-${uuidv4()}${ext}`;
    const uploadDir = path.join(__dirname, "..", "uploads");

    // Ensure uploads directory exists
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);

    return {
      filename,
      originalName: `preview${ext}`,
      mimetype: contentType,
      path: filePath,
      size: buffer.length,
    };
  } catch (err) {
    console.error("downloadImage error:", err.message);
    return null;
  }
};

// ── Helper: fetch link preview metadata + images ──
const fetchLinkPreviewData = async (url) => {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ZillitBot/1.0)" },
      timeout: 8000,
    });
    if (!response.ok) return { metadata: null, images: [] };

    const html = await response.text();
    const $ = cheerio.load(html);

    const metadata = {
      title: $('meta[property="og:title"]').attr("content") || $("title").text() || "",
      description: $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "",
      image: $('meta[property="og:image"]').attr("content") || $('meta[property="og:image:url"]').attr("content") || "",
      siteName: $('meta[property="og:site_name"]').attr("content") || "",
    };

    // Make relative URLs absolute
    const baseUrl = new URL(url);
    if (metadata.image && !metadata.image.startsWith("http")) {
      metadata.image = new URL(metadata.image, baseUrl.origin).href;
    }

    // Collect all OG images and additional images from page
    const imageUrls = new Set();
    if (metadata.image) imageUrls.add(metadata.image);
    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr("content");
      if (src) imageUrls.add(src.startsWith("http") ? src : new URL(src, baseUrl.origin).href);
    });

    return { metadata, images: Array.from(imageUrls).slice(0, 5) };
  } catch (err) {
    console.error("fetchLinkPreviewData error:", err.message);
    return { metadata: null, images: [] };
  }
};

// ────────────────────── Folder Badge Helpers ──────────────────────

/**
 * Build a canonical sorted folder key.
 * e.g., buildFolderKey("select", ["ep:1", "fn:Iron Pillar"]) → "select|ep:1|fn:Iron Pillar"
 */
const buildFolderKey = (status, parts) => {
  if (!parts || parts.length === 0) return status;
  const sorted = [...parts].sort();
  return [status, ...sorted].join("|");
};

/**
 * Generate all non-empty subsets of an array.
 * ["a","b","c"] → [["a"],["b"],["a","b"],["c"],["a","c"],["b","c"],["a","b","c"]]
 */
const allSubsets = (arr) => {
  const result = [];
  for (let i = 1; i < (1 << arr.length); i++) {
    const subset = [];
    for (let j = 0; j < arr.length; j++) {
      if (i & (1 << j)) subset.push(arr[j]);
    }
    result.push(subset);
  }
  return result;
};

/**
 * Build ALL folder keys for a location (every combination of its dimensions).
 * Includes the bare status key for tab-level badge.
 * Now simplified: each location has a single episode (not an array).
 */
const buildAllFolderKeys = (status, episode, fileName, sceneNumber) => {
  const keys = new Set();
  keys.add(status); // tab-level badge

  const parts = [];
  if (episode) parts.push(`ep:${episode}`);
  if (fileName) parts.push(`fn:${fileName}`);
  if (sceneNumber) parts.push(`sc:${sceneNumber}`);

  if (parts.length > 0) {
    allSubsets(parts).forEach((s) => keys.add(buildFolderKey(status, s)));
  }

  return Array.from(keys);
};

/**
 * Increment badge activity count on all relevant folder keys.
 * Also marks the actor as "already seen" so they don't get their own badge.
 */
const incrementFolderBadges = async (projectId, folderKeys) => {
  if (!folderKeys.length) return;

  const bulkOps = folderKeys.map((key) => ({
    updateOne: {
      filter: { projectId, folderKey: key },
      update: { $inc: { activityCount: 1 } },
      upsert: true,
    },
  }));
  await FolderBadge.bulkWrite(bulkOps);
};

/**
 * Mark a folder as viewed by a user (set viewedBy[userId] = activityCount).
 */
const markFolderViewed = async (projectId, folderKey, userId) => {
  const doc = await FolderBadge.findOne({ projectId, folderKey });
  if (doc) {
    doc.viewedBy.set(userId, doc.activityCount);
    await doc.save();
  }
};

// ────────────────────── Folder Navigation (3-level) ──────────────────────

/**
 * GET /api/v2/location/folders
 * Returns 1st-level folders. groupBy determines what the folders represent.
 * Supports nested drill-down via filters.
 */
const getFolders = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { status = "select", groupBy = "episodes", nextGroupBy, fileName, sceneNumber, episode } = req.query;

    const match = { projectId, status, deleted: 0 };
    if (fileName) match.fileName = fileName;
    if (sceneNumber) match.sceneNumber = sceneNumber;
    if (episode) match.episode = episode;

    // ── Determine grouping field (now all are simple strings, no $unwind needed) ──
    const groupField = groupBy === "episodes" ? "$episode" : `$${groupBy}`;

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: groupField,
          count: { $sum: 1 },
          lastUpdate: { $max: "$updatedAt" },
          thumbnail: { $first: { $arrayElemAt: ["$attachments", 0] } },
          uniqueFileNames: { $addToSet: "$fileName" },
          uniqueSceneNumbers: { $addToSet: "$sceneNumber" },
          uniqueEpisodes: { $addToSet: "$episode" },
        },
      },
    ];

    // ── SubFolderCount (simple: just count distinct values) ──
    const countNonEmpty = (arr) => ({
      $size: { $filter: { input: arr, as: "v", cond: { $and: [{ $ne: ["$$v", ""] }, { $ne: ["$$v", null] }] } } },
    });

    let subFolderExpr = { $literal: 0 };
    if (nextGroupBy === "fileName") {
      subFolderExpr = countNonEmpty("$uniqueFileNames");
    } else if (nextGroupBy === "sceneNumber") {
      subFolderExpr = countNonEmpty("$uniqueSceneNumbers");
    } else if (nextGroupBy === "episodes") {
      subFolderExpr = countNonEmpty("$uniqueEpisodes");
    }

    pipeline.push(
      {
        $project: {
          _id: 0,
          folderName: { $ifNull: ["$_id", "Ungrouped"] },
          count: 1,
          lastUpdate: 1,
          thumbnail: 1,
          subFolderCount: subFolderExpr,
        },
      },
      { $sort: { folderName: 1 } }
    );

    const folders = await Location.aggregate(pipeline);

    // ── Mark viewed: parent folder the user just navigated into ──
    const parentParts = [];
    if (episode) parentParts.push(`ep:${episode}`);
    if (sceneNumber) parentParts.push(`sc:${sceneNumber}`);
    if (fileName) parentParts.push(`fn:${fileName}`);
    if (parentParts.length > 0) {
      // User drilled into a folder — mark it as viewed
      await markFolderViewed(projectId, buildFolderKey(status, parentParts), userId);
    }
    // NOTE: Don't mark tab as viewed at root — badges should persist until explicitly cleared

    // ── Compute badges per folder from FolderBadge collection ──
    const folderKeys = folders.map((f) => {
      const parts = [...parentParts];
      if (groupBy === "episodes") parts.push(`ep:${f.folderName}`);
      else if (groupBy === "sceneNumber") parts.push(`sc:${f.folderName}`);
      else if (groupBy === "fileName") parts.push(`fn:${f.folderName}`);
      return buildFolderKey(status, parts);
    });

    const badgeDocs = await FolderBadge.find({ projectId, folderKey: { $in: folderKeys } }).lean();
    const badgeMap = {};
    badgeDocs.forEach((bd) => {
      const viewed = bd.viewedBy?.[userId] || 0;
      badgeMap[bd.folderKey] = Math.max(0, bd.activityCount - viewed);
    });

    folders.forEach((f, i) => {
      f.badge = badgeMap[folderKeys[i]] || 0;
    });

    return sendSuccess(res, folders);
  } catch (error) {
    console.error("getFolders error:", error.message);
    return sendError(res, 500, "Failed to fetch folders");
  }
};

/**
 * GET /api/v2/location
 * Returns location items with filters for drill-down.
 */
const getLocations = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { status = "select", fileName, sceneNumber, episode, search, page = 0, limit = 50 } = req.query;

    const query = { projectId, status, deleted: 0 };
    if (fileName) query.fileName = fileName;
    if (sceneNumber) query.sceneNumber = sceneNumber;
    if (episode) query.episode = episode;
    if (search) {
      query.$or = [
        { fileName: { $regex: search, $options: "i" } },
        { sceneNumber: { $regex: search, $options: "i" } },
        { city: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { contactName: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { episode: { $regex: search, $options: "i" } },
      ];
    }

    const parsedLimit = parseInt(limit);
    const skip = parseInt(page) * (parsedLimit || 50);
    let q = Location.find(query).sort({ createdAt: -1 });
    if (parsedLimit > 0) {
      q = q.skip(skip).limit(parsedLimit);
    }
    // limit=0 means fetch all (no skip/limit)
    const locations = await q;

    const total = await Location.countDocuments(query);

    return sendSuccess(res, { locations, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error("getLocations error:", error.message);
    return sendError(res, 500, "Failed to fetch locations");
  }
};

/**
 * GET /api/v2/location/:id
 */
const getLocationById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid location ID");

    const userId = req.moduleData.user_id;
    const projectId = req.moduleData.project_id;
    const location = await Location.findById(id);
    if (!location) return sendError(res, 404, "Location not found");

    // Mark all folder keys for this location as viewed
    const allKeys = buildAllFolderKeys(
      location.status, location.episode, location.fileName, location.sceneNumber
    );
    for (const key of allKeys) {
      await markFolderViewed(projectId, key, userId);
    }

    const comments = await LocationComment.find({ locationId: id }).sort({ createdAt: 1 });

    // Fetch activities for this doc AND its source (so copied docs show full history)
    const activityQuery = { action: { $ne: "commented" } };
    if (location.sourceId) {
      activityQuery.locationId = { $in: [id, String(location.sourceId)] };
    } else {
      activityQuery.locationId = id;
    }
    const activities = await LocationActivityLog.find(activityQuery).sort({ createdAt: -1 }).limit(50);

    return sendSuccess(res, { location, comments, activities });
  } catch (error) {
    console.error("getLocationById error:", error.message);
    return sendError(res, 500, "Failed to fetch location");
  }
};

// ────────────────────── Create ──────────────────────

/**
 * POST /api/v2/location
 * Create location. For Library tab: only attachments/link needed.
 * For other tabs: fileName or sceneNumber required.
 */
const createLocation = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;

    const {
      fileName, sceneNumber, city, address, description,
      contactName, phone, countryCode, email, link,
      latitude, longitude, status = "select", createdByName,
    } = req.body;

    // Parse episodes (can be comma-separated or JSON array)
    let episodeList = [];
    if (req.body.episodes) {
      try {
        episodeList = JSON.parse(req.body.episodes);
      } catch {
        episodeList = req.body.episodes.split(",").map((e) => e.trim()).filter(Boolean);
      }
    }
    // If no episodes, create one entry with empty episode
    if (episodeList.length === 0) episodeList = [""];

    // Validate: need at least a name, scene number, or attachments
    if (!fileName && !sceneNumber && (!req.files || req.files.length === 0) && !link) {
      return sendError(res, 400, "Location name, scene number, or attachment is required");
    }

    // Handle file attachments — build attachment model objects
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        const att = await buildAttachment(f, projectId, "location");
        attachments.push(att);
      }
    }

    // Build base location data (shared across all episodes)
    const baseData = {
      projectId,
      fileName: fileName || "",
      sceneNumber: sceneNumber || "",
      city: city || "",
      address: address || "",
      description: description || "",
      contactName: contactName || "",
      phone: phone || "",
      countryCode: countryCode || "",
      email: email || "",
      link: link || "",
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      status,
      createdBy: { userId, name: createdByName || "" },
      subLocation: req.body.subLocation || "",
      interiorExterior: req.body.interiorExterior || "",
      dayNight: req.body.dayNight || "",
      parking: req.body.parking || "",
      permits: req.body.permits || "",
      notes: req.body.notes || "",
    };

    // Auto-fetch link preview + download images when link is provided
    if (link && link.startsWith("http")) {
      const { metadata, images } = await fetchLinkPreviewData(link);
      if (metadata) {
        baseData.linkPreview = metadata;
        if (!baseData.fileName && metadata.title) {
          baseData.fileName = metadata.title.substring(0, 100);
        }
      }
      for (const imgUrl of images) {
        const downloaded = await downloadImage(imgUrl);
        if (downloaded) {
          const att = await buildAttachmentFromDownload(downloaded, projectId, "location");
          attachments.push(att);
        }
      }
    }

    // Link preview from frontend (override if provided)
    if (req.body.linkPreview) {
      try { baseData.linkPreview = JSON.parse(req.body.linkPreview); } catch {}
    }

    baseData.attachments = attachments;

    // Create one document per episode (same images, same details)
    const docs = episodeList.map((ep) => ({ ...baseData, episode: ep }));
    const inserted = await Location.insertMany(docs);

    // Increment FolderBadge for each inserted document
    for (const loc of inserted) {
      const folderKeys = buildAllFolderKeys(status, loc.episode, loc.fileName, loc.sceneNumber);
      await incrementFolderBadges(projectId, folderKeys);
    }

    // Activity log for each
    const activityLogs = inserted.map((loc) => ({
      locationId: loc._id,
      projectId, userId,
      userName: createdByName || "",
      action: "created",
      details: `Location created in ${status}${loc.episode ? ` (Ep ${loc.episode})` : ""}`,
    }));
    await LocationActivityLog.insertMany(activityLogs);

    // Socket broadcast
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("location_created", { location: inserted[0], status, count: inserted.length });

    return sendSuccess(res, inserted.length === 1 ? inserted[0] : inserted,
      `${inserted.length} location(s) created successfully`, 201);
  } catch (error) {
    console.error("createLocation error:", error.message);
    return sendError(res, 500, "Failed to create location");
  }
};

/**
 * PUT /api/v2/location/:id
 */
const updateLocation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid location ID");

    const userId = req.moduleData.user_id;
    const location = await Location.findById(id);
    if (!location) return sendError(res, 404, "Location not found");

    const {
      fileName, sceneNumber, city, address, description,
      contactName, phone, countryCode, email, link,
      latitude, longitude, updatedByName,
    } = req.body;

    const updates = {};
    if (fileName !== undefined) updates.fileName = fileName;
    if (sceneNumber !== undefined) updates.sceneNumber = sceneNumber;
    if (city !== undefined) updates.city = city;
    if (address !== undefined) updates.address = address;
    if (description !== undefined) updates.description = description;
    if (contactName !== undefined) updates.contactName = contactName;
    if (phone !== undefined) updates.phone = phone;
    if (countryCode !== undefined) updates.countryCode = countryCode;
    if (email !== undefined) updates.email = email;
    if (link !== undefined) updates.link = link;
    if (latitude !== undefined) updates.latitude = latitude ? parseFloat(latitude) : null;
    if (longitude !== undefined) updates.longitude = longitude ? parseFloat(longitude) : null;
    updates.edited = true;

    // Parse episodes list from frontend
    let episodeList = [];
    if (req.body.episodes) {
      try {
        const parsed = JSON.parse(req.body.episodes);
        episodeList = Array.isArray(parsed) ? parsed.map((e) => String(e).trim()).filter(Boolean) : [String(parsed).trim()];
      } catch {
        episodeList = req.body.episodes.split(",").map((e) => e.trim()).filter(Boolean);
      }
    } else if (req.body.episode !== undefined) {
      episodeList = [req.body.episode];
    }

    // First episode updates the current document, additional episodes create new documents
    if (episodeList.length > 0) {
      updates.episode = episodeList[0];
    }

    // Link preview
    if (req.body.linkPreview) {
      try { updates.linkPreview = JSON.parse(req.body.linkPreview); } catch {}
    }

    // Merge attachments — existing (already in attachment model format) + new uploads
    let existingAttachments = [];
    if (req.body.existingAttachments) {
      try { existingAttachments = JSON.parse(req.body.existingAttachments); } catch {}
    }
    const newAttachments = [];
    if (req.files && req.files.length > 0) {
      const projectId = req.moduleData.project_id;
      for (const f of req.files) {
        const att = await buildAttachment(f, projectId, "location");
        newAttachments.push(att);
      }
    }
    updates.attachments = [...existingAttachments, ...newAttachments];

    const updated = await Location.findByIdAndUpdate(id, updates, { new: true });

    // Increment FolderBadge for all folder keys this location appears in
    const projectId = req.moduleData.project_id;
    const folderKeys = buildAllFolderKeys(
      updated.status, updated.episode, updated.fileName, updated.sceneNumber
    );
    await incrementFolderBadges(projectId, folderKeys);

    // Create additional documents for extra episodes (2nd, 3rd, etc.)
    const additionalEpisodes = episodeList.slice(1);
    const additionalDocs = [];
    if (additionalEpisodes.length > 0) {
      const baseData = updated.toObject();
      delete baseData._id;
      delete baseData.__v;
      delete baseData.createdAt;
      delete baseData.updatedAt;

      for (const ep of additionalEpisodes) {
        const newDoc = { ...baseData, episode: ep };
        const inserted = await Location.create(newDoc);
        additionalDocs.push(inserted);

        const epFolderKeys = buildAllFolderKeys(inserted.status, ep, inserted.fileName, inserted.sceneNumber);
        await incrementFolderBadges(projectId, epFolderKeys);
      }
    }

    const totalCount = 1 + additionalDocs.length;

    await LocationActivityLog.create({
      locationId: id,
      projectId,
      userId,
      userName: updatedByName || "",
      action: "edited",
      details: totalCount > 1
        ? `Location "${updated.fileName || updated.sceneNumber}" updated + ${additionalDocs.length} episode(s) added`
        : `Location "${updated.fileName || updated.sceneNumber}" updated`,
    });

    return sendSuccess(res, updated, totalCount > 1
      ? `Location updated + ${additionalDocs.length} episode(s) created`
      : "Location updated successfully");
  } catch (error) {
    console.error("updateLocation error:", error.message);
    return sendError(res, 500, "Failed to update location");
  }
};

// ────────────────────── Move ──────────────────────

/**
 * PUT /api/v2/location/move/items
 * Move locations. If moving from library, details can be attached.
 * If moving to shortlist/final, validate required fields.
 */
/**
 * PUT /api/v2/location/move
 *
 * COPY-based move: Original stays in its current unit. A copy is created in the target unit.
 * If the same image (by sourceId) already exists in the target unit with the same
 * episode + sceneNumber, it returns an error (duplicate).
 *
 * Body:
 *  - locationIds: string[]
 *  - targetStatus: string
 *  - commonDetails: { fileName, address, description, contactName, phone, ... }
 *  - perItemDetails: [{ _id, episodes, sceneNumber }]
 *  - fillDetails: (legacy, treated as commonDetails)
 */
const moveLocations = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { locationIds, targetStatus, userName, commonDetails, perItemDetails, fillDetails } = req.body;

    if (!locationIds || !Array.isArray(locationIds) || locationIds.length === 0) {
      return sendError(res, 400, "locationIds array is required");
    }
    // Validate target status against dynamic units
    const units = await Unit.find({ projectId }, { identifier: 1 }).lean();
    const validStatuses = units.length > 0 ? units.map((u) => u.identifier) : ["select", "shortlist", "final"];
    if (!validStatuses.includes(targetStatus)) {
      return sendError(res, 400, "Invalid target status");
    }

    const locations = await Location.find({ _id: { $in: locationIds }, projectId, deleted: 0 });
    if (locations.length === 0) return sendError(res, 404, "No locations found");

    // ── Build shared details ──
    const details = commonDetails || fillDetails || null;
    const sharedFields = {};
    if (details) {
      const fieldNames = [
        "fileName", "sceneNumber", "city", "address", "description",
        "contactName", "phone", "countryCode", "email",
        "subLocation", "interiorExterior", "dayNight", "parking", "permits", "notes",
      ];
      fieldNames.forEach((f) => { if (details[f]) sharedFields[f] = details[f]; });
      if (details.latitude) sharedFields.latitude = parseFloat(details.latitude);
      if (details.longitude) sharedFields.longitude = parseFloat(details.longitude);
      if (details.episode !== undefined) sharedFields.episode = details.episode;
    }

    // ── Build per-item overrides map ──
    const perItemMap = {};
    if (perItemDetails && Array.isArray(perItemDetails)) {
      perItemDetails.forEach((item) => {
        if (!item._id) return;
        const overrides = {};
        if (item.sceneNumber !== undefined) overrides.sceneNumber = item.sceneNumber;
        if (item.episode !== undefined) overrides.episode = item.episode;
        if (Object.keys(overrides).length > 0) perItemMap[String(item._id)] = overrides;
      });
    }

    // ── Check for duplicates (two methods) ──
    // Method 1: sourceId tracking
    const sourceIds = locations.map((loc) => loc.sourceId || loc._id);
    const existingBySource = await Location.find({
      projectId, status: targetStatus, sourceId: { $in: sourceIds }, deleted: 0,
    }).lean();
    const sourceSet = new Set(existingBySource.map((c) => String(c.sourceId)));

    // Method 2: same fileName + sceneNumber + episode already exists
    const existingByData = await Location.find({
      projectId, status: targetStatus, deleted: 0,
    }, { fileName: 1, sceneNumber: 1, episode: 1 }).lean();
    const dataSet = new Set(existingByData.map((l) =>
      `${(l.fileName || '').toLowerCase()}|${(l.sceneNumber || '').toLowerCase()}|${(l.episode || '').toLowerCase()}`
    ));

    const duplicates = [];
    const toCopy = [];

    for (const loc of locations) {
      const srcId = String(loc.sourceId || loc._id);
      const dataKey = `${(loc.fileName || '').toLowerCase()}|${(loc.sceneNumber || '').toLowerCase()}|${(loc.episode || '').toLowerCase()}`;

      if (sourceSet.has(srcId) || dataSet.has(dataKey)) {
        duplicates.push(`${loc.fileName || loc.sceneNumber || ''} (Ep ${loc.episode || '-'})`);
      } else {
        toCopy.push(loc);
      }
    }

    if (toCopy.length === 0) {
      const names = duplicates.slice(0, 5).join(", ");
      return sendError(res, 409,
        `These images have already been moved to ${targetStatus}: ${names}${duplicates.length > 5 ? ` and ${duplicates.length - 5} more` : ""}`
      );
    }

    // ── Create copies ──
    const newDocs = toCopy.map((loc) => {
      const locObj = loc.toObject();
      const locId = String(loc._id);
      const perItem = perItemMap[locId] || {};

      // Remove fields that should not be copied
      delete locObj._id;
      delete locObj.__v;
      delete locObj.createdAt;
      delete locObj.updatedAt;
      delete locObj.lastViewedBy;
      delete locObj.discussion;

      // Merge: original data < shared details < per-item overrides
      return {
        ...locObj,
        ...sharedFields,
        ...perItem,
        status: targetStatus,
        sourceId: loc.sourceId || loc._id, // point back to the original
        lastViewedBy: {},
      };
    });

    const inserted = await Location.insertMany(newDocs);

    // ── Log activity ──
    const activityLogs = inserted.map((newLoc, idx) => ({
      locationId: newLoc._id,
      projectId,
      userId,
      userName: userName || "",
      action: "moved",
      details: `Copied to "${targetStatus}" from "${toCopy[idx].status}"`,
      previousValue: toCopy[idx].status,
      newValue: targetStatus,
    }));
    await LocationActivityLog.insertMany(activityLogs);

    // ── Increment badges for target status ──
    for (const newLoc of inserted) {
      const keys = buildAllFolderKeys(targetStatus, newLoc.episode, newLoc.fileName, newLoc.sceneNumber);
      await incrementFolderBadges(projectId, keys);
    }

    // ── Socket broadcast ──
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("locations_moved", {
      locationIds: inserted.map((l) => l._id),
      toStatus: targetStatus,
      count: inserted.length,
    });

    let msg = `${inserted.length} location(s) copied to ${targetStatus}`;
    if (duplicates.length > 0) {
      msg += `. ${duplicates.length} skipped (already in ${targetStatus}).`;
    }
    return sendSuccess(res, {
      movedCount: inserted.length,
      duplicateCount: duplicates.length,
      duplicateNames: duplicates.slice(0, 10),
    }, msg);
  } catch (error) {
    console.error("moveLocations error:", error.message);
    return sendError(res, 500, "Failed to move locations");
  }
};

/**
 * PUT /api/v2/location/move/folder
 * Same approach as moveLocations — accepts commonDetails + perItemDetails
 */
const moveFolder = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { folderField, folderValue, currentStatus, targetStatus, episode, userName,
            commonDetails, perItemDetails, fillDetails } = req.body;

    if (folderValue === undefined || folderValue === null) {
      return sendError(res, 400, "Folder value is required");
    }

    // Validate target status against dynamic units
    const units = await Unit.find({ projectId }, { identifier: 1 }).lean();
    const validStatuses = units.length > 0 ? units.map((u) => u.identifier) : ["select", "shortlist", "final"];
    if (!validStatuses.includes(targetStatus)) {
      return sendError(res, 400, "Invalid target status");
    }

    const query = { projectId, status: currentStatus, deleted: 0 };
    // Map "episodes" → "episode" (frontend sends "episodes", DB field is "episode")
    const dbField = folderField === "episodes" ? "episode" : (folderField || "fileName");
    query[dbField] = folderValue;
    if (episode) query.episode = episode;

    const locations = await Location.find(query);
    if (locations.length === 0) return sendError(res, 404, "No locations found in folder");

    // Build shared update
    const details = commonDetails || fillDetails || null;
    const sharedUpdate = { status: targetStatus };
    if (details) {
      const fields = [
        "fileName", "sceneNumber", "city", "address", "description",
        "contactName", "phone", "countryCode", "email",
        "subLocation", "interiorExterior", "dayNight", "parking", "permits", "notes",
      ];
      fields.forEach((f) => { if (details[f]) sharedUpdate[f] = details[f]; });
      if (details.latitude) sharedUpdate.latitude = parseFloat(details.latitude);
      if (details.longitude) sharedUpdate.longitude = parseFloat(details.longitude);
      if (details.episode !== undefined) sharedUpdate.episode = details.episode;
    }

    // Per-item overrides
    const perItemMap = {};
    if (perItemDetails && Array.isArray(perItemDetails)) {
      perItemDetails.forEach((item) => {
        if (!item._id) return;
        const itemUpdate = {};
        if (item.sceneNumber !== undefined) itemUpdate.sceneNumber = item.sceneNumber;
        if (item.episode !== undefined) itemUpdate.episode = item.episode;
        if (Object.keys(itemUpdate).length > 0) perItemMap[String(item._id)] = itemUpdate;
      });
    }

    // ── Check for duplicates (two methods) ──
    const sourceIds = locations.map((loc) => loc.sourceId || loc._id);
    const existingBySource = await Location.find({
      projectId, status: targetStatus, sourceId: { $in: sourceIds }, deleted: 0,
    }).lean();
    const sourceSet = new Set(existingBySource.map((c) => String(c.sourceId)));

    const existingByData = await Location.find({
      projectId, status: targetStatus, deleted: 0,
    }, { fileName: 1, sceneNumber: 1, episode: 1 }).lean();
    const dataSet = new Set(existingByData.map((l) =>
      `${(l.fileName || '').toLowerCase()}|${(l.sceneNumber || '').toLowerCase()}|${(l.episode || '').toLowerCase()}`
    ));

    const duplicates = [];
    const toCopy = [];
    for (const loc of locations) {
      const srcId = String(loc.sourceId || loc._id);
      const dataKey = `${(loc.fileName || '').toLowerCase()}|${(loc.sceneNumber || '').toLowerCase()}|${(loc.episode || '').toLowerCase()}`;

      if (sourceSet.has(srcId) || dataSet.has(dataKey)) {
        duplicates.push(`${loc.fileName || loc.sceneNumber || ''} (Ep ${loc.episode || '-'})`);
      } else {
        toCopy.push(loc);
      }
    }

    if (toCopy.length === 0) {
      return sendError(res, 409, `All items in this folder already exist in ${targetStatus}.`);
    }

    // ── Create copies ──
    const newDocs = toCopy.map((loc) => {
      const locObj = loc.toObject();
      const perItem = perItemMap[String(loc._id)] || {};
      delete locObj._id;
      delete locObj.__v;
      delete locObj.createdAt;
      delete locObj.updatedAt;
      delete locObj.lastViewedBy;
      delete locObj.discussion;

      return {
        ...locObj,
        ...sharedUpdate,
        ...perItem,
        status: targetStatus,
        sourceId: loc.sourceId || loc._id,
        lastViewedBy: {},
      };
    });

    const inserted = await Location.insertMany(newDocs);

    await LocationActivityLog.create({
      projectId, userId,
      userName: userName || "",
      action: "moved",
      details: `Folder "${folderValue}" copied from "${currentStatus}" to "${targetStatus}" (${inserted.length} items)`,
      previousValue: currentStatus, newValue: targetStatus,
    });

    // ── Increment badges for target status ──
    for (const newLoc of inserted) {
      const keys = buildAllFolderKeys(targetStatus, newLoc.episode, newLoc.fileName, newLoc.sceneNumber);
      await incrementFolderBadges(projectId, keys);
    }

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("folder_moved", { folderValue, toStatus: targetStatus });

    let msg = `${inserted.length} item(s) from folder copied to ${targetStatus}`;
    if (duplicates.length > 0) msg += `. ${duplicates.length} skipped (already there).`;
    return sendSuccess(res, { movedCount: inserted.length, duplicateCount: duplicates.length }, msg);
  } catch (error) {
    console.error("moveFolder error:", error.message);
    return sendError(res, 500, "Failed to move folder");
  }
};

// ────────────────────── Delete / Restore ──────────────────────

const deleteLocation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid location ID");

    const location = await Location.findById(id);
    if (!location) return sendError(res, 404, "Location not found");

    await Location.findByIdAndUpdate(id, { deleted: Date.now() });

    await LocationActivityLog.create({
      locationId: id, projectId: req.moduleData.project_id,
      userId: req.moduleData.user_id,
      action: "deleted",
      details: `Location "${location.fileName || location.sceneNumber}" deleted`,
    });

    const io = req.app.get("io");
    if (io) io.to(req.moduleData.project_id).emit("location_deleted", { locationId: id, status: location.status });

    return sendSuccess(res, null, "Location deleted successfully");
  } catch (error) {
    console.error("deleteLocation error:", error.message);
    return sendError(res, 500, "Failed to delete location");
  }
};

const deleteFolder = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { folderField, folderValue, status, episode } = req.body;

    if (folderValue === undefined || folderValue === null) return sendError(res, 400, "Folder value is required");

    const query = { projectId, deleted: 0 };
    // Map "episodes" → "episode" (frontend sends "episodes", DB field is "episode")
    const dbField = folderField === "episodes" ? "episode" : (folderField || "fileName");
    query[dbField] = folderValue;
    if (status) query.status = status;

    const result = await Location.updateMany(query, { $set: { deleted: Date.now() } });

    await LocationActivityLog.create({
      projectId, userId: req.moduleData.user_id,
      action: "deleted",
      details: `Folder "${folderValue}" deleted (${result.modifiedCount} items)`,
    });

    return sendSuccess(res, { deletedCount: result.modifiedCount }, "Folder deleted");
  } catch (error) {
    console.error("deleteFolder error:", error.message);
    return sendError(res, 500, "Failed to delete folder");
  }
};

const restoreLocation = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid location ID");

    const location = await Location.findById(id);
    if (!location) return sendError(res, 404, "Location not found");
    if (location.deleted === 0) return sendError(res, 400, "Not deleted");

    await Location.findByIdAndUpdate(id, { deleted: 0 });

    await LocationActivityLog.create({
      locationId: id, projectId: req.moduleData.project_id,
      userId: req.moduleData.user_id,
      action: "restored",
      details: `Location restored`,
    });

    return sendSuccess(res, null, "Location restored");
  } catch (error) {
    console.error("restoreLocation error:", error.message);
    return sendError(res, 500, "Failed to restore location");
  }
};

const getDeletedLocations = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const locations = await Location.find({ projectId, deleted: { $gt: 0 } }).sort({ deleted: -1 }).limit(100);
    return sendSuccess(res, locations);
  } catch (error) {
    return sendError(res, 500, "Failed to fetch deleted locations");
  }
};

// ────────────────────── Stats / Badges ──────────────────────

/**
 * GET /api/v2/location/stats
 * Returns badge counts: tab counts + unit chat unread + folder new items.
 */
const getStats = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;

    // Fetch dynamic unit identifiers
    const units = await Unit.find({ projectId }, { identifier: 1 }).lean();
    const tabKeys = units.length > 0
      ? units.map((u) => u.identifier)
      : ["select", "shortlist", "final"];

    // Item counts per status
    const allLocations = await Location.find(
      { projectId, deleted: 0 },
      { status: 1 }
    ).lean();

    const stats = { total: 0 };
    tabKeys.forEach((k) => { stats[k] = 0; });
    allLocations.forEach((loc) => {
      stats[loc.status] = (stats[loc.status] || 0) + 1;
      stats.total += 1;
    });

    // Tab-level badges from FolderBadge collection
    const tabBadgeDocs = await FolderBadge.find({ projectId, folderKey: { $in: tabKeys } }).lean();
    const badges = {};
    tabKeys.forEach((k) => { badges[k] = 0; });
    tabBadgeDocs.forEach((bd) => {
      const viewed = bd.viewedBy?.[userId] || 0;
      badges[bd.folderKey] = Math.max(0, bd.activityCount - viewed);
    });

    // Unit chat unread counts
    const unitChatCounts = await UnitChat.aggregate([
      { $match: { projectId } },
      { $group: { _id: "$unit", count: { $sum: 1 } } },
    ]);
    const unitChats = {};
    unitChatCounts.forEach((u) => { unitChats[u._id] = u.count; });

    return sendSuccess(res, { stats, badges, unitChats });
  } catch (error) {
    console.error("getStats error:", error.message);
    return sendError(res, 500, "Failed to fetch stats");
  }
};

// ────────────────────── Unit Chat ──────────────────────

const getUnitChats = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { unit } = req.query;
    if (!["library", "select", "shortlist", "final"].includes(unit)) {
      return sendError(res, 400, "Invalid unit");
    }

    const messages = await UnitChat.find({ projectId, unit }).sort({ createdAt: 1 });
    return sendSuccess(res, messages);
  } catch (error) {
    return sendError(res, 500, "Failed to fetch unit chats");
  }
};

const createUnitChat = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { unit, text, userName } = req.body;

    if (!["library", "select", "shortlist", "final"].includes(unit)) {
      return sendError(res, 400, "Invalid unit");
    }
    if (!text || !text.trim()) return sendError(res, 400, "Message is required");

    const chatData = { projectId, unit, userId, userName: userName || "", text: text.trim() };

    if (req.files && req.files.length > 0) {
      chatData.attachments = req.files.map((f) => ({
        filename: f.filename, originalName: f.originalname,
        mimetype: f.mimetype, path: f.path, size: f.size,
      }));
    }

    const message = await UnitChat.create(chatData);

    // Socket broadcast
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("unit_chat_message", { unit, message });

    return sendSuccess(res, message, "Message sent", 201);
  } catch (error) {
    return sendError(res, 500, "Failed to send message");
  }
};

// ────────────────────── Image-level Comments ──────────────────────

const getComments = async (req, res) => {
  try {
    const { locationId } = req.params;
    if (!isValidObjectId(locationId)) return sendError(res, 400, "Invalid location ID");
    const comments = await LocationComment.find({ locationId }).sort({ createdAt: 1 });
    return sendSuccess(res, comments);
  } catch (error) {
    return sendError(res, 500, "Failed to fetch comments");
  }
};

const createComment = async (req, res) => {
  try {
    const { locationId } = req.params;
    if (!isValidObjectId(locationId)) return sendError(res, 400, "Invalid location ID");

    const userId = req.moduleData.user_id;
    const projectId = req.moduleData.project_id;
    const { text, userName, contextEpisode, contextSceneNumber, replyToId, replyToUserName, replyToText } = req.body;

    if (!text || !text.trim()) return sendError(res, 400, "Comment text is required");

    const commentData = {
      locationId, projectId, userId,
      userName: userName || "",
      text: text.trim(),
      context: {
        episode: contextEpisode || "",
        sceneNumber: contextSceneNumber || "",
      },
    };

    // Thread reply
    if (replyToId) {
      commentData.replyTo = {
        commentId: replyToId,
        userName: replyToUserName || "",
        text: (replyToText || "").substring(0, 100),
      };
    }

    if (req.files && req.files.length > 0) {
      commentData.attachments = req.files.map((f) => ({
        filename: f.filename, originalName: f.originalname,
        mimetype: f.mimetype, path: f.path, size: f.size,
      }));
    }

    const comment = await LocationComment.create(commentData);

    // Update discussion flag
    const loc = await Location.findByIdAndUpdate(locationId, { discussion: true }, { new: true });

    // Increment FolderBadge — simple: each location has exactly one episode
    const folderKeys = buildAllFolderKeys(
      loc.status, loc.episode, loc.fileName, loc.sceneNumber
    );
    await incrementFolderBadges(projectId, folderKeys);

    await LocationActivityLog.create({
      locationId, projectId, userId,
      userName: userName || "",
      action: "commented",
      details: text.trim().substring(0, 100),
    });

    // Socket broadcast
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("location_comment", { locationId, comment });

    return sendSuccess(res, comment, "Comment added", 201);
  } catch (error) {
    return sendError(res, 500, "Failed to add comment");
  }
};

const updateComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid comment ID");
    const { text } = req.body;
    if (!text || !text.trim()) return sendError(res, 400, "Comment text is required");
    const updated = await LocationComment.findByIdAndUpdate(
      id,
      { text: text.trim() },
      { new: true }
    );
    if (!updated) return sendError(res, 404, "Comment not found");
    return sendSuccess(res, updated, "Comment updated");
  } catch (error) {
    return sendError(res, 500, "Failed to update comment");
  }
};

const deleteComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid comment ID");
    await LocationComment.findByIdAndDelete(id);
    return sendSuccess(res, null, "Comment deleted");
  } catch (error) {
    return sendError(res, 500, "Failed to delete comment");
  }
};

// ────────────────────── Share ──────────────────────

const shareLocations = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { locationIds, userIds, userName, message } = req.body;

    if (!locationIds?.length) return sendError(res, 400, "locationIds required");
    if (!userIds?.length) return sendError(res, 400, "userIds required");

    const activityLogs = locationIds.map((locId) => ({
      locationId: locId, projectId, userId,
      userName: userName || "",
      action: "shared",
      details: `Shared with ${userIds.length} user(s)${message ? `: ${message}` : ""}`,
    }));
    await LocationActivityLog.insertMany(activityLogs);

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("locations_shared", { locationIds, sharedBy: { userId, name: userName }, sharedWith: userIds, message });

    return sendSuccess(res, { sharedCount: locationIds.length, recipientCount: userIds.length }, "Shared");
  } catch (error) {
    return sendError(res, 500, "Failed to share");
  }
};

// ────────────────────── Units (Tabs) ──────────────────────

const DEFAULT_UNITS = [
  { identifier: "library", label: "Library", order: 0 },
  { identifier: "select", label: "Selects", order: 1 },
  { identifier: "shortlist", label: "Shortlisted", order: 2 },
  { identifier: "final", label: "Final", order: 3 },
];

/**
 * GET /api/v2/location/units
 * Returns units for this project. Auto-seeds defaults if none exist.
 */
const getUnits = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;

    let units = await Unit.find({ projectId }).sort({ order: 1 }).lean();

    // Auto-seed default units if none exist for this project
    if (units.length === 0) {
      const docs = DEFAULT_UNITS.map((u) => ({ ...u, projectId }));
      units = await Unit.insertMany(docs);
      units = units.map((u) => u.toObject ? u.toObject() : u);
    }

    return sendSuccess(res, units);
  } catch (error) {
    console.error("getUnits error:", error.message);
    return sendError(res, 500, "Failed to fetch units");
  }
};

/**
 * GET /api/v2/location/badges?status=select
 * Returns all folder badge counts for a tab so the frontend can render badges client-side.
 * Also marks the tab itself as viewed.
 */
const getBadges = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { status = "select" } = req.query;

    // NOTE: Don't mark tab as viewed here — only mark when user explicitly navigates
    // Fetch all folder badges for this status (keys start with status|)
    const badgeDocs = await FolderBadge.find({
      projectId,
      $or: [
        { folderKey: status },
        { folderKey: { $regex: `^${status}\\|` } },
      ],
    }).lean();

    const badges = {};
    badgeDocs.forEach((bd) => {
      const viewed = bd.viewedBy?.[userId] || 0;
      const unseen = Math.max(0, bd.activityCount - viewed);
      if (unseen > 0) {
        badges[bd.folderKey] = unseen;
      }
    });

    return sendSuccess(res, badges);
  } catch (error) {
    console.error("getBadges error:", error.message);
    return sendError(res, 500, "Failed to fetch badges");
  }
};

/**
 * POST /api/v2/location/mark-viewed
 * Mark a specific folder key as viewed by the current user.
 */
const markViewed = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { folderKey } = req.body;
    if (!folderKey) return sendError(res, 400, "folderKey is required");
    await markFolderViewed(projectId, folderKey, userId);
    return sendSuccess(res, { marked: folderKey });
  } catch (error) {
    console.error("markViewed error:", error.message);
    return sendError(res, 500, "Failed to mark viewed");
  }
};

// ════════════════════════════════════════════════════════════
// ══  SYNC API — Timestamp-based pagination for Mobile    ══
// ════════════════════════════════════════════════════════════
//
// Mobile flow:
//   1. Initial load  → GET /sync?status=select&direction=prev&limit=50
//      Returns all non-deleted items (oldest first). Store syncTimestamp.
//   2. Incremental   → GET /sync?status=select&since=<ts>&direction=next&limit=50
//      Returns changed items INCLUDING deleted (so mobile can purge from Realm).
//   3. Pull-refresh  → Same as #2 with direction=next.
//
// direction=prev → exclude deleted items  (deleted: 0)
// direction=next → include deleted items  (mobile removes them from local DB)
// ════════════════════════════════════════════════════════════

/**
 * GET /api/v2/location/sync
 * Sync locations for a status tab using timestamp cursor.
 */
const syncLocations = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { status = "select", since, direction = "prev", limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();
    const query = { projectId, status };

    // Timestamp cursor
    if (since) {
      query.updatedAt = { $gt: new Date(since) };
    }

    // direction=prev → only non-deleted; direction=next → include deleted
    if (direction !== "next") {
      query.deleted = 0;
    }

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = Location.find(query).sort({ updatedAt: 1 }); // ascending for sync
    if (parsedLimit > 0) {
      q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    }
    const locations = await q;

    const total = await Location.countDocuments(query);

    return sendSuccess(res, {
      locations,
      total,
      page: parsedPage,
      limit: parsedLimit,
      syncTimestamp,
    });
  } catch (error) {
    console.error("syncLocations error:", error.message);
    return sendError(res, 500, "Failed to sync locations");
  }
};

/**
 * GET /api/v2/location/sync/comments
 * Sync comments for locations in a status tab.
 */
const syncComments = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { status = "select", since, direction = "prev", limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();

    // Find location IDs in this status
    const locQuery = { projectId, status };
    if (direction !== "next") {
      locQuery.deleted = 0;
    }
    const locationIds = await Location.find(locQuery, { _id: 1 }).lean();
    const ids = locationIds.map((l) => l._id);

    // Build comment query
    const commentQuery = { locationId: { $in: ids } };
    if (since) {
      commentQuery.updatedAt = { $gt: new Date(since) };
    }

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = LocationComment.find(commentQuery).sort({ updatedAt: 1 });
    if (parsedLimit > 0) {
      q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    }
    const comments = await q;

    const total = await LocationComment.countDocuments(commentQuery);

    return sendSuccess(res, {
      comments,
      total,
      page: parsedPage,
      limit: parsedLimit,
      syncTimestamp,
    });
  } catch (error) {
    console.error("syncComments error:", error.message);
    return sendError(res, 500, "Failed to sync comments");
  }
};

/**
 * GET /api/v2/location/sync/activity
 * Sync activity logs for the project.
 */
const syncActivity = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { since, limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();

    const query = { projectId };
    if (since) {
      query.createdAt = { $gt: new Date(since) };
    }

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = LocationActivityLog.find(query).sort({ createdAt: 1 });
    if (parsedLimit > 0) {
      q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    }
    const activities = await q;

    const total = await LocationActivityLog.countDocuments(query);

    return sendSuccess(res, {
      activities,
      total,
      page: parsedPage,
      limit: parsedLimit,
      syncTimestamp,
    });
  } catch (error) {
    console.error("syncActivity error:", error.message);
    return sendError(res, 500, "Failed to sync activity");
  }
};

/**
 * GET /api/v2/location/sync/unit-chats
 * Sync unit-level chat messages.
 */
const syncUnitChats = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { unit = "select", since, limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();

    const query = { projectId, unit };
    if (since) {
      query.createdAt = { $gt: new Date(since) };
    }

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = UnitChat.find(query).sort({ createdAt: 1 });
    if (parsedLimit > 0) {
      q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    }
    const chats = await q;

    const total = await UnitChat.countDocuments(query);

    return sendSuccess(res, {
      chats,
      total,
      page: parsedPage,
      limit: parsedLimit,
      syncTimestamp,
    });
  } catch (error) {
    console.error("syncUnitChats error:", error.message);
    return sendError(res, 500, "Failed to sync unit chats");
  }
};

/**
 * POST /api/v2/location/bulk-delete
 * Soft delete multiple locations by IDs in a single call.
 */
const bulkDeleteLocations = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { locationIds } = req.body;

    if (!locationIds || !Array.isArray(locationIds) || locationIds.length === 0) {
      return sendError(res, 400, "locationIds array is required");
    }

    const result = await Location.updateMany(
      { _id: { $in: locationIds }, projectId, deleted: 0 },
      { $set: { deleted: Date.now() } }
    );

    await LocationActivityLog.create({
      projectId, userId,
      action: "deleted",
      details: `Bulk deleted ${result.modifiedCount} location(s)`,
    });

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("location_deleted", { locationIds, count: result.modifiedCount });

    return sendSuccess(res, { deletedCount: result.modifiedCount }, `${result.modifiedCount} location(s) deleted`);
  } catch (error) {
    console.error("bulkDeleteLocations error:", error.message);
    return sendError(res, 500, "Failed to delete locations");
  }
};

module.exports = {
  getFolders, getLocations, getLocationById,
  createLocation, updateLocation,
  moveLocations, moveFolder,
  deleteLocation, bulkDeleteLocations, deleteFolder, restoreLocation, getDeletedLocations,
  getStats,
  getUnitChats, createUnitChat,
  getComments, createComment, updateComment, deleteComment,
  shareLocations,
  getUnits,
  getBadges,
  markViewed,
  syncLocations,
  syncComments,
  syncActivity,
  syncUnitChats,
};
