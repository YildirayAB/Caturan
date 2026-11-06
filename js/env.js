/**
 * Konfigurasi Runtime Environment Caturan
 * - Saat berjalan secara lokal via `node dev-server.js` (`npm run dev`), endpoint `/js/env.js`
 *   disajikan secara dinamis di memori dari `.env.local` / `process.env`
 *   tanpa pernah menyimpan kredensial ke file di repository.
 * - Saat di-build untuk production (`npm run build`), `scripts/generate-env.js`
 *   menghasilkan `dist/js/env.js` secara mandiri untuk static deployment.
 */
if (typeof window !== 'undefined') {
  window.__CATURAN_ENV__ = window.__CATURAN_ENV__ || {
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_PUBLISHABLE_KEY: ''
  };
}
