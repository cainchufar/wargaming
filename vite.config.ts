import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

const CESIUM_STATIC_DIRS = ['Assets', 'ThirdParty', 'Widgets', 'Workers'];

function cesiumStaticAssetsPlugin(): Plugin {
  const cesiumBuildRoot = path.resolve(__dirname, 'node_modules/cesium/Build/Cesium');

  return {
    name: 'cesium-static-assets',
    configureServer(server) {
      server.middlewares.use('/cesium', (req, res, next) => {
        const rawUrl = (req.url || '/').split('?')[0];
        const normalized = path.normalize(decodeURIComponent(rawUrl)).replace(/^(\.\.[/\\])+/, '');
        const filePath = path.join(cesiumBuildRoot, normalized);

        if (!filePath.startsWith(cesiumBuildRoot) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          next();
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.js': 'application/javascript; charset=utf-8',
          '.mjs': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.wasm': 'application/wasm',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.svg': 'image/svg+xml',
          '.gif': 'image/gif',
          '.glsl': 'text/plain; charset=utf-8',
          '.xml': 'application/xml',
          '.woff': 'font/woff',
          '.woff2': 'font/woff2',
        };

        res.setHeader('Content-Type', mimeMap[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        fs.createReadStream(filePath).pipe(res);
      });
    },
    closeBundle(error?: Error): void {
      if (error) {
        return;
      }
      const distCesium = path.resolve(__dirname, 'dist/cesium');
      if (!fs.existsSync(cesiumBuildRoot)) {
        return;
      }
      fs.mkdirSync(distCesium, { recursive: true });
      for (const dir of CESIUM_STATIC_DIRS) {
        const src = path.join(cesiumBuildRoot, dir);
        const dest = path.join(distCesium, dir);
        if (fs.existsSync(src)) {
          fs.cpSync(src, dest, { recursive: true, force: true });
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      cesiumStaticAssetsPlugin(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.join(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    optimizeDeps: {
      include: ['cesium'],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
