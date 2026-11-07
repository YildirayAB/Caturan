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
import { getPuzzleById, getDailyPuzzle, selectNextPuzzle } from './data/puzzles.js';
import { getOpeningById } from './data/openings.js';
import { renderSidebar } from './components/sidebar.js';
import { renderDashboardView } from './components/dashboardView.js';
import { renderLearnView } from './components/learnView.js';
import { renderLoginView } from './components/loginView.js';
import { renderPuzzleView } from './components/puzzleView.js';
import {
  renderPuzzlePlayView,
  destroyActivePuzzleBoard
} from './components/puzzlePlayView.js';
import { renderPlayView } from './components/playView.js';
import {
  renderPlayGameView,
  destroyActivePlayBoard
} from './components/playGameView.js';
import {
  renderOpeningDashboardView,
  renderOpeningLibraryView
} from './components/openingView.js';
import { renderOpeningLearnView } from './components/openingLearnView.js';
import { renderOpeningPracticeView } from './components/openingPracticeView.js';
import {
  renderLessonDetailView,
  updateLessonCompletionUI,
  destroyActiveLessonBoard
} from './components/lessonDetailView.js';
import { UI_ICONS } from './components/icons.js';

const MOBILE_BREAKPOINT = 860;
const ACTIVE_PLAY_SESSION_KEY = 'caturan_mvp3_active_game';

