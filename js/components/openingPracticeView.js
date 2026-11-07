/**
 * Komponen Halaman Mode Latihan Opening (MVP 4 — Bagian 6: Opening Practice Mode)
 * Fitur Inti MVP 4:
 * 1. Persiapan: Pemilih Repertoire (Putih / Hitam), Keluarga Opening, dan Variasi Spesifik.
 * 2. Papan Catur Latihan Interaktif (OpeningPracticeBoard) mulai dari posisi awal standar.
 * 3. Menyembunyikan langkah yang harus dimainkan pengguna sementara menampilkan progres langkah yang sudah ditemukan.
 * 4. Sistem Hint 3 tahap (Hint 1: Ide langkah, Hint 2: Highlight bidak asal, Hint 3: Highlight petak tujuan).
 * 5. Kartu Practice Result saat variasi selesai:
 *    - Status latihan
 *    - Total langkah benar
 *    - Jumlah kesalahan
 *    - Jumlah hint
 *    - Tingkat keberhasilan (%)
 *    - Tombol Ulangi Latihan, Tombol Opening Berikutnya, Tombol Kembali ke Library
 */

import { UI_ICONS } from './icons.js';
import { OpeningPracticeBoard } from './chessboardUI.js';
import {
  getAllOpenings,
  getOpeningById,
  getOpeningFamilies,
  getOpeningsByFamily,
  selectNextOpening
} from '../data/openings.js';

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderOpeningPracticeView(
  container,
  {
    openingId,
    masteredOpeningIds = [],
    replyDelayMs = 320,
    onSelectOpening,
    onOpenLearn,
    onBackToLibrary,
    onBackToDashboard,
    onPracticeComplete
  } = {}
) {
  if (!container) return null;

  const opening = getOpeningById(openingId) || getAllOpenings()[0];
  if (!opening) return null;

  const currentSide = opening.repertoireSide;
  const familiesForSide = getOpeningFamilies(currentSide);
  const variationsForFamily = getOpeningsByFamily(opening.family);

  container.innerHTML = `
    <div class="lesson-detail-view opening-practice-view" data-testid="opening-practice-view">
      <!-- Topbar -->
      <div class="detail-topbar">
        <div class="detail-topbar-left">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="back-library"
            data-testid="opening-practice-back-library-btn"
          >
            ${UI_ICONS.chevronLeft}
            <span>Koleksi Opening</span>
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="back-dashboard"
            data-testid="opening-practice-back-dashboard-btn"
          >
            <span>Dashboard Opening</span>
          </button>
        </div>

        <div class="detail-topbar-right">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="open-learn"
            data-testid="opening-practice-learn-btn"
          >
            ${UI_ICONS.learn}
            <span>Lihat Penjelasan & Notasi (Learn Mode)</span>
          </button>
        </div>
      </div>

      <!-- Panel Persiapan Latihan (Repertoire, Opening, Variasi) -->
      <section class="opening-practice-prep-card" aria-label="Persiapan Latihan Opening" data-testid="opening-practice-prep">
        <div class="opening-prep-header">
          <div>
            <div class="opening-detail-badges">
              <span class="badge badge-accent">ECO ${escapeHtml(opening.eco)}</span>
              <span class="badge badge-neutral">${
                opening.repertoireSide === 'black' ? 'Repertoire Hitam' : 'Repertoire Putih'
              }</span>
              <span class="badge badge-neutral">${escapeHtml(opening.category)}</span>
              <span class="badge badge-neutral">Kesulitan: ${escapeHtml(opening.difficultyLabel)}</span>
            </div>
            <h1 class="page-title" data-testid="opening-practice-title">
              Latihan: ${escapeHtml(opening.name)}
            </h1>
            <p class="page-subtitle">
              Mainkan urutan langkah variasi <strong>${escapeHtml(opening.variationName)}</strong> dari posisi awal standar tanpa melihat kunci jawaban.
            </p>
          </div>
        </div>

        <div class="opening-prep-selectors">
          <div class="opening-filter-group">
            <label for="practice-repertoire-select" class="opening-filter-label">1. Pilih Repertoire</label>
            <select
              id="practice-repertoire-select"
              class="opening-filter-select"
              data-testid="practice-select-repertoire"
            >
              <option value="white" ${currentSide === 'white' ? 'selected' : ''}>Repertoire Putih (Anda Putih)</option>
              <option value="black" ${currentSide === 'black' ? 'selected' : ''}>Repertoire Hitam (Anda Hitam)</option>
            </select>
          </div>

          <div class="opening-filter-group">
            <label for="practice-family-select" class="opening-filter-label">2. Pilih Opening</label>
            <select
              id="practice-family-select"
              class="opening-filter-select"
              data-testid="practice-select-family"
            >
              ${familiesForSide
                .map(
                  fam => `
                <option value="${escapeHtml(fam.family)}" ${fam.family === opening.family ? 'selected' : ''}>
                  ${escapeHtml(fam.family)} (${fam.variations.length} variasi)
                </option>
              `
                )
                .join('')}
            </select>
          </div>

          <div class="opening-filter-group">
            <label for="practice-variation-select" class="opening-filter-label">3. Pilih Variasi</label>
            <select
              id="practice-variation-select"
              class="opening-filter-select"
              data-testid="practice-select-variation"
            >
              ${variationsForFamily
                .map(
                  v => `
                <option value="${escapeHtml(v.id)}" ${v.id === opening.id ? 'selected' : ''}>
                  ${escapeHtml(v.variationName)} [ECO ${escapeHtml(v.eco)}]
                </option>
              `
                )
                .join('')}
            </select>
          </div>
        </div>
      </section>

      <!-- Workspace 2 Kolom: Papan Latihan Interaktif + Panel Status / Hasil -->
      <div class="lesson-workspace opening-practice-workspace">
        <div class="lesson-board-column">
          <div id="opening-practice-board-mount"></div>
        </div>

        <div class="lesson-theory-column opening-practice-side-column">
          <!-- Statistik Sesi Real-time -->
          <article class="theory-card opening-session-tracker-card" data-testid="opening-session-tracker">
            <h2 class="opening-panel-title">Progres Sesi Latihan</h2>
            <div class="practice-live-metrics">
              <div class="practice-metric-box">
                <span class="practice-metric-lbl">Langkah Benar</span>
                <span class="practice-metric-val" id="live-correct-moves" data-testid="live-correct-moves">0</span>
              </div>
              <div class="practice-metric-box">
                <span class="practice-metric-lbl">Kesalahan</span>
                <span class="practice-metric-val" id="live-wrong-moves" data-testid="live-wrong-moves">0</span>
              </div>
              <div class="practice-metric-box">
                <span class="practice-metric-lbl">Hint Digunakan</span>
                <span class="practice-metric-val" id="live-hints-used" data-testid="live-hints-used">0</span>
              </div>
              <div class="practice-metric-box">
                <span class="practice-metric-lbl">Keberhasilan</span>
                <span class="practice-metric-val" id="live-accuracy" data-testid="live-accuracy">100%</span>
              </div>
            </div>

            <div class="practice-hidden-moves-box">
              <h3 class="opening-subpanel-title">Urutan Langkah Variasi (Tersembunyi Saat Giliran Anda)</h3>
              <div id="practice-masked-moves" class="practice-masked-moves" data-testid="practice-masked-moves"></div>
            </div>
          </article>

          <!-- Tempat Kartu Practice Result ketika variasi selesai -->
          <div id="opening-practice-result-mount" data-testid="opening-practice-result-mount"></div>

          <!-- Panduan Singkat Ide Opening -->
          <article class="theory-card opening-practice-guide-card">
            <h2 class="opening-panel-title">Sasaran Strategis Variasi Ini</h2>
            <p class="opening-description-text">${escapeHtml(opening.description)}</p>
            <p class="opening-hint-guide-text">
              <strong>Tips Petunjuk Bertahap:</strong> Jika lupa langkah berikutnya, tekan tombol <em>Petunjuk</em> pada papan:
              Tahap 1 menampilkan ide umum langkah, Tahap 2 menyorot bidak yang harus digerakkan, dan Tahap 3 menunjukkan petak tujuannya.
            </p>
          </article>
        </div>
      </div>
    </div>
  `;

  const boardMount = container.querySelector('#opening-practice-board-mount');
  const resultMount = container.querySelector('#opening-practice-result-mount');
  const maskedMovesEl = container.querySelector('#practice-masked-moves');
  const liveCorrectEl = container.querySelector('#live-correct-moves');
  const liveWrongEl = container.querySelector('#live-wrong-moves');
  const liveHintsEl = container.querySelector('#live-hints-used');
  const liveAccuracyEl = container.querySelector('#live-accuracy');

  const updateMaskedMovesDisplay = state => {
    if (!maskedMovesEl) return;
    const itemsHtml = opening.moveAnnotations
      .map((ann, idx) => {
        const prefix =
          ann.color === 'white' ? `${ann.moveNumber}.` : `${ann.moveNumber}...`;
        if (idx < state.currentPly) {
          return `<span class="masked-move-chip revealed" data-testid="masked-move-${idx + 1}">${prefix} ${escapeHtml(ann.san)}</span>`;
        }
        if (idx === state.currentPly) {
          return `<span class="masked-move-chip active-hidden" data-testid="masked-move-${idx + 1}">${prefix} ?</span>`;
        }
        return `<span class="masked-move-chip hidden" data-testid="masked-move-${idx + 1}">${prefix} •••</span>`;
      })
      .join('');
    maskedMovesEl.innerHTML = itemsHtml;
  };

  const updateLiveStatsDisplay = state => {
    if (liveCorrectEl) {
      liveCorrectEl.textContent = `${state.correctMoves} / ${state.totalPlayerMoves}`;
    }
    if (liveWrongEl) {
      liveWrongEl.textContent = String(state.wrongMoves);
    }
    if (liveHintsEl) {
      liveHintsEl.textContent = String(state.hintsUsed);
    }
    if (liveAccuracyEl) {
      liveAccuracyEl.textContent = `${state.accuracy}%`;
    }
    updateMaskedMovesDisplay(state);
    if (!state.isPracticeComplete && resultMount) {
      resultMount.innerHTML = '';
    }
  };

  const renderPracticeResultCard = state => {
    if (!resultMount) return;
    const isMasteredClean = state.wrongMoves === 0 && state.hintsUsed === 0;
    const statusText = isMasteredClean
      ? 'Dikuasai (Sempurna Tanpa Bantuan)'
      : 'Selesai (Perlu Diulang Tanpa Hint/Salah)';
    const statusBadgeClass = isMasteredClean ? 'badge-success' : 'badge-warning';

    const nextOpening = selectNextOpening({
      currentOpeningId: opening.id,
      repertoireSide: opening.repertoireSide,
      category: opening.categoryId,
      masteredOpeningIds
    });

    resultMount.innerHTML = `
      <section class="theory-card opening-practice-result-card" data-testid="opening-practice-result-card">
        <div class="practice-result-header">
          <h2 class="opening-panel-title">Hasil Latihan (Practice Result)</h2>
          <span class="badge ${statusBadgeClass}" data-testid="practice-result-status">
            ${escapeHtml(statusText)}
          </span>
        </div>

        <div class="practice-result-stats-grid">
          <div class="practice-result-stat">
            <span class="result-stat-label">Total Langkah Benar</span>
            <strong class="result-stat-value" data-testid="practice-result-correct">${state.correctMoves}</strong>
          </div>
          <div class="practice-result-stat">
            <span class="result-stat-label">Jumlah Kesalahan</span>
            <strong class="result-stat-value" data-testid="practice-result-wrong">${state.wrongMoves}</strong>
          </div>
          <div class="practice-result-stat">
            <span class="result-stat-label">Jumlah Hint</span>
            <strong class="result-stat-value" data-testid="practice-result-hints">${state.hintsUsed}</strong>
          </div>
          <div class="practice-result-stat">
            <span class="result-stat-label">Tingkat Keberhasilan</span>
            <strong class="result-stat-value" data-testid="practice-result-accuracy">${state.accuracy}%</strong>
          </div>
        </div>

        <div class="practice-result-actions">
          <button
            type="button"
            class="btn btn-secondary"
            data-action="result-retry"
            data-testid="practice-result-retry-btn"
          >
            ${UI_ICONS.restart}
            <span>Ulangi Latihan</span>
          </button>
          <button
            type="button"
            class="btn btn-primary"
            data-action="result-next-opening"
            data-next-opening-id="${escapeHtml(nextOpening ? nextOpening.id : opening.id)}"
            data-testid="practice-result-next-btn"
          >
            <span>Opening Berikutnya</span>
            ${UI_ICONS.arrowRight}
          </button>
          <button
            type="button"
            class="btn btn-secondary"
            data-action="result-back-library"
            data-testid="practice-result-library-btn"
          >
            <span>Kembali ke Library</span>
          </button>
        </div>
      </section>
    `;

    const retryBtn = resultMount.querySelector('[data-action="result-retry"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        resultMount.innerHTML = '';
        boardInstance.restart();
        updateLiveStatsDisplay(boardInstance.getPracticeState());
      });
    }

    const nextBtn = resultMount.querySelector('[data-action="result-next-opening"]');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const nextId = nextBtn.getAttribute('data-next-opening-id');
        if (nextId && typeof onSelectOpening === 'function') {
          onSelectOpening(nextId);
        }
      });
    }

    const libBtn = resultMount.querySelector('[data-action="result-back-library"]');
    if (libBtn) {
      libBtn.addEventListener('click', () => {
        if (typeof onBackToLibrary === 'function') {
          onBackToLibrary();
        }
      });
    }
  };

  const boardInstance = new OpeningPracticeBoard(boardMount, opening, {
    repertoireSide: opening.repertoireSide,
    replyDelayMs,
    onStateChange: state => {
      updateLiveStatsDisplay(state);
    },
    onPracticeComplete: state => {
      updateLiveStatsDisplay(state);
      if (typeof onPracticeComplete === 'function') {
        onPracticeComplete(state);
      }
      renderPracticeResultCard(state);
    }
  });

  updateLiveStatsDisplay(boardInstance.getPracticeState());

  // Bind pemilih Repertoire, Keluarga Opening, dan Variasi
  const repSelect = container.querySelector('#practice-repertoire-select');
  if (repSelect) {
    repSelect.addEventListener('change', e => {
      const targetSide = e.target.value;
      const firstForSide = getAllOpenings().find(o => o.repertoireSide === targetSide);
      if (firstForSide && typeof onSelectOpening === 'function') {
        onSelectOpening(firstForSide.id);
      }
    });
  }

  const famSelect = container.querySelector('#practice-family-select');
  if (famSelect) {
    famSelect.addEventListener('change', e => {
      const targetFamily = e.target.value;
      const familyVars = getOpeningsByFamily(targetFamily);
      const preferred =
        familyVars.find(v => v.repertoireSide === currentSide) || familyVars[0];
      if (preferred && typeof onSelectOpening === 'function') {
        onSelectOpening(preferred.id);
      }
    });
  }

  const varSelect = container.querySelector('#practice-variation-select');
  if (varSelect) {
    varSelect.addEventListener('change', e => {
      const targetVarId = e.target.value;
      if (targetVarId && typeof onSelectOpening === 'function') {
        onSelectOpening(targetVarId);
      }
    });
  }

  const backLibBtn = container.querySelector('[data-action="back-library"]');
  if (backLibBtn) {
    backLibBtn.addEventListener('click', () => {
      if (typeof onBackToLibrary === 'function') onBackToLibrary();
    });
  }

  const backDashBtn = container.querySelector('[data-action="back-dashboard"]');
  if (backDashBtn) {
    backDashBtn.addEventListener('click', () => {
      if (typeof onBackToDashboard === 'function') onBackToDashboard();
    });
  }

  const learnBtn = container.querySelector('[data-action="open-learn"]');
  if (learnBtn) {
    learnBtn.addEventListener('click', () => {
      if (typeof onOpenLearn === 'function') onOpenLearn(opening.id);
    });
  }

  return boardInstance;
}
