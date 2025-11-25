import formidable from 'formidable';
import fs from 'fs';
import { BLOB_PUBLIC_URL_BASE, BLOB_READ_WRITE_TOKEN, ADMIN_PASSWORD } from '../../config';

export const config = {
    api: {
        bodyParser: false,
    },
};

let frames = [];
let banners = [];

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    const form = formidable({ multiples: false });
    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ message: 'Form parse error' });
        if (fields.password !== ADMIN_PASSWORD) return res.status(401).json({ message: 'Unauthorized' });

        const file = files.file;
        const type = req.query.type || 'frame';
        if (!file) return res.status(400).json({ message: 'No file uploaded' });

        // Simulate upload to cloud (Vercel Blob or similar)
        const newUrl = `${BLOB_PUBLIC_URL_BASE}/${file.originalFilename}`;

        if (type === 'banner') {
            banners.push({ url: newUrl });
        } else {
            const orientation = fields.orientation || 'vertical';
            frames.push({ url: newUrl, orientation });
        }

        res.status(200).json({ success: true, url: newUrl });
    });
}
