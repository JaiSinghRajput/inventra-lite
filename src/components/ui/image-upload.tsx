import React, { useState, useRef, useEffect } from 'react';
import {
  Upload,
  X,
  Image as ImageIcon,
  Link as LinkIcon,
  Check,
  Loader2,
  Sparkles,
  Camera,
  Trash2,
  Eye,
  Video,
} from 'lucide-react';
import { compressImage, formatFileSize, CompressionResult } from '../../lib/image-compression';
import { uploadToCloudinary } from '../../features/upload/cloudinary';
import { getCloudinaryConfigFn } from '../../features/upload/server';
import { ImageModal } from './image-modal';
import { CameraModal } from './camera-modal';

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
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'upload' | 'url'>('upload');
  const [directUrl, setDirectUrl] = useState(value || '');
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);

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

  // Check if current device is a mobile device / touch screen
  const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent))
    );
  };

  // Central image compression and upload processing
  const processFile = async (file: File) => {
    if (!file) return;

    setError('');
    setIsCompressing(true);
    setCompressionStats(null);

    try {
      // 1. Client-Side Image Compression (converts high-res camera photos to WebP)
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
        setError(
          'Cloudinary is not configured in .env. Photo preview set locally. You can also paste an image URL directly.'
        );
        onChange(result.previewUrl);
        return;
      }

      // 3. Upload compressed image to Cloudinary
      setIsUploading(true);
      const uploadedUrl = await uploadToCloudinary(
        result.file,
        cloudinaryConfig.cloudName,
        cloudinaryConfig.uploadPreset
      );

      onChange(uploadedUrl);
    } catch (err: any) {
      console.error('Image upload failed:', err);
      setError(err?.message || 'Failed to process and upload image');
    } finally {
      setIsCompressing(false);
      setIsUploading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = '';
      if (galleryInputRef.current) galleryInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleCameraClick = () => {
    setError('');
    if (
      typeof navigator !== 'undefined' &&
      'mediaDevices' in navigator &&
      navigator.mediaDevices &&
      'getUserMedia' in navigator.mediaDevices
    ) {
      setIsLiveCameraOpen(true);
    } else {
      cameraInputRef.current?.click();
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

  // Drag and drop support
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      processFile(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div className="space-y-2">
      {/* Label and Mode Switch */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-semibold text-slate-700">{label}</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === 'upload' ? 'url' : 'upload')}
            className="text-[11px] text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1 cursor-pointer"
          >
            {mode === 'upload' ? (
              <>
                <LinkIcon className="w-3 h-3" /> Paste URL
              </>
            ) : (
              <>
                <Camera className="w-3 h-3" /> Camera / Upload
              </>
            )}
          </button>
        </div>
      </div>

      {/* Loading Overlay / Progress Indicator */}
      {(isCompressing || isUploading) && (
        <div className="p-4 rounded-xl border border-brand-200 bg-brand-50/50 flex flex-col items-center justify-center gap-2">
          <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
          <div className="text-center">
            <p className="text-xs font-bold text-slate-800">
              {isCompressing ? 'Compressing photo...' : 'Uploading to Cloudinary...'}
            </p>
            <p className="text-[11px] text-slate-500">
              Optimizing size for fast mobile & POS loading
            </p>
          </div>
        </div>
      )}

      {/* Preview Section when Image Exists */}
      {!isCompressing && !isUploading && value ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-3 rounded-xl border border-slate-200 bg-slate-50/70 shadow-xs">
          {/* Thumbnail with zoom trigger */}
          <div
            className="relative group w-24 h-24 sm:w-28 sm:h-28 rounded-xl border border-slate-200 overflow-hidden bg-white shrink-0 cursor-pointer shadow-xs"
            onClick={() => setIsZoomModalOpen(true)}
            title="Click to zoom full screen"
          >
            <img
              src={value}
              alt="Product preview"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
                setError('Failed to load image preview from provided URL');
              }}
            />
            <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Eye className="w-5 h-5" />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex-1 space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {/* PRIMARY: Retake with Camera */}
              <button
                type="button"
                onClick={handleCameraClick}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer"
                title="Retake photo using camera"
              >
                <Camera className="w-3.5 h-3.5" /> Retake Photo
              </button>

              {/* View Fullscreen */}
              <button
                type="button"
                onClick={() => setIsZoomModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 text-xs font-medium transition-colors cursor-pointer"
                title="View full screen"
              >
                <Eye className="w-3.5 h-3.5" /> Fullscreen
              </button>

              {/* Remove */}
              <button
                type="button"
                onClick={handleRemove}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-medium transition-colors cursor-pointer"
                title="Remove photo"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>

            <p className="text-[11px] text-slate-500">
              Tap photo to zoom, or tap Retake Photo to capture a new photo with camera.
            </p>
          </div>
        </div>
      ) : !isCompressing && !isUploading && mode === 'upload' ? (
        /* Empty State: Focused Camera Card (No separate gallery selector) */
        <div className="space-y-2">
          <div
            onClick={handleCameraClick}
            className="group relative flex items-center justify-between p-4 rounded-xl border-2 border-brand-500 bg-brand-50/40 hover:bg-brand-50/80 hover:border-brand-600 transition-all duration-150 shadow-xs cursor-pointer"
          >
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                <Camera className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-brand-700">
                    Take Product Photo
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-brand-200 text-brand-900 px-2 py-0.5 rounded-full">
                    Camera
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 leading-snug">
                  Capture directly using device camera with live preview
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 pl-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  galleryInputRef.current?.click();
                }}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                title="Select image from device files if needed"
              >
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Drag & Drop Notice */}
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="border border-dashed border-slate-200 rounded-lg py-2 px-3 text-center bg-slate-50/50 text-[11px] text-slate-400"
          >
            Or drag and drop photo here (auto-compressed to high-efficiency WebP)
          </div>
        </div>
      ) : !isCompressing && !isUploading ? (
        /* Direct URL Form */
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
            className="px-3 py-2 bg-slate-800 text-white text-xs rounded-lg hover:bg-slate-900 font-medium cursor-pointer"
          >
            Set URL
          </button>
        </form>
      ) : null}

      {/* HIDDEN INPUT 1: Dedicated Camera Capture Input (HTML5 capture attribute opens native camera on mobile) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* HIDDEN INPUT 2: Dedicated Gallery / File Picker Input */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Live Webcam Viewfinder Modal */}
      <CameraModal
        isOpen={isLiveCameraOpen}
        onClose={() => setIsLiveCameraOpen(false)}
        onCapture={processFile}
        onSwitchToNativeCamera={() => cameraInputRef.current?.click()}
        title={label ? `Take ${label}` : 'Take Product Photo'}
      />

      {/* Zoom / Full Resolution Modal */}
      {value && (
        <ImageModal
          isOpen={isZoomModalOpen}
          onClose={() => setIsZoomModalOpen(false)}
          imageUrl={value}
          title={label}
        />
      )}

      {/* Compression Savings Badge */}
      {compressionStats && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md">
          <Sparkles className="w-3.5 h-3.5" />
          <span>
            Compressed: {compressionStats.original} ➔ {compressionStats.compressed} (
            {compressionStats.saved}% smaller)
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
          Tip: Add <code className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded">CLOUDINARY_CLOUD_NAME</code> and{' '}
          <code className="font-mono text-[10px] bg-amber-100 px-1 py-0.5 rounded">CLOUDINARY_UPLOAD_PRESET</code> to{' '}
          <code className="font-mono text-[10px]">.env</code> for automatic cloud uploads, or use "Paste URL".
        </p>
      )}
    </div>
  );
};
