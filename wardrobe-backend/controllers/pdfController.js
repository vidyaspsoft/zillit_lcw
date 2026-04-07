const PDFDocument = require("pdfkit");
const Wardrobe = require("../models/Wardrobe");
const { sendError } = require("../utils/helpers");

/**
 * POST /api/v2/wardrobe/generate-pdf
 * Generate a wardrobe report PDF for given wardrobe IDs.
 */
const generatePDF = async (req, res) => {
  try {
    const { wardrobeIds, title = "Wardrobe Report", includeDetails = true } = req.body;

    if (!wardrobeIds || wardrobeIds.length === 0) {
      return sendError(res, 400, "No wardrobe IDs provided");
    }

    const wardrobes = await Wardrobe.find({ _id: { $in: wardrobeIds } }).lean();
    if (wardrobes.length === 0) {
      return sendError(res, 404, "No wardrobes found");
    }

    const doc = new PDFDocument({ margin: 40, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="wardrobe-report.pdf"`);
    doc.pipe(res);

    // Title
    doc.fontSize(20).font("Helvetica-Bold").text(title, { align: "center" });
    doc.moveDown(0.3);
    doc.fontSize(10).font("Helvetica").fillColor("#666")
      .text(`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })} | ${wardrobes.length} wardrobe item(s)`, { align: "center" });
    doc.moveDown(1);

    // Line
    doc.strokeColor("#E2E8F0").lineWidth(1)
      .moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.moveDown(0.5);

    // Group by character
    const grouped = {};
    wardrobes.forEach((w) => {
      const key = w.characterName || "Unknown Character";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(w);
    });

    Object.entries(grouped).forEach(([charName, items], groupIdx) => {
      if (groupIdx > 0) doc.moveDown(0.5);

      // Character header
      doc.fontSize(14).font("Helvetica-Bold").fillColor("#1E293B")
        .text(charName);

      const firstItem = items[0];
      if (firstItem.talentName) {
        doc.fontSize(9).font("Helvetica").fillColor("#666")
          .text(`Talent: ${firstItem.talentName} | Episode: ${firstItem.episode || '-'}`, { continued: false });
      }
      doc.moveDown(0.3);

      items.forEach((w, idx) => {
        // Check if we need a new page
        if (doc.y > 700) doc.addPage();

        // Scene row
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#1E293B")
          .text(`${idx + 1}. Scene ${w.sceneNumber || '-'} — Ep ${w.episode || '-'}`, 60);

        if (includeDetails) {
          // Costume description
          if (w.description) {
            doc.fontSize(9).font("Helvetica").fillColor("#666")
              .text(`Costume: ${w.description.substring(0, 200)}${w.description.length > 200 ? '...' : ''}`, 70);
          }

          // Continuity state
          if (w.costumeState) {
            doc.fontSize(9).font("Helvetica").fillColor("#666")
              .text(`Costume State: ${w.costumeState}`, 70);
          }

          if (w.continuityNotes) {
            doc.fontSize(9).font("Helvetica").fillColor("#666")
              .text(`Continuity: ${w.continuityNotes.substring(0, 150)}${w.continuityNotes.length > 150 ? '...' : ''}`, 70);
          }

          // Accessories
          if (w.accessories) {
            doc.fontSize(9).font("Helvetica").fillColor("#666")
              .text(`Accessories: ${w.accessories}`, 70);
          }

          // Hair & Makeup
          if (w.hairMakeupState) {
            doc.fontSize(9).font("Helvetica").fillColor("#666")
              .text(`Hair/Makeup: ${w.hairMakeupState}`, 70);
          }

          // Quick change
          if (w.quickChange) {
            doc.fontSize(9).font("Helvetica-Bold").fillColor("#B45309")
              .text(`QUICK CHANGE`, 70);
            if (w.changeNotes) {
              doc.fontSize(8).font("Helvetica").fillColor("#888")
                .text(`Change Notes: ${w.changeNotes}`, 70);
            }
          }

          // Fitting status
          if (w.fittings && w.fittings.length > 0) {
            const fittingStrs = w.fittings.map((f, fi) => {
              const parts = [];
              if (f.date) parts.push(new Date(f.date).toLocaleDateString());
              if (f.status) parts.push(f.status);
              if (f.notes) parts.push(f.notes.substring(0, 60));
              return `Fitting ${fi + 1}: ${parts.join(" — ") || "Scheduled"}`;
            });
            doc.fontSize(8).font("Helvetica").fillColor("#888")
              .text(fittingStrs.join("  |  "), 70);
          }

          // Contact info
          if (w.contactInfo && w.contactInfo.length > 0) {
            w.contactInfo.forEach((contact) => {
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
