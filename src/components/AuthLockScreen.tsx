import React, { useState } from 'react';
import { Lock, ArrowRight } from 'lucide-react';
import { AppIcon } from './AppIcon';
import { api } from '../services/api';

interface AuthLockScreenProps {
  onAuthenticated: () => void;
}

export const AuthLockScreen: React.FC<AuthLockScreenProps> = ({ onAuthenticated }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your access password');
      return;
    }

    setIsLoading(true);
    setError(null);

    const result = await api.login(password);
    setIsLoading(false);

    if (result.success) {
      onAuthenticated();
    } else {
      setError(result.error || 'Incorrect password');
      setPassword('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b0e14] px-4">
      <div className="relative w-full max-w-sm p-7 bg-[#161b22] border border-white/[0.08] rounded-xl shadow-2xl">
        <div className="flex flex-col items-center text-center mb-6">
          <AppIcon className="w-12 h-12 mb-3" />

          <h2 className="text-lg font-semibold text-white tracking-tight">
            Viddy
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            Enter your password to access the media library.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Password"
              autoComplete="current-password"
              autoFocus
              className="w-full px-3.5 py-2 text-xs bg-[#0b0e14] border border-white/[0.08] rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-sky-500 transition-colors"
            />

            {error && (
              <p className="mt-2 text-xs text-rose-400">
                {error}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2 px-4 flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-sky-500 hover:bg-sky-400 disabled:opacity-50 rounded-lg transition-colors"
          >
            {isLoading ? <span>Signing in...</span> : <span>Sign In</span>}
          </button>
        </form>

        <p className="mt-5 text-[11px] text-neutral-500 text-center">
          First run? Check the server terminal for your initial generated password.
        </p>

        <div className="mt-4 pt-3 border-t border-white/[0.04] text-[10px] text-neutral-500 text-center flex flex-col items-center gap-1">
          <span>
            Viddy v1.0.0 · Created by{' '}
            <a
              href="https://github.com/M-Nikox"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-sky-400 font-medium transition-colors underline underline-offset-2"
            >
              @M-Nikox
            </a>
          </span>
          <a
            href="https://www.flaticon.com/free-icons/projector"
            title="projector icons"
            target="_blank"
            rel="noopener noreferrer"
            className="text-neutral-600 hover:text-neutral-400 transition-colors underline underline-offset-2"
          >
            Icon by Nikita Golubev (Flaticon)
          </a>
        </div>
      </div>
    </div>
  );
};
