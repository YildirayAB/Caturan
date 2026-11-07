/**
 * Komponen Halaman Utama Puzzle Catur (Puzzle Dashboard View — MVP 2 Bagian 1, 3, 6)
 * Menampilkan:
 * 1. Header: Judul "Puzzle Catur", deskripsi singkat, dan sapaan pengguna.
 * 2. Statistik Puzzle (100% dari progres aktual):
 *    - Total puzzle diselesaikan
 *    - Total percobaan
 *    - Tingkat akurasi
 *    - Puzzle yang sudah diselesaikan hari ini
 * 3. Puzzle Harian (deterministik berdasarkan tanggal lokal):
 *    - Posisi puzzle (pratinjau papan 8x8)
 *    - Tingkat kesulitan & rating
 *    - Status Selesai / Belum Selesai
 *    - Tombol Mulai Puzzle
 * 4. Pilihan Latihan:
 *    - Latihan Campuran
 *    - Latihan berdasarkan Tema (6 kategori bahasa Indonesia)
 *    - Latihan berdasarkan Kesulitan (Pemula, Menengah, Lanjutan)
 * 5. Progress:
 *    - Materi puzzle yang sudah diselesaikan
 *    - Distribusi penyelesaian berdasarkan tema
 *    - Riwayat latihan terbaru
 */

import { UI_ICONS } from './icons.js';
import { renderStaticChessboardPreview, parseUciMove } from './chessboardUI.js';

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatModeLabel(mode) {
  switch (mode) {
    case 'daily':
      return 'Puzzle Harian';
    case 'theme':
      return 'Latihan Tema';
    case 'difficulty':
      return 'Latihan Kesulitan';
    default:
      return 'Latihan Campuran';
  }
}

