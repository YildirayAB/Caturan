/**
 * Komponen Halaman Login Privat — Caturan
 * Desain minimalis, kontras tinggi, tanpa gradient, mendukung Light Mode & Dark Mode.
 * Tidak menyediakan tombol Sign Up atau registrasi publik.
 */

import { UI_ICONS } from './icons.js';
import { themeService, THEME_DARK } from '../services/theme.js';

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderLoginView(
  container,
  {
    onLoginSubmit,
    onResetPassword,
    onToggleTheme,
    initialError = null,
    initialInfo = null
  } = {}
) {
  if (!container) return;

  const isDark = themeService.getTheme() === THEME_DARK;

  container.innerHTML = `
    <div class="auth-screen" data-testid="login-screen">
      <header class="auth-topbar">
        <div class="auth-brand-inline">
          <div class="brand-logo-box">
            ${UI_ICONS.logo}
          </div>
          <div class="brand-text">
            <span class="brand-name">Caturan</span>
            <span class="brand-subtitle">Tutor Catur Digital &amp; Kurikulum Interaktif</span>
          </div>
        </div>
        <button
          type="button"
          class="theme-toggle-btn"
          data-action="login-theme-toggle"
          aria-label="${isDark ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'}"
        >
          <span class="theme-icon">${isDark ? UI_ICONS.sun : UI_ICONS.moon}</span>
          <span class="theme-label">${isDark ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </header>

      <div class="auth-center-wrapper">
        <section class="card auth-card" aria-labelledby="login-heading">
          <div class="auth-card-header">
            <div class="auth-logo-hero">
              ${UI_ICONS.logo}
            </div>
            <span class="app-pill">AKSES PRIVAT CATURAN</span>
            <h1 id="login-heading" class="auth-title">Selamat Datang Kembali</h1>
            <p class="auth-subtitle">
              Masuk untuk melanjutkan dan menyinkronkan progres belajar catur lintas perangkat.
            </p>
          </div>

          <div
            id="login-feedback-banner"
            class="auth-feedback-banner ${initialError ? 'is-error' : initialInfo ? 'is-info' : 'is-hidden'}"
            role="alert"
            aria-live="polite"
            data-testid="login-feedback"
          >
            ${
              initialError
                ? escapeHtml(initialError)
                : initialInfo
                  ? escapeHtml(initialInfo)
                  : ''
            }
          </div>

          <form id="caturan-login-form" class="auth-form" novalidate>
            <div class="auth-field-group">
              <label for="login-email-input" class="auth-label">Alamat Email</label>
              <div class="auth-input-wrapper">
                <span class="auth-input-icon" aria-hidden="true">${UI_ICONS.mail}</span>
                <input
                  type="email"
                  id="login-email-input"
                  name="email"
                  class="auth-input"
                  placeholder="nama@email.com"
                  autocomplete="email"
                  required
                  data-testid="login-email"
                />
              </div>
            </div>

            <div class="auth-field-group">
              <div class="auth-label-row">
                <label for="login-password-input" class="auth-label">Kata Sandi</label>
                <button
                  type="button"
                  id="forgot-password-btn"
                  class="auth-link-btn"
                  data-testid="forgot-password-btn"
                >
                  Lupa Kata Sandi?
                </button>
              </div>
              <div class="auth-input-wrapper">
                <span class="auth-input-icon" aria-hidden="true">${UI_ICONS.lock}</span>
                <input
                  type="password"
                  id="login-password-input"
                  name="password"
                  class="auth-input has-trailing-btn"
                  placeholder="Masukkan kata sandi"
                  autocomplete="current-password"
                  required
                  data-testid="login-password"
                />
                <button
                  type="button"
                  id="toggle-password-visibility-btn"
                  class="auth-password-toggle"
                  aria-label="Tampilkan kata sandi"
                  title="Tampilkan / Sembunyikan Kata Sandi"
                  data-testid="toggle-password-btn"
                >
                  <span class="eye-icon-holder">${UI_ICONS.eye}</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="login-submit-btn"
              class="btn btn-primary auth-submit-btn"
              data-testid="login-submit"
            >
              <span class="submit-btn-text">Masuk ke Caturan</span>
              <span class="submit-btn-icon">${UI_ICONS.arrowRight}</span>
            </button>
          </form>

          <div class="auth-footer-note">
            <span class="storage-dot"></span>
            <span>Akun privat pemilik proyek • Dilindungi dengan Supabase Auth &amp; RLS</span>
          </div>
        </section>
      </div>
    </div>
  `;

  const form = container.querySelector('#caturan-login-form');
  const emailInput = container.querySelector('#login-email-input');
  const passwordInput = container.querySelector('#login-password-input');
  const togglePwdBtn = container.querySelector('#toggle-password-visibility-btn');
  const forgotPwdBtn = container.querySelector('#forgot-password-btn');
  const submitBtn = container.querySelector('#login-submit-btn');
  const feedbackBanner = container.querySelector('#login-feedback-banner');
  const themeBtn = container.querySelector('[data-action="login-theme-toggle"]');

  const showFeedback = (type, message) => {
    if (!feedbackBanner) return;
    if (!message) {
      feedbackBanner.className = 'auth-feedback-banner is-hidden';
      feedbackBanner.textContent = '';
      return;
    }
    feedbackBanner.className = `auth-feedback-banner ${
      type === 'error' ? 'is-error' : 'is-info'
    }`;
    feedbackBanner.textContent = message;
  };

  const setLoading = isLoading => {
    if (!submitBtn) return;
    submitBtn.disabled = isLoading;
    if (emailInput) emailInput.disabled = isLoading;
    if (passwordInput) passwordInput.disabled = isLoading;
    if (forgotPwdBtn) forgotPwdBtn.disabled = isLoading;

    const textEl = submitBtn.querySelector('.submit-btn-text');
    if (textEl) {
      textEl.textContent = isLoading ? 'Memverifikasi Akun...' : 'Masuk ke Caturan';
    }
  };

  // Toggle Show / Hide Password
  if (togglePwdBtn && passwordInput) {
    togglePwdBtn.addEventListener('click', () => {
      const isCurrentlyHidden = passwordInput.getAttribute('type') === 'password';
      const nextType = isCurrentlyHidden ? 'text' : 'password';
      passwordInput.setAttribute('type', nextType);
      togglePwdBtn.setAttribute(
        'aria-label',
        isCurrentlyHidden ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'
      );
      const iconHolder = togglePwdBtn.querySelector('.eye-icon-holder');
      if (iconHolder) {
        iconHolder.innerHTML = isCurrentlyHidden ? UI_ICONS.eyeOff : UI_ICONS.eye;
      }
    });
  }

  // Toggle Tema di Halaman Login
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      if (typeof onToggleTheme === 'function') {
        onToggleTheme();
      } else {
        themeService.toggleTheme();
      }
      const darkNow = themeService.getTheme() === THEME_DARK;
      themeBtn.innerHTML = `
        <span class="theme-icon">${darkNow ? UI_ICONS.sun : UI_ICONS.moon}</span>
        <span class="theme-label">${darkNow ? 'Light Mode' : 'Dark Mode'}</span>
      `;
      themeBtn.setAttribute(
        'aria-label',
        darkNow ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'
      );
    });
  }

  // Lupa Kata Sandi
  if (forgotPwdBtn) {
    forgotPwdBtn.addEventListener('click', async () => {
      const email = emailInput ? emailInput.value.trim() : '';
      if (!email) {
        showFeedback(
          'error',
          'Masukkan alamat email Anda pada kolom di atas terlebih dahulu, lalu klik "Lupa Kata Sandi?".'
        );
        if (emailInput && typeof emailInput.focus === 'function') {
          emailInput.focus();
        }
        return;
      }

      if (typeof onResetPassword === 'function') {
        setLoading(true);
        showFeedback('info', 'Mengirim permintaan pemulihan kata sandi...');
        try {
          const res = await onResetPassword(email);
          if (res && res.ok) {
            showFeedback('info', res.message);
          } else {
            showFeedback(
              'error',
              res?.error || 'Gagal mengirim tautan pemulihan kata sandi.'
            );
          }
        } finally {
          setLoading(false);
        }
      }
    });
  }

  // Submit Form Login
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      showFeedback(null, '');
      setLoading(true);

      try {
        if (typeof onLoginSubmit === 'function') {
          const res = await onLoginSubmit(email, password);
          if (res && !res.ok) {
            showFeedback(
              'error',
              res.error || 'Email atau kata sandi tidak sesuai. Silakan coba lagi.'
            );
          }
        }
      } catch (err) {
        showFeedback(
          'error',
          err?.message || 'Terjadi kendala saat masuk ke akun Caturan.'
        );
      } finally {
        setLoading(false);
      }
    });
  }
}
