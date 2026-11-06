/**
 * Konfigurasi Runtime Environment Caturan
 * - Saat berjalan secara lokal via `node server.js`, endpoint `/js/env.js`
 *   disajikan secara dinamis di memori dari `.env.local` / `process.env`
 *   tanpa pernah menyimpan kredensial ke file di repository.
 * - Saat di-deploy ke Vercel (`npm run build`), `scripts/generate-env.js`
 *   menyuntikkan variabel environment Vercel ke file build output.
 */
if (typeof window !== 'undefined') {
  window.__CATURAN_ENV__ = window.__CATURAN_ENV__ || {
    VITE_SUPABASE_URL: '',
    VITE_SUPABASE_PUBLISHABLE_KEY: ''
  };
}
