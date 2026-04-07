const crypto = require("crypto");

const ALGORITHM = "aes-256-cbc";
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

function getKeyAndIV() {
  const encryptionKey = process.env.ENCRYPTION_KEY;
  const ivKey = process.env.IV_KEY;
  if (!encryptionKey || !ivKey) {
    throw new Error("ENCRYPTION_KEY and IV_KEY must be set in environment");
  }
  const key = Buffer.from(encryptionKey.slice(-32), "utf8");
  const iv = Buffer.from(ivKey.slice(0, 16), "utf8");
  return { key, iv };
}

function removePKCS5Padding(buffer) {
  if (buffer.length === 0) throw new Error("Empty buffer");
  const padByte = buffer[buffer.length - 1];
  if (padByte < 1 || padByte > 16) throw new Error("Invalid padding byte");
  for (let i = buffer.length - padByte; i < buffer.length; i++) {
    if (buffer[i] !== padByte) throw new Error("Invalid PKCS5 padding");
  }
  return buffer.slice(0, buffer.length - padByte);
}

function applyPKCS5Padding(buffer) {
  const blockSize = 16;
  const padLength = blockSize - (buffer.length % blockSize);
  return Buffer.concat([buffer, Buffer.alloc(padLength, padLength)]);
}

function decryptModuleData(hexString) {
  const { key, iv } = getKeyAndIV();
  const encryptedBuffer = Buffer.from(hexString, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAutoPadding(false);
  const decryptedRaw = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);
  return removePKCS5Padding(decryptedRaw).toString("utf8");
}

function encryptModuleData(jsonString) {
  const { key, iv } = getKeyAndIV();
  const paddedBuffer = applyPKCS5Padding(Buffer.from(jsonString, "utf8"));
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAutoPadding(false);
  return Buffer.concat([cipher.update(paddedBuffer), cipher.final()]).toString("hex");
}

function authMiddleware(req, res, next) {
  try {
    const moduleDataHeader = req.headers["moduledata"];
    if (!moduleDataHeader) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decryptedString = decryptModuleData(moduleDataHeader);
    let parsed;
    try {
      parsed = JSON.parse(decryptedString);
    } catch {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { device_id, project_id, user_id, time_stamp } = parsed;
    if (!device_id || !project_id || !user_id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!time_stamp) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const requestTime = new Date(time_stamp).getTime();
    if (isNaN(requestTime) || Math.abs(Date.now() - requestTime) > TIMESTAMP_TOLERANCE_MS) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    req.moduleData = { device_id, project_id, user_id, time_stamp };
    next();
  } catch (error) {
    console.error("Auth middleware error:", error.message);
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
}

module.exports = { authMiddleware, encryptModuleData, decryptModuleData };
