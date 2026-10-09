import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import qrcode from 'qrcode';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VERSION = '1.0.0';

const app = express();
app.disable('x-powered-by'); // don't advertise the stack
const PORT = parseInt(process.env.PORT || '3000', 10);
// Production mode is explicit: `npm run start` passes --production, or NODE_ENV is set.
// The Vite dev middleware is only mounted in development mode.
const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--production');

// Media storage folder configuration
const DEFAULT_STORAGE_DIR = path.resolve(__dirname, 'media_storage');
const CONFIG_FILE = path.resolve(__dirname, 'server_config.json');

// Allowed media extensions — the ONLY file types that can be indexed, uploaded, or streamed.
const MEDIA_EXTENSIONS: Record<string, { type: 'video' | 'audio' | 'photo'; mimeType: string }> = {
  '.mp4': { type: 'video', mimeType: 'video/mp4' },
  '.m4v': { type: 'video', mimeType: 'video/mp4' },
  '.webm': { type: 'video', mimeType: 'video/webm' },
  '.mkv': { type: 'video', mimeType: 'video/x-matroska' },
  '.mov': { type: 'video', mimeType: 'video/quicktime' },
  '.avi': { type: 'video', mimeType: 'video/x-msvideo' },
  '.mp3': { type: 'audio', mimeType: 'audio/mpeg' },
  '.m4a': { type: 'audio', mimeType: 'audio/mp4' },
  '.wav': { type: 'audio', mimeType: 'audio/wav' },
  '.flac': { type: 'audio', mimeType: 'audio/flac' },
  '.aac': { type: 'audio', mimeType: 'audio/aac' },
  '.ogg': { type: 'audio', mimeType: 'audio/ogg' },
  '.opus': { type: 'audio', mimeType: 'audio/opus' },
  '.jpg': { type: 'photo', mimeType: 'image/jpeg' },
  '.jpeg': { type: 'photo', mimeType: 'image/jpeg' },
  '.png': { type: 'photo', mimeType: 'image/png' },
  '.webp': { type: 'photo', mimeType: 'image/webp' },
  '.gif': { type: 'photo', mimeType: 'image/gif' },
  '.bmp': { type: 'photo', mimeType: 'image/bmp' },
};

interface StoredConfig {
  mediaStoragePath?: string;
  requirePassword?: boolean;
  passwordHash?: string; // scrypt format: scrypt$N$r$p$saltHex$hashHex
  localOnly?: boolean;
  serverName?: string;
}

function loadStoredConfig(): StoredConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (parsed && typeof parsed === 'object') return parsed as StoredConfig;
    }
  } catch {
    // Corrupted config is treated as absent; a fresh one will be written.
  }
  return {};
}

