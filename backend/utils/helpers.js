const mongoose = require("mongoose");

function sendSuccess(res, data, message = "Success", status = 200) {
  return res.status(status).json({ success: true, message, data });
}

function sendError(res, status, message) {
  return res.status(status).json({ success: false, message });
}

/**
 * V2 response helpers — match the Android app / existing Zillit API format:
 *   { status: 1|0, message, messageElements: [], data? }
 * Used by Box Schedule controllers. messageElements is reserved for future
 * structured field-level messages; for now we always pass [].
 */
function sendSuccessV2(res, data, message = "success", httpStatus = 200, messageElements = []) {
  return res.status(httpStatus).json({
    status: 1,
    message,
    messageElements,
    data,
  });
}

function sendErrorV2(res, httpStatus, message, messageElements = []) {
  return res.status(httpStatus).json({
    status: 0,
    message,
    messageElements,
  });
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
  sendSuccessV2,
  sendErrorV2,
  isValidObjectId,
  parseBoolean,
  parseStringArray,
};
