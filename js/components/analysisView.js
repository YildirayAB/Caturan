/**
 * Komponen Halaman Chess Analysis Studio (MVP 5.1 — PGN Import, Validation & Mobile Game Review)
 *
 * Fitur Utama:
 * 1. Dua metode input PGN yang menggunakan service validasi yang sama (pgnService.js):
 *    - Upload File .pgn (maks 2 MB, tampilkan nama & ukuran file, ganti/hapus file)
 *    - Paste PGN secara langsung via textarea (contoh placeholder, tombol Impor & Clear)
 * 2. Workflow Khusus Mobile (<= 600px) Dua Layar Terpisah:
 *    - Mobile Screen 1 (PGN Import): Topbar ringkas, Upload PGN, Paste PGN, dan satu CTA utama
 *      "Validasi & Mulai Review". Jika valid otomatis pindah ke Mobile Screen 2 tanpa tombol kedua.
 *      Jika invalid tetap di halaman import, tampilkan pesan error, dan pertahankan isi input.
 *    - Mobile Screen 2 (Game Review): Review Topbar (tombol kembali ke Import dengan state terjaga),
 *      Compact Game Information Panel, Interactive Chessboard 1:1, Horizontal Move Navigation Strip,
 *      dan Thumb-Friendly Bottom Toolbar (Awal, Sebelumnya, Berikutnya, Akhir, Balik Papan).
 * 3. Tampilan Desktop & Tablet (> 600px) dipertahankan persis seperti desain MVP 5.1.
 * 4. Keamanan input ketat (XSS-safe): seluruh metadata, nama file, komentar, dan notasi PGN
 *    dirender menggunakan DOM API / textContent (tidak pernah menyisipkan input mentah ke innerHTML).
 * 5. Zero Supabase Load: Semua state hanya berada di memori sesi aplikasi.
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

export function destroyActiveAnalysisBoard({ terminateEngine = true } = {}) {
  if (typeof activeEngineStatusUnsubscribe === 'function') {
    try {
      activeEngineStatusUnsubscribe();
    } catch {
      // Abaikan jika sudah di-unsubscribe
    }
  }
  activeEngineStatusUnsubscribe = null;

  if (terminateEngine) {
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

/**
 * Membuat state awal sesi Analysis Studio (in-memory saja, tidak disimpan ke LocalStorage / Supabase)
 */
export function createInitialAnalysisSessionState() {
  return {
    rawPgnText: '',
    lastValidatedRawPgn: null,
    selectedFileMeta: null, // { name, size, formattedSize, type, rawContent }
    validationError: null,  // { errorCode, errorTitle, errorMessage, details }
    parsedGame: null,       // Hasil sukses dari validateAndParsePgn
    currentPly: 0,
    orientation: 'white',
    analysisMode: 'review', // 'review' | 'explore'
    activeLineId: 'mainline', // 'mainline' | 'var-1' | ...
    variations: [],         // Daftar variasi sesi in-memory
    variationCounter: 1,
    renamingVariationId: null,
    mobileScreen: 'import', // 'import' | 'review'
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
    clipboardFeedback: null
    // clipboardFeedback initialized above
  };
}

/**
 * Membersihkan seluruh data eksplorasi & variasi pada memori sesi ketika partai baru dimuat atau ditutup.
 */
export function resetAnalysisExplorationState(state, { preserveCleanupNotice = false } = {}) {
  if (!state || typeof state !== 'object') return;
  state.currentPly = 0;
  state.orientation = 'white';
  state.analysisMode = 'review';
  state.activeLineId = 'mainline';
  state.variations = [];
  state.variationCounter = 1;
  state.renamingVariationId = null;
  state.copyStatusMessage = '';
  state.copyFenStatusMessage = '';
  state.lastCopiedFen = '';
  state.engineStatus = ANALYSIS_ENGINE_STATES.IDLE;
  state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.READY];
  state.analysisResult = null;
  state.analysisStale = false;
  state.analysisStaleMessage = '';
  state.analysisError = null;
  state.lastKnownBoardFen = null;
  state.lastAnalyzedFen = null;
  if (!preserveCleanupNotice) {
    state.sessionCleanupNotice = '';
  }
}

/**
 * Merender halaman Chess Analysis Studio ke dalam container utama
 * @param {HTMLElement} container
 * @param {Object} sessionState - State sesi in-memory milik CaturanApp
 * @param {Object} callbacks - { onBackFromStudio, onMobileScreenChange }
 */
