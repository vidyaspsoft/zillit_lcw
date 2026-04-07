const mongoose = require("mongoose");

function sendSuccess(res, data, message = "Success", status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function sendError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
}

function parseStringArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
}

module.exports = {
  sendSuccess,
  sendError,
  isValidObjectId,
  parseBoolean,
  parseStringArray,
};
