/**
 * Entry Point Utama Aplikasi Caturan
 * Mengelola:
 * - Autentikasi privat & session management (Supabase Auth)
 * - Sinkronisasi progres lokal & cloud (LocalStorage + Supabase public.user_progress)
 * - State navigasi halaman (Login, Dashboard, Belajar, Detail Materi)
 * - Mekanisme buka-tutup sidebar (Desktop & Mobile Drawer)
 * - Pergantian Light Mode & Dark Mode
 */

import { themeService, THEME_DARK } from './services/theme.js';
import { storageService, SYNC_STATUS } from './services/storage.js';
import { progressService } from './services/progress.js';
import { authService } from './services/auth.js';
import { getLessonById } from './data/curriculum.js';
import { renderSidebar } from './components/sidebar.js';
import { renderDashboardView } from './components/dashboardView.js';
import { renderLearnView } from './components/learnView.js';
import { renderLoginView } from './components/loginView.js';
import {
  renderLessonDetailView,
  updateLessonCompletionUI,
  destroyActiveLessonBoard
} from './components/lessonDetailView.js';
import { UI_ICONS } from './components/icons.js';

const MOBILE_BREAKPOINT = 860;

export class CaturanApp {
  constructor({ requireAuth = true } = {}) {
    this.requireAuth = requireAuth;
    this.isAuthenticated = false;
    this.currentUser = null;
    this._lastSyncedUserId = null;

    this.currentRoute = 'dashboard'; // 'dashboard' | 'learn' | 'lesson-detail'
    this.activeLessonId = null;
    this.activeCategoryFilter = 'all';
    this.completionFeedback = null;

    // State Sidebar:
    // - Desktop: membaca preferensi dari LocalStorage (default terbuka = false)
    // - Mobile/Tablet: selalu tertutup (false) saat pertama kali dibuka
    this.isDesktopSidebarCollapsed = false;
    this.isMobileSidebarOpen = false;

    this.appShell = null;
    this.sidebarContainer = null;
    this.mainContainer = null;
    this.topbarStatsContainer = null;
    this.themeToggleBtn = null;
    this.mobileMenuBtn = null;
    this.sidebarOverlay = null;

    this._unsubSyncStatus = null;
    this._unsubProgress = null;
    this._unsubAuth = null;
  }

