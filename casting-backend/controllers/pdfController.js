const PDFDocument = require("pdfkit");
const Casting = require("../models/Casting");
const { sendError } = require("../utils/helpers");

/**
 * POST /api/v2/casting/generate-pdf
 * Generate a casting report PDF for given casting IDs.
 */
const generatePDF = async (req, res) => {
  try {
    const { castingIds, title = "Casting Report", includeDetails = true } = req.body;

    if (!castingIds || castingIds.length === 0) {
      return sendError(res, 400, "No casting IDs provided");
    }

    const castings = await Casting.find({ _id: { $in: castingIds } }).lean();
    if (castings.length === 0) {
      return sendError(res, 404, "No castings found");
    }

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="casting-report.pdf"`);
    doc.pipe(res);

    // Title
    doc.fontSize(20).font("Helvetica-Bold").text(title, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666")
      .text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} | ${castings.length} casting(s)`, { align: "center" });
    doc.moveDown(1);

    // Line
    doc.strokeColor("#E2E8F0").lineWidth(1)
      .moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // Group by character
    const grouped = {};
    castings.forEach((c) => {
      const key = c.characterName || "Unknown Character";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(c);
    });

    Object.entries(grouped).forEach(([charName, talents], groupIdx) => {
      if (groupIdx > 0) doc.moveDown(0.5);

      // Character header
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1E293B")
        .text(charName);

      const firstTalent = talents[0];
      if (firstTalent.castType) {
        doc.fontSize(9).font("Helvetica").fillColor("#666")
          .text(`Cast Type: ${firstTalent.castType} | Episode: ${firstTalent.episode || '-'}`, { continued: false });
      }
      doc.moveDown(0.3);

      talents.forEach((c, idx) => {
        // Check if we need a new page
        if (doc.y > 700) doc.addPage();

        // Talent row
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#1E293B")
          .text(`${idx + 1}. ${c.talentName || 'Unknown Talent'}`, 60);

        if (includeDetails) {
          const details = [];
          if (c.gender) details.push(`Gender: ${c.gender}`);
          if (c.age) details.push(`Age: ${c.age}`);
          if (c.ethnicity) details.push(`Ethnicity: ${c.ethnicity}`);
          if (c.height) details.push(`Height: ${c.height}`);
          if (c.build) details.push(`Build: ${c.build}`);
          if (c.unionStatus) details.push(`Union: ${c.unionStatus}`);
          if (c.jobFrequency) details.push(`Frequency: ${c.jobFrequency}`);

          if (details.length > 0) {
            doc.fontSize(9).font("Helvetica").fillColor("#666")
              .text(details.join("  |  "), 70);
          }

          if (c.specialSkills) {
            doc.fontSize(9).font("Helvetica").fillColor("#666")
              .text(`Skills: ${c.specialSkills}`, 70);
          }

          // Contact info
          if (c.contactInfo && c.contactInfo.length > 0) {
            c.contactInfo.forEach((contact) => {
              const parts = [];
              if (contact.name) parts.push(contact.name);
              if (contact.type) parts.push(`(${contact.type})`);
              if (contact.email) parts.push(contact.email);
              if (contact.phone) parts.push(`${contact.countryCode || ''} ${contact.phone}`);
              if (contact.company) parts.push(contact.company);
              if (parts.length > 0) {
                doc.fontSize(8).font("Helvetica").fillColor("#888")
                  .text(`Contact: ${parts.join(" | ")}`, 70);
              }
            });
          }

          // Audition info
          if (c.auditionRating > 0 || c.auditionType) {
            const auParts = [];
            if (c.auditionType) auParts.push(`Type: ${c.auditionType}`);
            if (c.auditionRating > 0) auParts.push(`Rating: ${"★".repeat(c.auditionRating)}${"☆".repeat(5 - c.auditionRating)}`);
            if (c.callbackRound > 0) auParts.push(`Callback: Round ${c.callbackRound}`);
            doc.fontSize(8).font("Helvetica").fillColor("#888")
              .text(`Audition: ${auParts.join(" | ")}`, 70);
          }

          if (c.description) {
            doc.fontSize(8).font("Helvetica-Oblique").fillColor("#999")
              .text(`Notes: ${c.description.substring(0, 150)}${c.description.length > 150 ? '...' : ''}`, 70);
          }
        }

        doc.moveDown(0.4);
      });

      // Separator between characters
      doc.strokeColor("#F1F5F9").lineWidth(0.5)
        .moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    });

    // Footer
    doc.moveDown(1);
    doc.fontSize(8).font("Helvetica").fillColor("#999")
      .text("Zillit - Film Production Tools | Confidential", { align: "center" });

    doc.end();
  } catch (error) {
    console.error("generatePDF error:", error.message);
    return sendError(res, 500, "Failed to generate PDF");
  }
};

module.exports = { generatePDF };
