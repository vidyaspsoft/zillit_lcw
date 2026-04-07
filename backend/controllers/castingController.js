const Casting = require("../models/casting/Casting");
const CastingComment = require("../models/casting/CastingComment");
const CastingActivityLog = require("../models/casting/CastingActivityLog");
const CastingUnitChat = require("../models/casting/CastingUnitChat");
const CastingFolderBadge = require("../models/casting/CastingFolderBadge");
const CastingUnit = require("../models/casting/CastingUnit");
const { sendSuccess, sendError, isValidObjectId } = require("../utils/helpers");
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
    const filename = `casting-preview-${uuidv4()}${ext}`;
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
 * Build ALL folder keys for a casting (every combination of its dimensions).
 * Includes the bare status key for tab-level badge.
 * Prefixes: ep: (episode), ch: (characterName), tl: (talentName)
 */
const buildAllFolderKeys = (status, episode, characterName, talentName) => {
  const keys = new Set();
  keys.add(status); // tab-level badge

  const parts = [];
  if (episode) parts.push(`ep:${episode}`);
  if (characterName) parts.push(`ch:${characterName}`);
  if (talentName) parts.push(`tl:${talentName}`);

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
  await CastingFolderBadge.bulkWrite(bulkOps);
};

/**
 * Mark a folder as viewed by a user.
 */
const markFolderViewed = async (projectId, folderKey, userId) => {
  const doc = await CastingFolderBadge.findOne({ projectId, folderKey });
  if (doc) {
    doc.viewedBy.set(userId, doc.activityCount);
    await doc.save();
  }
};

// ────────────────────── Folder Navigation (3-level) ──────────────────────

/**
 * GET /api/v2/casting/folders
 * Grouping fields: episode, characterName, talentName
 */
const getCastingFolders = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { status = "select", groupBy = "episode", nextGroupBy, characterName, talentName, episode } = req.query;

    const match = { projectId, status, deleted: 0 };
    if (characterName) match.characterName = characterName;
    if (talentName) match.talentName = talentName;
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
          uniqueTalentNames: { $addToSet: "$talentName" },
          uniqueEpisodes: { $addToSet: "$episode" },
          // Collect castType and jobFrequency for folder card display
          castTypes: { $addToSet: "$castType" },
          jobFrequencies: { $addToSet: "$jobFrequency" },
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
    } else if (nextGroupBy === "talentName") {
      subFolderExpr = countNonEmpty("$uniqueTalentNames");
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
          talentCount: countNonEmpty("$uniqueTalentNames"),
          castTypes: 1,
          jobFrequencies: 1,
        },
      },
      { $sort: { folderName: 1 } }
    );

    const folders = await Casting.aggregate(pipeline);

    // Mark viewed: parent folder
    const parentParts = [];
    if (episode) parentParts.push(`ep:${episode}`);
    if (characterName) parentParts.push(`ch:${characterName}`);
    if (talentName) parentParts.push(`tl:${talentName}`);
    if (parentParts.length > 0) {
      await markFolderViewed(projectId, buildFolderKey(status, parentParts), userId);
    } else {
      await markFolderViewed(projectId, status, userId);
    }

    // Compute badges per folder
    const folderKeys = folders.map((f) => {
      const parts = [...parentParts];
      if (groupBy === "episode") parts.push(`ep:${f.folderName}`);
      else if (groupBy === "characterName") parts.push(`ch:${f.folderName}`);
      else if (groupBy === "talentName") parts.push(`tl:${f.folderName}`);
      return buildFolderKey(status, parts);
    });

    const badgeDocs = await CastingFolderBadge.find({ projectId, folderKey: { $in: folderKeys } }).lean();
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
    console.error("getCastingFolders error:", error.message);
    return sendError(res, 500, "Failed to fetch casting folders");
  }
};

/**
 * GET /api/v2/casting
 */
