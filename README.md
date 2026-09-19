# Media Downloader Web App

A browser-based version of the CLI media downloader, built as a decoupled static frontend and a Node.js (Express) backend.

## Project Structure

This is a monorepo containing two separate applications:
1. `frontend/` - A static single-page application built with plain HTML, CSS, and vanilla JS. Requires no build step.
2. `backend/` - A Node.js Express server that acts as a secure wrapper around `yt-dlp` and `ffmpeg`. 

---

## Backend Deployment (Railway or Render)

The backend must be deployed to a service that can install `yt-dlp` and `ffmpeg`. It does not require a Docker container if you use a native buildpack that allows custom apt packages.

### Environment Variables
- `PORT` - The port the server runs on (usually handled by the host).
- `WORKER_TOKEN` - (Optional but recommended) A secret Bearer token required for all API calls.

### Deploying to Render (Native)
1. Connect your repository to Render and create a new **Web Service**.
2. Root Directory: `backend`
3. Environment: `Node`
4. Build Command:
   ```bash
   apt-get update && apt-get install -y ffmpeg python3 && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod a+rx /usr/local/bin/yt-dlp && npm install
   ```
   *(Note: For Render native Node environments, if `apt-get` requires root, you might need to use a Render `render.yaml` with a custom Dockerfile or a pre-built environment. However, many users use a third-party apt buildpack or just use Render's Docker environment if they need `ffmpeg`.)*
5. Start Command: `npm start`
6. Add the `WORKER_TOKEN` environment variable.

### Deploying to Railway
1. Connect your repository and create a new project.
2. Select the `backend` folder.
3. Railway uses Nixpacks by default. To install `yt-dlp` and `ffmpeg`, add a `nixpacks.toml` file to your `backend` directory with the following content:
   ```toml
   [phases.setup]
   nixPkgs = ["...", "ffmpeg", "yt-dlp"]
   ```
4. Run `npm start`. Set the `WORKER_TOKEN` in the Railway variables.

---

## Frontend Deployment (Vercel, Netlify, GitHub Pages)

The frontend is just static files. You can deploy it to any static host.

### Configuration
Before deploying, open `frontend/app.js` and set the `BACKEND_URL` to the URL of your deployed backend (e.g., `https://my-backend.up.railway.app`). If you set a `WORKER_TOKEN` on the backend, add it to the `WORKER_TOKEN` variable in `app.js`.

### Deploying to Vercel
1. Create a new project in Vercel.
2. Select the repository.
3. Set the **Root Directory** to `frontend`.
4. Framework Preset: `Other`
5. Click **Deploy**.

---

## Disclaimer

This application is a wrapper around `yt-dlp`. By deploying and using this software, you are solely responsible for ensuring you have the legal right to download and store the media you are accessing. This software is provided for personal archiving and educational purposes only.
