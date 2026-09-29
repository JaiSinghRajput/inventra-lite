import { defineConfig } from 'vite';
import tsConfigPaths from 'vite-tsconfig-paths';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';

export default defineConfig({
  plugins: [
    tsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart({
      srcDirectory: 'src',
      router: {
        entry: 'app/router.tsx',
        routesDirectory: 'app/routes',
        generatedRouteTree: 'app/routeTree.gen.ts',
      },
      client: {
        entry: 'app/client.tsx',
      },
      server: {
        entry: 'app/ssr.tsx',
      },
    }),
    nitro({
      preset: process.env.VERCEL ? 'vercel' : undefined,
    }),
    viteReact(),
  ],
});