function saveStoredConfig(conf: StoredConfig): void {
  try {
    // Atomic write (temp file + rename) so a crash mid-write can't corrupt the config.
    const tmp = `${CONFIG_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(conf, null, 2), 'utf-8');
    fs.renameSync(tmp, CONFIG_FILE);
  } catch (e) {
    console.error('[Viddy] Failed to write server_config.json:', e);
  }
}

const storedConfig = loadStoredConfig();
let activeMediaDir = storedConfig.mediaStoragePath || process.env.MEDIA_DIR || DEFAULT_STORAGE_DIR;

// Ensure default directory exists if using default
if (activeMediaDir === DEFAULT_STORAGE_DIR && !fs.existsSync(DEFAULT_STORAGE_DIR)) {
  fs.mkdirSync(DEFAULT_STORAGE_DIR, { recursive: true });
}


// 100% Portable Mode: Store manifest strictly inside Viddy's own folder
// This guarantees the media drive is accessed READ-ONLY and zero clutter is created outside this folder
const PORTABLE_MANIFEST_PATH = path.resolve(__dirname, 'viddy_library.json');

export interface ServerMediaItem {
  id: string;
  title: string;
  type: 'video' | 'audio' | 'photo';
  mimeType: string;
  size: number;
  dateAdded: string;
  streamUrl: string;
  thumbnailUrl?: string;
  localPath: string; // relative to activeMediaDir or filename
  absolutePath: string; // direct path on the host
  tags: string[];
  duration?: number;
  resolution?: string;
  bitrate?: string;
  isFavorite?: boolean;
}

// Containment check: the resolved real path must be inside the resolved
// media root (symlinks resolved via realpathSync, so symlink escapes fail).
function isPathInsideMediaRoot(candidate: string): boolean {
  try {
    const realRoot = fs.realpathSync(path.resolve(activeMediaDir));
    const realCandidate = fs.realpathSync(candidate);
    const rel = path.relative(realRoot, realCandidate);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
  } catch {
    return false;
  }
}

function loadManifest(): ServerMediaItem[] {
  try {
    if (fs.existsSync(PORTABLE_MANIFEST_PATH)) {
      const items: ServerMediaItem[] = JSON.parse(fs.readFileSync(PORTABLE_MANIFEST_PATH, 'utf-8'));
      // Only keep items that exist on disk AND belong to the current activeMediaDir
      return items.filter((item) => {
        const fullPath = item.absolutePath || path.resolve(activeMediaDir, item.localPath);
        return fs.existsSync(fullPath) && isPathInsideMediaRoot(fullPath);
      });
    }
  } catch (err) {
    console.error('[Viddy] Failed to read manifest:', err);
  }
  return [];
}

function saveManifest(items: ServerMediaItem[]): void {
  try {
    const tmp = `${PORTABLE_MANIFEST_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf-8');
    fs.renameSync(tmp, PORTABLE_MANIFEST_PATH);
  } catch (err) {
    console.error('[Viddy] Failed to save manifest to disk:', err);
  }
}

// Recursive scanner for the media folder. Uses async fs calls so a large library
// never blocks the event loop (and therefore never stalls active streams).
async function scanDirectoryRecursively(
  dirPath: string,
  basePath: string,
  depth: number = 0,
  maxDepth: number = 4
): Promise<Array<{ fullPath: string; relPath: string; size: number; birthtime: Date }>> {
  if (depth > maxDepth) return [];
  const results: Array<{ fullPath: string; relPath: string; size: number; birthtime: Date }> = [];

  try {
    const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (
        entry.name.startsWith('.') ||
        entry.name === '$RECYCLE.BIN' ||
        entry.name === 'System Volume Information' ||
        entry.name === 'node_modules' ||
        entry.name === path.basename(PORTABLE_MANIFEST_PATH) ||
        entry.name === path.basename(CONFIG_FILE)
      ) {
        continue;
      }
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        results.push(...(await scanDirectoryRecursively(full, basePath, depth + 1, maxDepth)));
      } else if (entry.isFile()) {
        try {
          const stat = await fs.promises.stat(full);
          const rel = path.relative(basePath, full);
          results.push({ fullPath: full, relPath: rel, size: stat.size, birthtime: stat.birthtime });
        } catch {
          // File vanished mid-scan or unreadable — skip it.
        }
      }
    }
  } catch (e) {
    console.warn(`[Viddy] Scan warning for ${dirPath}:`, e);
  }

  return results;
}

