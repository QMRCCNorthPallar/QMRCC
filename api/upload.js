import formidable from 'formidable';
import fs from 'fs';
import { BLOB_PUBLIC_URL_BASE, BLOB_READ_WRITE_TOKEN, ADMIN_PASSWORD } from '../../config';
import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  // --- CORS headers ---
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ message: 'Form parse error' });
    if (fields.password !== ADMIN_PASSWORD) return res.status(401).json({ message: 'Unauthorized' });

    const file = files.file;
    const type = req.query.type || 'frame';
    if (!file) return res.status(400).json({ message: 'No file uploaded' });

    try {
      // Read file as buffer
      const fileData = fs.readFileSync(file.filepath);

      // Upload to Vercel Blob storage
      const blobName = `${Date.now()}_${file.originalFilename}`;
      await put(blobName, fileData, { access: "public" });

      const newUrl = `${BLOB_PUBLIC_URL_BASE}/${blobName}`;

      res.status(200).json({ success: true, url: newUrl });
    } catch (e) {
      console.error("Upload error:", e);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });
}
