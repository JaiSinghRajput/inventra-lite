import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads .env variables into process.env if they are not already defined.
 * Safe to call across Node runtimes, Vite dev server, SSR, and production.
 */
export function loadEnvSync() {
  if (typeof process === 'undefined' || !process.cwd) return;
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (process.env[key] === undefined || process.env[key] === '') {
            process.env[key] = val;
          }
        }
      }
    }
  } catch {
    // Non-fatal fallback for read-only or serverless environments
  }
}

// Execute immediately upon module import
loadEnvSync();
