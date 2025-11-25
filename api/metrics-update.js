import { get, put } from '@vercel/blob';

export default async function handler(req, res) {
  const type = req.query.type;

  let metrics = { downloads: 0, frameChanges: 0 };

  try {
    const { body } = await get("metrics.json");
    metrics = JSON.parse(await body.text());
  } catch {}

  if (type === "download") metrics.downloads++;
  if (type === "change") metrics.frameChanges++;

  await put("metrics.json", JSON.stringify(metrics), { access: "public" });

  res.json({ success: true });
}
