const Wardrobe = require("../models/Wardrobe");
const WardrobeComment = require("../models/WardrobeComment");
const WardrobeActivityLog = require("../models/WardrobeActivityLog");
const WardrobeUnitChat = require("../models/WardrobeUnitChat");
const WardrobeFolderBadge = require("../models/WardrobeFolderBadge");
const WardrobeUnit = require("../models/WardrobeUnit");
const TalentMeasurements = require("../models/TalentMeasurements");
const TemporaryCast = require("../models/TemporaryCast");
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
    const filename = `wardrobe-preview-${uuidv4()}${ext}`;
    const uploadDir = path.join(__dirname, "..", "uploads");

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

    const baseUrl = new URL(url);
    if (metadata.image && !metadata.image.startsWith("http")) {
      metadata.image = new URL(metadata.image, baseUrl.origin).href;
    }

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
 * e.g., buildFolderKey("select", ["ep:EP01", "ch:Detective Ray"]) → "select|ch:Detective Ray|ep:EP01"
 */
const buildFolderKey = (status, parts) => {
  if (!parts || parts.length === 0) return status;
  const sorted = [...parts].sort();
  return [status, ...sorted].join("|");
};

/**
 * Generate all non-empty subsets of an array.
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
 * Build ALL folder keys for a wardrobe item (every combination of its dimensions).
 * Includes the bare status key for tab-level badge.
 * Prefixes: ep: (episode), ch: (characterName), sc: (sceneNumber)
 */
const buildAllFolderKeys = (status, episode, characterName, sceneNumber) => {
  const keys = new Set();
  keys.add(status); // tab-level badge

  const parts = [];
  if (episode) parts.push(`ep:${episode}`);
  if (characterName) parts.push(`ch:${characterName}`);
  if (sceneNumber) parts.push(`sc:${sceneNumber}`);

  if (parts.length > 0) {
    allSubsets(parts).forEach((s) => keys.add(buildFolderKey(status, s)));
  }

  return Array.from(keys);
};

/**
 * Increment badge activity count on all relevant folder keys.
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
  await WardrobeFolderBadge.bulkWrite(bulkOps);
};

/**
 * Mark a folder as viewed by a user.
 */
const markFolderViewed = async (projectId, folderKey, userId) => {
  const doc = await WardrobeFolderBadge.findOne({ projectId, folderKey });
  if (doc) {
    doc.viewedBy.set(userId, doc.activityCount);
    await doc.save();
  }
};

// ────────────────────── Folder Navigation (3-level) ──────────────────────

/**
 * GET /api/v2/wardrobe/folders
 * Grouping fields: episode, characterName, sceneNumber
 */
const getWardrobeFolders = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { status = "select", toolType = "main", groupBy = "episode", nextGroupBy, characterName, sceneNumber, episode } = req.query;

    const match = { projectId, toolType, status, deleted: 0 };
    if (characterName) match.characterName = characterName;
    if (sceneNumber) match.sceneNumber = sceneNumber;
    if (episode) match.episode = episode;

    const groupField = `$${groupBy}`;

    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: groupField,
          count: { $sum: 1 },
          lastUpdate: { $max: "$updatedAt" },
          thumbnail: { $first: { $arrayElemAt: ["$attachments", 0] } },
          uniqueCharacterNames: { $addToSet: "$characterName" },
          uniqueSceneNumbers: { $addToSet: "$sceneNumber" },
          uniqueEpisodes: { $addToSet: "$episode" },
        },
      },
    ];

    // SubFolderCount
    const countNonEmpty = (arr) => ({
      $size: { $filter: { input: arr, as: "v", cond: { $and: [{ $ne: ["$$v", ""] }, { $ne: ["$$v", null] }] } } },
    });

    let subFolderExpr = { $literal: 0 };
    if (nextGroupBy === "characterName") {
      subFolderExpr = countNonEmpty("$uniqueCharacterNames");
    } else if (nextGroupBy === "sceneNumber") {
      subFolderExpr = countNonEmpty("$uniqueSceneNumbers");
    } else if (nextGroupBy === "episode") {
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
          characterCount: countNonEmpty("$uniqueCharacterNames"),
          sceneCount: countNonEmpty("$uniqueSceneNumbers"),
        },
      },
      { $sort: { folderName: 1 } }
    );

    const folders = await Wardrobe.aggregate(pipeline);

    // Mark viewed: parent folder
    const parentParts = [];
    if (episode) parentParts.push(`ep:${episode}`);
    if (characterName) parentParts.push(`ch:${characterName}`);
    if (sceneNumber) parentParts.push(`sc:${sceneNumber}`);
    if (parentParts.length > 0) {
      await markFolderViewed(projectId, buildFolderKey(status, parentParts), userId);
    }

    // Compute badges per folder
    const folderKeys = folders.map((f) => {
      const parts = [...parentParts];
      if (groupBy === "episode") parts.push(`ep:${f.folderName}`);
      else if (groupBy === "characterName") parts.push(`ch:${f.folderName}`);
      else if (groupBy === "sceneNumber") parts.push(`sc:${f.folderName}`);
      return buildFolderKey(status, parts);
    });

    const badgeDocs = await WardrobeFolderBadge.find({ projectId, folderKey: { $in: folderKeys } }).lean();
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
    console.error("getWardrobeFolders error:", error.message);
    return sendError(res, 500, "Failed to fetch wardrobe folders");
  }
};

/**
 * GET /api/v2/wardrobe
 */
