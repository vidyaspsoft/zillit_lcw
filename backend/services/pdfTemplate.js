/**
 * Server-side HTML template for the Box Schedule PDF.
 *
 * Mirrors the structure of `frontend/src/components/box-schedule/PrintableSchedule.jsx`
 * so the printed output is visually consistent with what users used to see in the
 * browser print dialog. Now rendered by Puppeteer instead.
 *
 * Watermark API:
 *   buildHtml({ ..., watermark: { text, image, opacity, fontSize, position } })
 *
 *   - `text`     — string (rendered diagonal across each page). Optional.
 *   - `image`    — full URL or `data:` URI. Optional.
 *   - `opacity`  — 0..1, default 0.10
 *   - `fontSize` — px, default 96
 *   - `position` — "center" (default) | "top-left" | "top-right" | "bottom-left" | "bottom-right"
 *
 *   Both `text` and `image` may be present — text overlays the image.
 *   Omit the entire `watermark` field to render without one.
 */

const escapeHtml = (s = "") =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const fmtDate = (ms) => {
  if (!ms) return "";
  const d = new Date(Number(ms));
  const opts = { weekday: "long", month: "long", day: "numeric", year: "numeric" };
  return d.toLocaleDateString("en-US", opts);
};

const fmtTime = (ms) => {
  if (!ms) return "";
  const d = new Date(Number(ms));
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
};

// ── Watermark CSS + markup ──────────────────────────────────────────────────

function watermarkCss(wm) {
  if (!wm || (!wm.text && !wm.image)) return "";
  const opacity = typeof wm.opacity === "number" ? wm.opacity : 0.1;
  const fontSize = wm.fontSize || 96;

  // Position presets — center is the most common and uses a 30° rotation.
  const positions = {
    center:        "top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-30deg);",
    "top-left":    "top: 8%; left: 8%;",
    "top-right":   "top: 8%; right: 8%;",
    "bottom-left": "bottom: 8%; left: 8%;",
    "bottom-right":"bottom: 8%; right: 8%;",
  };
  const posCss = positions[wm.position] || positions.center;

  return `
    .wm-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 9999;
    }
    .wm-text, .wm-image {
      position: absolute;
      ${posCss}
      opacity: ${opacity};
      user-select: none;
    }
    .wm-text {
      font-family: 'Georgia', 'Times New Roman', serif;
      font-size: ${fontSize}px;
      font-weight: 700;
      color: #888;
      white-space: nowrap;
      letter-spacing: 4px;
      text-transform: uppercase;
    }
    .wm-image {
      max-width: 50vw;
      max-height: 50vh;
    }
  `;
}

function watermarkHtml(wm) {
  if (!wm || (!wm.text && !wm.image)) return "";
  const text = wm.text ? `<div class="wm-text">${escapeHtml(wm.text)}</div>` : "";
  const img = wm.image ? `<img class="wm-image" src="${escapeHtml(wm.image)}" alt="" />` : "";
  return `<div class="wm-layer">${img}${text}</div>`;
}

// ── Body sections ───────────────────────────────────────────────────────────

function legendHtml(types) {
  if (!types || types.length === 0) return "";
  const items = types
    .map(
      (t) => `
      <span class="legend-item">
        <span class="legend-dot" style="background:${escapeHtml(t.color || "#3498DB")}"></span>
        <span class="legend-name">${escapeHtml(t.title || "Untitled")}</span>
      </span>`
    )
    .join("");
  return `<div class="legend">${items}</div>`;
}

function dayBlockHtml(day, dayEvents, idx) {
  const date = fmtDate(day.date);
  const tint = `${day.color || "#3498DB"}0F`; // ~6% opacity tint
  const isOff = (day.typeName || "").toLowerCase().includes("off");
  const bg = isOff ? "#f5f5f5" : tint;

  const events = dayEvents.filter((e) => e.eventType === "event");
  const notes = dayEvents.filter((e) => e.eventType === "note" || !e.eventType);

  const eventsHtml = events.length
    ? `<div class="section">
         <div class="section-title">Events</div>
         ${events
           .map((e) => {
             const time = e.fullDay
               ? "Full Day"
               : `${fmtTime(e.startDateTime)} – ${fmtTime(e.endDateTime)}`;
             return `<div class="event">
               <div class="event-time">${escapeHtml(time)}</div>
               <div class="event-body">
                 <div class="event-title">${escapeHtml(e.title || "")}</div>
                 ${e.location ? `<div class="event-loc">${escapeHtml(e.location)}</div>` : ""}
               </div>
             </div>`;
           })
           .join("")}
       </div>`
    : "";

  const notesHtml = notes.length
    ? `<div class="section">
         <div class="section-title">Notes</div>
         <ul class="note-list">
           ${notes
             .map(
               (n) =>
                 `<li>
                    <strong>${escapeHtml(n.title || "")}</strong>
                    ${n.notes ? `<div class="note-body">${escapeHtml(n.notes)}</div>` : ""}
                  </li>`
             )
             .join("")}
         </ul>
       </div>`
    : "";

  return `
    <div class="day" style="background:${bg};border-left-color:${escapeHtml(day.color || "#3498DB")}">
      <div class="day-head">
        <div class="day-num">Day ${idx + 1}</div>
        <div class="day-date">${escapeHtml(date)}</div>
        <div class="day-type">${escapeHtml(day.typeName || "")}</div>
        ${day.title ? `<div class="day-title">${escapeHtml(day.title)}</div>` : ""}
      </div>
      ${eventsHtml || notesHtml ? `<div class="day-body">${eventsHtml}${notesHtml}</div>` : ""}
    </div>`;
}