const getCastings = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { status = "select", characterName, talentName, episode, search, page = 0, limit = 50 } = req.query;

    const query = { projectId, status, deleted: 0 };
    if (characterName) query.characterName = characterName;
    if (talentName) query.talentName = talentName;
    if (episode) query.episode = episode;
    if (search) {
      query.$or = [
        { characterName: { $regex: search, $options: "i" } },
        { talentName: { $regex: search, $options: "i" } },
        { episode: { $regex: search, $options: "i" } },
        { gender: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const parsedLimit = parseInt(limit);
    const skip = parseInt(page) * (parsedLimit || 50);
    let q = Casting.find(query).sort({ createdAt: -1 });
    if (parsedLimit > 0) {
      q = q.skip(skip).limit(parsedLimit);
    }
    const castings = await q;
    const total = await Casting.countDocuments(query);

    return sendSuccess(res, { castings, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (error) {
    console.error("getCastings error:", error.message);
    return sendError(res, 500, "Failed to fetch castings");
  }
};

/**
 * GET /api/v2/casting/:id
 */
const getCastingById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid casting ID");

    const userId = req.moduleData.user_id;
    const projectId = req.moduleData.project_id;
    const casting = await Casting.findById(id);
    if (!casting) return sendError(res, 404, "Casting not found");

    // Mark all folder keys as viewed
    const allKeys = buildAllFolderKeys(
      casting.status, casting.episode, casting.characterName, casting.talentName
    );
    for (const key of allKeys) {
      await markFolderViewed(projectId, key, userId);
    }

    const comments = await CastingComment.find({ castingId: id }).sort({ createdAt: 1 });

    const activityQuery = { action: { $ne: "commented" } };
    if (casting.sourceId) {
      activityQuery.castingId = { $in: [id, String(casting.sourceId)] };
    } else {
      activityQuery.castingId = id;
    }
    const activities = await CastingActivityLog.find(activityQuery).sort({ createdAt: -1 }).limit(50);

    return sendSuccess(res, { casting, comments, activities });
  } catch (error) {
    console.error("getCastingById error:", error.message);
    return sendError(res, 500, "Failed to fetch casting");
  }
};

// ────────────────────── Create ──────────────────────

/**
 * POST /api/v2/casting
 */
const createCasting = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;

    const {
      characterName, talentName, gender, castType,
      characterNumber, jobFrequency, description, link,
      status = "select", createdByName,
    } = req.body;

    // Parse episodes
    let episodeList = [];
    if (req.body.episodes) {
      try {
        episodeList = JSON.parse(req.body.episodes);
      } catch {
        episodeList = req.body.episodes.split(",").map((e) => e.trim()).filter(Boolean);
      }
    }
    if (episodeList.length === 0) episodeList = [""];

    // Validate: need at least characterName or talentName
    if (!characterName && !talentName) {
      return sendError(res, 400, "Character name or talent name is required");
    }

    // Handle file attachments
    const attachments = [];
    if (req.files && req.files.length > 0) {
      req.files.forEach((f) => {
        attachments.push({
          filename: f.filename,
          originalName: f.originalname,
          mimetype: f.mimetype,
          path: f.path,
          size: f.size,
        });
      });
    }

    // Parse contactInfo
    let contactInfo = [];
    if (req.body.contactInfo) {
      try { contactInfo = JSON.parse(req.body.contactInfo); } catch {}
    }

    // Parse availabilityDates
    let availabilityDates = [];
    if (req.body.availabilityDates) {
      try { availabilityDates = JSON.parse(req.body.availabilityDates); } catch {}
    }

    // Build base data
    const baseData = {
      projectId,
      characterName: characterName || "",
      talentName: talentName || "",
      gender: gender || "",
      castType: castType || "",
      characterNumber: characterNumber ? parseInt(characterNumber) : null,
      jobFrequency: jobFrequency || "",
      description: description || "",
      link: link || "",
      contactInfo,
      availabilityDates,
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
        if (downloaded) attachments.push(downloaded);
      }
    }

    // Link preview from frontend (override if provided)
    if (req.body.linkPreview) {
      try { baseData.linkPreview = JSON.parse(req.body.linkPreview); } catch {}
    }

    baseData.attachments = attachments;

    // Create one document per episode
    const docs = episodeList.map((ep) => ({ ...baseData, episode: ep }));
    const inserted = await Casting.insertMany(docs);

    // Increment FolderBadge
    for (const casting of inserted) {
      const folderKeys = buildAllFolderKeys(status, casting.episode, casting.characterName, casting.talentName);
      await incrementFolderBadges(projectId, folderKeys);
    }

    // Activity log
    const activityLogs = inserted.map((casting) => ({
      castingId: casting._id,
      projectId, userId,
      userName: createdByName || "",
      action: "created",
      details: `Casting created: ${casting.characterName || ""} / ${casting.talentName || ""} in ${status}${casting.episode ? ` (Ep ${casting.episode})` : ""}`,
    }));
    await CastingActivityLog.insertMany(activityLogs);

    // Socket broadcast
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("casting_created", { casting: inserted[0], status, count: inserted.length });

    return sendSuccess(res, inserted.length === 1 ? inserted[0] : inserted,
      `${inserted.length} casting(s) created successfully`, 201);
  } catch (error) {
    console.error("createCasting error:", error.message, error.stack);
    return sendError(res, 500, error.message || "Failed to create casting");
  }
};