export function renderAnalysisView(container, sessionState, callbacks = {}) {
  if (!container) return;
  destroyActiveAnalysisBoard();

  const state = sessionState || createInitialAnalysisSessionState();
  const hasValidGame = Boolean(state.parsedGame && state.parsedGame.valid);
  const isMobile = isMobileAnalysisViewport();
  const isMobileOrTabletPortrait =
    typeof window !== 'undefined' && typeof window.innerWidth === 'number'
      ? window.innerWidth <= 768
      : isMobile;

  // Pastikan state.mobileScreen konsisten: jika belum ada game valid, wajib di screen 'import'
  if (!hasValidGame) {
    state.mobileScreen = 'import';
  } else if (state.mobileScreen !== 'import' && state.mobileScreen !== 'review') {
    state.mobileScreen = 'review';
  }

  const activeMobileScreen = hasValidGame && state.mobileScreen === 'review' ? 'review' : 'import';

  // Pada Desktop (> 600px): ikuti mekanisme MVP 5.1 yang sudah disetujui
  // Pada Mobile (<= 600px): pisahkan secara tegas antara Screen 1 (Import) dan Screen 2 (Review)
  const showInputWorkspace = isMobile
    ? activeMobileScreen === 'import'
    : !hasValidGame || Boolean(state.showInputPanelInPreview);

  const showPreviewWorkspace = isMobile
    ? hasValidGame && activeMobileScreen === 'review'
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

  container.innerHTML = `
    <div
      class="analysis-studio-page mobile-screen-${activeMobileScreen}"
      data-testid="analysis-studio-page"
      data-mobile-screen="${activeMobileScreen}"
    >
      <!-- MOBILE & TABLET PORTRAIT TOPBAR (Susunan 3 Baris: 1. Kembali + MVP 5.1, 2. Judul Full Width, 3. Deskripsi Full Width) -->
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
          <span class="badge badge-accent badge-orange" data-testid="analysis-mobile-mvp-badge">MVP 5.1</span>
        </div>
        <h1 class="analysis-mobile-title" data-testid="analysis-mobile-import-title">Chess Analysis Studio</h1>
        <p class="analysis-mobile-subtitle" data-testid="analysis-mobile-import-desc">
          Import dan review permainan catur Anda
        </p>
      </header>

      <!-- MOBILE SCREEN 2 TOPBAR (Hanya tampil di <= 600px saat berada di Screen Game Review) -->
      <header
        class="analysis-mobile-only analysis-mobile-review-topbar ${activeMobileScreen === 'review' && hasValidGame ? '' : 'hidden'}"
        data-testid="analysis-mobile-review-topbar"
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
        <h1 class="analysis-mobile-review-title" data-testid="analysis-mobile-review-title">Review Partai</h1>
        <button
          type="button"
          class="btn btn-secondary btn-sm analysis-touch-btn analysis-mobile-option-btn"
          data-action="copy-normalized-pgn"
          data-testid="analysis-mobile-copy-btn"
          aria-label="Salin PGN"
        >
          ${UI_ICONS.copy}
          <span data-testid="analysis-mobile-copy-label">Salin</span>
        </button>
      </header>

      <!-- DESKTOP & TABLET HEADER (> 600px, dipertahankan persis seperti MVP 5.1) -->
      <header class="section-header analysis-studio-header analysis-desktop-header">
        <div class="analysis-studio-title-group">
          <div class="analysis-studio-kicker">
            <span class="badge badge-orange">MVP 5.1 • Studio Analisis</span>
            <span class="badge" data-testid="analysis-zero-cloud-badge">100% Lokal di Browser</span>
          </div>
          <h1 class="page-title" data-testid="analysis-studio-title">Chess Analysis Studio</h1>
          <p class="page-subtitle" data-testid="analysis-studio-description">
            Import, review, dan pelajari permainan catur Anda.
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

      <!-- NOTIFICATION & ERROR BANNER (Ikon di kiri, pesan utuh di tengah, tombol tutup di kanan) -->
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

      <!-- SCREEN 1 (MOBILE) / INPUT SECTION (DESKTOP) -->
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
                spellcheck="false"
                spellcheck="false"
                autocomplete="off"
                autocorrect="off"
                autocapitalize="off"
                data-testid="pgn-paste-textarea"
              ></textarea>
              <!-- Tombol aksi paste PGN -->

              <div
                class="analysis-clipboard-feedback ${state.clipboardFeedback ? `is-${state.clipboardFeedback.status || 'info'}` : 'hidden'}"
                data-testid="pgn-clipboard-feedback"
                data-status="${state.clipboardFeedback ? state.clipboardFeedback.status || 'info' : ''}"
                role="status"
                aria-live="polite"
              ></div>

                  <!-- Paste dari Clipboard -->
              <!-- Tombol aksi paste PGN -->

              <div class="analysis-paste-actions">
                <button
                  type="button"
                  class="btn btn-secondary analysis-touch-btn analysis-clipboard-paste-btn"
                  data-action="paste-from-clipboard"
                  data-testid="pgn-paste-clipboard-btn"
                  ${state.isValidating ? 'disabled' : ''}
                >
                  ${UI_ICONS.copy}
                  <span>Tempel dari Clipboard</span>
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

        <!-- CTA UTAMA KHUSUS MOBILE SCREEN 1: "Validasi & Mulai Review" -->
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
              ${state.isValidating ? 'Memvalidasi PGN...' : 'Validasi & Mulai Review'}
            </span>
          </button>
        </div>
      </section>

      <!-- SCREEN 2 (MOBILE GAME REVIEW) / PREVIEW SECTION (DESKTOP) -->
      <section
        class="analysis-preview-section ${showPreviewWorkspace ? '' : 'hidden'}"
        aria-label="Preview Partai dan Papan Replay Interaktif"
        data-testid="pgn-preview-section"
      >
        <!-- MOBILE GAME INFORMATION PANEL (Ringkas & Padat, Hanya tampil pada <= 600px) -->
        <div
          class="analysis-mobile-only card analysis-mobile-game-info"
          data-testid="analysis-mobile-game-info"
        >
          <div class="analysis-mobile-game-info-top">
            <span class="badge badge-green analysis-mobile-valid-pill" data-testid="analysis-mobile-valid-badge">
              ${UI_ICONS.checkCircle}
              <span>PGN Valid</span>
            </span>
            <span class="analysis-mobile-result-pill" data-testid="analysis-mobile-result"></span>
          </div>
          <div class="analysis-mobile-players-matchup">
            <div class="analysis-mobile-player-line">
              <span class="analysis-player-color-dot dot-white"></span>
              <span class="analysis-mobile-side-label">Putih:</span>
              <strong class="analysis-mobile-player-val" data-testid="analysis-mobile-white"></strong>
            </div>
            <div class="analysis-mobile-player-line">
              <span class="analysis-player-color-dot dot-black"></span>
              <span class="analysis-mobile-side-label">Hitam:</span>
              <strong class="analysis-mobile-player-val" data-testid="analysis-mobile-black"></strong>
            </div>
          </div>
          <div class="analysis-mobile-event-line" data-testid="analysis-mobile-event-date"></div>
        </div>

        <!-- DESKTOP METADATA CARD (Tampil di > 600px, dipertahankan persis seperti MVP 5.1) -->
        <div class="card analysis-metadata-card analysis-desktop-metadata-card" data-testid="pgn-metadata-card">
          <div class="analysis-metadata-header">
            <div class="analysis-metadata-title-wrap">
              <span class="badge badge-green" data-testid="pgn-preview-valid-badge">PGN Valid</span>
              <h2 class="card-title">Informasi & Metadata Partai</h2>
            </div>
            <div class="analysis-metadata-actions">
              <button
                type="button"
                class="btn btn-secondary btn-sm analysis-touch-btn"
                data-action="copy-normalized-pgn"
                data-testid="analysis-copy-pgn-btn"
              >
                ${UI_ICONS.copy}
                <span data-testid="analysis-copy-pgn-label">Salin PGN</span>
              </button>
            </div>
          </div>

          <div class="analysis-metadata-grid" data-testid="pgn-metadata-grid">
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Pemain Putih (White)</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-white"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Pemain Hitam (Black)</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-black"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Event</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-event"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Lokasi (Site)</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-site"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Tanggal (Date)</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-date"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Hasil (Result)</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-result"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Total Langkah</span>
              <strong class="analysis-meta-value" data-testid="pgn-meta-total-moves"></strong>
            </div>
            <div class="analysis-meta-item">
              <span class="analysis-meta-label">Status Akhir Papan</span>
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

        <!-- Area Utama Interactive Game Preview -->
        <div class="analysis-workspace-grid" data-testid="analysis-interactive-preview">
          <div class="analysis-board-column">
            <!-- MVP 5.2: Mode Switcher & Exploration Bar (Review Mode vs Jelajahi Posisi) -->
            <div
              class="analysis-mode-bar"
              role="region"
              aria-label="Mode Analisis dan Eksplorasi Posisi"
              data-testid="analysis-mode-bar"
            >
              <div
                class="analysis-mode-toggle-group"
                role="group"
                aria-label="Pilih Mode Papan Analisis"
                data-testid="analysis-mode-selector-group"
              >
                <button
                  type="button"
                  class="btn btn-sm analysis-mode-btn ${state.analysisMode !== 'explore' ? 'active' : ''}"
                  data-action="set-mode-review"
                  data-testid="analysis-mode-review-btn"
                  aria-pressed="${state.analysisMode !== 'explore' ? 'true' : 'false'}"
                >
                  Review Mode
                </button>
                <button
                  type="button"
                  class="btn btn-sm analysis-mode-btn ${state.analysisMode === 'explore' ? 'active' : ''}"
                  data-action="set-mode-explore"
                  data-testid="analysis-mode-explore-btn"
                  aria-pressed="${state.analysisMode === 'explore' ? 'true' : 'false'}"
                >
                  Jelajahi Posisi
                </button>
              </div>

              <div class="analysis-mode-quick-actions" data-testid="analysis-explore-quick-actions">
                <div class="analysis-mode-status-row" data-testid="analysis-mode-status-row">
                  <span class="analysis-mode-status-pill" data-testid="analysis-mode-status"></span>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm analysis-explore-action-btn analysis-undo-btn"
                    data-action="undo-exploration-move"
                    data-testid="analysis-undo-move-btn"
                    title="Batalkan langkah eksplorasi terakhir"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                      <path d="M9 14 4 9l5-5" />
                      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5v0a5.5 5.5 0 0 1-5.5 5.5H11" />
                    </svg>
                    <span>Undo Langkah</span>
                  </button>
                </div>

                <div
                  class="analysis-variation-nav-group hidden"
                  role="group"
                  aria-label="Navigasi Variasi Aktif"
                  data-testid="analysis-variation-nav-group"
                >
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm analysis-explore-action-btn analysis-var-nav-btn"
                    data-action="return-parent-position"
                    data-testid="analysis-return-parent-btn"
                    title="Kembali ke posisi asal variasi"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                      <circle cx="6" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M20 4 8.12 15.88" />
                      <circle cx="20" cy="16" r="3" />
                      <path d="M14.47 14.48 20 20" />
                    </svg>
                    <span>Posisi Asal</span>
                  </button>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm analysis-explore-action-btn analysis-var-nav-btn"
                    data-action="switch-to-mainline"
                    data-testid="analysis-switch-mainline-btn"
                    title="Kembali ke partai asli (Mainline)"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
                      <polyline points="15 18 9 12 15 6" />
                      <line x1="9" y1="12" x2="21" y2="12" />
                      <line x1="3" y1="6" x2="3" y2="18" />
                    </svg>
                    <span data-testid="analysis-switch-mainline-label">Partai Asli</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- MOBILE VARIATION SELECTOR (Tampil di Mobile saat variasi tersedia untuk memilih Partai Asli / Variasi) -->
            <div
              class="analysis-mobile-only analysis-mobile-variation-bar hidden"
              role="region"
              aria-label="Pemilih Variasi Mobile"
              data-testid="analysis-mobile-variation-bar"
            >
              <label for="analysis-mobile-variation-select" class="analysis-mobile-variation-label">
                Jalur:
              </label>
              <select
                id="analysis-mobile-variation-select"
                class="analysis-mobile-variation-select"
                data-action="mobile-select-variation"
                data-testid="analysis-mobile-variation-select"
                aria-label="Pilih Partai Asli atau Variasi"
              >
                <option value="mainline">Partai Asli</option>
              </select>
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

            <!-- MOBILE D: MOVE NAVIGATION STRIP (Horizontal Scrollable SAN Strip di bawah papan) -->
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

            <!-- MOBILE COMMENT BAR (Hanya tampil jika PGN asli memiliki komentar pada posisi saat ini) -->
            <div
              class="analysis-mobile-only analysis-mobile-comment-bar hidden"
              data-testid="analysis-mobile-comment-bar"
            >
              <span class="analysis-mobile-comment-label">Komentar PGN:</span>
              <span class="analysis-mobile-comment-text" data-testid="analysis-mobile-comment-text"></span>
            </div>

            <!-- MOBILE E: THUMB-FRIENDLY BOTTOM TOOLBAR (Awal, Sebelumnya, Berikutnya, Akhir, Balik Papan) -->
            <nav
              class="analysis-mobile-only analysis-mobile-bottom-toolbar"
              aria-label="Toolbar Navigasi Review Partai Mobile"
              data-testid="analysis-mobile-bottom-toolbar"
            >
              <button
                type="button"
                class="btn btn-secondary btn-sm analysis-mobile-toolbar-btn"
                data-action="mobile-toolbar-first"
                data-testid="analysis-mobile-btn-first"
                aria-label="Posisi Awal"
              >
                ${UI_ICONS.skipBack}
                <span>Awal</span>
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm analysis-mobile-toolbar-btn"
                data-action="mobile-toolbar-prev"
                data-testid="analysis-mobile-btn-prev"
                aria-label="Langkah Sebelumnya"
              >
                ${UI_ICONS.chevronLeft}
                <span>Sebelumnya</span>
              </button>
              <button
                type="button"
                class="btn btn-primary btn-sm analysis-mobile-toolbar-btn analysis-mobile-toolbar-primary"
                data-action="mobile-toolbar-next"
                data-testid="analysis-mobile-btn-next"
                aria-label="Langkah Berikutnya"
              >
                <span>Berikutnya</span>
                ${UI_ICONS.chevronRight}
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm analysis-mobile-toolbar-btn"
                data-action="mobile-toolbar-last"
                data-testid="analysis-mobile-btn-last"
                aria-label="Posisi Akhir"
              >
                <span>Akhir</span>
                ${UI_ICONS.skipForward}
              </button>
              <button
                type="button"
                class="btn btn-secondary btn-sm analysis-mobile-toolbar-btn"
                data-action="mobile-toolbar-flip"
                data-testid="analysis-mobile-btn-flip"
                aria-label="Balik Papan"
              >
                ${UI_ICONS.flip}
                <span>Balik Papan</span>
              </button>
            </nav>
          </div>

          <!-- DESKTOP & MOBILE AUXILIARY PANEL: STOCKFISH ANALYSIS, MOVES, VARIATION MANAGER & POSITION INFORMATION -->
          <aside class="card analysis-moves-panel analysis-desktop-moves-panel" aria-label="Analisis Stockfish, Riwayat Langkah SAN, Variasi, dan Informasi Posisi">
            <!-- MVP 5.4: STOCKFISH 19 ANALYSIS ENGINE PANEL (Desktop & Mobile) -->
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
                  <span data-testid="analysis-analyze-btn-label">Analyze Position</span>
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-touch-btn analysis-engine-btn"
                  data-action="analysis-stop-engine"
                  data-testid="analysis-stop-btn"
                  disabled
                >
                  <span>Stop Analysis</span>
                </button>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm analysis-touch-btn analysis-engine-btn"
                  data-action="analysis-reanalyze-engine"
                  data-testid="analysis-reanalyze-btn"
                >
                  ${UI_ICONS.restart}
                  <span>Analyze Again</span>
                </button>
              </div>

              <!-- Empty / Initial State -->
              <div
                class="analysis-engine-state-box analysis-engine-empty"
                data-testid="analysis-engine-empty"
              >
                <p class="analysis-engine-empty-text" data-testid="analysis-engine-empty-text">
                  Tekan "Analyze Position" untuk menganalisis posisi aktif pada papan menggunakan Stockfish 19 Lite.
                </p>
              </div>

              <!-- Stale / Position Changed Notice -->
              <div
                class="analysis-engine-state-box analysis-engine-stale hidden"
                data-testid="analysis-engine-stale-notice"
              >
                <p class="analysis-engine-stale-text" data-testid="analysis-engine-stale-text"></p>
              </div>

              <!-- Loading / Analyzing State -->
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

              <!-- Finalized Analysis Results -->
              <div
                class="analysis-engine-results hidden"
                data-testid="analysis-engine-results"
              >
                <div class="analysis-engine-top-metrics">
                  <div class="analysis-eval-card" data-testid="analysis-eval-card">
                    <span class="analysis-meta-label">Position Evaluation (Perspektif Putih)</span>
                    <div class="analysis-eval-main-row">
                      <strong class="analysis-eval-score" data-testid="analysis-eval-score"></strong>
                      <span class="badge analysis-depth-badge" data-testid="analysis-depth-value"></span>
                    </div>
                    <span class="analysis-eval-advantage" data-testid="analysis-eval-label"></span>
                  </div>

                  <div class="analysis-best-move-card" data-testid="analysis-best-move-card">
                    <span class="analysis-meta-label">Best Move (Langkah Terbaik)</span>
                    <strong class="analysis-best-move-san" data-testid="analysis-best-move-san"></strong>
                    <span class="analysis-best-move-squares" data-testid="analysis-best-move-squares"></span>
                  </div>
                </div>

                <div class="analysis-pv-card" data-testid="analysis-pv-card">
                  <div class="analysis-pv-header">
                    <span class="analysis-meta-label">Principal Variation (PV)</span>
                    <span class="analysis-pv-sub" data-testid="analysis-pv-count"></span>
                  </div>
                  <div class="analysis-pv-line" data-testid="analysis-pv-line"></div>
                </div>
              </div>
            </div>

            <div class="analysis-moves-panel-header">
              <div>
                <h3 class="card-title">Daftar Langkah (SAN)</h3>
                <p class="card-subtitle" data-testid="analysis-step-counter-subtitle"></p>
              </div>
              <span class="badge" data-testid="analysis-ply-badge"></span>
            </div>

            <div
              class="analysis-move-list-scroll"
              role="region"
              aria-label="Navigasi urutan langkah catur"
              tabindex="0"
              data-testid="analysis-move-list"
            ></div>

            <!-- MVP 5.2: VARIATION MANAGER (Berada dekat dengan notasi) -->
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

            <div class="analysis-annotation-box" data-testid="analysis-move-annotation">
              <span class="analysis-meta-label">Catatan / Komentar Langkah</span>
              <p class="analysis-annotation-text" data-testid="analysis-move-annotation-text"></p>
            </div>

            <!-- MVP 5.2: POSITION INFORMATION PANEL -->
            <div
              class="analysis-position-info-panel"
              role="region"
              aria-label="Informasi Posisi Aktif"
              data-testid="analysis-position-info-panel"
            >
              <div class="analysis-position-info-header">
                <span class="analysis-meta-label">Informasi Posisi Saat Ini</span>
                <div class="analysis-position-info-header-actions">
                  <span class="analysis-position-line-tag" data-testid="analysis-pos-active-line"></span>
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm analysis-copy-fen-btn"
                    data-action="copy-current-fen"
                    data-testid="analysis-copy-fen-btn"
                  >
                    ${UI_ICONS.copy}
                    <span data-testid="analysis-copy-fen-label">Salin FEN</span>
                  </button>
                </div>
              </div>

              <div class="analysis-position-info-grid">
                <div class="analysis-pos-item">
                  <span class="analysis-meta-label">Nomor Langkah</span>
                  <strong class="analysis-pos-value" data-testid="analysis-pos-move-number"></strong>
                </div>
                <div class="analysis-pos-item">
                  <span class="analysis-meta-label">Ply Aktif</span>
                  <strong class="analysis-pos-value" data-testid="analysis-pos-active-ply"></strong>
                </div>
                <div class="analysis-pos-item">
                  <span class="analysis-meta-label">Giliran Berikutnya</span>
                  <strong class="analysis-pos-value" data-testid="analysis-pos-next-turn"></strong>
                </div>
                <div class="analysis-pos-item analysis-pos-item-status">
                  <span class="analysis-meta-label">Status Posisi</span>
                  <strong class="analysis-pos-value" data-testid="analysis-pos-check-status"></strong>
                </div>
                <div class="analysis-pos-item analysis-pos-item-wide">
                  <span class="analysis-meta-label">SAN Langkah Terakhir</span>
                  <strong class="analysis-pos-value" data-testid="analysis-pos-last-san"></strong>
                </div>
              </div>

              <details class="analysis-fen-details" data-testid="analysis-fen-details">
                <summary class="analysis-fen-summary">Lihat FEN Posisi Saat Ini</summary>
                <div class="analysis-current-fen-bar">
                  <code class="analysis-fen-code" data-testid="analysis-current-fen"></code>
                </div>
              </details>
            </div>

            <details class="analysis-normalized-pgn-details">
              <summary class="analysis-normalized-pgn-summary">Lihat PGN Ternormalisasi</summary>
              <pre class="analysis-normalized-pgn-pre" data-testid="analysis-normalized-pgn"></pre>
            </details>
          </aside>
        </div>
      </section>
    </div>
  `;

  // Isi placeholder dan nilai textarea secara aman (mempertahankan input pengguna)
  const textareaEl = container.querySelector('[data-testid="pgn-paste-textarea"]');
  if (textareaEl) {
    textareaEl.placeholder = PGN_TEXTAREA_PLACEHOLDER;
    textareaEl.removeAttribute('readonly');
    textareaEl.removeAttribute('disabled');
    _syncClipboardFeedbackDom(container, state);
    textareaEl.value = state.rawPgnText || '';
  }

  // Isi pesan notifikasi / error secara utuh (menggunakan textContent agar 100% aman dari XSS)
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
        'Unggah satu file .pgn atau tempelkan urutan notasi langkah SAN yang legal untuk mulai me-review permainan.';
    }
  }

  // Isi metadata file yang dipilih bila ada (menggunakan textContent)
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

  // Jika ada partai valid, isi metadata & mount papan replay
  if (hasValidGame) {
    _populateGamePreviewDom(container, state, callbacks);
  }

  _bindAnalysisViewEvents(container, state, callbacks);
}

