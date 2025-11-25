// server.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const basicAuth = require('basic-auth');
const cors = require('cors');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { nanoid } = require('nanoid');

const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'changeme';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup lowdb (file db)
const dbFile = path.join(__dirname, 'db.json');
const adapter = new JSONFile(dbFile);
const db = new Low(adapter);

async function initDb() {
  await db.read();
  db.data = db.data || {
    frames: {
      vertical: null,
      landscape: null
    },
    metrics: {
      downloads: 0,
      uploads: 0,
      uses: 0,
      orientationBreakdown: { vertical: 0, landscape: 0 },
      lastUploadAt: null
    }
  };
  await db.write();
}
initDb();

// Ensure uploads dir exists
const UPLOAD_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR);

// Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = nanoid(8);
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${Date.now()}-${id}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.heic', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext) || /image\/(jpeg|png|heic|webp)/.test(file.mimetype));
  }
});

// Basic auth middleware for admin routes
function requireAdmin(req, res, next) {
  const user = basicAuth(req);
  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="QMRCC Admin"');
    return res.status(401).send('Authentication required.');
  }
  next();
}

// Serve uploads statically
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '1d' }));

// Serve frontend static files
app.use('/', express.static(path.join(__dirname, 'public')));

// API: get current frames & metrics
app.get('/api/frames', async (req, res) => {
  await db.read();
  const frames = db.data.frames;
  res.json({
    vertical: frames.vertical ? `/uploads/${path.basename(frames.vertical)}` : null,
    landscape: frames.landscape ? `/uploads/${path.basename(frames.landscape)}` : null
  });
});

app.get('/api/metrics', async (req, res) => {
  await db.read();
  res.json(db.data.metrics);
});

// API: increment metric (called from frontend)
app.post('/api/metrics/increment', async (req, res) => {
  const { key, orientation } = req.body;
  await db.read();
  const m = db.data.metrics;
  if (!m) return res.status(500).send('Metrics not available');
  if (key === 'download') m.downloads = (m.downloads || 0) + 1;
  if (key === 'use') m.uses = (m.uses || 0) + 1;
  if (orientation && m.orientationBreakdown) {
    if (!m.orientationBreakdown[orientation]) m.orientationBreakdown[orientation] = 0;
    m.orientationBreakdown[orientation] += 1;
  }
  await db.write();
  res.json({ ok: true });
});

// Admin: upload frame (vertical or landscape)
app.post('/admin/upload', requireAdmin, upload.single('frame'), async (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded');
  const orientation = req.body.orientation === 'landscape' ? 'landscape' : 'vertical';
  await db.read();
  // Optionally remove previous file (keep for logs)
  db.data.frames[orientation] = req.file.path;
  db.data.metrics.uploads = (db.data.metrics.uploads || 0) + 1;
  db.data.metrics.lastUploadAt = new Date().toISOString();
  await db.write();
  res.json({
    ok: true,
    orientation,
    path: `/uploads/${path.basename(req.file.path)}`,
    metrics: db.data.metrics
  });
});

// Admin: get admin page (protected)
app.get('/admin', requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Admin: API to list all uploaded files (optional)
app.get('/admin/files', requireAdmin, async (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).map(f => ({ file: f, url: `/uploads/${f}` }));
  res.json(files);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
  console.log(`Admin user: ${ADMIN_USER} (set ADMIN_USER/ADMIN_PASS env vars in production)`);
});
