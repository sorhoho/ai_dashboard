'use strict';

// Load .env if present (dev convenience; in prod use real env vars)
try { require('fs').readFileSync('.env').toString().split('\n').forEach(l => {
  const [k, ...v] = l.split('=');
  if (k && !k.startsWith('#') && !(k.trim() in process.env)) process.env[k.trim()] = v.join('=').trim();
}); } catch {}

const express = require('express');
const { S3Client, GetObjectCommand, ListObjectsV2Command, HeadBucketCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs   = require('fs');

const app  = express();
const PORT = process.env.PORT || 8080;

// ── S3 client ─────────────────────────────────────────────────────────────────
// Uses AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY when set.
// Falls back to IAM role / instance profile automatically when running on AWS.
const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-southeast-1' });

const BUCKET = process.env.KIRO_S3_BUCKET || '';
const PREFIX = process.env.KIRO_S3_PREFIX  || 'kiro-reports/';
const MANUAL_FILE = path.join(__dirname, 'data', 'manual_metrics.json');

const DEFAULT_MANUAL = {
  bizreq:   { activeUsers: 48,  documentsGenerated: 312, requirementsReviewed: 1840, timeSavedHours: 920  },
  solution: { architectsUsingAI: 29, designDocuments: 156, patternsSuggested: 284, reviewsAutomated: 68  },
  qa:       { engineersWithAI: 38,   testCasesGenerated: 780, defectsCaught: 284,   testCoverage: 84     },
  prod:     { deploymentsWithAI: 88, meanTimeToDeploy: 12, rollbacksPrevented: 14, incidentsAutoResolved: 32 },
};

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options',        'SAMEORIGIN');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection',       '1; mode=block');
  next();
});

// Static files (cache assets, no-cache HTML)
app.use(express.static(path.join(__dirname), {
  setHeaders(res, filePath) {
    if (/\.(css|js|csv|png|jpg|ico|woff2?)$/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    } else {
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status:  'ok',
    service: 'ai-dashboard',
    kiroS3:  BUCKET ? 'configured' : 'not-configured',
  });
});

// ── Kiro S3 API ───────────────────────────────────────────────────────────────

// GET /api/kiro/status — probe S3 with HeadBucket to verify real connectivity
app.get('/api/kiro/status', async (req, res) => {
  const base = { bucket: BUCKET || null, prefix: PREFIX, region: process.env.AWS_REGION || 'ap-southeast-1' };

  if (!BUCKET) {
    return res.json({ ...base, configured: false, connected: false });
  }

  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
    res.json({ ...base, configured: true, connected: true });
  } catch (err) {
    // Bucket exists but credentials lack s3:ListBucket → still reachable
    const reachable = err.$metadata?.httpStatusCode === 403;
    res.json({
      ...base,
      configured: true,
      connected:  reachable,
      error:      reachable ? null : (err.name || err.message),
    });
  }
});

// GET /api/kiro/dates — list dates that have reports in S3
app.get('/api/kiro/dates', async (req, res) => {
  if (!BUCKET) return res.status(503).json({ error: 'S3 not configured', hint: 'Set KIRO_S3_BUCKET env var' });
  try {
    // Try both folder layout (PREFIX/YYYY-MM-DD/) and flat layout (PREFIX/YYYY-MM-DD.csv)
    const [folderOut, flatOut] = await Promise.all([
      s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX, Delimiter: '/' })),
      s3.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: PREFIX })),
    ]);
    const fromFolders = (folderOut.CommonPrefixes || [])
      .map(p => p.Prefix.replace(PREFIX, '').replace('/', ''))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    const fromFlat = (flatOut.Contents || [])
      .map(o => o.Key.replace(PREFIX, '').replace('.csv', ''))
      .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d));
    const dates = [...new Set([...fromFolders, ...fromFlat])].sort().reverse();
    res.json({ dates, bucket: BUCKET, prefix: PREFIX });
  } catch (err) {
    res.status(500).json({ error: err.message, code: err.name });
  }
});

// GET /api/kiro/report?date=YYYY-MM-DD — fetch CSV from S3
app.get('/api/kiro/report', async (req, res) => {
  if (!BUCKET) return res.status(503).json({ error: 'S3 not configured', hint: 'Set KIRO_S3_BUCKET env var' });

  const date = req.query.date || todayISO();

  // Kiro may write to different key patterns — try them in order
  const candidates = [
    `${PREFIX}${date}/user-activity-report.csv`,
    `${PREFIX}${date}.csv`,
    `${PREFIX}${date}/report.csv`,
    `${PREFIX}${date}/user_activity_report.csv`,
  ];

  for (const key of candidates) {
    try {
      const out = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const csv = await out.Body.transformToString('utf-8');
      res.setHeader('Content-Type',  'text/csv');
      res.setHeader('X-S3-Bucket',   BUCKET);
      res.setHeader('X-S3-Key',      key);
      res.setHeader('X-Report-Date', date);
      return res.send(csv);
    } catch (err) {
      if (err.name !== 'NoSuchKey' && err.$metadata?.httpStatusCode !== 404) {
        return res.status(500).json({ error: err.message, code: err.name, key });
      }
      // 404 → try next candidate key
    }
  }

  res.status(404).json({
    error: `No Kiro report found for ${date}`,
    tried: candidates,
    hint:  'Check your KIRO_S3_PREFIX and that the report has been generated for this date.',
  });
});

// ── Manual Metrics API ────────────────────────────────────────────────────────

// GET /api/manual — load saved metrics (falls back to defaults)
app.get('/api/manual', (req, res) => {
  try {
    if (fs.existsSync(MANUAL_FILE)) {
      const saved = JSON.parse(fs.readFileSync(MANUAL_FILE, 'utf8'));
      // Merge with defaults so new keys always exist
      const merged = {};
      for (const [section, defaults] of Object.entries(DEFAULT_MANUAL)) {
        merged[section] = { ...defaults, ...(saved[section] || {}) };
      }
      return res.json(merged);
    }
  } catch {}
  res.json(DEFAULT_MANUAL);
});

// POST /api/manual — save manual metrics
app.post('/api/manual', (req, res) => {
  try {
    const incoming = req.body || {};
    const merged   = {};
    for (const [section, defaults] of Object.entries(DEFAULT_MANUAL)) {
      merged[section] = { ...defaults, ...(incoming[section] || {}) };
    }
    fs.mkdirSync(path.dirname(MANUAL_FILE), { recursive: true });
    fs.writeFileSync(MANUAL_FILE, JSON.stringify(merged, null, 2));
    res.json({ ok: true, data: merged });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

app.listen(PORT, () => {
  console.log(`\n  AI Dashboard  →  http://0.0.0.0:${PORT}`);
  console.log(`  Kiro S3       →  ${BUCKET ? `s3://${BUCKET}/${PREFIX}` : 'NOT CONFIGURED (set KIRO_S3_BUCKET)'}`);
  console.log(`  Region        →  ${process.env.AWS_REGION || 'ap-southeast-1'}\n`);
});
