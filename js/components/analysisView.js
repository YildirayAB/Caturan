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

export const MOBILE_ANALYSIS_BREAKPOINT = 600;

export const SAMPLE_PGN_PLACEHOLDER = `[Event "Partai Latihan Caturan"]
[Site "Jakarta, Indonesia"]
[Date "2026.05.10"]
[Round "1"]
[White "Budi Santoso"]
[Black "Andi Pratama"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 1-0`;

let activeReplayBoardInstance = null;

export function destroyActiveAnalysisBoard() {
  if (activeReplayBoardInstance && typeof activeReplayBoardInstance.destroy === 'function') {
    activeReplayBoardInstance.destroy();
  }
  activeReplayBoardInstance = null;
}

export function getActiveAnalysisBoard() {
  return activeReplayBoardInstance;
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
    mobileScreen: 'import', // 'import' | 'review'
    isValidating: false,
    validationCount: 0,
    showInputPanelInPreview: false,
    copyStatusMessage: ''
  };
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

  container.innerHTML = `
    <div
      class="analysis-studio-page mobile-screen-${activeMobileScreen}"
      data-testid="analysis-studio-page"
      data-mobile-screen="${activeMobileScreen}"
    >
      <!-- MOBILE SCREEN 1 TOPBAR (Hanya tampil di <= 600px saat berada di Screen Import) -->
      <header
        class="analysis-mobile-only analysis-mobile-import-topbar ${activeMobileScreen === 'import' ? '' : 'hidden'}"
        data-testid="analysis-mobile-import-topbar"
      >
        <div class="analysis-mobile-topbar-row">
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
          <span class="badge badge-orange">MVP 5.1</span>
        </div>
        <div class="analysis-mobile-import-heading">
          <h1 class="analysis-mobile-title" data-testid="analysis-mobile-import-title">Chess Analysis Studio</h1>
          <p class="analysis-mobile-subtitle" data-testid="analysis-mobile-import-desc">
            Import dan review permainan catur Anda
          </p>
        </div>
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

      <!-- ERROR BANNER (Digunakan pada Desktop maupun Mobile Screen 1) -->
      <div
        class="analysis-error-banner ${state.validationError && activeMobileScreen === 'import' ? '' : state.validationError && !isMobile ? '' : 'hidden'}"
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
          class="btn btn-ghost btn-sm analysis-touch-btn"
          data-action="analysis-dismiss-error"
          data-testid="pgn-error-dismiss-btn"
          aria-label="Tutup pesan error"
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
                data-testid="pgn-paste-textarea"
              ></textarea>

              <div class="analysis-paste-actions">
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

          <!-- DESKTOP MOVES PANEL (Dipertahankan persis seperti MVP 5.1) -->
          <aside class="card analysis-moves-panel analysis-desktop-moves-panel" aria-label="Riwayat Langkah SAN">
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

            <div class="analysis-annotation-box" data-testid="analysis-move-annotation">
              <span class="analysis-meta-label">Catatan / Komentar Langkah</span>
              <p class="analysis-annotation-text" data-testid="analysis-move-annotation-text"></p>
            </div>

            <div class="analysis-current-fen-bar">
              <span class="analysis-meta-label">FEN Posisi Saat Ini</span>
              <code class="analysis-fen-code" data-testid="analysis-current-fen"></code>
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
    textareaEl.placeholder = SAMPLE_PGN_PLACEHOLDER;
    textareaEl.value = state.rawPgnText || '';
  }

  // Isi pesan error bila ada (menggunakan textContent agar 100% aman dari XSS)
  if (state.validationError) {
    const errTitleEl = container.querySelector('[data-testid="pgn-error-title"]');
    const errMsgEl = container.querySelector('[data-testid="pgn-error-message"]');
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
    _populateGamePreviewDom(container, state);
  }

  _bindAnalysisViewEvents(container, state, callbacks);
}

/**
 * Mengisi informasi metadata (Desktop & Mobile), papan interaktif, dan daftar langkah menggunakan textContent
 * agar sepenuhnya terlindung dari injeksi HTML/JS dari header atau komentar PGN.
 */
function _populateGamePreviewDom(container, state) {
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

  // 1) Render daftar pasangan langkah Desktop (White & Black) menggunakan pembuatan node DOM murni
  const moveListEl = container.querySelector('[data-testid="analysis-move-list"]');
  const pairs = Array.isArray(game.movePairs) ? game.movePairs : [];

  if (moveListEl) {
    moveListEl.innerHTML = '';

    const startRowBtn = document.createElement('button');
    startRowBtn.type = 'button';
    startRowBtn.className = `analysis-start-ply-btn ${state.currentPly === 0 ? 'active' : ''}`;
    startRowBtn.setAttribute('data-ply', '0');
    startRowBtn.setAttribute('data-testid', 'analysis-move-ply-0');
    startRowBtn.textContent = '0. Posisi Awal Partai';
    moveListEl.appendChild(startRowBtn);

    if (pairs.length === 0) {
      const emptyNote = document.createElement('p');
      emptyNote.className = 'analysis-empty-moves-note';
      emptyNote.textContent = 'Partai ini tidak memiliki langkah (hanya posisi FEN awal).';
      moveListEl.appendChild(emptyNote);
    } else {
      pairs.forEach(pair => {
        const rowEl = document.createElement('div');
        rowEl.className = 'analysis-move-row';
        rowEl.setAttribute('data-move-number', String(pair.moveNumber));

        const numSpan = document.createElement('span');
        numSpan.className = 'analysis-move-num';
        numSpan.textContent = `${pair.moveNumber}.`;
        rowEl.appendChild(numSpan);

        if (pair.white) {
          const wBtn = _createMovePlyButton(pair.white, state.currentPly === pair.white.ply);
          rowEl.appendChild(wBtn);
        } else {
          const wPlaceholder = document.createElement('span');
          wPlaceholder.className = 'analysis-move-placeholder';
          wPlaceholder.textContent = '...';
          rowEl.appendChild(wPlaceholder);
        }

        if (pair.black) {
          const bBtn = _createMovePlyButton(pair.black, state.currentPly === pair.black.ply);
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
  }

  // 2) Render Move Navigation Strip Mobile (Horizontal Scrollable SAN Strip)
  const mobileStripScrollEl = container.querySelector('[data-testid="analysis-mobile-strip-scroll"]');
  if (mobileStripScrollEl) {
    mobileStripScrollEl.innerHTML = '';

    const startPill = document.createElement('button');
    startPill.type = 'button';
    startPill.className = `analysis-mobile-san-pill ${state.currentPly === 0 ? 'active' : ''}`;
    startPill.setAttribute('data-mobile-ply', '0');
    startPill.setAttribute('data-testid', 'analysis-mobile-ply-0');
    startPill.textContent = 'Awal';
    mobileStripScrollEl.appendChild(startPill);

    pairs.forEach(pair => {
      const pairGroup = document.createElement('div');
      pairGroup.className = 'analysis-mobile-san-pair';

      const numTag = document.createElement('span');
      numTag.className = 'analysis-mobile-san-num';
      numTag.textContent = `${pair.moveNumber}.`;
      pairGroup.appendChild(numTag);

      if (pair.white) {
        pairGroup.appendChild(
          _createMobileSanPillButton(pair.white, state.currentPly === pair.white.ply)
        );
      }
      if (pair.black) {
        pairGroup.appendChild(
          _createMobileSanPillButton(pair.black, state.currentPly === pair.black.ply)
        );
      }

      mobileStripScrollEl.appendChild(pairGroup);
    });
  }

  // 3) Mount AnalysisReplayBoard
  const boardMount = container.querySelector('#analysis-replay-board-mount');
  if (boardMount) {
    activeReplayBoardInstance = new AnalysisReplayBoard(boardMount, game, {
      initialPly: state.currentPly,
      orientation: state.orientation,
      onPlyChange: replayState => {
        state.currentPly = replayState.currentPly;
        state.orientation = replayState.orientation;
        _syncReplayStatusDom(container, state, replayState);
      }
    });

    _syncReplayStatusDom(container, state, activeReplayBoardInstance.getReplayState());
  }
}

function _createMovePlyButton(moveObj, isActive) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `analysis-ply-btn ${isActive ? 'active' : ''}`;
  btn.setAttribute('data-ply', String(moveObj.ply));
  btn.setAttribute('data-san', String(moveObj.san));
  btn.setAttribute('data-testid', `analysis-move-ply-${moveObj.ply}`);

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

function _createMobileSanPillButton(moveObj, isActive) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `analysis-mobile-san-pill ${isActive ? 'active' : ''}`;
  btn.setAttribute('data-mobile-ply', String(moveObj.ply));
  btn.setAttribute('data-san', String(moveObj.san));
  btn.setAttribute('data-testid', `analysis-mobile-ply-${moveObj.ply}`);

  const nagSymbols = Array.isArray(moveObj.nags)
    ? moveObj.nags.map(n => n.symbol).filter(Boolean).join('')
    : '';
  btn.textContent = `${moveObj.san}${nagSymbols}`;
  return btn;
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

  // Update ply badge & subtitle
  const plyBadgeEl = container.querySelector('[data-testid="analysis-ply-badge"]');
  if (plyBadgeEl) {
    plyBadgeEl.textContent = `Ply ${replayState.currentPly} / ${replayState.totalPlies}`;
  }

  const stepSubtitleEl = container.querySelector('[data-testid="analysis-step-counter-subtitle"]');
  if (stepSubtitleEl) {
    if (replayState.currentPly === 0) {
      stepSubtitleEl.textContent = `Posisi Awal (Langkah 0 dari ${game.totalMoves})`;
    } else if (replayState.activeMove) {
      const sideText = replayState.activeMove.color === 'w' ? 'Putih' : 'Hitam';
      stepSubtitleEl.textContent = `Langkah ${replayState.activeMove.moveNumber} dari ${game.totalMoves} • ${sideText}: ${replayState.activeMove.san}`;
    }
  }

  // Update current FEN bar
  const currentFenEl = container.querySelector('[data-testid="analysis-current-fen"]');
  if (currentFenEl) {
    currentFenEl.textContent = replayState.currentFen;
  }

  // Update active highlight pada daftar langkah SAN (Desktop)
  const moveListEl = container.querySelector('[data-testid="analysis-move-list"]');
  if (moveListEl) {
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

  // Update active highlight & auto-scroll pada Move Navigation Strip (Mobile)
  const mobileStripScrollEl = container.querySelector('[data-testid="analysis-mobile-strip-scroll"]');
  if (mobileStripScrollEl) {
    const allMobilePills = mobileStripScrollEl.querySelectorAll('[data-mobile-ply]');
    let activePillEl = null;
    allMobilePills.forEach(pill => {
      const pillPly = Number(pill.getAttribute('data-mobile-ply'));
      if (pillPly === replayState.currentPly) {
        pill.classList.add('active');
        pill.setAttribute('aria-current', 'step');
        activePillEl = pill;
      } else {
        pill.classList.remove('active');
        pill.removeAttribute('aria-current');
      }
    });

    if (activePillEl && typeof activePillEl.scrollIntoView === 'function') {
      try {
        activePillEl.scrollIntoView({ block: 'nearest', inline: 'center' });
      } catch {
        // Abaikan jika environment headless/mock tidak mendukung opsi scrollIntoView
      }
    }
  }

  // Update disabled state untuk tombol di Mobile Move Strip & Mobile Bottom Toolbar
  const isAtStart = replayState.currentPly <= 0;
  const isAtEnd = replayState.currentPly >= replayState.totalPlies;

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
    state.currentPly = 0;
    state.mobileScreen = 'import';
    if (typeof callbacks.onMobileScreenChange === 'function') {
      callbacks.onMobileScreenChange('import');
    }
    renderAnalysisView(container, state, callbacks);
    return false;
  }

  state.validationError = null;
  state.parsedGame = validationResult;
  if (typeof rawText === 'string') {
    state.rawPgnText = rawText;
    state.lastValidatedRawPgn = rawText;
  }
  state.currentPly = 0;
  state.orientation = 'white';
  state.mobileScreen = 'review';
  state.showInputPanelInPreview = false;
  state.copyStatusMessage = '';

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
    state.mobileScreen = 'import';
    renderAnalysisView(container, state, callbacks);
    return false;
  }
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
      }
    });
  }

  // Dismiss error alert
  const dismissErrBtn = container.querySelector('[data-action="analysis-dismiss-error"]');
  if (dismissErrBtn) {
    dismissErrBtn.addEventListener('click', () => {
      state.validationError = null;
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
      state.currentPly = 0;
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
      state.currentPly = 0;
      state.orientation = 'white';
      state.mobileScreen = 'import';
      state.showInputPanelInPreview = false;
      state.copyStatusMessage = '';
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
}

export default renderAnalysisView;
