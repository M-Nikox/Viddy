import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  Film,
  Music,
  Image as ImageIcon,
} from 'lucide-react';
import { MediaItem } from '../types/media';
import { localDb } from '../services/localDb';
import { api } from '../services/api';

interface AddMediaModalProps {
  onClose: () => void;
  onMediaAdded: (items: MediaItem[]) => void;
  onError?: (message: string) => void;
}

export const AddMediaModal: React.FC<AddMediaModalProps> = ({ onClose, onMediaAdded, onError }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    const acceptedExtensions = [
      '.mp4', '.m4v', '.webm', '.mkv', '.mov', '.avi',
      '.mp3', '.m4a', '.wav', '.flac', '.aac', '.ogg', '.opus',
      '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp',
    ];
    const rejected = files.filter(
      (f) => !acceptedExtensions.includes(f.name.slice(f.name.lastIndexOf('.')).toLowerCase())
    );
    if (rejected.length > 0) {
      onError?.(`Unsupported file: ${rejected[0].name}. Only media files can be uploaded.`);
      return;
    }

    setIsProcessing(true);
    setTotalCount(files.length);
    setProcessedCount(0);

    const addedItems: MediaItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgressText(`Uploading ${file.name} (${i + 1}/${files.length})...`);

      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let type: 'video' | 'audio' | 'photo' = 'photo';
      if (file.type.startsWith('video/') || ['mp4', 'm4v', 'webm', 'mkv', 'mov', 'avi'].includes(ext)) {
        type = 'video';
      } else if (file.type.startsWith('audio/') || ['mp3', 'm4a', 'wav', 'flac', 'aac', 'ogg', 'opus'].includes(ext)) {
        type = 'audio';
      }

      const id = `local-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const objectUrl = URL.createObjectURL(file);

      let duration: number | undefined;
      let dimensions: { width: number; height: number } | undefined;
      let thumbnailUrl: string | undefined;

      if (type === 'photo') {
        thumbnailUrl = objectUrl;
        try {
          const img = new Image();
          img.src = objectUrl;
          await new Promise((res) => {
            img.onload = res;
            img.onerror = res;
          });
          dimensions = { width: img.naturalWidth, height: img.naturalHeight };
        } catch {
          // fallback
        }
      } else if (type === 'video') {
        try {
          const video = document.createElement('video');
          video.src = objectUrl;
          video.preload = 'metadata';
          await new Promise((res) => {
            video.onloadedmetadata = res;
            video.onerror = res;
          });
          duration = Math.round(video.duration);
          dimensions = { width: video.videoWidth, height: video.videoHeight };
        } catch {
          // fallback
        }
      } else if (type === 'audio') {
        try {
          const audio = document.createElement('audio');
          audio.src = objectUrl;
          audio.preload = 'metadata';
          await new Promise((res) => {
            audio.onloadedmetadata = res;
            audio.onerror = res;
          });
          duration = Math.round(audio.duration);
        } catch {
          // fallback
        }
      }

      let streamUrl = objectUrl;
      let finalId = id;
      const serverItem = await api.uploadFile(file, (percent) => {
        setProgressText(`Uploading ${file.name} — ${percent}% (${i + 1}/${files.length})`);
      });
      if (serverItem) {
        finalId = serverItem.id;
        streamUrl = serverItem.streamUrl;
      } else {
        // Fallback: preserve file blob in IndexedDB so client-only upload persists
        await localDb.saveFileBlob(finalId, file).catch(() => {});
        onError?.(`Could not upload "${file.name}" to server. Kept in browser storage.`);
      }

      const mediaItem: MediaItem = {
        id: finalId,
        title: file.name.replace(/\.[^/.]+$/, ''),
        type,
        mimeType: file.type || (type === 'video' ? 'video/mp4' : type === 'audio' ? 'audio/mpeg' : 'image/jpeg'),
        size: file.size,
        duration,
        dimensions,
        dateAdded: new Date().toISOString(),
        streamUrl,
        thumbnailUrl: thumbnailUrl || (type === 'photo' ? streamUrl : undefined),
        tags: ['Uploaded', type.toUpperCase()],
        isFavorite: false,
        isOfflineCached: !serverItem,
      };

      await localDb.saveMediaItem(mediaItem);
      addedItems.push(mediaItem);
      setProcessedCount(i + 1);
    }

    setIsProcessing(false);
    onMediaAdded(addedItems);
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-md bg-[#161b22] border border-white/[0.08] rounded-xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
          <h3 className="text-base font-semibold text-white">Add Media Files</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 p-8 border border-dashed rounded-lg flex flex-col items-center justify-center text-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-sky-500 bg-sky-500/10'
              : 'border-white/[0.15] hover:border-white/[0.3] bg-[#0b0e14]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="video/*,audio/*,image/*,.mkv,.flac"
            onChange={(e) => {
              if (e.target.files) processFiles(e.target.files);
            }}
            className="hidden"
          />

          <div className="w-10 h-10 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-300 mb-2.5">
            <Upload className="w-4 h-4 text-sky-400" />
          </div>

          <h4 className="text-xs font-semibold text-white mb-0.5">
            Choose or drop files here
          </h4>
          <p className="text-[11px] text-neutral-400 mb-3">
            Supports MP4, MKV, WebM, MP3, FLAC, JPG, PNG, WebP
          </p>

          <span className="px-3 py-1.5 text-xs font-medium text-white bg-sky-500 hover:bg-sky-400 rounded-md transition-colors">
            Select Files
          </span>
        </div>

        {/* Formats Supported */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
          <div className="p-2.5 bg-[#0b0e14] border border-white/[0.06] rounded-lg flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <div>
              <p className="font-medium text-neutral-200">Video</p>
              <p className="text-[10px] text-neutral-500">MP4, MKV</p>
            </div>
          </div>

          <div className="p-2.5 bg-[#0b0e14] border border-white/[0.06] rounded-lg flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div>
              <p className="font-medium text-neutral-200">Audio</p>
              <p className="text-[10px] text-neutral-500">MP3, FLAC</p>
            </div>
          </div>

          <div className="p-2.5 bg-[#0b0e14] border border-white/[0.06] rounded-lg flex items-center gap-2">
            <ImageIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <div>
              <p className="font-medium text-neutral-200">Photos</p>
              <p className="text-[10px] text-neutral-500">JPG, PNG</p>
            </div>
          </div>
        </div>

        {/* Processing State */}
        {isProcessing && (
          <div className="mt-4 p-3 bg-sky-500/10 border border-sky-500/20 rounded-lg space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-sky-300 font-medium">{progressText}</span>
              <span className="font-mono text-sky-400">
                {processedCount} / {totalCount}
              </span>
            </div>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-200"
                style={{ width: `${(processedCount / Math.max(1, totalCount)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