/**
 * Mengisi informasi metadata (Desktop & Mobile), papan interaktif, dan daftar langkah menggunakan textContent
 * agar sepenuhnya terlindung dari injeksi HTML/JS dari header atau komentar PGN.
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

  // Metadata Ringkas Mobile (Screen 2: Game Information Panel)
  setText('analysis-mobile-white', meta.white);
  setText('analysis-mobile-black', meta.black);
  setText(
    'analysis-mobile-result',
    meta.result && meta.result !== 'Tidak diketahui'
      ? `Hasil: ${meta.result}`
      : `Hasil: ${game.result || '*'}`
  );

  const mobileEventDateEl = container.querySelector('[data-testid="analysis-mobile-event-date"]');
  if (mobileEventDateEl) {
    const eventText = safeDisplayValue(meta.event, 'Tidak diketahui');
    const dateText = safeDisplayValue(meta.date, 'Tidak diketahui');
    const parts = [];
    if (eventText !== 'Tidak diketahui') parts.push(eventText);
    if (dateText !== 'Tidak diketahui') parts.push(dateText);
    parts.push(`${Number(game.totalMoves) || 0} langkah`);
    mobileEventDateEl.textContent = parts.join(' • ');
  }

  const normPgnEl = container.querySelector('[data-testid="analysis-normalized-pgn"]');
  if (normPgnEl) {
    normPgnEl.textContent = safeDisplayValue(game.normalizedPgn, '');
  }

  const copyLabelEl = container.querySelector('[data-testid="analysis-copy-pgn-label"]');
  if (copyLabelEl) {
    copyLabelEl.textContent = state.copyStatusMessage || 'Salin PGN';
  }
  const mobileCopyLabelEl = container.querySelector('[data-testid="analysis-mobile-copy-label"]');
  if (mobileCopyLabelEl) {
    mobileCopyLabelEl.textContent = state.copyStatusMessage ? 'Tersalin' : 'Salin';
  }

  // 1) Mount AnalysisReplayBoard (mendukung Review Mode, Explore Mode, dan Variation Manager)
  const boardMount = container.querySelector('#analysis-replay-board-mount');
  if (boardMount) {
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
      mode: state.analysisMode || 'review',
      variations: Array.isArray(state.variations) ? state.variations : [],
      activeLineId: state.activeLineId || 'mainline',
      variationCounter: Number(state.variationCounter) || 1,
      recommendedMove: initialRecommendedMove,
      onPlyChange: replayState => {
        const prevFen = state.lastKnownBoardFen;
        const nextFen = replayState.currentFen;
        const fenChanged = Boolean(prevFen && nextFen && prevFen !== nextFen);

        state.currentPly = replayState.currentPly;
        state.orientation = replayState.orientation;
        state.analysisMode = replayState.mode || 'review';
        state.activeLineId = replayState.activeLineId || 'mainline';
        state.lastKnownBoardFen = nextFen;

        if (activeReplayBoardInstance) {
          state.variations = activeReplayBoardInstance.getVariations();
          state.variationCounter = activeReplayBoardInstance.variationCounter;
        }
        if (state.lastCopiedFen && state.lastCopiedFen !== replayState.currentFen) {
          state.copyFenStatusMessage = '';
        }

        // MVP 5.4: Ketika posisi berubah (Review / Explore), batalkan analisis berjalan & tandai hasil lama tidak berlaku
        if (fenChanged) {
          const currentEngine = getActiveAnalysisEngine();
          const wasAnalyzing = Boolean(
            (currentEngine && typeof currentEngine.isAnalyzing === 'function' && currentEngine.isAnalyzing()) ||
              state.engineStatus === ANALYSIS_ENGINE_STATES.ANALYZING ||
              state.engineStatus === ANALYSIS_ENGINE_STATES.LOADING
          );

          if (currentEngine && typeof currentEngine.notifyPositionChanged === 'function') {
            currentEngine.notifyPositionChanged(nextFen);
          }

          if (wasAnalyzing) {
            state.engineStatus = ANALYSIS_ENGINE_STATES.STOPPED;
            state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.STOPPED];
            state.analysisResult = null;
            state.analysisError = null;
            state.analysisStale = true;
            state.analysisStaleMessage =
              'Posisi papan berubah saat analisis berlangsung. Analisis posisi lama dihentikan — tekan "Analyze Position" untuk menganalisis posisi baru.';
          } else if (state.analysisResult && state.analysisResult.fen !== nextFen) {
            state.analysisResult = null;
            state.analysisError = null;
            state.analysisStale = true;
            state.analysisStaleMessage =
              'Posisi papan telah berpindah. Hasil analisis posisi sebelumnya tidak lagi berlaku — tekan "Analyze Position" untuk mengevaluasi posisi ini.';
            if (state.engineStatus !== ANALYSIS_ENGINE_STATES.ERROR) {
              state.engineStatus = ANALYSIS_ENGINE_STATES.READY;
              state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.READY];
            }
          }

          if (activeReplayBoardInstance) {
            activeReplayBoardInstance.clearRecommendedMove({ render: true });
          }
        }

        _syncReplayStatusDom(container, state, replayState);
      }
    });

    const initialReplayState = activeReplayBoardInstance.getReplayState();
    state.currentPly = initialReplayState.currentPly;
    state.orientation = initialReplayState.orientation;
    state.analysisMode = initialReplayState.mode;
    state.activeLineId = initialReplayState.activeLineId;
    state.lastKnownBoardFen = initialReplayState.currentFen;
    if (state.analysisResult && state.analysisResult.fen !== initialReplayState.currentFen) {
      state.analysisResult = null;
      state.analysisStale = true;
      state.analysisStaleMessage =
        'Posisi papan telah berpindah. Hasil analisis posisi sebelumnya tidak lagi berlaku.';
    }
    state.variations = activeReplayBoardInstance.getVariations();
    state.variationCounter = activeReplayBoardInstance.variationCounter;
    _syncReplayStatusDom(container, state, initialReplayState);
  }
}

function _renderMoveListDom(moveListEl, pairs, currentPly, activeLineId) {
  if (!moveListEl) return;
  moveListEl.innerHTML = '';

  const startRowBtn = document.createElement('button');
  startRowBtn.type = 'button';
  startRowBtn.className = `analysis-start-ply-btn ${currentPly === 0 ? 'active' : ''}`;
  startRowBtn.setAttribute('data-ply', '0');
  startRowBtn.setAttribute('data-line-id', String(activeLineId || 'mainline'));
  startRowBtn.setAttribute('data-testid', 'analysis-move-ply-0');
  if (currentPly === 0) {
    startRowBtn.setAttribute('aria-current', 'step');
  }
  startRowBtn.textContent = '0. Posisi Awal Partai';
  moveListEl.appendChild(startRowBtn);

  if (!Array.isArray(pairs) || pairs.length === 0) {
    const emptyNote = document.createElement('p');
    emptyNote.className = 'analysis-empty-moves-note';
    emptyNote.textContent = 'Partai ini tidak memiliki langkah (hanya posisi FEN awal).';
    moveListEl.appendChild(emptyNote);
    return;
  }

  pairs.forEach(pair => {
    const rowEl = document.createElement('div');
    rowEl.className = 'analysis-move-row';
    rowEl.setAttribute('data-move-number', String(pair.moveNumber));

    const numSpan = document.createElement('span');
    numSpan.className = 'analysis-move-num';
    numSpan.textContent = `${pair.moveNumber}.`;
    rowEl.appendChild(numSpan);

    if (pair.white) {
      const wBtn = _createMovePlyButton(pair.white, currentPly === pair.white.ply, activeLineId);
      rowEl.appendChild(wBtn);
    } else {
      const wPlaceholder = document.createElement('span');
      wPlaceholder.className = 'analysis-move-placeholder';
      wPlaceholder.textContent = '...';
      rowEl.appendChild(wPlaceholder);
    }

    if (pair.black) {
      const bBtn = _createMovePlyButton(pair.black, currentPly === pair.black.ply, activeLineId);
      rowEl.appendChild(bBtn);
    } else {
      const bPlaceholder = document.createElement('span');
      bPlaceholder.className = 'analysis-move-placeholder';
      bPlaceholder.textContent = '';
      rowEl.appendChild(bPlaceholder);
    }

    moveListEl.appendChild(rowEl);
  });
}

function _renderMobileMoveStripDom(mobileStripScrollEl, pairs, currentPly, activeLineId) {
  if (!mobileStripScrollEl) return;
  mobileStripScrollEl.innerHTML = '';

  const startPill = document.createElement('button');
  startPill.type = 'button';
  startPill.className = `analysis-mobile-san-pill ${currentPly === 0 ? 'active' : ''}`;
  startPill.setAttribute('data-mobile-ply', '0');
  startPill.setAttribute('data-line-id', String(activeLineId || 'mainline'));
  startPill.setAttribute('data-testid', 'analysis-mobile-ply-0');
  if (currentPly === 0) {
    startPill.setAttribute('aria-current', 'step');
  }
  startPill.textContent = 'Awal';
  mobileStripScrollEl.appendChild(startPill);

  if (!Array.isArray(pairs)) return;

  pairs.forEach(pair => {
    const pairGroup = document.createElement('div');
    pairGroup.className = 'analysis-mobile-san-pair';

    const numTag = document.createElement('span');
    numTag.className = 'analysis-mobile-san-num';
    numTag.textContent = `${pair.moveNumber}.`;
    pairGroup.appendChild(numTag);

    if (pair.white) {
      pairGroup.appendChild(
        _createMobileSanPillButton(pair.white, currentPly === pair.white.ply, activeLineId)
      );
    }
    if (pair.black) {
      pairGroup.appendChild(
        _createMobileSanPillButton(pair.black, currentPly === pair.black.ply, activeLineId)
      );
    }

    mobileStripScrollEl.appendChild(pairGroup);
  });
}

function _createMovePlyButton(moveObj, isActive, activeLineId = 'mainline') {
  const btn = document.createElement('button');
  btn.type = 'button';
  const isVariationMove = Boolean(moveObj.variationId && moveObj.variationId !== 'mainline');
  btn.className = `analysis-ply-btn ${isActive ? 'active' : ''} ${isVariationMove ? 'is-variation-move' : ''}`.trim();
  btn.setAttribute('data-ply', String(moveObj.ply));
  btn.setAttribute('data-san', String(moveObj.san));
  btn.setAttribute('data-line-id', String(activeLineId || 'mainline'));
  btn.setAttribute('data-testid', `analysis-move-ply-${moveObj.ply}`);
  if (isActive) {
    btn.setAttribute('aria-current', 'step');
  }

  const sanSpan = document.createElement('span');
  sanSpan.className = 'analysis-ply-san';
  const nagSymbols = Array.isArray(moveObj.nags)
    ? moveObj.nags.map(n => n.symbol).filter(Boolean).join('')
    : '';
  sanSpan.textContent = `${moveObj.san}${nagSymbols}`;
  btn.appendChild(sanSpan);

  if (Array.isArray(moveObj.comments) && moveObj.comments.length > 0) {
    const commentDot = document.createElement('span');
    commentDot.className = 'analysis-ply-comment-indicator';
    commentDot.title = 'Langkah ini memiliki komentar';
    commentDot.textContent = '💬';
    btn.appendChild(commentDot);
  }

  return btn;
}

function _createMobileSanPillButton(moveObj, isActive, activeLineId = 'mainline') {
  const btn = document.createElement('button');
  btn.type = 'button';
  const isVariationMove = Boolean(moveObj.variationId && moveObj.variationId !== 'mainline');
  btn.className = `analysis-mobile-san-pill ${isActive ? 'active' : ''} ${isVariationMove ? 'is-variation-move' : ''}`.trim();
  btn.setAttribute('data-mobile-ply', String(moveObj.ply));
  btn.setAttribute('data-san', String(moveObj.san));
  btn.setAttribute('data-line-id', String(activeLineId || 'mainline'));
  btn.setAttribute('data-testid', `analysis-mobile-ply-${moveObj.ply}`);
  if (isActive) {
    btn.setAttribute('aria-current', 'step');
  }

  const nagSymbols = Array.isArray(moveObj.nags)
    ? moveObj.nags.map(n => n.symbol).filter(Boolean).join('')
    : '';
  btn.textContent = `${moveObj.san}${nagSymbols}`;
  return btn;
}

function _renderVariationManagerDom(container, state, replayState) {
  const varListEl = container.querySelector('[data-testid="analysis-variation-list"]');
  const countBadgeEl = container.querySelector('[data-testid="analysis-variation-count-badge"]');
  const mainlineBtn = container.querySelector('[data-testid="analysis-line-mainline"]');
  const unsavedNoticeEl = container.querySelector('[data-testid="analysis-unsaved-variations-notice"]');
  const cleanupNoticeEl = container.querySelector('[data-testid="analysis-session-cleanup-notice"]');
  const mobileSelectEl = container.querySelector('[data-testid="analysis-mobile-variation-select"]');

  const variations = Array.isArray(replayState.variations) ? replayState.variations : [];
  const activeLineId = replayState.activeLineId || 'mainline';

  if (countBadgeEl) {
    countBadgeEl.textContent = `${variations.length} variasi`;
  }

  if (mainlineBtn) {
    if (activeLineId === 'mainline') {
      mainlineBtn.classList.add('active');
      mainlineBtn.setAttribute('aria-current', 'true');
    } else {
      mainlineBtn.classList.remove('active');
      mainlineBtn.removeAttribute('aria-current');
    }
  }

  if (unsavedNoticeEl) {
    if (variations.length > 0) {
      unsavedNoticeEl.classList.remove('hidden');
      unsavedNoticeEl.textContent =
        'Variasi disimpan di memori sesi lokal (tidak mengubah PGN asli dan akan dibersihkan saat partai ditutup atau diganti).';
    } else {
      unsavedNoticeEl.classList.add('hidden');
      unsavedNoticeEl.textContent = '';
    }
  }

  if (cleanupNoticeEl) {
    if (state.sessionCleanupNotice) {
      cleanupNoticeEl.classList.remove('hidden');
      cleanupNoticeEl.textContent = safeDisplayValue(state.sessionCleanupNotice, '');
    } else {
      cleanupNoticeEl.classList.add('hidden');
      cleanupNoticeEl.textContent = '';
    }
  }

  const mobileVarBarEl = container.querySelector('[data-testid="analysis-mobile-variation-bar"]');
  if (mobileVarBarEl) {
    if (variations.length > 0) {
      mobileVarBarEl.classList.remove('hidden');
    } else {
      mobileVarBarEl.classList.add('hidden');
    }
  }

  if (mobileSelectEl) {
    mobileSelectEl.innerHTML = '';
    const mainOpt = document.createElement('option');
    mainOpt.value = 'mainline';
    mainOpt.textContent = 'Partai Asli';
    if (activeLineId === 'mainline') mainOpt.selected = true;
    mobileSelectEl.appendChild(mainOpt);

    variations.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.id;
      const firstSan = Array.isArray(v.sanMoves) && v.sanMoves.length > 0 ? v.sanMoves[0] : '';
      opt.textContent = `${v.name} (Ply ${v.startPly}${firstSan ? `: ${firstSan}` : ''})`;
      if (activeLineId === v.id) opt.selected = true;
      mobileSelectEl.appendChild(opt);
    });
    mobileSelectEl.value = activeLineId;
  }

  if (!varListEl) return;
  varListEl.innerHTML = '';

  if (variations.length === 0) {
    const emptyEl = document.createElement('p');
    emptyEl.className = 'analysis-variation-empty';
    emptyEl.setAttribute('data-testid', 'analysis-variation-empty');
    emptyEl.textContent =
      'Belum ada variasi. Aktifkan mode "Jelajahi Posisi" lalu mainkan langkah alternatif di papan untuk membuat cabang baru.';
    varListEl.appendChild(emptyEl);
    return;
  }

  variations.forEach(v => {
    const itemEl = document.createElement('div');
    const isActiveVar = activeLineId === v.id;
    itemEl.className = `analysis-variation-item ${isActiveVar ? 'active' : ''}`;
    itemEl.setAttribute('data-variation-id', v.id);
    itemEl.setAttribute('data-testid', `analysis-variation-item-${v.id}`);

    const topRow = document.createElement('div');
    topRow.className = 'analysis-variation-item-top';

    if (state.renamingVariationId === v.id) {
      const renameForm = document.createElement('div');
      renameForm.className = 'analysis-variation-rename-row';
      renameForm.setAttribute('data-testid', `analysis-variation-rename-form-${v.id}`);

      const renameInput = document.createElement('input');
      renameInput.type = 'text';
      renameInput.className = 'analysis-variation-rename-input';
      renameInput.value = v.name;
      renameInput.setAttribute('data-variation-id', v.id);
      renameInput.setAttribute('data-testid', `analysis-variation-rename-input-${v.id}`);
      renameInput.setAttribute('aria-label', `Nama baru untuk ${v.name}`);
      renameForm.appendChild(renameInput);

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.className = 'btn btn-primary btn-sm analysis-var-action-btn';
      saveBtn.setAttribute('data-action', 'save-rename-variation');
      saveBtn.setAttribute('data-variation-id', v.id);
      saveBtn.setAttribute('data-testid', `analysis-variation-rename-save-${v.id}`);
      saveBtn.textContent = 'Simpan';
      renameForm.appendChild(saveBtn);

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary btn-sm analysis-var-action-btn';
      cancelBtn.setAttribute('data-action', 'cancel-rename-variation');
      cancelBtn.setAttribute('data-variation-id', v.id);
      cancelBtn.setAttribute('data-testid', `analysis-variation-rename-cancel-${v.id}`);
      cancelBtn.textContent = 'Batal';
      renameForm.appendChild(cancelBtn);

      topRow.appendChild(renameForm);
    } else {
      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = `analysis-variation-select-btn ${isActiveVar ? 'active' : ''}`;
      selectBtn.setAttribute('data-action', 'select-variation');
      selectBtn.setAttribute('data-variation-id', v.id);
      selectBtn.setAttribute('data-testid', `analysis-variation-select-${v.id}`);

      const nameStrong = document.createElement('strong');
      nameStrong.className = 'analysis-variation-name';
      nameStrong.setAttribute('data-testid', `analysis-variation-name-${v.id}`);
      nameStrong.textContent = safeDisplayValue(v.name, 'Variation');
      selectBtn.appendChild(nameStrong);

      const metaSpan = document.createElement('span');
      metaSpan.className = 'analysis-variation-meta';
      const parentLabel =
        v.parentVariationId && v.parentVariationId !== 'mainline'
          ? `Cabang ${v.parentVariationId}`
          : 'Mainline';
      metaSpan.textContent = `Dari ${parentLabel} (Ply ${v.parentPly}) • ${v.moves.length} ply`;
      selectBtn.appendChild(metaSpan);

      topRow.appendChild(selectBtn);

      const actionsGroup = document.createElement('div');
      actionsGroup.className = 'analysis-variation-item-actions';

      const continueBtn = document.createElement('button');
      continueBtn.type = 'button';
      continueBtn.className = 'btn btn-secondary btn-sm analysis-var-action-btn';
      continueBtn.setAttribute('data-action', 'continue-variation');
      continueBtn.setAttribute('data-variation-id', v.id);
      continueBtn.setAttribute('data-testid', `analysis-variation-continue-${v.id}`);
      continueBtn.title = 'Lanjutkan eksplorasi pada variasi ini';
      continueBtn.textContent = 'Lanjutkan';
      actionsGroup.appendChild(continueBtn);

      const originBtn = document.createElement('button');
      originBtn.type = 'button';
      originBtn.className = 'btn btn-secondary btn-sm analysis-var-action-btn';
      originBtn.setAttribute('data-action', 'variation-parent-pos');
      originBtn.setAttribute('data-variation-id', v.id);
      originBtn.setAttribute('data-testid', `analysis-variation-origin-${v.id}`);
      originBtn.title = 'Kembali ke posisi asal variasi ini';
      originBtn.textContent = 'Posisi Asal';
      actionsGroup.appendChild(originBtn);

      const renameBtn = document.createElement('button');
      renameBtn.type = 'button';
      renameBtn.className = 'btn btn-secondary btn-sm analysis-var-action-btn';
      renameBtn.setAttribute('data-action', 'start-rename-variation');
      renameBtn.setAttribute('data-variation-id', v.id);
      renameBtn.setAttribute('data-testid', `analysis-variation-rename-${v.id}`);
      renameBtn.title = 'Ganti nama variasi';
      renameBtn.textContent = 'Ubah Nama';
      actionsGroup.appendChild(renameBtn);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn btn-ghost btn-sm analysis-var-action-btn analysis-danger-btn';
      deleteBtn.setAttribute('data-action', 'delete-variation');
      deleteBtn.setAttribute('data-variation-id', v.id);
      deleteBtn.setAttribute('data-testid', `analysis-variation-delete-${v.id}`);
      deleteBtn.title = 'Hapus variasi ini';
      deleteBtn.textContent = 'Hapus';
      actionsGroup.appendChild(deleteBtn);

      topRow.appendChild(actionsGroup);
    }

    itemEl.appendChild(topRow);

    // Urutan langkah SAN pada variasi (dapat diklik langsung)
    const sanRow = document.createElement('div');
    sanRow.className = 'analysis-variation-san-sequence';
    sanRow.setAttribute('data-testid', `analysis-variation-moves-${v.id}`);

    v.moves.forEach(m => {
      const moveChip = document.createElement('button');
      moveChip.type = 'button';
      const isChipActive = isActiveVar && replayState.currentPly === m.ply;
      moveChip.className = `analysis-variation-move-chip ${isChipActive ? 'active' : ''}`;
      moveChip.setAttribute('data-action', 'jump-variation-ply');
      moveChip.setAttribute('data-variation-id', v.id);
      moveChip.setAttribute('data-ply', String(m.ply));
      moveChip.setAttribute('data-testid', `analysis-variation-${v.id}-ply-${m.ply}`);
      const movePrefix = m.color === 'w' ? `${m.moveNumber}.` : `${m.moveNumber}...`;
      moveChip.textContent = `${movePrefix} ${m.san}`;
      sanRow.appendChild(moveChip);
    });

    itemEl.appendChild(sanRow);
    varListEl.appendChild(itemEl);
  });
}

function _syncReplayStatusDom(container, state, replayState) {
  const game = state.parsedGame;
  if (!game || !replayState) return;

  const meta = game.metadata || {};
  const whiteName = safeDisplayValue(meta.white, 'Tidak diketahui');
  const blackName = safeDisplayValue(meta.black, 'Tidak diketahui');

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

  // Sinkronkan Mode Switcher & tombol eksplorasi
  const isExplore = replayState.mode === 'explore';
  const reviewModeBtn = container.querySelector('[data-testid="analysis-mode-review-btn"]');
  const exploreModeBtn = container.querySelector('[data-testid="analysis-mode-explore-btn"]');
  const modeStatusEl = container.querySelector('[data-testid="analysis-mode-status"]');

  if (reviewModeBtn) {
    reviewModeBtn.classList.toggle('active', !isExplore);
    reviewModeBtn.setAttribute('aria-pressed', !isExplore ? 'true' : 'false');
  }
  if (exploreModeBtn) {
    exploreModeBtn.classList.toggle('active', isExplore);
    exploreModeBtn.setAttribute('aria-pressed', isExplore ? 'true' : 'false');
  }
  if (modeStatusEl) {
    const isMainlineLine = !replayState.activeLineId || replayState.activeLineId === 'mainline';
    const lineLabel = isMainlineLine
      ? 'Partai Asli'
      : safeDisplayValue(replayState.activeLineName, 'Variasi');
    const modePrefix = isExplore ? 'Jelajahi Posisi' : 'Review Mode';
    const statusText = `${modePrefix} • ${lineLabel}`;
    modeStatusEl.textContent = statusText;
    modeStatusEl.title = statusText;
  }

  // Update ply badge & subtitle
  const plyBadgeEl = container.querySelector('[data-testid="analysis-ply-badge"]');
  if (plyBadgeEl) {
    plyBadgeEl.textContent = `Ply ${replayState.currentPly} / ${replayState.totalPlies}`;
  }

  const totalLineMoves = Math.ceil((Number(replayState.totalPlies) || 0) / 2);
  const stepSubtitleEl = container.querySelector('[data-testid="analysis-step-counter-subtitle"]');
  if (stepSubtitleEl) {
    const lineSuffix =
      replayState.activeLineId && replayState.activeLineId !== 'mainline'
        ? ` (${safeDisplayValue(replayState.activeLineName, 'Variasi')})`
        : '';
    if (replayState.currentPly === 0) {
      stepSubtitleEl.textContent = `Posisi Awal (Langkah 0 dari ${totalLineMoves})${lineSuffix}`;
    } else if (replayState.activeMove) {
      const sideText = replayState.activeMove.color === 'w' ? 'Putih' : 'Hitam';
      stepSubtitleEl.textContent = `Langkah ${replayState.activeMove.moveNumber} dari ${totalLineMoves} • ${sideText}: ${replayState.activeMove.san}${lineSuffix}`;
    }
  }

  // Update Position Information Panel (MVP 5.2)
  const setPosText = (testId, text) => {
    const el = container.querySelector(`[data-testid="${testId}"]`);
    if (el) {
      el.textContent = safeDisplayValue(text, '-');
    }
  };

  setPosText('analysis-pos-active-line', safeDisplayValue(replayState.activeLineName, 'Mainline'));
  setPosText(
    'analysis-pos-move-number',
    replayState.currentPly === 0
      ? '0 (Posisi Awal)'
      : `Langkah ${Number(replayState.moveNumber) || 1}`
  );
  setPosText(
    'analysis-pos-active-ply',
    `${Number(replayState.currentPly) || 0} / ${Number(replayState.totalPlies) || 0}`
  );
  setPosText('analysis-pos-next-turn', safeDisplayValue(replayState.nextTurnLabel, 'Putih (w)'));
  setPosText(
    'analysis-pos-check-status',
    safeDisplayValue(replayState.statusLabel, 'Normal (Tidak Skak)')
  );
  setPosText(
    'analysis-pos-last-san',
    replayState.lastMoveSan ? safeDisplayValue(replayState.lastMoveSan, '-') : 'Posisi Awal (-)'
  );

  // Update current FEN bar & Copy FEN label
  const currentFenEl = container.querySelector('[data-testid="analysis-current-fen"]');
  if (currentFenEl) {
    currentFenEl.textContent = safeDisplayValue(replayState.currentFen, game.initialFen);
  }
  const copyFenLabelEl = container.querySelector('[data-testid="analysis-copy-fen-label"]');
  if (copyFenLabelEl) {
    copyFenLabelEl.textContent = state.copyFenStatusMessage || 'Salin FEN';
  }

  // Render daftar langkah SAN (Desktop) dan Move Strip (Mobile) bila struktur jalur berubah,
  // atau perbarui class active secara in-place pada node DOM yang sudah ada.
  const linePairs = activeReplayBoardInstance
    ? activeReplayBoardInstance.getLineMovePairs(replayState.activeLineId)
    : Array.isArray(game.movePairs)
      ? game.movePairs
      : [];

  const lineSignature = `${replayState.activeLineId || 'mainline'}:${replayState.totalPlies}`;

  const moveListEl = container.querySelector('[data-testid="analysis-move-list"]');
  if (moveListEl) {
    if (moveListEl.getAttribute('data-rendered-signature') !== lineSignature) {
      _renderMoveListDom(moveListEl, linePairs, replayState.currentPly, replayState.activeLineId);
      moveListEl.setAttribute('data-rendered-signature', lineSignature);
    } else {
      const allPlyBtns = moveListEl.querySelectorAll('[data-ply]');
      allPlyBtns.forEach(btn => {
        const btnPly = Number(btn.getAttribute('data-ply'));
        if (btnPly === replayState.currentPly) {
          btn.classList.add('active');
          btn.setAttribute('aria-current', 'step');
        } else {
          btn.classList.remove('active');
          btn.removeAttribute('aria-current');
        }
      });
    }

    const activePlyBtn = moveListEl.querySelector(`[data-ply="${replayState.currentPly}"]`);
    if (
      activePlyBtn &&
      typeof moveListEl.scrollHeight === 'number' &&
      moveListEl.scrollHeight > moveListEl.clientHeight &&
      typeof activePlyBtn.offsetTop === 'number'
    ) {
      const targetScrollTop = Math.max(
        0,
        activePlyBtn.offsetTop - Math.floor(moveListEl.clientHeight / 2)
      );
      moveListEl.scrollTop = targetScrollTop;
    }
  }

  const mobileStripScrollEl = container.querySelector('[data-testid="analysis-mobile-strip-scroll"]');
  if (mobileStripScrollEl) {
    if (mobileStripScrollEl.getAttribute('data-rendered-signature') !== lineSignature) {
      _renderMobileMoveStripDom(
        mobileStripScrollEl,
        linePairs,
        replayState.currentPly,
        replayState.activeLineId
      );
      mobileStripScrollEl.setAttribute('data-rendered-signature', lineSignature);
    } else {
      const allMobilePills = mobileStripScrollEl.querySelectorAll('[data-mobile-ply]');
      allMobilePills.forEach(pill => {
        const pillPly = Number(pill.getAttribute('data-mobile-ply'));
        if (pillPly === replayState.currentPly) {
          pill.classList.add('active');
          pill.setAttribute('aria-current', 'step');
        } else {
          pill.classList.remove('active');
          pill.removeAttribute('aria-current');
        }
      });
    }

    const activePillEl = mobileStripScrollEl.querySelector(
      `[data-mobile-ply="${replayState.currentPly}"]`
    );
    if (
      activePillEl &&
      typeof mobileStripScrollEl.scrollWidth === 'number' &&
      mobileStripScrollEl.scrollWidth > mobileStripScrollEl.clientWidth &&
      typeof activePillEl.offsetLeft === 'number'
    ) {
      mobileStripScrollEl.scrollLeft = Math.max(
        0,
        activePillEl.offsetLeft - Math.floor(mobileStripScrollEl.clientWidth / 2)
      );
    }
  }

  // Render Variation Manager
  _renderVariationManagerDom(container, state, replayState);

  // Update disabled state untuk tombol di Mobile Move Strip, Mobile Bottom Toolbar, dan Quick Actions
  const isAtStart = replayState.currentPly <= 0;
  const isAtEnd = replayState.currentPly >= replayState.totalPlies;
  const isVariationActive =
    Boolean(replayState.activeLineId) && replayState.activeLineId !== 'mainline';

  const setBtnDisabled = (testId, disabled) => {
    const btn = container.querySelector(`[data-testid="${testId}"]`);
    if (!btn) return;
    btn.disabled = Boolean(disabled);
    if (disabled) {
      btn.setAttribute('disabled', 'true');
    } else {
      btn.removeAttribute('disabled');
    }
  };

  setBtnDisabled('analysis-mobile-strip-prev', isAtStart);
  setBtnDisabled('analysis-mobile-strip-next', isAtEnd);
  setBtnDisabled('analysis-mobile-btn-first', isAtStart);
  setBtnDisabled('analysis-mobile-btn-prev', isAtStart);
  setBtnDisabled('analysis-mobile-btn-next', isAtEnd);
  setBtnDisabled('analysis-mobile-btn-last', isAtEnd);

  const canUndoExploration = Boolean(
    isExplore &&
      isVariationActive &&
      replayState.activeVariation &&
      Array.isArray(replayState.activeVariation.moves) &&
      replayState.activeVariation.moves.length > 0
  );
  setBtnDisabled('analysis-undo-move-btn', !canUndoExploration);

  const undoBtnEl = container.querySelector('[data-testid="analysis-undo-move-btn"]');
  if (undoBtnEl) {
    if (!isExplore) {
      undoBtnEl.title =
        'Undo hanya aktif pada mode Jelajahi Posisi saat ada langkah eksplorasi';
    } else if (!canUndoExploration) {
      undoBtnEl.title = 'Belum ada langkah eksplorasi pada variasi aktif untuk dibatalkan';
    } else {
      undoBtnEl.title = 'Batalkan langkah eksplorasi terakhir pada variasi aktif';
    }
  }

  const variationNavGroupEl = container.querySelector(
    '[data-testid="analysis-variation-nav-group"]'
  );
  if (variationNavGroupEl) {
    if (isVariationActive) {
      variationNavGroupEl.classList.remove('hidden');
    } else {
      variationNavGroupEl.classList.add('hidden');
    }
  }

  const isAtParentPosition = Boolean(
    isVariationActive &&
      replayState.activeVariation &&
      replayState.currentPly === replayState.activeVariation.parentPly
  );
  setBtnDisabled('analysis-return-parent-btn', !isVariationActive || isAtParentPosition);
  setBtnDisabled('analysis-switch-mainline-btn', !isVariationActive);

  const returnParentBtnEl = container.querySelector('[data-testid="analysis-return-parent-btn"]');
  if (returnParentBtnEl) {
    returnParentBtnEl.title = isAtParentPosition
      ? 'Anda sudah berada tepat di posisi asal variasi ini'
      : 'Kembali ke posisi asal (parent position) dari variasi aktif';
  }

  // Update komentar / NAG untuk langkah aktif (Desktop & Mobile)
  const annotationTextEl = container.querySelector('[data-testid="analysis-move-annotation-text"]');
  const mobileCommentBarEl = container.querySelector('[data-testid="analysis-mobile-comment-bar"]');
  const mobileCommentTextEl = container.querySelector('[data-testid="analysis-mobile-comment-text"]');

  let activeAuthenticComments = [];
  if (replayState.currentPly === 0) {
    if (Array.isArray(game.initialComments) && game.initialComments.length > 0) {
      activeAuthenticComments = game.initialComments;
    }
  } else if (replayState.activeMove && Array.isArray(replayState.activeMove.comments)) {
    activeAuthenticComments = replayState.activeMove.comments;
  }

  if (mobileCommentBarEl && mobileCommentTextEl) {
    if (activeAuthenticComments.length > 0) {
      mobileCommentBarEl.classList.remove('hidden');
      mobileCommentTextEl.textContent = activeAuthenticComments.join(' ');
    } else {
      mobileCommentBarEl.classList.add('hidden');
      mobileCommentTextEl.textContent = '';
    }
  }

  if (annotationTextEl) {
    if (replayState.currentPly === 0) {
      if (activeAuthenticComments.length > 0) {
        annotationTextEl.textContent = activeAuthenticComments.join(' | ');
      } else {
        annotationTextEl.textContent =
          'Posisi awal permainan. Pilih langkah atau klik Berikutnya untuk memutar ulang partai.';
      }
    } else if (replayState.activeMove) {
      const m = replayState.activeMove;
      const parts = [];
      if (Array.isArray(m.nags) && m.nags.length > 0) {
        parts.push(
          `Evaluasi Notasi: ${m.nags.map(n => `${n.symbol || n.code} (${n.label})`).join(', ')}`
        );
      }
      if (Array.isArray(m.comments) && m.comments.length > 0) {
        parts.push(m.comments.join(' '));
      }
      if (parts.length > 0) {
        annotationTextEl.textContent = parts.join(' — ');
      } else {
        const sideLabel = m.color === 'w' ? 'Putih' : 'Hitam';
        annotationTextEl.textContent = `Langkah ${m.moveNumber} (${sideLabel}): ${m.san} (${m.from} → ${m.to}). Tidak ada komentar tambahan pada langkah ini.`;
      }
    }
  }

  // MVP 5.4: Sinkronkan Panel Analisis Stockfish 19
  _renderEngineAnalysisPanelDom(container, state, replayState);
}

/**
 * Merender status dan hasil akhir evaluasi Stockfish pada Panel Analisis (MVP 5.4).
 * Hanya menampilkan hasil evaluasi yang sudah selesai dan cocok dengan FEN aktif saat ini.
 */
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
    const modeText =
      replayState.mode === 'explore' ? 'Mode Jelajahi Posisi (Explore)' : 'Mode Review';
    const turnText = safeDisplayValue(replayState.turnLabel, 'Putih');
    modeCtxEl.textContent = `${modeText} • Ply ${replayState.currentPly} • Giliran ${turnText}`;
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
  const emptyTextEl = container.querySelector('[data-testid="analysis-engine-empty-text"]');
  const staleBoxEl = container.querySelector('[data-testid="analysis-engine-stale-notice"]');
  const staleTextEl = container.querySelector('[data-testid="analysis-engine-stale-text"]');
  const loadingBoxEl = container.querySelector('[data-testid="analysis-engine-loading"]');
  const loadingTextEl = container.querySelector('[data-testid="analysis-engine-loading-text"]');
  const errorBoxEl = container.querySelector('[data-testid="analysis-engine-error"]');
  const errorTextEl = container.querySelector('[data-testid="analysis-engine-error-text"]');
  const resultsBoxEl = container.querySelector('[data-testid="analysis-engine-results"]');

  const hideAllBoxes = () => {
    if (emptyBoxEl) emptyBoxEl.classList.add('hidden');
    if (staleBoxEl) staleBoxEl.classList.add('hidden');
    if (loadingBoxEl) loadingBoxEl.classList.add('hidden');
    if (errorBoxEl) errorBoxEl.classList.add('hidden');
    if (resultsBoxEl) resultsBoxEl.classList.add('hidden');
  };

  hideAllBoxes();

  const res = state.analysisResult;
  const hasValidFinalResult = Boolean(
    res &&
      res.ok &&
      res.completed &&
      !res.stale &&
      !state.analysisStale &&
      res.fen === replayState.currentFen &&
      !isBusy &&
      !state.analysisError
  );

  if (isBusy) {
    if (loadingBoxEl) loadingBoxEl.classList.remove('hidden');
    if (loadingTextEl) {
      loadingTextEl.textContent =
        statusKey === ANALYSIS_ENGINE_STATES.LOADING
          ? 'Memuat engine Stockfish 19 Lite WASM...'
          : 'Stockfish sedang menganalisis posisi aktif...';
    }
    return;
  }

  if (state.analysisError) {
    if (errorBoxEl) errorBoxEl.classList.remove('hidden');
    if (errorTextEl) {
      errorTextEl.textContent = safeDisplayValue(
        state.analysisError,
        'Gagal menganalisis posisi catur. Silakan coba kembali.'
      );
    }
    return;
  }

  if (hasValidFinalResult) {
    if (resultsBoxEl) resultsBoxEl.classList.remove('hidden');

    const evalInfo = res.evaluation || {};
    const evalScoreEl = container.querySelector('[data-testid="analysis-eval-score"]');
    const evalLabelEl = container.querySelector('[data-testid="analysis-eval-label"]');
    const depthEl = container.querySelector('[data-testid="analysis-depth-value"]');
    const bestMoveSanEl = container.querySelector('[data-testid="analysis-best-move-san"]');
    const bestMoveSqEl = container.querySelector('[data-testid="analysis-best-move-squares"]');
    const pvLineEl = container.querySelector('[data-testid="analysis-pv-line"]');
    const pvCountEl = container.querySelector('[data-testid="analysis-pv-count"]');

    if (evalScoreEl) {
      evalScoreEl.textContent = safeDisplayValue(evalInfo.formatted, '0.00');
      evalScoreEl.setAttribute('data-advantage', safeDisplayValue(evalInfo.advantage, 'equal'));
      evalScoreEl.setAttribute('data-perspective', 'white');
    }
    if (evalLabelEl) {
      evalLabelEl.textContent = safeDisplayValue(evalInfo.label, 'Posisi seimbang');
    }
    if (depthEl) {
      const depthNum = typeof res.depth === 'number' && res.depth >= 0 ? res.depth : 0;
      depthEl.textContent = `Depth ${depthNum}`;
      depthEl.setAttribute('data-depth', String(depthNum));
    }

    if (bestMoveSanEl) {
      if (res.bestMove && res.bestMove.san) {
        bestMoveSanEl.textContent = `Best Move: ${res.bestMove.san}`;
        bestMoveSanEl.setAttribute('data-san', res.bestMove.san);
      } else {
        bestMoveSanEl.textContent = 'Best Move: - (Posisi Terminal)';
        bestMoveSanEl.setAttribute('data-san', '');
      }
    }

    if (bestMoveSqEl) {
      if (res.bestMove && res.bestMove.from && res.bestMove.to) {
        bestMoveSqEl.textContent = `Petak: ${res.bestMove.from} → ${res.bestMove.to}`;
        bestMoveSqEl.setAttribute('data-from', res.bestMove.from);
        bestMoveSqEl.setAttribute('data-to', res.bestMove.to);
      } else {
        bestMoveSqEl.textContent = 'Tidak ada langkah lanjutan pada posisi ini';
        bestMoveSqEl.setAttribute('data-from', '');
        bestMoveSqEl.setAttribute('data-to', '');
      }
    }

    const sanMoves =
      res.pv && Array.isArray(res.pv.sanMoves) && res.pv.sanMoves.length > 0
        ? res.pv.sanMoves
        : res.bestMove && res.bestMove.san
          ? [res.bestMove.san]
          : [];

    if (pvCountEl) {
      pvCountEl.textContent = `${sanMoves.length} langkah`;
    }

    if (pvLineEl) {
      pvLineEl.textContent =
        sanMoves.length > 0 ? sanMoves.join(' ') : 'Tidak ada rangkaian langkah (posisi terminal).';
    }
    return;
  }

  if (state.analysisStale && state.analysisStaleMessage) {
    if (staleBoxEl) staleBoxEl.classList.remove('hidden');
    if (staleTextEl) {
      staleTextEl.textContent = safeDisplayValue(
        state.analysisStaleMessage,
        'Posisi papan telah berubah. Tekan "Analyze Position" untuk menganalisis posisi baru.'
      );
    }
    return;
  }

  if (emptyBoxEl) emptyBoxEl.classList.remove('hidden');
  if (emptyTextEl) {
    if (statusKey === ANALYSIS_ENGINE_STATES.STOPPED) {
      emptyTextEl.textContent =
        'Analisis dihentikan. Tekan "Analyze Position" atau "Analyze Again" untuk mengevaluasi posisi aktif.';
    } else {
      emptyTextEl.textContent =
        'Tekan "Analyze Position" untuk menganalisis posisi aktif pada papan menggunakan Stockfish 19 Lite.';
    }
  }
}