/**
 * PUT /api/v2/casting/:id
 */
const updateCasting = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid casting ID");

    const userId = req.moduleData.user_id;
    const casting = await Casting.findById(id);
    if (!casting) return sendError(res, 404, "Casting not found");

    const {
      characterName, talentName, gender, castType,
      characterNumber, jobFrequency, description, link,
      updatedByName,
    } = req.body;

    const updates = {};
    if (characterName !== undefined) updates.characterName = characterName;
    if (talentName !== undefined) updates.talentName = talentName;
    if (gender !== undefined) updates.gender = gender;
    if (castType !== undefined) updates.castType = castType;
    if (characterNumber !== undefined) updates.characterNumber = characterNumber ? parseInt(characterNumber) : null;
    if (jobFrequency !== undefined) updates.jobFrequency = jobFrequency;
    if (description !== undefined) updates.description = description;
    if (link !== undefined) updates.link = link;
    updates.edited = true;

    // Parse contactInfo
    if (req.body.contactInfo !== undefined) {
      try { updates.contactInfo = JSON.parse(req.body.contactInfo); } catch {}
    }

    // Parse availabilityDates
    if (req.body.availabilityDates !== undefined) {
      try { updates.availabilityDates = JSON.parse(req.body.availabilityDates); } catch {}
    }

    // Parse episodes
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

    if (episodeList.length > 0) {
      updates.episode = episodeList[0];
    }

    // Link preview
    if (req.body.linkPreview) {
      try { updates.linkPreview = JSON.parse(req.body.linkPreview); } catch {}
    }

    // Merge attachments
    let existingAttachments = [];
    if (req.body.existingAttachments) {
      try { existingAttachments = JSON.parse(req.body.existingAttachments); } catch {}
    }
    const newAttachments = req.files
      ? req.files.map((f) => ({
          filename: f.filename, originalName: f.originalname,
          mimetype: f.mimetype, path: f.path, size: f.size,
        }))
      : [];
    updates.attachments = [...existingAttachments, ...newAttachments];

    const updated = await Casting.findByIdAndUpdate(id, updates, { new: true });

    const projectId = req.moduleData.project_id;
    const folderKeys = buildAllFolderKeys(
      updated.status, updated.episode, updated.characterName, updated.talentName
    );
    await incrementFolderBadges(projectId, folderKeys);

    // Create additional documents for extra episodes
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
        const inserted = await Casting.create(newDoc);
        additionalDocs.push(inserted);

        const epFolderKeys = buildAllFolderKeys(inserted.status, ep, inserted.characterName, inserted.talentName);
        await incrementFolderBadges(projectId, epFolderKeys);
      }
    }

    const totalCount = 1 + additionalDocs.length;

    await CastingActivityLog.create({
      castingId: id,
      projectId, userId,
      userName: updatedByName || "",
      action: "edited",
      details: totalCount > 1
        ? `Casting "${updated.characterName} / ${updated.talentName}" updated + ${additionalDocs.length} episode(s) added`
        : `Casting "${updated.characterName} / ${updated.talentName}" updated`,
    });

    return sendSuccess(res, updated, totalCount > 1
      ? `Casting updated + ${additionalDocs.length} episode(s) created`
      : "Casting updated successfully");
  } catch (error) {
    console.error("updateCasting error:", error.message);
    return sendError(res, 500, "Failed to update casting");
  }
};

// ────────────────────── Character Number Validation ──────────────────────

/**
 * POST /api/v2/casting/validate-character-number
 * Check if a character number is already assigned to a different character in this project.
 */
const validateCharacterNumber = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { characterNumber, characterName } = req.body;

    if (!characterNumber) return sendSuccess(res, { conflict: false });

    const existing = await Casting.findOne({
      projectId,
      characterNumber: parseInt(characterNumber),
      characterName: { $ne: characterName || "" },
      deleted: 0,
    }).lean();

    if (existing) {
      return sendSuccess(res, {
        conflict: true,
        existingCharacter: existing.characterName,
        number: existing.characterNumber,
      });
    }

    return sendSuccess(res, { conflict: false });
  } catch (error) {
    console.error("validateCharacterNumber error:", error.message);
    return sendError(res, 500, "Failed to validate character number");
  }
};

// ────────────────────── Move ──────────────────────

/**
 * PUT /api/v2/casting/move/items
 * Copy-based move with sourceId duplicate detection.
 */
