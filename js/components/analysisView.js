/**
 * Komponen Halaman Chess Analysis Studio (MVP 5.7 — Analysis Studio UX Redesign & Android Keyboard Fix)
 *
 * Fitur Utama MVP 5.7:
 * 1. Mobile-First 3-Page Flow (<= 600px):
 *    - Page 'import': Upload / Paste PGN form (kebal terhadap keyboard resize).
 *    - Page 'board': Papan Analisis sebagai hero view, tombol atas "Analisis Posisi" (dengan timer 10s),
 *      dan 2 tombol bawah ("Grafik Analisis", "Daftar Langkah").
 *    - Page 'graph': Halaman khusus Grafik Evaluasi & Game Review penuh dengan tombol "Kembali ke Papan".
 *    - Page 'moves': Halaman khusus Daftar Langkah SAN & Variasi penuh dengan tombol "Kembali ke Papan".
 * 2. Tombol Analisis Posisi Mobile:
 *    - Kondisi awal: "Analisis Posisi" -> diklik -> "Menganalisis..." (indikator loading).
 *    - Jika > 10 detik: teks berubah menjadi "Hentikan Analisis" (spinner tetap aktif, tidak auto-cancel).
 *    - Jika diklik "Hentikan Analisis": Stockfish dihentikan secara aman, hasil dibatalkan, tombol pulih.
 *    - Jika analisis selesai normal: hasil Best Move ditampilkan pada papan, tombol pulih ke kondisi awal.
 * 3. Desktop 2-Kolom (> 600px):
 *    - Kolom kiri: Papan catur 1:1, koordinat, kontrol navigasi icon-only.
 *    - Kolom kanan: Panel Stockfish Engine, Game Review & Grafik Tab, Daftar Langkah, Variation Manager.
 * 4. Pembersihan Elemen Usang (Desktop & Mobile):
 *    - Dihapus: Panel Informasi Posisi Saat Ini, Detail PGN Ternormalisasi, Tombol Mode Review/Explore, Label Mode Jelajah.
 * 5. State Preservation:
 *    - Berpindah antar halaman mobile mempertahankan posisi FEN papan catur, active ply, data Game Review,
 *      dan variasi eksplorasi tanpa trigger re-analisis yang tidak perlu.
 */

import { UI_ICONS } from './icons.js';
import { AnalysisReplayBoard } from './chessboardUI.js';
import {
  MAX_PGN_FILE_SIZE_BYTES,
  validatePgnFileMeta,
  validateAndParsePgn,
  formatFileSize,
  formatPgnResultLabel
} from '../services/pgnService.js';
import {
  chessAnalysisEngine,
  ANALYSIS_ENGINE_STATES,
  ANALYSIS_ENGINE_STATE_LABELS
} from '../services/chessAnalysisEngineService.js';
import {
  chessGameReview,
  GAME_REVIEW_STATUS
} from '../services/chessGameReviewService.js';
import { GameReviewPanelComponent } from './gameReviewView.js';
import { analysisHistoryService } from '../services/analysisHistoryService.js';
import { authService } from '../services/auth.js';

export const MOBILE_ANALYSIS_BREAKPOINT = 600;

export const SAMPLE_PGN_PLACEHOLDER = `[Event "Partai Latihan Caturan"]
[Site "Jakarta, Indonesia"]
[Date "2026.05.10"]
[Round "1"]
[White "Budi Santoso"]
[Black "Andi Pratama"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 1-0`;

export const PGN_TEXTAREA_PLACEHOLDER =
  'Tempel (paste) atau ketik teks PGN di sini...\nContoh: 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 (atau tekan tombol "Contoh PGN")';

let activeReplayBoardInstance = null;
let activeAnalysisEngineInstance = null;
let activeEngineStatusUnsubscribe = null;
let activeGameReviewPanelInstance = null;
let mobileAnalysisTimerId = null;
let mobileAnalysisStartTime = 0;

export function destroyActiveAnalysisBoard({ terminateEngine = true } = {}) {
  if (mobileAnalysisTimerId) {
    clearTimeout(mobileAnalysisTimerId);
    mobileAnalysisTimerId = null;
  }
  mobileAnalysisStartTime = 0;

  if (typeof activeEngineStatusUnsubscribe === 'function') {
    try {
      activeEngineStatusUnsubscribe();
    } catch {
      // Abaikan jika sudah di-unsubscribe
    }
  }
  activeEngineStatusUnsubscribe = null;

  if (activeGameReviewPanelInstance) {
    try {
      activeGameReviewPanelInstance.destroy();
    } catch {
      // Abaikan jika sudah dibersihkan
    }
    activeGameReviewPanelInstance = null;
  }

  if (terminateEngine) {
    if (chessGameReview && typeof chessGameReview.stopGameReview === 'function') {
      try {
        chessGameReview.stopGameReview('board_destroyed');
      } catch {
        // Abaikan
      }
    }

    if (
      activeAnalysisEngineInstance &&
      typeof activeAnalysisEngineInstance.terminate === 'function'
    ) {
      activeAnalysisEngineInstance.terminate();
    }
    if (
      chessAnalysisEngine &&
      chessAnalysisEngine !== activeAnalysisEngineInstance &&
      typeof chessAnalysisEngine.terminate === 'function'
    ) {
      chessAnalysisEngine.terminate();
    }
    activeAnalysisEngineInstance = null;
  } else if (
    activeAnalysisEngineInstance &&
    typeof activeAnalysisEngineInstance.stopAnalysis === 'function'
  ) {
    activeAnalysisEngineInstance.stopAnalysis('view_rerender');
  }

  if (activeReplayBoardInstance && typeof activeReplayBoardInstance.destroy === 'function') {
    activeReplayBoardInstance.destroy();
  }
  activeReplayBoardInstance = null;
}

export function getActiveAnalysisBoard() {
  return activeReplayBoardInstance;
}

export function getActiveAnalysisEngine() {
  return activeAnalysisEngineInstance || chessAnalysisEngine;
}

export function isMobileAnalysisViewport() {
  if (typeof window === 'undefined') return false;
  if (typeof window.innerWidth === 'number') {
    return window.innerWidth <= MOBILE_ANALYSIS_BREAKPOINT;
  }
  if (typeof window.matchMedia === 'function') {
    return window.matchMedia(`(max-width: ${MOBILE_ANALYSIS_BREAKPOINT}px)`).matches;
  }
  return false;
}

function safeDisplayValue(value, fallback = 'Tidak diketahui') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return fallback;
  const trimmed = String(value).trim();
  if (
    !trimmed ||
    trimmed === '?' ||
    trimmed === 'undefined' ||
    trimmed === 'null' ||
    trimmed === '[object Object]'
  ) {
    return fallback;
  }
  return trimmed;
}

export function createInitialAnalysisSessionState() {
  return {
    rawPgnText: '',
    lastValidatedRawPgn: null,
    selectedFileMeta: null,
    validationError: null,
    parsedGame: null,
    currentPly: 0,
    orientation: 'white',
    analysisMode: 'explore',
    activeLineId: 'mainline',
    variations: [],
    variationCounter: 1,
    renamingVariationId: null,
    mobileScreen: 'import', // 'import' | 'board' | 'graph' | 'moves'
    isValidating: false,
    validationCount: 0,
    showInputPanelInPreview: false,
    isImportNoticeDismissed: false,
    copyStatusMessage: '',
    copyFenStatusMessage: '',
    lastCopiedFen: '',
    sessionCleanupNotice: '',
    engineStatus: ANALYSIS_ENGINE_STATES.IDLE,
    engineStatusLabel: ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.READY],
    analysisResult: null,
    analysisStale: false,
    analysisStaleMessage: '',
    analysisError: null,
    lastKnownBoardFen: null,
    lastAnalyzedFen: null,
    clipboardFeedback: null,
    gameReviewStatus: GAME_REVIEW_STATUS.IDLE,
    gameReviewProgress: { current: 0, total: 0, percent: 0, currentPly: 0 },
    gameReviewReport: null,
    gameReviewGraphData: null,
    gameReviewSaveStatus: 'idle',
    gameReviewSaveError: null,
    savedHistoryId: null,
    mobileAnalysisState: 'idle' // 'idle' | 'analyzing' | 'stop_available'
  };
}

export function resetAnalysisExplorationState(state, { preserveCleanupNotice = false } = {}) {
  if (!state) return;
  state.currentPly = 0;
  state.activeLineId = 'mainline';
  state.analysisMode = 'explore';
  state.variations = [];
  state.variationCounter = 1;
  state.renamingVariationId = null;
  state.analysisResult = null;
  state.analysisStale = false;
  state.analysisStaleMessage = '';
  state.analysisError = null;
  state.lastKnownBoardFen = null;
  state.lastAnalyzedFen = null;
  state.gameReviewStatus = GAME_REVIEW_STATUS.IDLE;
  state.gameReviewProgress = { current: 0, total: 0, percent: 0, currentPly: 0 };
  state.gameReviewReport = null;
  state.gameReviewGraphData = null;
  state.gameReviewSaveStatus = 'idle';
  state.gameReviewSaveError = null;
  state.savedHistoryId = null;
  state.mobileAnalysisState = 'idle';

  if (mobileAnalysisTimerId) {
    clearTimeout(mobileAnalysisTimerId);
    mobileAnalysisTimerId = null;
  }
  mobileAnalysisStartTime = 0;

  if (!preserveCleanupNotice) {
    state.sessionCleanupNotice = '';
  }

  if (chessGameReview && typeof chessGameReview.stopGameReview === 'function') {
    try {
      chessGameReview.stopGameReview('reset_exploration');
    } catch {
      // Abaikan
    }
  }

  if (activeAnalysisEngineInstance && typeof activeAnalysisEngineInstance.stopAnalysis === 'function') {
    activeAnalysisEngineInstance.stopAnalysis('reset_exploration');
  } else if (chessAnalysisEngine && typeof chessAnalysisEngine.stopAnalysis === 'function') {
    chessAnalysisEngine.stopAnalysis('reset_exploration');
  }

  if (activeReplayBoardInstance) {
    activeReplayBoardInstance.clearRecommendedMove({ render: false });
    activeReplayBoardInstance.setGameReviewReport(null, { render: false });
    activeReplayBoardInstance.resetToStart({ silent: true });
  }
}

/**
 * Render halaman Chess Analysis Studio (MVP 5.7).
 */
