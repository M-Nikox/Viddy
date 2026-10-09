import React, { useRef, useEffect, useState } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
  FolderSync,
  Repeat,
  Music,
  Check,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { localDb } from '../services/localDb';

interface AudioPlayerBarProps {
  currentTrack: MediaItem | null;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onOpenExpanded: () => void;
  onToggleOffline?: (item: MediaItem) => void;
}

export const AudioPlayerBar: React.FC<AudioPlayerBarProps> = ({
  currentTrack,
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  onOpenExpanded,
  onToggleOffline,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(currentTrack?.duration || 0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [playableUrl, setPlayableUrl] = useState<string>(currentTrack?.streamUrl || '');
  const [isLooping, setIsLooping] = useState(false);

  useEffect(() => {
    if (!currentTrack) return;
    setPlayableUrl(currentTrack.streamUrl || '');
    let isMounted = true;
    localDb.getPlayableUrl(currentTrack).then((url) => {
      if (isMounted && url) {
        setPlayableUrl(url);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [currentTrack]);

  useEffect(() => {
    if (!audioRef.current || !playableUrl) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => {});
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying, playableUrl]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setIsMuted(vol === 0);
    if (audioRef.current) {
      audioRef.current.volume = vol;
      audioRef.current.muted = vol === 0;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const newMute = !isMuted;
    setIsMuted(newMute);
    audioRef.current.muted = newMute;
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-[#161b22]/95 backdrop-blur-md border-t border-white/[0.08] px-6 py-3 shadow-2xl">
      <audio
        ref={audioRef}
        src={playableUrl || undefined}
        loop={isLooping}
        onTimeUpdate={() => {
          if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
        }}
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration || currentTrack.duration || 0);
        }}
        onEnded={onNext}
      />

      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Track Info */}
        <div className="flex items-center gap-3 min-w-0 w-1/4">
          <div
            onClick={onOpenExpanded}
            className="relative w-12 h-12 rounded-lg overflow-hidden bg-neutral-800 border border-white/10 shrink-0 cursor-pointer group"
          >
            {currentTrack.thumbnailUrl && currentTrack.thumbnailUrl.trim() !== '' ? (
              <img
                src={currentTrack.thumbnailUrl || undefined}
                alt={currentTrack.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-sky-500/10 text-sky-400">
                <Music className="w-5 h-5" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Maximize2 className="w-4 h-4 text-white" />
            </div>
          </div>

          <div className="min-w-0">
            <h4
              onClick={onOpenExpanded}
              className="text-xs font-semibold text-white truncate cursor-pointer hover:text-sky-400 transition-colors"
            >
              {currentTrack.title}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 truncate mt-0.5">
              <span>{currentTrack.artist || 'Local Audio'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-neutral-500">{currentTrack.bitrate || 'Lossless/Direct'}</span>
            </div>
          </div>
        </div>

        {/* Center Controls & Seekbar */}
        <div className="flex flex-col items-center gap-1.5 w-2/4 max-w-xl">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLooping(!isLooping)}
              className={`p-1.5 rounded-lg transition-colors ${
                isLooping ? 'text-sky-400 bg-sky-500/15' : 'text-neutral-400 hover:text-white'
              }`}
              title="Loop Track"
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={onPrev}
              className="p-1.5 text-neutral-300 hover:text-white transition-colors"
              title="Previous Track"
            >
              <SkipBack className="w-4 h-4" />
            </button>

            <button
              onClick={onTogglePlay}
              className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-md"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current translate-x-0.5" />
              )}
            </button>

            <button
              onClick={onNext}
              className="p-1.5 text-neutral-300 hover:text-white transition-colors"
              title="Next Track"
            >
              <SkipForward className="w-4 h-4" />
            </button>

            {onToggleOffline && (
              <button
                onClick={() => onToggleOffline(currentTrack)}
                className={`p-1.5 rounded-lg transition-colors ${
                  currentTrack.isOfflineCached
                    ? 'text-emerald-400 bg-emerald-500/10'
                    : 'text-neutral-400 hover:text-white'
                }`}
                title={currentTrack.isOfflineCached ? 'Cached Offline' : 'Cache Offline'}
              >
                {currentTrack.isOfflineCached ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <FolderSync className="w-3.5 h-3.5" />
                )}
              </button>
            )}
          </div>

          <div className="w-full flex items-center gap-2">
            <span className="text-[10px] font-mono text-neutral-400 tabular-nums w-8 text-right">
              {formatTime(currentTime)}
            </span>
            <input
              type="range"
              min="0"
              max={duration || 100}
              step="0.1"
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-[10px] font-mono text-neutral-400 tabular-nums w-8">
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Volume & Full View */}
        <div className="flex items-center justify-end gap-3 w-1/4">
          <div className="hidden sm:flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="p-1 text-neutral-400 hover:text-white transition-colors"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={isMuted ? 0 : volume}
              onChange={handleVolume}
              className="w-20 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <button
            onClick={onOpenExpanded}
            className="p-1.5 text-neutral-400 hover:text-white hover:bg-white/[0.08] rounded-lg transition-colors"
            title="Expand Full Player"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
