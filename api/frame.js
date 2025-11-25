import { BLOB_PUBLIC_URL_BASE, BLOB_READ_WRITE_TOKEN, ADMIN_PASSWORD } from '../../config';

const frames = []; // temporary in-memory store
const banners = [];

export default async function handler(req, res) {
    const type = req.query.type || 'frame';
    
    if (req.method === 'GET') {
        if (type === 'banner') return res.status(200).json(banners);
        return res.status(200).json(frames);
    }
    
    // POST not supported here, use upload.js
    res.status(405).json({ message: 'Method not allowed' });
}
