import React, { useState } from 'react';
import { X, ExternalLink, Shield, Code, Info } from 'lucide-react';
import { AppIcon } from './AppIcon';

interface AboutModalProps {
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
  const [avatarStep, setAvatarStep] = useState<'github' | 'local' | 'initials'>('github');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md bg-[#161b22] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-semibold text-white">About Viddy</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          {/* Hero / Identity */}
          <div className="flex flex-col items-center text-center">
            <AppIcon className="w-16 h-16 mb-3 drop-shadow-lg" />
            <h2 className="text-xl font-bold text-white tracking-tight">Viddy</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 text-[10px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/25 rounded-full">
                v1.0.0
              </span>
              <span className="text-xs text-neutral-400">Local LAN Media Hub</span>
            </div>
            <p className="text-xs text-neutral-400 mt-3 max-w-sm leading-relaxed">
              Ultra-lightweight, privacy-first personal streaming server. Watch and listen to your media across any device on your Wi-Fi network with zero cloud dependencies.
            </p>
          </div>

          {/* Creator & Author Section */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-sky-500/10 via-indigo-500/5 to-purple-500/10 border border-sky-500/20">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {avatarStep === 'github' ? (
                  <img
                    src="https://avatars.githubusercontent.com/u/101933576?v=4"
                    alt="@M-Nikox"
                    className="w-10 h-10 rounded-full object-cover border border-sky-500/30 shrink-0 shadow-md"
                    onError={() => setAvatarStep('local')}
                  />
                ) : avatarStep === 'local' ? (
                  <img
                    src="/mnikox.png"
                    alt="@M-Nikox"
                    className="w-10 h-10 rounded-full object-cover border border-sky-500/30 shrink-0 shadow-md"
                    onError={() => setAvatarStep('initials')}
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-300 font-bold text-xs shrink-0 shadow-md">
                    MN
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-sky-400 block">
                    Creator & Developer
                  </span>
                  <h4 className="text-sm font-semibold text-white">@M-Nikox</h4>
                  <p className="text-[11px] text-neutral-400">
                    Architecture, backend & frontend
                  </p>
                </div>
              </div>
              <a
                href="https://github.com/M-Nikox"
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1.5 text-xs font-medium text-sky-300 hover:text-white bg-sky-500/15 hover:bg-sky-500/25 border border-sky-500/30 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Key Principles */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-neutral-300 font-medium mb-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Private</span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Self-hosted, zero telemetry, local traffic shield.
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
              <div className="flex items-center gap-1.5 text-neutral-300 font-medium mb-1">
                <Code className="w-3.5 h-3.5 text-sky-400" />
                <span>Open Source</span>
              </div>
              <p className="text-[11px] text-neutral-500">
                Released under the GNU GPLv3 License.
              </p>
            </div>
          </div>

          {/* Acknowledgments & Asset Attribution */}
          <div className="pt-2 border-t border-white/[0.06] space-y-2">
            <h4 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
              Asset Credits & Attribution
            </h4>
            <div className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs space-y-1.5">
              <div className="flex items-center justify-between text-neutral-300">
                <span>App Icon Design</span>
                <span className="text-neutral-500 text-[11px]">Flaticon</span>
              </div>
              <p className="text-[11px] text-neutral-400">
                <a
                  href="https://www.flaticon.com/free-icons/projector"
                  title="projector icons"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 underline underline-offset-2"
                >
                  Projector icons created by Nikita Golubev - Flaticon
                  <ExternalLink className="w-3 h-3" />
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-white/[0.02] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-neutral-500">
          <span>Viddy v1.0.0</span>
          <button
            onClick={onClose}
            className="px-3 py-1 bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 rounded-md font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
