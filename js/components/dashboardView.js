/**
 * Komponen Tampilan Halaman Dashboard (Dashboard View)
 * Menampilkan:
 * A. Greeting & Ringkasan Aktivitas
 * B. Statistik Belajar (Level, Total XP, Materi Selesai, Streak) - jujur bernilai 0 pada kondisi awal
 * C. Progress Belajar (Persentase, Progress Bar, Perbandingan Materi Selesai vs Tersedia)
 * D. Lanjutkan Belajar (Materi terakhir dibuka atau tombol Mulai Belajar)
 * E. Rekomendasi Belajar (Materi berikutnya sesuai urutan kurikulum)
 */

import { UI_ICONS } from './icons.js';

export function renderDashboardView(container, { summary, onOpenLesson, onGoToLearn, onResetProgress }) {
  if (!container) return;

  const {
    totalXp,
    level,
    levelInfo,
    completedCount,
    totalLessonsCount,
    overallPercentage,
    streak,
    continueLesson,
    recommendedLessons,
    categoriesSummary,
    firstLesson
  } = summary;

  // Ringkasan singkat aktivitas belajar secara jujur
  let activitySummaryText = '';
  if (completedCount === 0 && !continueLesson) {
    activitySummaryText =
      'Mulai langkah pertama dari Level 1 untuk mengumpulkan XP dan membangun streak belajar!';
  } else if (completedCount === 0 && continueLesson) {
    activitySummaryText = `Materi "${continueLesson.title}" siap dipelajari. Selesaikan latihan untuk meraih XP pertama!`;
  } else if (completedCount === totalLessonsCount) {
    activitySummaryText = `Selamat! Anda telah menyelesaikan seluruh ${totalLessonsCount} materi dengan total ${totalXp} XP.`;
  } else {
    activitySummaryText = `Anda telah menyelesaikan ${completedCount} dari ${totalLessonsCount} materi (${overallPercentage}%) dengan ${totalXp} XP. Teruskan latihan Anda!`;
  }

  // Kartu D: Lanjutkan Belajar / Mulai Belajar (Empty State jujur jika belum ada materi dibuka)
  let continueCardHtml = '';
  if (continueLesson) {
    continueCardHtml = `
      <div class="continue-card has-history">
        <div class="continue-card-badge-row">
          <span class="badge badge-accent">Materi Terakhir Dibuka</span>
          <span class="badge ${continueLesson.isCompleted ? 'badge-success' : 'badge-neutral'}">
            ${continueLesson.isCompleted ? 'Sudah Selesai' : 'Sedang Dipelajari'}
          </span>
        </div>
        <h3 class="continue-lesson-title">${continueLesson.title}</h3>
        <p class="continue-lesson-meta">
          ${continueLesson.categoryTitle} • Materi #${continueLesson.order} • Hadiah +${continueLesson.xpReward} XP
        </p>
        <p class="continue-lesson-desc">${continueLesson.subtitle}</p>
        <div class="continue-card-actions">
          <button type="button" class="btn btn-primary" data-open-lesson="${continueLesson.id}">
            <span>Lanjutkan Belajar</span>
            ${UI_ICONS.arrowRight}
          </button>
          <button type="button" class="btn btn-secondary" data-action="go-learn">
            <span>Lihat Semua Kurikulum</span>
          </button>
        </div>
      </div>
    `;
  } else {
    const startLesson = firstLesson;
    continueCardHtml = `
      <div class="continue-card empty-history">
        <div class="continue-card-badge-row">
          <span class="badge badge-neutral">Belum Ada Riwayat Belajar</span>
        </div>
        <h3 class="continue-lesson-title">Siap Memulai Perjalanan Catur Anda?</h3>
        <p class="continue-lesson-desc">
          Anda belum membuka materi apa pun. Mulailah dari materi pertama pada <strong>Level 1 — Dasar-Dasar Catur: ${startLesson ? startLesson.title : 'Mengenal papan catur'}</strong> untuk mempelajari fondasi catur dengan papan interaktif.
        </p>
        <div class="continue-card-actions">
          <button type="button" class="btn btn-primary" data-open-lesson="${startLesson ? startLesson.id : 'l1-1-mengenal-papan'}">
            <span>Mulai Belajar</span>
            ${UI_ICONS.arrowRight}
          </button>
          <button type="button" class="btn btn-secondary" data-action="go-learn">
            <span>Jelajahi Kurikulum</span>
          </button>
        </div>
      </div>
    `;
  }

  // Kartu E: Rekomendasi Belajar berdasarkan urutan kurikulum
  let recommendationsHtml = '';
  if (recommendedLessons.length === 0) {
    recommendationsHtml = `
      <div class="empty-state-box">
        <div class="empty-state-icon">${UI_ICONS.trophy}</div>
        <h4>Seluruh Kurikulum Telah Selesai!</h4>
        <p>Anda telah menuntaskan seluruh 30 materi dari Level 1 hingga Level 6. Anda tetap dapat mengulang latihan pada materi mana saja.</p>
        <button type="button" class="btn btn-secondary" data-action="go-learn">Buka Daftar Materi</button>
      </div>
    `;
  } else {
    recommendationsHtml = `
      <div class="recommendation-list">
        ${recommendedLessons
          .map(
            (lesson, index) => `
          <article class="recommendation-card ${index === 0 ? 'is-primary-recommendation' : ''}">
            <div class="rec-card-top">
              <span class="rec-order-pill">Materi #${lesson.order}</span>
              ${
                index === 0
                  ? `<span class="badge badge-accent">Direkomendasikan Selanjutnya</span>`
                  : `<span class="badge badge-neutral">${lesson.categoryShortTitle}</span>`
              }
            </div>
            <h4 class="rec-title">${lesson.title}</h4>
            <p class="rec-subtitle">${lesson.subtitle}</p>
            <div class="rec-footer">
              <div class="rec-meta-tags">
                <span class="meta-tag">+${lesson.xpReward} XP</span>
                <span class="meta-tag">~${lesson.estimatedMinutes} menit</span>
              </div>
              <button type="button" class="btn ${index === 0 ? 'btn-primary' : 'btn-secondary'} btn-sm" data-open-lesson="${lesson.id}">
                <span>Pelajari</span>
                ${UI_ICONS.arrowRight}
              </button>
            </div>
          </article>
        `
          )
          .join('')}
      </div>
    `;
  }

  // Ringkasan progres per level di dalam kartu Progress Belajar
  const categoryMiniRowsHtml = categoriesSummary
    .map(
      cat => `
      <div class="cat-mini-row">
        <div class="cat-mini-info">
          <span class="cat-mini-name">${cat.title}</span>
          <span class="cat-mini-status status-${cat.statusCode}">${cat.status} (${cat.completedLessons}/${cat.totalLessons})</span>
        </div>
        <div class="progress-bar-track progress-track-sm">
          <div class="progress-bar-fill" style="width: ${cat.percentage}%"></div>
        </div>
      </div>
    `
    )
    .join('');

  container.innerHTML = `
    <div class="dashboard-page">
      <!-- A. Greeting -->
      <section class="card greeting-banner" aria-labelledby="greeting-heading">
        <div class="greeting-content">
          <div class="greeting-eyebrow">
            <span class="app-pill">CATURAN • MVP 1</span>
          </div>
          <h1 id="greeting-heading" class="greeting-title">
            Selamat Datang di Caturan!
          </h1>
          <p class="greeting-description">
            ${activitySummaryText}
          </p>
        </div>
        <div class="greeting-side-box">
          <div class="level-summary-chip">
            <span class="chip-label">Status Saat Ini</span>
            <strong class="chip-value">Level ${level} — ${levelInfo.title}</strong>
            <span class="chip-sub">
              ${
                levelInfo.nextLevel !== null
                  ? `Butuh ${levelInfo.xpNeededForNext} XP lagi menuju Level ${levelInfo.nextLevel}`
                  : 'Level tertinggi tercapai!'
              }
            </span>
          </div>
        </div>
      </section>

      <!-- B. Statistik Belajar -->
      <section class="dashboard-section" aria-label="Statistik Belajar">
        <div class="stats-grid">
          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.trophy}</div>
            <div class="stat-body">
              <span class="stat-label">Level Pengguna</span>
              <strong class="stat-value" data-testid="stat-level">${level}</strong>
              <span class="stat-caption">${levelInfo.title}</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.zap}</div>
            <div class="stat-body">
              <span class="stat-label">Total XP</span>
              <strong class="stat-value" data-testid="stat-xp">${totalXp}</strong>
              <span class="stat-caption">Poin pengalaman belajar</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.checkCircle}</div>
            <div class="stat-body">
              <span class="stat-label">Materi Selesai</span>
              <strong class="stat-value" data-testid="stat-completed">${completedCount}</strong>
              <span class="stat-caption">Dari total ${totalLessonsCount} materi kurikulum</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.flame}</div>
            <div class="stat-body">
              <span class="stat-label">Streak Belajar</span>
              <strong class="stat-value" data-testid="stat-streak">${streak} <small>Hari</small></strong>
              <span class="stat-caption">${streak > 0 ? 'Aktif belajar hari ini!' : 'Selesaikan 1 materi untuk mulai streak'}</span>
            </div>
          </article>
        </div>
      </section>

      <!-- Grid Utama: C. Progress Belajar & D. Lanjutkan Belajar -->
      <div class="dashboard-two-col">
        <!-- D. Lanjutkan Belajar -->
        <section class="card dashboard-panel" aria-labelledby="continue-heading">
          <div class="panel-header">
            <div>
              <h2 id="continue-heading" class="panel-title">Lanjutkan Belajar</h2>
              <p class="panel-subtitle">Akses cepat ke sesi pembelajaran terakhir Anda</p>
            </div>
          </div>
          ${continueCardHtml}
        </section>

        <!-- C. Progress Belajar -->
        <section class="card dashboard-panel" aria-labelledby="progress-heading">
          <div class="panel-header">
            <div>
              <h2 id="progress-heading" class="panel-title">Progress Belajar</h2>
              <p class="panel-subtitle">Capaian kurikulum dari tingkat dasar hingga mahir</p>
            </div>
            <div class="overall-percent-pill" data-testid="progress-percentage">
              ${overallPercentage}%
            </div>
          </div>

          <div class="overall-progress-block">
            <div class="progress-bar-track progress-track-lg" role="progressbar" aria-valuenow="${overallPercentage}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar-fill" style="width: ${overallPercentage}%"></div>
            </div>
            <div class="overall-progress-stats">
              <span><strong>${completedCount}</strong> materi selesai</span>
              <span><strong>${totalLessonsCount}</strong> materi tersedia</span>
            </div>
          </div>

          <div class="category-mini-breakdown">
            ${categoryMiniRowsHtml}
          </div>
        </section>
      </div>

      <!-- E. Rekomendasi Belajar -->
      <section class="card dashboard-panel" aria-labelledby="recommendations-heading">
        <div class="panel-header">
          <div>
            <h2 id="recommendations-heading" class="panel-title">Rekomendasi Belajar</h2>
            <p class="panel-subtitle">Materi berikutnya yang disarankan berdasarkan urutan kurikulum terstruktur</p>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" data-action="go-learn">
            <span>Lihat Seluruh Kurikulum</span>
          </button>
        </div>
        ${recommendationsHtml}
      </section>

      ${
        completedCount > 0 || continueLesson
          ? `
        <div class="dashboard-utility-bar">
          <span class="utility-text">Ingin mengulang progres simulasi dari kondisi awal (0 XP)?</span>
          <button type="button" class="btn btn-outline btn-sm" data-action="reset-progress">
            Reset Progres Lokal
          </button>
        </div>
      `
          : ''
      }
    </div>
  `;

  // Bind event klik materi
  const lessonBtns = container.querySelectorAll('[data-open-lesson]');
  lessonBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const lessonId = btn.getAttribute('data-open-lesson');
      if (lessonId && typeof onOpenLesson === 'function') {
        onOpenLesson(lessonId);
      }
    });
  });

  // Bind tombol ke halaman Belajar
  const goLearnBtns = container.querySelectorAll('[data-action="go-learn"]');
  goLearnBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof onGoToLearn === 'function') {
        onGoToLearn();
      }
    });
  });

  // Bind tombol reset progres lokal
  const resetBtn = container.querySelector('[data-action="reset-progress"]');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (typeof onResetProgress === 'function') {
        onResetProgress();
      }
    });
  }
}