const moveCastings = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { castingIds, targetStatus, userName, commonDetails, perItemDetails, fillDetails } = req.body;

    if (!castingIds || !Array.isArray(castingIds) || castingIds.length === 0) {
      return sendError(res, 400, "castingIds array is required");
    }

    const units = await CastingUnit.find({ projectId }, { identifier: 1 }).lean();
    const validStatuses = units.length > 0 ? units.map((u) => u.identifier) : ["select", "shortlist", "final"];
    if (!validStatuses.includes(targetStatus)) {
      return sendError(res, 400, "Invalid target status");
    }

    const castings = await Casting.find({ _id: { $in: castingIds }, projectId, deleted: 0 });
    if (castings.length === 0) return sendError(res, 404, "No castings found");

    // Build shared details
    const details = commonDetails || fillDetails || null;
    const sharedFields = {};
    if (details) {
      const fieldNames = [
        "characterName", "talentName", "gender", "castType",
        "characterNumber", "jobFrequency", "description",
      ];
      fieldNames.forEach((f) => { if (details[f] !== undefined) sharedFields[f] = details[f]; });
      if (details.characterNumber) sharedFields.characterNumber = parseInt(details.characterNumber);
      if (details.episode !== undefined) sharedFields.episode = details.episode;
      if (details.contactInfo) sharedFields.contactInfo = details.contactInfo;
      if (details.availabilityDates) sharedFields.availabilityDates = details.availabilityDates;
    }

    // Per-item overrides
    const perItemMap = {};
    if (perItemDetails && Array.isArray(perItemDetails)) {
      perItemDetails.forEach((item) => {
        if (!item._id) return;
        const overrides = {};
        if (item.episode !== undefined) overrides.episode = item.episode;
        if (item.characterName !== undefined) overrides.characterName = item.characterName;
        if (item.talentName !== undefined) overrides.talentName = item.talentName;
        if (Object.keys(overrides).length > 0) perItemMap[String(item._id)] = overrides;
      });
    }

    // Check for duplicates
    const sourceIds = castings.map((c) => c.sourceId || c._id);
    const existingCopies = await Casting.find({
      projectId, status: targetStatus, sourceId: { $in: sourceIds }, deleted: 0,
    }).lean();

    const existingSet = new Set();
    existingCopies.forEach((copy) => { existingSet.add(String(copy.sourceId)); });

    const duplicates = [];
    const toCopy = [];

    for (const c of castings) {
      const srcId = String(c.sourceId || c._id);
      if (existingSet.has(srcId)) {
        duplicates.push(`${c.characterName} / ${c.talentName}` || String(c._id));
      } else {
        toCopy.push(c);
      }
    }

    if (toCopy.length === 0) {
      const names = duplicates.slice(0, 5).join(", ");
      return sendError(res, 409,
        `These castings have already been moved to ${targetStatus}: ${names}${duplicates.length > 5 ? ` and ${duplicates.length - 5} more` : ""}`
      );
    }

    // Create copies
    const newDocs = toCopy.map((c) => {
      const cObj = c.toObject();
      const cId = String(c._id);
      const perItem = perItemMap[cId] || {};

      delete cObj._id;
      delete cObj.__v;
      delete cObj.createdAt;
      delete cObj.updatedAt;
      delete cObj.lastViewedBy;
      delete cObj.discussion;

      return {
        ...cObj,
        ...sharedFields,
        ...perItem,
        status: targetStatus,
        sourceId: c.sourceId || c._id,
        lastViewedBy: {},
      };
    });

    const inserted = await Casting.insertMany(newDocs);

    // Log activity
    const activityLogs = inserted.map((newC, idx) => ({
      castingId: newC._id,
      projectId, userId,
      userName: userName || "",
      action: "moved",
      details: `Copied to "${targetStatus}" from "${toCopy[idx].status}"`,
      previousValue: toCopy[idx].status,
      newValue: targetStatus,
    }));
    await CastingActivityLog.insertMany(activityLogs);

    // Increment badges
    for (const newC of inserted) {
      const keys = buildAllFolderKeys(targetStatus, newC.episode, newC.characterName, newC.talentName);
      await incrementFolderBadges(projectId, keys);
    }

    // Socket broadcast
    const io = req.app.get("io");
    if (io) io.to(projectId).emit("castings_moved", {
      castingIds: inserted.map((c) => c._id),
      toStatus: targetStatus,
      count: inserted.length,
    });

    let msg = `${inserted.length} casting(s) copied to ${targetStatus}`;
    if (duplicates.length > 0) {
      msg += `. ${duplicates.length} skipped (already in ${targetStatus}).`;
    }
    return sendSuccess(res, {
      movedCount: inserted.length,
      duplicateCount: duplicates.length,
      duplicateNames: duplicates.slice(0, 10),
    }, msg);
  } catch (error) {
    console.error("moveCastings error:", error.message);
    return sendError(res, 500, "Failed to move castings");
  }
};

