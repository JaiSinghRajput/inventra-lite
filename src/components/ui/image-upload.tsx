import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Link as LinkIcon, Check, Loader2, Sparkles } from 'lucide-react';
import { compressImage, formatFileSize, CompressionResult } from '../../lib/image-compression';
import { uploadToCloudinary } from '../../features/upload/cloudinary';
import { getCloudinaryConfigFn } from '../../features/upload/server';
import { ImageModal } from './image-modal';

interface ImageUploadProps {
  value?: string;
  onChange: (url: string) => void;
  label?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  label = 'Product Image',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [directUrl, setDirectUrl] = useState(value || '');
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);

  const [isCompressing, setIsCompressing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [compressionStats, setCompressionStats] = useState<{
    original: string;
    compressed: string;
    saved: number;
  } | null>(null);

  const [error, setError] = useState('');
  const [cloudinaryConfig, setCloudinaryConfig] = useState<{
    cloudName: string;
    uploadPreset: string;
    isConfigured: boolean;
  } | null>(null);

  useEffect(() => {
    getCloudinaryConfigFn()
      .then((cfg) => setCloudinaryConfig(cfg))
      .catch(() => setCloudinaryConfig({ cloudName: '', uploadPreset: '', isConfigured: false }));
  }, []);

  useEffect(() => {
    setDirectUrl(value || '');
  }, [value]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setIsCompressing(true);
    setCompressionStats(null);

    try {
      // 1. Client-Side Image Compression
      const result: CompressionResult = await compressImage(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.8,
        format: 'image/webp',
      });

      setCompressionStats({
        original: formatFileSize(result.originalSize),
        compressed: formatFileSize(result.compressedSize),
        saved: result.savedPercentage,
      });

      setIsCompressing(false);

      // 2. Check Cloudinary Configuration
      if (!cloudinaryConfig?.isConfigured) {
        // Fallback: If Cloudinary credentials are not set in .env, use compressed data URL or prompt
        setError('Cloudinary credentials (CLOUDINARY_CLOUD_NAME & CLOUDINARY_UPLOAD_PRESET) are not configured in .env. You can also paste an image URL directly.');
        // Still allow previewing with compressed data URL
        onChange(result.previewUrl);
        return;
      }

      // 3. Upload to Cloudinary
      setIsUploading(true);
      const uploadedUrl = await uploadToCloudinary(
        result.file,
        cloudinaryConfig.cloudName,
        cloudinaryConfig.uploadPreset
      );

      onChange(uploadedUrl);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to process and upload image');
    } finally {
      setIsCompressing(false);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
    setDirectUrl('');
    setCompressionStats(null);
    setError('');
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (directUrl.trim()) {
      onChange(directUrl.trim());
      setError('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === 'upload' ? 'url' : 'upload')}
            className="text-[11px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
          >
            {mode === 'upload' ? (
              <>
                <LinkIcon className="w-3 h-3" /> Paste URL
              </>
            ) : (
              <>
                <Upload className="w-3 h-3" /> Upload File
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Section */}
      {value ? (
        <>
          <div className="relative group w-36 h-36 rounded-xl border border-slate-200 overflow-hidden bg-slate-50 flex items-center justify-center shadow-sm">
            <img
              src={value}
              alt="Product preview"
              className="w-full h-full object-cover cursor-pointer"
              onClick={() => setIsZoomModalOpen(true)}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                setError('Failed to load image preview from provided URL');
              }}
            />
            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsZoomModalOpen(true)}
                className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white text-xs font-medium cursor-pointer"
                title="View full screen"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-lg bg-white/90 text-slate-700 hover:bg-white text-xs font-medium cursor-pointer"
                title="Replace image"
              >
                Replace
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 text-xs font-medium cursor-pointer"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <ImageModal
            isOpen={isZoomModalOpen}
            onClose={() => setIsZoomModalOpen(false)}
            imageUrl={value}
            title={label}
          />
        </>
      ) : mode === 'upload' ? (
        <div
          onClick={() => fileInputRef.current?.click()}
          className="cursor-pointer border-2 border-dashed border-slate-200 hover:border-brand-500 rounded-xl p-4 text-center transition-colors bg-slate-50/50 hover:bg-brand-50/30"
        >
          <div className="flex flex-col items-center">
            {isCompressing || isUploading ? (
              <div className="flex flex-col items-center py-2">
                <Loader2 className="w-6 h-6 text-brand-600 animate-spin mb-1" />
                <span className="text-xs font-medium text-slate-700">
                  {isCompressing ? 'Compressing image...' : 'Uploading to Cloudinary...'}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">Please wait</span>
              </div>
            ) : (
              <>
                <div className="w-9 h-9 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 mb-2">
                  <Upload className="w-4 h-4" />
                </div>
                <div className="text-xs font-medium text-slate-700">
                  Click or drag photo here
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  PNG, JPG, WEBP (auto-compressed before upload)
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleUrlSubmit} className="flex gap-2">
          <input
            type="url"
            value={directUrl}
            onChange={(e) => setDirectUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-900 font-medium"
          >
            Set URL
          </button>
        </form>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Compression Savings Badge */}
      {compressionStats && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            Compressed: {compressionStats.original} ➔ {compressionStats.compressed} ({compressionStats.saved}% smaller)
          </span>
        </div>
      )}

      {/* Errors or Notices */}
      {error && (
        <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 p-2 rounded-md">
          {error}
        </p>
      )}

      {!cloudinaryConfig?.isConfigured && mode === 'upload' && !value && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1.5 rounded-md">
          Tip: Add <code className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded">CLOUDINARY_CLOUD_NAME</code> and <code className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded">CLOUDINARY_UPLOAD_PRESET</code> to <code className="font-mono text-[10px]">.env</code> for automatic cloud uploads, or use "Paste URL".
        </p>
      )}
    </div>
  );
};
