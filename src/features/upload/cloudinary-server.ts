import crypto from 'node:crypto';

/**
 * Extracts Cloudinary public_id from a Cloudinary image URL.
 * Supports URLs with versioning (e.g. /v12345/...) and nested folders (e.g. inventra_products/...).
 */
export function extractCloudinaryPublicId(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  if (!url.includes('cloudinary.com')) return null;

  try {
    const parsed = new URL(url);
    const uploadIndex = parsed.pathname.indexOf('/image/upload/');
    if (uploadIndex === -1) return null;

    const pathAfterUpload = parsed.pathname.substring(uploadIndex + '/image/upload/'.length);
    const segments = pathAfterUpload.split('/').filter(Boolean);
    if (segments.length === 0) return null;

    // Look for version segment (v followed by digits)
    const versionIdx = segments.findIndex((seg) => /^v\d+$/.test(seg));
    let remainingSegments: string[];

    if (versionIdx !== -1) {
      remainingSegments = segments.slice(versionIdx + 1);
    } else {
      // If no version segment, filter out transformation segments (e.g. c_fill,w_300)
      remainingSegments = segments.filter(
        (seg) => !seg.includes(',') && !/^[a-z]_[a-z0-9]+/i.test(seg)
      );
    }

    let publicId = remainingSegments.join('/');

    // Strip file extension (.jpg, .png, .webp, etc.)
    const dotIndex = publicId.lastIndexOf('.');
    if (dotIndex !== -1) {
      publicId = publicId.substring(0, dotIndex);
    }

    return publicId.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Deletes an image from Cloudinary using the secure authenticated Destroy API.
 * Requires CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.
 */
export async function deleteFromCloudinary(imageUrl?: string | null): Promise<{
  success: boolean;
  result?: string;
  reason?: string;
}> {
  if (!imageUrl) {
    return { success: false, reason: 'No image URL provided' };
  }

  const publicId = extractCloudinaryPublicId(imageUrl);
  if (!publicId) {
    return { success: false, reason: 'Not a recognized Cloudinary image URL' };
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn(
      `[Cloudinary] Cannot delete image "${publicId}" because CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET is not configured in environment variables.`
    );
    return {
      success: false,
      reason: 'Missing CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET in environment',
    };
  }

  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    // Signature string for destroy endpoint: parameters sorted alphabetically
    const stringToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(stringToSign).digest('hex');

    const formData = new URLSearchParams();
    formData.append('public_id', publicId);
    formData.append('timestamp', timestamp);
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    const data = await response.json().catch(() => ({}));
    if (data.result === 'ok') {
      console.log(`[Cloudinary] Successfully deleted image "${publicId}"`);
      return { success: true, result: data.result };
    } else {
      console.warn(`[Cloudinary] Destroy API returned status:`, data);
      return { success: false, result: data.result || 'failed' };
    }
  } catch (err: any) {
    console.error(`[Cloudinary] Failed to delete image "${publicId}":`, err);
    return { success: false, reason: err?.message || 'Network request failed' };
  }
}