export function renderAnalysisView(container, sessionState, callbacks = {}) {
  if (!container) return;

  const state = sessionState || createInitialAnalysisSessionState();
  const hasValidGame = Boolean(state.parsedGame && state.parsedGame.valid);
  const isMobile = isMobileAnalysisViewport();
  const isMobileOrTabletPortrait =
    typeof window !== 'undefined' && typeof window.innerWidth === 'number'
      ? window.innerWidth <= 768
      : isMobile;

  // Pastikan state.mobileScreen konsisten
  if (!hasValidGame) {
    state.mobileScreen = 'import';
  } else if (
    state.mobileScreen !== 'import' &&
    state.mobileScreen !== 'board' &&
    state.mobileScreen !== 'graph' &&
    state.mobileScreen !== 'moves'
  ) {
    state.mobileScreen = 'board';
  }

  const activeMobileScreen = state.mobileScreen || (hasValidGame ? 'board' : 'import');
  state.mobileScreen = activeMobileScreen;

  const showInputWorkspace = isMobile
    ? activeMobileScreen === 'import'
    : !hasValidGame || Boolean(state.showInputPanelInPreview);

  const showPreviewWorkspace = isMobile
    ? hasValidGame && activeMobileScreen !== 'import'
    : hasValidGame;

  const hasError = Boolean(state.validationError);
  const showMobileGuideNotice =
    isMobileOrTabletPortrait &&
    activeMobileScreen === 'import' &&
    !hasValidGame &&
    !state.isImportNoticeDismissed;
  const showNotificationBanner =
    (hasError && (activeMobileScreen === 'import' || !isMobile)) || showMobileGuideNotice;
  const bannerStateClass = hasError ? 'is-error' : 'is-notice';

  // Hancurkan activeReplayBoardInstance lama jika beralih ke import atau partai berbeda
  if (!hasValidGame || activeMobileScreen === 'import') {
    destroyActiveAnalysisBoard({ terminateEngine: false });
  } else if (activeGameReviewPanelInstance) {
    // Bersihkan panel Game Review yang lama agar dapat dipasang ulang di mount target yang sesuai
    try {
      activeGameReviewPanelInstance.destroy();
    } catch {
      // Abaikan
    }
    activeGameReviewPanelInstance = null;
  }

  container.innerHTML = `
    <div
      class="analysis-studio-page mobile-screen-${activeMobileScreen}"
      data-testid="analysis-studio-page"
      data-mobile-screen="${activeMobileScreen}"
    >
      <!-- ========================================== -->
      <!-- MOBILE TOPBARS (<= 600px)                  -->
      <!-- ========================================== -->

      <!-- Mobile Screen: Import Topbar -->
      <header
        class="analysis-mobile-only analysis-mobile-import-topbar ${activeMobileScreen === 'import' ? '' : 'hidden'}"
        data-testid="analysis-mobile-import-topbar"
      >
        <div class="analysis-mobile-topbar-row" data-testid="analysis-mobile-topbar-row">
          <button
            type="button"
            class="btn btn-secondary btn-sm analysis-touch-btn analysis-mobile-back-btn"
            data-action="mobile-back-from-studio"
            data-testid="analysis-mobile-import-back-btn"
            aria-label="Kembali ke halaman sebelumnya"
          >
            ${UI_ICONS.arrowLeft}
            <span>Kembali</span>
          </button>
          <span class="badge badge-accent badge-orange" data-testid="analysis-mobile-mvp-badge">MVP 5.7</span>
        </div>
        <h1 class="analysis-mobile-title" data-testid="analysis-mobile-import-title">Chess Analysis Studio</h1>
        <p class="analysis-mobile-subtitle" data-testid="analysis-mobile-import-desc">
          Import dan analisis permainan catur Anda
        </p>
      </header>

      <!-- Mobile Screen: Board Topbar -->
      <header
        class="analysis-mobile-only analysis-mobile-board-topbar ${activeMobileScreen === 'board' && hasValidGame ? '' : 'hidden'}"
        data-testid="analysis-mobile-board-topbar"
      >
        <button
          type="button"
          class="btn btn-secondary btn-sm analysis-touch-btn analysis-mobile-back-btn"
          data-action="mobile-back-to-import"
          data-testid="analysis-mobile-back-to-import-btn"
          aria-label="Kembali ke PGN Import"
        >
          ${UI_ICONS.arrowLeft}
          <span>Import PGN</span>
        </button>
        <h1 class="analysis-mobile-header-title" data-testid="analysis-mobile-board-title">Analisis Permainan</h1>
        <div class="analysis-mobile-topbar-right">
          <button
            type="button"
            class="btn btn-secondary btn-sm analysis-touch-btn"
            data-action="copy-current-fen-mobile"
            data-testid="analysis-mobile-copy-fen-btn"
            title="Salin FEN Posisi"
            aria-label="Salin FEN Posisi"
          >
            ${UI_ICONS.copy}
          </button>
        </div>
      </header>

      <!-- Mobile Screen: Graph Topbar -->
      <header
        class="analysis-mobile-only analysis-mobile-subpage-topbar ${activeMobileScreen === 'graph' && hasValidGame ? '' : 'hidden'}"
        data-testid="analysis-mobile-graph-topbar"
      >
        <button
          type="button"
          class="btn btn-secondary btn-sm analysis-touch-btn analysis-mobile-back-btn"
          data-action="mobile-nav-board"
          data-testid="analysis-mobile-graph-back-btn"
          aria-label="Kembali ke Papan Analisis"
        >
          ${UI_ICONS.arrowLeft}
          <span>Kembali ke Papan</span>
        </button>
        <h1 class="analysis-mobile-header-title">Grafik Analisis</h1>
      </header>

      <!-- Mobile Screen: Moves Topbar -->
      <header
        class="analysis-mobile-only analysis-mobile-subpage-topbar ${activeMobileScreen === 'moves' && hasValidGame ? '' : 'hidden'}"
        data-testid="analysis-mobile-moves-topbar"
      >
        <button
          type="button"
          class="btn btn-secondary btn-sm analysis-touch-btn analysis-mobile-back-btn"
          data-action="mobile-nav-board"
          data-testid="analysis-mobile-moves-back-btn"
          aria-label="Kembali ke Papan Analisis"
        >
          ${UI_ICONS.arrowLeft}
          <span>Kembali ke Papan</span>
        </button>
        <h1 class="analysis-mobile-header-title">Daftar Langkah</h1>
      </header>

      <!-- ========================================== -->
      <!-- DESKTOP & TABLET HEADER (> 600px)          -->
      <!-- ========================================== -->
      <header class="section-header analysis-studio-header analysis-desktop-header">
        <div class="analysis-studio-title-group">
          <div class="analysis-studio-kicker">
            <span class="badge badge-orange">MVP 5.7 • Studio Analisis</span>
            <span class="badge" data-testid="analysis-zero-cloud-badge">100% Lokal di Browser</span>
          </div>
          <h1 class="page-title" data-testid="analysis-studio-title">Chess Analysis Studio</h1>
          <p class="page-subtitle" data-testid="analysis-studio-description">
            Import, review, dan pelajari permainan catur Anda secara interaktif.
          </p>
        </div>
        ${
          hasValidGame
            ? `
          <div class="analysis-header-actions">
            <span class="badge badge-green analysis-valid-badge" data-testid="pgn-valid-badge">
              ${UI_ICONS.checkCircle}
              <span>PGN Valid</span>
            </span>
            <button
              type="button"
              class="btn btn-secondary btn-sm analysis-touch-btn"
              data-action="analysis-toggle-reimport"
              data-testid="analysis-reimport-btn"
            >
              ${UI_ICONS.upload}
              <span>${state.showInputPanelInPreview ? 'Tutup Form Impor' : 'Impor Ulang PGN'}</span>
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm analysis-touch-btn"
              data-action="analysis-back-initial"
              data-testid="analysis-back-studio-btn"
            >
              ${UI_ICONS.arrowLeft}
              <span>Halaman Awal Studio</span>
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm analysis-touch-btn analysis-danger-btn"
              data-action="analysis-delete-game"
              data-testid="analysis-delete-game-btn"
            >
              ${UI_ICONS.trash}
              <span>Hapus Partai</span>
            </button>
          </div>
        `
            : ''
        }
      </header>

      <!-- NOTIFICATION & ERROR BANNER -->
      <div
        class="analysis-error-banner ${bannerStateClass} ${showNotificationBanner ? '' : 'hidden'}"
        role="alert"
        aria-live="assertive"
        data-testid="pgn-error-alert"
      >
        <div class="analysis-error-icon" aria-hidden="true">${UI_ICONS.alertTriangle}</div>
        <div class="analysis-error-body">
          <strong class="analysis-error-title" data-testid="pgn-error-title"></strong>
          <p class="analysis-error-message" data-testid="pgn-error-message"></p>
        </div>
        <button
          type="button"
          class="btn btn-ghost btn-sm analysis-touch-btn analysis-error-close-btn"
          data-action="analysis-dismiss-error"
          data-testid="pgn-error-dismiss-btn"
          aria-label="Tutup pesan notifikasi"
        >
          ${UI_ICONS.close}
        </button>
      </div>

      <!-- ========================================== -->
      <!-- SCREEN 1: INPUT SECTION (UPLOAD / PASTE)   -->
      <!-- ========================================== -->
      <section
        class="analysis-input-section ${showInputWorkspace ? '' : 'hidden'}"
        aria-label="Area Input PGN"
        data-testid="pgn-input-section"
      >
        <div class="analysis-input-grid">
          <!-- Metode A: Upload PGN File -->
          <article class="card analysis-input-card" data-testid="pgn-upload-card">
            <div class="analysis-card-header">
              <div class="analysis-card-icon">${UI_ICONS.upload}</div>
              <div>
                <h2 class="card-title">A. Upload File PGN</h2>
                <p class="card-subtitle">Pilih file berformat <code>.pgn</code> dari perangkat Anda (maksimal 2 MB).</p>
              </div>
            </div>

            <div class="analysis-upload-zone" data-testid="pgn-upload-zone">
              <input
                type="file"
                id="pgn-file-input"
                class="analysis-file-input-hidden"
                accept=".pgn,application/x-chess-pgn,text/plain"
                data-testid="pgn-file-input"
              />
              <div class="analysis-upload-illustration" aria-hidden="true">
                ${UI_ICONS.fileText}
              </div>
              <p class="analysis-upload-prompt">
                Unggah dokumen partai catur (<strong>.pgn</strong>) untuk divalidasi secara berurutan.
              </p>
              <div class="analysis-upload-trigger-row">
                <button
                  type="button"
                  class="btn btn-primary analysis-touch-btn"
                  data-action="trigger-file-picker"
                  data-testid="pgn-upload-trigger-btn"
                >
                  ${UI_ICONS.upload}
                  <span>Pilih File PGN</span>
                </button>
              </div>
              <span class="analysis-upload-hint">Batas aman ukuran file: ${formatFileSize(MAX_PGN_FILE_SIZE_BYTES)} (1 partai per impor)</span>
            </div>

            <div
              class="analysis-selected-file-box ${state.selectedFileMeta ? '' : 'hidden'}"
              data-testid="pgn-selected-file-box"
            >
              <div class="analysis-file-meta-info">
                <span class="analysis-file-icon" aria-hidden="true">${UI_ICONS.fileText}</span>
                <div class="analysis-file-text-wrap">
                  <strong class="analysis-file-name" data-testid="pgn-selected-filename"></strong>
                  <span class="analysis-file-size" data-testid="pgn-selected-filesize"></span>
                </div>
              </div>
              <div class="analysis-file-actions">
                <button
                  type="button"
                  class="btn btn-primary btn-sm analysis-touch-btn analysis-desktop-only-btn"
                  data-action="import-selected-file"
                  data-testid="pgn-import-file-btn"
                >
                  ${UI_ICONS.check}
                  <span>Impor File</span>
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-touch-btn"
                  data-action="change-selected-file"
                  data-testid="pgn-change-file-btn"
                >
                  <span>Ganti File</span>
                </button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm analysis-touch-btn analysis-danger-btn"
                  data-action="remove-selected-file"
                  data-testid="pgn-remove-file-btn"
                >
                  ${UI_ICONS.trash}
                  <span>Hapus File</span>
                </button>
              </div>
            </div>
          </article>

          <!-- Metode B: Paste PGN -->
          <article class="card analysis-input-card" data-testid="pgn-paste-card">
            <div class="analysis-card-header">
              <div class="analysis-card-icon">${UI_ICONS.fileText}</div>
              <div>
                <h2 class="card-title">B. Tempel (Paste) Teks PGN</h2>
                <p class="card-subtitle">Tempelkan tag header dan notasi langkah SAN secara langsung.</p>
              </div>
            </div>

            <div class="analysis-paste-form">
              <label for="pgn-paste-textarea" class="analysis-textarea-label">
                Konten PGN (Header & Notasi SAN)
              </label>
              <textarea
                id="pgn-paste-textarea"
                class="analysis-textarea"
                rows="8"
                inputmode="text"
                spellcheck="false"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                placeholder="[Event ...]
1. e4 e5 2. Nf3 Nc6..."
                data-testid="pgn-paste-textarea"
              ></textarea>

              <div
                class="analysis-clipboard-feedback ${state.clipboardFeedback ? `is-${state.clipboardFeedback.status || 'info'}` : 'hidden'}"
                data-testid="pgn-clipboard-feedback"
                data-status="${state.clipboardFeedback ? state.clipboardFeedback.status || 'info' : ''}"
                role="status"
                aria-live="polite"
              ></div>

              <div class="analysis-paste-actions">
                <button
                  type="button"
                  class="btn btn-secondary analysis-touch-btn analysis-clipboard-paste-btn"
                  data-action="paste-from-clipboard"
                  data-testid="pgn-paste-clipboard-btn"
                  ${state.isValidating ? 'disabled' : ''}
                >
                  ${UI_ICONS.copy}
                  <span>Tempel dari Papan Klip</span>
                </button>
                <button
                  type="button"
                  class="btn btn-primary analysis-touch-btn analysis-desktop-submit-btn"
                  data-action="submit-paste-pgn"
                  data-testid="pgn-paste-submit-btn"
                  ${state.isValidating ? 'disabled' : ''}
                >
                  ${UI_ICONS.check}
                  <span>Paste / Import PGN</span>
                </button>
                <button
                  type="button"
                  class="btn btn-secondary analysis-touch-btn"
                  data-action="clear-paste-pgn"
                  data-testid="pgn-paste-clear-btn"
                >
                  ${UI_ICONS.trash}
                  <span>Clear</span>
                </button>
                <button
                  type="button"
                  class="btn btn-ghost analysis-touch-btn"
                  data-action="load-sample-pgn"
                  data-testid="pgn-load-sample-btn"
                >
                  <span>Contoh PGN</span>
                </button>
              </div>
            </div>
          </article>
        </div>

        <!-- CTA KHUSUS MOBILE SCREEN 1 -->
        <div class="analysis-mobile-only analysis-mobile-cta-bar" data-testid="analysis-mobile-cta-bar">
          <button
            type="button"
            class="btn btn-primary analysis-touch-btn analysis-mobile-validate-cta"
            data-action="mobile-validate-and-review"
            data-testid="analysis-mobile-validate-cta"
            ${state.isValidating ? 'disabled' : ''}
          >
            ${UI_ICONS.checkCircle}
            <span data-testid="analysis-mobile-validate-cta-label">
              ${state.isValidating ? 'Memvalidasi PGN...' : 'Validasi & Mulai Analisis'}
            </span>
          </button>
        </div>
      </section>

      <!-- ========================================== -->
      <!-- SCREEN 2/3/4: PREVIEW & ANALYSIS WORKSPACE -->
      <!-- ========================================== -->
      <section
        class="analysis-preview-section ${showPreviewWorkspace ? '' : 'hidden'}"
        aria-label="Preview Partai dan Papan Analisis Interaktif"
        data-testid="pgn-preview-section"
      >
        <!-- DESKTOP METADATA CARD (> 600px) -->
        <div class="card analysis-metadata-card analysis-desktop-metadata-card" data-testid="pgn-metadata-card">
          <div class="analysis-metadata-header">
            <div class="analysis-metadata-title-wrap">
              <span class="badge badge-green" data-testid="pgn-preview-valid-badge">PGN Valid</span>
              <h2 class="card-title">Informasi & Metadata Partai</h2>
            </div>
          </div>
          <div class="analysis-metadata-grid">
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Pemain Putih</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-white"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Pemain Hitam</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-black"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Event / Turnamen</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-event"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Lokasi (Site)</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-site"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Tanggal Partai</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-date"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Hasil Akhir</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-result"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Total Langkah</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-total-moves"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Status Terminal</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-final-status"></strong>
            </div>
          </div>
          <div class="analysis-fen-summary-grid">
            <div class="analysis-fen-box">
              <span class="analysis-meta-label">Posisi Awal (Initial FEN)</span>
              <code class="analysis-fen-code" data-testid="pgn-meta-initial-fen"></code>
            </div>
            <div class="analysis-fen-box">
              <span class="analysis-meta-label">Posisi Akhir (Final FEN)</span>
              <code class="analysis-fen-code" data-testid="pgn-meta-final-fen"></code>
            </div>
          </div>
        </div>

        <!-- WORKSPACE GRID (Desktop 2-Kolom / Mobile Subscreens) -->
        <div class="analysis-workspace-grid" data-testid="analysis-interactive-preview">
          
          <!-- ============================================== -->
          <!-- MOBILE SCREEN 'board' & DESKTOP LEFT COLUMN    -->
          <!-- ============================================== -->
          <div class="analysis-board-column mobile-page-board ${activeMobileScreen === 'board' || !isMobile ? '' : 'hidden'}">
            
            <!-- MOBILE TOP ACTION: ANALISIS POSISI (HERO BUTTON) -->
            <div class="analysis-mobile-only analysis-mobile-top-action-bar" data-testid="analysis-mobile-top-action-bar">
              <button
                type="button"
                class="btn btn-primary analysis-mobile-top-analyze-btn ${state.mobileAnalysisState === 'stop_available' ? 'btn-danger' : ''}"
                data-action="mobile-top-analyze"
                data-testid="analysis-mobile-top-analyze-btn"
                data-state="${state.mobileAnalysisState || 'idle'}"
              >
                ${state.mobileAnalysisState === 'analyzing' || state.mobileAnalysisState === 'stop_available'
                  ? `<span class="analysis-engine-spinner" aria-hidden="true"></span>`
                  : UI_ICONS.zap}
                <span data-testid="analysis-mobile-top-analyze-label">
                  ${state.mobileAnalysisState === 'analyzing'
                    ? 'Menganalisis...'
                    : state.mobileAnalysisState === 'stop_available'
                    ? 'Hentikan Analisis'
                    : 'Analisis Posisi'}
                </span>
              </button>
            </div>

            <!-- Bar Pemain Atas -->
            <div class="analysis-player-strip" data-testid="analysis-top-player-strip">
              <span class="analysis-player-color-dot" data-testid="analysis-top-player-dot"></span>
              <strong class="analysis-player-name" data-testid="analysis-top-player-name"></strong>
              <span class="analysis-player-side-tag" data-testid="analysis-top-player-role"></span>
            </div>

            <!-- Interactive Chessboard 1:1 -->
            <div id="analysis-replay-board-mount" data-testid="analysis-replay-board-mount"></div>

            <!-- Bar Pemain Bawah -->
            <div class="analysis-player-strip" data-testid="analysis-bottom-player-strip">
              <span class="analysis-player-color-dot" data-testid="analysis-bottom-player-dot"></span>
              <strong class="analysis-player-name" data-testid="analysis-bottom-player-name"></strong>
              <span class="analysis-player-side-tag" data-testid="analysis-bottom-player-role"></span>
            </div>

            <!-- MOBILE MOVE STRIP (Horizontal SAN Strip) -->
            <div
              class="analysis-mobile-only analysis-mobile-move-strip"
              role="region"
              aria-label="Strip Navigasi Notasi SAN Mobile"
              data-testid="analysis-mobile-move-strip"
            >
              <button
                type="button"
                class="btn btn-secondary btn-sm analysis-mobile-strip-nav-btn"
                data-action="mobile-strip-prev"
                data-testid="analysis-mobile-strip-prev"
                aria-label="Langkah Sebelumnya"
              >
                ${UI_ICONS.chevronLeft}
              </button>
              <div
                class="analysis-mobile-strip-scroll"
                data-testid="analysis-mobile-strip-scroll"
              ></div>
              <button
                type="button"
                class="btn btn-secondary btn-sm analysis-mobile-strip-nav-btn"
                data-action="mobile-strip-next"
                data-testid="analysis-mobile-strip-next"
                aria-label="Langkah Berikutnya"
              >
                ${UI_ICONS.chevronRight}
              </button>
            </div>

            <!-- MOBILE COMMENT BAR -->
            <div
              class="analysis-mobile-only analysis-mobile-comment-bar hidden"
              data-testid="analysis-mobile-comment-bar"
            >
              <span class="analysis-mobile-comment-label">Komentar PGN:</span>
              <span class="analysis-mobile-comment-text" data-testid="analysis-mobile-comment-text"></span>
            </div>

            <!-- MOBILE BOTTOM NAVIGATION (Icon Only Nav + Subpage Nav Buttons) -->
            <div class="analysis-mobile-only analysis-mobile-board-bottom-container">
              <!-- Toolbar 5 Icon-Only Buttons -->
              <nav
                class="analysis-mobile-bottom-toolbar"
                aria-label="Toolbar Navigasi Langkah Mobile"
                data-testid="analysis-mobile-bottom-toolbar"
              >
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-mobile-toolbar-btn icon-only-btn"
                  data-action="mobile-toolbar-first"
                  data-testid="analysis-mobile-btn-first"
                  aria-label="Posisi Awal"
                  title="Posisi Awal"
                >
                  ${UI_ICONS.skipBack}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-mobile-toolbar-btn icon-only-btn"
                  data-action="mobile-toolbar-prev"
                  data-testid="analysis-mobile-btn-prev"
                  aria-label="Langkah Sebelumnya"
                  title="Langkah Sebelumnya"
                >
                  ${UI_ICONS.chevronLeft}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-mobile-toolbar-btn icon-only-btn"
                  data-action="mobile-toolbar-next"
                  data-testid="analysis-mobile-btn-next"
                  aria-label="Langkah Berikutnya"
                  title="Langkah Berikutnya"
                >
                  ${UI_ICONS.chevronRight}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-mobile-toolbar-btn icon-only-btn"
                  data-action="mobile-toolbar-last"
                  data-testid="analysis-mobile-btn-last"
                  aria-label="Posisi Akhir"
                  title="Posisi Akhir"
                >
                  ${UI_ICONS.skipForward}
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-mobile-toolbar-btn icon-only-btn"
                  data-action="mobile-toolbar-flip"
                  data-testid="analysis-mobile-btn-flip"
                  aria-label="Balik Orientasi Papan"
                  title="Balik Orientasi Papan"
                >
                  ${UI_ICONS.flip}
                </button>
              </nav>

              <!-- Dua Tombol Navigasi Halaman Mobile: Grafik Analisis & Daftar Langkah -->
              <div class="analysis-mobile-subpage-nav-row" data-testid="analysis-mobile-subpage-nav-row">
                <button
                  type="button"
                  class="btn btn-secondary analysis-touch-btn analysis-mobile-subpage-btn"
                  data-action="mobile-nav-graph"
                  data-testid="analysis-mobile-to-graph-btn"
                >
                  ${UI_ICONS.activity}
                  <span>Grafik Analisis</span>
                </button>
                <button
                  type="button"
                  class="btn btn-secondary analysis-touch-btn analysis-mobile-subpage-btn"
                  data-action="mobile-nav-moves"
                  data-testid="analysis-mobile-to-moves-btn"
                >
                  ${UI_ICONS.list}
                  <span>Daftar Langkah</span>
                </button>
              </div>
            </div>
          </div>

          <!-- ============================================== -->
          <!-- MOBILE SCREEN 'graph'                         -->
          <!-- ============================================== -->
          <div class="analysis-mobile-only analysis-mobile-subpage-content mobile-page-graph ${activeMobileScreen === 'graph' ? '' : 'hidden'}">
            <div id="game-review-panel-mount-mobile" data-testid="game-review-panel-mount-mobile"></div>
            <div class="analysis-mobile-return-bottom-bar">
              <button
                type="button"
                class="btn btn-primary analysis-touch-btn analysis-mobile-return-btn"
                data-action="mobile-nav-board"
                data-testid="analysis-mobile-graph-return-btn"
              >
                ${UI_ICONS.arrowLeft}
                <span>Kembali ke Papan</span>
              </button>
            </div>
          </div>

          <!-- ============================================== -->
          <!-- MOBILE SCREEN 'moves'                         -->
          <!-- ============================================== -->
          <div class="analysis-mobile-only analysis-mobile-subpage-content mobile-page-moves ${activeMobileScreen === 'moves' ? '' : 'hidden'}">
            <div class="card analysis-moves-panel-mobile">
              <div class="analysis-moves-panel-header">
                <div>
                  <h3 class="card-title">Daftar Langkah Permainan</h3>
                  <p class="card-subtitle" data-testid="analysis-mobile-step-counter-subtitle"></p>
                </div>
                <span class="badge" data-testid="analysis-mobile-ply-badge"></span>
              </div>

              <div
                class="analysis-move-list-scroll"
                role="region"
                aria-label="Navigasi urutan langkah catur mobile"
                tabindex="0"
                data-testid="analysis-mobile-move-list"
              ></div>

              <!-- Variation Manager Mobile -->
              <div
                class="analysis-variation-manager"
                role="region"
                aria-label="Variation Manager Mobile"
                data-testid="analysis-mobile-variation-manager"
              >
                <div class="analysis-variation-header">
                  <div class="analysis-variation-title-group">
                    <h4 class="analysis-variation-title">Variation Manager</h4>
                    <span class="badge analysis-variation-count-badge" data-testid="analysis-mobile-variation-count-badge">0 variasi</span>
                  </div>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm analysis-mainline-pill-btn"
                    data-action="switch-to-mainline"
                    data-testid="analysis-mobile-line-mainline"
                  >
                    Mainline (Partai Asli)
                  </button>
                </div>

                <div
                  class="analysis-variation-list"
                  data-testid="analysis-mobile-variation-list"
                ></div>
              </div>
            </div>

            <div class="analysis-mobile-return-bottom-bar">
              <button
                type="button"
                class="btn btn-primary analysis-touch-btn analysis-mobile-return-btn"
                data-action="mobile-nav-board"
                data-testid="analysis-mobile-moves-return-btn"
              >
                ${UI_ICONS.arrowLeft}
                <span>Kembali ke Papan</span>
              </button>
            </div>
          </div>

          <!-- ============================================== -->
          <!-- DESKTOP RIGHT COLUMN (> 600px)                 -->
          <!-- ============================================== -->
          <aside class="card analysis-moves-panel analysis-desktop-moves-panel analysis-desktop-only" aria-label="Analisis Stockfish, Game Review, Riwayat Langkah SAN, dan Variasi">
            <!-- Stockfish 19 Analysis Panel (Desktop) -->
            <div
              class="analysis-engine-panel"
              role="region"
              aria-label="Panel Analisis Engine Stockfish"
              data-testid="analysis-engine-panel"
              data-engine-status="ready"
            >
              <div class="analysis-engine-header">
                <div class="analysis-engine-title-group">
                  <span class="analysis-engine-icon" aria-hidden="true">${UI_ICONS.cpu}</span>
                  <div>
                    <h3 class="analysis-engine-title">Stockfish 19 Analysis</h3>
                    <p class="analysis-engine-subtitle" data-testid="analysis-engine-mode-context"></p>
                  </div>
                </div>
                <span
                  class="badge analysis-engine-status-badge status-ready"
                  data-testid="analysis-engine-status-badge"
                  data-engine-status="ready"
                >Ready</span>
              </div>

              <div class="analysis-engine-controls" role="group" aria-label="Kontrol Analisis Stockfish">
                <button
                  type="button"
                  class="btn btn-primary btn-sm analysis-touch-btn analysis-engine-btn"
                  data-action="analysis-start-engine"
                  data-testid="analysis-analyze-btn"
                >
                  ${UI_ICONS.zap}
                  <span data-testid="analysis-analyze-btn-label">Analisis Posisi</span>
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-touch-btn analysis-engine-btn"
                  data-action="analysis-stop-engine"
                  data-testid="analysis-stop-btn"
                  disabled
                >
                  <span>Hentikan Analisis</span>
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-touch-btn analysis-engine-btn"
                  data-action="analysis-reanalyze-engine"
                  data-testid="analysis-reanalyze-btn"
                >
                  ${UI_ICONS.restart}
                  <span>Analisis Ulang</span>
                </button>
              </div>

              <!-- Empty State -->
              <div
                class="analysis-engine-state-box analysis-engine-empty"
                data-testid="analysis-engine-empty"
              >
                <p class="analysis-engine-empty-text" data-testid="analysis-engine-empty-text">
                  Tekan "Analisis Posisi" untuk menganalisis posisi aktif dengan Stockfish 19 Lite.
                </p>
              </div>

              <!-- Stale Notice -->
              <div
                class="analysis-engine-state-box analysis-engine-stale hidden"
                data-testid="analysis-engine-stale-notice"
              >
                <p class="analysis-engine-stale-text" data-testid="analysis-engine-stale-text"></p>
              </div>

              <!-- Loading State -->
              <div
                class="analysis-engine-state-box analysis-engine-loading hidden"
                data-testid="analysis-engine-loading"
              >
                <span class="analysis-engine-spinner" aria-hidden="true"></span>
                <p class="analysis-engine-loading-text" data-testid="analysis-engine-loading-text">
                  Stockfish sedang menganalisis posisi aktif...
                </p>
              </div>

              <!-- Error State -->
              <div
                class="analysis-engine-state-box analysis-engine-error hidden"
                role="alert"
                data-testid="analysis-engine-error"
              >
                <p class="analysis-engine-error-text" data-testid="analysis-engine-error-text"></p>
              </div>

              <!-- Finalized Results -->
              <div
                class="analysis-engine-results hidden"
                data-testid="analysis-engine-results"
              >
                <div class="analysis-engine-top-metrics">
                  <div class="analysis-eval-card" data-testid="analysis-eval-card">
                    <span class="analysis-meta-label">Evaluasi Posisi (Perspektif Putih)</span>
                    <div class="analysis-eval-main-row">
                      <strong class="analysis-eval-score" data-testid="analysis-eval-score"></strong>
                      <span class="badge analysis-depth-badge" data-testid="analysis-depth-value"></span>
                    </div>
                    <span class="analysis-eval-advantage" data-testid="analysis-eval-label"></span>
                  </div>

                  <div class="analysis-best-move-card" data-testid="analysis-best-move-card">
                    <span class="analysis-meta-label">Langkah Terbaik</span>
                    <strong class="analysis-best-move-san" data-testid="analysis-best-move-san"></strong>
                    <span class="analysis-best-move-squares" data-testid="analysis-best-move-squares"></span>
                  </div>
                </div>

                <div class="analysis-pv-card" data-testid="analysis-pv-card">
                  <div class="analysis-pv-header">
                    <span class="analysis-meta-label">Variasi Utama (PV)</span>
                    <span class="analysis-pv-sub" data-testid="analysis-pv-count"></span>
                  </div>
                  <div class="analysis-pv-line" data-testid="analysis-pv-line"></div>
                </div>
              </div>
            </div>

            <!-- Game Review & Evaluation Graph Mount Point (Desktop) -->
            <div id="game-review-panel-mount" data-testid="game-review-panel-mount"></div>

            <!-- Moves List Header -->
            <div class="analysis-moves-panel-header">
              <div>
                <h3 class="card-title">Daftar Langkah (SAN)</h3>
                <p class="card-subtitle" data-testid="analysis-step-counter-subtitle"></p>
              </div>
              <span class="badge" data-testid="analysis-ply-badge"></span>
            </div>

            <!-- Move List Table -->
            <div
              class="analysis-move-list-scroll"
              role="region"
              aria-label="Navigasi urutan langkah catur"
              tabindex="0"
              data-testid="analysis-move-list"
            ></div>

            <!-- Variation Manager (Desktop) -->
            <div
              class="analysis-variation-manager"
              role="region"
              aria-label="Variation Manager"
              data-testid="analysis-variation-manager"
            >
              <div class="analysis-variation-header">
                <div class="analysis-variation-title-group">
                  <h4 class="analysis-variation-title">Variation Manager</h4>
                  <span class="badge analysis-variation-count-badge" data-testid="analysis-variation-count-badge">0 variasi</span>
                </div>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-mainline-pill-btn"
                  data-action="switch-to-mainline"
                  data-testid="analysis-line-mainline"
                >
                  Mainline (Partai Asli)
                </button>
              </div>

              <p
                class="analysis-session-memory-notice hidden"
                data-testid="analysis-unsaved-variations-notice"
              ></p>
              <p
                class="analysis-session-cleanup-notice hidden"
                data-testid="analysis-session-cleanup-notice"
              ></p>

              <div
                class="analysis-variation-list"
                data-testid="analysis-variation-list"
              ></div>
            </div>

            <div class="analysis-annotation-box hidden" data-testid="analysis-move-annotation">
              <span class="analysis-meta-label" data-testid="analysis-move-annotation-label">Komentar PGN</span>
              <p class="analysis-annotation-text" data-testid="analysis-move-annotation-text"></p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  `;

  // Isi placeholder dan nilai textarea secara aman
  const textareaEl = container.querySelector('[data-testid="pgn-paste-textarea"]');
  if (textareaEl) {
    textareaEl.placeholder = PGN_TEXTAREA_PLACEHOLDER;
    textareaEl.removeAttribute('readonly');
    textareaEl.removeAttribute('disabled');
    _syncClipboardFeedbackDom(container, state);
    textareaEl.value = state.rawPgnText || '';
  }

  // Isi pesan notifikasi / error secara utuh
  const errTitleEl = container.querySelector('[data-testid="pgn-error-title"]');
  const errMsgEl = container.querySelector('[data-testid="pgn-error-message"]');
  if (state.validationError) {
    if (errTitleEl) {
      errTitleEl.textContent = safeDisplayValue(
        state.validationError.errorTitle,
        'PGN tidak valid'
      );
    }
    if (errMsgEl) {
      errMsgEl.textContent = safeDisplayValue(
        state.validationError.errorMessage,
        'PGN tidak valid. Periksa kembali format notasi dan legalitas langkah catur.'
      );
    }
  } else {
    if (errTitleEl) {
      errTitleEl.textContent = 'Panduan Format PGN (Maks. 2 MB)';
    }
    if (errMsgEl) {
      errMsgEl.textContent =
        'Unggah satu file .pgn atau tempelkan urutan notasi langkah SAN yang legal untuk mulai menganalisis permainan.';
    }
  }

  // Isi metadata file yang dipilih bila ada
  if (state.selectedFileMeta) {
    const fileNameEl = container.querySelector('[data-testid="pgn-selected-filename"]');
    const fileSizeEl = container.querySelector('[data-testid="pgn-selected-filesize"]');
    if (fileNameEl) {
      fileNameEl.textContent = safeDisplayValue(state.selectedFileMeta.name, 'partai.pgn');
    }
    if (fileSizeEl) {
      fileSizeEl.textContent = safeDisplayValue(
        state.selectedFileMeta.formattedSize || formatFileSize(state.selectedFileMeta.size),
        '0 B'
      );
    }
  }

  // Jika ada partai valid, isi metadata & mount papan replay / panel
  if (hasValidGame) {
    _populateGamePreviewDom(container, state, callbacks);
  }

  _bindAnalysisViewEvents(container, state, callbacks);
}

