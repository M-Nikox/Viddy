import React, { useState, useEffect } from 'react';
import { X, QrCode, Copy, Check, Smartphone } from 'lucide-react';
import { api } from '../services/api';
import { ServerStats } from '../types/media';

interface ConnectDeviceModalProps {
  onClose: () => void;
}

export const ConnectDeviceModal: React.FC<ConnectDeviceModalProps> = ({ onClose }) => {
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.getServerStatus().then(setStats);
  }, []);

  const handleCopy = () => {
    if (!stats?.lanUrl) return;
    navigator.clipboard.writeText(stats.lanUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-sm bg-[#161b22] border border-white/[0.08] rounded-xl shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-white/[0.08] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="w-10 h-10 rounded-lg bg-sky-500/15 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
            <Smartphone className="w-5 h-5" />
          </div>

          <h3 className="text-base font-semibold text-white">
            Connect Device
          </h3>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs">
            Scan with your phone or tablet camera on the same Wi-Fi to watch or listen.
          </p>

          {/* QR Code Container */}
          <div className="mt-4 p-3 bg-white rounded-xl shadow-lg border border-white/10">
            {stats?.qrCodeData && stats.qrCodeData.trim() !== '' ? (
              <img
                src={stats.qrCodeData || undefined}
                alt="Wi-Fi QR Code"
                className="w-44 h-44 object-contain"
              />
            ) : (
              <div className="w-44 h-44 flex items-center justify-center bg-neutral-100 text-black">
                <QrCode className="w-20 h-20 opacity-60" />
              </div>
            )}
          </div>

          {/* Direct Link */}
          <div className="mt-4 flex items-center gap-2 font-mono text-xs text-neutral-300 bg-[#0b0e14] px-3 py-2 rounded-lg border border-white/[0.06] w-full justify-between">
            <span className="truncate">{stats?.lanUrl || 'Loading URL...'}</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[11px] text-neutral-300 hover:text-white px-2 py-0.5 bg-white/[0.08] hover:bg-white/[0.12] rounded transition-colors shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-400" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[11px] text-neutral-500 mt-3">
            Enter your password on the phone once loaded.
          </p>
        </div>
      </div>
    </div>
  );
};
