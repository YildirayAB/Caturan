/**
 * Komponen Ruang Latihan Papan Puzzle Interaktif (Puzzle Play View — MVP 2 Bagian 4 & 5)
 * Menampilkan:
 * 1. Bar navigasi kembali ke Puzzle Dashboard & informasi mode latihan aktif.
 * 2. Papan Catur Puzzle Interaktif (PuzzleChessboard) dengan ruang papan yang lega.
 * 3. Panel informasi posisi puzzle, giliran pemain, langkah lawan terakhir, dan instruksi.
 * 4. Panel penyelesaian puzzle ketika seluruh rangkaian solusi selesai:
 *    - Status Benar / Puzzle Selesai
 *    - Rangkaian solusi
 *    - Tema puzzle
 *    - Rating kesulitan
 *    - Tombol Puzzle Berikutnya
 *    - Tombol Kembali ke Puzzle Dashboard
 */

import {
  getPuzzleById,
  getPuzzleCategoryById,
  getPuzzleDifficultyById
} from '../data/puzzles.js';
import { PuzzleChessboard } from './chessboardUI.js';
import { UI_ICONS } from './icons.js';

let activePuzzleBoardInstance = null;

export function getActivePuzzleBoard() {
  return activePuzzleBoardInstance;
}

export function destroyActivePuzzleBoard() {
  if (activePuzzleBoardInstance) {
    activePuzzleBoardInstance.destroy();
    activePuzzleBoardInstance = null;
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

export function updatePuzzleCompletionUI(
  container,
  {
    puzzle,
    solutionSan = [],
    hintsUsed = 0,
    wrongMoves = 0,
    onNextPuzzle,
    onBackToDashboard
  }
) {
  if (!container || !puzzle) return;

  const statusBadge = container.querySelector('[data-testid="puzzle-header-status-badge"]');
  if (statusBadge) {
    statusBadge.className = 'badge badge-success';
    statusBadge.innerHTML = `${UI_ICONS.check} Selesai`;
  }

  const completionSlot = container.querySelector('#puzzle-completion-slot');
  if (!completionSlot) return;

  const catInfo = getPuzzleCategoryById(puzzle.primaryTheme);
  const diffInfo = getPuzzleDifficultyById(puzzle.difficulty);
  const catTitle = catInfo ? catInfo.title : puzzle.primaryTheme;
  const diffTitle = diffInfo ? diffInfo.title : puzzle.difficulty;
  const finalSanList =
    Array.isArray(solutionSan) && solutionSan.length > 0
      ? solutionSan
      : puzzle.solutionSan || [];

  completionSlot.innerHTML = `
    <div class="puzzle-completion-card" role="status" data-testid="puzzle-completion-panel">
      <div class="puzzle-completion-header">
        <div class="completion-check-icon">${UI_ICONS.checkCircle}</div>
        <div>
          <span class="completion-eyebrow">STATUS LATIHAN</span>
          <h3 class="completion-title" data-testid="puzzle-completion-status">Benar! Puzzle Selesai</h3>
        </div>
      </div>

      <div class="puzzle-completion-details">
        <div class="completion-detail-row">
          <span class="detail-label">Rangkaian Solusi</span>
          <strong class="detail-value detail-solution-code" data-testid="puzzle-completion-solution">
            ${escapeHtml(finalSanList.join(' → '))}
          </strong>
        </div>
        <div class="completion-detail-row">
          <span class="detail-label">Notasi UCI</span>
          <span class="detail-value"><code>${escapeHtml((puzzle.solutionMoves || []).join(' '))}</code></span>
        </div>
        <div class="completion-detail-row">
          <span class="detail-label">Tema Puzzle</span>
          <strong class="detail-value" data-testid="puzzle-completion-theme">${escapeHtml(catTitle)}</strong>
        </div>
        <div class="completion-detail-row">
          <span class="detail-label">Rating Kesulitan</span>
          <strong class="detail-value" data-testid="puzzle-completion-rating">
            ${puzzle.rating} (${escapeHtml(diffTitle)})
          </strong>
        </div>
        <div class="completion-detail-row">
          <span class="detail-label">Ringkasan Percobaan</span>
          <span class="detail-value">
            ${wrongMoves === 0 ? 'Tepat pada percobaan pertama' : `${wrongMoves} langkah salah sebelum selesai`} • Petunjuk: ${hintsUsed}x
          </span>
        </div>
      </div>

      <div class="puzzle-completion-actions">
        <button
          type="button"
          class="btn btn-primary"
          data-action="completion-next-puzzle"
          data-testid="next-puzzle-btn"
        >
          <span>Puzzle Berikutnya</span>
          ${UI_ICONS.arrowRight}
        </button>
        <button
          type="button"
          class="btn btn-secondary"
          data-action="completion-back-dashboard"
          data-testid="completion-back-dashboard-btn"
        >
          ${UI_ICONS.arrowLeft}
          <span>Kembali ke Puzzle Dashboard</span>
        </button>
      </div>
    </div>
  `;

  const nextBtn = completionSlot.querySelector('[data-action="completion-next-puzzle"]');
  if (nextBtn && typeof onNextPuzzle === 'function') {
    nextBtn.addEventListener('click', () => onNextPuzzle());
  }

  const backBtn = completionSlot.querySelector('[data-action="completion-back-dashboard"]');
  if (backBtn && typeof onBackToDashboard === 'function') {
    backBtn.addEventListener('click', () => onBackToDashboard());
  }
}

export function renderPuzzlePlayView(
  container,
  {
    puzzleId,
    isSolved = false,
    practiceContext = {},
    onBackToDashboard,
    onNextPuzzle,
    onHintUsed,
    onWrongMove,
    onPuzzleSolved
  }
) {
  if (!container) return;

  destroyActivePuzzleBoard();

  const puzzle = getPuzzleById(puzzleId);
  if (!puzzle) {
    container.innerHTML = `
      <div class="card empty-state-box">
        <h2>Puzzle Tidak Ditemukan</h2>
        <p>Data puzzle yang Anda pilih tidak tersedia.</p>
        <button type="button" class="btn btn-primary" data-action="back-puzzle-dashboard">
          Kembali ke Puzzle Dashboard
        </button>
      </div>
    `;
    const btn = container.querySelector('[data-action="back-puzzle-dashboard"]');
    if (btn && typeof onBackToDashboard === 'function') {
      btn.addEventListener('click', onBackToDashboard);
    }
    return;
  }

  const catInfo = getPuzzleCategoryById(puzzle.primaryTheme);
  const diffInfo = getPuzzleDifficultyById(puzzle.difficulty);
  const catTitle = catInfo ? catInfo.title : puzzle.primaryTheme;
  const diffTitle = diffInfo ? diffInfo.title : puzzle.difficulty;
  const playerSideLabel = puzzle.playerColor === 'white' ? 'Putih' : 'Hitam';
  const totalPlayerMoves = Math.max(1, Math.ceil((puzzle.solutionMoves || []).length / 2));

  let modeBannerLabel = 'Latihan Campuran';
  if (practiceContext.mode === 'daily') {
    modeBannerLabel = 'Puzzle Harian';
  } else if (practiceContext.mode === 'theme' && practiceContext.theme) {
    const c = getPuzzleCategoryById(practiceContext.theme);
    modeBannerLabel = `Tema: ${c ? c.title : practiceContext.theme}`;
  } else if (practiceContext.mode === 'difficulty' && practiceContext.difficulty) {
    const d = getPuzzleDifficultyById(practiceContext.difficulty);
    modeBannerLabel = `Kesulitan: ${d ? d.title : practiceContext.difficulty}`;
  }

  container.innerHTML = `
    <div class="lesson-detail-page puzzle-play-page">
      <!-- Topbar Navigasi Puzzle -->
      <div class="lesson-topbar">
        <button
          type="button"
          class="btn btn-secondary btn-sm"
          data-action="back-puzzle-dashboard"
          data-testid="back-to-puzzle-dashboard-btn"
        >
          ${UI_ICONS.arrowLeft}
          <span>Kembali ke Puzzle Dashboard</span>
        </button>

        <div class="lesson-topbar-meta">
          <span class="badge badge-accent">${escapeHtml(modeBannerLabel)}</span>
          <span class="badge badge-neutral">Kesulitan: ${escapeHtml(diffTitle)} (${puzzle.rating})</span>
          <span
            class="badge ${isSolved ? 'badge-success' : 'badge-neutral'}"
            data-testid="puzzle-header-status-badge"
          >
            ${isSolved ? `${UI_ICONS.check} Selesai` : 'Belum Selesai'}
          </span>
        </div>
      </div>

      <!-- Workspace 2 Kolom: Kiri Papan Catur Puzzle Luas, Kanan Panel Informasi & Penyelesaian -->
      <div class="puzzle-workspace-grid">
        <!-- Kolom Kiri: Papan Catur Interaktif -->
        <section class="card puzzle-board-card" aria-label="Papan Catur Puzzle Interaktif">
          <div id="puzzle-chessboard-mount" class="chessboard-mount-container"></div>
        </section>

        <!-- Kolom Kanan: Detail Taktik & Status Penyelesaian -->
        <aside class="puzzle-side-column" aria-label="Informasi dan Status Puzzle">
          <article class="card puzzle-info-card">
            <div class="card-section-tag">TANTANGAN TAKTIK CATUR</div>
            <h1 class="puzzle-play-title">Puzzle #${escapeHtml(puzzle.id)}</h1>
            <p class="puzzle-play-subtitle">
              Lawan baru saja memainkan langkah <code>${escapeHtml(puzzle.setupMoveSan)}</code>. Anda memegang bidak <strong>${playerSideLabel}</strong>—temukan rangkaian <strong>${totalPlayerMoves} langkah</strong> terbaik!
            </p>

            <div class="puzzle-meta-table">
              <div class="puzzle-meta-row">
                <span class="meta-row-label">Giliran Pemain</span>
                <strong class="meta-row-value">
                  <span class="turn-dot ${puzzle.playerColor === 'white' ? 'dot-white' : 'dot-black'}"></span>
                  ${playerSideLabel} Melangkah
                </strong>
              </div>
              <div class="puzzle-meta-row">
                <span class="meta-row-label">Tingkat Kesulitan</span>
                <strong class="meta-row-value">${escapeHtml(diffTitle)} (Rating ${puzzle.rating})</strong>
              </div>
              <div class="puzzle-meta-row">
                <span class="meta-row-label">Jumlah Langkah Pemain</span>
                <strong class="meta-row-value">${totalPlayerMoves} Langkah Taktik</strong>
              </div>
            </div>

            <div class="key-takeaways-box puzzle-tips-box">
              <div class="takeaways-header">
                ${UI_ICONS.info}
                <h4>Panduan Bermain Puzzle</h4>
              </div>
              <ul class="takeaways-list">
                <li>Klik bidak ${playerSideLabel} atau seret ke petak tujuan yang bertanda titik/cincin.</li>
                <li>Gunakan tombol <strong>Petunjuk</strong> (Tahap 1: info tema taktik, Tahap 2: sorot petak bidak).</li>
                <li>Jika langkah belum tepat, posisi otomatis dikembalikan agar Anda dapat mencoba lagi.</li>
              </ul>
            </div>
          </article>

          <!-- Slot Panel Penyelesaian Puzzle (Muncul ketika seluruh rangkaian solusi selesai) -->
          <div id="puzzle-completion-slot"></div>

          <!-- Navigasi Cepat Antar Puzzle -->
          <div class="card puzzle-quick-nav-card">
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              data-action="skip-next-puzzle"
              data-testid="skip-next-puzzle-btn"
            >
              <span>Lewati ke Puzzle Berikutnya</span>
              ${UI_ICONS.arrowRight}
            </button>
          </div>
        </aside>
      </div>
    </div>
  `;

  // Mount PuzzleChessboard
  const boardMount = container.querySelector('#puzzle-chessboard-mount');
  if (boardMount) {
    activePuzzleBoardInstance = new PuzzleChessboard(boardMount, puzzle, {
      onHintUsed: payload => {
        if (typeof onHintUsed === 'function') {
          onHintUsed(payload);
        }
      },
      onWrongMove: payload => {
        if (typeof onWrongMove === 'function') {
          onWrongMove(payload);
        }
      },
      onPuzzleSolved: payload => {
        if (typeof onPuzzleSolved === 'function') {
          onPuzzleSolved(payload);
        }
        updatePuzzleCompletionUI(container, {
          puzzle,
          solutionSan: payload.solutionSan,
          hintsUsed: payload.hintsUsed,
          wrongMoves: payload.wrongMoves,
          onNextPuzzle,
          onBackToDashboard
        });
      }
    });
  }

  // Bind tombol kembali ke Puzzle Dashboard
  const backBtns = container.querySelectorAll('[data-action="back-puzzle-dashboard"]');
  backBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof onBackToDashboard === 'function') {
        onBackToDashboard();
      }
    });
  });

  // Bind tombol lewati ke puzzle berikutnya
  const skipBtn = container.querySelector('[data-action="skip-next-puzzle"]');
  if (skipBtn && typeof onNextPuzzle === 'function') {
    skipBtn.addEventListener('click', () => {
      onNextPuzzle();
    });
  }
}