/**
 * PUT /api/v2/casting/move/folder
 */
const moveCastingFolder = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { folderField, folderValue, currentStatus, targetStatus, episode, userName,
            commonDetails, perItemDetails, fillDetails } = req.body;

    if (folderValue === undefined || folderValue === null) {
      return sendError(res, 400, "Folder value is required");
    }

    const units = await CastingUnit.find({ projectId }, { identifier: 1 }).lean();
    const validStatuses = units.length > 0 ? units.map((u) => u.identifier) : ["select", "shortlist", "final"];
    if (!validStatuses.includes(targetStatus)) {
      return sendError(res, 400, "Invalid target status");
    }

    const query = { projectId, status: currentStatus, deleted: 0 };
    const dbField = folderField || "characterName";
    query[dbField] = folderValue;
    if (episode) query.episode = episode;

    const castings = await Casting.find(query);
    if (castings.length === 0) return sendError(res, 404, "No castings found in folder");

    // Build shared update
    const details = commonDetails || fillDetails || null;
    const sharedUpdate = { status: targetStatus };
    if (details) {
      const fields = [
        "characterName", "talentName", "gender", "castType",
        "characterNumber", "jobFrequency", "description",
      ];
      fields.forEach((f) => { if (details[f] !== undefined) sharedUpdate[f] = details[f]; });
      if (details.characterNumber) sharedUpdate.characterNumber = parseInt(details.characterNumber);
      if (details.episode !== undefined) sharedUpdate.episode = details.episode;
      if (details.contactInfo) sharedUpdate.contactInfo = details.contactInfo;
      if (details.availabilityDates) sharedUpdate.availabilityDates = details.availabilityDates;
    }

    // Per-item overrides
    const perItemMap = {};
    if (perItemDetails && Array.isArray(perItemDetails)) {
      perItemDetails.forEach((item) => {
        if (!item._id) return;
        const itemUpdate = {};
        if (item.episode !== undefined) itemUpdate.episode = item.episode;
        if (item.characterName !== undefined) itemUpdate.characterName = item.characterName;
        if (item.talentName !== undefined) itemUpdate.talentName = item.talentName;
        if (Object.keys(itemUpdate).length > 0) perItemMap[String(item._id)] = itemUpdate;
      });
    }

    // Check for duplicates
    const sourceIds = castings.map((c) => c.sourceId || c._id);
    const existingCopies = await Casting.find({
      projectId, status: targetStatus, sourceId: { $in: sourceIds }, deleted: 0,
    }).lean();
    const existingSet = new Set(existingCopies.map((c) => String(c.sourceId)));

    const duplicates = [];
    const toCopy = [];
    for (const c of castings) {
      const srcId = String(c.sourceId || c._id);
      if (existingSet.has(srcId)) {
        duplicates.push(`${c.characterName} / ${c.talentName}` || String(c._id));
      } else {
        toCopy.push(c);
      }
    }

    if (toCopy.length === 0) {
      return sendError(res, 409, `All items in this folder have already been moved to ${targetStatus}.`);
    }

    // Create copies
    const newDocs = toCopy.map((c) => {
      const cObj = c.toObject();
      const perItem = perItemMap[String(c._id)] || {};
      delete cObj._id;
      delete cObj.__v;
      delete cObj.createdAt;
      delete cObj.updatedAt;
      delete cObj.lastViewedBy;
      delete cObj.discussion;

      return {
        ...cObj,
        ...sharedUpdate,
        ...perItem,
        status: targetStatus,
        sourceId: c.sourceId || c._id,
        lastViewedBy: {},
      };
    });

    const inserted = await Casting.insertMany(newDocs);

    await CastingActivityLog.create({
      projectId, userId,
      userName: userName || "",
      action: "moved",
      details: `Folder "${folderValue}" copied from "${currentStatus}" to "${targetStatus}" (${inserted.length} items)`,
      previousValue: currentStatus, newValue: targetStatus,
    });

    for (const newC of inserted) {
      const keys = buildAllFolderKeys(targetStatus, newC.episode, newC.characterName, newC.talentName);
      await incrementFolderBadges(projectId, keys);
    }

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("casting_folder_moved", { folderValue, toStatus: targetStatus });

    let msg = `${inserted.length} item(s) from folder copied to ${targetStatus}`;
    if (duplicates.length > 0) msg += `. ${duplicates.length} skipped (already there).`;
    return sendSuccess(res, { movedCount: inserted.length, duplicateCount: duplicates.length }, msg);
  } catch (error) {
    console.error("moveCastingFolder error:", error.message);
    return sendError(res, 500, "Failed to move casting folder");
  }
};

