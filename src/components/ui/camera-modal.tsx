import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  X,
  RefreshCw,
  Check,
  RotateCcw,
  AlertCircle,
  Loader2,
  Upload,
  Sparkles,
} from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  onSwitchToNativeCamera?: () => void;
  title?: string;
}

export const CameraModal: React.FC<CameraModalProps> = ({
  isOpen,
  onClose,
  onCapture,
  onSwitchToNativeCamera,
  title = 'Take Product Photo',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [isFlashing, setIsFlashing] = useState(false);

  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
  const [activeFacing, setActiveFacing] = useState<'rear' | 'front' | 'unknown'>('rear');
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('Rear Camera');

  // Stop all active media tracks cleanly
  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Helper: check if device is rear/back facing
  const isRearDevice = (device: MediaDeviceInfo): boolean => {
    const label = (device.label || '').toLowerCase();
    return (
      label.includes('back') ||
      label.includes('rear') ||
      label.includes('environment') ||
      label.includes('facing back') ||
      label.includes('camera2 0') ||
      label.includes('world') ||
      label.includes('main')
    );
  };

  // Helper: check if device is front facing
  const isFrontDevice = (device: MediaDeviceInfo): boolean => {
    const label = (device.label || '').toLowerCase();
    return (
      label.includes('front') ||
      label.includes('user') ||
      label.includes('selfie') ||
      label.includes('facing front') ||
      label.includes('camera2 1') ||
      label.includes('facetime')
    );
  };

  // Start camera stream defaulting to rear / environment camera
  const startCamera = async (
    targetDeviceId?: string,
    targetFacing: 'environment' | 'user' = 'environment'
  ) => {
    stopTracks();
    setIsLoading(true);
    setError(null);

    if (
      typeof navigator === 'undefined' ||
      !('mediaDevices' in navigator) ||
      !navigator.mediaDevices ||
      !('getUserMedia' in navigator.mediaDevices)
    ) {
      setError(
        'Live camera access is not supported by your browser or connection is not secure (requires HTTPS or localhost). You can still take photos using the native device camera.'
      );
      setIsLoading(false);
      return;
    }

    try {
      let stream: MediaStream | null = null;

      // If a specific device ID was requested, prioritize it
      if (targetDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1920, min: 1280 },
              height: { ideal: 1080, min: 720 },
            },
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { deviceId: { exact: targetDeviceId } },
          });
        }
      } else {
        // Enumerate already visible devices if possible to find rear camera
        const existingDevices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        const videoInputs = existingDevices.filter((d) => d.kind === 'videoinput');
        const rearMatch = videoInputs.find(isRearDevice);

        if (rearMatch && rearMatch.deviceId) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                deviceId: { exact: rearMatch.deviceId },
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
              },
            });
            setSelectedDeviceId(rearMatch.deviceId);
          } catch {
            // Fall through to facingMode constraint
          }
        }

        // Default to rear camera with facingMode: 'environment'
        if (!stream) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                facingMode: { ideal: targetFacing },
                width: { ideal: 1920, min: 1280 },
                height: { ideal: 1080, min: 720 },
              },
            });
          } catch {
            // Fallback for devices that don't support resolution constraints
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { facingMode: targetFacing },
              });
            } catch {
              // Final fallback: any video device
              stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: true,
              });
            }
          }
        }
      }

      if (!stream) {
        throw new Error('Failed to obtain media stream');
      }

      streamRef.current = stream;

      // Attach stream to video element and handle playback
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
        await videoRef.current.play().catch(() => {});
      }

      // Enumerate all video devices now that permission is granted
      const allDevices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
      const videoDevices = allDevices.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoDevices);

      // Identify active camera device
      const activeTrack = stream.getVideoTracks()[0];
      const settings = activeTrack ? activeTrack.getSettings() : null;
      const currentId = settings?.deviceId || targetDeviceId;
      if (currentId) setSelectedDeviceId(currentId);

      const matchedDevice = videoDevices.find((d) => d.deviceId === currentId);
      const trackLabel = matchedDevice?.label || activeTrack?.label || '';

      if (isRearDevice({ label: trackLabel } as any) || settings?.facingMode === 'environment') {
        setActiveFacing('rear');
        setActiveCameraLabel('Rear Camera (Default)');
      } else if (isFrontDevice({ label: trackLabel } as any) || settings?.facingMode === 'user') {
        setActiveFacing('front');
        setActiveCameraLabel('Front Camera');
      } else {
        setActiveFacing(targetFacing === 'environment' ? 'rear' : 'front');
        setActiveCameraLabel(trackLabel || (targetFacing === 'environment' ? 'Rear Camera' : 'Front Camera'));
      }

      setIsLoading(false);
    } catch (err: any) {
      console.error('Camera stream error:', err);
      let msg = 'Failed to access camera.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = 'Camera permission was denied. Please allow camera permissions in your browser.';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        msg = 'Camera is in use by another application or tab.';
      }
      setError(msg);
      setIsLoading(false);
    }
  };

  // Flip/Switch between available cameras (e.g. Rear <-> Front)
  const handleSwitchCamera = () => {
    if (availableDevices.length > 1) {
      const currentIndex = availableDevices.findIndex((d) => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % availableDevices.length;
      const nextDevice = availableDevices[nextIndex];
      setSelectedDeviceId(nextDevice.deviceId);

      const isNextRear = isRearDevice(nextDevice);
      startCamera(nextDevice.deviceId, isNextRear ? 'environment' : 'user');
    } else {
      // Toggle facingMode if device IDs are not distinct
      const nextFacing = activeFacing === 'rear' ? 'user' : 'environment';
      startCamera(undefined, nextFacing);
    }
  };

  // Shutter action
  const handleSnap = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Visual shutter flash
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 120);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const previewUrl = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setCapturedPreview(previewUrl);
      },
      'image/jpeg',
      0.95
    );
  };

  // Retake photo: seamlessly unhides video and resumes camera stream without blank screen
  const handleRetake = async () => {
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);

    // Verify stream is alive and actively playing
    const tracks = streamRef.current?.getVideoTracks() || [];
    const isLive = tracks.length > 0 && tracks.some((t) => t.readyState === 'live');

    if (isLive && videoRef.current) {
      try {
        if (!videoRef.current.srcObject) {
          videoRef.current.srcObject = streamRef.current;
        }
        await videoRef.current.play();
      } catch (err) {
        console.warn('Video resume failed, restarting stream:', err);
        startCamera(selectedDeviceId, activeFacing === 'front' ? 'user' : 'environment');
      }
    } else {
      // If tracks were stopped or inactive, start camera freshly
      startCamera(selectedDeviceId, activeFacing === 'front' ? 'user' : 'environment');
    }
  };

  // Confirm photo and send to parent
  const handleConfirm = () => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `product_camera_${Date.now()}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });

    handleClose();
    onCapture(file);
  };

  // Close and clean up
  const handleClose = () => {
    stopTracks();
    if (capturedPreview) {
      URL.revokeObjectURL(capturedPreview);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
    setError(null);
    onClose();
  };

  // Keep videoRef attached and playing whenever capturedPreview returns to null
  useEffect(() => {
    if (!capturedPreview && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
      }
      videoRef.current.play().catch(() => {});
    }
  }, [capturedPreview]);

  // Start fresh whenever modal is opened
  useEffect(() => {
    if (isOpen) {
      setCapturedPreview(null);
      setCapturedBlob(null);
      setError(null);
      startCamera(undefined, 'environment');
    } else {
      stopTracks();
    }
    return () => {
      stopTracks();
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={handleClose}
    >
      <div
        className="relative w-full sm:max-w-3xl md:max-w-4xl h-full sm:h-[90vh] sm:max-h-[820px] bg-slate-950 sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-800 text-white ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80 shrink-0 z-30">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">{title}</h3>
            </div>

            {/* Active Camera Badge */}
            {!capturedPreview && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-brand-500/15 text-brand-300 border border-brand-500/30">
                <Camera className="w-3 h-3" />
                {activeCameraLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Camera Switch / Flip Button */}
            {!capturedPreview && !error && (
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700/80 transition-all cursor-pointer text-xs font-semibold shadow-xs"
                title="Switch between Rear and Front cameras"
              >
                <RefreshCw className="w-3.5 h-3.5 text-brand-400" />
                <span>Switch Camera</span>
                {availableDevices.length > 1 && (
                  <span className="text-[10px] text-slate-400 font-mono ml-0.5">
                    ({availableDevices.length})
                  </span>
                )}
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewfinder Main Stage */}
        <div className="relative flex-1 w-full bg-black flex items-center justify-center overflow-hidden min-h-[300px]">
          {/* Shutter Flash Animation Overlay */}
          <div
            className={`absolute inset-0 z-40 bg-white pointer-events-none transition-opacity duration-150 ${
              isFlashing ? 'opacity-95' : 'opacity-0'
            }`}
          />

          {/* Continuous Video Element - ALWAYS MOUNTED so stream is never interrupted */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-contain sm:object-cover transition-opacity duration-150 ${
              capturedPreview || error ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          />

          {/* Live Camera Overlays (Grid, Reticle, Status) */}
          {!capturedPreview && !error && (
            <>
              {/* Rule-of-Thirds Grid */}
              <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 opacity-15">
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-r border-b border-white" />
                <div className="border-b border-white" />
                <div className="border-r border-white" />
                <div className="border-r border-white" />
                <div />
              </div>

              {/* Product Framing Reticle */}
              <div className="absolute inset-8 sm:inset-14 md:inset-20 pointer-events-none rounded-2xl border border-white/25 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex items-center justify-center">
                {/* Corner Brackets */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-brand-400 rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-brand-400 rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-brand-400 rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-brand-400 rounded-br-xl" />

                {/* Focus Crosshair */}
                <div className="w-6 h-6 border border-brand-400/50 rounded-full flex items-center justify-center opacity-60">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                </div>
              </div>

              {/* Top Viewfinder Floating Pill */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 text-[11px] text-slate-200 font-medium shadow-md flex items-center gap-2 pointer-events-none">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Align product inside frame</span>
              </div>

              {/* Mobile Viewfinder Flip Button */}
              <button
                type="button"
                onClick={handleSwitchCamera}
                className="absolute top-4 right-4 sm:hidden z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/85 backdrop-blur-md border border-white/15 text-xs text-white font-semibold shadow-lg active:scale-95 transition-transform"
              >
                <RefreshCw className="w-3.5 h-3.5 text-brand-400" />
                <span>{activeFacing === 'rear' ? 'Rear' : 'Front'}</span>
              </button>
            </>
          )}

          {/* Captured Photo Review Overlay - sits on top without destroying the video element */}
          {capturedPreview && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950 p-2 sm:p-4 animate-in fade-in duration-100">
              <img
                src={capturedPreview}
                alt="Captured Product"
                className="w-full h-full object-contain rounded-xl shadow-2xl select-none"
              />
              <div className="absolute top-4 left-1/2 -translate-x-1/2 px-3.5 py-1.5 rounded-full bg-slate-900/90 border border-slate-700/80 text-white text-xs font-medium shadow-lg backdrop-blur-md flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-brand-400" />
                <span>Photo captured • Check clarity before saving</span>
              </div>
            </div>
          )}

          {/* Error & Fallback View */}
          {error && !capturedPreview && (
            <div className="absolute inset-0 z-25 flex items-center justify-center bg-slate-950 p-8">
              <div className="text-center space-y-4 max-w-md mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mx-auto flex items-center justify-center shadow-lg">
                  <AlertCircle className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white mb-1">Camera Notice</h4>
                  <p className="text-xs text-slate-400 leading-relaxed">{error}</p>
                </div>

                {onSwitchToNativeCamera && (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onSwitchToNativeCamera();
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold shadow-lg shadow-brand-600/30 transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4" /> Open Native Phone Camera
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Loading State Overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center gap-3 z-30">
              <Loader2 className="w-10 h-10 text-brand-500 animate-spin" />
              <span className="text-sm text-slate-200 font-semibold tracking-wide">
                Initializing Camera...
              </span>
              <span className="text-xs text-slate-500">Auto-focusing lens</span>
            </div>
          )}
        </div>

        {/* Footer Control Bar */}
        <div className="px-6 py-4 sm:py-5 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/80 shrink-0 z-30">
          {capturedPreview ? (
            /* Review Actions */
            <div className="max-w-md mx-auto w-full flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleRetake}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-all cursor-pointer border border-slate-700 active:scale-95 shadow-sm"
              >
                <RotateCcw className="w-4 h-4" /> Retake Photo
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white text-xs sm:text-sm font-bold shadow-xl shadow-brand-600/30 transition-all cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" /> Use This Photo
              </button>
            </div>
          ) : (
            /* Live Camera Controls with Big Shutter */
            <div className="relative flex items-center justify-between max-w-2xl mx-auto w-full">
              {/* Left Action: Fallback / Native Camera */}
              <div className="w-28 text-left">
                {onSwitchToNativeCamera ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleClose();
                      onSwitchToNativeCamera();
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                    title="Open device native camera app"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Phone Camera</span>
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-500">HD 1080p</span>
                )}
              </div>

              {/* Center: Tactile Shutter Button */}
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={handleSnap}
                  disabled={isLoading || !!error}
                  className="group relative w-18 h-18 sm:w-20 sm:h-20 rounded-full border-4 border-white/80 p-1 flex items-center justify-center hover:scale-105 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xl shadow-brand-500/20"
                  title="Snap Photo"
                >
                  <div className="w-full h-full rounded-full bg-linear-to-tr from-brand-600 to-brand-500 group-hover:from-brand-500 group-hover:to-brand-400 flex items-center justify-center shadow-inner transition-colors">
                    <Camera className="w-7 h-7 sm:w-8 sm:h-8 text-white group-hover:scale-110 transition-transform" />
                  </div>
                </button>
              </div>

              {/* Right Action: Quick Flip or Cancel */}
              <div className="w-28 text-right flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleSwitchCamera}
                  className="sm:flex hidden items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Switch camera"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-brand-400" />
                  <span>Flip</span>
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer sm:hidden"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