const getWardrobes = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { status = "select", toolType = "main", characterName, sceneNumber, episode, search, page = 0, limit = 50 } = req.query;

    const query = { projectId, toolType, status, deleted: 0 };
    if (characterName) query.characterName = characterName;
    if (sceneNumber) query.sceneNumber = sceneNumber;
    if (episode) query.episode = episode;
    if (search) {
      query.$or = [
        { characterName: { $regex: search, $options: "i" } },
        { talentName: { $regex: search, $options: "i" } },
        { episode: { $regex: search, $options: "i" } },
        { sceneNumber: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const parsedLimit = parseInt(limit);
    const skip = parseInt(page) * (parsedLimit || 50);
    let q = Wardrobe.find(query).sort({ createdAt: -1 });
    if (parsedLimit > 0) {
      q = q.skip(skip).limit(parsedLimit);
    }
    const wardrobes = await q;
    const total = await Wardrobe.countDocuments(query);

    return sendSuccess(res, { wardrobes, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error("getWardrobes error:", error.message);
    return sendError(res, 500, "Failed to fetch wardrobes");
  }
};

/**
 * GET /api/v2/wardrobe/:id
 */
const getWardrobeById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid wardrobe ID");

    const userId = req.moduleData.user_id;
    const projectId = req.moduleData.project_id;
    const wardrobe = await Wardrobe.findById(id);
    if (!wardrobe) return sendError(res, 404, "Wardrobe not found");

    // Mark all folder keys as viewed
    const allKeys = buildAllFolderKeys(
      wardrobe.status, wardrobe.episode, wardrobe.characterName, wardrobe.sceneNumber
    );
    for (const key of allKeys) {
      await markFolderViewed(projectId, key, userId);
    }

    const comments = await WardrobeComment.find({ wardrobeId: id }).sort({ createdAt: 1 });

    const activityQuery = { action: { $ne: "commented" } };
    if (wardrobe.sourceId) {
      activityQuery.wardrobeId = { $in: [id, String(wardrobe.sourceId)] };
    } else {
      activityQuery.wardrobeId = id;
    }
    const activities = await WardrobeActivityLog.find(activityQuery).sort({ createdAt: -1 }).limit(50);

    return sendSuccess(res, { wardrobe, comments, activities });
  } catch (error) {
    console.error("getWardrobeById error:", error.message);
    return sendError(res, 500, "Failed to fetch wardrobe");
  }
};

// ────────────────────── Create ──────────────────────

/**
 * POST /api/v2/wardrobe
 */
const createWardrobe = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;

    const {
      castId, characterName, talentName, gender, isTemporary,
      sceneNumber, description, link,
      costumeState, continuityNotes, accessories, hairMakeupState, quickChange, changeNotes,
      status = "select", toolType = "main", createdByName,
    } = req.body;

    // Parse episodes (same pattern as casting — can be JSON array or comma-separated)
    let episodeList = [];
    if (req.body.episodes) {
      try {
        episodeList = JSON.parse(req.body.episodes);
      } catch {
        episodeList = req.body.episodes.split(",").map((e) => e.trim()).filter(Boolean);
      }
    } else if (req.body.episode) {
      episodeList = [req.body.episode];
    }
    if (episodeList.length === 0) episodeList = [""];

    // Handle file attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        const att = await buildAttachment(f, projectId, "wardrobe");
        attachments.push(att);
      }
    }

    // Parse contactInfo
    let contactInfo = [];
    if (req.body.contactInfo) {
      try { contactInfo = JSON.parse(req.body.contactInfo); } catch {}
    }

    // Parse fittings
    let fittings = [];
    if (req.body.fittings) {
      try { fittings = JSON.parse(req.body.fittings); } catch {}
    }

    // Build base data
    const baseData = {
      projectId,
      toolType,
      castId: castId || "",
      characterName: characterName || "",
      talentName: talentName || "",
      gender: gender || "",
      isTemporary: isTemporary === true || isTemporary === "true",
      sceneNumber: sceneNumber || "",
      description: description || "",
      link: link || "",
      contactInfo,
      costumeState: costumeState || "",
      continuityNotes: continuityNotes || "",
      accessories: accessories || "",
      hairMakeupState: hairMakeupState || "",
      quickChange: quickChange === true || quickChange === "true",
      changeNotes: changeNotes || "",
      fittings,
      status,
      createdBy: { userId, name: createdByName || "" },
    };

    // Auto-fetch link preview
    if (link && link.startsWith("http")) {
      const { metadata, images } = await fetchLinkPreviewData(link);
      if (metadata) {
        baseData.linkPreview = metadata;
      }
      for (const imgUrl of images) {
        const downloaded = await downloadImage(imgUrl);
        if (downloaded) {
          const att = await buildAttachmentFromDownload(downloaded, projectId, "wardrobe");
          attachments.push(att);
        }
      }
    }

    // Link preview from frontend (override if provided)
    if (req.body.linkPreview) {
      try { baseData.linkPreview = JSON.parse(req.body.linkPreview); } catch {}
    }

    baseData.attachments = attachments;

    // Create one document per episode (same pattern as casting)
    const docs = episodeList.map((ep) => ({ ...baseData, episode: ep }));
    const inserted = await Wardrobe.insertMany(docs);

    // Increment FolderBadge for each
    for (const w of inserted) {
      const folderKeys = buildAllFolderKeys(status, w.episode, w.characterName, w.sceneNumber);
      await incrementFolderBadges(projectId, folderKeys);
    }

    // Activity log for each
    const activityLogs = inserted.map((w) => ({
      wardrobeId: w._id,
      projectId, userId,
      userName: createdByName || "",
      action: "created",
      details: `Costume created: ${w.characterName || ""} / ${w.talentName || ""} in ${status}${w.episode ? ` (Ep ${w.episode})` : ""}`,
    }));
    await WardrobeActivityLog.insertMany(activityLogs);

    // Socket broadcast
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("wardrobe_created", { wardrobe: inserted[0], status, count: inserted.length });

    return sendSuccess(res, inserted.length === 1 ? inserted[0] : inserted,
      `${inserted.length} costume(s) created successfully`, 201);
  } catch (error) {
    console.error("createWardrobe error:", error.message, error.stack);
    return sendError(res, 500, error.message || "Failed to create wardrobe");
  }
};

/**
 * PUT /api/v2/wardrobe/:id
 */
