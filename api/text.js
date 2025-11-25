import { ADMIN_PASSWORD, BLOB_PUBLIC_URL_BASE } from '../../config';
import { get, put } from '@vercel/blob';

export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*"); // allow GitHub Pages
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  let frontText = "Welcome to QMRCC!";

  // Load persisted text
  try {
    const blobResp = await get("frontText.json");
    if (blobResp.body) {
      const data = JSON.parse(await blobResp.body.text());
      frontText = data.text || frontText;
    }
  } catch (err) {
    console.log("No persisted text found, using default.");
  }

  if (req.method === 'GET') {
    return res.status(200).json({ text: frontText });
  }

  if (req.method === 'POST') {
    const { text, password } = req.body;

    if (password !== ADMIN_PASSWORD) 
      return res.status(401).json({ message: 'Unauthorized' });

    frontText = text || '';

    // Save text to Blob
    try {
      await put("frontText.json", JSON.stringify({ text: frontText }), { access: "public" });
    } catch (err) {
      console.error("Error saving frontText:", err);
      return res.status(500).json({ message: "Failed to save text" });
    }

    return res.status(200).json({ success: true });
  }

  res.status(405).json({ message: 'Method not allowed' });
}
