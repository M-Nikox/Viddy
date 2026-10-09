export type MediaType = 'video' | 'audio' | 'photo';

export interface MediaItem {
  id: string;
  title: string;
  type: MediaType;
  mimeType: string;
  size: number; // in bytes
  dateAdded: string; // ISO date
  streamUrl: string;
  thumbnailUrl?: string;
  duration?: number; // in seconds
  dimensions?: {
    width: number;
    height: number;
  };
  artist?: string;
  album?: string;
  resolution?: string; // e.g., '1080p', '4K', '720p'
  bitrate?: string; // e.g., '320 kbps', '4.2 Mbps'
  tags: string[];
  isFavorite?: boolean;
  isOfflineCached?: boolean;
  localPath?: string;
}

/** Minimal status payload available to unauthenticated callers (lock screen). */
export interface PublicServerStatus {
  running: boolean;
  isPasswordProtected: boolean;
  localTrafficOnly: boolean;
  serverName: string;
  serverVersion: string;
}

export interface ServerStats extends PublicServerStatus {
  port: number;
  hostIps: string[];
  primaryIp: string;
  lanUrl?: string;
  qrCodeData?: string;
  memoryMb: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpuUsagePercent: number;
  uptimeSeconds: number;
  activeStreams: number;
  activeSessions: number;
}

export interface ConnectedClient {
  id: string;
  ip: string;
  userAgent: string;
  connectedAt: string;
  lastActiveAt: string;
  activeStream?: string;
  deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown';
}
