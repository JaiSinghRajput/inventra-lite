/**
 * Client-side high-efficiency image compression using HTML5 Canvas.
 * Resizes large camera photos down to maximum display bounds and compresses to WebP/JPEG.
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savedPercentage: number;
  previewUrl: string;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (default: 0.8)
  format?: 'image/webp' | 'image/jpeg';
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1000,
    maxHeight = 1000,
    quality = 0.8,
    format = 'image/webp',
  } = options;

  return new Promise((resolve, reject) => {
    // If not an image, reject
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Calculate aspect-ratio preserved dimensions
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to obtain canvas rendering context'));
          return;
        }

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Canvas image compression failed'));
              return;
            }

            const extension = format === 'image/webp' ? 'webp' : 'jpg';
            const fileName = file.name.replace(/\.[^/.]+$/, '') + `_compressed.${extension}`;
            const compressedFile = new File([blob], fileName, {
              type: format,
              lastModified: Date.now(),
            });

            const originalSize = file.size;
            const compressedSize = compressedFile.size;
            const savedPercentage = Math.max(
              0,
              Math.round(((originalSize - compressedSize) / originalSize) * 100)
            );
            const previewUrl = URL.createObjectURL(blob);

            resolve({
              file: compressedFile,
              originalSize,
              compressedSize,
              savedPercentage,
              previewUrl,
            });
          },
          format,
          quality
        );
      };

      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