// In-memory cache for media items to eliminate repeated disk scans
let cachedMediaItems: ServerMediaItem[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 30000; // 30 seconds

function invalidateMediaCache() {
  cachedMediaItems = null;
  lastCacheTime = 0;
}

// Automatically detect any media files in activeMediaDir without copying them
async function getPersistentMediaItems(forceRefresh = false): Promise<ServerMediaItem[]> {
  const now = Date.now();
  if (!forceRefresh && cachedMediaItems && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedMediaItems;
  }

  const currentItems = loadManifest();

  try {
    if (fs.existsSync(activeMediaDir)) {
      const files = await scanDirectoryRecursively(activeMediaDir, activeMediaDir);
      let changed = false;

      // Prune items that no longer exist on disk in the current activeMediaDir
      const diskPathSet = new Set(files.map((f) => f.fullPath));
      const remainingItems = currentItems.filter((item) => {
        const fullPath = item.absolutePath || path.resolve(activeMediaDir, item.localPath);
        return diskPathSet.has(fullPath);
      });
      if (remainingItems.length !== currentItems.length) {
        currentItems.length = 0;
        currentItems.push(...remainingItems);
        changed = true;
      }

      const existingAbsPaths = new Set(
        currentItems.map((i) => i.absolutePath || path.resolve(activeMediaDir, i.localPath))
      );

      for (const { fullPath, relPath, size, birthtime } of files) {
        if (existingAbsPaths.has(fullPath)) continue;

        const ext = path.extname(fullPath).toLowerCase();
        const mediaInfo = MEDIA_EXTENSIONS[ext];
        if (!mediaInfo) continue; // Only known media types are indexed

        // Unique URL-safe token/id for this media file
        const fileId = `drive-${crypto.createHash('md5').update(fullPath).digest('hex').substring(0, 12)}`;

        currentItems.unshift({
          id: fileId,
          title: path.parse(fullPath).name,
          type: mediaInfo.type,
          mimeType: mediaInfo.mimeType,
          size,
          dateAdded: birthtime ? birthtime.toISOString() : new Date().toISOString(),
          streamUrl: `/api/media/stream/${fileId}`,
          thumbnailUrl: mediaInfo.type === 'photo' ? `/api/media/stream/${fileId}` : undefined,
          localPath: relPath,
          absolutePath: fullPath,
          tags: [
            path.dirname(relPath) !== '.' ? path.dirname(relPath) : 'Library Root',
            mediaInfo.type.toUpperCase(),
          ],
          isFavorite: false,
        });
        changed = true;
      }

      if (changed) {
        saveManifest(currentItems);
      }
    }
  } catch (err) {
    console.warn('[Viddy] Media scan notice:', err);
  }

  cachedMediaItems = currentItems;
  lastCacheTime = now;
  return currentItems;
}

// ---------------------------------------------------------------------------
// Security & Auth
// ---------------------------------------------------------------------------

interface ServerConfig {
  requirePassword: boolean;
  passwordHash: string;
  serverName: string;
  localOnly: boolean;
}

// Password hashing: scrypt with a per-password random salt.
// A single fast hash like SHA-256 is trivially brute-forceable; scrypt is
// memory-hard and ships with Node's crypto module (zero new dependencies).
function hashPassword(pass: string): string {
  const salt = crypto.randomBytes(16);
  const N = 16384,
    r = 8,
    p = 1;
  const hash = crypto.scryptSync(pass, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(pass: string, stored: string): boolean {
  try {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [, N, r, p, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(pass, salt, expected.length, {
      N: parseInt(N, 10),
      r: parseInt(r, 10),
      p: parseInt(p, 10),
    });
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// First run: no stored password exists yet. Generate a strong random one and
// print it to the console so the owner can connect, then change it in the UI.
function generateFirstRunPassword(): string {
  const bytes = crypto.randomBytes(6);
  const groups = [bytes.subarray(0, 3).toString('hex'), bytes.subarray(3, 6).toString('hex')];
  return groups.join('-');
}

let firstRunPasswordGenerated: string | null = null;

const initialConfig = loadStoredConfig();
let serverConfig: ServerConfig = {
  requirePassword: initialConfig.requirePassword ?? true,
  passwordHash: initialConfig.passwordHash || '',
  serverName: initialConfig.serverName || 'Viddy Host',
  localOnly: initialConfig.localOnly ?? true,
};

if (!serverConfig.passwordHash) {
  firstRunPasswordGenerated = generateFirstRunPassword();
  serverConfig.passwordHash = hashPassword(firstRunPasswordGenerated);
  saveStoredConfig({
    ...initialConfig,
    passwordHash: serverConfig.passwordHash,
    requirePassword: serverConfig.requirePassword,
    localOnly: serverConfig.localOnly,
    serverName: serverConfig.serverName,
  });
}

function persistSecurityConfig() {
  saveStoredConfig({
    ...loadStoredConfig(),
    passwordHash: serverConfig.passwordHash,
    requirePassword: serverConfig.requirePassword,
    localOnly: serverConfig.localOnly,
    serverName: serverConfig.serverName,
  });
}

// Active authenticated sessions: token -> { ip, userAgent, createdAt, lastActive }
interface ClientSession {
  id: string;
  token: string;
  ip: string;
  userAgent: string;
  createdAt: number;
  lastActive: number;
  activeStream?: string;
}

const activeSessions = new Map<string, ClientSession>();
const MAX_SESSIONS = 200; // Hard cap so a hostile LAN client cannot exhaust memory
let activeStreamSockets = 0;

// Evict sessions idle for more than 24 hours. Runs on its own timer so
// cleanup happens even when nobody has the dashboard open.
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessionSweeper = setInterval(() => {
  const cutoff = Date.now() - SESSION_TTL_MS;
  for (const [token, session] of activeSessions.entries()) {
    if (session.lastActive < cutoff) activeSessions.delete(token);
  }
}, 60 * 60 * 1000);
sessionSweeper.unref();

// Multer storage for uploaded local files.
// Filenames are server-generated (timestamp + random); only whitelisted
// media extensions are accepted, so no attacker-controlled name or type
// ever reaches the filesystem.
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      try {
        if (!fs.existsSync(activeMediaDir)) {
          fs.mkdirSync(activeMediaDir, { recursive: true });
        }
        cb(null, activeMediaDir);
      } catch (err) {
        cb(err as Error, activeMediaDir);
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeExt = MEDIA_EXTENSIONS[ext] ? ext : '';
      const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
      cb(null, `${uniqueSuffix}${safeExt}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB max per file
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!MEDIA_EXTENSIONS[ext]) {
      cb(new Error(`Unsupported file type "${ext || 'unknown'}". Only media files can be uploaded.`));
      return;
    }
    cb(null, true);
  },
});

// Parse JSON bodies with a sane explicit limit
app.use(express.json({ limit: '256kb' }));

// Security headers. CSP is strict in production (self-hosted everything,
// no external origins) and relaxed only for the Vite dev server.
app.use((_req: Request, res: Response, next: NextFunction) => {
  if (isProd) {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob: data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'"
    );
  } else {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src 'self' data: blob: ws:; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'"
    );
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Helper to get local network IPv4 addresses
function getLocalIps(): string[] {
  const interfaces = os.networkInterfaces();
  const ips: string[] = [];
  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name];
    if (!list) continue;
    for (const info of list) {
      if (info.family === 'IPv4' && !info.internal) {
        ips.push(info.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

// Is this IP private / loopback / link-local? Used by the local-only shield.
function isPrivateIp(rawIp: string): boolean {
  let ip = rawIp;
  if (ip.startsWith('::ffff:')) ip = ip.slice(7); // IPv4-mapped IPv6
  if (ip === '::1' || ip === 'fe80::1' || ip === '::') return true;
  if (ip.startsWith('fe80:') || ip.startsWith('fc') || ip.startsWith('fd')) return true; // link-local / ULA
  const parts = ip.split('.').map((n) => parseInt(n, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;
  const [a, b] = parts;
  if (a === 127 || a === 10) return true; // loopback, 10/8
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 169 && b === 254) return true; // link-local
  return false;
}

function clientIpOf(req: Request): string {
  return String(req.socket.remoteAddress || req.ip || '127.0.0.1');
}

// Local-Only Traffic Shield: when enabled (default), requests that do not
// originate from a private/loopback interface are dropped before any route
// logic runs. This makes the "Local Traffic Only" toggle a real control,
// not a cosmetic one.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (serverConfig.localOnly && !isPrivateIp(clientIpOf(req))) {
    res.status(403).json({ error: 'Forbidden: server is in local-network-only mode' });
    return;
  }
  next();
});

function extractToken(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^Bearer\s+/i, '');
  }
  if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)viddy_token=([^;]+)/);
    if (match) return match[1];
  }
  return undefined;
}

// Authentication verification middleware (Bearer header or session cookie).
// Query-string tokens are deliberately NOT accepted: they leak into browser
// history, server logs, and referrer headers.
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!serverConfig.requirePassword) {
    return next();
  }

  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized: Password authentication required' });
    return;
  }

  const session = activeSessions.get(token);
  if (!session) {
    res.status(401).json({ error: 'Session expired or invalid' });
    return;
  }

  session.lastActive = Date.now();
  next();
}

// Optional auth: returns the active session (or null) without rejecting.
// Used by /api/status so unauthenticated callers get a minimal payload.
function optionalAuth(req: Request): ClientSession | null {
  if (!serverConfig.requirePassword) {
    return { id: 'open-mode', token: '', ip: '', userAgent: '', createdAt: 0, lastActive: 0 };
  }
  const token = extractToken(req);
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;
  session.lastActive = Date.now();
  return session;
}

// CPU usage sampler: computes real load from os.cpus() deltas.
let lastCpuSample = { time: process.hrtime.bigint(), cpus: os.cpus() };
function getCpuUsagePercent(): number {
  const now = process.hrtime.bigint();
  const current = os.cpus();
  let idleDelta = 0;
  let totalDelta = 0;
  const prev = lastCpuSample.cpus;
  for (let i = 0; i < Math.min(current.length, prev.length); i++) {
    const prevIdle = prev[i].times.idle;
    const curIdle = current[i].times.idle;
    const prevTotal =
      prev[i].times.user + prev[i].times.nice + prev[i].times.sys + prev[i].times.idle + prev[i].times.irq;
    const curTotal =
      current[i].times.user +
      current[i].times.nice +
      current[i].times.sys +
      current[i].times.idle +
      current[i].times.irq;
    idleDelta += curIdle - prevIdle;
    totalDelta += curTotal - prevTotal;
  }
  lastCpuSample = { time: now, cpus: current };
  if (totalDelta <= 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
}

// QR codes are static per URL — generate once and cache.
let qrCache: { url: string; dataUrl: string } | null = null;
async function getQrDataUrl(url: string): Promise<string> {
  if (qrCache && qrCache.url === url) return qrCache.dataUrl;
  try {
    const dataUrl = await qrcode.toDataURL(url, {
      margin: 1,
      width: 280,
      color: { dark: '#000000', light: '#ffffff' },
    });
    qrCache = { url, dataUrl };
    return dataUrl;
  } catch {
    return '';
  }
}

// API: System & LAN Status
// Unauthenticated callers receive only the minimal fields the lock screen
// needs. Network topology, memory, and QR codes require a session.
app.get('/api/status', async (req: Request, res: Response) => {
  const session = optionalAuth(req);

  const minimal = {
    running: true as const,
    isPasswordProtected: serverConfig.requirePassword,
    localTrafficOnly: serverConfig.localOnly,
    serverName: serverConfig.serverName,
    serverVersion: VERSION,
  };

  if (!session) {
    res.json(minimal);
    return;
  }

  const localIps = getLocalIps();
  const primaryIp = localIps[0] || '127.0.0.1';
  const mem = process.memoryUsage();
  const lanUrl = `http://${primaryIp}:${PORT}`;

  res.json({
    ...minimal,
    port: PORT,
    hostIps: localIps,
    primaryIp,
    lanUrl,
    qrCodeData: await getQrDataUrl(lanUrl),
    memoryMb: {
      rss: Math.round((mem.rss / 1024 / 1024) * 10) / 10,
      heapUsed: Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10,
      heapTotal: Math.round((mem.heapTotal / 1024 / 1024) * 10) / 10,
    },
    cpuUsagePercent: getCpuUsagePercent(),
    uptimeSeconds: Math.floor(process.uptime()),
    activeStreams: activeStreamSockets,
    activeSessions: activeSessions.size,
  });
});

// Rate limiting map for brute-force defense
const failedLoginTracker = new Map<string, { count: number; lockedUntil: number; firstFail: number }>();

function pruneLoginTracker(now: number) {
  for (const [ip, entry] of failedLoginTracker.entries()) {
    if (entry.lockedUntil < now && now - entry.firstFail > 10 * 60 * 1000) {
      failedLoginTracker.delete(ip);
    }
  }
}

// API: Auth - Login
app.post('/api/auth/login', (req: Request, res: Response) => {
  const { password } = req.body || {};
  const clientIp = clientIpOf(req);
  const userAgent = String(req.headers['user-agent'] || 'Unknown Device');
  const now = Date.now();

  pruneLoginTracker(now);
  const rateLimit = failedLoginTracker.get(clientIp);
  if (rateLimit && rateLimit.lockedUntil > now) {
    const waitSeconds = Math.ceil((rateLimit.lockedUntil - now) / 1000);
    res.status(429).json({ error: `Too many failed login attempts. Please wait ${waitSeconds}s.` });
    return;
  }

  if (typeof password !== 'string') {
    res.status(400).json({ error: 'Password is required' });
    return;
  }

  const issueSession = () => {
    // Evict oldest sessions if the hard cap is reached
    if (activeSessions.size >= MAX_SESSIONS) {
      let oldestToken: string | null = null;
      let oldestTime = Infinity;
      for (const [t, s] of activeSessions.entries()) {
        if (s.lastActive < oldestTime) {
          oldestTime = s.lastActive;
          oldestToken = t;
        }
      }
      if (oldestToken) activeSessions.delete(oldestToken);
    }

    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      id: crypto.randomUUID(),
      token,
      ip: clientIp,
      userAgent,
      createdAt: now,
      lastActive: now,
    });
    res.setHeader(
      'Set-Cookie',
      `viddy_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
    );
    res.json({ success: true, token, isPasswordProtected: serverConfig.requirePassword });
  };

  if (!serverConfig.requirePassword) {
    issueSession();
    return;
  }

  if (!verifyPassword(password, serverConfig.passwordHash)) {
    const currentFails = (rateLimit?.count || 0) + 1;
    // 15s lockout after 5 failures, growing to 5 minutes if attempts continue
    const lockMs = currentFails >= 10 ? 5 * 60 * 1000 : currentFails >= 5 ? 15000 : 0;
    failedLoginTracker.set(clientIp, {
      count: currentFails,
      lockedUntil: lockMs ? now + lockMs : 0,
      firstFail: rateLimit?.firstFail || now,
    });
    res.status(401).json({ error: 'Incorrect password' });
    return;
  }

  failedLoginTracker.delete(clientIp);
  issueSession();
});

// API: Auth - Logout (invalidates the calling session)
app.post('/api/auth/logout', (req: Request, res: Response) => {
  const token = extractToken(req);
  if (token) activeSessions.delete(token);
  res.setHeader('Set-Cookie', 'viddy_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ success: true });
});

// API: Auth - Verify Token
app.get('/api/auth/verify', (req: Request, res: Response) => {
  if (!serverConfig.requirePassword) {
    res.json({ valid: true });
    return;
  }
  const token = extractToken(req);
  if (token && activeSessions.has(token)) {
    res.json({ valid: true });
    return;
  }
  res.status(401).json({ valid: false });
});

// API: Auth - Update Password & Settings
// Changing ANY security-sensitive setting requires the current password,
// so a connected guest device cannot lock out the owner or silently open
// the server to the network.
app.post('/api/auth/update', requireAuth, (req: Request, res: Response) => {
  const { currentPassword, newPassword, requirePassword, localOnly } = req.body || {};

  if (serverConfig.requirePassword) {
    if (typeof currentPassword !== 'string' || !verifyPassword(currentPassword, serverConfig.passwordHash)) {
      res.status(403).json({ error: 'Current password is required to change security settings' });
      return;
    }
  }

  if (newPassword !== undefined) {
    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters long' });
      return;
    }
    serverConfig.passwordHash = hashPassword(newPassword);
    // Invalidate every session except the caller's own
    const callerToken = extractToken(req);
    for (const token of activeSessions.keys()) {
      if (token !== callerToken) activeSessions.delete(token);
    }
  }

  if (typeof requirePassword === 'boolean') {
    serverConfig.requirePassword = requirePassword;
  }

  if (typeof localOnly === 'boolean') {
    serverConfig.localOnly = localOnly;
    if (!localOnly) {
      console.warn(
        '[Viddy] WARNING: Local-only traffic shield DISABLED. The server will now accept connections from any interface it is bound to.'
      );
    }
  }

  persistSecurityConfig();
  res.json({ success: true, message: 'Security settings updated successfully' });
});

// API: Connected Clients List
app.get('/api/clients', requireAuth, (_req: Request, res: Response) => {
  const clients = Array.from(activeSessions.values()).map((s) => {
    let deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' = 'unknown';
    const ua = s.userAgent.toLowerCase();
    if (ua.includes('ipad') || ua.includes('tablet')) {
      deviceType = 'tablet';
    } else if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      deviceType = 'mobile';
    } else {
      deviceType = 'desktop';
    }

    return {
      id: s.id,
      ip: s.ip.replace('::ffff:', ''),
      userAgent: s.userAgent,
      connectedAt: new Date(s.createdAt).toISOString(),
      lastActiveAt: new Date(s.lastActive).toISOString(),
      activeStream: s.activeStream,
      deviceType,
    };
  });

  res.json(clients);
});

// API: Get All Persistent Media Files
app.get('/api/media', requireAuth, async (_req: Request, res: Response) => {
  const items = await getPersistentMediaItems();
  res.json(items);
});

// API: Upload Media File (Saves to disk & updates manifest)
// NOTE: requireAuth runs BEFORE multer, so unauthenticated requests are
// rejected before any bytes are written to disk.
app.post('/api/media/upload', requireAuth, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file received' });
    return;
  }

  const { originalname, filename, size } = req.file;
  const ext = path.extname(filename).toLowerCase();
  const mediaInfo = MEDIA_EXTENSIONS[ext];

  if (!mediaInfo) {
    // Defense in depth: multer's fileFilter already blocks non-media types.
    if (req.file.path) fs.unlink(req.file.path, () => {});
    res.status(400).json({ error: 'Unsupported file type' });
    return;
  }

  const fullPath = path.resolve(activeMediaDir, filename);
  const newItem: ServerMediaItem = {
    id: `local-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    title: path.parse(originalname).name,
    type: mediaInfo.type,
    mimeType: mediaInfo.mimeType,
    size,
    dateAdded: new Date().toISOString(),
    streamUrl: `/api/media/stream/${filename}`,
    thumbnailUrl: mediaInfo.type === 'photo' ? `/api/media/stream/${filename}` : undefined,
    localPath: filename,
    absolutePath: fullPath,
    tags: ['Uploaded', mediaInfo.type.toUpperCase()],
    isFavorite: false,
  };

  const currentItems = loadManifest();
  currentItems.unshift(newItem);
  saveManifest(currentItems);
  invalidateMediaCache();

  res.json({ success: true, item: newItem });
});

// Multer errors (bad file type, size limit) arrive here — return clean 400s.
app.use('/api/media/upload', (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({ error: err.message || 'Upload failed' });
});

// API: Delete Media Item (Removes from manifest & unlinks from disk)
app.delete('/api/media/:id', requireAuth, (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = typeof rawId === 'string' ? rawId : '';
  if (!id) {
    res.status(400).json({ error: 'Valid media ID is required' });
    return;
  }

  const currentItems = loadManifest();
  const index = currentItems.findIndex((i) => i.id === id);

  if (index !== -1) {
    const item = currentItems[index];
    const fullPath = item.absolutePath || (item.localPath ? path.resolve(activeMediaDir, item.localPath) : null);
    if (fullPath && fs.existsSync(fullPath)) {
      // Security containment check: refuse to delete anything outside the active media directory
      if (!isPathInsideMediaRoot(fullPath)) {
        res.status(403).json({ error: 'Access denied: Cannot delete file outside authorized media directory' });
        return;
      }

      try {
        fs.unlinkSync(fullPath);
      } catch (e) {
        console.error('[Viddy] Failed to unlink file:', e);
        res.status(500).json({ error: 'Failed to delete file from disk. Check file permissions.' });
        return;
      }
    }
    currentItems.splice(index, 1);
    saveManifest(currentItems);
    invalidateMediaCache();
    res.json({ success: true, message: 'Item deleted permanently from disk' });
    return;
  }

  res.status(404).json({ error: 'Item not found' });
});

// API: Update Media Metadata
app.patch('/api/media/:id', requireAuth, (req: Request, res: Response) => {
  const rawId = req.params.id;
  const id = typeof rawId === 'string' ? rawId : '';
  if (!id) {
    res.status(400).json({ error: 'Valid media ID is required' });
    return;
  }

  const { title, isFavorite, tags } = req.body || {};
  const currentItems = loadManifest();
  const item = currentItems.find((i) => i.id === id);

  if (item) {
    if (typeof title === 'string' && title.trim()) item.title = title.trim();
    if (typeof isFavorite === 'boolean') item.isFavorite = isFavorite;
    if (Array.isArray(tags) && tags.every((t: unknown) => typeof t === 'string')) item.tags = tags;

    saveManifest(currentItems);
    invalidateMediaCache();
    res.json({ success: true, item });
    return;
  }

  res.status(404).json({ error: 'Item not found' });
});

// API: Storage Drive / Folder Configuration & Portability Report
app.get('/api/storage/config', requireAuth, async (_req: Request, res: Response) => {
  const items = await getPersistentMediaItems();
  res.json({
    activeMediaDir,
    defaultDir: DEFAULT_STORAGE_DIR,
    isCustomDrive: activeMediaDir !== DEFAULT_STORAGE_DIR,
    totalFilesIndexed: items.length,
    exists: fs.existsSync(activeMediaDir),
    portability: {
      isPortable: true,
      appDirectory: __dirname,
      configPath: CONFIG_FILE,
      manifestPath: PORTABLE_MANIFEST_PATH,
      systemClutterBytes: 0,
      registryTouched: false,
      appDataUsed: false,
      driveWriteMode: 'Read-Only (media on the storage drive is never modified)',
    },
  });
});

app.post('/api/storage/config', requireAuth, async (req: Request, res: Response) => {
  const { path: newPath } = req.body || {};
  if (!newPath || typeof newPath !== 'string') {
    res.status(400).json({ error: 'Valid directory path is required' });
    return;
  }

  // Strip surrounding quotes if copied from Windows 'Copy as path'
  const cleanPath = newPath.trim().replace(/^["']|["']$/g, '').trim();
  const resolved = path.resolve(cleanPath);

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved);
  } catch {
    res.status(400).json({
      error: `Directory does not exist or is inaccessible: "${cleanPath}". Verify the drive letter and folder path.`,
    });
    return;
  }
  if (!stat.isDirectory()) {
    res.status(400).json({ error: `Path is not a directory: "${cleanPath}".` });
    return;
  }

  activeMediaDir = resolved;
  saveStoredConfig({
    ...loadStoredConfig(),
    mediaStoragePath: activeMediaDir,
  });

  invalidateMediaCache();
  const items = await getPersistentMediaItems(true);
  res.json({
    success: true,
    activeMediaDir,
    totalFilesIndexed: items.length,
    message: `Switched media storage to ${activeMediaDir}. Indexed ${items.length} files.`,
  });
});

app.post('/api/storage/rescan', requireAuth, async (_req: Request, res: Response) => {
  invalidateMediaCache();
  const items = await getPersistentMediaItems(true);
  res.json({
    success: true,
    activeMediaDir,
    totalFilesIndexed: items.length,
  });
});

app.post('/api/storage/clear-index', requireAuth, async (_req: Request, res: Response) => {
  saveManifest([]);
  invalidateMediaCache();
  cachedMediaItems = [];
  lastCacheTime = Date.now();
  res.json({
    success: true,
    activeMediaDir,
    totalFilesIndexed: 0,
    message: 'Media index cleared successfully.',
  });
});

// ---------------------------------------------------------------------------
// Streaming with HTTP 206 Partial Content support
// ---------------------------------------------------------------------------

// Strict single-range parser. Returns 'full' for malformed headers (ignored
// per RFC 9110 — serve the whole file), 'unsatisfiable' for ranges beyond
// EOF (416), or a validated { start, end }.
function parseRange(rangeHeader: string, fileSize: number): 'full' | 'unsatisfiable' | { start: number; end: number } {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return 'full';
  const [, rawStart, rawEnd] = match;

  // Suffix range: "bytes=-N" (last N bytes)
  if (rawStart === '') {
    if (rawEnd === '') return 'full';
    const suffix = parseInt(rawEnd, 10);
    if (Number.isNaN(suffix) || suffix <= 0) return 'unsatisfiable';
    if (fileSize === 0) return 'unsatisfiable';
    return { start: Math.max(0, fileSize - suffix), end: fileSize - 1 };
  }

  const start = parseInt(rawStart, 10);
  if (Number.isNaN(start) || start < 0) return 'full';
  if (start >= fileSize) return 'unsatisfiable';

  const end = rawEnd === '' ? fileSize - 1 : parseInt(rawEnd, 10);
  if (Number.isNaN(end) || end < start) return 'full';

  return { start, end: Math.min(end, fileSize - 1) };
}


app.get('/api/media/stream/:fileId', requireAuth, async (req: Request, res: Response) => {
  const rawFileId = req.params.fileId;
  const fileId = typeof rawFileId === 'string' ? rawFileId : '';

  // Defensive validation against path traversal
  if (!fileId || fileId.includes('..') || fileId.includes('/') || fileId.includes('\\') || fileId.includes('\0')) {
    res.status(400).json({ error: 'Invalid file parameter' });
    return;
  }

  const items = await getPersistentMediaItems();
  const item = items.find(
    (i) => i.id === fileId || i.localPath === fileId || path.basename(i.localPath) === fileId
  );

  let filePath = '';
  if (item && item.absolutePath && fs.existsSync(item.absolutePath)) {
    filePath = item.absolutePath;
  } else if (item && item.localPath && fs.existsSync(path.resolve(activeMediaDir, item.localPath))) {
    filePath = path.resolve(activeMediaDir, item.localPath);
  } else if (fs.existsSync(path.resolve(activeMediaDir, fileId))) {
    filePath = path.resolve(activeMediaDir, fileId);
  }

  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Media file not found on disk' });
    return;
  }

  // Only stream known media types (checked against the RESOLVED path — the
  // URL token itself may be a hash id with no extension).
  const ext = path.extname(filePath).toLowerCase();
  const mediaInfo = MEDIA_EXTENSIONS[ext];
  if (!mediaInfo) {
    res.status(400).json({ error: 'Invalid media type' });
    return;
  }

  if (!isPathInsideMediaRoot(filePath)) {
    res.status(403).json({ error: 'Access denied: Path outside authorized media directory' });
    return;
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const rangeHeader = req.headers.range;

  // Count the stream once; decrement exactly once when the response closes.
  activeStreamSockets++;
  let streamCounted = true;
  res.on('close', () => {
    if (streamCounted) {
      activeStreamSockets = Math.max(0, activeStreamSockets - 1);
      streamCounted = false;
    }
  });

  const sendFile = (statusCode: number, headers: Record<string, string | number>, start?: number, end?: number) => {
    const file = fs.createReadStream(filePath, start !== undefined ? { start, end } : {});
    file.on('error', () => {
      file.destroy();
      if (!res.headersSent) res.status(500).end();
    });
    res.on('close', () => {
      file.destroy();
    });
    res.writeHead(statusCode, headers);
    file.pipe(res);
  };

  if (rangeHeader) {
    const parsed = parseRange(rangeHeader, fileSize);
    if (parsed === 'unsatisfiable') {
      res.setHeader('Content-Range', `bytes */${fileSize}`);
      res.status(416).json({ error: 'Requested range not satisfiable' });
      return;
    }
    if (parsed !== 'full') {
      const chunkSize = parsed.end - parsed.start + 1;
      sendFile(206, {
        'Content-Range': `bytes ${parsed.start}-${parsed.end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': mediaInfo.mimeType,
      }, parsed.start, parsed.end);
      return;
    }
    // Malformed range → fall through and serve the full file (RFC 9110)
  }

  sendFile(200, {
    'Content-Length': fileSize,
    'Content-Type': mediaInfo.mimeType,
    'Accept-Ranges': 'bytes',
  });
});

// JSON 404 for unknown API routes (never the SPA HTML shell)
app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Vite integration / Static files
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
      console.error(
        '[Viddy] Production build not found. Run "npm run build" first, or use "npm run dev" for development.'
      );
      process.exit(1);
    }
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIps();
    console.log('==========================================================');
    console.log(`[Viddy] v${VERSION} — ultra-lightweight LAN media server`);
    console.log(`[Viddy] Mode: ${isProd ? 'production (static build)' : 'development (Vite middleware)'}`);
    console.log(`[Viddy] Local access:  http://localhost:${PORT}`);
    ips.forEach((ip) => {
      console.log(`[Viddy] LAN Wi-Fi:     http://${ip}:${PORT}`);
    });
    console.log(`[Viddy] Local-only traffic shield: ${serverConfig.localOnly ? 'ENABLED' : 'DISABLED'}`);
    if (firstRunPasswordGenerated) {
      console.log('');
      console.log('  **********************************************************');
      console.log('  *  FIRST RUN — your access password has been generated:  *');
      console.log(`  *                                                        *`);
      console.log(`  *      ${firstRunPasswordGenerated}      *`);
      console.log(`  *                                                        *`);
      console.log('  *  Save it, then change it in the Server Deck UI.        *');
      console.log('  **********************************************************');
    }
    console.log('==========================================================');
  });

  // Graceful shutdown — close open sockets instead of dropping them.
  const shutdown = () => {
    console.log('\n[Viddy] Shutting down...');
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startServer().catch((err) => {
  console.error('[Viddy] Failed to start server:', err);
  process.exit(1);
});
