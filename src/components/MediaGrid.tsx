import React, { useState, useEffect } from 'react';
import {
  Film,
  Music,
  Image as ImageIcon,
  Play,
  Heart,
  FolderDown,
  Trash2,
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  MoreVertical,
} from 'lucide-react';
import { MediaItem, MediaType } from '../types/media';
import { getVideoThumbnail } from '../services/videoThumbnail';

interface MediaGridProps {
  items: MediaItem[];
  currentTab: 'all' | MediaType | 'offline';
  onPlayItem: (item: MediaItem) => void;
  onToggleFavorite: (id: string) => void;
  onToggleOffline: (item: MediaItem) => void;
  onDeleteItem: (id: string) => void;
  onOpenAddMedia: () => void;
}

// Dedicated component for asynchronous thumbnail rendering
const CardThumbnail: React.FC<{ item: MediaItem }> = ({ item }) => {
  const [videoThumb, setVideoThumb] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (item.type === 'video') {
      getVideoThumbnail(item).then((url) => {
        if (isMounted && url) {
          setVideoThumb(url);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [item]);

  if (item.type === 'video') {
    if (videoThumb) {
      return (
        <img
          src={videoThumb}
          alt={item.title}
          onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-all duration-300 ${
            loaded ? 'opacity-100 scale-100 group-hover:scale-105' : 'opacity-0 scale-95'
          }`}
        />
      );
    }
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900/80 text-neutral-600 group-hover:text-neutral-400 transition-colors">
        <Film className="w-8 h-8 opacity-40 mb-1" />
        <span className="text-[10px] font-medium tracking-wider uppercase opacity-40">Video</span>
      </div>
    );
  }

  if (item.type === 'photo') {
    const src = item.thumbnailUrl || item.streamUrl;
    return (
      <img
        src={src}
        alt={item.title}
        loading="lazy"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      />
    );
  }

  // Audio / Music Card
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-800 to-neutral-900 text-neutral-400 group-hover:text-sky-400 transition-colors">
      <Music className="w-10 h-10 opacity-50 mb-1 group-hover:scale-110 transition-transform" />
      <span className="text-[10px] font-medium tracking-wider uppercase opacity-50">Audio Track</span>
    </div>
  );
};

export const MediaGrid: React.FC<MediaGridProps> = ({
  items,
  currentTab,
  onPlayItem,
  onToggleFavorite,
  onToggleOffline,
  onDeleteItem,
  onOpenAddMedia,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'size' | 'duration'>('date');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Extract tags excluding basic type names
  const allTags = Array.from(
    new Set(
      items
        .flatMap((i) => i.tags || [])
        .filter((t) => !['VIDEO', 'AUDIO', 'PHOTO', 'Uploaded', 'Library Root'].includes(t))
    )
  );

  // Filter items
  const filteredItems = items
    .filter((item) => {
      if (currentTab === 'offline') {
        if (!item.isOfflineCached) return false;
      } else if (currentTab !== 'all') {
        if (item.type !== currentTab) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesArtist = item.artist?.toLowerCase().includes(q);
        const matchesAlbum = item.album?.toLowerCase().includes(q);
        const matchesTag = item.tags.some((t) => t.toLowerCase().includes(q));
        if (!matchesTitle && !matchesArtist && !matchesAlbum && !matchesTag) {
          return false;
        }
      }

      if (selectedTag && !item.tags.includes(selectedTag)) {
        return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      }
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'size') {
        return b.size - a.size;
      }
      if (sortBy === 'duration') {
        return (b.duration || 0) - (a.duration || 0);
      }
      return 0;
    });

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return null;
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-6 pb-28">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search library..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-[#161b22] border border-white/[0.08] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-white text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-neutral-400">
          <div className="flex items-center gap-1.5 bg-[#161b22] border border-white/[0.08] px-2.5 py-1.5 rounded-lg">
            <SlidersHorizontal className="w-3.5 h-3.5 text-neutral-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent border-none text-neutral-200 focus:outline-none cursor-pointer text-xs"
            >
              <option value="date" className="bg-[#161b22] text-white">Recently Added</option>
              <option value="title" className="bg-[#161b22] text-white">Title (A-Z)</option>
              <option value="size" className="bg-[#161b22] text-white">File Size</option>
              <option value="duration" className="bg-[#161b22] text-white">Duration</option>
            </select>
          </div>

          <div className="flex items-center bg-[#161b22] border border-white/[0.08] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded ${
                viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded ${
                viewMode === 'list' ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Tag filters (if library has folders/tags) */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-4 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedTag(null)}
            className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
              selectedTag === null
                ? 'bg-sky-500 text-white font-medium'
                : 'bg-[#161b22] text-neutral-400 hover:text-white'
            }`}
          >
            All Folders
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap ${
                selectedTag === tag
                  ? 'bg-sky-500 text-white font-medium'
                  : 'bg-[#161b22] text-neutral-400 hover:text-white'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <div className="py-24 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-500 mb-4">
            {currentTab === 'video' ? (
              <Film className="w-6 h-6" />
            ) : currentTab === 'audio' ? (
              <Music className="w-6 h-6" />
            ) : currentTab === 'photo' ? (
              <ImageIcon className="w-6 h-6" />
            ) : (
              <Search className="w-6 h-6" />
            )}
          </div>
          <h3 className="text-base font-medium text-white mb-1">
            {searchQuery ? 'No media found' : 'No items here yet'}
          </h3>
          <p className="text-xs text-neutral-400 max-w-sm mb-5">
            {searchQuery
              ? `No items match "${searchQuery}".`
              : 'Add videos, music, or photos from your computer to stream to any device.'}
          </p>
          <button
            onClick={onOpenAddMedia}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-500 hover:bg-sky-400 rounded-lg transition-colors"
          >
            Add Media Files
          </button>
        </div>
      )}

      {/* Jellyfin-style Content-First Grid View */}
      {viewMode === 'grid' && filteredItems.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="group relative flex flex-col rounded-lg overflow-hidden transition-transform duration-200"
            >
              {/* Media Poster / Thumbnail (16:9 for video, 1:1 for audio/photo) */}
              <div
                onClick={() => onPlayItem(item)}
                className={`relative w-full overflow-hidden rounded-lg bg-[#161b22] border border-white/[0.06] hover:border-sky-500/50 cursor-pointer shadow-md transition-all ${
                  item.type === 'video' ? 'aspect-video' : 'aspect-square'
                }`}
              >
                <CardThumbnail item={item} />

                {/* Subtle scrim overlay on hover */}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-sky-500 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    {item.type === 'photo' ? (
                      <ImageIcon className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4 fill-current translate-x-0.5" />
                    )}
                  </div>
                </div>

                {/* Duration Badge */}
                {item.duration && (
                  <div className="absolute bottom-1.5 right-1.5 text-[10px] font-medium text-white/90 bg-black/75 px-1.5 py-0.5 rounded backdrop-blur-sm">
                    {formatDuration(item.duration)}
                  </div>
                )}

                {/* Top Right Actions */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(item.id);
                    }}
                    className={`p-1.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-sm transition-colors ${
                      item.isFavorite ? 'text-rose-400 !opacity-100' : 'text-white'
                    }`}
                    title={item.isFavorite ? 'Unfavorite' : 'Favorite'}
                  >
                    <Heart className={`w-3.5 h-3.5 ${item.isFavorite ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveMenuId(activeMenuId === item.id ? null : item.id);
                    }}
                    className="p-1.5 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-sm text-white transition-colors"
                    title="More actions"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Favorite Heart if active and not hovered */}
                {item.isFavorite && (
                  <div className="absolute top-1.5 right-1.5 group-hover:hidden">
                    <div className="p-1.5 text-rose-400 drop-shadow">
                      <Heart className="w-3.5 h-3.5 fill-current" />
                    </div>
                  </div>
                )}

                {/* Context Menu Dropdown */}
                {activeMenuId === item.id && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute top-9 right-1.5 z-20 w-36 bg-[#1b212c] border border-white/[0.1] rounded-lg shadow-xl py-1 text-xs text-neutral-200"
                  >
                    <button
                      onClick={() => {
                        onToggleOffline(item);
                        setActiveMenuId(null);
                      }}
                      className="w-full px-3 py-1.5 text-left hover:bg-white/[0.08] flex items-center gap-2"
                    >
                      <FolderDown className="w-3.5 h-3.5 text-neutral-400" />
                      <span>{item.isOfflineCached ? 'Remove Cache' : 'Save Offline'}</span>
                    </button>
                    <button
                      onClick={() => {
                        onDeleteItem(item.id);
                        setActiveMenuId(null);
                      }}
                      className="w-full px-3 py-1.5 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete File</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Clean Title & Meta below the card */}
              <div className="mt-2 px-0.5">
                <h4
                  onClick={() => onPlayItem(item)}
                  title={item.title}
                  className="text-xs font-medium text-neutral-200 truncate cursor-pointer hover:text-sky-400 transition-colors"
                >
                  {item.title}
                </h4>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 mt-0.5">
                  <span>{formatSize(item.size)}</span>
                  {item.resolution && (
                    <>
                      <span>·</span>
                      <span>{item.resolution}</span>
                    </>
                  )}
                  {item.artist && (
                    <>
                      <span>·</span>
                      <span className="truncate">{item.artist}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Jellyfin-style List View */}
      {viewMode === 'list' && filteredItems.length > 0 && (
        <div className="border border-white/[0.06] rounded-lg overflow-hidden bg-[#161b22]">
          <div className="grid grid-cols-12 gap-3 px-4 py-2.5 bg-white/[0.02] border-b border-white/[0.06] text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            <div className="col-span-6 sm:col-span-7">Title</div>
            <div className="col-span-2">Type</div>
            <div className="col-span-2 text-right">Size</div>
            <div className="col-span-2 sm:col-span-1 text-right">Duration</div>
          </div>

          <div className="divide-y divide-white/[0.04]">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onPlayItem(item)}
                className="grid grid-cols-12 gap-3 px-4 py-2.5 items-center hover:bg-white/[0.03] cursor-pointer transition-colors text-xs"
              >
                <div className="col-span-6 sm:col-span-7 flex items-center gap-3 min-w-0">
                  <div className="w-10 h-7 rounded bg-neutral-900 shrink-0 overflow-hidden flex items-center justify-center text-neutral-500">
                    <CardThumbnail item={item} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-white truncate">{item.title}</p>
                    <p className="text-[11px] text-neutral-500 truncate">
                      {item.artist || item.resolution || ''}
                    </p>
                  </div>
                </div>

                <div className="col-span-2 text-neutral-400 capitalize">
                  {item.type}
                </div>

                <div className="col-span-2 text-right text-neutral-300 font-mono">
                  {formatSize(item.size)}
                </div>

                <div className="col-span-2 sm:col-span-1 text-right text-neutral-400 font-mono">
                  {formatDuration(item.duration) || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