// ────────────────────── Delete / Restore ──────────────────────

const deleteCasting = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid casting ID");

    const casting = await Casting.findById(id);
    if (!casting) return sendError(res, 404, "Casting not found");

    await Casting.findByIdAndUpdate(id, { deleted: Date.now() });

    await CastingActivityLog.create({
      castingId: id, projectId: req.moduleData.project_id,
      userId: req.moduleData.user_id,
      action: "deleted",
      details: `Casting "${casting.characterName} / ${casting.talentName}" deleted`,
    });

    const io = req.app.get("io");
    if (io) io.to(req.moduleData.project_id).emit("casting_deleted", { castingId: id, status: casting.status });

    return sendSuccess(res, null, "Casting deleted successfully");
  } catch (error) {
    console.error("deleteCasting error:", error.message);
    return sendError(res, 500, "Failed to delete casting");
  }
};

const deleteCastingFolder = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { folderField, folderValue, status, episode } = req.body;

    if (folderValue === undefined || folderValue === null) return sendError(res, 400, "Folder value is required");

    const query = { projectId, deleted: 0 };
    const dbField = folderField || "characterName";
    query[dbField] = folderValue;
    if (status) query.status = status;
    if (episode) query.episode = episode;

    const result = await Casting.updateMany(query, { $set: { deleted: Date.now() } });

    await CastingActivityLog.create({
      projectId, userId: req.moduleData.user_id,
      action: "deleted",
      details: `Casting folder "${folderValue}" deleted (${result.modifiedCount} items)`,
    });

    return sendSuccess(res, { deletedCount: result.modifiedCount }, "Casting folder deleted");
  } catch (error) {
    console.error("deleteCastingFolder error:", error.message);
    return sendError(res, 500, "Failed to delete casting folder");
  }
};

const restoreCasting = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid casting ID");

    const casting = await Casting.findById(id);
    if (!casting) return sendError(res, 404, "Casting not found");
    if (casting.deleted === 0) return sendError(res, 400, "Not deleted");

    await Casting.findByIdAndUpdate(id, { deleted: 0 });

    await CastingActivityLog.create({
      castingId: id, projectId: req.moduleData.project_id,
      userId: req.moduleData.user_id,
      action: "restored",
      details: `Casting restored`,
    });

    return sendSuccess(res, null, "Casting restored");
  } catch (error) {
    console.error("restoreCasting error:", error.message);
    return sendError(res, 500, "Failed to restore casting");
  }
};

const getDeletedCastings = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const castings = await Casting.find({ projectId, deleted: { $gt: 0 } }).sort({ deleted: -1 }).limit(100);
    return sendSuccess(res, castings);
  } catch (error) {
    return sendError(res, 500, "Failed to fetch deleted castings");
  }
};

// ────────────────────── Stats / Badges ──────────────────────

const getCastingStats = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;

    const units = await CastingUnit.find({ projectId }, { identifier: 1 }).lean();
    const tabKeys = units.length > 0
      ? units.map((u) => u.identifier)
      : ["select", "shortlist", "final"];

    const allCastings = await Casting.find(
      { projectId, deleted: 0 },
      { status: 1 }
    ).lean();

    const stats = { total: 0 };
    tabKeys.forEach((k) => { stats[k] = 0; });
    allCastings.forEach((c) => {
      stats[c.status] = (stats[c.status] || 0) + 1;
      stats.total += 1;
    });

    const tabBadgeDocs = await CastingFolderBadge.find({ projectId, folderKey: { $in: tabKeys } }).lean();
    const badges = {};
    tabKeys.forEach((k) => { badges[k] = 0; });
    tabBadgeDocs.forEach((bd) => {
      const viewed = bd.viewedBy?.[userId] || 0;
      badges[bd.folderKey] = Math.max(0, bd.activityCount - viewed);
    });

    const unitChatCounts = await CastingUnitChat.aggregate([
      { $match: { projectId } },
      { $group: { _id: "$unit", count: { $sum: 1 } } },
    ]);
    const unitChats = {};
    unitChatCounts.forEach((u) => { unitChats[u._id] = u.count; });

    return sendSuccess(res, { stats, badges, unitChats });
  } catch (error) {
    console.error("getCastingStats error:", error.message);
    return sendError(res, 500, "Failed to fetch casting stats");
  }
};

// ────────────────────── Unit Chat ──────────────────────

