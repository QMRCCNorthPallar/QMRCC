import { put } from '@vercel/blob';

export default async function handler(req, res) {
  const auth = req.headers.authorization?.replace("Bearer ", "");
  if (auth !== process.env.ADMIN_PASSWORD)
    return res.status(401).json({ error: "Unauthorized" });

  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  const orientation = req.query.orientation;
  const file = req.body;

  if (!file) return res.status(400).json({ error: "No file" });

  const buffer = Buffer.from(file.split(",")[1], "base64");

  const blob = await put(`frame_${orientation}.png`, buffer, {
    access: "public",
    contentType: "image/png",
  });

  res.json({ success: true, url: blob.url });
}