/**
 * Mengisi informasi metadata, papan interaktif, Game Review panel, dan daftar langkah.
 */
function _populateGamePreviewDom(container, state, callbacks = {}) {
  const game = state.parsedGame;
  if (!game || !game.valid) return;

  const meta = game.metadata || {};

  const setText = (testId, text) => {
    const el = container.querySelector(`[data-testid="${testId}"]`);
    if (el) {
      el.textContent = safeDisplayValue(text, 'Tidak diketahui');
    }
  };

  const formattedResult =
    meta.result && meta.result !== 'Tidak diketahui'
      ? `${meta.result} (${formatPgnResultLabel(meta.result)})`
      : 'Tidak diketahui';

  // Metadata Desktop
  setText('pgn-meta-white', meta.white);
  setText('pgn-meta-black', meta.black);
  setText('pgn-meta-event', meta.event);
  setText('pgn-meta-site', meta.site);
  setText('pgn-meta-date', meta.date);
  setText('pgn-meta-result', formattedResult);
  setText(
    'pgn-meta-total-moves',
    `${Number(game.totalMoves) || 0} langkah (${Number(game.totalPlies) || 0} ply)`
  );
  setText(
    'pgn-meta-final-status',
    game.finalStatus ? game.finalStatus.description : 'Tidak diketahui'
  );
  setText('pgn-meta-initial-fen', game.initialFen);
  setText('pgn-meta-final-fen', game.finalFen);

  // Mount AnalysisReplayBoard (hanya jika elemen mount tersedia di DOM)
  const boardMount = container.querySelector('#analysis-replay-board-mount');
  const hasNoChildNodes =
    boardMount &&
    (typeof boardMount.hasChildNodes === 'function'
      ? !boardMount.hasChildNodes()
      : !boardMount.childNodes || boardMount.childNodes.length === 0);

  if (boardMount && hasNoChildNodes) {
    const engine =
      (callbacks && callbacks.analysisEngine) ||
      state.analysisEngine ||
      chessAnalysisEngine;
    activeAnalysisEngineInstance = engine;

    if (engine && typeof engine.onStatusChange === 'function') {
      activeEngineStatusUnsubscribe = engine.onStatusChange(statusInfo => {
        if (!activeReplayBoardInstance) return;
        const nextStatus = statusInfo && statusInfo.status ? statusInfo.status : ANALYSIS_ENGINE_STATES.READY;
        const nextLabel = statusInfo && statusInfo.label ? statusInfo.label : 'Ready';
        state.engineStatus = nextStatus;
        state.engineStatusLabel = nextLabel;
        _renderEngineAnalysisPanelDom(
          container,
          state,
          activeReplayBoardInstance.getReplayState()
        );
      });
    }

    const initialRecommendedMove =
      state.analysisResult &&
      !state.analysisStale &&
      state.analysisResult.bestMove &&
      state.analysisResult.fen
        ? { ...state.analysisResult.bestMove, fen: state.analysisResult.fen }
        : null;

    activeReplayBoardInstance = new AnalysisReplayBoard(boardMount, game, {
      initialPly: state.currentPly,
      orientation: state.orientation,
      mode: 'explore',
      variations: Array.isArray(state.variations) ? state.variations : [],
      activeLineId: state.activeLineId || 'mainline',
      variationCounter: Number(state.variationCounter) || 1,
      recommendedMove: initialRecommendedMove,
      gameReviewReport: state.gameReviewReport || null,
      onPlyChange: replayState => {
        const prevFen = state.lastKnownBoardFen;
        const nextFen = replayState.currentFen;
        const fenChanged = Boolean(prevFen && nextFen && prevFen !== nextFen);

        state.currentPly = replayState.currentPly;
        state.orientation = replayState.orientation;
        state.analysisMode = 'explore';
        state.activeLineId = replayState.activeLineId || 'mainline';
        state.lastKnownBoardFen = nextFen;

        if (activeReplayBoardInstance) {
          state.variations = activeReplayBoardInstance.getVariations();
          state.variationCounter = activeReplayBoardInstance.variationCounter;
        }

        if (fenChanged) {
          const currentEngine = getActiveAnalysisEngine();
          if (currentEngine && typeof currentEngine.notifyPositionChanged === 'function') {
            currentEngine.notifyPositionChanged(nextFen);
          }

          if (state.mobileAnalysisState === 'analyzing' || state.mobileAnalysisState === 'stop_available') {
            _cancelMobileAnalysis(container, state);
          }

          state.analysisResult = null;
          state.analysisStale = false;
          state.analysisStaleMessage = '';
          state.analysisError = null;
        }

        _syncReplayStatusDom(container, state, replayState);
        _renderMoveListBothDom(container, replayState);
        _renderVariationManagerBothDom(container, state, replayState);
        _renderEngineAnalysisPanelDom(container, state, replayState);
        _renderGameReviewPanelDom(container, state, replayState);
      }
    });

    const initialReplayState = activeReplayBoardInstance.getReplayState();
    state.lastKnownBoardFen = initialReplayState.currentFen;
    _syncReplayStatusDom(container, state, initialReplayState);
    _renderMoveListBothDom(container, initialReplayState);
    _renderVariationManagerBothDom(container, state, initialReplayState);
    _renderEngineAnalysisPanelDom(container, state, initialReplayState);
  }

  const currentReplayState = activeReplayBoardInstance
    ? activeReplayBoardInstance.getReplayState()
    : { currentPly: state.currentPly, totalPlies: game.totalPlies, currentFen: game.initialFen, orientation: state.orientation };

  _renderGameReviewPanelDom(container, state, currentReplayState);
  _renderMoveListBothDom(container, currentReplayState);
  _renderVariationManagerBothDom(container, state, currentReplayState);
}

