import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Smartphone,
  Tablet,
  Laptop,
  Copy,
  Check,
  RefreshCw,
  Shield,
  Folder,
  Trash2,
} from 'lucide-react';
import { ConnectedClient, ServerStats } from '../types/media';
import { api } from '../services/api';
import { localDb } from '../services/localDb';

interface ServerDashboardModalProps {
  onClose: () => void;
  onRefreshData?: () => void;
}

export const ServerDashboardModal: React.FC<ServerDashboardModalProps> = ({
  onClose,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'security' | 'devices'>('storage');
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [clients, setClients] = useState<ConnectedClient[]>([]);
  const [copied, setCopied] = useState(false);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [requirePass, setRequirePass] = useState(true);
  const [localOnly, setLocalOnly] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Storage / Folder State
  const [storagePath, setStoragePath] = useState('');
  const [filesIndexed, setFilesIndexed] = useState(0);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isUpdatingPath, setIsUpdatingPath] = useState(false);
  const [confirmClearIndex, setConfirmClearIndex] = useState(false);

  const storagePathRef = useRef(storagePath);
  storagePathRef.current = storagePath;

  const fetchData = async () => {
    try {
      const s = await api.getServerStatus();
      setStats(s);
      setRequirePass(s.isPasswordProtected);
      setLocalOnly(s.localTrafficOnly);
    } catch {
      // offline / unreachable
    }

    try {
      const c = await api.getConnectedClients();
      setClients(c);
    } catch {
      setClients([]);
    }

    try {
      const storage = await api.getStorageConfig();
      setFilesIndexed(storage.totalFilesIndexed);
      if (!storagePathRef.current) {
        setStoragePath(storage.activeMediaDir);
      }
    } catch {
      // storage panel keeps last known values
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyDrivePath = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!storagePath.trim()) return;
    setIsUpdatingPath(true);
    setStorageMessage(null);
    setStorageError(null);

    const res = await api.setStorageConfig(storagePath.trim());
    setIsUpdatingPath(false);

    if (res.success && res.activeMediaDir) {
      setStoragePath(res.activeMediaDir);
      setFilesIndexed(res.totalFilesIndexed || 0);
      setStorageMessage(`Library path updated. Indexed ${res.totalFilesIndexed || 0} files.`);
      if (onRefreshData) onRefreshData();
      setTimeout(() => setStorageMessage(null), 4000);
    } else {
      setStorageError(res.error || 'Could not access the specified folder path.');
    }
  };

  const handleRescanDrive = async () => {
    setIsUpdatingPath(true);
    setStorageMessage(null);
    setStorageError(null);

    const res = await api.rescanStorage();
    setIsUpdatingPath(false);
    setFilesIndexed(res.totalFilesIndexed);
    setStorageMessage(`Library rescanned: ${res.totalFilesIndexed} files found.`);
    if (onRefreshData) onRefreshData();
    setTimeout(() => setStorageMessage(null), 3000);
  };

  const handleClearIndex = async () => {
    if (!confirmClearIndex) {
      setConfirmClearIndex(true);
      setTimeout(() => setConfirmClearIndex(false), 4000);
      return;
    }

    setIsUpdatingPath(true);
    setStorageMessage(null);
    setStorageError(null);
    setConfirmClearIndex(false);

    try {
      const res = await api.clearIndex();
      await localDb.clearAllMedia();
      setIsUpdatingPath(false);
      setFilesIndexed(0);
      setStorageMessage(res.message || 'Media index cleared successfully.');
      if (onRefreshData) onRefreshData();
      setTimeout(() => setStorageMessage(null), 3000);
    } catch (e: any) {
      setIsUpdatingPath(false);
      setStorageError(e?.message || 'Failed to clear index.');
    }
  };

  const handleCopyLanUrl = () => {
    if (!stats?.lanUrl) return;
    navigator.clipboard.writeText(stats.lanUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSaveSecurity = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage(null);
    setSaveError(null);

    if (requirePass && !currentPassword && stats?.isPasswordProtected) {
      setSaveError('Current password is required to save changes.');
      setIsSaving(false);
      return;
    }

    const payload: {
      currentPassword?: string;
      newPassword?: string;
      requirePassword?: boolean;
      localOnly?: boolean;
    } = {
      currentPassword: currentPassword || undefined,
      requirePassword: requirePass,
      localOnly,
    };

    if (newPassword.trim()) {
      payload.newPassword = newPassword.trim();
    }

    const res = await api.updateSecurity(payload);
    setIsSaving(false);

    if (res.success) {
      setSaveMessage('Security settings updated successfully.');
      setNewPassword('');
      setCurrentPassword('');
      fetchData();
      if (onRefreshData) onRefreshData();
      setTimeout(() => setSaveMessage(null), 3000);
    } else {
      setSaveError(res.error || 'Failed to update security settings.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#161b22] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h3 className="text-base font-semibold text-white">Server Settings</h3>
            {stats?.lanUrl && (
              <p className="text-xs text-neutral-400 mt-0.5">
                Streaming on{' '}
                <button
                  onClick={handleCopyLanUrl}
                  className="text-sky-400 hover:underline font-mono inline-flex items-center gap-1"
                >
                  {stats.lanUrl}
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </p>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-white rounded-md hover:bg-white/[0.08] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.06] px-6 text-xs font-medium">
          <button
            onClick={() => setActiveTab('storage')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'storage'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Library Folder</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'security'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Security & Access</span>
          </button>

          <button
            onClick={() => setActiveTab('devices')}
            className={`py-3 px-3 border-b-2 flex items-center gap-1.5 transition-colors ${
              activeTab === 'devices'
                ? 'border-sky-500 text-sky-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Connected Devices ({clients.length})</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* TAB 1: Library Storage Folder */}
          {activeTab === 'storage' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-300 mb-1">
                  Active Media Folder
                </label>
                <p className="text-xs text-neutral-500 mb-3">
                  Viddy reads media directly from this directory in place. Nothing is copied or moved.
                </p>

                <form onSubmit={handleApplyDrivePath} className="flex gap-2">
                  <input
                    type="text"
                    value={storagePath}
                    onChange={(e) => setStoragePath(e.target.value)}
                    placeholder="e.g. E:\Media or /mnt/media"
                    className="flex-1 px-3 py-2 text-xs bg-[#0b0e14] border border-white/[0.08] rounded-lg text-white font-mono placeholder-neutral-600 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={isUpdatingPath}
                    className="px-3.5 py-2 text-xs font-medium text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Set Folder
                  </button>
                </form>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-white/[0.06]">
                <div className="text-xs text-neutral-400">
                  <span className="text-white font-medium">{filesIndexed}</span> files indexed in current library
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRescanDrive}
                    disabled={isUpdatingPath}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
                    title="Rescan folder to find newly added or modified files"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingPath ? 'animate-spin text-sky-400' : ''}`} />
                    <span>Rescan Folder</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearIndex}
                    disabled={isUpdatingPath}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      confirmClearIndex
                        ? 'bg-rose-600 hover:bg-rose-500 text-white font-semibold'
                        : 'text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20'
                    }`}
                    title="Clear indexed media from library manifest"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{confirmClearIndex ? 'Confirm Clear?' : 'Clear Index'}</span>
                  </button>
                </div>
              </div>

              {storageMessage && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                  {storageMessage}
                </div>
              )}
              {storageError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
                  {storageError}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Security & Password */}
          {activeTab === 'security' && (
            <form onSubmit={handleSaveSecurity} className="space-y-4">
              <div className="space-y-3">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requirePass}
                    onChange={(e) => setRequirePass(e.target.checked)}
                    className="mt-0.5 rounded border-neutral-700 text-sky-500 focus:ring-0 focus:ring-offset-0 bg-[#0b0e14]"
                  />
                  <div>
                    <span className="text-xs font-medium text-neutral-200">Require Password Authentication</span>
                    <p className="text-[11px] text-neutral-500">
                      Devices connecting on your Wi-Fi must enter password to view media.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localOnly}
                    onChange={(e) => setLocalOnly(e.target.checked)}
                    className="mt-0.5 rounded border-neutral-700 text-sky-500 focus:ring-0 focus:ring-offset-0 bg-[#0b0e14]"
                  />
                  <div>
                    <span className="text-xs font-medium text-neutral-200">Local Wi-Fi / LAN Only Shield</span>
                    <p className="text-[11px] text-neutral-500">
                      Drops any connection from outside private subnet ranges (192.168.x.x, 10.x.x.x, etc).
                    </p>
                  </div>
                </label>
              </div>

              <div className="pt-3 border-t border-white/[0.06] space-y-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-300 mb-1">
                    New Password (optional)
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="w-full px-3 py-2 text-xs bg-[#0b0e14] border border-white/[0.08] rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                  />
                </div>

                {stats?.isPasswordProtected && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-300 mb-1">
                      Current Password <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Required to confirm security changes"
                      className="w-full px-3 py-2 text-xs bg-[#0b0e14] border border-white/[0.08] rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                )}
              </div>

              {saveMessage && (
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-300">
                  {saveMessage}
                </div>
              )}
              {saveError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300">
                  {saveError}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-xs font-medium text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-50 rounded-lg transition-colors"
                >
                  Save Security Settings
                </button>
              </div>
            </form>
          )}

          {/* TAB 3: Connected Devices */}
          {activeTab === 'devices' && (
            <div className="space-y-3">
              {clients.length === 0 ? (
                <p className="text-xs text-neutral-500 py-6 text-center">
                  No other devices connected right now. Scan the QR code in the header from your phone or tablet on the same Wi-Fi.
                </p>
              ) : (
                <div className="divide-y divide-white/[0.04]">
                  {clients.map((c) => (
                    <div key={c.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded bg-white/[0.04] text-neutral-400">
                          {c.deviceType === 'mobile' ? (
                            <Smartphone className="w-4 h-4" />
                          ) : c.deviceType === 'tablet' ? (
                            <Tablet className="w-4 h-4" />
                          ) : (
                            <Laptop className="w-4 h-4" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-200 capitalize">{c.deviceType} Client</p>
                          <p className="text-[11px] text-neutral-500 font-mono">{c.ip}</p>
                        </div>
                      </div>

                      <span className="text-[11px] text-neutral-500">
                        Active {new Date(c.lastActiveAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer with Creator & Attribution */}
        <div className="px-6 py-3 bg-[#0e1217] border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-neutral-500 shrink-0">
          <div className="flex items-center gap-2">
            <span>Viddy v1.0.0</span>
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
          </div>
          <a
            href="https://www.flaticon.com/free-icons/projector"
            title="projector icons"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-500 hover:text-neutral-400 transition-colors underline underline-offset-2"
          >
            Icon by Nikita Golubev (Flaticon)
          </a>
        </div>
      </div>
    </div>
  );
};
