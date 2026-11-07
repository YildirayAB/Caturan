/**
 * Script Static Website Build & Environment Generator — Caturan
 *
 * Saat dijalankan melalui `npm run build` (`node scripts/generate-env.js`):
 * 1. Membuat direktori output statis `dist/` yang bersih.
 * 2. Menyalin hanya aset frontend yang diperlukan:
 *    - index.html
 *    - css/
 *    - js/ (main.js, components/, services/, data/, vendor/)
 * 3. Menghasilkan `dist/js/env.js` berdasarkan variabel environment:
 *    - VITE_SUPABASE_URL
 *    - VITE_SUPABASE_PUBLISHABLE_KEY
 * 4. Memastikan tidak ada file sensitif (.env*, supabase/, node_modules/, .git/,
 *    dev-server.js, package.json, README.md) atau service_role/secret key di dalam `dist/`.
 * 5. Tidak pernah mencetak nilai kredensial ke output log.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function parseEnvFile(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const content = fs.readFileSync(filePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.slice(0, eqIdx).trim();
    let val = line.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    result[key] = val;
  }
  return result;
}

/**
 * Validasi keamanan: pastikan kunci yang diberikan bukan secret key atau service_role key
 */
export function isForbiddenSecretKey(key) {
  if (typeof key !== 'string' || !key.trim()) return false;
  const trimmed = key.trim();
  if (trimmed.startsWith('sb_secret_')) return true;

  if (trimmed.split('.').length === 3) {
    try {
      const payload = Buffer.from(trimmed.split('.')[1], 'base64url').toString('utf8');
      const claims = JSON.parse(payload);
      if (claims && claims.role === 'service_role') {
        return true;
      }
    } catch {
      // Abaikan jika bukan format JWT
    }
  }
  return false;
}

/**
 * Memuat variabel environment publik untuk development server maupun static build
 */
export function loadPublicEnv(customRoot = rootDir) {
  const envFile = parseEnvFile(path.join(customRoot, '.env'));
  const envLocalFile = parseEnvFile(path.join(customRoot, '.env.local'));

  const supabaseUrl = (
    process.env.VITE_SUPABASE_URL ||
    envLocalFile.VITE_SUPABASE_URL ||
    envFile.VITE_SUPABASE_URL ||
    ''
  ).trim();

  const rawPublishableKey = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    envLocalFile.VITE_SUPABASE_PUBLISHABLE_KEY ||
    envFile.VITE_SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

  if (isForbiddenSecretKey(rawPublishableKey)) {
    throw new Error(
      '[Keamanan Caturan] Terdeteksi service_role / secret key pada VITE_SUPABASE_PUBLISHABLE_KEY! Gunakan Publishable / Anon Key saja.'
    );
  }

  return {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: rawPublishableKey
  };
}

/**
 * Menyalin direktori secara rekursif khusus untuk file aset frontend (.css, .js, .svg, .png, .ico)
 */
function copyDirectoryFiltered(srcDir, destDir, allowedExtensions) {
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Direktori sumber tidak ditemukan: ${srcDir}`);
  }
  fs.mkdirSync(destDir, { recursive: true });

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    // Jangan pernah menyalin file tersembunyi (.env*, .git*, .DS_Store)
    if (entry.name.startsWith('.')) continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryFiltered(srcPath, destPath, allowedExtensions);
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (allowedExtensions.has(ext)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

/**
 * Menjalankan proses build static website ke dalam direktori `dist/`
 */
export function buildStaticSite(customRoot = rootDir) {
  const distDir = path.join(customRoot, 'dist');

  // 1. Bersihkan direktori dist/ lama jika ada
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 2. Salin index.html
  const indexSrc = path.join(customRoot, 'index.html');
  if (!fs.existsSync(indexSrc)) {
    throw new Error('File index.html tidak ditemukan pada root proyek.');
  }
  fs.copyFileSync(indexSrc, path.join(distDir, 'index.html'));

  // 3. Salin direktori css/
  copyDirectoryFiltered(
    path.join(customRoot, 'css'),
    path.join(distDir, 'css'),
    new Set(['.css'])
  );

  // 4. Salin direktori js/ (components, services, data, vendor, main.js)
  copyDirectoryFiltered(
    path.join(customRoot, 'js'),
    path.join(distDir, 'js'),
    new Set(['.js', '.mjs', '.json'])
  );

  // 5. Hasilkan dist/js/env.js dari variabel environment tanpa memodifikasi js/env.js di source
  const publicEnv = loadPublicEnv(customRoot);
  const envJsTarget = path.join(distDir, 'js', 'env.js');
  const envJsContent = [
    '/**',
    ' * Konfigurasi Runtime Environment Caturan (Static Production Build)',
    ' * Dihasilkan secara otomatis saat menjalankan `npm run build`.',
    ' */',
    `window.__CATURAN_ENV__ = ${JSON.stringify(publicEnv, null, 2)};`,
    ''
  ].join('\n');

  fs.writeFileSync(envJsTarget, envJsContent, 'utf8');

  const hasUrl = Boolean(publicEnv.VITE_SUPABASE_URL);
  const hasKey = Boolean(publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY);

  return {
    distDir,
    hasUrl,
    hasKey
  };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  try {
    const result = buildStaticSite(rootDir);
    console.log('[Caturan Build] Static website berhasil dibuat pada direktori: dist/');
    console.log(
      `[Caturan Build] Status variabel environment: VITE_SUPABASE_URL=${
        result.hasUrl ? 'TERSEDIA' : 'KOSONG'
      }, VITE_SUPABASE_PUBLISHABLE_KEY=${result.hasKey ? 'TERSEDIA' : 'KOSONG'}`
    );
  } catch (err) {
    console.error('[Caturan Build] Gagal menjalankan build:', err.message);
    process.exit(1);
  }
}
