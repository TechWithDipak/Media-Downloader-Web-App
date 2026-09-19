const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

async function analyzeUrl(url) {
  const { stdout } = await execFileAsync('yt-dlp', ['-J', '--flat-playlist', url]);
  const data = JSON.parse(stdout);
  
  const isPlaylist = 'entries' in data;
  
  if (isPlaylist) {
    const entries = (data.entries || []).map((e, idx) => ({
      index: idx + 1,
      id: e.id,
      title: e.title,
      duration: e.duration,
      thumbnail: e.thumbnails?.[0]?.url || undefined,
    }));
    return {
      kind: 'playlist',
      title: data.title || 'Unknown',
      uploader: data.uploader || 'Unknown',
      entries,
    };
  } else {
    return {
      kind: 'single',
      title: data.title || 'Unknown',
      uploader: data.uploader || 'Unknown',
      duration: data.duration,
      thumbnail: data.thumbnail,
    };
  }
}

async function getFormats(url) {
  const { stdout } = await execFileAsync('yt-dlp', ['-J', url]);
  const data = JSON.parse(stdout);
  const formats = (data.formats || []).map(f => ({
    format_id: f.format_id,
    ext: f.ext,
    resolution: f.resolution,
    fps: f.fps,
    vcodec: f.vcodec,
    acodec: f.acodec,
    filesize: f.filesize,
    filesize_approx: f.filesize_approx,
    format_note: f.format_note,
  }));
  return { formats };
}

function buildDownloadCommand(url, mode, customFormat, playlistItems) {
  const cmd = [
    '--no-overwrites',
    '--continue',
    '--ignore-errors',
    '--newline',
    '--progress-template',
    'download-progress|%(progress._percent_str)s|%(progress._speed_str)s|%(progress._eta_str)s'
  ];

  if (playlistItems) {
    cmd.push('--playlist-items', playlistItems);
  }

  if (mode === '1' || mode === '5') {
    cmd.push('-x', '--audio-format', 'mp3', '--audio-quality', '0', '--embed-metadata', '--embed-thumbnail');
  } else if (mode === '2' || mode === '6') {
    cmd.push('-f', 'ba', '--embed-metadata');
  } else if (mode === '3' || mode === '7') {
    cmd.push('-f', 'bv*+ba/b', '--merge-output-format', 'mp4', '--embed-metadata');
  } else if (mode === '4' || mode === '8') {
    cmd.push('-f', 'bv*[height<=2160]+ba/b[height<=2160]', '--merge-output-format', 'mp4', '--embed-metadata');
  } else if (mode === '10') {
    cmd.push('-f', customFormat || 'best');
  }

  if (playlistItems) {
    cmd.push('-o', '%(playlist_index)02d - %(title)s.%(ext)s');
  } else {
    cmd.push('-o', '%(title)s.%(ext)s');
  }

  cmd.push(url);
  return cmd;
}

module.exports = {
  analyzeUrl,
  getFormats,
  buildDownloadCommand
};
