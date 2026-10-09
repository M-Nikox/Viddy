<p align="center">
  <img src="public/viddy-icon.png" width="130" alt="Viddy Logo">
</p>

<h1 align="center">Viddy</h1>

<p align="center">
  <strong>Ultra-lightweight, privacy-first LAN media streaming hub.</strong><br>
  Stream videos, music, and photos to devices on your local network with zero external dependencies.
</p>

<p align="center">
  <a href="https://github.com/M-Nikox/Viddy/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/M-Nikox/Viddy/ci.yml?branch=main&label=CI&style=flat-square" alt="CI Build"></a>
  <a href="https://github.com/M-Nikox/Viddy/releases"><img src="https://img.shields.io/github/v/release/M-Nikox/Viddy?label=release&color=2ea44f&style=flat-square" alt="Release"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-GPL--3.0-blue.svg?style=flat-square" alt="License: GPLv3"></a>
</p>

<p align="center">
  <a href="#overview">Overview</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#portable-mode">Portable Mode</a> &bull;
  <a href="#security-model">Security Model</a> &bull;
  <a href="#supported-formats">Supported Formats</a> &bull;
  <a href="#configuration">Configuration</a> &bull;
  <a href="#credits">Credits</a>
</p>

---

## Overview

Viddy is designed for a single scenario: streaming media stored on a computer or external drive to phones, tablets, or other PCs on the same local network.

It operates without background daemons, databases, user accounts, or external network requests. Point Viddy at a local folder or drive, and files are indexed and streamed directly with native HTTP range seeking.

If you need multi-user permissions, transcoding pipelines, or metadata scraping, Jellyfin or Plex is a better fit. Viddy is built strictly for instant, zero-configuration local playback with no external dependencies.

---

## Features

<table>
  <tr>
    <td width="50%">
      <h3>Zero-Setup Streaming</h3>
      <p>Point Viddy at any folder or drive. Files are indexed asynchronously without blocking active streams, with full HTTP 206 Partial Content range seeking.</p>
    </td>
    <td width="50%">
      <h3>Self-Contained & Private</h3>
      <p>Bundled typography, zero telemetry, zero analytics, and a strict Content Security Policy. Functions normally without internet connectivity.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>Access Control & Shield</h3>
      <p>Salted <b>scrypt</b> password hashing, rate-limited login defense against brute-force attempts, and a network shield that rejects non-private IP requests by default.</p>
    </td>
    <td width="50%">
      <h3>Portable Runtime</h3>
      <p>State files (<code>server_config.json</code>, <code>viddy_library.json</code>) stay strictly inside the application folder. Media drives are read in-place without modifying or copying files.</p>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>QR Device Connection</h3>
      <p>Open <b>Connect Devices</b> in the header to display a local QR code. Scan from a phone or tablet on the same Wi-Fi network to open the web client immediately.</p>
    </td>
    <td width="50%">
      <h3>Low Resource Footprint</h3>
      <p>Single Node.js process with no native compilation requirements, low memory footprint, and negligible CPU usage during streaming.</p>
    </td>
  </tr>
</table>

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org) 20 or newer.

### Installation

```bash
# Clone repository
git clone https://github.com/M-Nikox/Viddy.git
cd Viddy

# Install dependencies
npm install

# Build frontend and start production server
npm run build
npm run start
```

### Initial Run
On first startup without an existing `server_config.json`, Viddy generates an access password and prints it to the console:

```text
==========================================================
[Viddy] v1.0.0 — ultra-lightweight LAN media server
[Viddy] Mode: production (static build)
[Viddy] Local access:  http://localhost:3000
[Viddy] LAN Wi-Fi:     http://192.168.1.120:3000
[Viddy] Local-only traffic shield: ENABLED

  **********************************************************
  *  FIRST RUN — your access password has been generated:  *
  *                                                        *
  *      3f9a2c1b-8d4e7f6a                                 *
  *                                                        *
  *  Save it, then change it in the Server Deck UI.        *
  **********************************************************
==========================================================
```

