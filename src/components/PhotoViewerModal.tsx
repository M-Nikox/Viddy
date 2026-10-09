import React, { useState, useEffect } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  FolderSync,
  Play,
  Pause,
  Info,
  Check,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { localDb } from '../services/localDb';

interface PhotoViewerModalProps {
  photos: MediaItem[];
  initialPhotoId: string;
  onClose: () => void;
  onToggleOffline?: (item: MediaItem) => void;
}

export const PhotoViewerModal: React.FC<PhotoViewerModalProps> = ({
  photos,
  initialPhotoId,
  onClose,
  onToggleOffline,
}) => {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = photos.findIndex((p) => p.id === initialPhotoId);
    return idx !== -1 ? idx : 0;
  });

  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isSlideshow, setIsSlideshow] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const currentPhoto = photos[currentIndex] || photos[0];
  const [isOffline, setIsOffline] = useState(!!currentPhoto?.isOfflineCached);
  const [playableUrl, setPlayableUrl] = useState<string>(currentPhoto?.streamUrl || '');

  useEffect(() => {
    if (!currentPhoto) return;
    setIsOffline(!!currentPhoto.isOfflineCached);
    setZoom(1);
    setRotation(0);
    setPlayableUrl(currentPhoto.streamUrl || '');

    let isMounted = true;
    localDb.getPlayableUrl(currentPhoto).then((url) => {
      if (isMounted && url) setPlayableUrl(url);
    });
    return () => {
      isMounted = false;
    };
  }, [currentIndex, currentPhoto]);

  // Slideshow timer
  useEffect(() => {
    if (!isSlideshow || photos.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photos.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [isSlideshow, photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        goToNext();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'r' || e.key === 'R') {
        handleRotate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, photos.length]);

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const goToPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(3, prev + 0.5));
  };

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(1, prev - 0.5));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleToggleOffline = async () => {
    if (!currentPhoto || !onToggleOffline) return;
    onToggleOffline(currentPhoto);
    setIsOffline((prev) => !prev);
  };

  if (!currentPhoto) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-xl animate-fade-in select-none">
      {/* Top Header Bar */}
      <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-white truncate max-w-md">
            {currentPhoto.title}
          </h3>
          <div className="flex items-center gap-2 text-xs text-neutral-400 font-mono mt-0.5">
            <span>{currentIndex + 1} / {photos.length}</span>
            <span aria-hidden="true">·</span>
            <span>
              {currentPhoto.dimensions
                ? `${currentPhoto.dimensions.width}×${currentPhoto.dimensions.height}`
                : 'Full Resolution'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{currentPhoto.size > 0 ? `${(currentPhoto.size / 1024 / 1024).toFixed(2)} MB` : 'Streaming'}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Slideshow button */}
          <button
            onClick={() => setIsSlideshow(!isSlideshow)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
              isSlideshow
                ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500/40'
                : 'bg-white/[0.08] hover:bg-white/[0.12] text-neutral-300 border-white/[0.1]'
            }`}
          >
            {isSlideshow ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isSlideshow ? 'Pause Slideshow' : 'Slideshow'}</span>
          </button>

          {/* Offline Cache */}
          <button
            onClick={handleToggleOffline}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
              isOffline
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                : 'bg-white/[0.08] hover:bg-white/[0.12] text-neutral-300 border-white/[0.1]'
            }`}
          >
            {isOffline ? <Check className="w-3.5 h-3.5" /> : <FolderSync className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{isOffline ? 'Offline Ready' : 'Cache Offline'}</span>
          </button>

          {/* Info toggle */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className={`p-1.5 rounded-lg border transition-colors ${
              showInfo
                ? 'bg-white/20 text-white border-white/30'
                : 'bg-white/[0.08] text-neutral-300 border-white/[0.1] hover:text-white'
            }`}
            title="Image Details"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.1] transition-colors ml-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Image Stage */}
      <div className="relative w-full h-full flex items-center justify-center p-8 overflow-hidden">
        <img
          src={playableUrl || currentPhoto.streamUrl || undefined}
          alt={currentPhoto.title}
          referrerPolicy="no-referrer"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="max-w-full max-h-[85vh] object-contain select-none"
        />

        {/* Prev Button */}
        {photos.length > 1 && (
          <button
            onClick={goToPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/10 transition-all hover:scale-105 active:scale-95"
            title="Previous (Left Arrow)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* Next Button */}
        {photos.length > 1 && (
          <button
            onClick={goToNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white border border-white/10 transition-all hover:scale-105 active:scale-95"
            title="Next (Right Arrow)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Floating Control Pill */}
      <div className="absolute bottom-6 inset-x-0 flex justify-center z-30 pointer-events-none">
        <div className="flex items-center gap-1.5 p-1.5 bg-neutral-900/90 backdrop-blur-md border border-white/[0.1] rounded-xl shadow-2xl pointer-events-auto">
          <button
            onClick={handleZoomIn}
            className="p-2 text-neutral-300 hover:text-white hover:bg-white/[0.1] rounded-lg transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <span className="text-xs font-mono text-neutral-400 px-1">{zoom.toFixed(1)}x</span>

          <button
            onClick={handleZoomOut}
            className="p-2 text-neutral-300 hover:text-white hover:bg-white/[0.1] rounded-lg transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          <button
            onClick={handleRotate}
            className="p-2 text-neutral-300 hover:text-white hover:bg-white/[0.1] rounded-lg transition-colors"
            title="Rotate 90° (R)"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Info Drawer */}
      {showInfo && (
        <div className="absolute right-0 inset-y-0 w-80 bg-[#0e111a]/95 backdrop-blur-md border-l border-white/[0.1] p-6 z-40 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-sm font-semibold text-white">Metadata</h4>
            <button
              onClick={() => setShowInfo(false)}
              className="p-1 text-neutral-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <span className="text-neutral-500 uppercase tracking-wider text-[10px]">File Name</span>
              <p className="text-neutral-200 font-mono mt-0.5 break-all">{currentPhoto.title}</p>
            </div>

            <div>
              <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Dimensions</span>
              <p className="text-neutral-200 font-mono mt-0.5">
                {currentPhoto.dimensions
                  ? `${currentPhoto.dimensions.width} × ${currentPhoto.dimensions.height} px`
                  : 'Unknown'}
              </p>
            </div>

            <div>
              <span className="text-neutral-500 uppercase tracking-wider text-[10px]">File Size</span>
              <p className="text-neutral-200 font-mono mt-0.5">
                {currentPhoto.size > 0 ? `${(currentPhoto.size / 1024 / 1024).toFixed(2)} MB` : 'Unknown'}
              </p>
            </div>

            <div>
              <span className="text-neutral-500 uppercase tracking-wider text-[10px]">MIME Format</span>
              <p className="text-neutral-200 font-mono mt-0.5">{currentPhoto.mimeType}</p>
            </div>

            <div>
              <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Date Ingested</span>
              <p className="text-neutral-200 font-mono mt-0.5">
                {new Date(currentPhoto.dateAdded).toLocaleDateString()}
              </p>
            </div>

            <div>
              <span className="text-neutral-500 uppercase tracking-wider text-[10px]">Tags</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {currentPhoto.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-0.5 text-[11px] bg-white/[0.05] border border-white/[0.08] text-neutral-300 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