const updateWardrobe = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid wardrobe ID");

    const userId = req.moduleData.user_id;
    const wardrobe = await Wardrobe.findById(id);
    if (!wardrobe) return sendError(res, 404, "Wardrobe not found");

    const {
      castId, characterName, talentName, gender, isTemporary,
      sceneNumber, description, link,
      costumeState, continuityNotes, accessories, hairMakeupState, quickChange, changeNotes,
      updatedByName,
    } = req.body;

    // Parse episodes (same as create)
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

    const updates = {};
    if (castId !== undefined) updates.castId = castId;
    if (characterName !== undefined) updates.characterName = characterName;
    if (talentName !== undefined) updates.talentName = talentName;
    if (gender !== undefined) updates.gender = gender;
    if (isTemporary !== undefined) updates.isTemporary = isTemporary === true || isTemporary === "true";
    if (episodeList.length > 0) updates.episode = episodeList[0];
    if (sceneNumber !== undefined) updates.sceneNumber = sceneNumber;
    if (description !== undefined) updates.description = description;
    if (link !== undefined) updates.link = link;
    if (costumeState !== undefined) updates.costumeState = costumeState;
    if (continuityNotes !== undefined) updates.continuityNotes = continuityNotes;
    if (accessories !== undefined) updates.accessories = accessories;
    if (hairMakeupState !== undefined) updates.hairMakeupState = hairMakeupState;
    if (quickChange !== undefined) updates.quickChange = quickChange === true || quickChange === "true";
    if (changeNotes !== undefined) updates.changeNotes = changeNotes;
    updates.edited = true;

    // Parse contactInfo
    if (req.body.contactInfo !== undefined) {
      try { updates.contactInfo = JSON.parse(req.body.contactInfo); } catch {}
    }

    // Parse fittings
    if (req.body.fittings !== undefined) {
      try { updates.fittings = JSON.parse(req.body.fittings); } catch {}
    }

    // Link preview
    if (req.body.linkPreview) {
      try { updates.linkPreview = JSON.parse(req.body.linkPreview); } catch {}
    }

    // Merge attachments — existing + new uploads
    let existingAttachments = [];
    if (req.body.existingAttachments) {
      try { existingAttachments = JSON.parse(req.body.existingAttachments); } catch {}
    }
    const newAttachments = [];
    if (req.files && req.files.length > 0) {
      const projectId = req.moduleData.project_id;
      for (const f of req.files) {
        const att = await buildAttachment(f, projectId, "wardrobe");
        newAttachments.push(att);
      }
    }
    updates.attachments = [...existingAttachments, ...newAttachments];

    const updated = await Wardrobe.findByIdAndUpdate(id, updates, { new: true });

    const projectId = req.moduleData.project_id;
    const folderKeys = buildAllFolderKeys(
      updated.status, updated.episode, updated.characterName, updated.sceneNumber
    );
    await incrementFolderBadges(projectId, folderKeys);

    // Create additional documents for extra episodes (2nd, 3rd, etc.)
    const additionalEpisodes = episodeList.slice(1);
    if (additionalEpisodes.length > 0) {
      const baseData = updated.toObject();
      delete baseData._id;
      delete baseData.__v;
      delete baseData.createdAt;
      delete baseData.updatedAt;

      for (const ep of additionalEpisodes) {
        const newDoc = { ...baseData, episode: ep };
        const inserted = await Wardrobe.create(newDoc);
        const epFolderKeys = buildAllFolderKeys(inserted.status, ep, inserted.characterName, inserted.sceneNumber);
        await incrementFolderBadges(projectId, epFolderKeys);
      }
    }

    const totalCount = 1 + additionalEpisodes.length;

    await WardrobeActivityLog.create({
      wardrobeId: id,
      projectId, userId,
      userName: updatedByName || "",
      action: "edited",
      details: totalCount > 1
        ? `Costume "${updated.characterName}" updated + ${additionalEpisodes.length} episode(s) added`
        : `Costume "${updated.characterName} / ${updated.talentName}" updated`,
    });

    return sendSuccess(res, updated, totalCount > 1
      ? `Costume updated + ${additionalEpisodes.length} episode(s) created`
      : "Costume updated successfully");
  } catch (error) {
    console.error("updateWardrobe error:", error.message);
    return sendError(res, 500, "Failed to update wardrobe");
  }
};

// ────────────────────── Move ──────────────────────

/**
 * PUT /api/v2/wardrobe/move/items
 * Copy-based move with sourceId duplicate detection.
 */
const moveWardrobes = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { wardrobeIds, targetStatus, userName, commonDetails, perItemDetails, fillDetails, toolType = "main" } = req.body;

    if (!wardrobeIds || !Array.isArray(wardrobeIds) || wardrobeIds.length === 0) {
      return sendError(res, 400, "wardrobeIds array is required");
    }

    const units = await WardrobeUnit.find({ projectId }, { identifier: 1 }).lean();
    const validStatuses = units.length > 0 ? units.map((u) => u.identifier) : ["select", "shortlist", "final"];
    if (!validStatuses.includes(targetStatus)) {
      return sendError(res, 400, "Invalid target status");
    }

    const wardrobes = await Wardrobe.find({ _id: { $in: wardrobeIds }, projectId, toolType, deleted: 0 });
    if (wardrobes.length === 0) return sendError(res, 404, "No wardrobes found");

    // Temporary cast validation for finalized
    if (targetStatus === "final") {
      const temporaryItems = wardrobes.filter((w) => w.isTemporary === true);
      if (temporaryItems.length > 0) {
        return sendError(res, 400, "Cannot move to Finalized with temporary cast. Please assign finalized cast first.");
      }
    }

    // Build shared details
    const details = commonDetails || fillDetails || null;
    const sharedFields = {};
    if (details) {
      const fieldNames = [
        "characterName", "talentName", "gender",
        "sceneNumber", "description",
      ];
      fieldNames.forEach((f) => { if (details[f] !== undefined) sharedFields[f] = details[f]; });
      if (details.episode !== undefined) sharedFields.episode = details.episode;
      if (details.contactInfo) sharedFields.contactInfo = details.contactInfo;
    }

    // Per-item overrides
    const perItemMap = {};
    if (perItemDetails && Array.isArray(perItemDetails)) {
      perItemDetails.forEach((item) => {
        if (!item._id) return;
        const overrides = {};
        if (item.episode !== undefined) overrides.episode = item.episode;
        if (item.characterName !== undefined) overrides.characterName = item.characterName;
        if (item.sceneNumber !== undefined) overrides.sceneNumber = item.sceneNumber;
        if (Object.keys(overrides).length > 0) perItemMap[String(item._id)] = overrides;
      });
    }

    // ── Check for duplicates (two methods) ──
    // Method 1: sourceId tracking (same doc moved before)
    const sourceIds = wardrobes.map((w) => w.sourceId || w._id);
    const existingBySource = await Wardrobe.find({
      projectId, toolType, status: targetStatus, sourceId: { $in: sourceIds }, deleted: 0,
    }).lean();
    const sourceSet = new Set(existingBySource.map((w) => String(w.sourceId)));

    // Method 2: same characterName + sceneNumber + episode already exists in target
    const existingByData = await Wardrobe.find({
      projectId, toolType, status: targetStatus, deleted: 0,
    }, { characterName: 1, sceneNumber: 1, episode: 1 }).lean();
    const dataSet = new Set(existingByData.map((w) =>
      `${(w.characterName || '').toLowerCase()}|${(w.sceneNumber || '').toLowerCase()}|${(w.episode || '').toLowerCase()}`
    ));

    const duplicates = [];
    const toCopy = [];

    for (const w of wardrobes) {
      const srcId = String(w.sourceId || w._id);
      const dataKey = `${(w.characterName || '').toLowerCase()}|${(w.sceneNumber || '').toLowerCase()}|${(w.episode || '').toLowerCase()}`;

      if (sourceSet.has(srcId) || dataSet.has(dataKey)) {
        duplicates.push(`${w.characterName} / Sc ${w.sceneNumber || '-'} (Ep ${w.episode || '-'})`);
      } else {
        toCopy.push(w);
      }
    }

    if (toCopy.length === 0) {
      const names = duplicates.slice(0, 5).join(", ");
      return sendError(res, 409,
        `Already exists in ${targetStatus}: ${names}${duplicates.length > 5 ? ` and ${duplicates.length - 5} more` : ""}`
      );
    }

    // Create copies
    const newDocs = toCopy.map((w) => {
      const wObj = w.toObject();
      const wId = String(w._id);
      const perItem = perItemMap[wId] || {};

      delete wObj._id;
      delete wObj.__v;
      delete wObj.createdAt;
      delete wObj.updatedAt;
      delete wObj.lastViewedBy;
      delete wObj.discussion;

      return {
        ...wObj,
        ...sharedFields,
        ...perItem,
        toolType,
        status: targetStatus,
        sourceId: w.sourceId || w._id,
        lastViewedBy: {},
      };
    });

    const inserted = await Wardrobe.insertMany(newDocs);

    // Log activity
    const activityLogs = inserted.map((newW, idx) => ({
      wardrobeId: newW._id,
      projectId, userId,
      userName: userName || "",
      action: "moved",
      details: `Copied to "${targetStatus}" from "${toCopy[idx].status}"`,
      previousValue: toCopy[idx].status,
      newValue: targetStatus,
    }));
    await WardrobeActivityLog.insertMany(activityLogs);

    // Increment badges
    for (const newW of inserted) {
      const keys = buildAllFolderKeys(targetStatus, newW.episode, newW.characterName, newW.sceneNumber);
      await incrementFolderBadges(projectId, keys);
    }

    // Socket broadcast
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("wardrobes_moved", {
      wardrobeIds: inserted.map((w) => w._id),
      toStatus: targetStatus,
      count: inserted.length,
    });

    let msg = `${inserted.length} wardrobe(s) copied to ${targetStatus}`;
    if (duplicates.length > 0) {
      msg += `. ${duplicates.length} skipped (already in ${targetStatus}).`;
    }
    return sendSuccess(res, {
      movedCount: inserted.length,
      duplicateCount: duplicates.length,
      duplicateNames: duplicates.slice(0, 10),
    }, msg);
  } catch (error) {
    console.error("moveWardrobes error:", error.message);
    return sendError(res, 500, "Failed to move wardrobes");
  }
};

