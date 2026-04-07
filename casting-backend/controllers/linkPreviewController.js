const fetch = require("node-fetch");
const cheerio = require("cheerio");
const { sendSuccess, sendError } = require("../utils/helpers");

/**
 * POST /api/v2/location/link-preview
 * Fetches Open Graph metadata from a URL.
 */
const getLinkPreview = async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return sendError(res, 400, "URL is required");

    // Validate URL
    try {
      new URL(url);
    } catch {
      return sendError(res, 400, "Invalid URL");
    }

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ZillitBot/1.0)",
      },
      timeout: 8000,
    });

    if (!response.ok) {
      return sendError(res, 400, "Failed to fetch URL");
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const metadata = {
      url,
      title:
        $('meta[property="og:title"]').attr("content") ||
        $("title").text() ||
        "",
      description:
        $('meta[property="og:description"]').attr("content") ||
        $('meta[name="description"]').attr("content") ||
        "",
      image:
        $('meta[property="og:image"]').attr("content") ||
        $('meta[property="og:image:url"]').attr("content") ||
        "",
      siteName:
        $('meta[property="og:site_name"]').attr("content") || "",
      type:
        $('meta[property="og:type"]').attr("content") || "",
      favicon:
        $('link[rel="icon"]').attr("href") ||
        $('link[rel="shortcut icon"]').attr("href") ||
        "",
    };

    // Make relative image/favicon URLs absolute
    if (metadata.image && !metadata.image.startsWith("http")) {
      const baseUrl = new URL(url);
      metadata.image = new URL(metadata.image, baseUrl.origin).href;
    }
    if (metadata.favicon && !metadata.favicon.startsWith("http")) {
      const baseUrl = new URL(url);
      metadata.favicon = new URL(metadata.favicon, baseUrl.origin).href;
    }

    return sendSuccess(res, metadata);
  } catch (error) {
    console.error("getLinkPreview error:", error.message);
    return sendError(res, 500, "Failed to fetch link preview");
  }
};

module.exports = { getLinkPreview };