// ── Main entry ──────────────────────────────────────────────────────────────

/**
 * Build the full HTML document for the schedule PDF.
 *
 * @param {Object} args
 * @param {Array}  args.days      — schedule rows; each: { _id, date, color, typeName, title }
 * @param {Array}  args.events    — events keyed to days by `scheduleDayId` or `date`
 * @param {Array}  args.types     — schedule type list (for legend)
 * @param {string} args.title     — header title (default "Production Schedule")
 * @param {Object} [args.watermark] — { text, image, opacity, fontSize, position }
 * @returns {string} HTML
 */
function buildHtml({ days = [], events = [], types = [], title = "Production Schedule", watermark } = {}) {
  // Group events under each day. Match by scheduleDayId first, fall back to `date`.
  const eventsByDay = new Map();
  for (const e of events) {
    const key = e.scheduleDayId || `date:${e.date}`;
    if (!eventsByDay.has(key)) eventsByDay.set(key, []);
    eventsByDay.get(key).push(e);
  }

  const daysSorted = [...days].sort((a, b) => (a.date || a.startDate || 0) - (b.date || b.startDate || 0));
  const blocks = daysSorted
    .map((d, i) => {
      const evts = eventsByDay.get(d._id) || eventsByDay.get(`date:${d.date || d.startDate}`) || [];
      return dayBlockHtml({ ...d, date: d.date || d.startDate }, evts, i);
    })
    .join("");

  const generatedAt = new Date().toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    color: #2C3E50;
    font-size: 12px;
    line-height: 1.45;
    padding: 24px 28px 32px;
    background: #fff;
  }
  .header {
    text-align: center;
    border-bottom: 2px solid #2C3E50;
    padding-bottom: 12px;
    margin-bottom: 18px;
  }
  .header h1 {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 26px;
    letter-spacing: 4px;
    text-transform: uppercase;
    margin: 0 0 4px;
  }
  .header .printed { font-size: 11px; color: #7F8C8D; }
  .legend {
    display: flex; flex-wrap: wrap; gap: 12px 18px;
    margin-bottom: 18px;
    padding: 10px 12px;
    background: #FAFAFA;
    border: 1px solid #E0E0E0;
    border-radius: 6px;
    page-break-inside: avoid;
  }
  .legend-item { display: inline-flex; align-items: center; gap: 6px; font-size: 11px; }
  .legend-dot { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  .legend-name { color: #2C3E50; font-weight: 500; }

  .day {
    border-left: 4px solid #3498DB;
    border-radius: 4px;
    padding: 10px 14px;
    margin-bottom: 10px;
    page-break-inside: avoid;
  }
  .day-head {
    display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px;
    border-bottom: 1px dashed rgba(0,0,0,0.08);
    padding-bottom: 6px;
    margin-bottom: 6px;
  }
  .day-num { font-weight: 700; font-size: 13px; }
  .day-date { color: #2C3E50; font-size: 12px; }
  .day-type {
    font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
    padding: 2px 8px; background: rgba(0,0,0,0.05); border-radius: 4px;
  }
  .day-title { color: #7F8C8D; font-size: 11px; font-style: italic; }

  .section { margin-top: 6px; }
  .section-title {
    font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
    color: #7F8C8D; font-weight: 700; margin: 4px 0;
  }

  .event { display: flex; gap: 10px; padding: 4px 0; border-top: 1px solid rgba(0,0,0,0.04); }
  .event:first-child { border-top: 0; }
  .event-time { width: 110px; font-weight: 600; color: #1B4F72; font-size: 11px; }
  .event-body { flex: 1; }
  .event-title { font-weight: 600; color: #2C3E50; }
  .event-loc { font-size: 11px; color: #7F8C8D; }

  .note-list { margin: 0; padding-left: 18px; }
  .note-list li { margin-bottom: 4px; }
  .note-body { font-size: 11px; color: #555; margin-top: 2px; }

  .footer {
    text-align: center; font-size: 10px; color: #95A5A6;
    margin-top: 18px; padding-top: 10px; border-top: 1px solid #E0E0E0;
  }
  ${watermarkCss(watermark)}
  @page { margin: 12mm; }
</style>
</head>
<body>
  ${watermarkHtml(watermark)}
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="printed">Generated ${escapeHtml(generatedAt)}</div>
  </div>
  ${legendHtml(types)}
  ${blocks || `<div style="text-align:center;padding:40px 0;color:#7F8C8D;">No schedule days yet.</div>`}
  <div class="footer">Generated by Zillit · ${escapeHtml(generatedAt)}</div>
</body>
</html>`;
}

module.exports = { buildHtml };
