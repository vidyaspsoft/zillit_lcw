const CharacterBreakdown = require("../models/CharacterBreakdown");
const { sendSuccess, sendError } = require("../utils/helpers");

/**
 * GET /api/v2/casting/character-breakdowns?characterName=Police
 * Returns breakdown for a character (or all breakdowns for the project).
 */
const getCharacterBreakdowns = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { characterName } = req.query;

    const query = { projectId };
    if (characterName) query.characterName = characterName;

    const breakdowns = await CharacterBreakdown.find(query).sort({ characterName: 1 }).lean();
    return sendSuccess(res, breakdowns);
  } catch (error) {
    console.error("getCharacterBreakdowns error:", error.message);
    return sendError(res, 500, "Failed to fetch character breakdowns");
  }
};

/**
 * POST /api/v2/casting/character-breakdowns
 * Upsert — creates or updates a breakdown for a character.
 */
const saveCharacterBreakdown = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const userId = req.moduleData.user_id;
    const {
      characterName, characterDescription, ageRange,
      characterArc, sceneCount, relationships, episodes,
      createdByName,
    } = req.body;

    if (!characterName) {
      return sendError(res, 400, "Character name is required");
    }

    const update = {
      characterDescription: characterDescription || "",
      ageRange: ageRange || "",
      characterArc: characterArc || "",
      sceneCount: sceneCount ? parseInt(sceneCount) : 0,
      relationships: relationships || "",
      createdBy: { userId, name: createdByName || "" },
    };

    if (episodes) {
      try {
        update.episodes = Array.isArray(episodes) ? episodes : JSON.parse(episodes);
      } catch {
        update.episodes = [];
      }
    }

    const breakdown = await CharacterBreakdown.findOneAndUpdate(
      { projectId, characterName },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return sendSuccess(res, breakdown, "Character breakdown saved");
  } catch (error) {
    console.error("saveCharacterBreakdown error:", error.message);
    return sendError(res, 500, "Failed to save character breakdown");
  }
};

/**
 * PUT /api/v2/casting/character-breakdowns/:id
 * Partial update by ID.
 */
const updateCharacterBreakdown = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};

    const fields = ["characterDescription", "ageRange", "characterArc", "sceneCount", "relationships"];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    });
    if (updates.sceneCount) updates.sceneCount = parseInt(updates.sceneCount);

    if (req.body.episodes) {
      try {
        updates.episodes = Array.isArray(req.body.episodes) ? req.body.episodes : JSON.parse(req.body.episodes);
      } catch {}
    }

    const breakdown = await CharacterBreakdown.findByIdAndUpdate(id, updates, { new: true });
    if (!breakdown) return sendError(res, 404, "Breakdown not found");

    return sendSuccess(res, breakdown, "Breakdown updated");
  } catch (error) {
    console.error("updateCharacterBreakdown error:", error.message);
    return sendError(res, 500, "Failed to update breakdown");
  }
};

module.exports = {
  getCharacterBreakdowns,
  saveCharacterBreakdown,
  updateCharacterBreakdown,
};
