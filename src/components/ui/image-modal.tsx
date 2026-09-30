import React, { useEffect } from 'react';
import { X, ZoomIn, ExternalLink } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, title, subtitle }: ImageModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full max-h-[90vh] bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col border border-slate-700/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900 text-white border-b border-slate-800">
          <div className="min-w-0 pr-4">
            <h3 className="text-sm font-semibold text-white truncate">{title || 'Product Image'}</h3>
            {subtitle && <p className="text-xs text-slate-400 font-mono mt-0.5">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={imageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Open full size in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Image Content Container */}
        <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-2 sm:p-4 min-h-[300px] max-h-[calc(90vh-100px)]">
          <img
            src={imageUrl}
            alt={title || 'Product Photo'}
            className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-lg select-none"
          />
        </div>

        {/* Footer info */}
        <div className="px-4 py-2 bg-slate-900/90 text-slate-400 text-[11px] flex items-center justify-between border-t border-slate-800">
          <span>Click anywhere outside or press Esc to close</span>
          <span className="font-mono text-slate-500">Full Resolution Preview</span>
        </div>
      </div>
    </div>
  );
}
