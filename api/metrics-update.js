import { get, put } from '@vercel/blob';

export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*"); // or your GitHub Pages URL
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  const type = req.query.type;

  let metrics = { downloads: 0, frameChanges: 0 };

  try {
    const { body } = await get("metrics.json");
    if (body) {
      const text = await body.text();
      metrics = JSON.parse(text || "{}");
    }
  } catch (err) {
    console.log("metrics.json not found, creating new metrics.");
  }

  if (type === "download") metrics.downloads++;
  if (type === "change") metrics.frameChanges++;

  try {
    await put("metrics.json", JSON.stringify(metrics), { access: "public" });
    res.json({ success: true, metrics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to save metrics" });
  }
}
