import { writeFile } from 'fs/promises';
import path from 'path';
import formidable from 'formidable';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "yourPassword";

export const config = {
    api: {
        bodyParser: false, // important for file uploads
    },
};

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.status(405).json({ success: false, message: "Method not allowed" });
        return;
    }

    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(500).json({ success: false, message: err.message });
        if (fields.password !== ADMIN_PASSWORD) return res.status(401).json({ success: false, message: "Unauthorized" });

        const type = req.query.type || "frame";
        const file = files.file;
        if (!file) return res.status(400).json({ success: false, message: "No file uploaded" });

        const ext = path.extname(file.originalFilename);
        const fileName = `${Date.now()}-${type}${ext}`;
        const filePath = path.join("./public/uploads/", fileName);

        try {
            await writeFile(filePath, await fs.promises.readFile(file.filepath));
            res.status(200).json({ success: true, url: `/uploads/${fileName}` });
        } catch (e) {
            res.status(500).json({ success: false, message: e.message });
        }
    });
}
