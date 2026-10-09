import { MediaItem } from '../types/media';

const DB_NAME = 'viddy_db';
const DB_VERSION = 1;
const STORE_MEDIA = 'media_items';
const STORE_FILES = 'media_files';
const STORE_SETTINGS = 'settings';

class LocalDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private blobUrlCache: Map<string, string> = new Map();

  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_MEDIA)) {
          db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_FILES)) {
          db.createObjectStore(STORE_FILES);
        }
        if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
          db.createObjectStore(STORE_SETTINGS);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  async initDatabase(): Promise<MediaItem[]> {
    try {
      return await this.getAllMedia();
    } catch (err) {
      console.warn('Could not init IndexedDB:', err);
      return [];
    }
  }

  async getAllMedia(): Promise<MediaItem[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readonly');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async saveMediaItem(item: MediaItem): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_MEDIA, 'readwrite');
      const store = tx.objectStore(STORE_MEDIA);
      const req = store.put(item);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async deleteMediaItem(id: string): Promise<void> {
    const db = await this.getDb();
    // Revoke cached blob url if any
    const existingUrl = this.blobUrlCache.get(id);
    if (existingUrl) {
      URL.revokeObjectURL(existingUrl);
      this.blobUrlCache.delete(id);
    }

    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA, STORE_FILES], 'readwrite');
      tx.objectStore(STORE_MEDIA).delete(id);
      tx.objectStore(STORE_FILES).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async clearAllMedia(): Promise<void> {
    const db = await this.getDb();
    this.blobUrlCache.clear();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA, STORE_FILES], 'readwrite');
      tx.objectStore(STORE_MEDIA).clear();
      tx.objectStore(STORE_FILES).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveFileBlob(id: string, blob: Blob): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readwrite');
      const store = tx.objectStore(STORE_FILES);
      const req = store.put(blob, id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getFileBlob(id: string): Promise<Blob | null> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_FILES, 'readonly');
      const store = tx.objectStore(STORE_FILES);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getPlayableUrl(item: MediaItem): Promise<string> {
    // If it's already an active blob URL or external data URL, return it
    if (item.streamUrl.startsWith('data:') || item.streamUrl.startsWith('blob:')) {
      return item.streamUrl;
    }

    // Check memory cache
    if (this.blobUrlCache.has(item.id)) {
      return this.blobUrlCache.get(item.id)!;
    }

    // Check if we have a stored blob in IndexedDB
    const storedBlob = await this.getFileBlob(item.id);
    if (storedBlob) {
      const url = URL.createObjectURL(storedBlob);
      this.blobUrlCache.set(item.id, url);
      return url;
    }



    return item.streamUrl;
  }

  async toggleFavorite(id: string): Promise<MediaItem | null> {
    const items = await this.getAllMedia();
    const item = items.find((i) => i.id === id);
    if (!item) return null;
    item.isFavorite = !item.isFavorite;
    await this.saveMediaItem(item);
    return item;
  }

  /**
   * Toggle offline caching for a media item. Server items are cached by
   * downloading the REAL file from the stream endpoint — never a placeholder.
   * Demo (sample) items are synthesized, matching what playback uses.
   */
  async toggleOfflineCache(item: MediaItem): Promise<MediaItem | null> {
    const items = await this.getAllMedia();
    const existing = items.find((i) => i.id === item.id);
    const target: MediaItem = existing || { ...item };

    if (!target.isOfflineCached) {
      let blob = await this.getFileBlob(item.id);
      if (!blob) {
        blob = await this.fetchBlobForItem(item);
        await this.saveFileBlob(item.id, blob);
      }
      if (blob) {
        target.size = blob.size; // real size once cached
      }
      target.isOfflineCached = true;
    } else {
      target.isOfflineCached = false;
    }

    await this.saveMediaItem(target);
    return target;
  }

  /**
   * Download the actual bytes for an item: server stream URL, blob:, or
   * data: URL. Demo items are synthesized. Throws when the file cannot be
   * fetched so callers can surface an honest error.
   */
  private async fetchBlobForItem(item: MediaItem): Promise<Blob> {


    const url = item.streamUrl;
    if (url.startsWith('/api/') || url.startsWith('blob:') || url.startsWith('data:')) {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Could not download media (${res.status})`);
      }
      return await res.blob();
    }

    throw new Error('This item cannot be cached for offline use');
  }

  async getSetting<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const db = await this.getDb();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_SETTINGS, 'readonly');
        const store = tx.objectStore(STORE_SETTINGS);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result !== undefined ? req.result : defaultValue);
        req.onerror = () => resolve(defaultValue);
      });
    } catch {
      return defaultValue;
    }
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    try {
      const db = await this.getDb();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_SETTINGS, 'readwrite');
        const store = tx.objectStore(STORE_SETTINGS);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch (e) {
      console.warn('Failed to set setting in DB:', e);
    }
  }

  /**
   * Calculate local storage usage in MB (zeros when the browser
   * does not support the Storage API — never fabricated numbers).
   */
  async getStorageEstimate(): Promise<{ usageMb: number; quotaMb: number }> {
    if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      return {
        usageMb: Math.round(((estimate.usage || 0) / (1024 * 1024)) * 10) / 10,
        quotaMb: Math.round(((estimate.quota || 0) / (1024 * 1024)) * 10) / 10
      };
    }
    return { usageMb: 0, quotaMb: 0 };
  }
}

export const localDb = new LocalDatabase();
