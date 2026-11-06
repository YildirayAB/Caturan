/**
 * Komponen Halaman Learn / Belajar Catur (Learn View)
 * Menampilkan 6 Kategori Kurikulum (Level 1 s/d Level 6) dengan total 30 materi,
 * status progres per kategori (Belum dimulai, Sedang dipelajari, Selesai),
 * penanda materi yang direkomendasikan selanjutnya, serta akses ke setiap materi.
 */

import { UI_ICONS } from './icons.js';

export function renderLearnView(container, { summary, activeCategoryFilter = 'all', onFilterChange, onOpenLesson }) {
  if (!container) return;

  const {
    completedCount,
    totalLessonsCount,
    overallPercentage,
    recommendedNextLesson,
    categoriesSummary
  } = summary;

  // Banner Rekomendasi Selanjutnya
  let nextRecommendationBannerHtml = '';
  if (recommendedNextLesson) {
    nextRecommendationBannerHtml = `
      <div class="card next-step-banner">
        <div class="next-step-info">
          <div class="next-step-badges">
            <span class="badge badge-accent">${UI_ICONS.star} Direkomendasikan Selanjutnya</span>
            <span class="badge badge-neutral">${recommendedNextLesson.categoryTitle}</span>
          </div>
          <h2 class="next-step-title">Materi #${recommendedNextLesson.order}: ${recommendedNextLesson.title}</h2>
          <p class="next-step-desc">${recommendedNextLesson.subtitle}</p>
        </div>
        <div class="next-step-action">
          <button type="button" class="btn btn-primary" data-open-lesson="${recommendedNextLesson.id}">
            <span>Pelajari Sekarang (+${recommendedNextLesson.xpReward} XP)</span>
            ${UI_ICONS.arrowRight}
          </button>
        </div>
      </div>
    `;
  } else {
    nextRecommendationBannerHtml = `
      <div class="card next-step-banner is-all-completed">
        <div class="next-step-info">
          <span class="badge badge-success">${UI_ICONS.check} Kurikulum Tuntas 100%</span>
          <h2 class="next-step-title">Selamat! Seluruh 30 Materi Telah Diselesaikan</h2>
          <p class="next-step-desc">Anda tetap dapat memilih materi mana saja di bawah ini untuk mengulang teori dan berlatih kembali di papan interaktif.</p>
        </div>
      </div>
    `;
  }

  // Tombol Filter Kategori
  const filterTabsHtml = `
    <div class="category-filter-tabs" role="tablist" aria-label="Filter Level Kurikulum">
      <button
        type="button"
        class="filter-tab-btn ${activeCategoryFilter === 'all' ? 'is-active' : ''}"
        data-filter="all"
      >
        Semua Level (30)
      </button>
      ${categoriesSummary
        .map(
          cat => `
        <button
          type="button"
          class="filter-tab-btn ${activeCategoryFilter === cat.id ? 'is-active' : ''}"
          data-filter="${cat.id}"
        >
          Level ${cat.level}: ${cat.shortTitle} (${cat.completedLessons}/${cat.totalLessons})
        </button>
      `
        )
        .join('')}
    </div>
  `;

  const visibleCategories =
    activeCategoryFilter === 'all'
      ? categoriesSummary
      : categoriesSummary.filter(c => c.id === activeCategoryFilter);

  const categoriesHtml = visibleCategories
    .map(cat => {
      const lessonsListHtml = cat.lessons
        .map((lesson, idx) => {
          let statusBadgeHtml = '';
          if (lesson.isCompleted) {
            statusBadgeHtml = `<span class="badge badge-success">${UI_ICONS.check} Selesai</span>`;
          } else if (lesson.isRecommendedNext) {
            statusBadgeHtml = `<span class="badge badge-accent">Direkomendasikan Selanjutnya</span>`;
          } else if (lesson.isStarted) {
            statusBadgeHtml = `<span class="badge badge-in-progress">Sedang Dipelajari</span>`;
          } else {
            statusBadgeHtml = `<span class="badge badge-neutral">Tahap Bertahap</span>`;
          }

          return `
            <article class="lesson-row-card ${lesson.isCompleted ? 'is-completed' : ''} ${lesson.isRecommendedNext ? 'is-recommended-next' : ''}">
              <div class="lesson-row-number" aria-hidden="true">
                ${lesson.isCompleted ? UI_ICONS.check : `${cat.level}.${idx + 1}`}
              </div>
              <div class="lesson-row-main">
                <div class="lesson-row-header">
                  <h3 class="lesson-row-title">${lesson.title}</h3>
                  ${statusBadgeHtml}
                </div>
                <p class="lesson-row-subtitle">${lesson.subtitle}</p>
                <div class="lesson-row-meta">
                  <span class="meta-item">Urutan Kurikulum #${lesson.order}</span>
                  <span class="meta-dot">•</span>
                  <span class="meta-item">Hadiah +${lesson.xpReward} XP</span>
                  <span class="meta-dot">•</span>
                  <span class="meta-item">Papan Interaktif</span>
                </div>
              </div>
              <div class="lesson-row-action">
                <button
                  type="button"
                  class="btn ${lesson.isRecommendedNext ? 'btn-primary' : 'btn-secondary'} btn-sm"
                  data-open-lesson="${lesson.id}"
                >
                  <span>${lesson.isCompleted ? 'Ulangi Materi' : lesson.isStarted ? 'Lanjutkan' : 'Buka Materi'}</span>
                  ${UI_ICONS.arrowRight}
                </button>
              </div>
            </article>
          `;
        })
        .join('');

      return `
        <section class="card category-block" id="category-${cat.id}" aria-labelledby="heading-${cat.id}">
          <div class="category-block-header">
            <div class="category-header-left">
              <div class="category-badges-row">
                <span class="level-pill">Level ${cat.level}</span>
                <span class="category-status-badge status-${cat.statusCode}" data-testid="status-${cat.id}">
                  Status: ${cat.status}
                </span>
                <span class="lesson-count-pill">${cat.totalLessons} Materi</span>
              </div>
              <h2 id="heading-${cat.id}" class="category-title">${cat.title}</h2>
              <p class="category-description">${cat.description}</p>
            </div>

            <div class="category-header-right">
              <div class="category-progress-box">
                <div class="category-progress-top">
                  <span class="cat-prog-label">Progress Penyelesaian</span>
                  <strong class="cat-prog-value">${cat.completedLessons}/${cat.totalLessons} (${cat.percentage}%)</strong>
                </div>
                <div class="progress-bar-track">
                  <div class="progress-bar-fill" style="width: ${cat.percentage}%"></div>
                </div>
              </div>
            </div>
          </div>

          <div class="category-lessons-list">
            ${lessonsListHtml}
          </div>
        </section>
      `;
    })
    .join('');

  container.innerHTML = `
    <div class="learn-page">
      <header class="page-intro-header">
        <div>
          <span class="app-pill">KURIKULUM TERSTRUKTUR • 6 LEVEL</span>
          <h1 class="page-main-title">Belajar Catur</h1>
          <p class="page-main-subtitle">
            Pelajari teori catur secara bertahap dari pengenalan papan hingga teknik babak akhir (Endgame). Seluruh materi dilengkapi papan latihan interaktif dan tidak mengunci eksplorasi Anda.
          </p>
        </div>
        <div class="curriculum-global-summary">
          <div class="global-summary-top">
            <span>Total Penyelesaian Kurikulum</span>
            <strong>${completedCount} / ${totalLessonsCount} Materi (${overallPercentage}%)</strong>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill" style="width: ${overallPercentage}%"></div>
          </div>
        </div>
      </header>

      ${nextRecommendationBannerHtml}

      ${filterTabsHtml}

      <div class="categories-stack">
        ${categoriesHtml}
      </div>
    </div>
  `;

  // Bind filter kategori
  const filterBtns = container.querySelectorAll('[data-filter]');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filterId = btn.getAttribute('data-filter');
      if (filterId && typeof onFilterChange === 'function') {
        onFilterChange(filterId);
      }
    });
  });

  // Bind klik buka materi
  const lessonBtns = container.querySelectorAll('[data-open-lesson]');
  lessonBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const lessonId = btn.getAttribute('data-open-lesson');
      if (lessonId && typeof onOpenLesson === 'function') {
        onOpenLesson(lessonId);
      }
    });
  });
}
