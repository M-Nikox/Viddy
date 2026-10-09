import { useCallback, useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { MediaGrid } from './components/MediaGrid';
import { AuthLockScreen } from './components/AuthLockScreen';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { PhotoViewerModal } from './components/PhotoViewerModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { AudioPlayerModal } from './components/AudioPlayerModal';
import { ServerDashboardModal } from './components/ServerDashboardModal';
import { ConnectDeviceModal } from './components/ConnectDeviceModal';
import { AddMediaModal } from './components/AddMediaModal';
import { ConfirmDialog } from './components/ConfirmDialog';
import { AboutModal } from './components/AboutModal';
import { MediaItem, MediaType } from './types/media';
import { localDb } from './services/localDb';
import { api } from './services/api';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isPasswordProtected, setIsPasswordProtected] = useState(true);
  const [serverUnreachable, setServerUnreachable] = useState(false);
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [currentTab, setCurrentTab] = useState<'all' | MediaType | 'offline'>('all');
  const [toast, setToast] = useState<{ message: string; kind: 'error' | 'info' } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MediaItem | null>(null);

  // Active Modals & Players
  const [activeVideo, setActiveVideo] = useState<MediaItem | null>(null);
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [currentAudio, setCurrentAudio] = useState<MediaItem | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);

  const [isServerDeckOpen, setIsServerDeckOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [isAddMediaOpen, setIsAddMediaOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const showToast = useCallback((message: string, kind: 'error' | 'info' = 'error') => {
    setToast({ message, kind });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Initialize Library & Auth (fail CLOSED — a server error never grants access)
  const initApp = useCallback(async () => {
    setServerUnreachable(false);
    setIsAuthenticated(null);

    // 1. Check server status & password protection
    try {
      const status = await api.getPublicStatus();
      setIsPasswordProtected(status.isPasswordProtected);
      if (!status.isPasswordProtected) {
        setIsAuthenticated(true);
      } else {
        const valid = await api.verifyAuth();
        setIsAuthenticated(valid);
      }
    } catch {
      // Server unreachable: show an honest error screen with retry,
      // never the media library and never a fabricated state.
      setServerUnreachable(true);
      setIsAuthenticated(null);
      return;
    }

    // 2. Initialize IndexedDB media items
    const localItems = await localDb.initDatabase().catch(() => [] as MediaItem[]);

    // 3. Fetch persistent files from the host's media drive
    try {
      const serverItems = await api.getMediaItems();
      const existingIds = new Set(serverItems.map((s) => s.id));
      const merged = [
        ...serverItems,
        ...localItems.filter((l) => !existingIds.has(l.id)),
      ];
      setMediaItems(merged);
    } catch (err) {
      // Authenticated but the library fetch failed — surface it honestly
      console.warn('Could not sync with server storage:', err);
      setMediaItems(localItems);
      showToast('Could not load the server media library.', 'error');
    }
  }, [showToast]);

  useEffect(() => {
    initApp();
  }, [initApp]);

  const handleRefreshLibrary = useCallback(async (showNotification = false) => {
    setIsRefreshing(true);
    try {
      const serverItems = await api.getMediaItems().catch(() => [] as MediaItem[]);
      const localItems = await localDb.initDatabase().catch(() => [] as MediaItem[]);
      const existingIds = new Set(serverItems.map((s) => s.id));
      const merged = [
        ...serverItems,
        ...localItems.filter((l) => !existingIds.has(l.id)),
      ];
      setMediaItems(merged);
      if (showNotification) {
        showToast(`Library refreshed (${merged.length} items)`, 'info');
      }
    } catch (err) {
      console.warn('Failed to refresh library:', err);
      if (showNotification) {
        showToast('Could not refresh media library', 'error');
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

  const handlePlayItem = (item: MediaItem) => {
    if (item.type === 'video') {
      setActiveVideo(item);
    } else if (item.type === 'photo') {
      setActivePhotoId(item.id);
    } else if (item.type === 'audio') {
      setCurrentAudio(item);
      setIsAudioPlaying(true);
    }
  };

  const isLocalOnlyItem = (item: MediaItem) =>
    item.streamUrl.startsWith('blob:') || item.streamUrl.startsWith('data:');

  const handleToggleFavorite = async (id: string) => {
    const target = mediaItems.find((i) => i.id === id);
    if (!target) return;

    if (isLocalOnlyItem(target)) {
      const updated = await localDb.toggleFavorite(id);
      if (updated) {
        setMediaItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, isFavorite: updated.isFavorite } : item))
        );
      }
      return;
    }

    // Server item: optimistic update, revert if the server rejects it
    const newValue = !target.isFavorite;
    setMediaItems((prev) => prev.map((item) => (item.id === id ? { ...item, isFavorite: newValue } : item)));
    const ok = await api.toggleFavorite(id, newValue);
    if (!ok) {
      setMediaItems((prev) => prev.map((item) => (item.id === id ? { ...item, isFavorite: !newValue } : item)));
      showToast('Could not save favorite — check the server connection.');
    }
  };

  const handleToggleOffline = async (item: MediaItem) => {
    try {
      const updated = await localDb.toggleOfflineCache(item);
      if (updated) {
        setMediaItems((prev) =>
          prev.map((m) => (m.id === item.id ? { ...m, isOfflineCached: updated.isOfflineCached, size: updated.size } : m))
        );
        if (currentAudio?.id === item.id) {
          setCurrentAudio((prev) => (prev ? { ...prev, isOfflineCached: updated.isOfflineCached } : null));
        }
        if (activeVideo?.id === item.id) {
          setActiveVideo((prev) => (prev ? { ...prev, isOfflineCached: updated.isOfflineCached } : null));
        }
        if (!updated.isOfflineCached) {
          // Also drop the stored blob so the cache doesn't linger
          await localDb.deleteMediaItem(item.id).catch(() => {});
        }
      }
    } catch {
      showToast('Could not cache this file for offline use — is the server reachable?');
    }
  };

  const requestDeleteItem = (id: string) => {
    const target = mediaItems.find((i) => i.id === id);
    if (target) setPendingDelete(target);
  };

  const confirmDeleteItem = async () => {
    if (!pendingDelete) return;
    const item = pendingDelete;
    setPendingDelete(null);

    if (!isLocalOnlyItem(item)) {
      const ok = await api.deleteMediaItem(item.id);
      if (!ok) {
        showToast('Server refused to delete the file — it is still in your library.');
        return;
      }
    }

    await localDb.deleteMediaItem(item.id).catch(() => {});
    setMediaItems((prev) => prev.filter((m) => m.id !== item.id));
    if (currentAudio?.id === item.id) {
      setCurrentAudio(null);
      setIsAudioPlaying(false);
    }
    if (activeVideo?.id === item.id) setActiveVideo(null);
    if (activePhotoId === item.id) setActivePhotoId(null);
  };

  const handleMediaAdded = (newItems: MediaItem[]) => {
    setMediaItems((prev) => [...newItems, ...prev]);
  };

  const handleLockApp = async () => {
    await api.logout();
    setIsAuthenticated(false);
  };

  // Audio queue & controls
  const audioPlaylist = mediaItems.filter((item) => item.type === 'audio');

  const handleAudioNext = () => {
    if (!currentAudio || audioPlaylist.length === 0) return;
    const currentIndex = audioPlaylist.findIndex((t) => t.id === currentAudio.id);
    const nextIndex = (currentIndex + 1) % audioPlaylist.length;
    setCurrentAudio(audioPlaylist[nextIndex]);
    setIsAudioPlaying(true);
  };

  const handleAudioPrev = () => {
    if (!currentAudio || audioPlaylist.length === 0) return;
    const currentIndex = audioPlaylist.findIndex((t) => t.id === currentAudio.id);
    const prevIndex = (currentIndex - 1 + audioPlaylist.length) % audioPlaylist.length;
    setCurrentAudio(audioPlaylist[prevIndex]);
    setIsAudioPlaying(true);
  };

  // All photos for photo viewer
  const photoList = mediaItems.filter((item) => item.type === 'photo');

  // Item counts for header tabs
  const itemCounts = {
    all: mediaItems.length,
    video: mediaItems.filter((i) => i.type === 'video').length,
    audio: mediaItems.filter((i) => i.type === 'audio').length,
    photo: mediaItems.filter((i) => i.type === 'photo').length,
    offline: mediaItems.filter((i) => i.isOfflineCached).length,
  };

  // While checking auth state
  if (isAuthenticated === null) {
    if (serverUnreachable) {
      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#090a0f] px-4">
          <div className="flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 rounded-xl bg-rose-600/15 border border-rose-500/25 flex items-center justify-center text-rose-400">
              !
            </div>
            <h2 className="text-lg font-bold text-white">Server Unreachable</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Viddy could not contact the local server. Make sure it is still running
              (check the terminal window), then try again.
            </p>
            <button
              onClick={initApp}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              Retry Connection
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#090a0f]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono text-neutral-400">Loading Local Hub...</span>
        </div>
      </div>
    );
  }

  // If password required and not authenticated
  if (!isAuthenticated && isPasswordProtected) {
    return <AuthLockScreen onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  return (
    <div className="min-h-screen bg-[#090a0f] text-neutral-100 flex flex-col font-sans">
      {/* Top 3-Zone Navigation Header */}
      <Navigation
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenServerDeck={() => setIsServerDeckOpen(true)}
        onOpenConnectModal={() => setIsConnectModalOpen(true)}
        onOpenAddMedia={() => setIsAddMediaOpen(true)}
        onOpenAbout={() => setIsAboutModalOpen(true)}
        onRefreshLibrary={() => handleRefreshLibrary(true)}
        isRefreshing={isRefreshing}
        onLockApp={handleLockApp}
        isPasswordProtected={isPasswordProtected}
        itemCounts={itemCounts}
      />

      {/* Main Media Grid Canvas */}
      <main className="flex-1">
        <MediaGrid
          items={mediaItems}
          currentTab={currentTab}
          onPlayItem={handlePlayItem}
          onToggleFavorite={handleToggleFavorite}
          onToggleOffline={handleToggleOffline}
          onDeleteItem={requestDeleteItem}
          onOpenAddMedia={() => setIsAddMediaOpen(true)}
        />
      </main>

      {/* Footer with Creator Credit & Icon Attribution */}
      <footer className={`py-6 px-6 text-center text-[11px] text-neutral-500 border-t border-white/[0.04] ${currentAudio ? 'pb-24' : ''}`}>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-3">
          <span>Viddy v1.0.0</span>
          <span className="hidden sm:inline opacity-30">·</span>
          <span>
            Created by{' '}
            <a
              href="https://github.com/M-Nikox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-300 hover:text-sky-400 font-medium transition-colors underline underline-offset-2"
            >
              @M-Nikox
            </a>
          </span>
          <span className="hidden sm:inline opacity-30">·</span>
          <button
            onClick={() => setIsAboutModalOpen(true)}
            className="text-neutral-400 hover:text-white transition-colors underline underline-offset-2"
          >
            About & Credits
          </button>
          <span className="hidden sm:inline opacity-30">·</span>
          <span>
            <a
              href="https://www.flaticon.com/free-icons/projector"
              title="projector icons"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-500 hover:text-neutral-400 transition-colors underline underline-offset-2"
            >
              Icon by Nikita Golubev (Flaticon)
            </a>
          </span>
        </div>
      </footer>

      {/* Toast notifications */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg text-xs font-medium shadow-2xl border ${
            toast.kind === 'error'
              ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
              : 'bg-indigo-950/90 border-indigo-500/30 text-indigo-200'
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Persistent Bottom Audio Player Bar */}
      {currentAudio && (
        <AudioPlayerBar
          currentTrack={currentAudio}
          isPlaying={isAudioPlaying}
          onTogglePlay={() => setIsAudioPlaying(!isAudioPlaying)}
          onNext={handleAudioNext}
          onPrev={handleAudioPrev}
          onOpenExpanded={() => setIsAudioModalOpen(true)}
          onToggleOffline={handleToggleOffline}
        />
      )}

      {/* Expanded Audio Modal */}
      {isAudioModalOpen && currentAudio && (
        <AudioPlayerModal
          currentTrack={currentAudio}
          playlist={audioPlaylist}
          isPlaying={isAudioPlaying}
          onTogglePlay={() => setIsAudioPlaying(!isAudioPlaying)}
          onSelectTrack={(track) => {
            setCurrentAudio(track);
            setIsAudioPlaying(true);
          }}
          onNext={handleAudioNext}
          onPrev={handleAudioPrev}
          onClose={() => setIsAudioModalOpen(false)}
          onToggleOffline={handleToggleOffline}
        />
      )}

      {/* Video Player Modal */}
      {activeVideo && (
        <VideoPlayerModal
          item={activeVideo}
          onClose={() => setActiveVideo(null)}
          onToggleOffline={handleToggleOffline}
        />
      )}

      {/* Photo Lightbox Modal */}
      {activePhotoId && (
        <PhotoViewerModal
          photos={photoList}
          initialPhotoId={activePhotoId}
          onClose={() => setActivePhotoId(null)}
          onToggleOffline={handleToggleOffline}
        />
      )}

      {/* PC Host Control Deck Modal */}
      {isServerDeckOpen && (
        <ServerDashboardModal
          onClose={() => setIsServerDeckOpen(false)}
          onRefreshData={async () => {
            const stats = await api.getServerStatus().catch(() => null);
            if (stats) setIsPasswordProtected(stats.isPasswordProtected);
            await handleRefreshLibrary(false);
          }}
        />
      )}

      {/* Connect Phone / Tablet QR Modal */}
      {isConnectModalOpen && (
        <ConnectDeviceModal onClose={() => setIsConnectModalOpen(false)} />
      )}

      {/* Add Media Files Modal */}
      {isAddMediaOpen && (
        <AddMediaModal
          onClose={() => setIsAddMediaOpen(false)}
          onMediaAdded={handleMediaAdded}
          onError={showToast}
        />
      )}

      {/* About Viddy Modal */}
      {isAboutModalOpen && (
        <AboutModal onClose={() => setIsAboutModalOpen(false)} />
      )}

      {/* Delete Confirmation Dialog */}
      {pendingDelete && (
        <ConfirmDialog
          title="Delete this file permanently?"
          message={`"${pendingDelete.title}" will be removed from your library and deleted from the disk. This cannot be undone.`}
          confirmLabel="Delete Permanently"
          onConfirm={confirmDeleteItem}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