/**
 * PUT /api/v2/wardrobe/move/folder
 */
const moveWardrobeFolder = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { folderField, folderValue, currentStatus, targetStatus, episode, userName,
            commonDetails, perItemDetails, fillDetails, toolType = "main" } = req.body;

    if (folderValue === undefined || folderValue === null) {
      return sendError(res, 400, "Folder value is required");
    }

    const units = await WardrobeUnit.find({ projectId }, { identifier: 1 }).lean();
    const validStatuses = units.length > 0 ? units.map((u) => u.identifier) : ["select", "shortlist", "final"];
    if (!validStatuses.includes(targetStatus)) {
      return sendError(res, 400, "Invalid target status");
    }

    const query = { projectId, toolType, status: currentStatus, deleted: 0 };
    const dbField = folderField || "characterName";
    query[dbField] = folderValue;
    if (episode) query.episode = episode;

    const wardrobes = await Wardrobe.find(query);
    if (wardrobes.length === 0) return sendError(res, 404, "No wardrobes found in folder");

    // Temporary cast validation for finalized
    if (targetStatus === "final") {
      const temporaryItems = wardrobes.filter((w) => w.isTemporary === true);
      if (temporaryItems.length > 0) {
        return sendError(res, 400, "Cannot move to Finalized with temporary cast. Please assign finalized cast first.");
      }
    }

    // Build shared update
    const details = commonDetails || fillDetails || null;
    const sharedUpdate = { status: targetStatus };
    if (details) {
      const fields = [
        "characterName", "talentName", "gender",
        "sceneNumber", "description",
      ];
      fields.forEach((f) => { if (details[f] !== undefined) sharedUpdate[f] = details[f]; });
      if (details.episode !== undefined) sharedUpdate.episode = details.episode;
      if (details.contactInfo) sharedUpdate.contactInfo = details.contactInfo;
    }

    // Per-item overrides
    const perItemMap = {};
    if (perItemDetails && Array.isArray(perItemDetails)) {
      perItemDetails.forEach((item) => {
        if (!item._id) return;
        const itemUpdate = {};
        if (item.episode !== undefined) itemUpdate.episode = item.episode;
        if (item.characterName !== undefined) itemUpdate.characterName = item.characterName;
        if (item.sceneNumber !== undefined) itemUpdate.sceneNumber = item.sceneNumber;
        if (Object.keys(itemUpdate).length > 0) perItemMap[String(item._id)] = itemUpdate;
      });
    }

    // ── Check for duplicates (two methods) ──
    const sourceIds = wardrobes.map((w) => w.sourceId || w._id);
    const existingBySource = await Wardrobe.find({
      projectId, toolType, status: targetStatus, sourceId: { $in: sourceIds }, deleted: 0,
    }).lean();
    const sourceSet = new Set(existingBySource.map((w) => String(w.sourceId)));

    const existingByData = await Wardrobe.find({
      projectId, toolType, status: targetStatus, deleted: 0,
    }, { characterName: 1, sceneNumber: 1, episode: 1 }).lean();
    const dataSet = new Set(existingByData.map((w) =>
      `${(w.characterName || '').toLowerCase()}|${(w.sceneNumber || '').toLowerCase()}|${(w.episode || '').toLowerCase()}`
    ));

    const duplicates = [];
    const toCopy = [];
    for (const w of wardrobes) {
      const srcId = String(w.sourceId || w._id);
      const dataKey = `${(w.characterName || '').toLowerCase()}|${(w.sceneNumber || '').toLowerCase()}|${(w.episode || '').toLowerCase()}`;

      if (sourceSet.has(srcId) || dataSet.has(dataKey)) {
        duplicates.push(`${w.characterName} / Sc ${w.sceneNumber || '-'} (Ep ${w.episode || '-'})`);
      } else {
        toCopy.push(w);
      }
    }

    if (toCopy.length === 0) {
      return sendError(res, 409, `All items in this folder already exist in ${targetStatus}.`);
    }

    // Create copies
    const newDocs = toCopy.map((w) => {
      const wObj = w.toObject();
      const perItem = perItemMap[String(w._id)] || {};
      delete wObj._id;
      delete wObj.__v;
      delete wObj.createdAt;
      delete wObj.updatedAt;
      delete wObj.lastViewedBy;
      delete wObj.discussion;

      return {
        ...wObj,
        ...sharedUpdate,
        ...perItem,
        toolType,
        status: targetStatus,
        sourceId: w.sourceId || w._id,
        lastViewedBy: {},
      };
    });

    const inserted = await Wardrobe.insertMany(newDocs);

    await WardrobeActivityLog.create({
      projectId, userId,
      userName: userName || "",
      action: "moved",
      details: `Folder "${folderValue}" copied from "${currentStatus}" to "${targetStatus}" (${inserted.length} items)`,
      previousValue: currentStatus, newValue: targetStatus,
    });

    for (const newW of inserted) {
      const keys = buildAllFolderKeys(targetStatus, newW.episode, newW.characterName, newW.sceneNumber);
      await incrementFolderBadges(projectId, keys);
    }

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("wardrobe_folder_moved", { folderValue, toStatus: targetStatus });

    let msg = `${inserted.length} item(s) from folder copied to ${targetStatus}`;
    if (duplicates.length > 0) msg += `. ${duplicates.length} skipped (already there).`;
    return sendSuccess(res, { movedCount: inserted.length, duplicateCount: duplicates.length }, msg);
  } catch (error) {
    console.error("moveWardrobeFolder error:", error.message);
    return sendError(res, 500, "Failed to move wardrobe folder");
  }
};