const getCastingUnitChats = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { unit } = req.query;
    if (!["select", "shortlist", "final"].includes(unit)) {
      return sendError(res, 400, "Invalid unit");
    }
    const messages = await CastingUnitChat.find({ projectId, unit }).sort({ createdAt: 1 });
    return sendSuccess(res, messages);
  } catch (error) {
    return sendError(res, 500, "Failed to fetch casting unit chats");
  }
};

const createCastingUnitChat = async (req, res) => {
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

    const message = await CastingUnitChat.create(chatData);

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("casting_unit_chat_message", { unit, message });

    return sendSuccess(res, message, "Message sent", 201);
  } catch (error) {
    return sendError(res, 500, "Failed to send casting chat message");
  }
};

// ────────────────────── Comments ──────────────────────

const getCastingComments = async (req, res) => {
  try {
    const { castingId } = req.params;
    if (!isValidObjectId(castingId)) return sendError(res, 400, "Invalid casting ID");
    const comments = await CastingComment.find({ castingId }).sort({ createdAt: 1 });
    return sendSuccess(res, comments);
  } catch (error) {
    return sendError(res, 500, "Failed to fetch casting comments");
  }
};

const createCastingComment = async (req, res) => {
  try {
    const { castingId } = req.params;
    if (!isValidObjectId(castingId)) return sendError(res, 400, "Invalid casting ID");

    const userId = req.moduleData.user_id;
    const projectId = req.moduleData.project_id;
    const { text, userName, contextEpisode, contextCharacterName, replyToId, replyToUserName, replyToText } = req.body;

    if (!text || !text.trim()) return sendError(res, 400, "Comment text is required");

    const commentData = {
      castingId, projectId, userId,
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

    const comment = await CastingComment.create(commentData);

    const casting = await Casting.findByIdAndUpdate(castingId, { discussion: true }, { new: true });

    const folderKeys = buildAllFolderKeys(
      casting.status, casting.episode, casting.characterName, casting.talentName
    );
    await incrementFolderBadges(projectId, folderKeys);

    await CastingActivityLog.create({
      castingId, projectId, userId,
      userName: userName || "",
      action: "commented",
      details: text.trim().substring(0, 100),
    });

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("casting_comment", { castingId, comment });

    return sendSuccess(res, comment, "Comment added", 201);
  } catch (error) {
    return sendError(res, 500, "Failed to add casting comment");
  }
};

const updateCastingComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid comment ID");
    const { text } = req.body;
    if (!text || !text.trim()) return sendError(res, 400, "Comment text is required");
    const updated = await CastingComment.findByIdAndUpdate(id, { text: text.trim() }, { new: true });
    if (!updated) return sendError(res, 404, "Comment not found");
    return sendSuccess(res, updated, "Comment updated");
  } catch (error) {
    return sendError(res, 500, "Failed to update casting comment");
  }
};

const deleteCastingComment = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) return sendError(res, 400, "Invalid comment ID");
    await CastingComment.findByIdAndDelete(id);
    return sendSuccess(res, null, "Comment deleted");
  } catch (error) {
    return sendError(res, 500, "Failed to delete casting comment");
  }
};

// ────────────────────── Share ──────────────────────

const shareCastings = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { castingIds, userIds, userName, message } = req.body;

    if (!castingIds?.length) return sendError(res, 400, "castingIds required");
    if (!userIds?.length) return sendError(res, 400, "userIds required");

    const activityLogs = castingIds.map((cId) => ({
      castingId: cId, projectId, userId,
      userName: userName || "",
      action: "shared",
      details: `Shared with ${userIds.length} user(s)${message ? `: ${message}` : ""}`,
    }));
    await CastingActivityLog.insertMany(activityLogs);

    const io = req.app.get("io");
    if (io) io.to(projectId).emit("castings_shared", { castingIds, sharedBy: { userId, name: userName }, sharedWith: userIds, message });

    return sendSuccess(res, { sharedCount: castingIds.length, recipientCount: userIds.length }, "Shared");
  } catch (error) {
    return sendError(res, 500, "Failed to share castings");
  }
};

// ────────────────────── Units (Tabs) ──────────────────────

const DEFAULT_CASTING_UNITS = [
  { identifier: "select", label: "Selects", order: 0 },
  { identifier: "shortlist", label: "Shortlisted", order: 1 },
  { identifier: "final", label: "Finalized", order: 2 },
];

const getCastingUnits = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    let units = await CastingUnit.find({ projectId }).sort({ order: 1 }).lean();

    if (units.length === 0) {
      const docs = DEFAULT_CASTING_UNITS.map((u) => ({ ...u, projectId }));
      units = await CastingUnit.insertMany(docs);
      units = units.map((u) => u.toObject ? u.toObject() : u);
    }

    return sendSuccess(res, units);
  } catch (error) {
    console.error("getCastingUnits error:", error.message);
    return sendError(res, 500, "Failed to fetch casting units");
  }
};

