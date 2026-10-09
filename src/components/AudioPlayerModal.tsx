import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  FolderSync,
  Clock,
  Music,
  Check,
  Disc,
} from 'lucide-react';
import { MediaItem } from '../types/media';

interface AudioPlayerModalProps {
  currentTrack: MediaItem;
  playlist: MediaItem[];
  isPlaying: boolean;
  onTogglePlay: () => void;
  onSelectTrack: (track: MediaItem) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
  onToggleOffline?: (item: MediaItem) => void;
}

export const AudioPlayerModal: React.FC<AudioPlayerModalProps> = ({
  currentTrack,
  playlist,
  isPlaying,
  onTogglePlay,
  onSelectTrack,
  onNext,
  onPrev,
  onClose,
  onToggleOffline,
}) => {
  const [sleepTimer, setSleepTimer] = useState<number | null>(null);
  const [sleepMinutesLeft, setSleepMinutesLeft] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Sleep timer logic
  useEffect(() => {
    if (!sleepTimer) {
      setSleepMinutesLeft(null);
      return;
    }

    setSleepMinutesLeft(sleepTimer);
    const interval = setInterval(() => {
      setSleepMinutesLeft((prev) => {
        if (!prev || prev <= 1) {
          clearInterval(interval);
          if (isPlaying) onTogglePlay();
          return null;
        }
        return prev - 1;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [sleepTimer, isPlaying]);

  // Canvas visualizer simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;
    const numBars = 32;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = canvas.width / numBars - 2;

      for (let i = 0; i < numBars; i++) {
        const heightMultiplier = isPlaying
          ? Math.sin(phase + i * 0.3) * 0.4 + Math.cos(phase * 1.5 + i * 0.2) * 0.4 + 0.4
          : 0.08;

        const h = Math.max(3, heightMultiplier * canvas.height * 0.85);
        const x = i * (barWidth + 2);
        const y = canvas.height - h;

        const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
        grad.addColorStop(0, '#4f46e5');
        grad.addColorStop(1, '#a5b4fc');

        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barWidth, h);
      }

      if (isPlaying) phase += 0.08;
      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 sm:p-6 animate-fade-in">
      <div className="relative w-full max-w-4xl bg-[#0e111a] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[85vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 text-neutral-400 hover:text-white rounded-lg hover:bg-white/[0.1] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Column: Artwork & Visualizer */}
        <div className="w-full md:w-1/2 p-8 flex flex-col items-center justify-between border-b md:border-b-0 md:border-r border-white/[0.06] bg-gradient-to-b from-[#131726]/40 to-transparent">
          {/* Top metadata tags */}
          <div className="w-full flex items-center justify-between text-xs text-neutral-400 font-mono">
            <span className="flex items-center gap-1 text-indigo-400">
              <Disc className="w-3.5 h-3.5" />
              <span>{currentTrack.bitrate || 'Local Stream'}</span>
            </span>
            <span>Local LAN Stream</span>
          </div>

          {/* Vinyl / Cover Art Container */}
          <div className="my-6 relative flex items-center justify-center">
            <div
              className={`w-56 h-56 rounded-2xl overflow-hidden border border-white/10 shadow-2xl transition-transform duration-700 ${
                isPlaying ? 'scale-100 shadow-indigo-900/30' : 'scale-95 opacity-90'
              }`}
            >
              {currentTrack.thumbnailUrl && currentTrack.thumbnailUrl.trim() !== '' ? (
                <img
                  src={currentTrack.thumbnailUrl || undefined}
                  alt={currentTrack.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-indigo-950/60 text-indigo-400">
                  <Music className="w-16 h-16" />
                </div>
              )}
            </div>
          </div>

          {/* Track Info & Visualizer */}
          <div className="w-full flex flex-col items-center text-center">
            <h3 className="text-lg font-bold text-white tracking-tight line-clamp-1">
              {currentTrack.title}
            </h3>
            <p className="text-xs text-neutral-400 mt-1">
              {currentTrack.artist || 'Unknown Artist'} · {currentTrack.album || 'Local Library'}
            </p>

            {/* Audio Spectrum Visualizer */}
            <div className="w-full h-12 mt-5 px-4 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={280}
                height={48}
                className="w-full h-full opacity-80"
              />
            </div>
          </div>
        </div>

        {/* Right Column: Queue & Controls */}
        <div className="w-full md:w-1/2 p-6 flex flex-col justify-between overflow-y-auto">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] mb-3">
              <span className="text-xs font-semibold text-white tracking-wide uppercase">
                Playback Queue ({playlist.length})
              </span>

              {/* Sleep timer dropdown */}
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <Clock className="w-3.5 h-3.5" />
                <select
                  value={sleepTimer || ''}
                  onChange={(e) => setSleepTimer(e.target.value ? parseInt(e.target.value, 10) : null)}
                  className="bg-transparent border-none text-neutral-300 focus:outline-none cursor-pointer"
                >
                  <option value="" className="bg-[#0e111a] text-white">Timer: Off</option>
                  <option value="15" className="bg-[#0e111a] text-white">15 Minutes</option>
                  <option value="30" className="bg-[#0e111a] text-white">30 Minutes</option>
                  <option value="45" className="bg-[#0e111a] text-white">45 Minutes</option>
                  <option value="60" className="bg-[#0e111a] text-white">60 Minutes</option>
                </select>
                {sleepMinutesLeft && (
                  <span className="text-[11px] font-mono text-indigo-400">({sleepMinutesLeft}m)</span>
                )}
              </div>
            </div>

            {/* Queue List */}
            <div className="space-y-1 max-h-[36vh] overflow-y-auto pr-1">
              {playlist.map((track, idx) => {
                const isSelected = track.id === currentTrack.id;
                return (
                  <div
                    key={track.id}
                    onClick={() => onSelectTrack(track)}
                    className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-indigo-600/20 border border-indigo-500/30 text-white'
                        : 'hover:bg-white/[0.04] text-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs font-mono text-neutral-500 w-4">{idx + 1}</span>
                      <div className="min-w-0">
                        <p className={`text-xs font-medium truncate ${isSelected ? 'text-indigo-300' : ''}`}>
                          {track.title}
                        </p>
                        <p className="text-[11px] text-neutral-500 truncate">{track.artist || 'Local Track'}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
                      <span>{track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : '—'}</span>
                      {track.isOfflineCached && (
                        <span title="Available offline">
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Action Row */}
          <div className="pt-4 border-t border-white/[0.06] mt-4 flex items-center justify-between">
            {onToggleOffline && (
              <button
                onClick={() => onToggleOffline(currentTrack)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                  currentTrack.isOfflineCached
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-white/[0.05] hover:bg-white/[0.09] text-neutral-300 border-white/[0.08]'
                }`}
              >
                {currentTrack.isOfflineCached ? <Check className="w-3.5 h-3.5" /> : <FolderSync className="w-3.5 h-3.5" />}
                <span>{currentTrack.isOfflineCached ? 'Cached on Device' : 'Save for Offline'}</span>
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={onPrev}
                className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.06]"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button
                onClick={onTogglePlay}
                className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-900/40"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
              </button>
              <button
                onClick={onNext}
                className="p-2 text-neutral-300 hover:text-white rounded-lg hover:bg-white/[0.06]"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