// ────────────────────── Delete / Restore ──────────────────────

const deleteWardrobe = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid wardrobe ID");

    const wardrobe = await Wardrobe.findById(id);
    if (!wardrobe) return sendError(res, 404, "Wardrobe not found");

    await Wardrobe.findByIdAndUpdate(id, { deleted: Date.now() });

    await WardrobeActivityLog.create({
      wardrobeId: id, projectId: req.moduleData.project_id,
      userId: req.moduleData.user_id,
      action: "deleted",
      details: `Wardrobe "${wardrobe.characterName} / ${wardrobe.talentName}" deleted`,
    });

    const io = req.app.get("io");
    if (io) io.to(req.moduleData.project_id).emit("wardrobe_deleted", { wardrobeId: id, status: wardrobe.status });

    return sendSuccess(res, null, "Wardrobe deleted successfully");
  } catch (error) {
    console.error("deleteWardrobe error:", error.message);
    return sendError(res, 500, "Failed to delete wardrobe");
  }
};

const deleteWardrobeFolder = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { folderField, folderValue, status, episode, toolType = "main" } = req.body;

    if (folderValue === undefined || folderValue === null) return sendError(res, 400, "Folder value is required");

    const query = { projectId, toolType, deleted: 0 };
    const dbField = folderField || "characterName";
    query[dbField] = folderValue;
    if (status) query.status = status;
    if (episode) query.episode = episode;

    const result = await Wardrobe.updateMany(query, { $set: { deleted: Date.now() } });

    await WardrobeActivityLog.create({
      projectId, userId: req.moduleData.user_id,
      action: "deleted",
      details: `Wardrobe folder "${folderValue}" deleted (${result.modifiedCount} items)`,
    });

    return sendSuccess(res, { deletedCount: result.modifiedCount }, "Wardrobe folder deleted");
  } catch (error) {
    console.error("deleteWardrobeFolder error:", error.message);
    return sendError(res, 500, "Failed to delete wardrobe folder");
  }
};

const restoreWardrobe = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid wardrobe ID");

    const wardrobe = await Wardrobe.findById(id);
    if (!wardrobe) return sendError(res, 404, "Wardrobe not found");
    if (wardrobe.deleted === 0) return sendError(res, 400, "Not deleted");

    await Wardrobe.findByIdAndUpdate(id, { deleted: 0 });

    await WardrobeActivityLog.create({
      wardrobeId: id, projectId: req.moduleData.project_id,
      userId: req.moduleData.user_id,
      action: "restored",
      details: `Wardrobe restored`,
    });

    return sendSuccess(res, null, "Wardrobe restored");
  } catch (error) {
    console.error("restoreWardrobe error:", error.message);
    return sendError(res, 500, "Failed to restore wardrobe");
  }
};

const getDeletedWardrobes = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { toolType = "main" } = req.query;
    const wardrobes = await Wardrobe.find({ projectId, toolType, deleted: { $gt: 0 } }).sort({ deleted: -1 }).limit(100);
    return sendSuccess(res, wardrobes);
  } catch (error) {
    return sendError(res, 500, "Failed to fetch deleted wardrobes");
  }
};

// ────────────────────── Stats / Badges ──────────────────────

const getWardrobeStats = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { toolType = "main" } = req.query;

    const units = await WardrobeUnit.find({ projectId }, { identifier: 1 }).lean();
    const tabKeys = units.length > 0
      ? units.map((u) => u.identifier)
      : ["select", "shortlist", "final"];

    const allWardrobes = await Wardrobe.find(
      { projectId, toolType, deleted: 0 },
      { status: 1 }
    ).lean();

    const stats = { total: 0 };
    tabKeys.forEach((k) => { stats[k] = 0; });
    allWardrobes.forEach((w) => {
      stats[w.status] = (stats[w.status] || 0) + 1;
      stats.total += 1;
    });

    const tabBadgeDocs = await WardrobeFolderBadge.find({ projectId, folderKey: { $in: tabKeys } }).lean();
    const badges = {};
    tabKeys.forEach((k) => { badges[k] = 0; });
    tabBadgeDocs.forEach((bd) => {
      const viewed = bd.viewedBy?.[userId] || 0;
      badges[bd.folderKey] = Math.max(0, bd.activityCount - viewed);
    });

    const unitChatCounts = await WardrobeUnitChat.aggregate([
      { $match: { projectId } },
      { $group: { _id: "$unit", count: { $sum: 1 } } },
    ]);
    const unitChats = {};
    unitChatCounts.forEach((u) => { unitChats[u._id] = u.count; });

    return sendSuccess(res, { stats, badges, unitChats });
  } catch (error) {
    console.error("getWardrobeStats error:", error.message);
    return sendError(res, 500, "Failed to fetch wardrobe stats");
  }
};

// ────────────────────── Unit Chat ──────────────────────