/**
 * Menjalankan analisis Stockfish secara manual untuk posisi papan yang sedang aktif.
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

  // Cegah permintaan analisis ganda yang tidak disengaja
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

  // Jika pengguna sudah meninggalkan halaman atau instance papan telah diganti, abaikan
  if (!activeReplayBoardInstance || activeReplayBoardInstance !== board) {
    return result;
  }

  const currentFenNow = board.getCurrentFen();

  // Jika posisi papan berubah selama analisis atau hasil ditandai stale, abaikan hasil lama
  if (currentFenNow !== targetFen || (result && result.stale)) {
    state.analysisResult = null;
    state.analysisStale = true;
    if (!state.analysisStaleMessage) {
      state.analysisStaleMessage =
        'Posisi papan berubah saat analisis berlangsung. Hasil posisi lama diabaikan — tekan "Analyze Position" untuk menganalisis posisi baru.';
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

  // Hasil akhir valid untuk posisi aktif saat ini
  state.engineStatus = ANALYSIS_ENGINE_STATES.READY;
  state.engineStatusLabel = ANALYSIS_ENGINE_STATE_LABELS[ANALYSIS_ENGINE_STATES.READY];
  state.analysisError = null;
  state.analysisStale = false;
  state.analysisStaleMessage = '';
  state.analysisResult = result;
  state.lastAnalyzedFen = targetFen;

  // Tampilkan penanda visual rekomendasi langkah terbaik pada papan tanpa menjalankan langkahnya
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
 * Menghentikan analisis Stockfish yang sedang berjalan dengan aman.
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

function _applyPgnValidationResult(container, state, validationResult, rawText, callbacks) {
  state.isValidating = false;

  if (!validationResult || !validationResult.valid) {
    state.validationError = {
      errorCode: validationResult ? validationResult.errorCode : 'PARSER_ERROR',
      errorTitle: validationResult ? validationResult.errorTitle : 'PGN tidak valid',
      errorMessage: validationResult
        ? validationResult.errorMessage
        : 'PGN tidak valid. Periksa kembali format notasi dan legalitas langkah catur.',
      details: validationResult ? validationResult.details : null
    };
    // Pertahankan rawPgnText dan selectedFileMeta agar pengguna dapat memperbaikinya tanpa kehilangan input
    if (typeof rawText === 'string') {
      state.rawPgnText = rawText;
    }
    state.parsedGame = null;
    state.lastValidatedRawPgn = null;
    resetAnalysisExplorationState(state);
    state.mobileScreen = 'import';
    if (typeof callbacks.onMobileScreenChange === 'function') {
      callbacks.onMobileScreenChange('import');
    }
    renderAnalysisView(container, state, callbacks);
    return false;
  }

  const hadPreviousVariations = Array.isArray(state.variations) && state.variations.length > 0;
  const previousVarCount = hadPreviousVariations ? state.variations.length : 0;

  state.validationError = null;
  state.parsedGame = validationResult;
  if (typeof rawText === 'string') {
    state.rawPgnText = rawText;
    state.lastValidatedRawPgn = rawText;
  }
  resetAnalysisExplorationState(state, { preserveCleanupNotice: false });
  if (hadPreviousVariations) {
    state.sessionCleanupNotice = `Sesi eksplorasi sebelumnya (${previousVarCount} variasi) telah dibersihkan karena partai baru dimuat.`;
  }
  state.mobileScreen = 'review';
  state.showInputPanelInPreview = false;

  if (typeof callbacks.onMobileScreenChange === 'function') {
    callbacks.onMobileScreenChange('review');
  }
  renderAnalysisView(container, state, callbacks);
  return true;
}

/**
 * Menjalankan validasi PGN (dengan pencegahan submit berulang dan penghindaran re-parse jika teks tidak berubah)
 */
