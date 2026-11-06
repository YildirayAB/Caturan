/**
 * Layanan Autentikasi Privat & Manajemen Sesi — Caturan
 * Menggunakan Supabase Auth (Email & Password):
 * - Satu akun privat pemilik (dibuat melalui Supabase Dashboard).
 * - Tidak menyediakan registrasi publik atau login anonim.
 * - Tidak pernah menyimpan password di LocalStorage atau melakukan hardcode kredensial.
 */

import { getSupabaseClient, getSupabaseConfig } from './supabaseClient.js';

/**
 * Menerjemahkan pesan error Supabase Auth ke Bahasa Indonesia yang sopan dan jelas
 */
export function translateAuthError(error) {
  if (!error) return 'Terjadi kendala saat memproses autentikasi. Silakan coba kembali.';

  const rawMsg = (error.message || error.error_description || String(error)).toLowerCase();

  if (
    rawMsg.includes('invalid login credentials') ||
    rawMsg.includes('invalid_credentials') ||
    rawMsg.includes('invalid email or password')
  ) {
    return 'Email atau kata sandi yang Anda masukkan tidak sesuai. Silakan periksa kembali.';
  }

  if (rawMsg.includes('email not confirmed')) {
    return 'Alamat email akun ini belum dikonfirmasi di Supabase Dashboard.';
  }

  if (rawMsg.includes('too many requests') || rawMsg.includes('rate limit')) {
    return 'Terlalu banyak percobaan dalam waktu singkat. Mohon tunggu beberapa saat sebelum mencoba lagi.';
  }

  if (
    rawMsg.includes('failed to fetch') ||
    rawMsg.includes('networkerror') ||
    rawMsg.includes('network request failed')
  ) {
    return 'Tidak dapat terhubung ke server autentikasi. Periksa koneksi internet Anda lalu coba kembali.';
  }

  if (rawMsg.includes('belum diatur') || rawMsg.includes('belum terkonfigurasi')) {
    return error.message;
  }

  return 'Gagal masuk ke akun Caturan. Pastikan email serta kata sandi sudah benar.';
}

export class AuthService {
  constructor(clientGetter = getSupabaseClient) {
    this._getClient = clientGetter;
    this._session = null;
    this._user = null;
    this._initialized = false;
    this._authSubscription = null;
    this._listeners = [];
  }

  /**
   * Inisialisasi sesi awal menggunakan supabase.auth.getSession()
   * dan mendengarkan perubahan menggunakan supabase.auth.onAuthStateChange()
   */
  async initSession() {
    const client = this._getClient();
    if (!client || !client.auth) {
      this._session = null;
      this._user = null;
      this._initialized = true;
      this._notify('INITIAL_SESSION', null);
      return { session: null, user: null, error: getSupabaseConfig().configError };
    }

    // Pasang listener onAuthStateChange satu kali
    if (!this._authSubscription && typeof client.auth.onAuthStateChange === 'function') {
      const { data } = client.auth.onAuthStateChange((event, session) => {
        this._session = session || null;
        this._user = session?.user || null;
        this._notify(event, this._session);
      });
      this._authSubscription = data?.subscription || null;
    }

    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        this._session = null;
        this._user = null;
        this._initialized = true;
        this._notify('SIGNED_OUT', null);
        return { session: null, user: null, error: translateAuthError(error) };
      }

      this._session = data?.session || null;
      this._user = data?.session?.user || null;
      this._initialized = true;
      this._notify('INITIAL_SESSION', this._session);
      return { session: this._session, user: this._user, error: null };
    } catch (err) {
      this._session = null;
      this._user = null;
      this._initialized = true;
      this._notify('SIGNED_OUT', null);
      return { session: null, user: null, error: translateAuthError(err) };
    }
  }

  isAuthenticated() {
    return Boolean(this._session && this._user && this._user.id);
  }

  getSession() {
    return this._session;
  }

  getUser() {
    return this._user;
  }

  /**
   * Masuk menggunakan email dan password (supabase.auth.signInWithPassword)
   */
  async signInWithPassword(email, password) {
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    const rawPassword = typeof password === 'string' ? password : '';

    if (!cleanEmail) {
      return {
        ok: false,
        session: null,
        user: null,
        error: 'Mohon masukkan alamat email Anda.'
      };
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        ok: false,
        session: null,
        user: null,
        error: 'Format alamat email belum valid. Contoh: nama@email.com.'
      };
    }

    if (!rawPassword) {
      return {
        ok: false,
        session: null,
        user: null,
        error: 'Mohon masukkan kata sandi Anda.'
      };
    }

    const client = this._getClient();
    if (!client || !client.auth) {
      const cfg = getSupabaseConfig();
      return {
        ok: false,
        session: null,
        user: null,
        error:
          cfg.configError ||
          'Layanan autentikasi Supabase belum terkonfigurasi pada environment ini.'
      };
    }

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email: cleanEmail,
        password: rawPassword
      });

      if (error || !data?.session || !data?.user) {
        return {
          ok: false,
          session: null,
          user: null,
          error: translateAuthError(error)
        };
      }

      this._session = data.session;
      this._user = data.user;
      return {
        ok: true,
        session: data.session,
        user: data.user,
        error: null
      };
    } catch (err) {
      return {
        ok: false,
        session: null,
        user: null,
        error: translateAuthError(err)
      };
    }
  }

  /**
   * Mengirimkan tautan pemulihan kata sandi melalui email (Lupa Password)
   */
  async resetPasswordForEmail(email) {
    const cleanEmail = typeof email === 'string' ? email.trim() : '';
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return {
        ok: false,
        error: 'Masukkan alamat email akun yang valid terlebih dahulu untuk mengatur ulang kata sandi.'
      };
    }

    const client = this._getClient();
    if (!client || !client.auth) {
      return {
        ok: false,
        error: 'Layanan autentikasi Supabase belum terkonfigurasi.'
      };
    }

    try {
      const redirectTo =
        typeof window !== 'undefined' && window.location ? window.location.origin : undefined;
      const { error } = await client.auth.resetPasswordForEmail(
        cleanEmail,
        redirectTo ? { redirectTo } : undefined
      );

      if (error) {
        return {
          ok: false,
          error: translateAuthError(error)
        };
      }

      return {
        ok: true,
        message: `Instruksi pengaturan ulang kata sandi telah dikirimkan ke ${cleanEmail} apabila email terdaftar.`
      };
    } catch (err) {
      return {
        ok: false,
        error: translateAuthError(err)
      };
    }
  }

  /**
   * Keluar dari sesi aktif menggunakan supabase.auth.signOut()
   */
  async signOut() {
    const client = this._getClient();
    this._session = null;
    this._user = null;

    if (client && client.auth && typeof client.auth.signOut === 'function') {
      try {
        await client.auth.signOut();
      } catch (err) {
        console.warn('Peringatan saat signOut:', err);
      }
    }

    this._notify('SIGNED_OUT', null);
    return { ok: true };
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this._listeners.push(callback);
    }
    return () => {
      this._listeners = this._listeners.filter(cb => cb !== callback);
    };
  }

  _notify(event, session) {
    for (const cb of this._listeners) {
      try {
        cb(event, session, this._user);
      } catch (err) {
        console.error('Error pada auth listener:', err);
      }
    }
  }
}

export const authService = new AuthService();
export default authService;