const getWardrobeUnitChats = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { unit } = req.query;
    if (!["select", "shortlist", "final"].includes(unit)) {
      return sendError(res, 400, "Invalid unit");
    }
    const messages = await WardrobeUnitChat.find({ projectId, unit }).sort({ createdAt: 1 });
    return sendSuccess(res, messages);
  } catch (error) {
    return sendError(res, 500, "Failed to fetch wardrobe unit chats");
  }
};

const createWardrobeUnitChat = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { unit, text, userName } = req.body;

    if (!["select", "shortlist", "final"].includes(unit)) {
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

    const message = await WardrobeUnitChat.create(chatData);

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("wardrobe_unit_chat_message", { unit, message });

    return sendSuccess(res, message, "Message sent", 201);
  } catch (error) {
    return sendError(res, 500, "Failed to send wardrobe chat message");
  }
};

// ────────────────────── Comments ──────────────────────

const getWardrobeComments = async (req, res) => {
  try {
    const { wardrobeId } = req.params;
    if (!isValidObjectId(wardrobeId)) return sendError(res, 400, "Invalid wardrobe ID");
    const comments = await WardrobeComment.find({ wardrobeId }).sort({ createdAt: 1 });
    return sendSuccess(res, comments);
  } catch (error) {
    return sendError(res, 500, "Failed to fetch wardrobe comments");
  }
};

const createWardrobeComment = async (req, res) => {
  try {
    const { wardrobeId } = req.params;
    if (!isValidObjectId(wardrobeId)) return sendError(res, 400, "Invalid wardrobe ID");

    const userId = req.moduleData.user_id;
    const projectId = req.moduleData.project_id;
    const { text, userName, contextEpisode, contextCharacterName, replyToId, replyToUserName, replyToText } = req.body;

    if (!text || !text.trim()) return sendError(res, 400, "Comment text is required");

    const commentData = {
      wardrobeId, projectId, userId,
      userName: userName || "",
      text: text.trim(),
      context: {
        episode: contextEpisode || "",
        characterName: contextCharacterName || "",
      },
    };

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

    const comment = await WardrobeComment.create(commentData);

    const wardrobe = await Wardrobe.findByIdAndUpdate(wardrobeId, { discussion: true }, { new: true });

    const folderKeys = buildAllFolderKeys(
      wardrobe.status, wardrobe.episode, wardrobe.characterName, wardrobe.sceneNumber
    );
    await incrementFolderBadges(projectId, folderKeys);

    await WardrobeActivityLog.create({
      wardrobeId, projectId, userId,
      userName: userName || "",
      action: "commented",
      details: text.trim().substring(0, 100),
    });

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("wardrobe_comment", { wardrobeId, comment });

    return sendSuccess(res, comment, "Comment added", 201);
  } catch (error) {
    return sendError(res, 500, "Failed to add wardrobe comment");
  }
};

const updateWardrobeComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid comment ID");
    const { text } = req.body;
    if (!text || !text.trim()) return sendError(res, 400, "Comment text is required");
    const updated = await WardrobeComment.findByIdAndUpdate(id, { text: text.trim() }, { new: true });
    if (!updated) return sendError(res, 404, "Comment not found");
    return sendSuccess(res, updated, "Comment updated");
  } catch (error) {
    return sendError(res, 500, "Failed to update wardrobe comment");
  }
};

const deleteWardrobeComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid comment ID");
    await WardrobeComment.findByIdAndDelete(id);
    return sendSuccess(res, null, "Comment deleted");
  } catch (error) {
    return sendError(res, 500, "Failed to delete wardrobe comment");
  }
};

// ────────────────────── Share ──────────────────────

const shareWardrobes = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { wardrobeIds, userIds, userName, message } = req.body;

    if (!wardrobeIds?.length) return sendError(res, 400, "wardrobeIds required");
    if (!userIds?.length) return sendError(res, 400, "userIds required");

    const activityLogs = wardrobeIds.map((wId) => ({
      wardrobeId: wId, projectId, userId,
      userName: userName || "",
      action: "shared",
      details: `Shared with ${userIds.length} user(s)${message ? `: ${message}` : ""}`,
    }));
    await WardrobeActivityLog.insertMany(activityLogs);

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("wardrobes_shared", { wardrobeIds, sharedBy: { userId, name: userName }, sharedWith: userIds, message });

    return sendSuccess(res, { sharedCount: wardrobeIds.length, recipientCount: userIds.length }, "Shared");
  } catch (error) {
    return sendError(res, 500, "Failed to share wardrobes");
  }
};

// ────────────────────── Units (Tabs) ──────────────────────

const DEFAULT_WARDROBE_UNITS = [
  { identifier: "select", label: "Selects", order: 0 },
  { identifier: "shortlist", label: "Shortlisted", order: 1 },
  { identifier: "final", label: "Finalized", order: 2 },
];

const getWardrobeUnits = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    let units = await WardrobeUnit.find({ projectId }).sort({ order: 1 }).lean();

    if (units.length === 0) {
      const docs = DEFAULT_WARDROBE_UNITS.map((u) => ({ ...u, projectId }));
      units = await WardrobeUnit.insertMany(docs);
      units = units.map((u) => u.toObject ? u.toObject() : u);
    }

    return sendSuccess(res, units);
  } catch (error) {
    console.error("getWardrobeUnits error:", error.message);
    return sendError(res, 500, "Failed to fetch wardrobe units");
  }
};

const getWardrobeBadges = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { status = "select" } = req.query;

    const badgeDocs = await WardrobeFolderBadge.find({
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
    console.error("getWardrobeBadges error:", error.message);
    return sendError(res, 500, "Failed to fetch wardrobe badges");
  }
};

const markWardrobeViewed = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { folderKey } = req.body;
    if (!folderKey) return sendError(res, 400, "folderKey is required");
    await markFolderViewed(projectId, folderKey, userId);
    return sendSuccess(res, { marked: folderKey });
  } catch (error) {
    console.error("markWardrobeViewed error:", error.message);
    return sendError(res, 500, "Failed to mark viewed");
  }
};

// ────────────────────── Sync API ──────────────────────

const syncWardrobes = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { status = "select", toolType = "main", since, direction = "prev", limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();
    const query = { projectId, toolType, status };
    if (since) query.updatedAt = { $gt: new Date(since) };
    if (direction !== "next") query.deleted = 0;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = Wardrobe.find(query).sort({ updatedAt: 1 });
    if (parsedLimit > 0) q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    const wardrobes = await q;
    const total = await Wardrobe.countDocuments(query);

    return sendSuccess(res, { wardrobes, total, page: parsedPage, limit: parsedLimit, syncTimestamp });
  } catch (error) {
    console.error("syncWardrobes error:", error.message);
    return sendError(res, 500, "Failed to sync wardrobes");
  }
};

