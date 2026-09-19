const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const rateLimit = require('express-rate-limit');
const { analyzeUrl, getFormats } = require('./services/ytdlp');
const { createJob, getJob, cancelJob } = require('./services/jobManager');

dotenv.config();

const app = express();
const port = process.env.PORT || 8080;
const workerToken = process.env.WORKER_TOKEN;

// Rate limiters
const analyzeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Limit each IP to 100 analysis per window
});

const jobsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50, // Limit each IP to 50 jobs per window
});

app.use(cors());
app.use(express.json());

// Auth middleware
const requireAuth = (req, res, next) => {
  if (!workerToken) {
    return next(); // No token configured, allow all
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${workerToken}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/analyze', analyzeLimiter, requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    const result = await analyzeUrl(url);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to analyze URL' });
  }
});

app.post('/api/formats', requireAuth, async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    const result = await getFormats(url);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message || 'Failed to get formats' });
  }
});

app.post('/api/jobs', jobsLimiter, requireAuth, (req, res) => {
  try {
    const { url, mode, playlistItems, customFormat } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (!mode || typeof mode !== 'string') {
      return res.status(400).json({ error: 'Invalid mode' });
    }
    const data = { url, mode, playlistItems, customFormat };
    const jobId = createJob(data);
    res.json({ jobId });
  } catch (error) {
    res.status(400).json({ error: error.message || 'Invalid job request' });
  }
});

app.delete('/api/jobs/:id', requireAuth, (req, res) => {
  cancelJob(req.params.id);
  res.json({ success: true });
});

app.get('/api/jobs/:id/stream', (req, res) => {
  const jobId = req.params.id;
  const job = getJob(jobId);

  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send historical events
  for (const event of job.events) {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  // Subscribe to new events
  const onEvent = (event) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  job.emitter.on('event', onEvent);

  req.on('close', () => {
    job.emitter.off('event', onEvent);
  });
});

app.get('/api/jobs/:id/files/:name', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  const fileName = req.params.name;
  const filePath = path.join(job.outputDir, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.download(filePath, fileName);
});

app.get('/api/jobs/:id/zip', (req, res) => {
  const job = getJob(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });

  if (!fs.existsSync(job.outputDir)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  const archive = archiver('zip', { zlib: { level: 9 } });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="download-${job.id}.zip"`);

  archive.on('error', (err) => {
    res.status(500).send({ error: err.message });
  });

  archive.pipe(res);
  archive.directory(job.outputDir, false);
  archive.finalize();
});

app.listen(port, () => {
  console.log(`Worker running on port ${port}`);
});
