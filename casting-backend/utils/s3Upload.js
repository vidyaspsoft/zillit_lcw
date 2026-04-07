/**
 * S3 Upload Utility
 *
 * Currently saves files locally. When ready to integrate with S3:
 * 1. npm install @aws-sdk/client-s3
 * 2. Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET, S3_REGION in .env
 * 3. Set USE_S3=true in .env
 * 4. Files will upload to S3 and return the S3 path in the attachment model
 */

const path = require("path");
const fs = require("fs");

// ─── S3 Upload (ready for integration) ───
// Uncomment and install @aws-sdk/client-s3 when ready
//
// const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
//
// const s3Client = new S3Client({
//   region: process.env.S3_REGION || "ap-south-1",
//   credentials: {
//     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
//     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
//   },
// });

const USE_S3 = process.env.USE_S3 === "true";
const S3_BUCKET = process.env.S3_BUCKET || "zillit-bucket-mumbai";
const S3_REGION = process.env.S3_REGION || "ap-south-1";

/**
 * Upload file to S3 bucket.
 * Call this when USE_S3=true and AWS credentials are configured.
 *
 * @param {Object} file - Multer file object (filename, path, mimetype, originalname, size)
 * @param {string} projectId - Project ID for S3 path prefix
 * @param {string} toolFolder - Tool folder name (e.g., "casting", "location")
 * @returns {Object} S3 upload result with key and URL
 */
async function uploadToS3(file, projectId, toolFolder = "casting") {
  // Build S3 key matching existing Android path pattern:
  // {projectId}/film-tools/{toolFolder}/actual/{filename}
  const s3Key = `${projectId}/film-tools/${toolFolder}/actual/${file.filename}`;

  // ── Uncomment when ready for S3 ──
  // const fileBuffer = fs.readFileSync(file.path);
  // const command = new PutObjectCommand({
  //   Bucket: S3_BUCKET,
  //   Key: s3Key,
  //   Body: fileBuffer,
  //   ContentType: file.mimetype,
  // });
  // await s3Client.send(command);
  //
  // // Optionally delete local file after S3 upload
  // fs.unlinkSync(file.path);

  return {
    key: s3Key,
    bucket: S3_BUCKET,
    region: S3_REGION,
  };
}

/**
 * Build attachment model object from a multer file.
 * Saves locally for now. When USE_S3=true, uploads to S3.
 *
 * Returns the attachment in the Android-compatible format:
 * { media, thumbnail, content_type, content_subtype, caption, height, width, duration, bucket, region, name, file_size }
 *
 * @param {Object} file - Multer file object
 * @param {string} projectId - Project ID
 * @param {string} toolFolder - "casting" or "location"
 * @returns {Object} Attachment model object
 */
async function buildAttachment(file, projectId, toolFolder = "casting") {
  const ext = path.extname(file.originalname).replace(".", "").toLowerCase();

  // Determine content_type and content_subtype from mimetype
  const mimeParts = (file.mimetype || "").split("/");
  const contentType = mimeParts[0] || "file"; // image, video, application, etc.
  const contentSubtype = mimeParts[1] || ext;   // jpeg, png, mp4, pdf, etc.

  let mediaPath;
  let bucket = "";
  let region = "";

  if (USE_S3) {
    // Upload to S3 and use S3 path
    const s3Result = await uploadToS3(file, projectId, toolFolder);
    mediaPath = s3Result.key;
    bucket = s3Result.bucket;
    region = s3Result.region;
  } else {
    // Local storage — use the local filename (served via /uploads static route)
    mediaPath = file.filename;
  }

  return {
    media: mediaPath,
    thumbnail: mediaPath, // Same as media for images; for videos, generate thumbnail separately
    content_type: contentType,
    content_subtype: contentSubtype,
    caption: "",
    height: 0,
    width: 0,
    duration: 0,
    bucket,
    region,
    name: file.originalname,
    file_size: String(file.size || 0),
  };
}

/**
 * Build attachment model from a downloaded link preview image.
 *
 * @param {Object} downloadedFile - { filename, originalName, mimetype, path, size }
 * @param {string} projectId
 * @returns {Object} Attachment model object
 */
async function buildAttachmentFromDownload(downloadedFile, projectId, toolFolder = "casting") {
  const ext = path.extname(downloadedFile.originalName || "").replace(".", "").toLowerCase();
  const mimeParts = (downloadedFile.mimetype || "").split("/");

  let mediaPath;
  let bucket = "";
  let region = "";

  if (USE_S3) {
    const s3Result = await uploadToS3({
      filename: downloadedFile.filename,
      path: downloadedFile.path,
      mimetype: downloadedFile.mimetype,
      originalname: downloadedFile.originalName,
      size: downloadedFile.size,
    }, projectId, toolFolder);
    mediaPath = s3Result.key;
    bucket = s3Result.bucket;
    region = s3Result.region;
  } else {
    mediaPath = downloadedFile.filename;
  }

  return {
    media: mediaPath,
    thumbnail: mediaPath,
    content_type: mimeParts[0] || "image",
    content_subtype: mimeParts[1] || ext || "jpeg",
    caption: "",
    height: 0,
    width: 0,
    duration: 0,
    bucket,
    region,
    name: downloadedFile.originalName || downloadedFile.filename,
    file_size: String(downloadedFile.size || 0),
  };
}

module.exports = {
  uploadToS3,
  buildAttachment,
  buildAttachmentFromDownload,
  USE_S3,
  S3_BUCKET,
  S3_REGION,
};
