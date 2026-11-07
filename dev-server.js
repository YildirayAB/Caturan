/**
 * Development Server Lokal — Caturan
 * Digunakan khusus untuk pengembangan lokal (`npm run dev` / `npm start`) di http://localhost:3000.
 * Menyajikan file statis frontend, endpoint dinamis `/js/env.js` dari `.env.local`,
 * serta memblokir akses HTTP langsung ke file sensitif dan direktori internal.
 *
 * Catatan: Untuk deployment production di Vercel, Caturan di-build sebagai
 * static website murni ke direktori `dist/` melalui `npm run build`.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPublicEnv } from './scripts/generate-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

export const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

export function handleRequest(req, res) {
  const urlPath = (req.url || '/').split('?')[0];

  // Sajikan konfigurasi environment publik secara dinamis dari .env.local / process.env saat development
  if (urlPath === '/js/env.js') {
    const publicEnv = loadPublicEnv(__dirname);
    const body = `window.__CATURAN_ENV__ = ${JSON.stringify(publicEnv)};\n`;
    res.writeHead(200, {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-store'
    });
    res.end(body);
    return;
  }

  const relativePath = urlPath === '/' ? 'index.html' : urlPath.replace(/^\/+/, '');
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');

  // Blokir akses HTTP langsung ke file konfigurasi sensitif & direktori internal
  const normalizedForward = safePath.replace(/\\/g, '/');
  if (
    normalizedForward.startsWith('.env') ||
    normalizedForward.startsWith('.git') ||
    normalizedForward.startsWith('supabase/') ||
    normalizedForward.startsWith('scripts/') ||
    normalizedForward === 'dev-server.js' ||
    normalizedForward === 'package.json' ||
    normalizedForward === 'package-lock.json' ||
    normalizedForward === 'vercel.json'
  ) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 - Akses ditolak');
    return;
  }

  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 - File tidak ditemukan');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('500 - Kesalahan server internal');
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
}

export const server = http.createServer(handleRequest);

const isMainModule =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMainModule) {
  server.listen(PORT, () => {
    console.log(`Caturan Development Server berjalan di http://localhost:${PORT}`);
  });
}
