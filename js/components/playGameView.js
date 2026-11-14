/**
 * Komponen Halaman Permainan Melawan Komputer (Play Game Interface View — MVP 3 Bagian 6, 7, 8)
 * Menampilkan:
 * 1. Area Utama:
 *    - Papan catur interaktif 8×8 (ComputerChessboard) dengan koordinat, bidak, highlight langkah terakhir,
 *      highlight langkah legal, highlight raja skak, dan dialog promosi pion.
 * 2. Panel Informasi:
 *    - Identitas pemain & identitas komputer (Stockfish 19 Lite)
 *    - Warna bidak masing-masing (menampilkan hasil warna aktual termasuk bila memilih Acak)
 *    - Tingkat kesulitan (Pemula / Menengah / Lanjutan — terkunci selama permainan berlangsung)
 *    - Status permainan & indikator visual ketika komputer sedang berpikir
 * 3. Bidak yang Tertangkap:
 *    - Menampilkan bidak yang sudah ditangkap masing-masing pihak (Putih & Hitam) beserta keunggulan materi
 * 4. Riwayat Langkah:
 *    - Nomor langkah, notasi SAN standar, terpisah kolom Putih dan Hitam, scroll otomatis ke langkah terbaru
 * 5. Tombol Kontrol:
 *    - Permainan Baru (dengan dialog pengaturan & konfirmasi apabila permainan sedang berlangsung)
 *    - Menyerah (dengan dialog konfirmasi sebelum mengakhiri permainan)
 *    - Balik Papan
 * 6. Dialog Hasil Akhir Permainan:
 *    - Muncul otomatis saat permainan berakhir (Skakmat, Stalemate, Repetisi 3x, 50 Langkah, Materi Tidak Cukup, Menyerah)
 *    - Tombol: "Main Lagi" dan "Kembali ke Dashboard Bermain"
 */

import { ComputerChessboard } from './chessboardUI.js';
import { UI_ICONS, getPieceSvg } from './icons.js';
import {
  stockfishEngine,
  PLAY_DIFFICULTIES,
  getPlayDifficultyById
} from '../services/stockfishEngine.js';
import {
   formatPlayResultLabel,
  formatPlayTerminationLabel
} from '../services/progress.js';
import { COLOR_CHOICES } from './playView.js';
import { generatePgnFromGame, validateAndParsePgn } from '../services/pgnService.js';

let activePlayBoardInstance = null;

export function getActivePlayBoard() {
  return activePlayBoardInstance;
}

