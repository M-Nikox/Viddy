import { MediaItem } from '../types/media';
import { localDb } from './localDb';

// In-memory cache for fast sync lookup during session
const memoryThumbnailCache = new Map<string, string>();

// Concurrency queue to avoid firing dozens of simultaneous video seeks
type ThumbnailTask = {
  item: MediaItem;
  resolve: (url: string | null) => void;
};

const queue: ThumbnailTask[] = [];
let activeWorkers = 0;
const MAX_CONCURRENT_WORKERS = 2;

function processQueue() {
  if (queue.length === 0 || activeWorkers >= MAX_CONCURRENT_WORKERS) return;

  const task = queue.shift();
  if (!task) return;

  activeWorkers++;
  generateThumbnail(task.item)
    .then((url) => {
      task.resolve(url);
    })
    .catch(() => {
      task.resolve(null);
    })
    .finally(() => {
      activeWorkers--;
      processQueue();
    });
}

async function generateThumbnail(item: MediaItem): Promise<string | null> {
  // 1. Check in-memory cache
  if (memoryThumbnailCache.has(item.id)) {
    return memoryThumbnailCache.get(item.id)!;
  }

  // 2. Check IndexedDB cached blob
  try {
    const cachedBlob = await localDb.getFileBlob(`thumb_${item.id}`);
    if (cachedBlob) {
      const url = URL.createObjectURL(cachedBlob);
      memoryThumbnailCache.set(item.id, url);
      return url;
    }
  } catch {
    // proceed to extraction
  }

  // 3. Extract frame from video using offscreen HTML5 video + canvas
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    }, 8000); // 8s timeout guard

    const cleanup = () => {
      clearTimeout(timeout);
      video.removeAttribute('src');
      video.load();
    };

    video.onloadedmetadata = () => {
      // Seek to 1.5 seconds in (or 20% into very short videos) to avoid black intro frames
      const seekTime = Math.min(1.5, (video.duration || 5) * 0.2);
      video.currentTime = Math.max(0.1, seekTime);
    };

    video.onseeked = () => {
      if (resolved) return;
      resolved = true;

      try {
        const targetWidth = 480;
        const aspect = video.videoHeight / (video.videoWidth || 1) || 9 / 16;
        const targetHeight = Math.round(targetWidth * aspect);

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          cleanup();
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
        cleanup();

        canvas.toBlob(
          async (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }

            try {
              await localDb.saveFileBlob(`thumb_${item.id}`, blob);
            } catch {
              // Non-fatal if storage fails
            }

            const url = URL.createObjectURL(blob);
            memoryThumbnailCache.set(item.id, url);
            resolve(url);
          },
          'image/jpeg',
          0.82
        );
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => {
      if (!resolved) {
        resolved = true;
        cleanup();
        resolve(null);
      }
    };

    // Begin loading
    video.src = item.streamUrl;
  });
}

export function getVideoThumbnail(item: MediaItem): Promise<string | null> {
  if (memoryThumbnailCache.has(item.id)) {
    return Promise.resolve(memoryThumbnailCache.get(item.id)!);
  }

  return new Promise((resolve) => {
    queue.push({ item, resolve });
    processQueue();
  });
}