function _renderMoveListBothDom(container, replayState) {
  const pairs = replayState.movePairs || [];
  const currentPly = replayState.currentPly;
  const activeLineId = replayState.activeLineId || 'mainline';

  // Desktop Move List
  const deskListEl = container.querySelector('[data-testid="analysis-move-list"]');
  if (deskListEl) {
    _renderMoveListDom(deskListEl, pairs, currentPly, activeLineId);
  }

  // Mobile Move List (Page 'moves')
  const mobileListEl = container.querySelector('[data-testid="analysis-mobile-move-list"]');
  if (mobileListEl) {
    _renderMoveListDom(mobileListEl, pairs, currentPly, activeLineId);
  }

  // Mobile SAN Move Strip
  const stripScrollEl = container.querySelector('[data-testid="analysis-mobile-strip-scroll"]');
  if (stripScrollEl) {
    _renderMobileMoveStripDom(stripScrollEl, pairs, currentPly, activeLineId);
  }
}

function _renderVariationManagerBothDom(container, state, replayState) {
  _renderVariationManagerDom(container, state, replayState);
}

function _renderMoveListDom(moveListEl, pairs, currentPly, activeLineId) {
  if (!moveListEl) return;
  moveListEl.innerHTML = '';

  if (!pairs || pairs.length === 0) {
    const emptyRow = document.createElement('div');
    emptyRow.className = 'analysis-move-list-empty';
    emptyRow.textContent = 'Belum ada notasi langkah.';
    moveListEl.appendChild(emptyRow);
    return;
  }

  let activeRowEl = null;

  pairs.forEach(pair => {
    const rowEl = document.createElement('div');
    rowEl.className = 'analysis-move-row';
    rowEl.setAttribute('data-move-number', pair.moveNumber);

    const numSpan = document.createElement('span');
    numSpan.className = 'analysis-move-number';
    numSpan.textContent = `${pair.moveNumber}.`;
    rowEl.appendChild(numSpan);

    if (pair.white) {
      const isWhiteActive = currentPly === pair.white.ply;
      const whiteBtn = _createMovePlyButton(pair.white, isWhiteActive, activeLineId);
      if (isWhiteActive) activeRowEl = rowEl;
      rowEl.appendChild(whiteBtn);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'analysis-move-btn-placeholder';
      placeholder.textContent = '...';
      rowEl.appendChild(placeholder);
    }

    if (pair.black) {
      const isBlackActive = currentPly === pair.black.ply;
      const blackBtn = _createMovePlyButton(pair.black, isBlackActive, activeLineId);
      if (isBlackActive) activeRowEl = rowEl;
      rowEl.appendChild(blackBtn);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'analysis-move-btn-placeholder';
      placeholder.textContent = '';
      rowEl.appendChild(placeholder);
    }

    moveListEl.appendChild(rowEl);
  });

  if (activeRowEl && moveListEl) {
    try {
      // Gulirkan internal move-list container tanpa mempengaruhi scroll halaman induk (window.scrollY)
      const topOffset = activeRowEl.offsetTop - moveListEl.offsetTop;
      moveListEl.scrollTop = topOffset - (moveListEl.clientHeight / 2) + (activeRowEl.clientHeight / 2);
    } catch {
      // Abaikan jika kalkulasi offset gagal
    }
  }
}

