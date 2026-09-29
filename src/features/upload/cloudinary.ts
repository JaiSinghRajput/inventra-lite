/**
 * Uploads a compressed file/blob directly to Cloudinary using unsigned upload preset.
 */

export interface CloudinaryUploadResponse {
  secure_url: string;
  public_id: string;
  format: string;
  bytes: number;
}

export async function uploadToCloudinary(
  file: Blob | File,
  cloudName: string,
  uploadPreset: string
): Promise<string> {
  if (!cloudName || !uploadPreset) {
    throw new Error('Cloudinary cloud name and upload preset are required.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', 'inventra_products');

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

  const response = await fetch(endpoint, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Cloudinary upload failed with status ${response.status}`
    );
  }

  const data: CloudinaryUploadResponse = await response.json();
  return data.secure_url;
}
