const PDFDocument = require("pdfkit");
const Location = require("../models/location/Location");
const LocationActivityLog = require("../models/location/LocationActivityLog");
const { sendError } = require("../utils/helpers");
const path = require("path");
const fs = require("fs");

/**
 * POST /api/v2/location/generate-pdf
 * Generate a PDF report for given location IDs.
 */
const generatePDF = async (req, res) => {
  try {
    const projectId = req.moduleData.project_id;
    const { locationIds, title, includeDetails = true } = req.body;

    if (!locationIds || !Array.isArray(locationIds) || locationIds.length === 0) {
      return sendError(res, 400, "locationIds array is required");
    }

    const locations = await Location.find({
      _id: { $in: locationIds },
      projectId,
      deleted: 0,
    }).sort({ fileName: 1, sceneNumber: 1 });

    if (locations.length === 0) {
      return sendError(res, 404, "No locations found");
    }

    // Create PDF
    const doc = new PDFDocument({ size: "A4", margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="location-report-${Date.now()}.pdf"`
    );
    doc.pipe(res);

    // Title page
    doc.fontSize(24).font("Helvetica-Bold").text(title || "Location Report", {
      align: "center",
    });
    doc.moveDown(0.5);
    doc.fontSize(12).font("Helvetica").fillColor("#666").text(
      `Generated on ${new Date().toLocaleDateString()} | ${locations.length} location(s)`,
      { align: "center" }
    );
    doc.moveDown(2);

    // Separator
    doc
      .moveTo(50, doc.y)
      .lineTo(545, doc.y)
      .strokeColor("#ddd")
      .stroke();
    doc.moveDown(1);

    // Location details
    locations.forEach((loc, index) => {
      if (index > 0) {
        doc.addPage();
      }

      // Location header
      doc.fontSize(18).font("Helvetica-Bold").fillColor("#1B4F72").text(
        loc.fileName || loc.sceneNumber || "Unnamed Location"
      );
      doc.moveDown(0.3);

      // Status badge
      const statusColors = { select: "#3498DB", shortlist: "#F39C12", final: "#27AE60" };
      const statusLabels = { select: "Selects", shortlist: "Shortlisted", final: "Final" };
      doc
        .fontSize(10)
        .font("Helvetica-Bold")
        .fillColor(statusColors[loc.status] || "#666")
        .text(`Status: ${statusLabels[loc.status] || loc.status}`);
      doc.moveDown(0.5);

      // Image if available
      if (loc.attachments && loc.attachments.length > 0) {
        const firstAtt = loc.attachments[0];
        if (firstAtt.mimetype && firstAtt.mimetype.startsWith("image")) {
          const imgPath = path.join(__dirname, "..", "uploads", firstAtt.filename);
          if (fs.existsSync(imgPath)) {
            try {
              doc.image(imgPath, { width: 300, height: 200, fit: [300, 200] });
              doc.moveDown(0.5);
            } catch {
              // skip if image fails
            }
          }
        }
        doc.fontSize(9).font("Helvetica").fillColor("#999").text(
          `${loc.attachments.length} attachment(s)`
        );
        doc.moveDown(0.5);
      }

      if (includeDetails) {
        doc.fillColor("#333");

        const addField = (label, value) => {
          if (!value) return;
          doc.fontSize(10).font("Helvetica-Bold").text(`${label}: `, { continued: true });
          doc.font("Helvetica").text(value);
          doc.moveDown(0.2);
        };

        addField("Scene Number", loc.sceneNumber);
        addField("Episode", loc.episode);
        addField("City", loc.city);
        addField("Address", loc.address);

        if (loc.latitude != null && loc.longitude != null) {
          addField("GPS", `${loc.latitude}, ${loc.longitude}`);
        }

        if (loc.description) {
          doc.moveDown(0.3);
          doc.fontSize(10).font("Helvetica-Bold").text("Description:");
          doc.font("Helvetica").text(loc.description);
          doc.moveDown(0.3);
        }

        // Contact section
        if (loc.contactName || loc.phone || loc.email) {
          doc.moveDown(0.3);
          doc
            .moveTo(50, doc.y)
            .lineTo(545, doc.y)
            .strokeColor("#eee")
            .stroke();
          doc.moveDown(0.3);
          doc.fontSize(12).font("Helvetica-Bold").fillColor("#1B4F72").text("Contact Information");
          doc.moveDown(0.2);
          doc.fillColor("#333");
          addField("Contact Name", loc.contactName);
          addField("Phone", loc.phone ? `${loc.countryCode || ""} ${loc.phone}` : "");
          addField("Email", loc.email);
        }

        if (loc.link) {
          addField("Link", loc.link);
        }

        // Metadata
        doc.moveDown(0.5);
        doc.fontSize(8).fillColor("#999").text(
          `Created: ${new Date(loc.createdAt).toLocaleString()}` +
          (loc.createdBy?.name ? ` by ${loc.createdBy.name}` : "")
        );
      }
    });

    // Log activity for each location included in PDF
    const userId = req.moduleData.user_id;
    const { userName } = req.body;
    const activityLogs = locations.map((loc) => ({
      locationId: loc._id,
      projectId,
      userId,
      userName: userName || "",
      action: "generated_pdf",
      details: `Generated PDF report${title ? `: ${title}` : ""}`,
    }));
    LocationActivityLog.insertMany(activityLogs).catch(() => {});

    doc.end();
  } catch (error) {
    console.error("generatePDF error:", error.message);
    return sendError(res, 500, "Failed to generate PDF");
  }
};

module.exports = { generatePDF };