function _renderMobileMoveStripDom(mobileStripScrollEl, pairs, currentPly, activeLineId) {
  if (!mobileStripScrollEl) return;
  mobileStripScrollEl.innerHTML = '';

  if (!pairs || pairs.length === 0) {
    const emptyNotice = document.createElement('span');
    emptyNotice.className = 'analysis-mobile-strip-empty';
    emptyNotice.textContent = 'Posisi awal';
    mobileStripScrollEl.appendChild(emptyNotice);
    return;
  }

  let activePillEl = null;

  pairs.forEach(pair => {
    if (pair.white) {
      const isWhiteActive = currentPly === pair.white.ply;
      const whitePill = _createMobileSanPillButton(pair.white, isWhiteActive, activeLineId);
      if (isWhiteActive) activePillEl = whitePill;
      mobileStripScrollEl.appendChild(whitePill);
    }
    if (pair.black) {
      const isBlackActive = currentPly === pair.black.ply;
      const blackPill = _createMobileSanPillButton(pair.black, isBlackActive, activeLineId);
      if (isBlackActive) activePillEl = blackPill;
      mobileStripScrollEl.appendChild(blackPill);
    }
  });

  if (activePillEl && mobileStripScrollEl) {
    try {
      // Gulirkan strip horizontal tanpa scroll window vertikal
      const leftOffset = activePillEl.offsetLeft - mobileStripScrollEl.offsetLeft;
      mobileStripScrollEl.scrollLeft = leftOffset - (mobileStripScrollEl.clientWidth / 2) + (activePillEl.clientWidth / 2);
    } catch {
      // Abaikan
    }
  }
}

function _createMovePlyButton(moveObj, isActive, activeLineId = 'mainline') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-ghost btn-sm analysis-move-btn ${isActive ? 'active' : ''}`;
  btn.setAttribute('data-action', 'select-move-ply');
  btn.setAttribute('data-ply', moveObj.ply);
  btn.setAttribute('data-line-id', activeLineId);
  btn.setAttribute('data-testid', `analysis-move-btn-${moveObj.ply}`);

  const colorName = moveObj.color === 'w' ? 'Putih' : 'Hitam';
  const labelText = `Langkah ${moveObj.moveNumber} ${colorName}: ${moveObj.san}`;
  btn.setAttribute('aria-label', labelText);
  btn.title = labelText;

  const sanSpan = document.createElement('span');
  sanSpan.className = 'analysis-move-san-text';
  sanSpan.textContent = moveObj.san;
  btn.appendChild(sanSpan);

  if (moveObj.classificationBadge) {
    const badgeSpan = document.createElement('span');
    badgeSpan.className = `analysis-move-class-badge badge-${moveObj.classificationBadge.badgeType || 'default'}`;
    badgeSpan.textContent = moveObj.classificationBadge.label || '';
    btn.appendChild(badgeSpan);
  }

  return btn;
}

function _createMobileSanPillButton(moveObj, isActive, activeLineId = 'mainline') {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `btn btn-ghost btn-sm analysis-mobile-strip-pill ${isActive ? 'active' : ''}`;
  btn.setAttribute('data-action', 'select-move-ply');
  btn.setAttribute('data-ply', moveObj.ply);
  btn.setAttribute('data-line-id', activeLineId);
  btn.setAttribute('data-testid', `analysis-mobile-strip-pill-${moveObj.ply}`);

  const numText = moveObj.color === 'w' ? `${moveObj.moveNumber}. ` : `${moveObj.moveNumber}... `;
  btn.textContent = `${numText}${moveObj.san}`;
  btn.title = `Langkah ${moveObj.moveNumber} (${moveObj.color === 'w' ? 'Putih' : 'Hitam'}): ${moveObj.san}`;

  return btn;
}

function _renderVariationManagerDom(container, state, replayState) {
  const varCount = Array.isArray(state.variations) ? state.variations.length : 0;
  const isMainline = !replayState.activeLineId || replayState.activeLineId === 'mainline';

  // Desktop
  const countBadgeDesk = container.querySelector('[data-testid="analysis-variation-count-badge"]');
  if (countBadgeDesk) countBadgeDesk.textContent = `${varCount} variasi`;

  const mainlineBtnDesk = container.querySelector('[data-testid="analysis-line-mainline"]');
  if (mainlineBtnDesk) mainlineBtnDesk.classList.toggle('active', isMainline);

  const listDesk = container.querySelector('[data-testid="analysis-variation-list"]');
  if (listDesk) _populateVariationItemsDom(listDesk, state, replayState);

  // Mobile
  const countBadgeMob = container.querySelector('[data-testid="analysis-mobile-variation-count-badge"]');
  if (countBadgeMob) countBadgeMob.textContent = `${varCount} variasi`;

  const mainlineBtnMob = container.querySelector('[data-testid="analysis-mobile-line-mainline"]');
  if (mainlineBtnMob) mainlineBtnMob.classList.toggle('active', isMainline);

  const listMob = container.querySelector('[data-testid="analysis-mobile-variation-list"]');
  if (listMob) _populateVariationItemsDom(listMob, state, replayState);
}

function _populateVariationItemsDom(containerEl, state, replayState) {
  containerEl.innerHTML = '';
  const variations = Array.isArray(state.variations) ? state.variations : [];

  if (variations.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'analysis-empty-variations';
    emptyEl.textContent = 'Belum ada variasi. Geser bidak di papan untuk membuat cabang variasi baru.';
    containerEl.appendChild(emptyEl);
    return;
  }

  variations.forEach(v => {
    const isLineActive = replayState.activeLineId === v.id;
    const cardEl = document.createElement('div');
    cardEl.className = `analysis-variation-card ${isLineActive ? 'active' : ''}`;
    cardEl.setAttribute('data-variation-id', v.id);

    const titleRow = document.createElement('div');
    titleRow.className = 'analysis-variation-card-header';

    const titleEl = document.createElement('strong');
    titleEl.className = 'analysis-variation-name';
    titleEl.textContent = v.name || `Variasi #${v.id}`;
    titleRow.appendChild(titleEl);

    const selectBtn = document.createElement('button');
    selectBtn.type = 'button';
    selectBtn.className = `btn btn-sm ${isLineActive ? 'btn-primary' : 'btn-secondary'}`;
    selectBtn.setAttribute('data-action', 'select-variation');
    selectBtn.setAttribute('data-variation-id', v.id);
    selectBtn.textContent = isLineActive ? 'Aktif' : 'Pilih';
    titleRow.appendChild(selectBtn);

    cardEl.appendChild(titleRow);
    containerEl.appendChild(cardEl);
  });
}

