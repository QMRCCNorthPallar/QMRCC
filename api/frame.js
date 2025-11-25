import { get } from '@vercel/blob';

export default async function handler(req, res) {
  const orientation = req.query.orientation;
  const key = `frame_${orientation}.png`;

  try {
    const { url } = await get(key);
    return res.redirect(url);
  } catch {
    return res.status(404).json({ error: "Frame not found" });
  }
}
