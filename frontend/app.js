const BACKEND_URL = 'https://media-downloader-web-app.onrender.com/'; // Update this for production
const WORKER_TOKEN = ''; // Set if needed

// State
let currentAnalyzeResult = null;
let currentJobId = null;
let eventSource = null;

// DOM Elements
const themeToggle = document.getElementById('theme-toggle');
const urlForm = document.getElementById('url-form');
const urlInput = document.getElementById('url-input');
const pasteBtn = document.getElementById('paste-btn');
const analyzeLoader = document.getElementById('analyze-loader');
const errorMessage = document.getElementById('error-message');

const resultSection = document.getElementById('result-section');
const resultThumb = document.getElementById('result-thumb');
const resultTitle = document.getElementById('result-title');
const resultUploader = document.getElementById('result-uploader');
const resultMeta = document.getElementById('result-meta');

const playlistContainer = document.getElementById('playlist-container');
const playlistItems = document.getElementById('playlist-items');
const selectAllBtn = document.getElementById('select-all-btn');
const selectNoneBtn = document.getElementById('select-none-btn');
const rangeInput = document.getElementById('range-input');
const selectionCount = document.getElementById('selection-count');

const configSection = document.getElementById('config-section');
const modeGrid = document.getElementById('mode-grid');
const customFormat = document.getElementById('custom-format');
const showFormatsBtn = document.getElementById('show-formats-btn');
const startDownloadBtn = document.getElementById('start-download-btn');

const downloadSection = document.getElementById('download-section');
const progressFill = document.getElementById('progress-fill');
const progressPercent = document.getElementById('progress-percent');
const progressSpeed = document.getElementById('progress-speed');
const progressEta = document.getElementById('progress-eta');
const downloadStatus = document.getElementById('download-status');
const rawLog = document.getElementById('raw-log');
const cancelBtn = document.getElementById('cancel-btn');

const completeSection = document.getElementById('complete-section');
const completionSummary = document.getElementById('completion-summary');
const downloadedFiles = document.getElementById('downloaded-files');
const downloadZipBtn = document.getElementById('download-zip-btn');
const newDownloadBtn = document.getElementById('new-download-btn');

const formatsModal = document.getElementById('formats-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const formatsLoader = document.getElementById('formats-loader');
const formatsTable = document.getElementById('formats-table');
const formatsTbody = document.getElementById('formats-tbody');

const MODES = [
  { id: '1', title: 'High Quality MP3', desc: 'Best audio as MP3', playlistSupport: true },
  { id: '2', title: 'Best Original Audio', desc: 'M4A/Opus (faster)', playlistSupport: true },
  { id: '3', title: 'Best Quality MP4', desc: 'Up to 1080p', playlistSupport: true },
  { id: '4', title: 'Up to 4K MP4', desc: 'Highest resolution', playlistSupport: true }
];

// Theme Management
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') {
    document.body.classList.remove('dark-mode');
  }
  updateThemeIcon();
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const isDark = document.body.classList.contains('dark-mode');
  themeToggle.textContent = isDark ? '☀️' : '🌙';
}

themeToggle.addEventListener('click', toggleTheme);