function _syncReplayStatusDom(container, state, replayState) {
  const game = state.parsedGame;
  if (!game || !replayState) return;

  const meta = game.metadata || {};
  const whiteName = safeDisplayValue(meta.white, 'Putih');
  const blackName = safeDisplayValue(meta.black, 'Hitam');

  const isWhiteBottom = replayState.orientation !== 'black';
  const topPlayerName = isWhiteBottom ? blackName : whiteName;
  const topPlayerRole = isWhiteBottom ? 'Hitam' : 'Putih';
  const topDotClass = isWhiteBottom ? 'dot-black' : 'dot-white';

  const bottomPlayerName = isWhiteBottom ? whiteName : blackName;
  const bottomPlayerRole = isWhiteBottom ? 'Putih' : 'Hitam';
  const bottomDotClass = isWhiteBottom ? 'dot-white' : 'dot-black';

  const topNameEl = container.querySelector('[data-testid="analysis-top-player-name"]');
  const topRoleEl = container.querySelector('[data-testid="analysis-top-player-role"]');
  const topDotEl = container.querySelector('[data-testid="analysis-top-player-dot"]');
  if (topNameEl) topNameEl.textContent = topPlayerName;
  if (topRoleEl) topRoleEl.textContent = `(${topPlayerRole})`;
  if (topDotEl) topDotEl.className = `analysis-player-color-dot ${topDotClass}`;

  const bottomNameEl = container.querySelector('[data-testid="analysis-bottom-player-name"]');
  const bottomRoleEl = container.querySelector('[data-testid="analysis-bottom-player-role"]');
  const bottomDotEl = container.querySelector('[data-testid="analysis-bottom-player-dot"]');
  if (bottomNameEl) bottomNameEl.textContent = bottomPlayerName;
  if (bottomRoleEl) bottomRoleEl.textContent = `(${bottomPlayerRole})`;
  if (bottomDotEl) bottomDotEl.className = `analysis-player-color-dot ${bottomDotClass}`;

  // Desktop Ply Badges
  const plyBadgeEl = container.querySelector('[data-testid="analysis-ply-badge"]');
  if (plyBadgeEl) {
    plyBadgeEl.textContent = `Ply ${replayState.currentPly} / ${replayState.totalPlies}`;
  }

  // Mobile Ply Badge
  const mobPlyBadgeEl = container.querySelector('[data-testid="analysis-mobile-ply-badge"]');
  if (mobPlyBadgeEl) {
    mobPlyBadgeEl.textContent = `Ply ${replayState.currentPly} / ${replayState.totalPlies}`;
  }

  const totalLineMoves = Math.ceil((Number(replayState.totalPlies) || 0) / 2);
  const stepSubtitleDesk = container.querySelector('[data-testid="analysis-step-counter-subtitle"]');
  const stepSubtitleMob = container.querySelector('[data-testid="analysis-mobile-step-counter-subtitle"]');

  const lineSuffix =
    replayState.activeLineId && replayState.activeLineId !== 'mainline'
      ? ` (${safeDisplayValue(replayState.activeLineName, 'Variasi')})`
      : '';

  let stepText = '';
  if (replayState.currentPly === 0) {
    stepText = `Posisi Awal (Langkah 0 dari ${totalLineMoves})${lineSuffix}`;
  } else if (replayState.activeMove) {
    const sideText = replayState.activeMove.color === 'w' ? 'Putih' : 'Hitam';
    stepText = `Langkah ${replayState.activeMove.moveNumber} dari ${totalLineMoves} • ${sideText}: ${replayState.activeMove.san}${lineSuffix}`;
  }

  if (stepSubtitleDesk) stepSubtitleDesk.textContent = stepText;
  if (stepSubtitleMob) stepSubtitleMob.textContent = stepText;

  // Sinkronkan tombol komentar jika ada
  const commentBarEl = container.querySelector('[data-testid="analysis-mobile-comment-bar"]');
  const commentTextEl = container.querySelector('[data-testid="analysis-mobile-comment-text"]');
  if (commentBarEl && commentTextEl) {
    if (replayState.activeMove && replayState.activeMove.comment) {
      commentBarEl.classList.remove('hidden');
      commentTextEl.textContent = replayState.activeMove.comment;
    } else {
      commentBarEl.classList.add('hidden');
      commentTextEl.textContent = '';
    }
  }

  // Sinkronkan disabled state tombol navigasi Replay (Desktop & Mobile)
  const isAtStart = replayState.currentPly <= 0;
  const isAtEnd = replayState.currentPly >= replayState.totalPlies;

  const deskFirstBtn = container.querySelector('[data-action="analysis-first"]');
  const deskPrevBtn = container.querySelector('[data-action="analysis-prev"]');
  const deskNextBtn = container.querySelector('[data-action="analysis-next"]');
  const deskLastBtn = container.querySelector('[data-action="analysis-last"]');
  if (deskFirstBtn) deskFirstBtn.disabled = isAtStart;
  if (deskPrevBtn) deskPrevBtn.disabled = isAtStart;
  if (deskNextBtn) deskNextBtn.disabled = isAtEnd;
  if (deskLastBtn) deskLastBtn.disabled = isAtEnd;

  const mobFirstBtn = container.querySelector('[data-action="mobile-toolbar-first"]');
  const mobPrevBtn = container.querySelector('[data-action="mobile-toolbar-prev"]');
  const mobNextBtn = container.querySelector('[data-action="mobile-toolbar-next"]');
  const mobLastBtn = container.querySelector('[data-action="mobile-toolbar-last"]');
  if (mobFirstBtn) mobFirstBtn.disabled = isAtStart;
  if (mobPrevBtn) mobPrevBtn.disabled = isAtStart;
  if (mobNextBtn) mobNextBtn.disabled = isAtEnd;
  if (mobLastBtn) mobLastBtn.disabled = isAtEnd;

  const stripPrevBtn = container.querySelector('[data-action="mobile-strip-prev"]');
  const stripNextBtn = container.querySelector('[data-action="mobile-strip-next"]');
  if (stripPrevBtn) stripPrevBtn.disabled = isAtStart;
  if (stripNextBtn) stripNextBtn.disabled = isAtEnd;

  // Sinkronkan anotasi Desktop
  const noteBoxEl = container.querySelector('[data-testid="analysis-move-annotation"]');
  const noteTextEl = container.querySelector('[data-testid="analysis-move-annotation-text"]');
  if (noteBoxEl && noteTextEl) {
    if (replayState.activeMove && replayState.activeMove.comment) {
      noteBoxEl.classList.remove('hidden');
      noteTextEl.textContent = replayState.activeMove.comment;
    } else {
      noteBoxEl.classList.add('hidden');
      noteTextEl.textContent = '';
    }
  }
}

function _renderEngineAnalysisPanelDom(container, state, replayState) {
  if (!container || !replayState) return;
  const panelEl = container.querySelector('[data-testid="analysis-engine-panel"]');
  if (!panelEl) return;

  const rawStatus = state.engineStatus || ANALYSIS_ENGINE_STATES.IDLE;
  const statusKey =
    rawStatus === ANALYSIS_ENGINE_STATES.IDLE ? ANALYSIS_ENGINE_STATES.READY : rawStatus;
  const statusLabel =
    ANALYSIS_ENGINE_STATE_LABELS[statusKey] ||
    state.engineStatusLabel ||
    ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.READY];

  panelEl.setAttribute('data-engine-status', statusKey);

  const badgeEl = container.querySelector('[data-testid="analysis-engine-status-badge"]');
  if (badgeEl) {
    badgeEl.textContent = statusLabel;
    badgeEl.setAttribute('data-engine-status', statusKey);
    badgeEl.className = `badge analysis-engine-status-badge status-${statusKey}`;
  }

  const modeCtxEl = container.querySelector('[data-testid="analysis-engine-mode-context"]');
  if (modeCtxEl) {
    const turnText = safeDisplayValue(replayState.turnLabel, 'Putih');
    modeCtxEl.textContent = `Ply ${replayState.currentPly} • Giliran ${turnText}`;
  }

  const isBusy =
    statusKey === ANALYSIS_ENGINE_STATES.LOADING ||
    statusKey === ANALYSIS_ENGINE_STATES.ANALYZING;

  const analyzeBtn = container.querySelector('[data-testid="analysis-analyze-btn"]');
  const stopBtn = container.querySelector('[data-testid="analysis-stop-btn"]');
  const reanalyzeBtn = container.querySelector('[data-testid="analysis-reanalyze-btn"]');

  const setDisabled = (btn, disabled) => {
    if (!btn) return;
    btn.disabled = Boolean(disabled);
    if (disabled) {
      btn.setAttribute('disabled', 'true');
    } else {
      btn.removeAttribute('disabled');
    }
  };

  setDisabled(analyzeBtn, isBusy);
  setDisabled(stopBtn, !isBusy);
  setDisabled(reanalyzeBtn, isBusy);

  const emptyBoxEl = container.querySelector('[data-testid="analysis-engine-empty"]');
  const staleBoxEl = container.querySelector('[data-testid="analysis-engine-stale-notice"]');
  const loadingBoxEl = container.querySelector('[data-testid="analysis-engine-loading"]');
  const errorBoxEl = container.querySelector('[data-testid="analysis-engine-error"]');
  const resultsBoxEl = container.querySelector('[data-testid="analysis-engine-results"]');

  const hideAllBoxes = () => {
    if (emptyBoxEl) emptyBoxEl.classList.add('hidden');
    if (staleBoxEl) staleBoxEl.classList.add('hidden');
    if (loadingBoxEl) loadingBoxEl.classList.add('hidden');
    if (errorBoxEl) errorBoxEl.classList.add('hidden');
    if (resultsBoxEl) resultsBoxEl.classList.add('hidden');
  };

  hideAllBoxes();

  if (isBusy) {
    if (loadingBoxEl) loadingBoxEl.classList.remove('hidden');
  } else if (state.analysisError) {
    if (errorBoxEl) {
      errorBoxEl.classList.remove('hidden');
      const errorTextEl = errorBoxEl.querySelector('[data-testid="analysis-engine-error-text"]');
      if (errorTextEl) errorTextEl.textContent = state.analysisError;
    }
  } else if (state.analysisResult && !state.analysisStale) {
    if (resultsBoxEl) {
      resultsBoxEl.classList.remove('hidden');
      const r = state.analysisResult;

      const evalScoreEl = resultsBoxEl.querySelector('[data-testid="analysis-eval-score"]');
      if (evalScoreEl) {
        evalScoreEl.textContent = r.evaluation ? r.evaluation.scoreText : '0.0';
      }

      const depthBadgeEl = resultsBoxEl.querySelector('[data-testid="analysis-depth-value"]');
      if (depthBadgeEl) {
        depthBadgeEl.textContent = `Kedalaman ${r.depth || 12}`;
      }

      const evalLabelEl = resultsBoxEl.querySelector('[data-testid="analysis-eval-label"]');
      if (evalLabelEl) {
        evalLabelEl.textContent = r.evaluation ? r.evaluation.advantageLabel : 'Posisi seimbang';
      }

      const bestSanEl = resultsBoxEl.querySelector('[data-testid="analysis-best-move-san"]');
      if (bestSanEl) {
        bestSanEl.textContent = r.bestMove ? r.bestMove.san : '-';
      }

      const bestSqEl = resultsBoxEl.querySelector('[data-testid="analysis-best-move-squares"]');
      if (bestSqEl) {
        bestSqEl.textContent = r.bestMove && r.bestMove.from && r.bestMove.to ? `${r.bestMove.from} → ${r.bestMove.to}` : '';
      }

      const pvCountEl = resultsBoxEl.querySelector('[data-testid="analysis-pv-count"]');
      if (pvCountEl) {
        pvCountEl.textContent = r.principalVariation ? `${r.principalVariation.length} langkah` : '';
      }

      const pvLineEl = resultsBoxEl.querySelector('[data-testid="analysis-pv-line"]');
      if (pvLineEl) {
        pvLineEl.textContent = r.principalVariation ? r.principalVariation.join(' ') : '-';
      }
    }
  } else if (state.analysisStale) {
    if (staleBoxEl) {
      staleBoxEl.classList.remove('hidden');
      const staleTextEl = staleBoxEl.querySelector('[data-testid="analysis-engine-stale-text"]');
      if (staleTextEl) staleTextEl.textContent = state.analysisStaleMessage || 'Posisi berubah.';
    }
  } else {
    if (emptyBoxEl) emptyBoxEl.classList.remove('hidden');
  }
}

/**
 * Merender atau memperbarui GameReviewPanelComponent (Desktop & Mobile Screen 'graph').
 */
function _renderGameReviewPanelDom(container, state, replayState) {
  if (!container || !state || !state.parsedGame) return;

  const mountDesk = container.querySelector('#game-review-panel-mount');
  const mountMob = container.querySelector('#game-review-panel-mount-mobile');

  const mountEl = isMobileAnalysisViewport() && state.mobileScreen === 'graph' ? mountMob : mountDesk;
  if (!mountEl) return;

  if (!activeGameReviewPanelInstance || activeGameReviewPanelInstance.container !== mountEl) {
    if (activeGameReviewPanelInstance) {
      try {
        activeGameReviewPanelInstance.destroy();
      } catch {
        // Abaikan
      }
    }

    activeGameReviewPanelInstance = new GameReviewPanelComponent({
      container: mountEl,
      onSelectPly: ply => {
        if (activeReplayBoardInstance) {
          activeReplayBoardInstance.goToPly(ply, { silent: true });
        }
      },
      onStartGameAnalysis: () => {
        runGameReviewAnalysis(container, state);
      },
      onStopGameAnalysis: () => {
        stopGameReviewAnalysis(container, state);
      },
      onSaveAnalysis: () => {
        saveGameReviewToCloud(container, state);
      }
    });
  }

  activeGameReviewPanelInstance.updateState({
    status: state.gameReviewStatus || GAME_REVIEW_STATUS.IDLE,
    progress: state.gameReviewProgress || { current: 0, total: 0, percent: 0, currentPly: 0 },
    report: state.gameReviewReport || null,
    graphData: state.gameReviewGraphData || null,
    activePly: replayState.currentPly || 0,
    saveStatus: state.gameReviewSaveStatus || 'idle',
    saveErrorMsg: state.gameReviewSaveError || null,
    savedHistoryId: state.savedHistoryId || null
  });
}

/**
 * Menjalankan analisis manual posisi papan aktif (Desktop & Mobile).
 */