const syncWardrobeComments = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { status = "select", toolType = "main", since, direction = "prev", limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();
    const locQuery = { projectId, toolType, status };
    if (direction !== "next") locQuery.deleted = 0;
    const wardrobeIds = await Wardrobe.find(locQuery, { _id: 1 }).lean();
    const ids = wardrobeIds.map((w) => w._id);

    const commentQuery = { wardrobeId: { $in: ids } };
    if (since) commentQuery.updatedAt = { $gt: new Date(since) };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = WardrobeComment.find(commentQuery).sort({ updatedAt: 1 });
    if (parsedLimit > 0) q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    const comments = await q;
    const total = await WardrobeComment.countDocuments(commentQuery);

    return sendSuccess(res, { comments, total, page: parsedPage, limit: parsedLimit, syncTimestamp });
  } catch (error) {
    console.error("syncWardrobeComments error:", error.message);
    return sendError(res, 500, "Failed to sync wardrobe comments");
  }
};

const syncWardrobeActivity = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { since, limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();
    const query = { projectId };
    if (since) query.createdAt = { $gt: new Date(since) };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = WardrobeActivityLog.find(query).sort({ createdAt: 1 });
    if (parsedLimit > 0) q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    const activities = await q;
    const total = await WardrobeActivityLog.countDocuments(query);

    return sendSuccess(res, { activities, total, page: parsedPage, limit: parsedLimit, syncTimestamp });
  } catch (error) {
    console.error("syncWardrobeActivity error:", error.message);
    return sendError(res, 500, "Failed to sync wardrobe activity");
  }
};

const syncWardrobeUnitChats = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { unit = "select", since, limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();
    const query = { projectId, unit };
    if (since) query.createdAt = { $gt: new Date(since) };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = WardrobeUnitChat.find(query).sort({ createdAt: 1 });
    if (parsedLimit > 0) q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    const chats = await q;
    const total = await WardrobeUnitChat.countDocuments(query);

    return sendSuccess(res, { chats, total, page: parsedPage, limit: parsedLimit, syncTimestamp });
  } catch (error) {
    console.error("syncWardrobeUnitChats error:", error.message);
    return sendError(res, 500, "Failed to sync wardrobe unit chats");
  }
};

// ────────────────────── Suggest (Autocomplete) ──────────────────────

/**
 * GET /api/v2/wardrobe/suggest?q=pol&field=characterName
 * Returns distinct values + latest full wardrobe doc for each match.
 * Searches across ALL tool types so characters can be reused.
 */
const suggestWardrobes = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { q, field = "characterName" } = req.query;

    if (!q || q.length < 1) return sendSuccess(res, []);

    const allowedFields = ["characterName", "talentName"];
    const searchField = allowedFields.includes(field) ? field : "characterName";

    // Search across ALL tool types (no toolType filter)
    const pipeline = [
      {
        $match: {
          projectId,
          deleted: 0,
          [searchField]: { $regex: q, $options: "i" },
        },
      },
      { $sort: { updatedAt: -1 } },
      {
        $group: {
          _id: `$${searchField}`,
          latestDoc: { $first: "$$ROOT" },
        },
      },
      { $limit: 10 },
      {
        $project: {
          _id: 0,
          value: "$_id",
          wardrobe: {
            characterName: "$latestDoc.characterName",
            talentName: "$latestDoc.talentName",
            gender: "$latestDoc.gender",
            castId: "$latestDoc.castId",
            episode: "$latestDoc.episode",
            sceneNumber: "$latestDoc.sceneNumber",
            description: "$latestDoc.description",
            contactInfo: "$latestDoc.contactInfo",
            link: "$latestDoc.link",
            costumeState: "$latestDoc.costumeState",
            continuityNotes: "$latestDoc.continuityNotes",
            accessories: "$latestDoc.accessories",
            hairMakeupState: "$latestDoc.hairMakeupState",
          },
        },
      },
    ];

    const results = await Wardrobe.aggregate(pipeline);
    return sendSuccess(res, results);
  } catch (error) {
    console.error("suggestWardrobes error:", error.message);
    return sendError(res, 500, "Failed to fetch suggestions");
  }
};

// ────────────────────── Choose Cast (from Casting backend) ──────────────────────

/**
 * GET /api/v2/wardrobe/choose-cast?q=searchTerm
 * Fetches finalized castings from casting-backend for wardrobe assignment.
 */
const chooseCast = async (req, res) => {
  try {
    const { q = "" } = req.query;
    const moduledata = req.headers["moduledata"];

    // Fetch from casting backend
    const castingUrl = `http://localhost:5004/api/v2/casting/suggest?q=${encodeURIComponent(q)}&field=characterName`;
    const response = await fetch(castingUrl, {
      headers: { moduledata },
    });
    const data = await response.json();
    return sendSuccess(res, data.data || []);
  } catch (error) {
    console.error("chooseCast error:", error.message);
    return sendError(res, 500, "Failed to fetch cast");
  }
};

// ────────────────────── Measurements ──────────────────────

/**
 * GET /api/v2/wardrobe/measurements?castId=xxx
 */
const getMeasurements = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { castId } = req.query;

    if (!castId) return sendError(res, 400, "castId is required");

    const measurements = await TalentMeasurements.findOne({ projectId, castId }).lean();
    return sendSuccess(res, measurements);
  } catch (error) {
    console.error("getMeasurements error:", error.message);
    return sendError(res, 500, "Failed to fetch measurements");
  }
};

/**
 * POST /api/v2/wardrobe/measurements
 */
const saveMeasurements = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const {
      castId, talentName, characterName,
      height, weight, chest, waist, hips, inseam, outseam,
      neck, sleeveLength, shoulderWidth, shoeSize, hatSize,
      dressSize, gloveSize, notes, userName,
    } = req.body;

    if (!castId) return sendError(res, 400, "castId is required");

    const measurementData = {
      projectId,
      castId,
      talentName: talentName || "",
      characterName: characterName || "",
      height: height || "",
      weight: weight || "",
      chest: chest || "",
      waist: waist || "",
      hips: hips || "",
      inseam: inseam || "",
      outseam: outseam || "",
      neck: neck || "",
      sleeveLength: sleeveLength || "",
      shoulderWidth: shoulderWidth || "",
      shoeSize: shoeSize || "",
      hatSize: hatSize || "",
      dressSize: dressSize || "",
      gloveSize: gloveSize || "",
      notes: notes || "",
      createdBy: { userId, name: userName || "" },
    };

    const measurements = await TalentMeasurements.findOneAndUpdate(
      { projectId, castId },
      measurementData,
      { new: true, upsert: true }
    );

    return sendSuccess(res, measurements, "Measurements saved");
  } catch (error) {
    console.error("saveMeasurements error:", error.message);
    return sendError(res, 500, "Failed to save measurements");
  }
};

