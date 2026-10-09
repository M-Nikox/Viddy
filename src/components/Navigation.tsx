import React from 'react';
import {
  Film,
  Music,
  Image as ImageIcon,
  FolderDown,
  Settings,
  QrCode,
  Lock,
  Plus,
  Info,
  RefreshCw,
} from 'lucide-react';
import { AppIcon } from './AppIcon';
import { MediaType } from '../types/media';

interface NavigationProps {
  currentTab: 'all' | MediaType | 'offline';
  onSelectTab: (tab: 'all' | MediaType | 'offline') => void;
  onOpenServerDeck: () => void;
  onOpenConnectModal: () => void;
  onOpenAddMedia: () => void;
  onOpenAbout: () => void;
  onRefreshLibrary?: () => void;
  isRefreshing?: boolean;
  onLockApp: () => void;
  isPasswordProtected: boolean;
  itemCounts: {
    all: number;
    video: number;
    audio: number;
    photo: number;
    offline: number;
  };
}

export const Navigation: React.FC<NavigationProps> = ({
  currentTab,
  onSelectTab,
  onOpenServerDeck,
  onOpenConnectModal,
  onOpenAddMedia,
  onOpenAbout,
  onRefreshLibrary,
  isRefreshing,
  onLockApp,
  isPasswordProtected,
  itemCounts,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 bg-[#0b0e14]/90 backdrop-blur-md border-b border-white/[0.06]">
      {/* Brand Logo & Name */}
      <div className="flex items-center gap-6">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onSelectTab('all');
          }}
          className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-white group"
        >
          <AppIcon className="w-8 h-8" />
          <span>Viddy</span>
        </a>

        {/* Jellyfin-style clean library navigation */}
        <nav className="hidden md:flex items-center gap-1">
          <button
            onClick={() => onSelectTab('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentTab === 'all'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            All ({itemCounts.all})
          </button>

          <button
            onClick={() => onSelectTab('video')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentTab === 'video'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <Film className="w-3.5 h-3.5 opacity-70" />
            <span>Videos ({itemCounts.video})</span>
          </button>

          <button
            onClick={() => onSelectTab('audio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentTab === 'audio'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <Music className="w-3.5 h-3.5 opacity-70" />
            <span>Music ({itemCounts.audio})</span>
          </button>

          <button
            onClick={() => onSelectTab('photo')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              currentTab === 'photo'
                ? 'bg-white/10 text-white font-semibold'
                : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
            }`}
          >
            <ImageIcon className="w-3.5 h-3.5 opacity-70" />
            <span>Photos ({itemCounts.photo})</span>
          </button>

          {itemCounts.offline > 0 && (
            <button
              onClick={() => onSelectTab('offline')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                currentTab === 'offline'
                  ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.04]'
              }`}
            >
              <FolderDown className="w-3.5 h-3.5 opacity-70" />
              <span>Downloads ({itemCounts.offline})</span>
            </button>
          )}
        </nav>
      </div>

      {/* Primary Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenAddMedia}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-sky-500 hover:bg-sky-400 rounded-md transition-colors"
          title="Add media files"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Media</span>
        </button>

        <button
          onClick={onOpenConnectModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.08] rounded-md transition-colors"
          title="Connect mobile device via QR"
        >
          <QrCode className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden sm:inline">Connect</span>
        </button>

        <button
          onClick={onRefreshLibrary}
          disabled={isRefreshing}
          className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.08] rounded-md transition-colors disabled:opacity-50"
          title="Refresh library"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-sky-400' : ''}`} />
        </button>

        <button
          onClick={onOpenServerDeck}
          className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.08] rounded-md transition-colors"
          title="Server Settings"
        >
          <Settings className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenAbout}
          className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.08] rounded-md transition-colors"
          title="About Viddy"
        >
          <Info className="w-4 h-4" />
        </button>

        {isPasswordProtected && (
          <button
            onClick={onLockApp}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.08] rounded-md transition-colors"
            title="Lock session"
          >
            <Lock className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