export async function runAnalysisForActivePosition(container, state, callbacks = {}) {
  if (!container || !state || !activeReplayBoardInstance) return null;

  const board = activeReplayBoardInstance;
  const engine =
    (callbacks && callbacks.analysisEngine) ||
    state.analysisEngine ||
    activeAnalysisEngineInstance ||
    chessAnalysisEngine;

  activeAnalysisEngineInstance = engine;

  if (
    state.engineStatus === ANALYSIS_ENGINE_STATES.LOADING ||
    state.engineStatus === ANALYSIS_ENGINE_STATES.ANALYZING ||
    (engine && typeof engine.isAnalyzing === 'function' && engine.isAnalyzing())
  ) {
    return null;
  }

  const targetFen = board.getCurrentFen();
  state.lastKnownBoardFen = targetFen;
  state.analysisResult = null;
  state.analysisError = null;
  state.analysisStale = false;
  state.analysisStaleMessage = '';

  board.clearRecommendedMove({ render: true });

  const initialStatus =
    engine && engine.isReady ? ANALYSIS_ENGINE_STATES.ANALYZING : ANALYSIS_ENGINE_STATES.LOADING;
  state.engineStatus = initialStatus;
  state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[initialStatus];
  _renderEngineAnalysisPanelDom(container, state, board.getReplayState());

  const engineOptions = {
    ...(state.engineOptions || {}),
    ...(callbacks && callbacks.engineOptions ? callbacks.engineOptions : {})
  };

  const result = await engine.analyzePosition(targetFen, engineOptions);

  if (!activeReplayBoardInstance || activeReplayBoardInstance !== board) {
    return result;
  }

  const currentFenNow = board.getCurrentFen();

  if (currentFenNow !== targetFen || (result && result.stale)) {
    state.analysisResult = null;
    state.analysisStale = true;
    if (!state.analysisStaleMessage) {
      state.analysisStaleMessage =
        'Posisi papan berubah saat analisis berlangsung. Hasil posisi lama diabaikan.';
    }
    if (state.engineStatus !== ANALYSIS_ENGINE_STATES.ERROR) {
      state.engineStatus = ANALYSIS_ENGINE_STATES.STOPPED;
      state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.STOPPED];
    }
    board.clearRecommendedMove({ render: true });
    _renderEngineAnalysisPanelDom(container, state, board.getReplayState());
    return result;
  }

  if (result && result.stopped) {
    state.engineStatus = ANALYSIS_ENGINE_STATES.STOPPED;
    state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.STOPPED];
    state.analysisResult = null;
    board.clearRecommendedMove({ render: true });
    _renderEngineAnalysisPanelDom(container, state, board.getReplayState());
    return result;
  }

  if (!result || !result.ok || !result.completed) {
    state.engineStatus = ANALYSIS_ENGINE_STATES.ERROR;
    state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.ERROR];
    state.analysisError =
      result && result.errorMessage
        ? result.errorMessage
        : 'Gagal menganalisis posisi dengan Stockfish. Silakan coba lagi.';
    state.analysisResult = null;
    board.clearRecommendedMove({ render: true });
    _renderEngineAnalysisPanelDom(container, state, board.getReplayState());
    return result;
  }

  // Hasil valid
  state.engineStatus = ANALYSIS_ENGINE_STATES.READY;
  state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.READY];
  state.analysisError = null;
  state.analysisStale = false;
  state.analysisStaleMessage = '';
  state.analysisResult = result;
  state.lastAnalyzedFen = targetFen;

  if (result.bestMove && result.bestMove.from && result.bestMove.to) {
    board.setRecommendedMove(
      {
        ...result.bestMove,
        fen: targetFen
      },
      { render: true }
    );
  } else {
    board.clearRecommendedMove({ render: true });
  }

  _renderEngineAnalysisPanelDom(container, state, board.getReplayState());
  return result;
}

/**
 * Menghentikan analisis Stockfish aktif dengan aman.
 */
export function stopAnalysisForActivePosition(container, state, callbacks = {}) {
  const engine =
    (callbacks && callbacks.analysisEngine) ||
    (state && state.analysisEngine) ||
    activeAnalysisEngineInstance ||
    chessAnalysisEngine;

  if (engine && typeof engine.stopAnalysis === 'function') {
    engine.stopAnalysis('stopped_by_user');
  }

  if (state) {
    state.engineStatus = ANALYSIS_ENGINE_STATES.STOPPED;
    state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.STOPPED];
    state.analysisResult = null;
  }

  if (activeReplayBoardInstance) {
    activeReplayBoardInstance.clearRecommendedMove({ render: true });
    if (container && state) {
      _renderEngineAnalysisPanelDom(
        container,
        state,
        activeReplayBoardInstance.getReplayState()
      );
    }
  }
}

/**
 * Mobile-specific Top Button Handler (dengan timer 10 detik).
 */
async function _handleMobileTopAnalyzeClick(container, state, callbacks) {
  if (state.mobileAnalysisState === 'stop_available') {
    _cancelMobileAnalysis(container, state, callbacks);
    return;
  }

  if (state.mobileAnalysisState === 'analyzing') {
    return;
  }

  state.mobileAnalysisState = 'analyzing';
  mobileAnalysisStartTime = Date.now();
  _updateMobileTopButtonDom(container, state);

  // Set 10-second timer to change button to "Hentikan Analisis" without auto-canceling
  if (mobileAnalysisTimerId) {
    clearTimeout(mobileAnalysisTimerId);
  }
  mobileAnalysisTimerId = setTimeout(() => {
    if (state.mobileAnalysisState === 'analyzing') {
      state.mobileAnalysisState = 'stop_available';
      _updateMobileTopButtonDom(container, state);
    }
  }, 10000);

  try {
    await runAnalysisForActivePosition(container, state, callbacks);
  } finally {
    if (mobileAnalysisTimerId) {
      clearTimeout(mobileAnalysisTimerId);
      mobileAnalysisTimerId = null;
    }
    state.mobileAnalysisState = 'idle';
    _updateMobileTopButtonDom(container, state);
  }
}

function _cancelMobileAnalysis(container, state, callbacks) {
  if (mobileAnalysisTimerId) {
    clearTimeout(mobileAnalysisTimerId);
    mobileAnalysisTimerId = null;
  }
  stopAnalysisForActivePosition(container, state, callbacks);
  state.mobileAnalysisState = 'idle';
  _updateMobileTopButtonDom(container, state);
}

function _updateMobileTopButtonDom(container, state) {
  const btn = container.querySelector('[data-testid="analysis-mobile-top-analyze-btn"]');
  const labelEl = container.querySelector('[data-testid="analysis-mobile-top-analyze-label"]');
  if (!btn || !labelEl) return;

  btn.setAttribute('data-state', state.mobileAnalysisState || 'idle');

  if (state.mobileAnalysisState === 'analyzing') {
    btn.className = 'btn btn-primary analysis-mobile-top-analyze-btn';
    btn.innerHTML = `<span class="analysis-engine-spinner" aria-hidden="true"></span><span data-testid="analysis-mobile-top-analyze-label">Menganalisis...</span>`;
  } else if (state.mobileAnalysisState === 'stop_available') {
    btn.className = 'btn btn-primary analysis-mobile-top-analyze-btn btn-danger';
    btn.innerHTML = `<span class="analysis-engine-spinner" aria-hidden="true"></span><span data-testid="analysis-mobile-top-analyze-label">Hentikan Analisis</span>`;
  } else {
    btn.className = 'btn btn-primary analysis-mobile-top-analyze-btn';
    btn.innerHTML = `${UI_ICONS.zap}<span data-testid="analysis-mobile-top-analyze-label">Analisis Posisi</span>`;
  }
}

/**
 * Memulai analisis seluruh partai (Game Review).
 */
export async function runGameReviewAnalysis(container, state) {
  if (!state || !state.parsedGame || !state.parsedGame.valid) return;
  if (!chessGameReview) return;

  state.gameReviewStatus = GAME_REVIEW_STATUS.ANALYZING;
  state.gameReviewSaveStatus = 'idle';
  state.gameReviewSaveError = null;

  _renderGameReviewPanelDom(
    container,
    state,
    activeReplayBoardInstance ? activeReplayBoardInstance.getReplayState() : { currentPly: state.currentPly }
  );

  try {
    const result = await chessGameReview.analyzeFullGame(state.parsedGame, {
      onProgress: progress => {
        state.gameReviewProgress = progress;
        if (activeGameReviewPanelInstance) {
          activeGameReviewPanelInstance.updateState({
            status: GAME_REVIEW_STATUS.ANALYZING,
            progress: progress
          });
        }
      }
    });

    if (result && (result.report || result.snapshots)) {
      const reportData = result.report || result;
      const graphData = result.graphData || buildEvaluationGraphData(result.snapshots || []);

      state.gameReviewReport = reportData;
      state.gameReviewGraphData = graphData;
      state.gameReviewStatus = GAME_REVIEW_STATUS.COMPLETED;

      if (activeReplayBoardInstance) {
        activeReplayBoardInstance.setGameReviewReport(reportData, { render: true });
      }

      _renderGameReviewPanelDom(
        container,
        state,
        activeReplayBoardInstance ? activeReplayBoardInstance.getReplayState() : { currentPly: state.currentPly }
      );
    } else {
      state.gameReviewStatus = GAME_REVIEW_STATUS.ERROR;
      _renderGameReviewPanelDom(
        container,
        state,
        activeReplayBoardInstance ? activeReplayBoardInstance.getReplayState() : { currentPly: state.currentPly }
      );
    }
  } catch (err) {
    state.gameReviewStatus = GAME_REVIEW_STATUS.ERROR;
    _renderGameReviewPanelDom(
      container,
      state,
      activeReplayBoardInstance ? activeReplayBoardInstance.getReplayState() : { currentPly: state.currentPly }
    );
  }
}

export async function saveGameReviewToCloud(container, state) {
  if (!state || !state.gameReviewReport) return;
  const user = authService.getUser ? authService.getUser() : null;
  if (!user) {
    state.gameReviewSaveStatus = 'error';
    state.gameReviewSaveError = 'Harap login terlebih dahulu untuk menyimpan analisis ke cloud.';
    _renderGameReviewPanelDom(
      container,
      state,
      activeReplayBoardInstance ? activeReplayBoardInstance.getReplayState() : { currentPly: state.currentPly }
    );
    return;
  }

  state.gameReviewSaveStatus = 'saving';
  _renderGameReviewPanelDom(
    container,
    state,
    activeReplayBoardInstance ? activeReplayBoardInstance.getReplayState() : { currentPly: state.currentPly }
  );

  try {
    const res = await analysisHistoryService.saveGameReview(state.parsedGame, state.gameReviewReport);
    if (res && res.success) {
      state.gameReviewSaveStatus = 'saved';
      state.savedHistoryId = res.id;
    } else {
      state.gameReviewSaveStatus = 'error';
      state.gameReviewSaveError = res && res.error ? res.error : 'Gagal menyimpan ke cloud.';
    }
  } catch (err) {
    state.gameReviewSaveStatus = 'error';
    state.gameReviewSaveError = err.message || 'Gagal menyimpan ke cloud.';
  }

  _renderGameReviewPanelDom(
    container,
    state,
    activeReplayBoardInstance ? activeReplayBoardInstance.getReplayState() : { currentPly: state.currentPly }
  );
}

export function stopGameReviewAnalysis(container, state) {
  if (chessGameReview && typeof chessGameReview.stopGameReview === 'function') {
    chessGameReview.stopGameReview('stopped_by_user');
  }
  state.gameReviewStatus = GAME_REVIEW_STATUS.STOPPED;
  _renderGameReviewPanelDom(
    container,
    state,
    activeReplayBoardInstance ? activeReplayBoardInstance.getReplayState() : { currentPly: state.currentPly }
  );
}

function _applyPgnValidationResult(container, state, validationResult, rawText, callbacks) {
  state.isValidating = false;
  state.validationCount = (state.validationCount || 0) + 1;
  state.rawPgnText = rawText || '';

  if (!validationResult || !validationResult.valid) {
    state.validationError = validationResult || {
      errorCode: 'INVALID_PGN',
      errorTitle: 'PGN tidak valid',
      errorMessage: 'Format PGN tidak memenuhi standar legalitas langkah catur.'
    };
    state.parsedGame = null;
    state.mobileScreen = 'import';
    renderAnalysisView(container, state, callbacks);
    return;
  }

  state.validationError = null;
  state.parsedGame = validationResult;
  state.currentPly = 0;
  state.orientation = 'white';
  state.analysisMode = 'explore';
  state.activeLineId = 'mainline';
  state.variations = [];
  state.variationCounter = 1;
  state.renamingVariationId = null;
  state.analysisResult = null;
  state.analysisStale = false;
  state.analysisError = null;
  state.lastKnownBoardFen = validationResult.initialFen;
  state.lastAnalyzedFen = null;
  state.mobileScreen = 'board';
  state.mobileAnalysisState = 'idle';

  renderAnalysisView(container, state, callbacks);
}

function _executeValidateAndStartReview(container, state, rawText, callbacks) {
  if (!rawText || !rawText.trim()) {
    state.validationError = {
      errorCode: 'EMPTY_INPUT',
      errorTitle: 'Input PGN Kosong',
      errorMessage: 'Silakan pilih file .pgn atau tempel teks notasi PGN terlebih dahulu.'
    };
    state.mobileScreen = 'import';
    renderAnalysisView(container, state, callbacks);
    return;
  }

  state.isValidating = true;
  state.validationError = null;
  const result = validateAndParsePgn(rawText);
  _applyPgnValidationResult(container, state, result, rawText, callbacks);
}

async function _readFileTextSafely(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(reader.error || new Error('Gagal membaca file'));
    reader.readAsText(file, 'utf-8');
  });
}

async function _handleFileSelectionAndImport(file, container, state, callbacks) {
  if (!file) return;

  const metaValidation = validatePgnFileMeta(file);
  if (!metaValidation.valid) {
    state.selectedFileMeta = null;
    state.validationError = metaValidation;
    state.mobileScreen = 'import';
    renderAnalysisView(container, state, callbacks);
    return;
  }

  try {
    const textContent = await _readFileTextSafely(file);
    state.selectedFileMeta = {
      name: file.name,
      size: file.size,
      formattedSize: formatFileSize(file.size),
      type: file.type || 'text/plain',
      rawContent: textContent
    };
    _executeValidateAndStartReview(container, state, textContent, callbacks);
  } catch (err) {
    state.selectedFileMeta = null;
    state.validationError = {
      errorCode: 'FILE_READ_ERROR',
      errorTitle: 'Gagal Membaca File',
      errorMessage: err.message || 'File tidak dapat dibaca dari perangkat.'
    };
    state.mobileScreen = 'import';
    renderAnalysisView(container, state, callbacks);
  }
}