// ────────────────────── Bulk Import ──────────────────────

/**
 * POST /api/v2/wardrobe/bulk-import
 * Accepts either:
 *   - JSON body: { status, toolType, wardrobes: [...] } (no images)
 *   - Multipart: wardrobes (JSON string) + files[] (images matched by _imageIndex)
 */
const bulkImport = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;

    // Parse wardrobes — could be JSON body or stringified in multipart
    let wardrobes;
    let status;
    let toolType;

    if (typeof req.body.wardrobes === 'string') {
      wardrobes = JSON.parse(req.body.wardrobes);
      status = req.body.status || 'select';
      toolType = req.body.toolType || 'main';
    } else {
      wardrobes = req.body.wardrobes;
      status = req.body.status || 'select';
      toolType = req.body.toolType || 'main';
    }

    if (!wardrobes || !Array.isArray(wardrobes) || wardrobes.length === 0) {
      return sendError(res, 400, "No wardrobe data provided");
    }

    // Build image attachments from uploaded files
    const uploadedFiles = req.files || [];
    const imageAttachments = [];
    for (const f of uploadedFiles) {
      const att = await buildAttachment(f, projectId, "wardrobe");
      imageAttachments.push(att);
    }

    const ALLOWED_FIELDS = [
      "characterName", "talentName", "episode", "gender", "sceneNumber",
      "description", "costumeState", "continuityNotes", "accessories",
      "hairMakeupState", "castId",
    ];

    const docs = wardrobes
      .filter((row) => row.characterName || row.talentName)
      .map((row) => {
        const doc = { projectId, toolType, status, createdBy: { userId, name: "" } };
        ALLOWED_FIELDS.forEach((f) => {
          if (row[f] !== undefined && row[f] !== "") {
            doc[f] = row[f];
          }
        });

        // Attach matched images
        const startIdx = row._imageStartIndex !== undefined && row._imageStartIndex !== null
          ? Number(row._imageStartIndex) : -1;
        const count = row._imageCount !== undefined ? Number(row._imageCount) : 0;
        if (startIdx >= 0 && count > 0 && startIdx < imageAttachments.length) {
          doc.attachments = imageAttachments.slice(startIdx, startIdx + count);
        }

        return doc;
      });

    if (docs.length === 0) return sendError(res, 400, "No valid rows found");

    const inserted = await Wardrobe.insertMany(docs);

    // Increment badges
    for (const wardrobe of inserted) {
      const folderKeys = buildAllFolderKeys(status, wardrobe.episode, wardrobe.characterName, wardrobe.sceneNumber);
      await incrementFolderBadges(projectId, folderKeys);
    }

    // Activity log
    const activityLogs = inserted.map((wardrobe) => ({
      wardrobeId: wardrobe._id,
      projectId,
      userId,
      userName: "",
      action: "created",
      details: `${wardrobe.characterName || ''} / ${wardrobe.talentName || ''} created via bulk import${wardrobe.attachments?.length > 0 ? ` with ${wardrobe.attachments.length} photo(s)` : ''}`,
    }));
    await WardrobeActivityLog.insertMany(activityLogs);

    // Socket
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("wardrobe_created", { count: inserted.length });

    const imgCount = imageAttachments.length;
    return sendSuccess(res, {
      importedCount: inserted.length,
      imagesAttached: imgCount,
    }, `${inserted.length} wardrobe(s) imported${imgCount > 0 ? ` with ${imgCount} image(s)` : ''}`);
  } catch (error) {
    console.error("bulkImport error:", error.message);
    return sendError(res, 500, error.message || "Failed to import wardrobes");
  }
};

// ────────────────────── Temporary Cast CRUD ──────────────────────

/**
 * GET /api/v2/wardrobe/temp-casts
 */
const getTempCasts = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { q } = req.query;
    const query = { projectId, deleted: 0 };
    if (q) {
      query.$or = [
        { characterName: { $regex: q, $options: "i" } },
        { talentName: { $regex: q, $options: "i" } },
      ];
    }
    const casts = await TemporaryCast.find(query).sort({ createdAt: -1 }).lean();
    return sendSuccess(res, casts);
  } catch (error) {
    console.error("getTempCasts error:", error.message);
    return sendError(res, 500, "Failed to fetch temporary casts");
  }
};

/**
 * POST /api/v2/wardrobe/temp-casts
 */
const createTempCast = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { characterName, talentName, gender, notes } = req.body;

    if (!characterName) return sendError(res, 400, "Character name is required");

    const cast = await TemporaryCast.create({
      projectId,
      characterName,
      talentName: talentName || "",
      gender: gender || "",
      notes: notes || "",
      createdBy: { userId, name: "" },
    });

    return sendSuccess(res, cast, "Temporary cast created", 201);
  } catch (error) {
    console.error("createTempCast error:", error.message);
    return sendError(res, 500, "Failed to create temporary cast");
  }
};

/**
 * DELETE /api/v2/wardrobe/temp-casts/:id
 */
const deleteTempCast = async (req, res) => {
  try {
    const { id } = req.params;
    await TemporaryCast.findByIdAndUpdate(id, { deleted: Date.now() });
    return sendSuccess(res, null, "Temporary cast deleted");
  } catch (error) {
    console.error("deleteTempCast error:", error.message);
    return sendError(res, 500, "Failed to delete temporary cast");
  }
};

module.exports = {
  getWardrobeFolders, getWardrobes, getWardrobeById,
  createWardrobe, updateWardrobe,
  suggestWardrobes,
  moveWardrobes, moveWardrobeFolder,
  deleteWardrobe, deleteWardrobeFolder, restoreWardrobe, getDeletedWardrobes,
  getWardrobeStats,
  getWardrobeUnitChats, createWardrobeUnitChat,
  getWardrobeComments, createWardrobeComment, updateWardrobeComment, deleteWardrobeComment,
  shareWardrobes,
  getWardrobeUnits,
  getWardrobeBadges,
  markWardrobeViewed,
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
};
