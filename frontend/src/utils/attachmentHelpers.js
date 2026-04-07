/**
 * Attachment model helper utilities.
 *
 * Attachment format (matching Android):
 * {
 *   media: "filename.jpg" (local) or "projectId/film-tools/casting/actual/file.jpg" (S3),
 *   thumbnail: same as media or separate thumbnail path,
 *   content_type: "image" | "video" | "application",
 *   content_subtype: "jpeg" | "png" | "mp4" | "pdf",
 *   caption: "",
 *   height: 0, width: 0, duration: 0,
 *   bucket: "" (local) or "zillit-bucket-mumbai" (S3),
 *   region: "" (local) or "ap-south-1" (S3),
 *   name: "original_filename.jpg",
 *   file_size: "76507"
 * }
 */

/**
 * Get the display URL for an attachment.
 * Handles both local uploads (no bucket) and S3 (with bucket).
 *
 * @param {Object} att - Attachment object
 * @param {string} serverBaseUrl - Base URL of the backend (e.g., "http://localhost:5004")
 * @param {boolean} useThumbnail - If true, prefer thumbnail over media
 * @returns {string|null} Full URL or null
 */
export function getAttachmentUrl(att, serverBaseUrl, useThumbnail = false) {
  if (!att) return null;

  const mediaPath = useThumbnail ? (att.thumbnail || att.media) : att.media;
  if (!mediaPath) return null;

  // S3 path — has bucket set
  if (att.bucket) {
    return `https://${att.bucket}.s3.${att.region || 'ap-south-1'}.amazonaws.com/${mediaPath}`;
  }

  // Local path — served from /uploads
  return `${serverBaseUrl}/uploads/${mediaPath}`;
}

/**
 * Check if an attachment is an image.
 */
export function isImage(att) {
  if (!att) return false;
  if (att.content_type === 'image') return true;
  // Fallback for legacy data
  if (att.mimetype?.startsWith('image')) return true;
  return false;
}

/**
 * Check if an attachment is a video.
 */
export function isVideo(att) {
  if (!att) return false;
  if (att.content_type === 'video') return true;
  if (att.mimetype?.startsWith('video')) return true;
  return false;
}

/**
 * Check if an attachment is a document (PDF, etc.).
 */
export function isDocument(att) {
  if (!att) return false;
  return !isImage(att) && !isVideo(att);
}

/**
 * Get the display name of an attachment.
 */
export function getAttachmentName(att) {
  if (!att) return 'File';
  return att.name || att.originalName || att.media || 'File';
}

/**
 * Get the first image attachment from a list for thumbnail display.
 */
export function getFirstImage(attachments) {
  if (!attachments?.length) return null;
  return attachments.find((a) => isImage(a)) || null;
}

/**
 * Get thumbnail URL from folder data (first attachment).
 */
export function getFolderThumbnailUrl(folder, serverBaseUrl) {
  if (!folder?.thumbnail) return null;
  return getAttachmentUrl(folder.thumbnail, serverBaseUrl, true);
}
