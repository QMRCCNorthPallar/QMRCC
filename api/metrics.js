import { get } from '@vercel/blob';

export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow GitHub Pages
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  let frames = [];
  let banners = [];
  let downloads = 0;

  try {
    // Fetch persistent frames/banners/downloads from Blob
    const framesResp = await get("frames.json");
    if (framesResp.body) frames = JSON.parse(await framesResp.body.text());

    const bannersResp = await get("banners.json");
    if (bannersResp.body) banners = JSON.parse(await bannersResp.body.text());

    const metricsResp = await get("metrics.json");
    if (metricsResp.body) {
      const metricsData = JSON.parse(await metricsResp.body.text());
      downloads = metricsData.downloads || 0;
    }
  } catch (err) {
    console.log("No persistent data found, using defaults.");
  }

  res.status(200).json({
    totalFrames: frames.length,
    totalBanners: banners.length,
    totalDownloads: downloads,
    topFrame: frames[0]?.url || '-',
  });
}