const getCastingBadges = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { status = "select" } = req.query;

    await markFolderViewed(projectId, status, userId);

    const badgeDocs = await CastingFolderBadge.find({
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
    console.error("getCastingBadges error:", error.message);
    return sendError(res, 500, "Failed to fetch casting badges");
  }
};

const markCastingViewed = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const { folderKey } = req.body;
    if (!folderKey) return sendError(res, 400, "folderKey is required");
    await markFolderViewed(projectId, folderKey, userId);
    return sendSuccess(res, { marked: folderKey });
  } catch (error) {
    console.error("markCastingViewed error:", error.message);
    return sendError(res, 500, "Failed to mark viewed");
  }
};

// ────────────────────── Sync API ──────────────────────

const syncCastings = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { status = "select", since, direction = "prev", limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();
    const query = { projectId, status };
    if (since) query.updatedAt = { $gt: new Date(since) };
    if (direction !== "next") query.deleted = 0;

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = Casting.find(query).sort({ updatedAt: 1 });
    if (parsedLimit > 0) q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    const castings = await q;
    const total = await Casting.countDocuments(query);

    return sendSuccess(res, { castings, total, page: parsedPage, limit: parsedLimit, syncTimestamp });
  } catch (error) {
    console.error("syncCastings error:", error.message);
    return sendError(res, 500, "Failed to sync castings");
  }
};

const syncCastingComments = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { status = "select", since, direction = "prev", limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();
    const locQuery = { projectId, status };
    if (direction !== "next") locQuery.deleted = 0;
    const castingIds = await Casting.find(locQuery, { _id: 1 }).lean();
    const ids = castingIds.map((c) => c._id);

    const commentQuery = { castingId: { $in: ids } };
    if (since) commentQuery.updatedAt = { $gt: new Date(since) };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = CastingComment.find(commentQuery).sort({ updatedAt: 1 });
    if (parsedLimit > 0) q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    const comments = await q;
    const total = await CastingComment.countDocuments(commentQuery);

    return sendSuccess(res, { comments, total, page: parsedPage, limit: parsedLimit, syncTimestamp });
  } catch (error) {
    console.error("syncCastingComments error:", error.message);
    return sendError(res, 500, "Failed to sync casting comments");
  }
};

const syncCastingActivity = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { since, limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();
    const query = { projectId };
    if (since) query.createdAt = { $gt: new Date(since) };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = CastingActivityLog.find(query).sort({ createdAt: 1 });
    if (parsedLimit > 0) q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    const activities = await q;
    const total = await CastingActivityLog.countDocuments(query);

    return sendSuccess(res, { activities, total, page: parsedPage, limit: parsedLimit, syncTimestamp });
  } catch (error) {
    console.error("syncCastingActivity error:", error.message);
    return sendError(res, 500, "Failed to sync casting activity");
  }
};

const syncCastingUnitChats = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { unit = "select", since, limit = "50", page = "0" } = req.query;

    const syncTimestamp = new Date().toISOString();
    const query = { projectId, unit };
    if (since) query.createdAt = { $gt: new Date(since) };

    const parsedLimit = parseInt(limit);
    const parsedPage = parseInt(page);

    let q = CastingUnitChat.find(query).sort({ createdAt: 1 });
    if (parsedLimit > 0) q = q.skip(parsedPage * parsedLimit).limit(parsedLimit);
    const chats = await q;
    const total = await CastingUnitChat.countDocuments(query);

    return sendSuccess(res, { chats, total, page: parsedPage, limit: parsedLimit, syncTimestamp });
  } catch (error) {
    console.error("syncCastingUnitChats error:", error.message);
    return sendError(res, 500, "Failed to sync casting unit chats");
  }
};

module.exports = {
  getCastingFolders, getCastings, getCastingById,
  createCasting, updateCasting,
  validateCharacterNumber,
  moveCastings, moveCastingFolder,
  deleteCasting, deleteCastingFolder, restoreCasting, getDeletedCastings,
  getCastingStats,
  getCastingUnitChats, createCastingUnitChat,
  getCastingComments, createCastingComment, updateCastingComment, deleteCastingComment,
  shareCastings,
  getCastingUnits,
  getCastingBadges,
  markCastingViewed,
  syncCastings,
  syncCastingComments,
  syncCastingActivity,
  syncCastingUnitChats,
};