1. Open `http://localhost:3000` or the reported LAN address.
2. Sign in using the generated password.
3. Open **Server Deck** to set a custom password and select your media directory (e.g. `E:\Media`, `/mnt/storage`, or `./media_storage`).

For development with hot reload:
```bash
npm run dev
```

---

## Portable Mode

Viddy includes launcher scripts to run directly from removable drives or standalone directories without modifying system files:

| Platform | Launcher | Description |
| :--- | :--- | :--- |
| **Windows** | [`run_portable.bat`](run_portable.bat) | Installs dependencies on first run, builds, and launches |
| **Linux / macOS** | [`run_portable.sh`](run_portable.sh) | Shell script launcher with automatic dependency installation |

- No registry keys or system settings modified.
- No files written to AppData or home directory configurations.
- Media folders are read in-place without renaming or file attribute changes.

---

## Connecting Devices

1. Select **Connect Devices** in the navigation header.
2. Scan the displayed QR code with a phone or tablet connected to the same Wi-Fi network.
3. Enter the access password on the device to begin streaming.

---

## Security Model

| Component | Implementation | Notes |
| :--- | :--- | :--- |
| **Authentication** | Scrypt + Session Tokens | 256-bit session tokens (HttpOnly cookie and Bearer authorization). Password hashes generated with salted scrypt and compared in constant time. |
| **Brute-Force Protection** | Rate Limiting | Progressive lockout delays applied per IP address after failed attempts. |
| **Administrative Changes** | Verification | Changing passwords or network shield toggles requires verifying the current password. |
| **Network Shield** | IP Verification | Active by default: drops incoming requests from non-private IP ranges before route processing. |
| **Path Traversal Protection** | Canonical Resolution | File streaming validates canonical paths using `fs.realpathSync` to prevent symlink and relative directory escapes. |
| **HTTP Headers** | Strict CSP | Content Security Policy restricts external scripts, styles, and frames. Includes `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`. |

To reset a forgotten password, stop the server, delete `server_config.json` from the root directory, and restart. A new password will be generated and printed to the terminal.

---

## Supported Formats

Streaming relies on native HTML5 browser playback:

- **Video**: `.mp4`, `.m4v`, `.webm`, `.mkv`, `.mov`, `.avi`  
  *(Container and codec support depends on the client browser; e.g. Safari does not natively support MKV).*
- **Audio**: `.mp3`, `.m4a`, `.wav`, `.flac`, `.aac`, `.ogg`, `.opus`
- **Photos**: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.bmp`

---

## Configuration

Settings can be managed via the Server Deck UI or through environment variables (see [`.env.example`](.env.example)):

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP port for the web server. |
| `MEDIA_DIR` | `./media_storage` | Path to the directory or drive to index and stream. |
| `NODE_ENV` | `development` | Set to `production` when serving compiled static assets. |

### State Files (Git-Ignored)
- `server_config.json` — Password hash, security options, and media folder path.
- `viddy_library.json` — Media index and user tags/favorites.

---

## Project Structure

```
viddy/
├── public/                 # Static assets (icon, badges)
├── src/
│   ├── assets/             # Bundled application assets
│   ├── components/         # React components (playback, library, settings)
│   ├── services/           # API client and IndexedDB offline cache
│   ├── types/              # TypeScript definitions
│   ├── App.tsx             # Root React component
│   └── main.tsx            # Client entry point
├── server.ts               # Express backend (streaming, auth, file scanner)
├── run_portable.bat        # Windows launcher
├── run_portable.sh         # Linux/macOS launcher
├── server_config.json      # Runtime settings (local state)
└── viddy_library.json      # Media index (local state)
```

---

## Contributing

Pull requests and issues are welcome. Contributions should align with the project's goal of remaining lightweight, self-contained, and dependency-minimal. Features requiring external databases, background services, or server-side transcoding are outside the scope of this project.

---

## Credits

- **Author:** [@M-Nikox](https://github.com/M-Nikox)
- **License:** [GNU General Public License v3.0](LICENSE)
- **Icon Credit:** Designed by Nikita Golubev via [Flaticon](https://www.flaticon.com/free-icons/projector)