export class CaturanApp {
  constructor({ requireAuth = true } = {}) {
    this.requireAuth = requireAuth;
    this.isAuthenticated = false;
    this.currentUser = null;
    this._lastSyncedUserId = null;

    this.currentRoute = 'dashboard'; // 'dashboard' | 'learn' | 'lesson-detail' | 'puzzle' | 'puzzle-play'
    this.activeLessonId = null;
    this.activeCategoryFilter = 'all';
    this.completionFeedback = null;

    // State Latihan Puzzle (MVP 2)
    this.activePuzzleId = null;
    this.puzzlePracticeContext = {
      mode: 'mixed', // 'daily' | 'mixed' | 'theme' | 'difficulty'
      theme: 'all',
      difficulty: 'all'
    };
    this.puzzleSessionPlayedIds = [];

    // State Bermain Melawan Komputer (MVP 3)
    this.playSettings = {
      colorPreference: 'white', // 'white' | 'black' | 'random'
      difficulty: 'beginner' // 'beginner' | 'intermediate' | 'advanced'
    };
    this.unfinishedPlayNotice = null;

    // State Opening Trainer (MVP 4)
    this.activeOpeningId = null;
    this.openingLibraryFilters = {
      repertoireSide: 'all',
      category: 'all',
      difficulty: 'all',
      status: 'all',
      searchQuery: ''
    };
    this._activeOpeningBoard = null;

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
        if (
          this.currentRoute === 'lesson-detail' ||
          this.currentRoute === 'puzzle-play' ||
          this.currentRoute === 'play-game' ||
          this.currentRoute === 'opening-learn' ||
          this.currentRoute === 'opening-practice'
        ) {
          this._refreshChromeUI();
        } else {
          this.renderAll();
        }
      }
    });

    // Periksa apakah terdapat sesi permainan melawan komputer yang terputus karena refresh halaman
    this._checkInterruptedPlaySession();

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
      destroyActivePuzzleBoard();
      destroyActivePlayBoard({ terminateEngine: true });
      this._destroyActiveOpeningBoard();
      this._clearActivePlaySession();
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
    destroyActivePuzzleBoard();
    destroyActivePlayBoard({ terminateEngine: true });
    this._destroyActiveOpeningBoard();
    this._clearActivePlaySession();

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
    } else if (hash.startsWith('puzzle/')) {
      const puzzleId = hash.slice('puzzle/'.length);
      const exists = getPuzzleById(puzzleId);
      if (exists) {
        this.openPuzzle(puzzleId, null, false);
        return;
      }
    } else if (hash.startsWith('opening-learn/')) {
      const openingId = hash.slice('opening-learn/'.length);
      const exists = getOpeningById(openingId);
      if (exists) {
        this.openOpeningLearn(openingId, false);
        return;
      }
    } else if (hash.startsWith('opening-practice/')) {
      const openingId = hash.slice('opening-practice/'.length);
      const exists = getOpeningById(openingId);
      if (exists) {
        this.openOpeningPractice(openingId, false);
        return;
      }
    } else if (hash === 'opening-library') {
      this.openOpeningLibrary(null, false);
      return;
    } else if (hash === 'opening-trainer') {
      this.navigate('opening-trainer', false);
      return;
    } else if (hash === 'play-game') {
      // Jika halaman direfresh saat berada di #play-game, arahkan ke #play dengan bersih
      // tanpa mengklaim game selesai apabila sesi sebelumnya belum berakhir
      if (isInitial && this.unfinishedPlayNotice) {
        this.navigate('play', true);
      } else {
        this.startPlayGame(this.playSettings, false);
      }
      return;
    } else if (hash === 'play') {
      this.navigate('play', false);
      return;
    } else if (hash === 'puzzle') {
      this.navigate('puzzle', false);
      return;
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

  _destroyActiveOpeningBoard() {
    if (this._activeOpeningBoard && typeof this._activeOpeningBoard.destroy === 'function') {
      this._activeOpeningBoard.destroy();
    }
    this._activeOpeningBoard = null;
  }

  navigate(route, updateHash = true) {
    destroyActiveLessonBoard();
    destroyActivePuzzleBoard();
    destroyActivePlayBoard({ terminateEngine: route !== 'play-game' });
    this._destroyActiveOpeningBoard();
    if (route !== 'play-game') {
      this._clearActivePlaySession();
    }
    if (route !== 'play') {
      this.unfinishedPlayNotice = null;
    }
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
    destroyActivePuzzleBoard();
    destroyActivePlayBoard({ terminateEngine: true });
    this._destroyActiveOpeningBoard();
    this._clearActivePlaySession();
    this.unfinishedPlayNotice = null;
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

  // =========================================================================
  // MVP 2 — KONTROLER NAVIGASI & LATIHAN PUZZLE CATUR
  // =========================================================================

  startDailyPuzzle() {
    const daily = getDailyPuzzle();
    if (!daily) return;
    this.puzzleSessionPlayedIds = [daily.id];
    this.openPuzzle(daily.id, {
      mode: 'daily',
      theme: 'all',
      difficulty: 'all'
    });
  }

  startMixedPuzzlePractice() {
    const puzzleSummary = progressService.getPuzzleSummary();
    const { puzzle, updatedSessionPlayedIds } = selectNextPuzzle({
      theme: 'all',
      difficulty: 'all',
      solvedPuzzleIds: puzzleSummary.solvedPuzzleIds,
      sessionPlayedIds: []
    });
    if (!puzzle) return;
    this.puzzleSessionPlayedIds = updatedSessionPlayedIds;
    this.openPuzzle(puzzle.id, {
      mode: 'mixed',
      theme: 'all',
      difficulty: 'all'
    });
  }

  startThemePuzzlePractice(themeId) {
    const puzzleSummary = progressService.getPuzzleSummary();
    const { puzzle, updatedSessionPlayedIds } = selectNextPuzzle({
      theme: themeId,
      difficulty: 'all',
      solvedPuzzleIds: puzzleSummary.solvedPuzzleIds,
      sessionPlayedIds: []
    });
    if (!puzzle) return;
    this.puzzleSessionPlayedIds = updatedSessionPlayedIds;
    this.openPuzzle(puzzle.id, {
      mode: 'theme',
      theme: themeId,
      difficulty: 'all'
    });
  }

  startDifficultyPuzzlePractice(difficultyId) {
    const puzzleSummary = progressService.getPuzzleSummary();
    const { puzzle, updatedSessionPlayedIds } = selectNextPuzzle({
      theme: 'all',
      difficulty: difficultyId,
      solvedPuzzleIds: puzzleSummary.solvedPuzzleIds,
      sessionPlayedIds: []
    });
    if (!puzzle) return;
    this.puzzleSessionPlayedIds = updatedSessionPlayedIds;
    this.openPuzzle(puzzle.id, {
      mode: 'difficulty',
      theme: 'all',
      difficulty: difficultyId
    });
  }

  openPuzzle(puzzleId, practiceContext = null, updateHash = true) {
    const found = getPuzzleById(puzzleId);
    if (!found) return;

    destroyActiveLessonBoard();
    destroyActivePuzzleBoard();
    destroyActivePlayBoard({ terminateEngine: true });
    this._destroyActiveOpeningBoard();
    this._clearActivePlaySession();
    this.unfinishedPlayNotice = null;
    this.closeMobileSidebar();

    if (practiceContext) {
      this.puzzlePracticeContext = {
        mode: practiceContext.mode || 'mixed',
        theme: practiceContext.theme || 'all',
        difficulty: practiceContext.difficulty || 'all'
      };
    }

    if (!this.puzzleSessionPlayedIds.includes(puzzleId)) {
      this.puzzleSessionPlayedIds.push(puzzleId);
    }

    progressService.markPuzzleOpened(puzzleId);

    this.currentRoute = 'puzzle-play';
    this.activePuzzleId = puzzleId;

    if (updateHash && window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', `#puzzle/${puzzleId}`);
    }

    this.renderAll();
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  openNextPuzzle() {
    const ctx = this.puzzlePracticeContext || {
      mode: 'mixed',
      theme: 'all',
      difficulty: 'all'
    };
    const puzzleSummary = progressService.getPuzzleSummary();

    const { puzzle, updatedSessionPlayedIds } = selectNextPuzzle({
      theme: ctx.mode === 'theme' ? ctx.theme : 'all',
      difficulty: ctx.mode === 'difficulty' ? ctx.difficulty : 'all',
      solvedPuzzleIds: puzzleSummary.solvedPuzzleIds,
      sessionPlayedIds: this.puzzleSessionPlayedIds,
      currentPuzzleId: this.activePuzzleId
    });

    if (!puzzle) return;
    this.puzzleSessionPlayedIds = updatedSessionPlayedIds;

    // Jika sebelumnya berada di mode Puzzle Harian dan menekan Puzzle Berikutnya, lanjut ke Latihan Campuran
    const nextMode = ctx.mode === 'daily' ? 'mixed' : ctx.mode;
    this.openPuzzle(puzzle.id, {
      ...ctx,
      mode: nextMode
    });
  }

  handlePuzzleHintUsed({ attemptId, puzzleId, hintLevel }) {
    progressService.recordPuzzleHintUsed(puzzleId, hintLevel, {
      id: attemptId,
      mode: this.puzzlePracticeContext?.mode || 'mixed'
    });
    this._refreshChromeUI();
  }

  handlePuzzleWrongMove({ attemptId, puzzleId, hintsUsed, wrongMoves }) {
    progressService.recordPuzzleAttempt({
      id: attemptId,
      puzzleId,
      solved: false,
      hintsUsed,
      wrongMoves,
      mode: this.puzzlePracticeContext?.mode || 'mixed',
      isDaily: this.puzzlePracticeContext?.mode === 'daily'
    });
    this._refreshChromeUI();
  }

  handlePuzzleSolved({ attemptId, puzzleId, hintsUsed, wrongMoves }) {
    progressService.recordPuzzleAttempt({
      id: attemptId,
      puzzleId,
      solved: true,
      hintsUsed,
      wrongMoves,
      mode: this.puzzlePracticeContext?.mode || 'mixed',
      isDaily: this.puzzlePracticeContext?.mode === 'daily'
    });
    this._refreshChromeUI();
  }

  // =========================================================================
  // MVP 3 — KONTROLER BERMAIN MELAWAN KOMPUTER (STOCKFISH)
  // =========================================================================

  _checkInterruptedPlaySession() {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      const raw = window.sessionStorage.getItem(ACTIVE_PLAY_SESSION_KEY);
      if (raw) {
        window.sessionStorage.removeItem(ACTIVE_PLAY_SESSION_KEY);
        this.unfinishedPlayNotice =
          'Pertandingan sebelumnya belum selesai saat halaman dimuat ulang dan tidak dihitung sebagai pertandingan selesai.';
      }
    } catch {
      // Abaikan jika sessionStorage diblokir
    }
  }

  _markActivePlaySession(snapshot) {
    if (typeof window === 'undefined' || !window.sessionStorage || !snapshot) return;
    try {
      window.sessionStorage.setItem(
        ACTIVE_PLAY_SESSION_KEY,
        JSON.stringify({
          gameId: snapshot.gameId,
          startedAt: snapshot.startedAt,
          difficulty: snapshot.difficultyId,
          playerColor: snapshot.playerColor
        })
      );
    } catch {
      // Abaikan
    }
  }

  _clearActivePlaySession() {
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    try {
      window.sessionStorage.removeItem(ACTIVE_PLAY_SESSION_KEY);
    } catch {
      // Abaikan
    }
  }

  updatePlaySettings(newSettings = {}) {
    this.playSettings = {
      colorPreference: ['white', 'black', 'random'].includes(newSettings.colorPreference)
        ? newSettings.colorPreference
        : this.playSettings.colorPreference,
      difficulty: ['beginner', 'intermediate', 'advanced'].includes(newSettings.difficulty)
        ? newSettings.difficulty
        : this.playSettings.difficulty
    };
    if (this.currentRoute === 'play') {
      this.renderAll();
    }
  }

  startPlayGame(settings = this.playSettings, updateHash = true) {
    destroyActiveLessonBoard();
    destroyActivePuzzleBoard();
    destroyActivePlayBoard({ terminateEngine: false });
    this._destroyActiveOpeningBoard();
    this.closeMobileSidebar();

    if (settings) {
      this.playSettings = {
        colorPreference: ['white', 'black', 'random'].includes(settings.colorPreference)
          ? settings.colorPreference
          : this.playSettings.colorPreference,
        difficulty: ['beginner', 'intermediate', 'advanced'].includes(settings.difficulty)
          ? settings.difficulty
          : this.playSettings.difficulty
      };
    }

    this.unfinishedPlayNotice = null;
    this.currentRoute = 'play-game';

    if (updateHash && window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', '#play-game');
    }

    this.renderAll();
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  handlePlayGameEnded(gameResult) {
    this._clearActivePlaySession();
    if (!gameResult || !gameResult.id) return;
    progressService.recordPlayGameFinished(gameResult);
    this._refreshChromeUI();
  }

  // =========================================================================
  // MVP 4 — KONTROLER OPENING TRAINER (DASHBOARD, LIBRARY, LEARN, PRACTICE)
  // =========================================================================

  openOpeningLibrary(filters = null, updateHash = true) {
    destroyActiveLessonBoard();
    destroyActivePuzzleBoard();
    destroyActivePlayBoard({ terminateEngine: true });
    this._destroyActiveOpeningBoard();
    this._clearActivePlaySession();
    this.unfinishedPlayNotice = null;
    this.closeMobileSidebar();

    if (filters && typeof filters === 'object') {
      this.openingLibraryFilters = {
        repertoireSide: filters.repertoireSide || 'all',
        category: filters.category || 'all',
        difficulty: filters.difficulty || 'all',
        status: filters.status || 'all',
        searchQuery: filters.searchQuery || ''
      };
    }

    this.currentRoute = 'opening-library';

    if (updateHash && window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', '#opening-library');
    }

    this.renderAll();
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  openOpeningLearn(openingId, updateHash = true) {
    const found = getOpeningById(openingId);
    if (!found) return;

    destroyActiveLessonBoard();
    destroyActivePuzzleBoard();
    destroyActivePlayBoard({ terminateEngine: true });
    this._destroyActiveOpeningBoard();
    this._clearActivePlaySession();
    this.unfinishedPlayNotice = null;
    this.closeMobileSidebar();

    progressService.markOpeningStudied(openingId);

    this.currentRoute = 'opening-learn';
    this.activeOpeningId = openingId;

    if (updateHash && window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', `#opening-learn/${openingId}`);
    }

    this.renderAll();
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  openOpeningPractice(openingId, updateHash = true) {
    const found = getOpeningById(openingId);
    if (!found) return;

    destroyActiveLessonBoard();
    destroyActivePuzzleBoard();
    destroyActivePlayBoard({ terminateEngine: true });
    this._destroyActiveOpeningBoard();
    this._clearActivePlaySession();
    this.unfinishedPlayNotice = null;
    this.closeMobileSidebar();

    this.currentRoute = 'opening-practice';
    this.activeOpeningId = openingId;

    if (updateHash && window.history && typeof window.history.replaceState === 'function') {
      window.history.replaceState(null, '', `#opening-practice/${openingId}`);
    }

    this.renderAll();
    if (typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  handleOpeningPracticeComplete(practiceState) {
    if (!practiceState || !practiceState.openingId) return;
    progressService.recordOpeningPracticeAttempt({
      id: practiceState.attemptId,
      openingId: practiceState.openingId,
      repertoireSide: practiceState.repertoireSide,
      correctMoves: practiceState.correctMoves,
      wrongMoves: practiceState.wrongMoves,
      hintsUsed: practiceState.hintsUsed
    });
    this._refreshChromeUI();
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
    } else if (this.currentRoute === 'puzzle') {
      renderPuzzleView(this.mainContainer, {
        puzzleSummary: summary.puzzleSummary || progressService.getPuzzleSummary(),
        userEmail: this.currentUser?.email || null,
        onStartDailyPuzzle: () => this.startDailyPuzzle(),
        onStartMixedPractice: () => this.startMixedPuzzlePractice(),
        onStartThemePractice: themeId => this.startThemePuzzlePractice(themeId),
        onStartDifficultyPractice: diffId => this.startDifficultyPuzzlePractice(diffId),
        onOpenPuzzle: id =>
          this.openPuzzle(id, {
            mode: 'mixed',
            theme: 'all',
            difficulty: 'all'
          })
      });
    } else if (this.currentRoute === 'puzzle-play' && this.activePuzzleId) {
      renderPuzzlePlayView(this.mainContainer, {
        puzzleId: this.activePuzzleId,
        isSolved: progressService.isPuzzleSolved(this.activePuzzleId),
        practiceContext: this.puzzlePracticeContext,
        onBackToDashboard: () => this.navigate('puzzle'),
        onNextPuzzle: () => this.openNextPuzzle(),
        onHintUsed: payload => this.handlePuzzleHintUsed(payload),
        onWrongMove: payload => this.handlePuzzleWrongMove(payload),
        onPuzzleSolved: payload => this.handlePuzzleSolved(payload)
      });
    } else if (this.currentRoute === 'play') {
      renderPlayView(this.mainContainer, {
        playSummary: summary.playSummary || progressService.getPlaySummary(),
        selectedSettings: this.playSettings,
        unfinishedNotice: this.unfinishedPlayNotice,
        onUpdateSettings: newSettings => this.updatePlaySettings(newSettings),
        onStartGame: chosenSettings => this.startPlayGame(chosenSettings)
      });
    } else if (this.currentRoute === 'play-game') {
      renderPlayGameView(this.mainContainer, {
        settings: this.playSettings,
        userEmail: this.currentUser?.email || null,
        onBackToPlayDashboard: () => this.navigate('play'),
        onUpdateSettings: newSettings => {
          this.playSettings = {
            colorPreference: newSettings.colorPreference || this.playSettings.colorPreference,
            difficulty: newSettings.difficulty || this.playSettings.difficulty
          };
        },
        onGameStarted: snapshot => this._markActivePlaySession(snapshot),
        onGameEnd: gameResult => this.handlePlayGameEnded(gameResult)
      });
    } else if (this.currentRoute === 'opening-trainer') {
      renderOpeningDashboardView(this.mainContainer, {
        openingSummary: summary.openingSummary || progressService.getOpeningSummary(),
        userEmail: this.currentUser?.email || null,
        onExploreLibrary: filters => this.openOpeningLibrary(filters),
        onOpenLearn: id => this.openOpeningLearn(id),
        onStartPractice: id => this.openOpeningPractice(id)
      });
    } else if (this.currentRoute === 'opening-library') {
      renderOpeningLibraryView(this.mainContainer, {
        initialFilters: this.openingLibraryFilters,
        getOpeningStatus: id => progressService.getOpeningStatus(id),
        onBackToDashboard: () => this.navigate('opening-trainer'),
        onOpenLearn: id => this.openOpeningLearn(id),
        onStartPractice: id => this.openOpeningPractice(id),
        onFilterChange: updatedFilters => {
          this.openingLibraryFilters = { ...updatedFilters };
        }
      });
    } else if (this.currentRoute === 'opening-learn') {
      const targetId = this.activeOpeningId || 'italian-game-main';
      this._activeOpeningBoard = renderOpeningLearnView(this.mainContainer, {
        openingId: targetId,
        statusInfo: progressService.getOpeningStatusInfo(targetId),
        onBackToLibrary: () => this.openOpeningLibrary(),
        onBackToDashboard: () => this.navigate('opening-trainer'),
        onSelectVariation: varId => this.openOpeningLearn(varId),
        onStartPractice: id => this.openOpeningPractice(id)
      });
    } else if (this.currentRoute === 'opening-practice') {
      const targetId = this.activeOpeningId || 'italian-game-main';
      const openingSummary = summary.openingSummary || progressService.getOpeningSummary();
      this._activeOpeningBoard = renderOpeningPracticeView(this.mainContainer, {
        openingId: targetId,
        masteredOpeningIds: openingSummary.masteredOpeningIds || [],
        onSelectOpening: nextId => this.openOpeningPractice(nextId),
        onOpenLearn: id => this.openOpeningLearn(id),
        onBackToLibrary: () => this.openOpeningLibrary(),
        onBackToDashboard: () => this.navigate('opening-trainer'),
        onPracticeComplete: practiceState => this.handleOpeningPracticeComplete(practiceState)
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
