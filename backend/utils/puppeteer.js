/**
 * Puppeteer browser singleton.
 *
 * Launches Chromium once at first use and reuses it across requests — saves
 * ~3 s of cold-start per PDF. Disconnects auto-detected and trigger relaunch.
 *
 * Call `getBrowser()` to get the shared instance; pages are short-lived,
 * always close them in the caller's `finally` block.
 */

const puppeteer = require("puppeteer");

let browserPromise = null;

async function launch() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--font-render-hinting=medium",
    ],
  });
  browser.on("disconnected", () => {
    // Force re-launch on next request
    browserPromise = null;
  });
  return browser;
}

async function getBrowser() {
  if (!browserPromise) browserPromise = launch();
  return browserPromise;
}

async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    // ignore
  } finally {
    browserPromise = null;
  }
}

module.exports = { getBrowser, closeBrowser };
