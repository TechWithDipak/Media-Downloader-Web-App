# Media Downloader

A clean, interactive, and robust command-line media downloader for macOS (and other Unix-like systems) built using Python. It serves as an interactive wrapper around `yt-dlp` and `FFmpeg` to download videos and audio from YouTube and YouTube Music with high quality.

## Features

- **Interactive CLI Wizard**: Clean menu system without requiring you to remember complicated `yt-dlp` arguments.
- **Resilient**: Fully protected against typos, invalid URLs, missing directories, and permission errors. It will never force you to restart your entire workflow due to a simple mistake.
- **Single Songs & Playlists**: Seamlessly handles single video/song downloads as well as entire playlists.
- **Smart Formats**:
  - High Quality MP3 (VBR quality 0)
  - Best Original Audio (M4A, Opus, etc. without re-encoding)
  - Best Quality MP4 (merging the best available video and audio streams)
  - 4K MP4 Support
- **Custom Location & Config**: Remembers your last used download directory.
- **Zero Python Dependencies**: Written entirely using the Python standard library. No `pip install` required.

## Prerequisites

The application requires `yt-dlp` and `FFmpeg` to be installed on your system.

On macOS, you can easily install them using Homebrew:

```bash
brew install yt-dlp
brew install ffmpeg
```

The script will automatically check for these dependencies on startup.

## Usage

Simply run the script in your terminal:

```bash
python3 media_downloader.py
```

1. **Paste your URL**: Provide a link to a YouTube video, YouTube Music song, or a playlist.
2. **Select Mode**: Choose whether you want to download MP3, MP4, or inspect available formats.
3. **Select Location**: Pick where to save the files (Current Folder, Downloads, Custom, or Last Used).
4. **Confirm**: The script will show you the exact command it plans to run. Press `Y` to start!

## Advanced Features

- **Playlist Item Selection**: For playlists, you can choose to download the entire playlist or manually specify item numbers (e.g., `1,3,5`).
- **Custom Formats**: Select "Custom Format" to inspect all available streams directly from YouTube and choose specific IDs (e.g., `137+140`).
- **Metadata Embedding**: Automatically embeds metadata and thumbnails into MP3 and MP4 files.
- **Graceful Interruption**: Pressing `Ctrl+C` will safely cancel operations without ugly Python tracebacks, giving you the option to retry or return to the main menu.

## Disclaimer

This tool is intended for personal use. Please respect applicable copyright laws and website terms of service when downloading media.
