/**
 * Script Build Environment untuk Deployment (Vercel / CI)
 * Menyuntikkan VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY dari
 * environment variables saat proses build berlangsung di server deployment.
 * JANGAN mencetak nilai kredensial ke log konsol.
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

export function loadPublicEnv(customRoot = rootDir) {
  const envFile = parseEnvFile(path.join(customRoot, '.env'));
  const envLocalFile = parseEnvFile(path.join(customRoot, '.env.local'));

  const supabaseUrl =
    process.env.VITE_SUPABASE_URL ||
    envLocalFile.VITE_SUPABASE_URL ||
    envFile.VITE_SUPABASE_URL ||
    '';

  const supabasePublishableKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    envLocalFile.VITE_SUPABASE_PUBLISHABLE_KEY ||
    envFile.VITE_SUPABASE_PUBLISHABLE_KEY ||
    '';

  return {
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey
  };
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isMain) {
  // Hanya tulis nilai environment ke js/env.js saat berjalan di CI / Vercel
  // atau jika flag --write diberikan secara eksplisit, agar working tree lokal tetap bersih dari rahasia.
  const isDeploymentBuild =
    Boolean(process.env.VERCEL) ||
    Boolean(process.env.CI) ||
    process.argv.includes('--write');

  if (isDeploymentBuild) {
    const envVars = loadPublicEnv();
    const targetPath = path.join(rootDir, 'js', 'env.js');
    const jsContent = `window.__CATURAN_ENV__ = ${JSON.stringify(envVars, null, 2)};\n`;
    fs.writeFileSync(targetPath, jsContent, 'utf8');
    console.log(
      '[Caturan Build] Konfigurasi runtime js/env.js berhasil disiapkan untuk deployment.'
    );
  } else {
    console.log(
      '[Caturan Build] Mode lokal terdeteksi: server.js akan menyajikan /js/env.js secara dinamis dari .env.local.'
    );
  }
}