  async init() {
    // 1. Inisialisasi tema (Light / Dark Mode)
    themeService.init();

    // 2. Muat preferensi sidebar desktop dari LocalStorage
    this.isDesktopSidebarCollapsed = storageService.getSidebarCollapsed();
    this.isMobileSidebarOpen = false;

    // 3. Tangkap referensi elemen DOM utama
    this.appShell = document.getElementById('app-shell') || document.querySelector('.app-shell');
    this.sidebarContainer = document.getElementById('app-sidebar');
    this.mainContainer = document.getElementById('app-main-content');
    this.topbarStatsContainer = document.getElementById('topbar-quick-stats');
    this.themeToggleBtn = document.getElementById('theme-toggle-btn');
    this.mobileMenuBtn = document.getElementById('mobile-menu-btn');
    this.sidebarOverlay = document.getElementById('sidebar-backdrop');

    // 4. Bind tombol ganti tema
    if (this.themeToggleBtn) {
      this.themeToggleBtn.addEventListener('click', () => {
        themeService.toggleTheme();
        this.renderThemeButton();
      });
    }

    // 5. Bind tombol hamburger (buka/tutup sidebar di desktop maupun mobile)
    if (this.mobileMenuBtn) {
      this.mobileMenuBtn.addEventListener('click', () => {
        this.toggleSidebar();
      });
    }

    // 6. Bind klik backdrop untuk menutup drawer mobile
    if (this.sidebarOverlay) {
      this.sidebarOverlay.addEventListener('click', () => {
        this.closeMobileSidebar();
      });
    }

    // 7. Bind tombol Escape untuk menutup drawer mobile
    if (typeof document !== 'undefined' && document.addEventListener) {
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && this.isMobileSidebarOpen) {
          this.closeMobileSidebar();
          if (this.mobileMenuBtn && typeof this.mobileMenuBtn.focus === 'function') {
            this.mobileMenuBtn.focus();
          }
        }
      });
    }

    // 8. Sinkronkan state sidebar ketika ukuran layar berubah
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('resize', () => {
        if (!this.isMobileViewport() && this.isMobileSidebarOpen) {
          this.isMobileSidebarOpen = false;
        }
        this._syncSidebarDOM();
      });

      window.addEventListener('hashchange', () => {
        if (!this.requireAuth || this.isAuthenticated) {
          this._handleHashRoute();
        }
      });
    }

    // 9. Dengarkan perubahan status sinkronisasi cloud agar indikator UI selalu jujur & real-time
    this._unsubSyncStatus = storageService.subscribeSyncStatus(() => {
      if (!this.requireAuth || this.isAuthenticated) {
        this._refreshChromeUI();
      }
    });

    // 10. Dengarkan perubahan progres hasil merge dari cloud
    this._unsubProgress = progressService.subscribe(() => {
      if (!this.requireAuth || this.isAuthenticated) {
        if (this.currentRoute === 'lesson-detail') {
          this._refreshChromeUI();
        } else {
          this.renderAll();
        }
      }
    });

    this.renderThemeButton();

    if (!this.requireAuth) {
      this.isAuthenticated = true;
      this._syncSidebarDOM();
      this._handleHashRoute(true);
      return;
    }

    // 11. Dengarkan perubahan state autentikasi (onAuthStateChange)
    this._unsubAuth = authService.subscribe((event, session, user) => {
      this._handleAuthStateChange(event, session, user);
    });

    // 12. Periksa session awal menggunakan supabase.auth.getSession()
    const { session, user } = await authService.initSession();
    await this._handleAuthStateChange('INITIAL_SESSION', session, user, true);
  }

  async _handleAuthStateChange(event, session, user, isInitial = false) {
    const wasAuthenticated = this.isAuthenticated;
    const hasValidSession = Boolean(session && user && user.id);

    this.isAuthenticated = hasValidSession;
    this.currentUser = hasValidSession ? user : null;

    if (!hasValidSession) {
      this._lastSyncedUserId = null;
      progressService.handleUserSignedOut();
      destroyActiveLessonBoard();
      this.closeMobileSidebar();
      this.renderAuthGate();
      return;
    }

    if (this.appShell && this.appShell.classList) {
      this.appShell.classList.remove('is-unauthenticated');
    }

    // Jika baru saja login atau memulihkan session pada startup, tampilkan aplikasi dan jalankan initial sync
    if (!wasAuthenticated || isInitial) {
      this._syncSidebarDOM();
      this._handleHashRoute(true);
    }

    if (this._lastSyncedUserId !== user.id) {
      this._lastSyncedUserId = user.id;
      await progressService.syncWithCloudForUser(user.id);
    }
  }

  /**
   * Menampilkan halaman Login privat dan menyembunyikan seluruh Dashboard / data progres pengguna
   */
  renderAuthGate(errorMsg = null, infoMsg = null) {
    destroyActiveLessonBoard();

    if (this.appShell && this.appShell.classList) {
      this.appShell.classList.add('is-unauthenticated');
    }

    if (this.sidebarContainer) {
      this.sidebarContainer.innerHTML = '';
      this.sidebarContainer.setAttribute('aria-hidden', 'true');
    }

    if (this.topbarStatsContainer) {
      this.topbarStatsContainer.innerHTML = '';
    }

    renderLoginView(this.mainContainer, {
      initialError: errorMsg,
      initialInfo: infoMsg,
      onToggleTheme: () => {
        themeService.toggleTheme();
        this.renderThemeButton();
      },
      onLoginSubmit: async (email, password) => {
        const res = await authService.signInWithPassword(email, password);
        if (res.ok && res.session && res.user) {
          await this._handleAuthStateChange('SIGNED_IN', res.session, res.user, true);
        }
        return res;
      },
      onResetPassword: async email => {
        return authService.resetPasswordForEmail(email);
      }
    });
  }

  async handleLogout() {
    this.closeMobileSidebar();
    await authService.signOut();
    this.renderAuthGate(null, 'Anda telah berhasil keluar dari akun Caturan.');
  }

  async handleRetrySync() {
    await storageService.retrySync();
  }

  isMobileViewport() {
    if (typeof window === 'undefined') return false;
    if (typeof window.matchMedia === 'function') {
      return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
    }
    if (typeof window.innerWidth === 'number') {
      return window.innerWidth <= MOBILE_BREAKPOINT;
    }
    return false;
  }

  /**
   * Toggle Sidebar terpadu:
   * - Pada layar <= 860px (Smartphone/Tablet): membuka/menutup responsive drawer.
   * - Pada layar > 860px (Desktop): menyembunyikan/menampilkan sidebar sepenuhnya & menyimpan preferensi.
   */
  toggleSidebar() {
    if (this.isMobileViewport()) {
      this.isMobileSidebarOpen = !this.isMobileSidebarOpen;
    } else {
      this.isDesktopSidebarCollapsed = !this.isDesktopSidebarCollapsed;
      storageService.saveSidebarCollapsed(this.isDesktopSidebarCollapsed);
    }
    this._syncSidebarDOM();
  }

  setDesktopSidebarCollapsed(collapsed) {
    this.isDesktopSidebarCollapsed = Boolean(collapsed);
    storageService.saveSidebarCollapsed(this.isDesktopSidebarCollapsed);
    this._syncSidebarDOM();
  }

  openMobileSidebar() {
    this.isMobileSidebarOpen = true;
    this._syncSidebarDOM();
  }

  closeMobileSidebar() {
    if (!this.isMobileSidebarOpen) return;
    this.isMobileSidebarOpen = false;
    this._syncSidebarDOM();
  }

  _syncSidebarDOM() {
    if (this.requireAuth && !this.isAuthenticated) {
      if (this.sidebarContainer) {
        this.sidebarContainer.setAttribute('aria-hidden', 'true');
      }
      return;
    }

    const isMobile = this.isMobileViewport();
    const isSidebarExpanded = isMobile
      ? this.isMobileSidebarOpen
      : !this.isDesktopSidebarCollapsed;

    if (this.appShell && this.appShell.classList) {
      this.appShell.classList.toggle('sidebar-collapsed', this.isDesktopSidebarCollapsed);
    }

    if (this.sidebarContainer) {
      if (this.sidebarContainer.classList) {
        this.sidebarContainer.classList.toggle('is-open', isMobile && this.isMobileSidebarOpen);
      }
      this.sidebarContainer.setAttribute('aria-hidden', isSidebarExpanded ? 'false' : 'true');
    }

    if (this.sidebarOverlay && this.sidebarOverlay.classList) {
      this.sidebarOverlay.classList.toggle('is-visible', isMobile && this.isMobileSidebarOpen);
    }

    if (typeof document !== 'undefined' && document.body && document.body.classList) {
      document.body.classList.toggle('drawer-open', isMobile && this.isMobileSidebarOpen);
    }

    if (this.mobileMenuBtn) {
      this.mobileMenuBtn.setAttribute('aria-expanded', isSidebarExpanded ? 'true' : 'false');
      this.mobileMenuBtn.setAttribute(
        'aria-label',
        isSidebarExpanded ? 'Sembunyikan Sidebar Navigasi' : 'Buka Sidebar Navigasi'
      );
    }
  }

  _handleHashRoute(isInitial = false) {
    const hash = (window.location.hash || '').replace(/^#/, '');
    if (hash.startsWith('lesson/')) {
      const lessonId = hash.slice('lesson/'.length);
      const exists = getLessonById(lessonId);
      if (exists) {
        this.openLesson(lessonId, false);
        return;
      }
    } else if (hash === 'learn') {
      this.navigate('learn', false);
      return;
    } else if (hash === 'dashboard') {
      this.navigate('dashboard', false);
      return;
    }

    if (isInitial) {
      this.navigate('dashboard', false);
    }
  }

  renderThemeButton() {
    if (!this.themeToggleBtn) return;
    const isDark = themeService.getTheme() === THEME_DARK;
    this.themeToggleBtn.innerHTML = `
      <span class="theme-icon">${isDark ? UI_ICONS.sun : UI_ICONS.moon}</span>
      <span class="theme-label">${isDark ? 'Light Mode' : 'Dark Mode'}</span>
    `;
    this.themeToggleBtn.setAttribute(
      'aria-label',
      isDark ? 'Ganti ke Light Mode' : 'Ganti ke Dark Mode'
    );
  }

  renderTopbarQuickStats(summary, syncState = storageService.getSyncState()) {
    if (!this.topbarStatsContainer) return;

    const statusKey = syncState?.status || SYNC_STATUS.IDLE;
    const statusLabel = syncState?.label || 'Sinkronisasi tertunda';
    const canRetry =
      statusKey === SYNC_STATUS.ERROR ||
      statusKey === SYNC_STATUS.OFFLINE ||
      statusKey === SYNC_STATUS.PENDING;

    this.topbarStatsContainer.innerHTML = `
      <div
        class="quick-stat-pill topbar-sync-pill status-${statusKey} hide-on-xs"
        data-testid="topbar-sync-status"
        title="${syncState?.error ? syncState.error : `Status Sinkronisasi: ${statusLabel}`}"
      >
        <span class="storage-dot status-dot-${statusKey}"></span>
        <span class="qs-value">${statusLabel}</span>
        ${
          canRetry
            ? `<button type="button" class="topbar-retry-link" data-action="topbar-retry-sync" title="Coba sinkronkan ulang">Coba Lagi</button>`
            : ''
        }
      </div>
      <div class="quick-stat-pill" title="Streak Belajar Harian">
        <span class="qs-icon">${UI_ICONS.flame}</span>
        <span class="qs-value" data-testid="topbar-streak">${summary.streak} Hari</span>
      </div>
      <div class="quick-stat-pill" title="Total XP">
        <span class="qs-icon">${UI_ICONS.zap}</span>
        <span class="qs-value" data-testid="topbar-xp">${summary.totalXp} XP</span>
      </div>
      <div class="quick-stat-pill hide-on-xs" title="Level Pengguna">
        <span class="qs-icon">${UI_ICONS.trophy}</span>
        <span class="qs-value" data-testid="topbar-level">Level ${summary.level}</span>
      </div>
    `;

    const retryBtn = this.topbarStatsContainer.querySelector('[data-action="topbar-retry-sync"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.handleRetrySync();
      });
    }
  }

  _refreshChromeUI() {
    if (this.requireAuth && !this.isAuthenticated) return;
    const summary = progressService.getSummary();
    const syncState = storageService.getSyncState();
    this.renderTopbarQuickStats(summary, syncState);
    renderSidebar(this.sidebarContainer, {
      currentRoute: this.currentRoute,
      summary,
      syncState,
      userEmail: this.currentUser?.email || null,
      onNavigate: target => this.navigate(target),
      onCloseDrawer: () => this.closeMobileSidebar(),
      onRetrySync: () => this.handleRetrySync(),
      onLogout: () => this.handleLogout()
    });
  }

  navigate(route, updateHash = true) {
    destroyActiveLessonBoard();
    this.closeMobileSidebar();
    this.currentRoute = route;
    this.completionFeedback = null;

    if (updateHash && window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', `#${route}`);
    }

    this.renderAll();
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  openLesson(lessonId, updateHash = true) {
    const found = getLessonById(lessonId);
    if (!found) return;

    destroyActiveLessonBoard();
    this.closeMobileSidebar();

    // Catat materi ini sebagai materi terakhir yang dibuka pengguna
    progressService.markLessonOpened(lessonId);

    this.currentRoute = 'lesson-detail';
    this.activeLessonId = lessonId;
    this.completionFeedback = null;

    if (updateHash && window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', `#lesson/${lessonId}`);
    }

    this.renderAll();
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  handleCompleteLesson(lessonId, autoFromBoard = false) {
    const result = progressService.completeLesson(lessonId);
    const found = getLessonById(lessonId);
    const lessonTitle = found ? found.lesson.title : 'Materi';
    const xpReward = found ? found.lesson.xpReward : 0;

    if (result.alreadyCompleted) {
      this.completionFeedback = {
        alreadyCompleted: true,
        title: 'Materi Sudah Diselesaikan Sebelumnya',
        message: `Anda telah menyelesaikan "${lessonTitle}". XP (+${xpReward} XP) hanya diberikan satu kali agar statistik belajar tetap jujur dan akurat.`
      };
    } else {
      const levelUpMsg = result.leveledUp
        ? ` Selamat! Anda naik ke Level ${result.levelInfo.level} (${result.levelInfo.title})!`
        : '';
      this.completionFeedback = {
        alreadyCompleted: false,
        title: `${autoFromBoard ? 'Latihan Tuntas & ' : ''}Materi Selesai! +${result.xpGained} XP`,
        message: `Progres untuk "${lessonTitle}" telah disimpan. Total XP Anda sekarang adalah ${result.totalXp} XP.${levelUpMsg}`
      };
    }

    this._refreshChromeUI();

    // Perbarui tampilan status materi tanpa me-reset posisi papan catur interaktif
    updateLessonCompletionUI(this.mainContainer, {
      isCompleted: true,
      completionFeedback: this.completionFeedback,
      xpReward
    });
  }

  handleResetProgress() {
    progressService.resetAllProgress();
    this.completionFeedback = null;
    this.renderAll();
  }

  renderAll() {
    if (this.appShell && this.appShell.classList) {
      this.appShell.classList.remove('is-unauthenticated');
    }

    const summary = progressService.getSummary();
    const syncState = storageService.getSyncState();
    this.renderTopbarQuickStats(summary, syncState);

    renderSidebar(this.sidebarContainer, {
      currentRoute: this.currentRoute,
      summary,
      syncState,
      userEmail: this.currentUser?.email || null,
      onNavigate: target => this.navigate(target),
      onCloseDrawer: () => this.closeMobileSidebar(),
      onRetrySync: () => this.handleRetrySync(),
      onLogout: () => this.handleLogout()
    });
    this._syncSidebarDOM();

    if (this.currentRoute === 'dashboard') {
      renderDashboardView(this.mainContainer, {
        summary,
        onOpenLesson: id => this.openLesson(id),
        onGoToLearn: () => this.navigate('learn'),
        onResetProgress: () => this.handleResetProgress()
      });
    } else if (this.currentRoute === 'learn') {
      renderLearnView(this.mainContainer, {
        summary,
        activeCategoryFilter: this.activeCategoryFilter,
        onFilterChange: filterId => {
          this.activeCategoryFilter = filterId;
          this.renderAll();
        },
        onOpenLesson: id => this.openLesson(id)
      });
    } else if (this.currentRoute === 'lesson-detail' && this.activeLessonId) {
      renderLessonDetailView(this.mainContainer, {
        lessonId: this.activeLessonId,
        isCompleted: progressService.isLessonCompleted(this.activeLessonId),
        completionFeedback: this.completionFeedback,
        onBackToLearn: () => this.navigate('learn'),
        onSelectLesson: id => this.openLesson(id),
        onMarkComplete: (id, auto) => this.handleCompleteLesson(id, auto)
      });
    }
  }
}

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new CaturanApp();
    app.init();
    if (typeof window !== 'undefined') {
      window.__caturanApp = app;
    }
  });
}