function _executeValidateAndStartReview(container, state, rawText, callbacks) {
  if (state.isValidating) return false;

  const trimmedCandidate = typeof rawText === 'string' ? rawText : state.rawPgnText || '';
  state.rawPgnText = trimmedCandidate;

  // Jika pengguna kembali dari Game Review dan belum mengubah teks PGN sama sekali,
  // langsung kembali ke layar Review tanpa mem-parsing ulang dan pertahankan langkah terakhir!
  if (
    state.parsedGame &&
    state.parsedGame.valid &&
    typeof state.lastValidatedRawPgn === 'string' &&
    state.lastValidatedRawPgn === trimmedCandidate
  ) {
    state.validationError = null;
    state.mobileScreen = 'review';
    state.showInputPanelInPreview = false;
    if (typeof callbacks.onMobileScreenChange === 'function') {
      callbacks.onMobileScreenChange('review');
    }
    renderAnalysisView(container, state, callbacks);
    return true;
  }

  state.isValidating = true;
  state.validationCount = (Number(state.validationCount) || 0) + 1;
  const validation = validateAndParsePgn(trimmedCandidate);
  return _applyPgnValidationResult(container, state, validation, trimmedCandidate, callbacks);
}

async function _readFileTextSafely(file) {
  if (!file) return '';
  if (typeof file.text === 'function') {
    return await file.text();
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Gagal membaca file PGN.'));
    reader.readAsText(file, 'utf-8');
  });
}

