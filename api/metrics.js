import { get } from '@vercel/blob';

export default async function handler(req, res) {
  try {
    const { body } = await get("metrics.json");
    const metrics = JSON.parse(await body.text());
    res.json(metrics);
  } catch {
    res.json({ downloads: 0, frameChanges: 0 });
  }
}
