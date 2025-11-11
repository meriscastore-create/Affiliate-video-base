import React, { useState, useEffect } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (apiKey: string) => void;
  currentKey: string | null;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, currentKey }) => {
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    if (currentKey) {
        setApiKey(currentKey);
    } else {
        setApiKey('');
    }
  }, [currentKey, isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
      onSave(apiKey.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-surface rounded-lg shadow-2xl w-full max-w-md border border-border-color flex flex-col animate-fadeIn">
        <div className="p-5 border-b border-border-color">
          <h2 className="text-xl font-bold text-white">Masukkan Kunci API Gemini Anda</h2>
          <p className="text-sm text-text-secondary mt-1">
            Aplikasi ini membutuhkan kunci API Anda sendiri untuk berfungsi. Kunci Anda disimpan dengan aman di browser Anda dan tidak pernah dibagikan.
          </p>
        </div>
        <div className="p-5 flex-grow">
          <label htmlFor="apiKeyInput" className="block text-sm font-semibold mb-2 text-white">
            Kunci API Google AI Studio
          </label>
          <input
            id="apiKeyInput"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-brand-bg border border-border-color rounded-md p-2.5 text-sm focus:ring-2 focus:ring-primary-focus outline-none transition-colors"
            placeholder="Tempel kunci API Anda di sini"
            autoComplete="off"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          />
          <p className="text-xs text-text-secondary mt-2">
            Anda bisa mendapatkan kunci API gratis dari{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-focus underline hover:text-primary"
            >
              Google AI Studio
            </a>
            .
          </p>
        </div>
        <div className="p-4 bg-brand-bg/50 border-t border-border-color flex justify-end items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-surface hover:bg-border-color transition-colors"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={!apiKey.trim()}
            className="px-4 py-2 rounded-md text-sm font-semibold bg-primary text-white hover:bg-primary-focus transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
          >
            Simpan Kunci
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;