async function _handleFileSelectionAndImport(file, container, state, callbacks) {
  if (!file || state.isValidating) return false;

  const metaCheck = validatePgnFileMeta({
    name: file.name,
    size: file.size,
    type: file.type
  });

  state.selectedFileMeta = {
    name: file.name || 'partai.pgn',
    size: typeof file.size === 'number' ? file.size : 0,
    formattedSize: metaCheck.formattedSize || formatFileSize(file.size),
    type: file.type || '',
    rawContent: null
  };

  if (!metaCheck.valid) {
    state.validationError = {
      errorCode: metaCheck.errorCode,
      errorTitle: metaCheck.errorTitle,
      errorMessage: metaCheck.errorMessage
    };
    state.parsedGame = null;
    state.lastValidatedRawPgn = null;
    resetAnalysisExplorationState(state);
    state.mobileScreen = 'import';
    renderAnalysisView(container, state, callbacks);
    return false;
  }

  try {
    state.isValidating = true;
    const content = await _readFileTextSafely(file);
    state.selectedFileMeta.rawContent = content;
    state.rawPgnText = content;
    state.validationCount = (Number(state.validationCount) || 0) + 1;
    const validation = validateAndParsePgn(content);
    return _applyPgnValidationResult(container, state, validation, content, callbacks);
  } catch {
    state.isValidating = false;
    state.validationError = {
      errorCode: 'PARSER_ERROR',
      errorTitle: 'Gagal Membaca File',
      errorMessage: 'File tidak dapat dibaca oleh browser. Pastikan file PGN valid dan tidak rusak.'
    };
    state.parsedGame = null;
    state.lastValidatedRawPgn = null;
    resetAnalysisExplorationState(state);
    state.mobileScreen = 'import';
    renderAnalysisView(container, state, callbacks);
    return false;
  }
}