function _syncClipboardFeedbackDom(container, state) {
  const el = container.querySelector('[data-testid="pgn-clipboard-feedback"]');
  if (!el) return;
  if (!state.clipboardFeedback) {
    el.className = 'analysis-clipboard-feedback hidden';
    el.textContent = '';
    return;
  }
  el.className = `analysis-clipboard-feedback is-${state.clipboardFeedback.status || 'info'}`;
  el.textContent = state.clipboardFeedback.message || '';
}

function _bindAnalysisViewEvents(container, state, callbacks) {
  // 1. File Upload
  const triggerFileBtn = container.querySelector('[data-action="trigger-file-picker"]');
  const changeFileBtn = container.querySelector('[data-action="change-selected-file"]');
  const removeFileBtn = container.querySelector('[data-action="remove-selected-file"]');
  const importFileBtn = container.querySelector('[data-action="import-selected-file"]');
  const fileInput = container.querySelector('#pgn-file-input');

  if (triggerFileBtn && fileInput) {
    triggerFileBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });
  }

  if (changeFileBtn && fileInput) {
    changeFileBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileInput.click();
    });
  }

  if (fileInput) {
    fileInput.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        await _handleFileSelectionAndImport(file, container, state, callbacks);
      }
    });
  }

  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', () => {
      state.selectedFileMeta = null;
      if (fileInput) fileInput.value = '';
      renderAnalysisView(container, state, callbacks);
    });
  }

  if (importFileBtn) {
    importFileBtn.addEventListener('click', () => {
      if (state.selectedFileMeta && state.selectedFileMeta.rawContent) {
        _executeValidateAndStartReview(container, state, state.selectedFileMeta.rawContent, callbacks);
      }
    });
  }

  // 2. Paste Textarea Actions
  const textareaEl = container.querySelector('[data-testid="pgn-paste-textarea"]');
  const submitPasteBtn = container.querySelector('[data-action="submit-paste-pgn"]');
  const mobileValidateCtaBtn = container.querySelector('[data-action="mobile-validate-and-review"]');
  const clearPasteBtn = container.querySelector('[data-action="clear-paste-pgn"]');
  const loadSampleBtn = container.querySelector('[data-action="load-sample-pgn"]');

  if (textareaEl) {
    textareaEl.addEventListener('input', () => {
      state.rawPgnText = textareaEl.value;
      state.clipboardFeedback = null;
      _syncClipboardFeedbackDom(container, state);
    });
  }

  const pasteClipboardBtn = container.querySelector('[data-action="paste-from-clipboard"]');
  if (pasteClipboardBtn && textareaEl) {
    pasteClipboardBtn.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
          state.clipboardFeedback = { status: 'error', message: 'Fitur clipboard tidak didukung di browser ini.' };
          _syncClipboardFeedbackDom(container, state);
          return;
        }
        const text = await navigator.clipboard.readText();
        if (!text || !text.trim()) {
          state.clipboardFeedback = { status: 'warning', message: 'Papan klip kosong.' };
          _syncClipboardFeedbackDom(container, state);
          return;
        }
        textareaEl.value = text;
        state.rawPgnText = text;
        state.clipboardFeedback = { status: 'success', message: 'Teks PGN berhasil ditempel dari clipboard.' };
        _syncClipboardFeedbackDom(container, state);
      } catch (err) {
        state.clipboardFeedback = { status: 'error', message: 'Gagal membaca clipboard. Izin ditolak.' };
        _syncClipboardFeedbackDom(container, state);
      }
    });
  }

  if (submitPasteBtn && textareaEl) {
    submitPasteBtn.addEventListener('click', () => {
      _executeValidateAndStartReview(container, state, textareaEl.value, callbacks);
    });
  }

  if (mobileValidateCtaBtn && textareaEl) {
    mobileValidateCtaBtn.addEventListener('click', () => {
      const textToValidate = (state.selectedFileMeta && state.selectedFileMeta.rawContent) || textareaEl.value;
      _executeValidateAndStartReview(container, state, textToValidate, callbacks);
    });
  }

  if (clearPasteBtn && textareaEl) {
    clearPasteBtn.addEventListener('click', () => {
      textareaEl.value = '';
      state.rawPgnText = '';
      state.clipboardFeedback = null;
      _syncClipboardFeedbackDom(container, state);
    });
  }

  if (loadSampleBtn && textareaEl) {
    loadSampleBtn.addEventListener('click', () => {
      textareaEl.value = SAMPLE_PGN_PLACEHOLDER;
      state.rawPgnText = SAMPLE_PGN_PLACEHOLDER;
      state.clipboardFeedback = { status: 'info', message: 'Contoh PGN dimuat.' };
      _syncClipboardFeedbackDom(container, state);
    });
  }

  // 3. Dismiss Notification
  const dismissErrBtn = container.querySelector('[data-action="analysis-dismiss-error"]');
  if (dismissErrBtn) {
    dismissErrBtn.addEventListener('click', () => {
      state.validationError = null;
      state.isImportNoticeDismissed = true;
      const banner = container.querySelector('[data-testid="pgn-error-alert"]');
      if (banner) banner.classList.add('hidden');
    });
  }

  // 4. Mobile Navigation Pages ('import' <-> 'board' <-> 'graph' <-> 'moves')
  const mobileBackFromStudioBtn = container.querySelector('[data-action="mobile-back-from-studio"]');
  if (mobileBackFromStudioBtn && typeof callbacks.onBackFromStudio === 'function') {
    mobileBackFromStudioBtn.addEventListener('click', () => {
      callbacks.onBackFromStudio();
    });
  }

  const mobileBackToImportBtn = container.querySelector('[data-action="mobile-back-to-import"]');
  if (mobileBackToImportBtn) {
    mobileBackToImportBtn.addEventListener('click', () => {
      state.mobileScreen = 'import';
      renderAnalysisView(container, state, callbacks);
    });
  }

  const mobileToGraphBtn = container.querySelector('[data-action="mobile-nav-graph"]');
  if (mobileToGraphBtn) {
    mobileToGraphBtn.addEventListener('click', () => {
      state.mobileScreen = 'graph';
      renderAnalysisView(container, state, callbacks);
    });
  }

  const mobileToMovesBtn = container.querySelector('[data-action="mobile-nav-moves"]');
  if (mobileToMovesBtn) {
    mobileToMovesBtn.addEventListener('click', () => {
      state.mobileScreen = 'moves';
      renderAnalysisView(container, state, callbacks);
    });
  }

  const mobileNavBoardBtns = container.querySelectorAll('[data-action="mobile-nav-board"]');
  mobileNavBoardBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.mobileScreen = 'board';
      renderAnalysisView(container, state, callbacks);
    });
  });

  // 5. Mobile Top Analyze Button (10s timer)
  const mobileTopAnalyzeBtn = container.querySelector('[data-action="mobile-top-analyze"]');
  if (mobileTopAnalyzeBtn) {
    mobileTopAnalyzeBtn.addEventListener('click', () => {
      _handleMobileTopAnalyzeClick(container, state, callbacks);
    });
  }

  // Copy FEN Mobile
  const copyFenMobileBtn = container.querySelector('[data-action="copy-current-fen-mobile"]');
  if (copyFenMobileBtn) {
    copyFenMobileBtn.addEventListener('click', async () => {
      if (activeReplayBoardInstance && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(activeReplayBoardInstance.getCurrentFen());
        } catch {
          // Abaikan
        }
      }
    });
  }

  // 6. Desktop Header Actions
  const toggleReimportBtn = container.querySelector('[data-action="analysis-toggle-reimport"]');
  if (toggleReimportBtn) {
    toggleReimportBtn.addEventListener('click', () => {
      state.showInputPanelInPreview = !state.showInputPanelInPreview;
      renderAnalysisView(container, state, callbacks);
    });
  }

  const backInitialBtn = container.querySelector('[data-action="analysis-back-initial"]');
  if (backInitialBtn) {
    backInitialBtn.addEventListener('click', () => {
      resetAnalysisExplorationState(state);
      state.parsedGame = null;
      state.mobileScreen = 'import';
      renderAnalysisView(container, state, callbacks);
    });
  }

  const deleteGameBtn = container.querySelector('[data-action="analysis-delete-game"]');
  if (deleteGameBtn) {
    deleteGameBtn.addEventListener('click', () => {
      resetAnalysisExplorationState(state);
      state.parsedGame = null;
      state.rawPgnText = '';
      state.selectedFileMeta = null;
      state.mobileScreen = 'import';
      renderAnalysisView(container, state, callbacks);
    });
  }

  // 7. Replay & Variation Actions
  const switchMainlineBtns = container.querySelectorAll('[data-action="switch-to-mainline"]');
  switchMainlineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (activeReplayBoardInstance) {
        activeReplayBoardInstance.switchToMainline();
      }
    });
  });

  // Delegated click for variation selection
  const varLists = container.querySelectorAll('[data-testid$="variation-list"]');
  varLists.forEach(listEl => {
    listEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="select-variation"]');
      if (btn) {
        const varId = btn.getAttribute('data-variation-id');
        if (activeReplayBoardInstance && varId) {
          activeReplayBoardInstance.selectVariation(varId);
        }
      }
    });
  });

  // Delegated click for Move List selection
  const moveLists = container.querySelectorAll('[data-testid$="move-list"]');
  moveLists.forEach(listEl => {
    listEl.addEventListener('click', e => {
      const btn = e.target.closest('[data-action="select-move-ply"]');
      if (btn) {
        const ply = Number(btn.getAttribute('data-ply'));
        if (activeReplayBoardInstance && !isNaN(ply)) {
          activeReplayBoardInstance.goToPly(ply);
          if (state.mobileScreen === 'moves') {
            state.mobileScreen = 'board';
            renderAnalysisView(container, state, callbacks);
          }
        }
      }
    });
  });

  // Mobile Strip SAN clicks
  const mobileStripScrollEl = container.querySelector('[data-testid="analysis-mobile-strip-scroll"]');
  if (mobileStripScrollEl) {
    mobileStripScrollEl.addEventListener('click', e => {
      const pillBtn = e.target.closest('[data-action="select-move-ply"]');
      if (pillBtn) {
        const ply = Number(pillBtn.getAttribute('data-ply'));
        if (activeReplayBoardInstance && !isNaN(ply)) {
          activeReplayBoardInstance.goToPly(ply);
        }
      }
    });
  }

  const stripPrevBtn = container.querySelector('[data-action="mobile-strip-prev"]');
  if (stripPrevBtn) {
    stripPrevBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.stepBackward();
    });
  }

  const stripNextBtn = container.querySelector('[data-action="mobile-strip-next"]');
  if (stripNextBtn) {
    stripNextBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.stepForward();
    });
  }

  // Mobile Bottom Toolbar 5 icon-only buttons
  const mobileFirstBtn = container.querySelector('[data-action="mobile-toolbar-first"]');
  if (mobileFirstBtn) {
    mobileFirstBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.goToStart();
    });
  }

  const mobilePrevBtn = container.querySelector('[data-action="mobile-toolbar-prev"]');
  if (mobilePrevBtn) {
    mobilePrevBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.stepBackward();
    });
  }

  const mobileNextBtn = container.querySelector('[data-action="mobile-toolbar-next"]');
  if (mobileNextBtn) {
    mobileNextBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.stepForward();
    });
  }

  const mobileLastBtn = container.querySelector('[data-action="mobile-toolbar-last"]');
  if (mobileLastBtn) {
    mobileLastBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.goToEnd();
    });
  }

  const mobileFlipBtn = container.querySelector('[data-action="mobile-toolbar-flip"]');
  if (mobileFlipBtn) {
    mobileFlipBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.flipBoard();
    });
  }

  // Stockfish Controls (Desktop)
  const startEngineBtn = container.querySelector('[data-action="analysis-start-engine"]');
  if (startEngineBtn) {
    startEngineBtn.addEventListener('click', () => {
      runAnalysisForActivePosition(container, state, callbacks);
    });
  }

  const stopEngineBtn = container.querySelector('[data-action="analysis-stop-engine"]');
  if (stopEngineBtn) {
    stopEngineBtn.addEventListener('click', () => {
      stopAnalysisForActivePosition(container, state, callbacks);
    });
  }

  const reanalyzeEngineBtn = container.querySelector('[data-action="analysis-reanalyze-engine"]');
  if (reanalyzeEngineBtn) {
    reanalyzeEngineBtn.addEventListener('click', () => {
      runAnalysisForActivePosition(container, state, callbacks);
    });
  }
}

export default renderAnalysisView;