export function renderPuzzleView(
  container,
  {
    puzzleSummary,
    userEmail = null,
    onStartDailyPuzzle,
    onStartMixedPractice,
    onStartThemePractice,
    onStartDifficultyPractice,
    onOpenPuzzle
  }
) {
  if (!container || !puzzleSummary) return;

  const {
    totalPuzzlesCount,
    solvedCount,
    overallPercentage,
    totalAttempts,
    successfulAttempts,
    accuracy,
    solvedTodayCount,
    dailyPuzzle,
    lastPlayedPuzzle,
    categoriesSummary,
    difficultiesSummary,
    solvedPuzzlesList,
    recentHistory
  } = puzzleSummary;

  const userName = userEmail ? userEmail.split('@')[0] : 'Pecatur Caturan';

  let greetingSubtext = '';
  if (solvedCount === 0 && totalAttempts === 0) {
    greetingSubtext =
      'Belum ada riwayat latihan puzzle. Seluruh statistik dimulai secara jujur dari 0—mulai dari Puzzle Harian atau pilih tema taktik favorit Anda!';
  } else {
    greetingSubtext = `Anda telah menuntaskan ${solvedCount} dari ${totalPuzzlesCount} puzzle (${overallPercentage}%) dengan tingkat akurasi ${accuracy}%. Terus latih ketajaman kalkulasi taktik Anda!`;
  }

  // 3. Kartu Puzzle Harian
  let dailyCardHtml = '';
  if (dailyPuzzle) {
    const setupMoveObj = parseUciMove(dailyPuzzle.setupMove);
    const previewHtml = renderStaticChessboardPreview(dailyPuzzle.puzzleFen, {
      orientation: dailyPuzzle.playerColor,
      lastMove: setupMoveObj
    });
    const turnLabel =
      dailyPuzzle.playerColor === 'white' ? 'Putih Melangkah' : 'Hitam Melangkah';
    const diffTitle = dailyPuzzle.difficultyInfo ? dailyPuzzle.difficultyInfo.title : 'Pemula';
    const catTitle = dailyPuzzle.categoryInfo ? dailyPuzzle.categoryInfo.title : 'Taktik';

    dailyCardHtml = `
      <div class="daily-puzzle-layout">
        <div class="daily-puzzle-board-col">
          ${previewHtml}
        </div>
        <div class="daily-puzzle-info-col">
          <div class="daily-puzzle-badges">
            <span class="badge badge-accent">Tanggal: ${escapeHtml(dailyPuzzle.date)}</span>
            <span class="badge badge-neutral">${escapeHtml(diffTitle)} • Rating ${dailyPuzzle.rating}</span>
            <span class="badge badge-neutral">${escapeHtml(catTitle)}</span>
            <span
              class="badge ${dailyPuzzle.isCompleted ? 'badge-success' : 'badge-in-progress'}"
              data-testid="daily-puzzle-status"
            >
              ${dailyPuzzle.isCompleted ? `${UI_ICONS.check} Selesai` : 'Belum Selesai'}
            </span>
          </div>

          <h3 class="daily-puzzle-title">Puzzle Harian #${escapeHtml(dailyPuzzle.id)}</h3>
          <p class="daily-puzzle-turn">
            <span class="turn-dot ${dailyPuzzle.playerColor === 'white' ? 'dot-white' : 'dot-black'}"></span>
            <strong>${turnLabel}</strong> — Lawan baru saja melangkah <code>${escapeHtml(dailyPuzzle.setupMoveSan)}</code>
          </p>
          <p class="daily-puzzle-desc">
            Temukan kombinasi langkah terbaik pada posisi di samping. Puzzle harian dipilih secara deterministik setiap tanggal sehingga konsisten di seluruh perangkat Anda.
          </p>

          <div class="daily-puzzle-actions">
            <button
              type="button"
              class="btn ${dailyPuzzle.isCompleted ? 'btn-completed' : 'btn-primary'}"
              data-action="start-daily-puzzle"
              data-testid="start-daily-puzzle-btn"
            >
              <span>${dailyPuzzle.isCompleted ? 'Selesai — Mainkan Ulang Puzzle Harian' : 'Mulai Puzzle'}</span>
              ${UI_ICONS.arrowRight}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 4A. Banner Latihan Campuran & Lanjutkan Puzzle Terakhir
  const continueBtnHtml = lastPlayedPuzzle
    ? `
      <button
        type="button"
        class="btn btn-secondary"
        data-open-puzzle="${escapeHtml(lastPlayedPuzzle.id)}"
        data-testid="continue-last-puzzle-btn"
      >
        <span>Buka Puzzle Terakhir (#${escapeHtml(lastPlayedPuzzle.id)})</span>
      </button>
    `
    : '';

  // 4B. Kartu Kategori Tema (6 Tema Berbahasa Indonesia)
  const categoriesGridHtml = categoriesSummary
    .map(cat => {
      const diffPillsHtml = (cat.availableDifficulties || [])
        .map(
          d =>
            `<span class="meta-tag">${escapeHtml(d.title)} (${d.count})</span>`
        )
        .join('');

      return `
        <article class="card puzzle-choice-card" data-testid="theme-card-${escapeHtml(cat.id)}">
          <div class="puzzle-choice-top">
            <span class="badge badge-accent">${escapeHtml(cat.title)}</span>
            <span class="lesson-count-pill">${cat.totalPuzzles} Puzzle Tersedia</span>
          </div>
          <h3 class="puzzle-choice-title">${escapeHtml(cat.title)}</h3>
          <p class="puzzle-choice-desc">${escapeHtml(cat.description)}</p>

          <div class="puzzle-choice-difficulties">
            <span class="choice-sub-label">Kesulitan tersedia:</span>
            <div class="rec-meta-tags">
              ${diffPillsHtml}
            </div>
          </div>

          <div class="puzzle-choice-progress">
            <div class="cat-mini-info">
              <span class="cat-prog-label">Diselesaikan</span>
              <strong class="cat-prog-value">${cat.solvedPuzzles} / ${cat.totalPuzzles} (${cat.percentage}%)</strong>
            </div>
            <div class="progress-bar-track progress-track-sm">
              <div class="progress-bar-fill" style="width: ${cat.percentage}%"></div>
            </div>
          </div>

          <div class="puzzle-choice-footer">
            <button
              type="button"
              class="btn btn-primary btn-sm puzzle-start-btn"
              data-start-theme="${escapeHtml(cat.id)}"
              data-testid="start-theme-${escapeHtml(cat.id)}"
            >
              <span>Mulai Latihan ${escapeHtml(cat.shortTitle)}</span>
              ${UI_ICONS.arrowRight}
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  // 4C. Kartu Tingkat Kesulitan (Pemula, Menengah, Lanjutan)
  const difficultiesGridHtml = difficultiesSummary
    .map(
      diff => `
        <article class="card puzzle-choice-card" data-testid="difficulty-card-${escapeHtml(diff.id)}">
          <div class="puzzle-choice-top">
            <span class="level-pill">${escapeHtml(diff.title)}</span>
            <span class="badge badge-neutral">Rating ${escapeHtml(diff.ratingRange)}</span>
          </div>
          <h3 class="puzzle-choice-title">Tingkat ${escapeHtml(diff.title)}</h3>
          <p class="puzzle-choice-desc">${escapeHtml(diff.description)}</p>

          <div class="puzzle-choice-progress">
            <div class="cat-mini-info">
              <span class="cat-prog-label">${diff.totalPuzzles} Puzzle Tersedia</span>
              <strong class="cat-prog-value">${diff.solvedPuzzles} / ${diff.totalPuzzles} Selesai (${diff.percentage}%)</strong>
            </div>
            <div class="progress-bar-track progress-track-sm">
              <div class="progress-bar-fill" style="width: ${diff.percentage}%"></div>
            </div>
          </div>

          <div class="puzzle-choice-footer">
            <button
              type="button"
              class="btn btn-secondary btn-sm puzzle-start-btn"
              data-start-difficulty="${escapeHtml(diff.id)}"
              data-testid="start-difficulty-${escapeHtml(diff.id)}"
            >
              <span>Latihan ${escapeHtml(diff.title)}</span>
              ${UI_ICONS.arrowRight}
            </button>
          </div>
        </article>
      `
    )
    .join('');

  // 5A. Distribusi Penyelesaian Berdasarkan Tema
  const themeDistributionRowsHtml = categoriesSummary
    .map(
      cat => `
        <div class="cat-mini-row">
          <div class="cat-mini-info">
            <span class="cat-mini-name">${escapeHtml(cat.title)}</span>
            <span class="cat-mini-status ${cat.solvedPuzzles === cat.totalPuzzles && cat.totalPuzzles > 0 ? 'status-completed' : cat.solvedPuzzles > 0 ? 'status-in-progress' : ''}">
              ${cat.solvedPuzzles} / ${cat.totalPuzzles} selesai (${cat.percentage}%)
            </span>
          </div>
          <div class="progress-bar-track progress-track-sm">
            <div class="progress-bar-fill" style="width: ${cat.percentage}%"></div>
          </div>
        </div>
      `
    )
    .join('');

  // 5B. Materi Puzzle yang Sudah Diselesaikan
  let solvedPuzzlesHtml = '';
  if (solvedPuzzlesList.length === 0) {
    solvedPuzzlesHtml = `
      <div class="empty-state-box">
        <p class="text-muted">Belum ada puzzle yang diselesaikan. Selesaikan puzzle pertama Anda untuk melihat daftar capaian di sini.</p>
      </div>
    `;
  } else {
    solvedPuzzlesHtml = `
      <div class="puzzle-solved-list" data-testid="solved-puzzles-list">
        ${solvedPuzzlesList
          .slice(0, 12)
          .map(
            p => `
              <div class="puzzle-history-item">
                <div class="puzzle-history-main">
                  <div class="puzzle-history-top">
                    <strong>Puzzle #${escapeHtml(p.id)}</strong>
                    <span class="badge badge-success">${UI_ICONS.check} Selesai</span>
                  </div>
                  <div class="puzzle-history-meta">
                    <span>${escapeHtml(p.categoryTitle)}</span>
                    <span>•</span>
                    <span>${escapeHtml(p.difficultyTitle)} (Rating ${p.rating})</span>
                    <span>•</span>
                    <span>Solusi: <code>${escapeHtml((p.solutionSan || []).join(' → '))}</code></span>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-open-puzzle="${escapeHtml(p.id)}"
                >
                  Latih Ulang
                </button>
              </div>
            `
          )
          .join('')}
      </div>
    `;
  }

  // 5C. Riwayat Latihan Terbaru
  let recentHistoryHtml = '';
  if (recentHistory.length === 0) {
    recentHistoryHtml = `
      <div class="empty-state-box">
        <p class="text-muted">Belum ada riwayat percobaan latihan terbaru.</p>
      </div>
    `;
  } else {
    recentHistoryHtml = `
      <div class="puzzle-history-list" data-testid="recent-puzzle-history">
        ${recentHistory
          .map(
            ev => `
              <div class="puzzle-history-item">
                <div class="puzzle-history-main">
                  <div class="puzzle-history-top">
                    <strong>Puzzle #${escapeHtml(ev.puzzleId)}</strong>
                    <span class="badge ${ev.solved ? 'badge-success' : 'badge-in-progress'}">
                      ${ev.solved ? 'Berhasil Diselesaikan' : 'Percobaan Belum Tepat'}
                    </span>
                    <span class="badge badge-neutral">${escapeHtml(formatModeLabel(ev.mode))}</span>
                  </div>
                  <div class="puzzle-history-meta">
                    <span>${escapeHtml(ev.categoryTitle)}</span>
                    <span>•</span>
                    <span>${escapeHtml(ev.difficultyTitle)}${ev.rating ? ` (${ev.rating})` : ''}</span>
                    <span>•</span>
                    <span>Petunjuk: ${ev.hintsUsed || 0}x</span>
                    <span>•</span>
                    <span>Tanggal: ${escapeHtml(ev.date)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-open-puzzle="${escapeHtml(ev.puzzleId)}"
                >
                  Buka
                </button>
              </div>
            `
          )
          .join('')}
      </div>
    `;
  }

  container.innerHTML = `
    <div class="dashboard-page puzzle-dashboard-page">
      <!-- 1. Header Puzzle Catur -->
      <section class="card greeting-banner" aria-labelledby="puzzle-heading">
        <div class="greeting-content">
          <div class="greeting-eyebrow">
            <span class="app-pill">CATURAN • MVP 2 TAKTIK</span>
          </div>
          <h1 id="puzzle-heading" class="greeting-title">Puzzle Catur</h1>
          <p class="greeting-subtitle-user">
            Halo, <strong>${escapeHtml(userName)}</strong>! Latih insting taktik dan ketajaman kalkulasi langkah Anda melalui posisi permainan nyata.
          </p>
          <p class="greeting-description">
            ${greetingSubtext}
          </p>
        </div>
        <div class="greeting-side-box">
          <div class="level-summary-chip">
            <span class="chip-label">Capaian Puzzle</span>
            <strong class="chip-value">${solvedCount} / ${totalPuzzlesCount} Puzzle Selesai</strong>
            <span class="chip-sub">Akurasi Latihan: ${accuracy}% (${successfulAttempts}/${totalAttempts} percobaan)</span>
          </div>
        </div>
      </section>

      <!-- 2. Statistik Puzzle -->
      <section class="dashboard-section" aria-label="Statistik Puzzle">
        <div class="stats-grid">
          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.checkCircle}</div>
            <div class="stat-body">
              <span class="stat-label">Total Puzzle Diselesaikan</span>
              <strong class="stat-value" data-testid="puzzle-stat-solved">${solvedCount}</strong>
              <span class="stat-caption">Dari ${totalPuzzlesCount} puzzle terkurasi</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.puzzle}</div>
            <div class="stat-body">
              <span class="stat-label">Total Percobaan</span>
              <strong class="stat-value" data-testid="puzzle-stat-attempts">${totalAttempts}</strong>
              <span class="stat-caption">Seluruh percobaan penyelesaian</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.trophy}</div>
            <div class="stat-body">
              <span class="stat-label">Tingkat Akurasi</span>
              <strong class="stat-value" data-testid="puzzle-stat-accuracy">${accuracy}%</strong>
              <span class="stat-caption">${successfulAttempts} berhasil dari ${totalAttempts} percobaan</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.flame}</div>
            <div class="stat-body">
              <span class="stat-label">Selesai Hari Ini</span>
              <strong class="stat-value" data-testid="puzzle-stat-today">${solvedTodayCount}</strong>
              <span class="stat-caption">Puzzle diselesaikan hari ini</span>
            </div>
          </article>
        </div>
      </section>

      <!-- 3. Puzzle Harian -->
      <section class="card dashboard-panel" aria-labelledby="daily-puzzle-heading">
        <div class="panel-header">
          <div>
            <h2 id="daily-puzzle-heading" class="panel-title">Puzzle Harian</h2>
            <p class="panel-subtitle">Tantangan taktik khusus hari ini yang sama di seluruh perangkat Anda</p>
          </div>
        </div>
        ${dailyCardHtml}
      </section>

      <!-- 4. Pilihan Latihan -->
      <section class="card next-step-banner" aria-labelledby="mixed-practice-heading">
        <div class="next-step-left">
          <div class="next-step-badges">
            <span class="badge badge-accent">Mode Rekomendasi</span>
            <span class="badge badge-neutral">Semua Tema &amp; Kesulitan</span>
          </div>
          <h2 id="mixed-practice-heading" class="next-step-title">Latihan Campuran</h2>
          <p class="next-step-desc">
            Hadapi puzzle dari berbagai tema taktik dan tingkat kesulitan secara berurutan tanpa mengulangi puzzle yang sama sebelum seluruh pool selesai.
          </p>
        </div>
        <div class="continue-card-actions">
          <button
            type="button"
            class="btn btn-primary"
            data-action="start-mixed-practice"
            data-testid="start-mixed-practice-btn"
          >
            <span>Mulai Latihan Campuran</span>
            ${UI_ICONS.arrowRight}
          </button>
          ${continueBtnHtml}
        </div>
      </section>

      <!-- 4B. Pilihan Latihan Berdasarkan Tema -->
      <section class="dashboard-section" aria-labelledby="theme-practice-heading">
        <div class="section-heading-block">
          <h2 id="theme-practice-heading" class="panel-title">Latihan Berdasarkan Tema</h2>
          <p class="panel-subtitle">Pilih motif taktik spesifik untuk memperdalam pola pengenalan serangan</p>
        </div>
        <div class="puzzle-choices-grid">
          ${categoriesGridHtml}
        </div>
      </section>

      <!-- 4C. Pilihan Latihan Berdasarkan Kesulitan -->
      <section class="dashboard-section" aria-labelledby="difficulty-practice-heading">
        <div class="section-heading-block">
          <h2 id="difficulty-practice-heading" class="panel-title">Latihan Berdasarkan Kesulitan</h2>
          <p class="panel-subtitle">Sesuaikan tantangan puzzle berdasarkan rentang rating Lichess</p>
        </div>
        <div class="puzzle-difficulty-grid">
          ${difficultiesGridHtml}
        </div>
      </section>

      <!-- 5. Progress & Riwayat Latihan -->
      <div class="dashboard-two-col">
        <!-- Distribusi Penyelesaian Berdasarkan Tema -->
        <section class="card dashboard-panel" aria-labelledby="puzzle-dist-heading">
          <div class="panel-header">
            <div>
              <h2 id="puzzle-dist-heading" class="panel-title">Distribusi Penyelesaian per Tema</h2>
              <p class="panel-subtitle">Perbandingan puzzle selesai terhadap total puzzle per kategori</p>
            </div>
            <div class="overall-percent-pill" data-testid="puzzle-overall-percentage">
              ${overallPercentage}%
            </div>
          </div>

          <div class="overall-progress-block">
            <div class="progress-bar-track progress-track-lg" role="progressbar" aria-valuenow="${overallPercentage}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar-fill" style="width: ${overallPercentage}%"></div>
            </div>
            <div class="overall-progress-stats">
              <span><strong>${solvedCount}</strong> puzzle selesai</span>
              <span><strong>${totalPuzzlesCount}</strong> puzzle tersedia</span>
            </div>
          </div>

          <div class="category-mini-breakdown">
            ${themeDistributionRowsHtml}
          </div>
        </section>

        <!-- Riwayat Latihan Terbaru -->
        <section class="card dashboard-panel" aria-labelledby="puzzle-history-heading">
          <div class="panel-header">
            <div>
              <h2 id="puzzle-history-heading" class="panel-title">Riwayat Latihan Terbaru</h2>
              <p class="panel-subtitle">Catatan aktivitas percobaan dan penyelesaian puzzle Anda</p>
            </div>
          </div>
          ${recentHistoryHtml}
        </section>
      </div>

      <!-- Materi Puzzle yang Sudah Diselesaikan -->
      <section class="card dashboard-panel" aria-labelledby="puzzle-solved-heading">
        <div class="panel-header">
          <div>
            <h2 id="puzzle-solved-heading" class="panel-title">Materi Puzzle yang Sudah Diselesaikan</h2>
            <p class="panel-subtitle">Daftar puzzle yang telah berhasil Anda pecahkan (${solvedCount} puzzle)</p>
          </div>
        </div>
        ${solvedPuzzlesHtml}
      </section>
    </div>
  `;

  // Bind tombol Mulai Puzzle Harian
  const dailyBtn = container.querySelector('[data-action="start-daily-puzzle"]');
  if (dailyBtn && typeof onStartDailyPuzzle === 'function') {
    dailyBtn.addEventListener('click', () => onStartDailyPuzzle());
  }

  // Bind tombol Latihan Campuran
  const mixedBtn = container.querySelector('[data-action="start-mixed-practice"]');
  if (mixedBtn && typeof onStartMixedPractice === 'function') {
    mixedBtn.addEventListener('click', () => onStartMixedPractice());
  }

  // Bind tombol Latihan berdasarkan Tema
  const themeBtns = container.querySelectorAll('[data-start-theme]');
  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const themeId = btn.getAttribute('data-start-theme');
      if (themeId && typeof onStartThemePractice === 'function') {
        onStartThemePractice(themeId);
      }
    });
  });

  // Bind tombol Latihan berdasarkan Kesulitan
  const diffBtns = container.querySelectorAll('[data-start-difficulty]');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const diffId = btn.getAttribute('data-start-difficulty');
      if (diffId && typeof onStartDifficultyPractice === 'function') {
        onStartDifficultyPractice(diffId);
      }
    });
  });

  // Bind tombol Buka Puzzle tertentu
  const openPuzzleBtns = container.querySelectorAll('[data-open-puzzle]');
  openPuzzleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.getAttribute('data-open-puzzle');
      if (pid && typeof onOpenPuzzle === 'function') {
        onOpenPuzzle(pid);
      }
    });
  });
}