// API Helpers
async function apiFetch(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(WORKER_TOKEN ? { 'Authorization': `Bearer ${WORKER_TOKEN}` } : {}),
    ...(options.headers || {})
  };
  
  const response = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error ${response.status}`);
  }
  return response.json();
}

function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.classList.remove('hidden');
}

function hideError() {
  errorMessage.classList.add('hidden');
}

function resetUI() {
  resultSection.classList.add('hidden');
  configSection.classList.add('hidden');
  downloadSection.classList.add('hidden');
  completeSection.classList.add('hidden');
  hideError();
}

// Paste URL
pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    urlInput.value = text;
  } catch (err) {
    showError("Could not read clipboard. Please paste manually.");
  }
});

// Analyze
urlForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const url = urlInput.value.trim();
  if (!url) return;

  resetUI();
  analyzeLoader.classList.remove('hidden');

  try {
    currentAnalyzeResult = await apiFetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ url })
    });
    
    analyzeLoader.classList.add('hidden');
    renderResult();
  } catch (err) {
    analyzeLoader.classList.add('hidden');
    showError(err.message || "Failed to analyze URL");
  }
});

function renderResult() {
  const { kind, title, uploader, thumbnail, duration, entries } = currentAnalyzeResult;
  
  resultTitle.textContent = title;
  resultUploader.textContent = uploader;
  
  if (thumbnail) {
    resultThumb.src = thumbnail;
    resultThumb.classList.remove('hidden');
  } else {
    resultThumb.classList.add('hidden');
  }

  if (kind === 'single') {
    const mins = Math.floor((duration || 0) / 60);
    const secs = (duration || 0) % 60;
    resultMeta.textContent = `Duration: ${mins}:${secs.toString().padStart(2, '0')}`;
    playlistContainer.classList.add('hidden');
  } else {
    resultMeta.textContent = `Items: ${entries.length}`;
    playlistContainer.classList.remove('hidden');
    renderPlaylistItems(entries);
  }

  renderModes();
  resultSection.classList.remove('hidden');
  configSection.classList.remove('hidden');
}

function renderPlaylistItems(entries) {
  playlistItems.innerHTML = '';
  entries.forEach(entry => {
    const div = document.createElement('div');
    div.className = 'item-row';
    div.innerHTML = `
      <input type="checkbox" id="item-${entry.index}" value="${entry.index}" checked>
      <label for="item-${entry.index}">${entry.index}. ${entry.title}</label>
    `;
    playlistItems.appendChild(div);
    div.querySelector('input').addEventListener('change', updateSelectionCount);
  });
  updateSelectionCount();
}

function updateSelectionCount() {
  const checkboxes = playlistItems.querySelectorAll('input[type="checkbox"]');
  const checked = Array.from(checkboxes).filter(cb => cb.checked).length;
  selectionCount.textContent = `${checked} of ${checkboxes.length} selected`;
}

selectAllBtn.addEventListener('click', () => {
  playlistItems.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
  updateSelectionCount();
});

selectNoneBtn.addEventListener('click', () => {
  playlistItems.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  updateSelectionCount();
});

rangeInput.addEventListener('change', (e) => {
  const rangeStr = e.target.value.trim();
  if (!rangeStr) return;
  
  playlistItems.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  
  const parts = rangeStr.split(',');
  parts.forEach(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) {
        const cb = document.getElementById(`item-${i}`);
        if (cb) cb.checked = true;
      }
    } else {
      const cb = document.getElementById(`item-${part}`);
      if (cb) cb.checked = true;
    }
  });
  updateSelectionCount();
});

let selectedMode = localStorage.getItem('lastMode') || '3';

function renderModes() {
  modeGrid.innerHTML = '';
  MODES.forEach(mode => {
    const div = document.createElement('div');
    div.className = `mode-card ${selectedMode === mode.id ? 'selected' : ''}`;
    div.innerHTML = `
      <h3>${mode.title}</h3>
      <p class="text-sm text-secondary">${mode.desc}</p>
    `;
    div.addEventListener('click', () => {
      document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
      div.classList.add('selected');
      selectedMode = mode.id;
      localStorage.setItem('lastMode', mode.id);
    });
    modeGrid.appendChild(div);
  });
}

// Formats Modal
showFormatsBtn.addEventListener('click', async () => {
  formatsModal.classList.remove('hidden');
  formatsLoader.classList.remove('hidden');
  formatsTable.classList.add('hidden');
  formatsTbody.innerHTML = '';

  try {
    const res = await apiFetch('/api/formats', {
      method: 'POST',
      body: JSON.stringify({ url: urlInput.value.trim() })
    });

    formatsLoader.classList.add('hidden');
    formatsTable.classList.remove('hidden');

    res.formats.forEach(f => {
      const tr = document.createElement('tr');
      tr.className = 'format-row';
      const sizeStr = f.filesize ? (f.filesize / 1024 / 1024).toFixed(1) + ' MB' : (f.filesize_approx ? '~' + (f.filesize_approx / 1024 / 1024).toFixed(1) + ' MB' : 'Unknown');
      tr.innerHTML = `
        <td>${f.format_id}</td>
        <td>${f.ext}</td>
        <td>${f.resolution || 'audio'}</td>
        <td>${f.format_note || ''}</td>
        <td>${sizeStr}</td>
      `;
      tr.addEventListener('click', () => {
        customFormat.value = f.format_id;
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        formatsModal.classList.add('hidden');
      });
      formatsTbody.appendChild(tr);
    });
  } catch (err) {
    formatsLoader.textContent = `Error: ${err.message}`;
  }
});

closeModalBtn.addEventListener('click', () => {
  formatsModal.classList.add('hidden');
});

// Download Job
startDownloadBtn.addEventListener('click', async () => {
  let playlistItemsParam = undefined;
  if (currentAnalyzeResult.kind === 'playlist') {
    const checkboxes = playlistItems.querySelectorAll('input[type="checkbox"]');
    const selected = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
    if (selected.length === 0) {
      alert("Please select at least one item.");
      return;
    }
    if (selected.length < checkboxes.length) {
      playlistItemsParam = selected.join(',');
    }
  }

  const cFormat = customFormat.value.trim();
  const modeToUse = cFormat ? '10' : selectedMode;

  try {
    const res = await apiFetch('/api/jobs', {
      method: 'POST',
      body: JSON.stringify({
        url: urlInput.value.trim(),
        mode: modeToUse,
        customFormat: cFormat,
        playlistItems: playlistItemsParam
      })
    });

    currentJobId = res.jobId;
    startStream();
  } catch (err) {
    showError(err.message || "Failed to start download");
  }
});

function startStream() {
  resultSection.classList.add('hidden');
  configSection.classList.add('hidden');
  downloadSection.classList.remove('hidden');

  progressFill.style.width = '0%';
  progressPercent.textContent = '0%';
  progressSpeed.textContent = '--';
  progressEta.textContent = '--';
  downloadStatus.textContent = 'Initializing...';
  rawLog.textContent = '';

  let url = `${BACKEND_URL}/api/jobs/${currentJobId}/stream`;
  // SSE doesn't support custom headers easily without a polyfill, so if using WORKER_TOKEN, 
  // you might need to send it as a query param. For now, assuming basic usage.
  
  eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    handleStreamEvent(data);
  };

  eventSource.onerror = (err) => {
    console.error("SSE Error", err);
  };
}

function handleStreamEvent(event) {
  if (event.type === 'log') {
    rawLog.textContent += event.line + '\n';
    rawLog.scrollTop = rawLog.scrollHeight;
    if (event.line.includes('Destination:') || event.line.includes('Processing')) {
      downloadStatus.textContent = event.line;
    }
  } else if (event.type === 'progress') {
    if (event.percent !== undefined) {
      progressFill.style.width = `${event.percent}%`;
      progressPercent.textContent = `${event.percent}%`;
    }
    if (event.speed) progressSpeed.textContent = event.speed;
    if (event.eta) progressEta.textContent = event.eta;
  } else if (event.type === 'done') {
    eventSource.close();
    showComplete(event.files);
  } else if (event.type === 'error') {
    eventSource.close();
    downloadStatus.textContent = `Error: ${event.message}`;
    downloadStatus.style.color = 'var(--danger-color)';
    showComplete([]); // Show what we have
  }
}

cancelBtn.addEventListener('click', async () => {
  if (!currentJobId) return;
  try {
    await apiFetch(`/api/jobs/${currentJobId}`, { method: 'DELETE' });
    if (eventSource) eventSource.close();
    downloadStatus.textContent = 'Cancelled.';
    setTimeout(() => resetUI(), 2000);
  } catch (err) {
    alert("Failed to cancel: " + err.message);
  }
});

function showComplete(files) {
  downloadSection.classList.add('hidden');
  completeSection.classList.remove('hidden');

  downloadedFiles.innerHTML = '';
  
  if (files && files.length > 0) {
    completionSummary.textContent = `Successfully downloaded ${files.length} file(s).`;
    completionSummary.style.color = 'var(--success-color)';
    
    files.forEach(file => {
      const div = document.createElement('div');
      div.className = 'item-row';
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      div.innerHTML = `
        <div style="flex:1;">
          <div>${file.name}</div>
          <div class="text-sm text-secondary">${sizeMb} MB</div>
        </div>
        <a href="${BACKEND_URL}${file.downloadUrl}" class="btn small primary" download>Download</a>
      `;
      downloadedFiles.appendChild(div);
    });

    if (files.length > 1) {
      downloadZipBtn.classList.remove('hidden');
      downloadZipBtn.onclick = () => {
        window.location.href = `${BACKEND_URL}/api/jobs/${currentJobId}/zip`;
      };
    } else {
      downloadZipBtn.classList.add('hidden');
    }
  } else {
    completionSummary.textContent = `Download finished, but no files were found. Check the log for errors.`;
    completionSummary.style.color = 'var(--danger-color)';
    downloadZipBtn.classList.add('hidden');
  }
}

newDownloadBtn.addEventListener('click', () => {
  urlInput.value = '';
  resetUI();
});

// Initialize
initTheme();

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('Service Worker registration failed: ', err);
    });
  });
}
