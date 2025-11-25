import { BLOB_PUBLIC_URL_BASE, BLOB_READ_WRITE_TOKEN, ADMIN_PASSWORD } from '../../config';

const frames = []; // temporary in-memory store
const banners = [];

// Single handler function with CORS
export default async function handler(req, res) {
    // --- CORS headers ---
    res.setHeader("Access-Control-Allow-Origin", "*"); // or "https://qmrccnorthpallar.github.io"
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        // Preflight request
        return res.status(200).end();
    }

    const type = req.query.type || 'frame';

    try {
        if (req.method === 'GET') {
            if (type === 'banner') return res.status(200).json(banners);
            return res.status(200).json(frames);
        }

        // POST not supported here, use upload.js
        return res.status(405).json({ message: 'Method not allowed' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
}