function _syncClipboardFeedbackDom(container, state) {
  if (!container) return;
  const feedbackEl = container.querySelector('[data-testid="pgn-clipboard-feedback"]');
  if (!feedbackEl) return;

  const fb = state && state.clipboardFeedback ? state.clipboardFeedback : null;
  if (!fb || !fb.message) {
    feedbackEl.className = 'analysis-clipboard-feedback hidden';
    feedbackEl.setAttribute('data-status', '');
    feedbackEl.textContent = '';
    return;
  }

  const statusKey = fb.status || 'info';
  feedbackEl.className = `analysis-clipboard-feedback is-${statusKey}`;
  feedbackEl.setAttribute('data-status', statusKey);
  feedbackEl.textContent = safeDisplayValue(fb.message, '');
}

function _bindAnalysisViewEvents(container, state, callbacks) {
  const fileInput = container.querySelector('#pgn-file-input');
  const triggerFileBtn = container.querySelector('[data-action="trigger-file-picker"]');
  const changeFileBtn = container.querySelector('[data-action="change-selected-file"]');
  const removeFileBtn = container.querySelector('[data-action="remove-selected-file"]');
  const importFileBtn = container.querySelector('[data-action="import-selected-file"]');

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
      const files = e.target && e.target.files ? e.target.files : null;
      if (!files || files.length === 0) return;
      await _handleFileSelectionAndImport(files[0], container, state, callbacks);
    });
  }

  if (removeFileBtn) {
    removeFileBtn.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      state.selectedFileMeta = null;
      state.validationError = null;
      renderAnalysisView(container, state, callbacks);
    });
  }

  if (importFileBtn) {
    importFileBtn.addEventListener('click', () => {
      if (!state.selectedFileMeta) {
        state.validationError = {
          errorCode: 'EMPTY_FILE',
          errorTitle: 'Belum Ada File Dipilih',
          errorMessage: 'Silakan pilih file .pgn terlebih dahulu sebelum menekan tombol Impor File.'
        };
        state.mobileScreen = 'import';
        renderAnalysisView(container, state, callbacks);
        return;
      }

      const metaCheck = validatePgnFileMeta(state.selectedFileMeta);
      if (!metaCheck.valid) {
        state.validationError = {
          errorCode: metaCheck.errorCode,
          errorTitle: metaCheck.errorTitle,
          errorMessage: metaCheck.errorMessage
        };
        state.parsedGame = null;
        state.lastValidatedRawPgn = null;
        resetAnalysisExplorationState(state);
        state.mobileScreen = 'import';
        renderAnalysisView(container, state, callbacks);
        return;
      }

      const content =
        typeof state.selectedFileMeta.rawContent === 'string'
          ? state.selectedFileMeta.rawContent
          : state.rawPgnText;
      _executeValidateAndStartReview(container, state, content, callbacks);
    });
  }

  // Paste PGN events
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

    textareaEl.addEventListener('paste', e => {
      // Jangan memanggil preventDefault() agar native paste mobile/desktop berfungsi mulus.
      const clipDataText =
        e && e.clipboardData && typeof e.clipboardData.getData === 'function'
          ? e.clipboardData.getData('text/plain') || e.clipboardData.getData('text')
          : '';
      if (typeof clipDataText === 'string' && clipDataText.length > 0 && !textareaEl.value) {
        textareaEl.value = clipDataText;
      }
      state.rawPgnText = textareaEl.value;
      state.validationError = null;
      state.clipboardFeedback = {
        status: 'success',
        message:
          'Teks PGN berhasil ditempel ke kotak teks. Tekan "Validasi & Mulai Review" untuk melanjutkan.'
      };
      _syncClipboardFeedbackDom(container, state);
      setTimeout(() => {
        if (textareaEl) {
          state.rawPgnText = textareaEl.value;
        }
      }, 0);
    });
  }

  const pasteClipboardBtn = container.querySelector('[data-action="paste-from-clipboard"]');
  if (pasteClipboardBtn) {
    pasteClipboardBtn.addEventListener('click', async () => {
      if (
        typeof navigator === 'undefined' ||
        !navigator.clipboard ||
        typeof navigator.clipboard.readText !== 'function'
      ) {
        state.clipboardFeedback = {
          status: 'fallback',
          message:
            'Fitur baca clipboard otomatis tidak tersedia di browser ini. Silakan ketuk dan tahan (long-press) di dalam kotak teks PGN di atas, lalu pilih Tempel (Paste).'
        };
        _syncClipboardFeedbackDom(container, state);
        if (textareaEl && typeof textareaEl.focus === 'function') {
          textareaEl.focus();
        }
        return;
      }

      try {
        const clipText = await navigator.clipboard.readText();
        if (typeof clipText !== 'string' || !clipText.trim()) {
          state.clipboardFeedback = {
            status: 'empty',
            message:
              'Clipboard perangkat kosong atau belum berisi teks PGN. Silakan salin PGN terlebih dahulu, atau ketuk dan tahan (long-press) di dalam kotak teks PGN lalu pilih Tempel (Paste).'
          };
          _syncClipboardFeedbackDom(container, state);
          if (textareaEl && typeof textareaEl.focus === 'function') {
            textareaEl.focus();
          }
          return;
        }

        state.rawPgnText = clipText;
        state.validationError = null;
        if (textareaEl) {
          textareaEl.value = clipText;
          textareaEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
        state.clipboardFeedback = {
          status: 'success',
          message:
            'Teks PGN berhasil ditempel dari clipboard. Tekan "Validasi & Mulai Review" untuk melanjutkan.'
        };
        _syncClipboardFeedbackDom(container, state);
      } catch {
        state.clipboardFeedback = {
          status: 'fallback',
          message:
            'Izin akses clipboard ditolak atau dibatasi oleh browser. Silakan ketuk dan tahan (long-press) di dalam kotak teks PGN di atas, lalu pilih Tempel (Paste).'
        };
        _syncClipboardFeedbackDom(container, state);
        if (textareaEl && typeof textareaEl.focus === 'function') {
          textareaEl.focus();
        }
      }
    });
  }

  if (submitPasteBtn) {
    submitPasteBtn.addEventListener('click', () => {
      const currentText = textareaEl ? textareaEl.value : state.rawPgnText;
      _executeValidateAndStartReview(container, state, currentText, callbacks);
    });
  }

  if (mobileValidateCtaBtn) {
    mobileValidateCtaBtn.addEventListener('click', () => {
      const currentText = textareaEl ? textareaEl.value : state.rawPgnText;
      _executeValidateAndStartReview(container, state, currentText, callbacks);
    });
  }

  if (clearPasteBtn) {
    clearPasteBtn.addEventListener('click', () => {
      state.rawPgnText = '';
      state.lastValidatedRawPgn = null;
      state.validationError = null;
      if (textareaEl) {
      state.clipboardFeedback = null;
        textareaEl.value = '';
        textareaEl.focus();
      }
      renderAnalysisView(container, state, callbacks);
    });
  }

  if (loadSampleBtn) {
    loadSampleBtn.addEventListener('click', () => {
      state.rawPgnText = SAMPLE_PGN_PLACEHOLDER;
      state.validationError = null;
      if (textareaEl) {
        textareaEl.value = SAMPLE_PGN_PLACEHOLDER;
      state.clipboardFeedback = {
        status: 'success',
        message:
          'Contoh PGN berhasil dimuat ke kotak teks. Tekan "Validasi & Mulai Review" untuk melanjutkan.'
      };
      _syncClipboardFeedbackDom(container, state);
      }
    });
  }

  // Dismiss error / notification alert
  const dismissErrBtn = container.querySelector('[data-action="analysis-dismiss-error"]');
  if (dismissErrBtn) {
    dismissErrBtn.addEventListener('click', () => {
      state.validationError = null;
      state.isImportNoticeDismissed = true;
      renderAnalysisView(container, state, callbacks);
    });
  }

  // Mobile Screen 1: Tombol Kembali ke halaman sebelumnya
  const mobileBackFromStudioBtn = container.querySelector('[data-action="mobile-back-from-studio"]');
  if (mobileBackFromStudioBtn) {
    mobileBackFromStudioBtn.addEventListener('click', () => {
      if (typeof callbacks.onBackFromStudio === 'function') {
        callbacks.onBackFromStudio();
      }
    });
  }

  // Mobile Screen 2: Tombol Kembali ke PGN Import (mempertahankan data PGN, file, parsedGame, & currentPly)
  const mobileBackToImportBtn = container.querySelector('[data-action="mobile-back-to-import"]');
  if (mobileBackToImportBtn) {
    mobileBackToImportBtn.addEventListener('click', () => {
      state.mobileScreen = 'import';
      state.validationError = null;
      if (typeof callbacks.onMobileScreenChange === 'function') {
        callbacks.onMobileScreenChange('import');
      }
      renderAnalysisView(container, state, callbacks);
    });
  }

  // Header & Studio actions pada Desktop ketika partai terbuka
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
      state.parsedGame = null;
      state.lastValidatedRawPgn = null;
      state.validationError = null;
      resetAnalysisExplorationState(state);
      state.mobileScreen = 'import';
      state.showInputPanelInPreview = false;
      renderAnalysisView(container, state, callbacks);
    });
  }

  const deleteGameBtn = container.querySelector('[data-action="analysis-delete-game"]');
  if (deleteGameBtn) {
    deleteGameBtn.addEventListener('click', () => {
      state.rawPgnText = '';
      state.lastValidatedRawPgn = null;
      state.selectedFileMeta = null;
      state.validationError = null;
      state.parsedGame = null;
      resetAnalysisExplorationState(state);
      state.mobileScreen = 'import';
      state.showInputPanelInPreview = false;
      renderAnalysisView(container, state, callbacks);
    });
  }

  // Tombol Salin PGN (Desktop & Mobile)
  const copyPgnBtns = container.querySelectorAll('[data-action="copy-normalized-pgn"]');
  copyPgnBtns.forEach(copyBtn => {
    if (state.parsedGame && state.parsedGame.normalizedPgn) {
      copyBtn.addEventListener('click', async () => {
        const normalized = state.parsedGame.normalizedPgn;
        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(normalized);
          }
        } catch {
          // Fallback aman jika clipboard API dibatasi
        }
        state.copyStatusMessage = 'PGN Tersalin!';
        const copyLabelEl = container.querySelector('[data-testid="analysis-copy-pgn-label"]');
        if (copyLabelEl) {
          copyLabelEl.textContent = state.copyStatusMessage;
        }
        const mobileCopyLabelEl = container.querySelector('[data-testid="analysis-mobile-copy-label"]');
        if (mobileCopyLabelEl) {
          mobileCopyLabelEl.textContent = 'Tersalin';
        }
      });
    }
  });

  // MVP 5.2: Tombol Salin FEN Posisi Saat Ini
  const copyFenBtn = container.querySelector('[data-action="copy-current-fen"]');
  if (copyFenBtn) {
    copyFenBtn.addEventListener('click', async () => {
      const activeFen = activeReplayBoardInstance
        ? activeReplayBoardInstance.getCurrentFen()
        : state.parsedGame
          ? state.parsedGame.initialFen
          : '';
      if (!activeFen) return;

      let copiedViaClipboard = false;
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(activeFen);
          copiedViaClipboard = true;
        }
      } catch {
        copiedViaClipboard = false;
      }

      if (!copiedViaClipboard && typeof document !== 'undefined' && document.body) {
        try {
          const tempInput = document.createElement('textarea');
          tempInput.value = activeFen;
          tempInput.setAttribute('readonly', 'true');
          tempInput.style.position = 'fixed';
          tempInput.style.opacity = '0';
          document.body.appendChild(tempInput);
          if (typeof tempInput.select === 'function') {
            tempInput.select();
          }
          if (typeof document.execCommand === 'function') {
            document.execCommand('copy');
          }
          if (typeof tempInput.remove === 'function') {
            tempInput.remove();
          } else if (tempInput.parentNode) {
            tempInput.parentNode.removeChild(tempInput);
          }
        } catch {
          // Fallback aman selesai
        }
      }

      state.lastCopiedFen = activeFen;
      state.copyFenStatusMessage = 'FEN Tersalin!';
      const copyFenLabelEl = container.querySelector('[data-testid="analysis-copy-fen-label"]');
      if (copyFenLabelEl) {
        copyFenLabelEl.textContent = state.copyFenStatusMessage;
      }
    });
  }

  // MVP 5.2: Mode Switcher (Review Mode vs Jelajahi Posisi)
  const modeReviewBtn = container.querySelector('[data-action="set-mode-review"]');
  if (modeReviewBtn) {
    modeReviewBtn.addEventListener('click', () => {
      state.analysisMode = 'review';
      if (activeReplayBoardInstance) {
        activeReplayBoardInstance.setMode('review');
      }
    });
  }

  const modeExploreBtn = container.querySelector('[data-action="set-mode-explore"]');
  if (modeExploreBtn) {
    modeExploreBtn.addEventListener('click', () => {
      state.analysisMode = 'explore';
      if (activeReplayBoardInstance) {
        activeReplayBoardInstance.setMode('explore');
      }
    });
  }

  // MVP 5.2: Quick Exploration Actions (Undo, Posisi Asal, Mainline)
  const undoExploreBtn = container.querySelector('[data-action="undo-exploration-move"]');
  if (undoExploreBtn) {
    undoExploreBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) {
        activeReplayBoardInstance.undoExplorationMove();
      }
    });
  }

  const returnParentBtns = container.querySelectorAll('[data-action="return-parent-position"]');
  returnParentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (activeReplayBoardInstance) {
        activeReplayBoardInstance.returnToParentPosition();
      }
    });
  });

  const switchMainlineBtns = container.querySelectorAll('[data-action="switch-to-mainline"]');
  switchMainlineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.renamingVariationId = null;
      if (activeReplayBoardInstance) {
        activeReplayBoardInstance.switchToMainline();
      }
    });
  });

  // Mobile Variation Selector dropdown
  const mobileVariationSelect = container.querySelector('[data-action="mobile-select-variation"]');
  if (mobileVariationSelect) {
    mobileVariationSelect.addEventListener('change', e => {
      const targetLineId = e.target ? e.target.value : 'mainline';
      if (!activeReplayBoardInstance) return;
      if (targetLineId === 'mainline') {
        activeReplayBoardInstance.switchToMainline();
      } else {
        activeReplayBoardInstance.selectVariation(targetLineId);
      }
    });
  }

  // MVP 5.2: Delegasi klik pada Variation Manager (Pilih, Lanjutkan, Posisi Asal, Rename, Hapus, Lompat Ply)
  const varListEl = container.querySelector('[data-testid="analysis-variation-list"]');
  if (varListEl) {
    varListEl.addEventListener('click', e => {
      const actionEl =
        e.target && typeof e.target.closest === 'function'
          ? e.target.closest('[data-action]')
          : null;
      if (!actionEl || !activeReplayBoardInstance) return;

      const action = actionEl.getAttribute('data-action');
      const variationId = actionEl.getAttribute('data-variation-id');
      if (!variationId) return;

      if (action === 'select-variation') {
        state.renamingVariationId = null;
        activeReplayBoardInstance.selectVariation(variationId);
      } else if (action === 'continue-variation') {
        state.renamingVariationId = null;
        activeReplayBoardInstance.continueVariation(variationId);
      } else if (action === 'variation-parent-pos') {
        state.renamingVariationId = null;
        activeReplayBoardInstance.returnToParentPosition(variationId);
      } else if (action === 'start-rename-variation') {
        state.renamingVariationId = variationId;
        _renderVariationManagerDom(
          container,
          state,
          activeReplayBoardInstance.getReplayState()
        );
        const inputEl = container.querySelector(
          `[data-testid="analysis-variation-rename-input-${variationId}"]`
        );
        if (inputEl && typeof inputEl.focus === 'function') {
          inputEl.focus();
        }
      } else if (action === 'save-rename-variation') {
        const inputEl = container.querySelector(
          `[data-testid="analysis-variation-rename-input-${variationId}"]`
        );
        const newName = inputEl ? inputEl.value : '';
        state.renamingVariationId = null;
        activeReplayBoardInstance.renameVariation(variationId, newName);
      } else if (action === 'cancel-rename-variation') {
        state.renamingVariationId = null;
        _renderVariationManagerDom(
          container,
          state,
          activeReplayBoardInstance.getReplayState()
        );
      } else if (action === 'delete-variation') {
        state.renamingVariationId = null;
        activeReplayBoardInstance.deleteVariation(variationId);
      } else if (action === 'jump-variation-ply') {
        state.renamingVariationId = null;
        const targetPly = Number(actionEl.getAttribute('data-ply'));
        if (!Number.isNaN(targetPly)) {
          activeReplayBoardInstance.selectVariation(variationId, { targetPly });
        }
      }
    });

    varListEl.addEventListener('keydown', e => {
      const inputEl =
        e.target && typeof e.target.closest === 'function'
          ? e.target.closest('.analysis-variation-rename-input')
          : null;
      if (!inputEl || !activeReplayBoardInstance) return;
      const variationId = inputEl.getAttribute('data-variation-id');
      if (!variationId) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        state.renamingVariationId = null;
        activeReplayBoardInstance.renameVariation(variationId, inputEl.value);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        state.renamingVariationId = null;
        _renderVariationManagerDom(
          container,
          state,
          activeReplayBoardInstance.getReplayState()
        );
      }
    });
  }

  // Navigasi klik langsung pada daftar langkah SAN (Desktop)
  const moveListEl = container.querySelector('[data-testid="analysis-move-list"]');
  if (moveListEl) {
    moveListEl.addEventListener('click', e => {
      const targetBtn =
        e.target && typeof e.target.closest === 'function'
          ? e.target.closest('[data-ply]')
          : null;
      if (!targetBtn || !activeReplayBoardInstance) return;
      const targetPly = Number(targetBtn.getAttribute('data-ply'));
      if (!Number.isNaN(targetPly)) {
        activeReplayBoardInstance.goToPly(targetPly);
      }
    });
  }

  // Navigasi klik langsung pada Move Navigation Strip (Mobile)
  const mobileStripScrollEl = container.querySelector('[data-testid="analysis-mobile-strip-scroll"]');
  if (mobileStripScrollEl) {
    mobileStripScrollEl.addEventListener('click', e => {
      const targetPill =
        e.target && typeof e.target.closest === 'function'
          ? e.target.closest('[data-mobile-ply]')
          : null;
      if (!targetPill || !activeReplayBoardInstance) return;
      const targetPly = Number(targetPill.getAttribute('data-mobile-ply'));
      if (!Number.isNaN(targetPly)) {
        activeReplayBoardInstance.goToPly(targetPly);
      }
    });
  }

  // Navigasi tombol Prev / Next pada Move Navigation Strip (Mobile)
  const stripPrevBtn = container.querySelector('[data-action="mobile-strip-prev"]');
  if (stripPrevBtn) {
    stripPrevBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.prevMove();
    });
  }

  const stripNextBtn = container.querySelector('[data-action="mobile-strip-next"]');
  if (stripNextBtn) {
    stripNextBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.nextMove();
    });
  }

  // Navigasi tombol pada Mobile Bottom Toolbar (Awal, Sebelumnya, Berikutnya, Akhir, Balik Papan)
  const mobileFirstBtn = container.querySelector('[data-action="mobile-toolbar-first"]');
  if (mobileFirstBtn) {
    mobileFirstBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.firstMove();
    });
  }

  const mobilePrevBtn = container.querySelector('[data-action="mobile-toolbar-prev"]');
  if (mobilePrevBtn) {
    mobilePrevBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.prevMove();
    });
  }

  const mobileNextBtn = container.querySelector('[data-action="mobile-toolbar-next"]');
  if (mobileNextBtn) {
    mobileNextBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.nextMove();
    });
  }

  const mobileLastBtn = container.querySelector('[data-action="mobile-toolbar-last"]');
  if (mobileLastBtn) {
    mobileLastBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.lastMovePosition();
    });
  }

  const mobileFlipBtn = container.querySelector('[data-action="mobile-toolbar-flip"]');
  if (mobileFlipBtn) {
    mobileFlipBtn.addEventListener('click', () => {
      if (activeReplayBoardInstance) activeReplayBoardInstance.flipBoard();
    });
  }

  // MVP 5.4: Kontrol Analisis Stockfish (Analyze Position, Stop Analysis, Analyze Again)
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
