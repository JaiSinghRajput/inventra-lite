/// <reference types="vite/client" />

// Ensure Buffer is safely polyfilled in browser environments
if (typeof globalThis !== 'undefined' && typeof (globalThis as any).Buffer === 'undefined') {
  const encoder = new TextEncoder();
  (globalThis as any).Buffer = {
    isBuffer: (b: any) => b instanceof Uint8Array,
    from: (val: any) => {
      if (val instanceof Uint8Array) return val;
      if (typeof val === 'string') return encoder.encode(val);
      if (Array.isArray(val)) return new Uint8Array(val);
      return new Uint8Array(val || 0);
    },
    alloc: (size: number) => new Uint8Array(size),
    allocUnsafe: (size: number) => new Uint8Array(size),
    concat: (list: Uint8Array[]) => {
      const totalLen = list.reduce((acc, curr) => acc + (curr?.length || 0), 0);
      const res = new Uint8Array(totalLen);
      let offset = 0;
      for (const item of list) {
        if (item) {
          res.set(item, offset);
          offset += item.length;
        }
      }
      return res;
    },
    byteLength: (str: string) => encoder.encode(str || '').length,
  };
}

import { hydrateRoot } from 'react-dom/client';
import { StartClient } from '@tanstack/react-start/client';
import '../styles/app.css';

hydrateRoot(document, <StartClient />);

if (typeof window !== 'undefined' && 'serviceWorker' in navigator && process.env.NODE_ENV !== 'test') {
  if (process.env.NODE_ENV === 'development') {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
  } else {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[PWA] ServiceWorker registration failed:', err);
      });
    });
  }
}