export function destroyActivePlayBoard({ terminateEngine = false } = {}) {
  if (activePlayBoardInstance) {
    activePlayBoardInstance.destroy();
    activePlayBoardInstance = null;
  }
  if (terminateEngine) {
    stockfishEngine.terminate();
  }
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderCapturedPiecesGroup(pieceTypes = [], capturedPieceColor = 'b', advantage = 0) {
  if (!Array.isArray(pieceTypes) || pieceTypes.length === 0) {
    return `<span class="captured-empty-text">Belum ada bidak ditangkap</span>`;
  }

  const iconsHtml = pieceTypes
    .map(
      type =>
        `<span class="captured-piece-icon" title="Bidak ${type.toUpperCase()}">${getPieceSvg(
          capturedPieceColor,
          type
        )}</span>`
    )
    .join('');

  const advBadge =
    advantage > 0
      ? `<span class="badge badge-accent captured-adv-badge">+${advantage}</span>`
      : '';

  return `<div class="captured-pieces-icons">${iconsHtml}${advBadge}</div>`;
}

export function renderPlayGameView(
  container,
  {
    settings = { colorPreference: 'white', difficulty: 'beginner' },
    userEmail = null,
    engine = stockfishEngine,
    initialFen = undefined,
    onBackToPlayDashboard,
    onUpdateSettings,
    onGameStarted,
    onGameEnd,
    onAnalyzeGame
  } = {}
) {
  if (!container) return null;

  destroyActivePlayBoard({ terminateEngine: false });

  let currentSettings = {
    colorPreference: ['white', 'black', 'random'].includes(settings?.colorPreference)
      ? settings.colorPreference
      : 'white',
    difficulty: settings?.difficulty || 'beginner'
  };

  let pendingNewGameSettings = { ...currentSettings };
  let activeConfirmModal = null; // null | 'resign' | 'new-game'

  const playerDisplayName = userEmail ? userEmail.split('@')[0] : 'Pemain Caturan';
  const difficultyConfig = getPlayDifficultyById(currentSettings.difficulty);

  container.innerHTML = `
    <div class="lesson-detail-page play-game-page">
      <!-- Topbar Navigasi Permainan -->
      <div class="lesson-topbar play-game-topbar">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          data-action="back-play-dashboard"
          data-testid="back-to-play-dashboard-btn"
        >
          ${UI_ICONS.arrowLeft}
          <span>Kembali ke Dashboard Bermain</span>
        </button>

        <div class="lesson-topbar-meta">
          <span class="badge badge-accent">Standard Chess</span>
          <span class="badge badge-neutral" data-testid="play-header-difficulty-badge">
            Level: ${escapeHtml(difficultyConfig.title)} (${escapeHtml(difficultyConfig.badgeLabel)})
          </span>
          <span class="badge badge-neutral" data-testid="play-header-color-badge">
            Bidak Anda: Memuat...
          </span>
          <span class="badge badge-in-progress" data-testid="play-header-status-badge">
            Sedang Berlangsung
          </span>
        </div>
      </div>

      <!-- Workspace 2 Kolom (Desktop) & Tata Letak Ergonomis (Mobile):
           Pada Mobile (<= 860px):
           1. Header Permainan (.play-game-topbar)
           2. Panel Lawan Stockfish (.play-mobile-opponent-bar)
           3. Riwayat Langkah Ringkas (.play-mobile-moves-strip)
           4. Papan Catur Besar 1:1 di Tengah (#play-chessboard-mount)
           5. Panel Pemain (.play-mobile-player-bar)
           6. Toolbar Kontrol Bawah & Hasil Akhir -->
      <div class="puzzle-workspace-grid play-workspace-grid">
        <!-- Kolom Kiri: Area Utama Papan Catur Interaktif 8x8 + Bar Lawan/Pemain khusus Mobile -->
        <section class="card puzzle-board-card play-board-card" aria-label="Papan Catur Melawan Komputer">
          <!-- Bar Lawan (Stockfish) — Tampil di atas papan pada layar Mobile/Tablet -->
          <div class="play-mobile-opponent-bar" data-testid="play-mobile-opponent-bar">
            <div class="play-mobile-combatant-main">
              <div class="combatant-avatar combatant-cpu">${UI_ICONS.cpu}</div>
              <div class="combatant-details">
                <div class="combatant-name-line">
                  <strong class="combatant-name">Stockfish 19 Lite</strong>
                  <span class="badge badge-neutral" data-testid="play-mobile-cpu-diff">
                    ${escapeHtml(difficultyConfig.title)}
                  </span>
                  <span
                    id="play-mobile-thinking-pill"
                    class="play-thinking-pill play-mobile-thinking-pill is-hidden"
                    aria-hidden="true"
                  >
                    <span class="thinking-spinner"></span>
                    <span>Berpikir...</span>
                  </span>
                </div>
                <div class="play-mobile-captured-line">
                  <span class="combatant-sub" data-testid="play-mobile-cpu-color">Bidak Hitam</span>
                </div>
                <div class="play-mobile-material-row" data-testid="play-mobile-opponent-material-row">
                  <span class="meta-dot">•</span>
                  <div id="play-mobile-cpu-captured" class="play-mobile-captured-inline"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Strip Riwayat Langkah Horizontal Ringkas — Tampil di atas papan pada Mobile -->
          <div
            id="play-mobile-moves-strip"
            class="play-mobile-moves-strip"
            data-testid="play-mobile-moves-strip"
            aria-label="Riwayat Langkah Ringkas"
          >
            <span class="play-mobile-moves-empty">Belum ada langkah dimainkan</span>
          </div>

          <!-- Papan Catur Interaktif 8x8 -->
          <div id="play-chessboard-mount" class="chessboard-mount-container"></div>

          <!-- Bar Pemain — Tampil tepat di bawah papan pada layar Mobile/Tablet -->
          <div class="play-mobile-player-bar" data-testid="play-mobile-player-bar">
            <div class="play-mobile-combatant-main">
              <div class="combatant-avatar combatant-user">${UI_ICONS.user}</div>
              <div class="combatant-details">
                <div class="combatant-name-line">
                  <strong class="combatant-name">${escapeHtml(playerDisplayName)} (Anda)</strong>
                  <span class="badge badge-accent" data-testid="play-mobile-player-color">
                    Putih
                  </span>
                </div>
                <div class="play-mobile-captured-line">
                  <span class="combatant-sub" data-testid="play-mobile-turn-status">Menyiapkan permainan...</span>
                </div>
                <div class="play-mobile-material-row" data-testid="play-mobile-player-material-row">
                  <span class="meta-dot">•</span>
                  <div id="play-mobile-player-captured" class="play-mobile-captured-inline"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Kolom Kanan: Panel Informasi, Bidak Tertangkap, Riwayat Langkah, Kontrol & Hasil Akhir -->
        <aside class="puzzle-side-column play-side-column" aria-label="Panel Informasi dan Kontrol Permainan">
          <!-- 1. Panel Informasi Pemain, Komputer, Status & Indikator Berpikir -->
          <article class="card puzzle-info-card play-info-card" data-testid="play-info-panel">
            <div class="play-info-header-row">
              <div>
                <div class="card-section-tag">PERTANDINGAN MELAWAN KOMPUTER</div>
                <h1 class="puzzle-play-title play-match-title">Anda vs Stockfish 19</h1>
              </div>
              <div
                id="play-thinking-indicator"
                class="play-thinking-pill is-hidden"
                data-testid="play-thinking-indicator"
                role="status"
                aria-live="polite"
              >
                <span class="thinking-spinner" aria-hidden="true"></span>
                <span>Komputer sedang berpikir...</span>
              </div>
            </div>

            <!-- Kartu Identitas Komputer & Pemain -->
            <div class="play-combatants-box">
              <!-- Baris Komputer -->
              <div class="play-combatant-row" data-testid="play-computer-identity">
                <div class="combatant-avatar combatant-cpu">
                  ${UI_ICONS.cpu}
                </div>
                <div class="combatant-details">
                  <div class="combatant-name-line">
                    <strong class="combatant-name">Komputer (Stockfish 19 Lite)</strong>
                    <span class="badge badge-neutral" data-testid="play-computer-difficulty-label">
                      ${escapeHtml(difficultyConfig.title)}
                    </span>
                  </div>
                  <span class="combatant-sub" data-testid="play-computer-color-label">
                    Memegang bidak Hitam
                  </span>
                </div>
              </div>

              <!-- Baris Pemain -->
              <div class="play-combatant-row" data-testid="play-player-identity">
                <div class="combatant-avatar combatant-user">
                  ${UI_ICONS.user}
                </div>
                <div class="combatant-details">
                  <div class="combatant-name-line">
                    <strong class="combatant-name">${escapeHtml(playerDisplayName)} (Anda)</strong>
                    <span class="badge badge-accent" data-testid="play-player-color-badge">
                      Putih
                    </span>
                  </div>
                  <span class="combatant-sub" data-testid="play-player-color-label">
                    Memegang bidak Putih
                  </span>
                </div>
              </div>
            </div>

            <!-- Ringkasan Status Permainan -->
            <div class="puzzle-meta-table play-status-meta-table">
              <div class="puzzle-meta-row">
                <span class="meta-row-label">Status Permainan</span>
                <strong class="meta-row-value" data-testid="play-game-status-text">
                  Menyiapkan permainan...
                </strong>
              </div>
              <div class="puzzle-meta-row">
                <span class="meta-row-label">Tingkat Kesulitan</span>
                <strong class="meta-row-value" data-testid="play-game-difficulty-text">
                  ${escapeHtml(difficultyConfig.title)} (Terkunci selama partai berlangsung)
                </strong>
              </div>
            </div>

            <!-- Slot Tombol Coba Ulang apabila Engine Timeout/Error -->
            <div id="play-engine-retry-slot" class="is-hidden"></div>
          </article>

          <!-- 2. Panel Bidak yang Tertangkap -->
          <article class="card play-captured-card" aria-label="Bidak yang Tertangkap" data-testid="play-captured-panel">
            <h2 class="play-panel-section-title">Bidak yang Tertangkap</h2>
            <div class="play-captured-rows">
              <div class="play-captured-row">
                <span class="captured-side-label" data-testid="captured-by-white-label">Ditangkap Putih:</span>
                <div id="play-captured-by-white" data-testid="play-captured-by-white">
                  <span class="captured-empty-text">Belum ada bidak ditangkap</span>
                </div>
              </div>
              <div class="play-captured-row">
                <span class="captured-side-label" data-testid="captured-by-black-label">Ditangkap Hitam:</span>
                <div id="play-captured-by-black" data-testid="play-captured-by-black">
                  <span class="captured-empty-text">Belum ada bidak ditangkap</span>
                </div>
              </div>
            </div>
          </article>

          <!-- 3. Panel Riwayat Langkah (SAN, Nomor Langkah, Kolom Putih & Hitam, Auto-Scroll) -->
          <article class="card play-history-card" aria-label="Riwayat Langkah" data-testid="play-move-history-panel">
            <div class="play-history-header">
              <h2 class="play-panel-section-title">Riwayat Langkah (SAN)</h2>
              <span class="badge badge-neutral" data-testid="play-move-count-badge">0 Langkah</span>
            </div>
            <div
              id="play-move-history-scroll"
              class="play-move-history-scroll"
              data-testid="play-move-history-scroll"
            >
              <div class="play-history-empty" data-testid="play-move-history-empty">
                Belum ada langkah yang dimainkan pada pertandingan ini.
              </div>
            </div>
          </article>

          <!-- 4. Tombol Kontrol Permainan (Permainan Baru, Klaim Remis, Menyerah, Balik Papan) -->
          <article class="card play-controls-card" aria-label="Kontrol Permainan">
            <!-- Banner Klaim Remis (muncul ketika kondisi Pengulangan Tiga Kali atau Aturan 50 Langkah terpenuhi) -->
            <div id="play-claim-draw-slot" class="is-hidden" data-testid="play-claim-draw-slot"></div>

            <div class="play-controls-row">
              <button
                type="button"
                class="btn btn-primary btn-sm"
                data-action="new-game"
                data-testid="play-new-game-btn"
              >
                ${UI_ICONS.restart}
                <span>Permainan Baru</span>
              </button>

              <button
                type="button"
                class="btn btn-secondary btn-sm play-claim-draw-btn"
                data-action="claim-draw"
                data-testid="play-claim-draw-btn"
                disabled
              >
                ${UI_ICONS.checkCircle}
                <span>Klaim Remis</span>
              </button>

              <button
                type="button"
                class="btn btn-secondary btn-sm play-resign-btn"
                data-action="resign-game"
                data-testid="play-resign-btn"
              >
                ${UI_ICONS.flag}
                <span>Menyerah</span>
              </button>

              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-action="flip-board"
                data-testid="play-flip-btn"
              >
                ${UI_ICONS.flip}
                <span>Balik Papan</span>
              </button>
            </div>

            <!-- Slot Dialog Konfirmasi (Menyerah / Permainan Baru) -->
            <div id="play-confirm-slot"></div>
          </article>

          <!-- 5. Slot Dialog Hasil Akhir Permainan -->
          <div id="play-result-slot"></div>
        </aside>
      </div>
    </div>
  `;

  const boardMount = container.querySelector('#play-chessboard-mount');
  const headerDiffBadge = container.querySelector('[data-testid="play-header-difficulty-badge"]');
  const headerColorBadge = container.querySelector('[data-testid="play-header-color-badge"]');
  const headerStatusBadge = container.querySelector('[data-testid="play-header-status-badge"]');
  const thinkingIndicator = container.querySelector('#play-thinking-indicator');
  const computerDiffLabel = container.querySelector('[data-testid="play-computer-difficulty-label"]');
  const computerColorLabel = container.querySelector('[data-testid="play-computer-color-label"]');
  const playerColorBadge = container.querySelector('[data-testid="play-player-color-badge"]');
  const playerColorLabel = container.querySelector('[data-testid="play-player-color-label"]');
  const gameStatusText = container.querySelector('[data-testid="play-game-status-text"]');
  const gameDifficultyText = container.querySelector('[data-testid="play-game-difficulty-text"]');
  const engineRetrySlot = container.querySelector('#play-engine-retry-slot');
  const capturedByWhiteEl = container.querySelector('#play-captured-by-white');
  const capturedByBlackEl = container.querySelector('#play-captured-by-black');
  const moveCountBadge = container.querySelector('[data-testid="play-move-count-badge"]');
  const moveHistoryScroll = container.querySelector('#play-move-history-scroll');
  const claimDrawSlot = container.querySelector('#play-claim-draw-slot');
  const claimDrawBtn = container.querySelector('[data-testid="play-claim-draw-btn"]');
  const resignBtn = container.querySelector('[data-testid="play-resign-btn"]');
  const confirmSlot = container.querySelector('#play-confirm-slot');
  const resultSlot = container.querySelector('#play-result-slot');

  // Referensi elemen khusus tata letak ergonomis Mobile
  const mobileCpuDiffEl = container.querySelector('[data-testid="play-mobile-cpu-diff"]');
  const mobileThinkingPill = container.querySelector('#play-mobile-thinking-pill');
  const mobileCpuColorEl = container.querySelector('[data-testid="play-mobile-cpu-color"]');
  const mobileCpuCapturedEl = container.querySelector('#play-mobile-cpu-captured');
  const mobileMovesStripEl = container.querySelector('#play-mobile-moves-strip');
  const mobilePlayerColorEl = container.querySelector('[data-testid="play-mobile-player-color"]');
  const mobileTurnStatusEl = container.querySelector('[data-testid="play-mobile-turn-status"]');
  const mobilePlayerCapturedEl = container.querySelector('#play-mobile-player-captured');

  function renderConfirmModal() {
    if (!confirmSlot) return;

    if (!activeConfirmModal) {
      confirmSlot.innerHTML = '';
      return;
    }

    if (activeConfirmModal === 'resign') {
      confirmSlot.innerHTML = `
        <div class="play-confirm-box" role="alertdialog" aria-labelledby="resign-confirm-title" data-testid="play-resign-confirm-dialog">
          <h3 id="resign-confirm-title" class="play-confirm-title">Konfirmasi Menyerah</h3>
          <p class="play-confirm-desc">
            Apakah Anda yakin ingin menyerah? Pertandingan ini akan dicatat sebagai kekalahan melawan komputer.
          </p>
          <div class="play-confirm-actions">
            <button
              type="button"
              class="btn btn-primary btn-sm play-danger-confirm-btn"
              data-action="confirm-resign"
              data-testid="confirm-resign-btn"
            >
              Ya, Menyerah
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              data-action="cancel-confirm"
              data-testid="cancel-resign-btn"
            >
              Batal
            </button>
          </div>
        </div>
      `;

      const confirmResignBtn = confirmSlot.querySelector('[data-action="confirm-resign"]');
      if (confirmResignBtn) {
        confirmResignBtn.addEventListener('click', async () => {
          activeConfirmModal = null;
          renderConfirmModal();
          if (activePlayBoardInstance) {
            await activePlayBoardInstance.resign();
          }
        });
      }

      const cancelBtn = confirmSlot.querySelector('[data-action="cancel-confirm"]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          activeConfirmModal = null;
          renderConfirmModal();
        });
      }
      return;
    }

    if (activeConfirmModal === 'new-game') {
      const snap = activePlayBoardInstance ? activePlayBoardInstance.getGameStateSnapshot() : null;
      const isOngoing = Boolean(snap && !snap.isGameOver);

      const colorButtonsHtml = COLOR_CHOICES.map(c => {
        const isSel = c.id === pendingNewGameSettings.colorPreference;
        return `
          <button
            type="button"
            class="btn ${isSel ? 'btn-primary' : 'btn-secondary'} btn-sm"
            data-modal-color="${c.id}"
            data-testid="modal-select-color-${c.id}"
          >
            ${escapeHtml(c.label)}
          </button>
        `;
      }).join('');

      const diffButtonsHtml = PLAY_DIFFICULTIES.map(d => {
        const isSel = d.id === pendingNewGameSettings.difficulty;
        return `
          <button
            type="button"
            class="btn ${isSel ? 'btn-primary' : 'btn-secondary'} btn-sm"
            data-modal-difficulty="${d.id}"
            data-testid="modal-select-difficulty-${d.id}"
          >
            ${escapeHtml(d.title)}
          </button>
        `;
      }).join('');

      confirmSlot.innerHTML = `
        <div class="play-confirm-box" role="dialog" aria-labelledby="newgame-confirm-title" data-testid="play-new-game-dialog">
          <h3 id="newgame-confirm-title" class="play-confirm-title">Konfigurasi Permainan Baru</h3>
          <p class="play-confirm-desc">
            ${
              isOngoing
                ? 'Permainan sedang berlangsung. Memulai permainan baru akan menghentikan pencarian engine saat ini dan mereset papan ke posisi awal.'
                : 'Pilih warna bidak dan tingkat kesulitan untuk memulai permainan baru.'
            }
          </p>

          <div class="play-modal-field">
            <span class="play-modal-label">Warna Bidak:</span>
            <div class="play-modal-btn-group">${colorButtonsHtml}</div>
          </div>

          <div class="play-modal-field">
            <span class="play-modal-label">Tingkat Kesulitan:</span>
            <div class="play-modal-btn-group">${diffButtonsHtml}</div>
          </div>

          <div class="play-confirm-actions">
            <button
              type="button"
              class="btn btn-primary btn-sm"
              data-action="confirm-start-new-game"
              data-testid="confirm-new-game-btn"
            >
              Mulai Permainan Baru
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              data-action="cancel-confirm"
              data-testid="cancel-new-game-btn"
            >
              Batal
            </button>
          </div>
        </div>
      `;

      confirmSlot.querySelectorAll('[data-modal-color]').forEach(btn => {
        btn.addEventListener('click', () => {
          pendingNewGameSettings.colorPreference = btn.getAttribute('data-modal-color') || 'white';
          renderConfirmModal();
        });
      });

      confirmSlot.querySelectorAll('[data-modal-difficulty]').forEach(btn => {
        btn.addEventListener('click', () => {
          pendingNewGameSettings.difficulty =
            btn.getAttribute('data-modal-difficulty') || 'beginner';
          renderConfirmModal();
        });
      });

      const confirmNewBtn = confirmSlot.querySelector('[data-action="confirm-start-new-game"]');
      if (confirmNewBtn) {
        confirmNewBtn.addEventListener('click', async () => {
          currentSettings = { ...pendingNewGameSettings };
          activeConfirmModal = null;
          renderConfirmModal();
          if (typeof onUpdateSettings === 'function') {
            onUpdateSettings({ ...currentSettings });
          }
          if (activePlayBoardInstance) {
            await activePlayBoardInstance.startNewGame({
              colorPreference: currentSettings.colorPreference,
              difficulty: currentSettings.difficulty
            });
            if (typeof onGameStarted === 'function') {
              onGameStarted(activePlayBoardInstance.getGameStateSnapshot());
            }
          }
        });
      }

      const cancelBtn = confirmSlot.querySelector('[data-action="cancel-confirm"]');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          activeConfirmModal = null;
          renderConfirmModal();
        });
      }
    }
  }

  function renderResultDialog(gameResult) {
    if (!resultSlot) return;

    if (!gameResult) {
      resultSlot.innerHTML = '';
      return;
    }

    const resultLabel = formatPlayResultLabel(gameResult.result);
    const terminationLabel = formatPlayTerminationLabel(gameResult.termination);
    const diffObj = getPlayDifficultyById(gameResult.difficulty);
    const playerSideLabel = gameResult.playerColor === 'black' ? 'Hitam' : 'Putih';

    const bannerClass =
      gameResult.result === 'win'
        ? 'result-win'
        : gameResult.result === 'loss'
        ? 'result-loss'
        : 'result-draw';

    resultSlot.innerHTML = `
      <div class="card play-result-card ${bannerClass}" role="dialog" aria-labelledby="play-result-heading" data-testid="play-result-dialog">
        <div class="puzzle-completion-header">
          <div class="completion-check-icon">
            ${
              gameResult.result === 'win'
                ? UI_ICONS.trophy
                : gameResult.result === 'loss'
                ? UI_ICONS.flag
                : UI_ICONS.checkCircle
            }
          </div>
          <div>
            <span class="completion-eyebrow">HASIL AKHIR PERTANDINGAN</span>
            <h3 id="play-result-heading" class="completion-title" data-testid="play-result-title">
              ${escapeHtml(gameResult.title || `Permainan Selesai: ${resultLabel}`)}
            </h3>
            <p class="play-result-subtitle" data-testid="play-result-description">
              ${escapeHtml(gameResult.description || '')}
            </p>
          </div>
        </div>

        <div class="puzzle-completion-details">
          <div class="completion-detail-row">
            <span class="detail-label">Status Hasil</span>
            <strong class="detail-value" data-testid="play-result-outcome">${escapeHtml(resultLabel)}</strong>
          </div>
          <div class="completion-detail-row">
            <span class="detail-label">Alasan Berakhir</span>
            <strong class="detail-value" data-testid="play-result-termination">${escapeHtml(terminationLabel)}</strong>
          </div>
          <div class="completion-detail-row">
            <span class="detail-label">Bidak Anda</span>
            <strong class="detail-value">${escapeHtml(playerSideLabel)}</strong>
          </div>
          <div class="completion-detail-row">
            <span class="detail-label">Tingkat Kesulitan</span>
            <strong class="detail-value">${escapeHtml(diffObj.title)}</strong>
          </div>
          <div class="completion-detail-row">
            <span class="detail-label">Total Langkah</span>
            <strong class="detail-value">${gameResult.totalMoves || 0} Langkah</strong>
          </div>
        </div>

        <div class="puzzle-completion-actions play-game-over-actions">
          <button
            type="button"
            class="btn btn-primary"
            data-action="analyze-game"
            data-testid="play-analyze-game-btn"
          >
            ${UI_ICONS.activity || UI_ICONS.chart || UI_ICONS.analysis}
            <span>Analisis Permainan</span>
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            data-action="copy-game-pgn"
            data-testid="play-copy-pgn-btn"
          >
            ${UI_ICONS.copy}
            <span data-testid="play-copy-pgn-label">Salin PGN</span>
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            data-action="play-again"
            data-testid="play-again-btn"
          >
            ${UI_ICONS.restart}
            <span>Main Lagi</span>
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            data-action="result-back-dashboard"
            data-testid="result-back-dashboard-btn"
          >
            ${UI_ICONS.arrowLeft}
            <span>Kembali ke Dashboard Bermain</span>
          </button>
        </div>
      </div>
    `;

    const analyzeGameBtn = resultSlot.querySelector('[data-action="analyze-game"]');
    if (analyzeGameBtn) {
      analyzeGameBtn.addEventListener('click', () => {
        if (!activePlayBoardInstance || !activePlayBoardInstance.chess) return;
        const generatedPgn = generatePgnFromGame(activePlayBoardInstance.chess, {
          gameResult,
          playerColor: gameResult.playerColor || currentSettings.colorPreference || 'white',
          difficulty: gameResult.difficulty || currentSettings.difficulty || 'beginner'
        });
        const parseResult = validateAndParsePgn(generatedPgn);
        const isOk = Boolean(parseResult && (parseResult.ok || parseResult.valid || parseResult.isValid));
        const parsedGame = parseResult ? (parseResult.data || parseResult.game || parseResult) : null;
        if (isOk && parsedGame && typeof onAnalyzeGame === 'function') {
          onAnalyzeGame({
            pgnText: generatedPgn,
            parsedGame,
            initialFen: parsedGame.initialFen || null,
            gameResult
          });
        } else {
          console.error('[PlayGameView] PGN validation failed for generated game:', parseResult);
        }
      });
    }

    const copyPgnBtn = resultSlot.querySelector('[data-action="copy-game-pgn"]');
    const copyPgnLabel = resultSlot.querySelector('[data-testid="play-copy-pgn-label"]');
    if (copyPgnBtn) {
      copyPgnBtn.addEventListener('click', async () => {
        if (!activePlayBoardInstance || !activePlayBoardInstance.chess) return;
        const generatedPgn = generatePgnFromGame(activePlayBoardInstance.chess, {
          gameResult,
          playerColor: gameResult.playerColor || currentSettings.colorPreference || 'white',
          difficulty: gameResult.difficulty || currentSettings.difficulty || 'beginner'
        });

        try {
          if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            await navigator.clipboard.writeText(generatedPgn);
          } else {
            const tempArea = document.createElement('textarea');
            tempArea.value = generatedPgn;
            tempArea.style.position = 'fixed';
            tempArea.style.opacity = '0';
            document.body.appendChild(tempArea);
            tempArea.select();
            document.execCommand('copy');
            document.body.removeChild(tempArea);
          }
          if (copyPgnLabel) {
            const originalText = copyPgnLabel.textContent;
            copyPgnLabel.textContent = 'Tersalin!';
            setTimeout(() => {
              copyPgnLabel.textContent = originalText;
            }, 2000);
          }
        } catch (err) {
          console.warn('[PlayGameView] Failed to copy PGN to clipboard:', err);
        }
      });
    }

    const playAgainBtn = resultSlot.querySelector('[data-action="play-again"]');
    if (playAgainBtn) {
      playAgainBtn.addEventListener('click', async () => {
        activeConfirmModal = null;
        renderConfirmModal();
        if (activePlayBoardInstance) {
          await activePlayBoardInstance.startNewGame({
            colorPreference: currentSettings.colorPreference,
            difficulty: currentSettings.difficulty
          });
          if (typeof onGameStarted === 'function') {
            onGameStarted(activePlayBoardInstance.getGameStateSnapshot());
          }
        }
      });
    }

    const backDashBtn = resultSlot.querySelector('[data-action="result-back-dashboard"]');
    if (backDashBtn && typeof onBackToPlayDashboard === 'function') {
      backDashBtn.addEventListener('click', () => onBackToPlayDashboard());
    }
  }

  function syncSidePanelWithSnapshot(snapshot) {
    if (!snapshot) return;

    const diffObj = getPlayDifficultyById(snapshot.difficultyId);
    const playerSideLabel = snapshot.playerColor === 'black' ? 'Hitam' : 'Putih';
    const computerSideLabel = snapshot.computerColor === 'white' ? 'Putih' : 'Hitam';
    const prefNote =
      snapshot.colorPreference === 'random' ? ' (Hasil Acak)' : '';

    if (headerDiffBadge) {
      headerDiffBadge.textContent = `Level: ${diffObj.title} (${diffObj.badgeLabel})`;
    }
    if (headerColorBadge) {
      headerColorBadge.textContent = `Bidak Anda: ${playerSideLabel}${prefNote}`;
    }
    if (headerStatusBadge) {
      if (snapshot.isGameOver && snapshot.gameResult) {
        const outLabel = formatPlayResultLabel(snapshot.gameResult.result);
        headerStatusBadge.className = `badge ${
          snapshot.gameResult.result === 'win'
            ? 'badge-success'
            : snapshot.gameResult.result === 'loss'
            ? 'badge-danger'
            : 'badge-in-progress'
        }`;
        headerStatusBadge.textContent = `Selesai (${outLabel})`;
      } else if (snapshot.inCheck) {
        headerStatusBadge.className = 'badge badge-danger';
        headerStatusBadge.textContent = 'Skak (Check)!';
      } else {
        headerStatusBadge.className = 'badge badge-in-progress';
        headerStatusBadge.textContent = 'Sedang Berlangsung';
      }
    }

    // Indikator Komputer Sedang Berpikir
    if (thinkingIndicator) {
      if (snapshot.isEngineThinking) {
        thinkingIndicator.classList.remove('is-hidden');
        thinkingIndicator.setAttribute('aria-hidden', 'false');
        thinkingIndicator.setAttribute('data-thinking', 'true');
      } else {
        thinkingIndicator.classList.add('is-hidden');
        thinkingIndicator.setAttribute('aria-hidden', 'true');
        thinkingIndicator.setAttribute('data-thinking', 'false');
      }
    }

    // Identitas Komputer & Pemain
    if (computerDiffLabel) {
      computerDiffLabel.textContent = diffObj.title;
    }
    if (computerColorLabel) {
      computerColorLabel.textContent = `Memegang bidak ${computerSideLabel}`;
    }
    if (playerColorBadge) {
      playerColorBadge.textContent = `${playerSideLabel}${prefNote}`;
    }
    if (playerColorLabel) {
      playerColorLabel.textContent = `Memegang bidak ${playerSideLabel}${prefNote}`;
    }

    // Teks Status Permainan
    if (gameStatusText) {
      if (snapshot.isGameOver && snapshot.gameResult) {
        const rLabel = formatPlayResultLabel(snapshot.gameResult.result);
        const tLabel = formatPlayTerminationLabel(snapshot.gameResult.termination);
        gameStatusText.textContent = `${rLabel} — ${tLabel}`;
      } else if (snapshot.isEngineThinking) {
        gameStatusText.textContent = 'Komputer sedang berpikir...';
      } else if (snapshot.canClaimDraw) {
        gameStatusText.textContent = `Giliran Anda (${playerSideLabel}) — Klaim Remis Tersedia (${snapshot.claimableDrawLabel || 'Remis'})`;
      } else if (snapshot.inCheck) {
        gameStatusText.textContent = snapshot.isPlayerTurn
          ? 'Giliran Anda — Raja dalam kondisi Skak!'
          : 'Giliran Komputer — Raja dalam kondisi Skak!';
      } else if (snapshot.isPlayerTurn) {
        gameStatusText.textContent = `Giliran Anda (${playerSideLabel})`;
      } else {
        gameStatusText.textContent = `Giliran Komputer (${computerSideLabel})`;
      }
    }

    if (gameDifficultyText) {
      gameDifficultyText.textContent = `${diffObj.title} (${
        snapshot.isGameOver
          ? 'Permainan selesai'
          : 'Terkunci selama permainan berlangsung'
      })`;
    }

    // Tombol Coba Ulang Langkah Komputer jika terjadi error/timeout engine
    if (engineRetrySlot) {
      if (snapshot.engineError && !snapshot.isGameOver) {
        engineRetrySlot.classList.remove('is-hidden');
        engineRetrySlot.innerHTML = `
          <div class="play-engine-error-box" data-testid="play-engine-error-box">
            <span>${escapeHtml(snapshot.engineError)}</span>
            <button type="button" class="btn btn-secondary btn-sm" data-action="retry-engine-move" data-testid="retry-engine-move-btn">
              Coba Ulang Langkah Komputer
            </button>
          </div>
        `;
        const retryEngineBtn = engineRetrySlot.querySelector('[data-action="retry-engine-move"]');
        if (retryEngineBtn && activePlayBoardInstance) {
          retryEngineBtn.addEventListener('click', () => {
            activePlayBoardInstance.retryComputerTurn();
          });
        }
      } else {
        engineRetrySlot.classList.add('is-hidden');
        engineRetrySlot.innerHTML = '';
      }
    }

    // Bidak yang tertangkap
    if (capturedByWhiteEl && snapshot.capturedInfo) {
      const capW = renderCapturedPiecesGroup(
        snapshot.capturedInfo.capturedByWhite,
        'b',
        snapshot.capturedInfo.whiteAdvantage
      );
      if (capturedByWhiteEl._lastHtml !== capW) {
        capturedByWhiteEl.innerHTML = capW;
        capturedByWhiteEl._lastHtml = capW;
      }
    }
    if (capturedByBlackEl && snapshot.capturedInfo) {
      const capB = renderCapturedPiecesGroup(
        snapshot.capturedInfo.capturedByBlack,
        'w',
        snapshot.capturedInfo.blackAdvantage
      );
      if (capturedByBlackEl._lastHtml !== capB) {
        capturedByBlackEl.innerHTML = capB;
        capturedByBlackEl._lastHtml = capB;
      }
    }

    // Riwayat Langkah SAN (Nomor Langkah, Kolom Putih, Kolom Hitam, Auto-Scroll)
    const pairs = snapshot.movePairs || [];
    if (moveCountBadge) {
      moveCountBadge.textContent = `${pairs.length} Langkah`;
    }

    if (moveHistoryScroll) {
      let nextHistoryHtml = '';
      if (pairs.length === 0) {
        nextHistoryHtml = `
          <div class="play-history-empty" data-testid="play-move-history-empty">
            Belum ada langkah yang dimainkan pada pertandingan ini.
          </div>
        `;
      } else {
        const rowsHtml = pairs
          .map((pair, idx) => {
            const isLatestRow = idx === pairs.length - 1;
            const whiteSan = pair.white ? pair.white.san : '';
            const blackSan = pair.black ? pair.black.san : '';
            const isWhiteLatest = isLatestRow && pair.white && !pair.black;
            const isBlackLatest = isLatestRow && Boolean(pair.black);

            return `
              <tr class="play-move-row ${isLatestRow ? 'is-latest-row' : ''}" data-move-number="${pair.moveNumber}">
                <td class="play-move-num">${pair.moveNumber}.</td>
                <td class="play-move-san play-move-white ${isWhiteLatest ? 'is-latest-move' : ''}" data-testid="move-white-${pair.moveNumber}">
                  ${escapeHtml(whiteSan)}
                </td>
                <td class="play-move-san play-move-black ${isBlackLatest ? 'is-latest-move' : ''}" data-testid="move-black-${pair.moveNumber}">
                  ${escapeHtml(blackSan)}
                </td>
              </tr>
            `;
          })
          .join('');

        nextHistoryHtml = `
          <table class="play-move-history-table" aria-label="Tabel Riwayat Langkah Catur" data-testid="play-move-history-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Putih</th>
                <th scope="col">Hitam</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        `;
      }

      if (moveHistoryScroll._lastHtml !== nextHistoryHtml) {
        moveHistoryScroll.innerHTML = nextHistoryHtml;
        moveHistoryScroll._lastHtml = nextHistoryHtml;
        if (pairs.length > 0) {
          // Auto-scroll internal kontainer tabel ke langkah terbaru
          moveHistoryScroll.scrollTop = moveHistoryScroll.scrollHeight;
        }
      }
    }

    // Sinkronisasi Bar Lawan, Strip Riwayat Langkah, dan Bar Pemain untuk Tata Letak Mobile
    if (mobileCpuDiffEl) {
      mobileCpuDiffEl.textContent = diffObj.title;
    }
    if (mobileThinkingPill) {
      if (snapshot.isEngineThinking) {
        mobileThinkingPill.classList.remove('is-hidden');
        mobileThinkingPill.setAttribute('aria-hidden', 'false');
        mobileThinkingPill.setAttribute('data-thinking', 'true');
      } else {
        mobileThinkingPill.classList.add('is-hidden');
        mobileThinkingPill.setAttribute('aria-hidden', 'true');
        mobileThinkingPill.setAttribute('data-thinking', 'false');
      }
    }
    if (mobileCpuColorEl) {
      mobileCpuColorEl.textContent = `Bidak ${computerSideLabel}`;
    }
    if (mobilePlayerColorEl) {
      mobilePlayerColorEl.textContent = `${playerSideLabel}${prefNote}`;
    }
    if (mobileTurnStatusEl && gameStatusText) {
      mobileTurnStatusEl.textContent = gameStatusText.textContent;
    }

    if (snapshot.capturedInfo) {
      const cpuCapturedPieces =
        snapshot.computerColor === 'white'
          ? snapshot.capturedInfo.capturedByWhite
          : snapshot.capturedInfo.capturedByBlack;
      const cpuCapturesColorChar = snapshot.computerColor === 'white' ? 'b' : 'w';
      const cpuAdvantage =
        snapshot.computerColor === 'white'
          ? snapshot.capturedInfo.whiteAdvantage
          : snapshot.capturedInfo.blackAdvantage;

      const playerCapturedPieces =
        snapshot.playerColor === 'white'
          ? snapshot.capturedInfo.capturedByWhite
          : snapshot.capturedInfo.capturedByBlack;
      const playerCapturesColorChar = snapshot.playerColor === 'white' ? 'b' : 'w';
      const playerAdvantage =
        snapshot.playerColor === 'white'
          ? snapshot.capturedInfo.whiteAdvantage
          : snapshot.capturedInfo.blackAdvantage;

      if (mobileCpuCapturedEl) {
        const cpuCapHtml = renderCapturedPiecesGroup(
          cpuCapturedPieces,
          cpuCapturesColorChar,
          cpuAdvantage
        );
        if (mobileCpuCapturedEl._lastHtml !== cpuCapHtml) {
          mobileCpuCapturedEl.innerHTML = cpuCapHtml;
          mobileCpuCapturedEl._lastHtml = cpuCapHtml;
        }
      }
      if (mobilePlayerCapturedEl) {
        const playerCapHtml = renderCapturedPiecesGroup(
          playerCapturedPieces,
          playerCapturesColorChar,
          playerAdvantage
        );
        if (mobilePlayerCapturedEl._lastHtml !== playerCapHtml) {
          mobilePlayerCapturedEl.innerHTML = playerCapHtml;
          mobilePlayerCapturedEl._lastHtml = playerCapHtml;
        }
      }
    }

    if (mobileMovesStripEl) {
      let nextStripHtml = '';
      if (pairs.length === 0) {
        nextStripHtml = `<span class="play-mobile-moves-empty">Belum ada langkah dimainkan</span>`;
      } else {
        nextStripHtml = pairs
          .map((pair, idx) => {
            const isLatestPair = idx === pairs.length - 1;
            const whiteSan = pair.white ? pair.white.san : '';
            const blackSan = pair.black ? pair.black.san : '';
            const wActive = isLatestPair && pair.white && !pair.black ? 'is-latest-move' : '';
            const bActive = isLatestPair && Boolean(pair.black) ? 'is-latest-move' : '';
            return `
              <span class="play-mobile-move-pair">
                <span class="play-mobile-move-num">${pair.moveNumber}.</span>
                ${whiteSan ? `<span class="play-mobile-move-san ${wActive}">${escapeHtml(whiteSan)}</span>` : ''}
                ${blackSan ? `<span class="play-mobile-move-san ${bActive}">${escapeHtml(blackSan)}</span>` : ''}
              </span>
            `;
          })
          .join('');
      }
      if (mobileMovesStripEl._lastHtml !== nextStripHtml) {
        mobileMovesStripEl.innerHTML = nextStripHtml;
        mobileMovesStripEl._lastHtml = nextStripHtml;
        if (pairs.length > 0) {
          mobileMovesStripEl.scrollLeft = mobileMovesStripEl.scrollWidth || 9999;
        }
      }
    }

    // Tombol Klaim Remis & Banner Klaim Remis
    const isClaimAvailable = Boolean(snapshot.canClaimDraw && !snapshot.isGameOver);
    if (claimDrawBtn) {
      claimDrawBtn.disabled = !isClaimAvailable;
      if (isClaimAvailable && snapshot.claimableDrawLabel) {
        claimDrawBtn.title = `Klaim Remis (${snapshot.claimableDrawLabel})`;
      } else {
        claimDrawBtn.title = 'Klaim Remis (aktif saat Pengulangan Tiga Kali atau Aturan 50 Langkah)';
      }
    }

    if (claimDrawSlot) {
      const claimableIntendedList = Array.isArray(snapshot.claimableIntendedMoves)
        ? snapshot.claimableIntendedMoves
        : [];

      if (isClaimAvailable) {
        const isIntendedMode =
          snapshot.claimableDrawMode === 'intended_move' && snapshot.intendedMove;
        const intendedSan = isIntendedMode ? snapshot.intendedMove.san : '';
        const descText = isIntendedMode
          ? `Langkah yang direncanakan (${escapeHtml(
              intendedSan
            )}) memenuhi syarat ${escapeHtml(
              snapshot.claimableDrawLabel || 'Remis'
            )}. Anda dapat mengklaim hasil seri sekarang tanpa mengubah posisi papan.`
          : `Posisi saat ini memenuhi syarat ${escapeHtml(
              snapshot.claimableDrawLabel || 'Remis'
            )}. Anda dapat melanjutkan permainan atau mengklaim hasil seri sekarang.`;

        claimDrawSlot.classList.remove('is-hidden');
        claimDrawSlot.innerHTML = `
          <div class="play-claim-draw-banner" role="region" aria-label="Opsi Klaim Remis" data-testid="play-claim-draw-banner">
            <div class="play-claim-draw-info">
              <strong class="play-claim-draw-title">Klaim Remis Tersedia (${escapeHtml(
                snapshot.claimableDrawLabel || 'Remis'
              )}${isIntendedMode ? ` — Langkah ${escapeHtml(intendedSan)}` : ''})</strong>
              <span class="play-claim-draw-desc">${descText}</span>
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              data-action="banner-claim-draw"
              data-testid="banner-claim-draw-btn"
            >
              Klaim Remis
            </button>
          </div>
        `;
        const bannerClaimBtn = claimDrawSlot.querySelector('[data-action="banner-claim-draw"]');
        if (bannerClaimBtn && activePlayBoardInstance) {
          bannerClaimBtn.addEventListener('click', async () => {
            activeConfirmModal = null;
            renderConfirmModal();
            await activePlayBoardInstance.claimDraw();
          });
        }
      } else if (!snapshot.isGameOver && claimableIntendedList.length > 0) {
        const firstReasonLabel = claimableIntendedList[0].claimLabel || 'Remis';
        const moveBtnsHtml = claimableIntendedList
          .slice(0, 6)
          .map(
            m => `
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                data-action="select-intended-draw-move"
                data-move-lan="${escapeHtml(m.lan)}"
                data-testid="select-intended-move-${escapeHtml(m.lan)}"
              >
                Pilih ${escapeHtml(m.san)}
              </button>
            `
          )
          .join('');

        claimDrawSlot.classList.remove('is-hidden');
        claimDrawSlot.innerHTML = `
          <div class="play-claim-draw-banner" role="region" aria-label="Pilih Langkah Klaim Remis" data-testid="play-intended-draw-candidates">
            <div class="play-claim-draw-info">
              <strong class="play-claim-draw-title">Opsi Klaim Remis dengan Langkah Direncanakan (${escapeHtml(
                firstReasonLabel
              )})</strong>
              <span class="play-claim-draw-desc">
                Pilih langkah legal yang direncanakan di bawah ini (atau klik bidak di papan) untuk mengaktifkan Klaim Remis tanpa mengubah posisi papan:
              </span>
              <div class="play-modal-btn-group">${moveBtnsHtml}</div>
            </div>
          </div>
        `;

        claimDrawSlot
          .querySelectorAll('[data-action="select-intended-draw-move"]')
          .forEach(btn => {
            btn.addEventListener('click', () => {
              const lan = btn.getAttribute('data-move-lan');
              if (lan && activePlayBoardInstance) {
                activePlayBoardInstance.setIntendedMove(lan);
              }
            });
          });
      } else {
        claimDrawSlot.classList.add('is-hidden');
        claimDrawSlot.innerHTML = '';
      }
    }

    // Tombol Menyerah dinonaktifkan apabila permainan sudah berakhir
    if (resignBtn) {
      resignBtn.disabled = Boolean(snapshot.isGameOver);
    }

    // Tampilkan / sembunyikan dialog hasil akhir
    if (snapshot.isGameOver && snapshot.gameResult) {
      activeConfirmModal = null;
      renderConfirmModal();
      renderResultDialog(snapshot.gameResult);
    } else {
      renderResultDialog(null);
    }
  }

  // Inisialisasi ComputerChessboard
  if (boardMount) {
    activePlayBoardInstance = new ComputerChessboard(boardMount, {
      engine,
      colorPreference: currentSettings.colorPreference,
      difficulty: currentSettings.difficulty,
      initialFen,
      onStateChange: snapshot => {
        syncSidePanelWithSnapshot(snapshot);
      },
      onGameEnd: gameResult => {
        if (typeof onGameEnd === 'function') {
          onGameEnd(gameResult);
        }
      }
    });

    activePlayBoardInstance
      .startNewGame({
        colorPreference: currentSettings.colorPreference,
        difficulty: currentSettings.difficulty,
        initialFen
      })
      .then(snapshot => {
        if (snapshot && typeof onGameStarted === 'function') {
          onGameStarted(snapshot);
        }
      });
  }

  // Bind tombol kembali ke Dashboard Bermain
  const backBtns = container.querySelectorAll('[data-action="back-play-dashboard"]');
  backBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof onBackToPlayDashboard === 'function') {
        onBackToPlayDashboard();
      }
    });
  });

  // Bind tombol Permainan Baru
  const newGameBtn = container.querySelector('[data-action="new-game"]');
  if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
      pendingNewGameSettings = { ...currentSettings };
      activeConfirmModal = activeConfirmModal === 'new-game' ? null : 'new-game';
      renderConfirmModal();
    });
  }

  // Bind tombol Klaim Remis
  if (claimDrawBtn) {
    claimDrawBtn.addEventListener('click', async () => {
      if (!activePlayBoardInstance || activePlayBoardInstance.isGameOver) return;
      activeConfirmModal = null;
      renderConfirmModal();
      await activePlayBoardInstance.claimDraw();
    });
  }

  // Bind tombol Menyerah (membuka konfirmasi terlebih dahulu)
  if (resignBtn) {
    resignBtn.addEventListener('click', () => {
      if (!activePlayBoardInstance || activePlayBoardInstance.isGameOver) return;
      activeConfirmModal = activeConfirmModal === 'resign' ? null : 'resign';
      renderConfirmModal();
    });
  }

  // Bind tombol Balik Papan
  const flipBtn = container.querySelector('[data-action="flip-board"]');
  if (flipBtn) {
    flipBtn.addEventListener('click', () => {
      if (activePlayBoardInstance) {
        activePlayBoardInstance.flipBoard();
      }
    });
  }

  return activePlayBoardInstance;
}
