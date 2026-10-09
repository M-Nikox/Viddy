import { ConnectedClient, MediaItem, PublicServerStatus, ServerStats } from '../types/media';

const TOKEN_KEY = 'viddy_auth_token';

/**
 * Thin fetch wrapper: attaches the Bearer token when present and parses JSON.
 * Network errors and non-2xx responses are surfaced as exceptions — this
 * client NEVER fabricates fallback data. The UI shows honest error states
 * instead of made-up numbers.
 */
async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = api.getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(path, { ...init, headers, credentials: 'include' });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }

  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const api = {
  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string, persist: boolean = true) {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(TOKEN_KEY, token);
    if (persist) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  clearToken() {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  },

  /** Minimal, unauthenticated status — used by the lock screen. */
  async getPublicStatus(): Promise<PublicServerStatus> {
    return apiFetch<PublicServerStatus>('/api/status');
  },

  /** Full status (network info, memory, QR) — requires a session. */
  async getServerStatus(): Promise<ServerStats> {
    return apiFetch<ServerStats>('/api/status');
  },

  async login(password: string): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const data = await apiFetch<{ success: boolean; token?: string; isPasswordProtected: boolean }>(
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ password }),
        }
      );
      if (data.token) this.setToken(data.token);
      return { success: true, token: data.token };
    } catch (e) {
      if (e instanceof ApiError) {
        return { success: false, error: e.message };
      }
      return { success: false, error: 'Cannot reach the Viddy server. Check that it is running.' };
    }
  },

  async logout(): Promise<void> {
    this.clearToken();
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      /* local token already cleared */
    }
  },

  async verifyAuth(): Promise<boolean> {
    try {
      await apiFetch<{ valid: boolean }>('/api/auth/verify');
      return true;
    } catch {
      // Fail CLOSED: if the server can't confirm the session, the user
      // gets the lock screen — never silent access.
      return false;
    }
  },

  async updateSecurity(payload: {
    currentPassword?: string;
    newPassword?: string;
    requirePassword?: boolean;
    localOnly?: boolean;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    return apiFetch<{ success: boolean; message?: string }>('/api/auth/update', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getConnectedClients(): Promise<ConnectedClient[]> {
    return apiFetch<ConnectedClient[]>('/api/clients');
  },

  async getMediaItems(): Promise<MediaItem[]> {
    return apiFetch<MediaItem[]>('/api/media');
  },

  async deleteMediaItem(id: string): Promise<boolean> {
    try {
      await apiFetch(`/api/media/${encodeURIComponent(id)}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  },

  async toggleFavorite(id: string, isFavorite: boolean): Promise<boolean> {
    try {
      await apiFetch(`/api/media/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ isFavorite }),
      });
      return true;
    } catch {
      return false;
    }
  },

  /**
   * Upload via XHR (fetch cannot report upload progress). onProgress
   * receives 0-100 while the file is being transferred.
   */
  uploadFile(file: File, onProgress?: (percent: number) => void): Promise<MediaItem | null> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/media/upload');

      const token = this.getToken();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText).item ?? null);
          } catch {
            resolve(null);
          }
        } else {
          console.warn(`[Viddy] Upload rejected (${xhr.status})`);
          resolve(null);
        }
      };
      xhr.onerror = () => {
        console.warn('[Viddy] Upload failed: server unreachable');
        resolve(null);
      };

      const formData = new FormData();
      formData.append('file', file);
      xhr.send(formData);
    });
  },

  async getStorageConfig(): Promise<{
    activeMediaDir: string;
    defaultDir: string;
    isCustomDrive: boolean;
    totalFilesIndexed: number;
    exists: boolean;
    portability?: {
      isPortable: boolean;
      appDirectory: string;
      configPath: string;
      manifestPath: string;
      systemClutterBytes: number;
      registryTouched: boolean;
      appDataUsed: boolean;
      driveWriteMode: string;
    };
  }> {
    return apiFetch('/api/storage/config');
  },

  async setStorageConfig(pathString: string): Promise<{
    success: boolean;
    activeMediaDir?: string;
    totalFilesIndexed?: number;
    message?: string;
    error?: string;
  }> {
    return apiFetch('/api/storage/config', {
      method: 'POST',
      body: JSON.stringify({ path: pathString }),
    });
  },

  async rescanStorage(): Promise<{ success: boolean; activeMediaDir: string; totalFilesIndexed: number }> {
    return apiFetch('/api/storage/rescan', { method: 'POST' });
  },

  async clearIndex(): Promise<{ success: boolean; totalFilesIndexed: number; message?: string }> {
    return apiFetch('/api/storage/clear-index', { method: 'POST' });
  },
};
