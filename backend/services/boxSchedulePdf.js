/**
 * Box Schedule PDF generator service.
 *
 * Pulls days/events/types from Mongo, renders the HTML template, asks
 * Puppeteer to produce a PDF buffer, and grabs a JPEG thumbnail of the
 * first page.
 *
 * Returns { pdfBuffer, thumbnailBuffer, width, height } — caller decides
 * what to do with the bytes (upload to S3, return inline, etc.).
 */

const sharp = require("sharp");
const { getBrowser } = require("../utils/puppeteer");
const { buildHtml } = require("./pdfTemplate");

const BoxScheduleDay = require("../models/boxSchedule/BoxScheduleDay");
const BoxScheduleEvent = require("../models/boxSchedule/BoxScheduleEvent");
const BoxScheduleType = require("../models/boxSchedule/BoxScheduleType");

// A4 landscape at 96 DPI ≈ 1123 × 794 pt. Portrait swaps these.
const PAGE_DIMENSIONS = {
  landscape: { width: 1123, height: 794 },
  portrait:  { width: 794, height: 1123 },
};

/**
 * Generate a PDF + JPEG thumbnail for a Box Schedule.
 *
 * @param {Object} opts
 * @param {string} opts.projectId
 * @param {Object} [opts.scope]       — { from, to, dayIds } — narrows the data set
 * @param {string} [opts.orientation] — "landscape" (default) | "portrait"
 * @param {string} [opts.title]       — header title
 * @param {Object} [opts.watermark]   — { text, image, opacity, fontSize, position }
 *
 * @returns {Promise<{ pdfBuffer: Buffer, thumbnailBuffer: Buffer, width: number, height: number }>}
 */
async function generateSchedulePdf({
  projectId,
  scope = {},
  orientation = "landscape",
  title = "Production Schedule",
  watermark,
} = {}) {
  if (!projectId) throw new Error("projectId is required");

  // ── 1. Fetch data ────────────────────────────────────────────────────────
  const dayQuery = { projectId, deleted: 0 };
  if (scope.dayIds && scope.dayIds.length) {
    dayQuery._id = { $in: scope.dayIds };
  }
  if (scope.from || scope.to) {
    const range = {};
    if (scope.from) range.$gte = Number(scope.from);
    if (scope.to)   range.$lte = Number(scope.to);
    dayQuery.startDate = range;
  }

  const [days, types] = await Promise.all([
    BoxScheduleDay.find(dayQuery).sort({ startDate: 1 }).lean(),
    BoxScheduleType.find({ projectId }).sort({ order: 1 }).lean(),
  ]);

  // Expand multi-day rows into one record per calendarDay so the PDF lists each day.
  const expandedDays = [];
  for (const d of days) {
    const cd = (d.calendarDays && d.calendarDays.length > 0) ? d.calendarDays : [d.startDate];
    for (const ts of cd) {
      expandedDays.push({ ...d, date: ts });
    }
  }

  const dayIds = days.map((d) => d._id);
  const eventQuery = { projectId, deleted: 0 };
  if (dayIds.length) eventQuery.scheduleDayId = { $in: dayIds };

  const events = await BoxScheduleEvent
    .find(eventQuery)
    .sort({ date: 1, startDateTime: 1 })
    .lean();

  // ── 2. Render HTML ───────────────────────────────────────────────────────
  const html = buildHtml({
    days: expandedDays,
    events,
    types,
    title,
    watermark,
  });

  // ── 3. PDF + thumbnail via Puppeteer ─────────────────────────────────────
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const dims = PAGE_DIMENSIONS[orientation] || PAGE_DIMENSIONS.landscape;
    await page.setViewport({ width: dims.width, height: dims.height, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      landscape: orientation === "landscape",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: "12mm", bottom: "12mm", left: "12mm", right: "12mm" },
    });

    // Thumbnail — first viewport screenshot, scaled down.
    const screenshot = await page.screenshot({ type: "jpeg", quality: 80, fullPage: false });
    const thumbnailBuffer = await sharp(screenshot)
      .resize({ width: 480, withoutEnlargement: true })
      .jpeg({ quality: 75 })
      .toBuffer();

    return {
      pdfBuffer,
      thumbnailBuffer,
      width: dims.width,
      height: dims.height,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { generateSchedulePdf };
