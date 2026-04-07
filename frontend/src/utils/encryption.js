import CryptoJS from 'crypto-js';

// These must match the backend .env values
const ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'abcdefghijklmnopqrstuvwxyz123456789ABCDEFGHIJKLMNOP';
const IV_KEY = import.meta.env.VITE_IV_KEY || '1234567890abcdef1234567890abcdef';

/**
 * Derives AES key and IV matching Android's EncrytionDecryption.kt logic.
 *   Key = last 32 characters of ENCRYPTION_KEY
 *   IV  = first 16 characters of IV_KEY
 */
function getKeyAndIV() {
  const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY.slice(-32));
  const iv = CryptoJS.enc.Utf8.parse(IV_KEY.slice(0, 16));
  return { key, iv };
}

/**
 * Apply PKCS5 padding manually (matching Android's NoPadding + manual pad approach)
 */
function applyPKCS5Padding(text) {
  const blockSize = 16;
  const bytes = CryptoJS.enc.Utf8.parse(text);
  const padLength = blockSize - (bytes.sigBytes % blockSize);
  // Create padding bytes
  const paddingWords = [];
  const paddingBytes = [];
  for (let i = 0; i < padLength; i++) {
    paddingBytes.push(padLength);
  }
  const paddingWordArray = CryptoJS.lib.WordArray.create(new Uint8Array(paddingBytes));
  return bytes.concat(paddingWordArray);
}

/**
 * Encrypt a JSON string using AES-256-CBC with PKCS5 padding.
 * Returns the result as a hex string.
 * Matches Android's EncrytionDecryption.kt exactly.
 */
export function encryptModuleData(jsonString) {
  const { key, iv } = getKeyAndIV();
  const paddedData = applyPKCS5Padding(jsonString);

  const encrypted = CryptoJS.AES.encrypt(paddedData, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.NoPadding,
  });

  // Convert to hex string
  return encrypted.ciphertext.toString(CryptoJS.enc.Hex);
}

/**
 * Build and encrypt the moduledata header payload.
 * Matches Android's ReqHeader structure with fresh timestamp.
 */
export function buildModuleDataHeader(userId, projectId, deviceId) {
  const payload = {
    device_id: deviceId,
    project_id: projectId,
    user_id: userId,
    time_stamp: new Date().toISOString(),
  };
  return encryptModuleData(JSON.stringify(payload));
}
