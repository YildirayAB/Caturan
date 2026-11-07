/**
 * Komponen Navigasi Sidebar Caturan
 * Menampilkan menu utama, ringkasan mini progres, indikator status sinkronisasi Cloud/Local
 * yang jujur (beserta tombol Coba Lagi jika gagal/tertunda), dan tombol Keluar (Logout).
 */

import { UI_ICONS } from './icons.js';
import { SYNC_STATUS, SYNC_STATUS_LABELS } from '../services/storage.js';

export const NAV_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: UI_ICONS.dashboard,
    activeInMvp: true
  },
  {
    id: 'learn',
    label: 'Belajar',
    icon: UI_ICONS.learn,
    activeInMvp: true
  },
  {
    id: 'puzzle',
    label: 'Puzzle',
    icon: UI_ICONS.puzzle,
    activeInMvp: true
  },
  {
    id: 'play',
    label: 'Bermain',
    icon: UI_ICONS.play,
    activeInMvp: true
  },
  {
    id: 'opening-trainer',
    label: 'Opening Trainer',
    icon: UI_ICONS.opening,
    activeInMvp: false,
    badge: 'Coming Soon'
  },
  {
    id: 'analysis',
    label: 'Analisis',
    icon: UI_ICONS.analysis,
    activeInMvp: false,
    badge: 'Coming Soon'
  }
];

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderSidebar(
  container,
  {
    currentRoute,
    summary,
    syncState = null,
    userEmail = null,
    onNavigate,
    onCloseDrawer,
    onRetrySync,
    onLogout
  }
) {
  if (!container) return;

  const activeNavId =
    currentRoute === 'lesson-detail'
      ? 'learn'
      : currentRoute === 'puzzle-play'
      ? 'puzzle'
      : currentRoute === 'play-game'
      ? 'play'
      : currentRoute;

  const navLinksHtml = NAV_ITEMS.map(item => {
    const isActive = item.activeInMvp && activeNavId === item.id;
    if (item.activeInMvp) {
      return `
        <li class="sidebar-nav-item">
          <button
            type="button"
            class="sidebar-nav-link ${isActive ? 'is-active' : ''}"
            data-nav="${item.id}"
            aria-current="${isActive ? 'page' : 'false'}"
          >
            <span class="nav-icon">${item.icon}</span>
            <span class="nav-label">${item.label}</span>
          </button>
        </li>
      `;
    }

    return `
      <li class="sidebar-nav-item">
        <div
          class="sidebar-nav-link is-disabled"
          title="${item.label} akan hadir pada tahap pengembangan berikutnya"
          aria-disabled="true"
        >
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
          <span class="nav-coming-soon-badge">${item.badge}</span>
        </div>
      </li>
    `;
  }).join('');

  const statusKey = syncState?.status || SYNC_STATUS.IDLE;
  const statusLabel =
    syncState?.label || SYNC_STATUS_LABELS[statusKey] || 'Sinkronisasi tertunda';
  const showRetryBtn =
    statusKey === SYNC_STATUS.ERROR ||
    statusKey === SYNC_STATUS.OFFLINE ||
    statusKey === SYNC_STATUS.PENDING;

  container.innerHTML = `
    <div class="sidebar-inner">
      <div class="sidebar-top-row">
        <div class="sidebar-brand" data-nav="dashboard" role="button" tabindex="0" aria-label="Ke halaman utama Caturan">
          <div class="brand-logo-box">
            ${UI_ICONS.logo}
          </div>
          <div class="brand-text">
            <span class="brand-name">Caturan</span>
            <span class="brand-subtitle">Belajar Catur Interaktif</span>
          </div>
        </div>
        <button
          type="button"
          class="sidebar-close-drawer-btn"
          data-action="close-drawer"
          aria-label="Tutup Menu Navigasi"
          title="Tutup Menu"
        >
          ${UI_ICONS.close}
        </button>
      </div>

      <nav class="sidebar-nav" aria-label="Menu Utama">
        <div class="sidebar-section-label">MENU UTAMA</div>
        <ul class="sidebar-nav-list">
          ${navLinksHtml}
        </ul>
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-mini-progress">
          <div class="mini-progress-header">
            <span class="mini-level-badge">Level ${summary.level}</span>
            <span class="mini-xp-text">${summary.totalXp} XP</span>
          </div>
          <div class="mini-progress-bar-track" aria-label="Progres Kurikulum">
            <div class="mini-progress-bar-fill" style="width: ${summary.overallPercentage}%"></div>
          </div>
          <div class="mini-progress-caption">
            ${summary.completedCount} / ${summary.totalLessonsCount} materi selesai (${summary.overallPercentage}%)
          </div>
        </div>

        <div class="sync-status-box status-${escapeHtml(statusKey)}" data-testid="sidebar-sync-status">
          <div class="sync-status-main">
            <span class="storage-dot status-dot-${escapeHtml(statusKey)}"></span>
            <span class="sync-status-text" data-testid="sync-status-label">${escapeHtml(statusLabel)}</span>
          </div>
          ${
            showRetryBtn
              ? `
            <button
              type="button"
              class="sync-retry-btn"
              data-action="retry-sync"
              data-testid="retry-sync-btn"
              title="Coba sinkronkan ulang ke cloud"
            >
              Coba Lagi
            </button>
          `
              : ''
          }
        </div>

        <div class="sidebar-account-row">
          ${
            userEmail
              ? `<div class="account-email-pill" title="${escapeHtml(userEmail)}" data-testid="sidebar-user-email">${escapeHtml(userEmail)}</div>`
              : ''
          }
          <button
            type="button"
            class="btn btn-secondary btn-sm sidebar-logout-btn"
            data-action="logout"
            data-testid="logout-btn"
            aria-label="Keluar dari akun Caturan"
          >
            <span class="logout-icon">${UI_ICONS.logout}</span>
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Bind klik & keyboard navigasi aktif
  const navElements = container.querySelectorAll('[data-nav]');
  navElements.forEach(el => {
    el.addEventListener('click', () => {
      const targetRoute = el.getAttribute('data-nav');
      if (targetRoute && typeof onNavigate === 'function') {
        onNavigate(targetRoute);
      }
    });

    if (el.getAttribute('role') === 'button') {
      el.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const targetRoute = el.getAttribute('data-nav');
          if (targetRoute && typeof onNavigate === 'function') {
            onNavigate(targetRoute);
          }
        }
      });
    }
  });

  // Bind tombol tutup drawer di mobile
  const closeDrawerBtn = container.querySelector('[data-action="close-drawer"]');
  if (closeDrawerBtn && typeof onCloseDrawer === 'function') {
    closeDrawerBtn.addEventListener('click', () => {
      onCloseDrawer();
    });
  }

  // Bind tombol Coba Lagi (Retry Sync)
  const retrySyncBtn = container.querySelector('[data-action="retry-sync"]');
  if (retrySyncBtn && typeof onRetrySync === 'function') {
    retrySyncBtn.addEventListener('click', () => {
      onRetrySync();
    });
  }

  // Bind tombol Keluar (Logout)
  const logoutBtn = container.querySelector('[data-action="logout"]');
  if (logoutBtn && typeof onLogout === 'function') {
    logoutBtn.addEventListener('click', () => {
      onLogout();
    });
  }
}
