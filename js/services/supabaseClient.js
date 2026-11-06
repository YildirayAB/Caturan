/**
 * Layanan Inisialisasi Supabase Client — Caturan
 * Menggunakan @supabase/supabase-js dengan konfigurasi variabel environment:
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Keamanan:
 * - Hanya menerima publishable / anon key publik.
 * - Menolak penggunaan service_role key atau secret key di sisi klien.
 */

import { createClient } from '../vendor/supabase.js';

export const AUTH_STORAGE_KEY = 'caturan_supabase_auth_v1';

/**
 * Mengambil konfigurasi Supabase dari berbagai sumber runtime:
 * 1. import.meta.env (Vite / bundler)
 * 2. window.__CATURAN_ENV__ (server.js lokal / build Vercel)
 * 3. process.env (pengujian Node.js)
 */
export function getSupabaseConfig(overrideEnv = null) {
  const metaEnv =
    typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
  const winEnv =
    typeof window !== 'undefined' && window.__CATURAN_ENV__
      ? window.__CATURAN_ENV__
      : {};
  const procEnv =
    typeof globalThis !== 'undefined' &&
    globalThis.process &&
    globalThis.process.env
      ? globalThis.process.env
      : {};

  const source = overrideEnv || {
    VITE_SUPABASE_URL:
      metaEnv.VITE_SUPABASE_URL ||
      winEnv.VITE_SUPABASE_URL ||
      procEnv.VITE_SUPABASE_URL ||
      '',
    VITE_SUPABASE_PUBLISHABLE_KEY:
      metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
      winEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
      procEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
      ''
  };

  const url = typeof source.VITE_SUPABASE_URL === 'string' ? source.VITE_SUPABASE_URL.trim() : '';
  const publishableKey =
    typeof source.VITE_SUPABASE_PUBLISHABLE_KEY === 'string'
      ? source.VITE_SUPABASE_PUBLISHABLE_KEY.trim()
      : '';

  // Proteksi keamanan: tolak jika mendeteksi secret key / service_role key
  if (publishableKey.startsWith('sb_secret_')) {
    console.error(
      '[Keamanan Caturan] Terdeteksi secret key pada VITE_SUPABASE_PUBLISHABLE_KEY. Gunakan publishable/anon key saja.'
    );
    return {
      url: '',
      publishableKey: '',
      isConfigured: false,
      configError: 'Konfigurasi kunci keamanan tidak valid (jangan gunakan secret key di klien).'
    };
  }

  // Periksa payload JWT jika berformat JWT (pastikan bukan role: service_role)
  if (publishableKey.split('.').length === 3) {
    try {
      const payloadBase64 = publishableKey.split('.')[1];
      const decoded =
        typeof atob === 'function'
          ? atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'))
          : typeof Buffer !== 'undefined'
            ? Buffer.from(payloadBase64, 'base64').toString('utf8')
            : '';
      if (decoded) {
        const claims = JSON.parse(decoded);
        if (claims && claims.role === 'service_role') {
          console.error(
            '[Keamanan Caturan] Dilarang menggunakan service_role key di frontend!'
          );
          return {
            url: '',
            publishableKey: '',
            isConfigured: false,
            configError: 'Dilarang menggunakan service_role key pada aplikasi frontend.'
          };
        }
      }
    } catch {
      // Abaikan jika bukan format JSON JWT standar (mis. sb_publishable_*)
    }
  }

  const isPlaceholderKey =
    !publishableKey ||
    publishableKey === 'your_supabase_publishable_or_anon_key_here' ||
    publishableKey.includes('placeholder');

  const isValidUrl = /^https?:\/\/.+/.test(url);
  const isConfigured = Boolean(isValidUrl && !isPlaceholderKey);

  return {
    url,
    publishableKey,
    isConfigured,
    configError: isConfigured
      ? null
      : 'Konfigurasi VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY belum diatur di .env.local.'
  };
}

let activeClient = null;
let customClientOverride = null;

/**
 * Membuat instance Supabase client baru
 */
export function createSupabaseClientInstance(customEnv = null, customOptions = {}) {
  const { url, publishableKey, isConfigured } = getSupabaseConfig(customEnv);
  if (!isConfigured) {
    return null;
  }

  const authStorage =
    customOptions.storage ||
    (typeof window !== 'undefined' && window.localStorage ? window.localStorage : undefined);

  return createClient(url, publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: typeof window !== 'undefined',
      storageKey: AUTH_STORAGE_KEY,
      ...(authStorage ? { storage: authStorage } : {}),
      ...(customOptions.auth || {})
    },
    ...(customOptions.global ? { global: customOptions.global } : {})
  });
}

/**
 * Mengambil singleton Supabase client aktif
 */
export function getSupabaseClient() {
  if (customClientOverride) {
    return customClientOverride;
  }
  if (!activeClient) {
    activeClient = createSupabaseClientInstance();
  }
  return activeClient;
}

/**
 * Mengatur override client (khusus untuk pengujian unit/integrasi)
 */
export function setSupabaseClientForTesting(mockClient) {
  customClientOverride = mockClient;
}

/**
 * Me-reset instance client agar membaca ulang konfigurasi environment
 */
export function resetSupabaseClient() {
  activeClient = null;
  customClientOverride = null;
}

export const supabase = getSupabaseClient();
export default getSupabaseClient;
