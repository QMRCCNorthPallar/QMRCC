import { ADMIN_PASSWORD } from '../../config';

let frontText = "Welcome to QMRCC!";

export default function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json({ text: frontText });
    }

    if (req.method === 'POST') {
        const { text, password } = req.body;
        if (password !== ADMIN_PASSWORD) return res.status(401).json({ message: 'Unauthorized' });
        frontText = text || '';
        return res.status(200).json({ success: true });
    }

    res.status(405).json({ message: 'Method not allowed' });
}
