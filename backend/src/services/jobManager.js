const { spawn } = require('child_process');
const { EventEmitter } = require('events');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { buildDownloadCommand } = require('./ytdlp');

const CONCURRENCY_LIMIT = 2;
const JOB_TTL_MS = 60 * 60 * 1000; // 1 hour

const jobs = new Map();
const queue = [];
let activeJobs = 0;

function createJob(request) {
  const id = uuidv4();
  const outputDir = path.join(process.cwd(), 'downloads', id);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const job = {
    id,
    request,
    status: 'queued',
    outputDir,
    events: [],
    files: [],
    emitter: new EventEmitter(),
    createdAt: Date.now(),
  };

  jobs.set(id, job);
  queue.push(id);
  processQueue();
  
  // Cleanup after TTL
  setTimeout(() => cleanupJob(id), JOB_TTL_MS);

  return id;
}

function getJob(id) {
  return jobs.get(id);
}

function cancelJob(id) {
  const job = jobs.get(id);
  if (job) {
    if (job.status === 'running' && job.process) {
      job.process.kill('SIGTERM');
    }
    job.status = 'failed';
    const queueIndex = queue.indexOf(id);
    if (queueIndex > -1) {
      queue.splice(queueIndex, 1);
    }
    pushEvent(job, { type: 'error', message: 'Job cancelled by user.' });
  }
}

function processQueue() {
  if (activeJobs >= CONCURRENCY_LIMIT || queue.length === 0) return;

  const jobId = queue.shift();
  const job = jobs.get(jobId);
  if (!job || job.status !== 'queued') {
    processQueue();
    return;
  }

  runJob(job);
}

function pushEvent(job, event) {
  job.events.push(event);
  job.emitter.emit('event', event);
}

async function runJob(job) {
  job.status = 'running';
  activeJobs++;

  const args = buildDownloadCommand(job.request.url, job.request.mode, job.request.customFormat, job.request.playlistItems);

  job.process = spawn('yt-dlp', args, { cwd: job.outputDir });

  job.process.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      if (line.startsWith('download-progress|')) {
        const parts = line.split('|');
        const percentStr = parts[1]?.replace('%', '').trim();
        const percent = percentStr && percentStr !== 'NA' ? parseFloat(percentStr) : undefined;
        
        pushEvent(job, {
          type: 'progress',
          percent: isNaN(percent) ? undefined : percent,
          speed: parts[2]?.trim(),
          eta: parts[3]?.trim(),
        });
      } else {
        pushEvent(job, { type: 'log', line });
      }
    }
  });

  job.process.stderr?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (let line of lines) {
      line = line.trim();
      if (line) {
        pushEvent(job, { type: 'log', line });
      }
    }
  });

  job.process.on('close', (code) => {
    job.status = code === 0 ? 'completed' : 'failed';
    
    // Scan output directory for files
    let files = [];
    if (fs.existsSync(job.outputDir)) {
      const filesInDir = fs.readdirSync(job.outputDir);
      files = filesInDir.map(name => {
        const stat = fs.statSync(path.join(job.outputDir, name));
        return {
          name,
          size: stat.size,
          downloadUrl: `/api/jobs/${job.id}/files/${encodeURIComponent(name)}`
        };
      });
    }
    
    job.files = files;

    if (code === 0) {
      pushEvent(job, { type: 'done', files });
    } else {
      pushEvent(job, { type: 'error', message: `yt-dlp exited with code ${code}` });
    }

    activeJobs--;
    processQueue();
  });
}

function cleanupJob(id) {
  const job = jobs.get(id);
  if (job) {
    if (job.status === 'running' && job.process) {
      job.process.kill('SIGTERM');
    }
    try {
      if (fs.existsSync(job.outputDir)) {
        fs.rmSync(job.outputDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error(`Failed to cleanup dir for job ${id}`, e);
    }
    jobs.delete(id);
  }
}

// Periodically clean up old jobs
setInterval(() => {
  const now = Date.now();
  for (const [id, job] of jobs.entries()) {
    if (now - job.createdAt > JOB_TTL_MS) {
      cleanupJob(id);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes

module.exports = {
  createJob,
  getJob,
  cancelJob
};
