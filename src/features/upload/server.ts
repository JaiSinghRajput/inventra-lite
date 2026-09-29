import { createServerFn } from '@tanstack/react-start';
import { resolveTenantContext } from '../auth/middleware';

export const getCloudinaryConfigFn = createServerFn({ method: 'GET' }).handler(async () => {
  await resolveTenantContext();

  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    uploadPreset: process.env.CLOUDINARY_UPLOAD_PRESET || '',
    isConfigured: !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_UPLOAD_PRESET),
  };
});
