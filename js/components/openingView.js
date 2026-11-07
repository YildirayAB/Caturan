/**
 * Komponen Halaman Opening Dashboard & Opening Library (MVP 4 — Bagian 3, 4, 7)
 * Menampilkan:
 * 1. Opening Dashboard:
 *    - Header (Judul: Opening Trainer, deskripsi singkat, sapaan pengguna)
 *    - Statistik aktual (Total opening dipelajari, Total variasi dikuasai, Total sesi latihan,
 *      Tingkat keberhasilan, Opening yang terakhir dipelajari)
 *    - Repertoire Putih & Repertoire Hitam (jumlah tersedia, dipelajari, progress, tombol Jelajahi)
 *    - Opening Categories (Open Games, Semi-Open Games, Closed Games, Semi-Closed Games, Flank Openings)
 * 2. Opening Library:
 *    - Filter Repertoire (Putih / Hitam), Kategori, Tingkat Kesulitan, Status Belajar, dan Pencarian Nama/ECO
 *    - Kartu Opening lengkap dengan tombol Pelajari & Latihan
 */

import { UI_ICONS } from './icons.js';
import {
  OPENING_CATEGORIES,
  OPENING_DIFFICULTIES,
  OPENING_STATUS_META,
  getAllOpenings,
  getOpeningFamilies,
  getOpeningsByFilter
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

function getStatusBadgeClass(statusId) {
  switch (statusId) {
    case 'mastered':
      return 'badge-success';
    case 'needs-review':
      return 'badge-warning';
    case 'studying':
      return 'badge-in-progress';
    default:
      return 'badge-neutral';
  }
}

function getDifficultyBadgeClass(difficultyId) {
  switch (difficultyId) {
    case 'beginner':
      return 'badge-success';
    case 'intermediate':
      return 'badge-in-progress';
    case 'advanced':
      return 'badge-accent';
    default:
      return 'badge-neutral';
  }
}

export function renderOpeningDashboardView(
  container,
  {
    openingSummary,
    userEmail = null,
    onExploreLibrary,
    onOpenLearn,
    onStartPractice
  } = {}
) {
  if (!container || !openingSummary) return;

  const {
    totalOpeningsCount,
    studiedCount,
    masteredCount,
    totalPracticeSessions,
    successRate,
    lastStudiedOpening,
    repertoireSummary,
    categoriesSummary
  } = openingSummary;

  const userName = userEmail ? userEmail.split('@')[0] : 'Pecatur Caturan';
  const greetingText =
    studiedCount === 0 && totalPracticeSessions === 0
      ? 'Belum ada riwayat belajar opening. Seluruh statistik dimulai secara jujur dari 0 — pilih Repertoire Putih atau Hitam untuk mulai mempelajari pembukaan catur!'
      : `Anda telah mempelajari ${studiedCount} dari ${totalOpeningsCount} variasi opening, menguasai ${masteredCount} variasi, dan menyelesaikan ${totalPracticeSessions} sesi latihan dengan tingkat keberhasilan ${successRate}%.`;

  const whiteRep = repertoireSummary.white;
  const blackRep = repertoireSummary.black;

  // Kartu Opening Terakhir Dipelajari
  let lastStudiedHtml = '';
  if (lastStudiedOpening) {
    const repLabel =
      lastStudiedOpening.repertoireSide === 'black' ? 'Repertoire Hitam' : 'Repertoire Putih';
    const statusClass = getStatusBadgeClass(lastStudiedOpening.status);
    lastStudiedHtml = `
      <div class="opening-last-studied-card" data-testid="opening-last-studied-card">
        <div class="opening-last-studied-info">
          <div class="opening-card-badges">
            <span class="badge badge-accent">ECO ${escapeHtml(lastStudiedOpening.eco)}</span>
            <span class="badge badge-neutral">${escapeHtml(repLabel)}</span>
            <span class="badge badge-neutral">${escapeHtml(lastStudiedOpening.category)}</span>
            <span class="badge ${statusClass}" data-testid="last-studied-status">
              ${escapeHtml(lastStudiedOpening.statusLabel)}
            </span>
          </div>
          <h3 class="opening-last-studied-title" data-testid="last-studied-name">
            ${escapeHtml(lastStudiedOpening.name)}
          </h3>
          <p class="opening-last-studied-desc">${escapeHtml(lastStudiedOpening.description)}</p>
          <p class="opening-last-studied-pgn">
            <strong>Urutan Langkah:</strong> <code>${escapeHtml(lastStudiedOpening.pgn)}</code>
          </p>
        </div>
        <div class="opening-last-studied-actions">
          <button
            type="button"
            class="btn btn-secondary"
            data-action="learn-opening"
            data-opening-id="${escapeHtml(lastStudiedOpening.id)}"
            data-testid="last-studied-learn-btn"
          >
            ${UI_ICONS.learn}
            <span>Pelajari Detail</span>
          </button>
          <button
            type="button"
            class="btn btn-primary"
            data-action="practice-opening"
            data-opening-id="${escapeHtml(lastStudiedOpening.id)}"
            data-testid="last-studied-practice-btn"
          >
            ${UI_ICONS.target}
            <span>Latihan Variasi</span>
          </button>
        </div>
      </div>
    `;
  } else {
    lastStudiedHtml = `
      <div class="opening-last-studied-empty" data-testid="opening-last-studied-empty">
        <p class="opening-empty-title" data-testid="last-studied-name">Belum ada opening yang dipelajari</p>
        <p class="opening-empty-subtitle">
          Pilih salah satu variasi di Repertoire Putih, Repertoire Hitam, atau Koleksi Opening untuk mulai mempelajari langkah pembukaan.
        </p>
        <div class="opening-empty-actions">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            data-action="open-library"
            data-testid="empty-explore-library-btn"
          >
            <span>Jelajahi Koleksi Opening</span>
            ${UI_ICONS.arrowRight}
          </button>
        </div>
      </div>
    `;
  }

  const families = getOpeningFamilies('all');

  container.innerHTML = `
    <div class="opening-dashboard-view" data-testid="opening-dashboard-view">
      <!-- 1. Header Opening Trainer -->
      <section class="hero-banner opening-hero-banner" aria-labelledby="opening-dashboard-heading">
        <div class="hero-content">
          <div class="greeting-pill">
            <span>Halo, <strong>${escapeHtml(userName)}</strong>! • Pembelajaran & Latihan Repertoire</span>
          </div>
          <h1 id="opening-dashboard-heading" class="hero-title">Opening Trainer</h1>
          <p class="hero-subtitle">
            Pelajari prinsip strategis, pahami urutan langkah pada papan interaktif, dan latih daya ingat pembukaan catur untuk Repertoire Putih maupun Hitam.
          </p>
          <p class="opening-greeting-progress" data-testid="opening-greeting-summary">
            ${escapeHtml(greetingText)}
          </p>
          <div class="hero-actions">
            <button
              type="button"
              class="btn btn-primary btn-lg"
              data-action="open-library"
              data-testid="opening-explore-library-btn"
            >
              ${UI_ICONS.opening}
              <span>Buka Koleksi Opening (${totalOpeningsCount} Variasi)</span>
            </button>
            <button
              type="button"
              class="btn btn-secondary btn-lg"
              data-action="practice-opening"
              data-opening-id="${escapeHtml(lastStudiedOpening ? lastStudiedOpening.id : 'italian-game-main')}"
              data-testid="opening-quick-practice-btn"
            >
              ${UI_ICONS.target}
              <span>Mulai Mode Latihan</span>
            </button>
          </div>
        </div>
      </section>

      <!-- 2. Statistik Aktual Opening Trainer -->
      <section class="stats-grid opening-stats-grid" aria-label="Statistik Opening Trainer">
        <article class="stat-card" data-testid="stat-opening-studied">
          <div class="stat-card-header">
            <span class="stat-label">Total Opening Dipelajari</span>
            <span class="stat-icon icon-teal">${UI_ICONS.learn}</span>
          </div>
          <div class="stat-value" data-testid="stat-studied-value">${studiedCount} / ${totalOpeningsCount}</div>
          <div class="stat-meta">Variasi yang telah dibuka atau dilatih</div>
        </article>

        <article class="stat-card" data-testid="stat-opening-mastered">
          <div class="stat-card-header">
            <span class="stat-label">Total Variasi Dikuasai</span>
            <span class="stat-icon icon-amber">${UI_ICONS.trophy}</span>
          </div>
          <div class="stat-value" data-testid="stat-mastered-value">${masteredCount} / ${totalOpeningsCount}</div>
          <div class="stat-meta">Lulus latihan tanpa salah & tanpa hint</div>
        </article>

        <article class="stat-card" data-testid="stat-opening-sessions">
          <div class="stat-card-header">
            <span class="stat-label">Total Sesi Latihan</span>
            <span class="stat-icon icon-orange">${UI_ICONS.target}</span>
          </div>
          <div class="stat-value" data-testid="stat-sessions-value">${totalPracticeSessions}</div>
          <div class="stat-meta">Sesi latihan pembukaan yang terekam</div>
        </article>

        <article class="stat-card" data-testid="stat-opening-success-rate">
          <div class="stat-card-header">
            <span class="stat-label">Tingkat Keberhasilan</span>
            <span class="stat-icon icon-green">${UI_ICONS.check}</span>
          </div>
          <div class="stat-value" data-testid="stat-success-rate-value">${successRate}%</div>
          <div class="stat-meta">Akurasi ketepatan langkah latihan</div>
        </article>
      </section>

      <!-- Opening Terakhir Dipelajari -->
      <section class="dashboard-section" aria-labelledby="last-studied-heading">
        <div class="section-header">
          <div>
            <h2 id="last-studied-heading" class="section-title">Opening Terakhir Dipelajari</h2>
            <p class="section-subtitle">Lanjutkan sesi belajar atau uji ingatan Anda pada variasi terakhir</p>
          </div>
        </div>
        ${lastStudiedHtml}
      </section>

      <!-- 3. Repertoire Putih & Repertoire Hitam -->
      <section class="dashboard-section" aria-labelledby="repertoire-section-heading">
        <div class="section-header">
          <div>
            <h2 id="repertoire-section-heading" class="section-title">Repertoire Pembukaan</h2>
            <p class="section-subtitle">Pilih sudut pandang permainan untuk membangun repertoar langkah awal yang terstruktur</p>
          </div>
        </div>

        <div class="opening-repertoire-grid" data-testid="opening-repertoire-grid">
          <!-- Repertoire Putih -->
          <article class="opening-repertoire-card repertoire-white-card" data-testid="repertoire-card-white">
            <div class="repertoire-card-top">
              <div class="repertoire-side-badge side-white">
                <span class="side-dot dot-white"></span>
                <span>Putih</span>
              </div>
              <span class="badge badge-neutral">${whiteRep.totalAvailable} Variasi Tersedia</span>
            </div>
            <h3 class="repertoire-card-title">${escapeHtml(whiteRep.title)}</h3>
            <p class="repertoire-card-desc">${escapeHtml(whiteRep.description)}</p>

            <div class="repertoire-stats-row">
              <div class="repertoire-stat-box">
                <span class="repertoire-stat-num" data-testid="white-rep-available">${whiteRep.totalAvailable}</span>
                <span class="repertoire-stat-lbl">Tersedia</span>
              </div>
              <div class="repertoire-stat-box">
                <span class="repertoire-stat-num" data-testid="white-rep-studied">${whiteRep.studiedCount}</span>
                <span class="repertoire-stat-lbl">Dipelajari</span>
              </div>
              <div class="repertoire-stat-box">
                <span class="repertoire-stat-num" data-testid="white-rep-mastered">${whiteRep.masteredCount}</span>
                <span class="repertoire-stat-lbl">Dikuasai</span>
              </div>
              <div class="repertoire-stat-box">
                <span class="repertoire-stat-num" data-testid="white-rep-pct">${whiteRep.percentage}%</span>
                <span class="repertoire-stat-lbl">Progres</span>
              </div>
            </div>

            <div class="progress-bar-track" aria-label="Progres Repertoire Putih ${whiteRep.percentage}%">
              <div class="progress-bar-fill" style="width: ${whiteRep.percentage}%"></div>
            </div>

            <div class="repertoire-card-actions">
              <button
                type="button"
                class="btn btn-primary"
                data-action="explore-repertoire"
                data-repertoire="white"
                data-testid="explore-white-repertoire-btn"
              >
                <span>Jelajahi Repertoire Putih</span>
                ${UI_ICONS.arrowRight}
              </button>
            </div>
          </article>

          <!-- Repertoire Hitam -->
          <article class="opening-repertoire-card repertoire-black-card" data-testid="repertoire-card-black">
            <div class="repertoire-card-top">
              <div class="repertoire-side-badge side-black">
                <span class="side-dot dot-black"></span>
                <span>Hitam</span>
              </div>
              <span class="badge badge-neutral">${blackRep.totalAvailable} Variasi Tersedia</span>
            </div>
            <h3 class="repertoire-card-title">${escapeHtml(blackRep.title)}</h3>
            <p class="repertoire-card-desc">${escapeHtml(blackRep.description)}</p>

            <div class="repertoire-stats-row">
              <div class="repertoire-stat-box">
                <span class="repertoire-stat-num" data-testid="black-rep-available">${blackRep.totalAvailable}</span>
                <span class="repertoire-stat-lbl">Tersedia</span>
              </div>
              <div class="repertoire-stat-box">
                <span class="repertoire-stat-num" data-testid="black-rep-studied">${blackRep.studiedCount}</span>
                <span class="repertoire-stat-lbl">Dipelajari</span>
              </div>
              <div class="repertoire-stat-box">
                <span class="repertoire-stat-num" data-testid="black-rep-mastered">${blackRep.masteredCount}</span>
                <span class="repertoire-stat-lbl">Dikuasai</span>
              </div>
              <div class="repertoire-stat-box">
                <span class="repertoire-stat-num" data-testid="black-rep-pct">${blackRep.percentage}%</span>
                <span class="repertoire-stat-lbl">Progres</span>
              </div>
            </div>

            <div class="progress-bar-track" aria-label="Progres Repertoire Hitam ${blackRep.percentage}%">
              <div class="progress-bar-fill" style="width: ${blackRep.percentage}%"></div>
            </div>

            <div class="repertoire-card-actions">
              <button
                type="button"
                class="btn btn-primary"
                data-action="explore-repertoire"
                data-repertoire="black"
                data-testid="explore-black-repertoire-btn"
              >
                <span>Jelajahi Repertoire Hitam</span>
                ${UI_ICONS.arrowRight}
              </button>
            </div>
          </article>
        </div>
      </section>

      <!-- 4. Opening Categories -->
      <section class="dashboard-section" aria-labelledby="opening-categories-heading">
        <div class="section-header">
          <div>
            <h2 id="opening-categories-heading" class="section-title">Kategori Pembukaan (Opening Categories)</h2>
            <p class="section-subtitle">Klasifikasi pembukaan catur berdasarkan struktur langkah awal di pusat maupun sayap</p>
          </div>
        </div>

        <div class="opening-categories-grid" data-testid="opening-categories-grid">
          ${categoriesSummary
            .map(
              cat => `
            <article class="opening-category-card" data-testid="opening-category-${escapeHtml(cat.id)}">
              <div class="opening-category-header">
                <div>
                  <h3 class="opening-category-title">${escapeHtml(cat.title)}</h3>
                  <span class="opening-category-sub">${escapeHtml(cat.subtitle)}</span>
                </div>
                <span class="badge badge-neutral">${cat.studiedOpenings} / ${cat.totalOpenings} Dipelajari</span>
              </div>
              <p class="opening-category-desc">${escapeHtml(cat.description)}</p>
              <div class="progress-bar-track">
                <div class="progress-bar-fill" style="width: ${cat.percentage}%"></div>
              </div>
              <div class="opening-category-footer">
                <span class="opening-category-meta">${cat.masteredOpenings} Dikuasai (${cat.percentage}% Dipelajari)</span>
                <button
                  type="button"
                  class="btn btn-secondary btn-sm"
                  data-action="explore-category"
                  data-category="${escapeHtml(cat.id)}"
                  data-testid="explore-category-${escapeHtml(cat.id)}"
                >
                  <span>Jelajahi</span>
                  ${UI_ICONS.arrowRight}
                </button>
              </div>
            </article>
          `
            )
            .join('')}
        </div>
      </section>

      <!-- 5. Keluarga Opening & Variasi Populer -->
      <section class="dashboard-section" aria-labelledby="opening-families-heading">
        <div class="section-header">
          <div>
            <h2 id="opening-families-heading" class="section-title">Keluarga Pembukaan & Variasi</h2>
            <p class="section-subtitle">Satu pembukaan memiliki beberapa variasi — pilih variasi spesifik untuk dipelajari atau dilatih</p>
          </div>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="open-library"
          >
            <span>Lihat Semua di Library</span>
          </button>
        </div>

        <div class="opening-families-grid" data-testid="opening-families-grid">
          ${families
            .map(
              fam => `
            <article class="opening-family-card">
              <div class="opening-family-head">
                <h3 class="opening-family-title">${escapeHtml(fam.family)}</h3>
                <span class="badge badge-neutral">${fam.variations.length} Variasi</span>
              </div>
              <span class="opening-family-cat">${escapeHtml(fam.category)}</span>
              <ul class="opening-family-variation-list">
                ${fam.variations
                  .map(
                    v => `
                  <li class="opening-family-variation-item">
                    <div class="variation-item-main">
                      <span class="badge badge-accent">${escapeHtml(v.eco)}</span>
                      <span class="variation-item-name">${escapeHtml(v.name)}</span>
                    </div>
                    <div class="variation-item-actions">
                      <button
                        type="button"
                        class="btn btn-secondary btn-sm"
                        data-action="learn-opening"
                        data-opening-id="${escapeHtml(v.id)}"
                      >
                        Pelajari
                      </button>
                      <button
                        type="button"
                        class="btn btn-primary btn-sm"
                        data-action="practice-opening"
                        data-opening-id="${escapeHtml(v.id)}"
                      >
                        Latihan
                      </button>
                    </div>
                  </li>
                `
                  )
                  .join('')}
              </ul>
            </article>
          `
            )
            .join('')}
        </div>
      </section>
    </div>
  `;

  // Bind events
  container.querySelectorAll('[data-action="open-library"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof onExploreLibrary === 'function') {
        onExploreLibrary({ repertoireSide: 'all', category: 'all' });
      }
    });
  });

  container.querySelectorAll('[data-action="explore-repertoire"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const side = btn.getAttribute('data-repertoire') || 'all';
      if (typeof onExploreLibrary === 'function') {
        onExploreLibrary({ repertoireSide: side, category: 'all' });
      }
    });
  });

  container.querySelectorAll('[data-action="explore-category"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const category = btn.getAttribute('data-category') || 'all';
      if (typeof onExploreLibrary === 'function') {
        onExploreLibrary({ repertoireSide: 'all', category });
      }
    });
  });

  container.querySelectorAll('[data-action="learn-opening"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const openingId = btn.getAttribute('data-opening-id');
      if (openingId && typeof onOpenLearn === 'function') {
        onOpenLearn(openingId);
      }
    });
  });

  container.querySelectorAll('[data-action="practice-opening"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const openingId = btn.getAttribute('data-opening-id');
      if (openingId && typeof onStartPractice === 'function') {
        onStartPractice(openingId);
      }
    });
  });
}

/**
 * Merender Halaman Koleksi Opening (MVP 4 — Bagian 4: Opening Library)
 */
export function renderOpeningLibraryView(
  container,
  {
    initialFilters = {},
    getOpeningStatus,
    onBackToDashboard,
    onOpenLearn,
    onStartPractice,
    onFilterChange
  } = {}
) {
  if (!container) return;

  const state = {
    repertoireSide: initialFilters.repertoireSide || 'all',
    category: initialFilters.category || 'all',
    difficulty: initialFilters.difficulty || 'all',
    status: initialFilters.status || 'all',
    searchQuery: initialFilters.searchQuery || ''
  };

  const statusResolver =
    typeof getOpeningStatus === 'function' ? getOpeningStatus : () => 'not-studied';

  const renderLibraryContent = () => {
    const filteredOpenings = getOpeningsByFilter({
      repertoireSide: state.repertoireSide,
      category: state.category,
      difficulty: state.difficulty,
      status: state.status,
      searchQuery: state.searchQuery,
      statusResolver
    });

    const totalAll = getAllOpenings().length;

    const cardsHtml =
      filteredOpenings.length > 0
        ? filteredOpenings
            .map(opening => {
              const statusId = statusResolver(opening.id);
              const statusMeta =
                OPENING_STATUS_META[statusId] || OPENING_STATUS_META['not-studied'];
              const statusBadgeClass = getStatusBadgeClass(statusId);
              const diffBadgeClass = getDifficultyBadgeClass(opening.difficulty);
              const repLabel =
                opening.repertoireSide === 'black' ? 'Repertoire Hitam' : 'Repertoire Putih';

              return `
                <article
                  class="opening-library-card"
                  data-testid="opening-card-${escapeHtml(opening.id)}"
                  data-opening-id="${escapeHtml(opening.id)}"
                >
                  <div class="opening-card-top">
                    <div class="opening-card-badges">
                      <span class="badge badge-accent" title="Kode klasifikasi Encyclopedia of Chess Openings (bukan rating kekuatan)">
                        ECO ${escapeHtml(opening.eco)}
                      </span>
                      <span class="badge badge-neutral">${escapeHtml(opening.category)}</span>
                      <span class="badge badge-neutral">${escapeHtml(repLabel)}</span>
                    </div>
                    <span
                      class="badge ${statusBadgeClass}"
                      data-testid="opening-card-status-${escapeHtml(opening.id)}"
                    >
                      ${escapeHtml(statusMeta.label)}
                    </span>
                  </div>

                  <h3 class="opening-card-title">${escapeHtml(opening.name)}</h3>
                  <p class="opening-card-variation">${escapeHtml(opening.variationName)}</p>
                  <p class="opening-card-desc">${escapeHtml(opening.description)}</p>

                  <div class="opening-card-meta-grid">
                    <div class="opening-meta-item">
                      <span class="opening-meta-label">Jumlah Langkah</span>
                      <span class="opening-meta-value" data-testid="opening-card-moves-${escapeHtml(opening.id)}">
                        ${opening.plyCount} ply (${opening.fullMoveCount} langkah)
                      </span>
                    </div>
                    <div class="opening-meta-item">
                      <span class="opening-meta-label">Tingkat Kesulitan</span>
                      <span class="badge ${diffBadgeClass}">
                        ${escapeHtml(opening.difficultyLabel)}
                      </span>
                    </div>
                  </div>

                  <div class="opening-card-pgn-box">
                    <code>${escapeHtml(opening.pgn)}</code>
                  </div>

                  <div class="opening-card-actions">
                    <button
                      type="button"
                      class="btn btn-secondary"
                      data-action="card-learn"
                      data-opening-id="${escapeHtml(opening.id)}"
                      data-testid="opening-card-learn-${escapeHtml(opening.id)}"
                    >
                      ${UI_ICONS.learn}
                      <span>Pelajari</span>
                    </button>
                    <button
                      type="button"
                      class="btn btn-primary"
                      data-action="card-practice"
                      data-opening-id="${escapeHtml(opening.id)}"
                      data-testid="opening-card-practice-${escapeHtml(opening.id)}"
                    >
                      ${UI_ICONS.target}
                      <span>Latihan</span>
                    </button>
                  </div>
                </article>
              `;
            })
            .join('')
        : `
          <div class="opening-library-empty" data-testid="opening-library-empty">
            <p class="opening-empty-title">Tidak ada opening yang cocok dengan filter pencarian.</p>
            <p class="opening-empty-subtitle">Coba ubah filter Repertoire, Kategori, Kesulitan, Status, atau kata kunci nama/ECO.</p>
            <button type="button" class="btn btn-secondary btn-sm" data-action="reset-filters" data-testid="opening-reset-filters-btn">
              Reset Semua Filter
            </button>
          </div>
        `;

    container.innerHTML = `
      <div class="opening-library-view" data-testid="opening-library-view">
        <div class="detail-topbar">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="back-dashboard"
            data-testid="opening-library-back-btn"
          >
            ${UI_ICONS.chevronLeft}
            <span>Kembali ke Dashboard Opening</span>
          </button>
          <span class="badge badge-neutral" data-testid="opening-library-count-badge">
            Menampilkan ${filteredOpenings.length} dari ${totalAll} Variasi Opening
          </span>
        </div>

        <header class="page-header">
          <h1 class="page-title">Koleksi Opening (Opening Library)</h1>
          <p class="page-subtitle">
            Jelajahi seluruh variasi pembukaan tervalidasi. Gunakan filter Repertoire, Kategori, Kesulitan, Status Belajar, atau cari berdasarkan nama maupun kode ECO.
            <small class="opening-eco-note">(Catatan: Kode ECO adalah kode klasifikasi ensiklopedia pembukaan, bukan ukuran kekuatan teori.)</small>
          </p>
        </header>

        <!-- Panel Filter & Pencarian -->
        <section class="opening-filter-panel" aria-label="Filter Koleksi Opening">
          <div class="opening-filter-row">
            <div class="opening-filter-group opening-search-group">
              <label for="opening-search-input" class="opening-filter-label">Cari Nama atau Kode ECO</label>
              <input
                id="opening-search-input"
                type="search"
                class="opening-filter-input"
                placeholder="Contoh: Italian, Sicilian, C50, B90, London..."
                value="${escapeHtml(state.searchQuery)}"
                data-testid="opening-search-input"
              />
            </div>

            <div class="opening-filter-group">
              <label for="opening-repertoire-select" class="opening-filter-label">Repertoire</label>
              <select
                id="opening-repertoire-select"
                class="opening-filter-select"
                data-testid="opening-filter-repertoire"
              >
                <option value="all" ${state.repertoireSide === 'all' ? 'selected' : ''}>Semua Repertoire</option>
                <option value="white" ${state.repertoireSide === 'white' ? 'selected' : ''}>Repertoire Putih</option>
                <option value="black" ${state.repertoireSide === 'black' ? 'selected' : ''}>Repertoire Hitam</option>
              </select>
            </div>

            <div class="opening-filter-group">
              <label for="opening-category-select" class="opening-filter-label">Kategori</label>
              <select
                id="opening-category-select"
                class="opening-filter-select"
                data-testid="opening-filter-category"
              >
                <option value="all" ${state.category === 'all' ? 'selected' : ''}>Semua Kategori</option>
                ${OPENING_CATEGORIES.map(
                  cat => `
                  <option value="${escapeHtml(cat.id)}" ${
                    state.category === cat.id || state.category === cat.title ? 'selected' : ''
                  }>
                    ${escapeHtml(cat.title)}
                  </option>
                `
                ).join('')}
              </select>
            </div>

            <div class="opening-filter-group">
              <label for="opening-difficulty-select" class="opening-filter-label">Tingkat Kesulitan</label>
              <select
                id="opening-difficulty-select"
                class="opening-filter-select"
                data-testid="opening-filter-difficulty"
              >
                <option value="all" ${state.difficulty === 'all' ? 'selected' : ''}>Semua Kesulitan</option>
                ${OPENING_DIFFICULTIES.map(
                  diff => `
                  <option value="${escapeHtml(diff.id)}" ${state.difficulty === diff.id ? 'selected' : ''}>
                    ${escapeHtml(diff.title)}
                  </option>
                `
                ).join('')}
              </select>
            </div>

            <div class="opening-filter-group">
              <label for="opening-status-select" class="opening-filter-label">Status Belajar</label>
              <select
                id="opening-status-select"
                class="opening-filter-select"
                data-testid="opening-filter-status"
              >
                <option value="all" ${state.status === 'all' ? 'selected' : ''}>Semua Status</option>
                <option value="not-studied" ${state.status === 'not-studied' ? 'selected' : ''}>Belum Dipelajari</option>
                <option value="studying" ${state.status === 'studying' ? 'selected' : ''}>Sedang Dipelajari</option>
                <option value="needs-review" ${state.status === 'needs-review' ? 'selected' : ''}>Perlu Diulang</option>
                <option value="mastered" ${state.status === 'mastered' ? 'selected' : ''}>Dikuasai</option>
              </select>
            </div>
          </div>
        </section>

        <!-- Grid Kartu Opening -->
        <section class="opening-library-grid" data-testid="opening-library-grid">
          ${cardsHtml}
        </section>
      </div>
    `;

    bindLibraryEvents();
  };

  const bindLibraryEvents = () => {
    const backBtn = container.querySelector('[data-action="back-dashboard"]');
    if (backBtn) {
      backBtn.addEventListener('click', () => {
        if (typeof onBackToDashboard === 'function') {
          onBackToDashboard();
        }
      });
    }

    const searchInput = container.querySelector('#opening-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', e => {
        const cursorPos = e.target.selectionStart;
        state.searchQuery = e.target.value;
        if (typeof onFilterChange === 'function') {
          onFilterChange({ ...state });
        }
        renderLibraryContent();
        const newSearchInput = container.querySelector('#opening-search-input');
        if (newSearchInput) {
          newSearchInput.focus();
          try {
            newSearchInput.setSelectionRange(cursorPos, cursorPos);
          } catch {
            // ignore on non-text input
          }
        }
      });
    }

    const repSelect = container.querySelector('#opening-repertoire-select');
    if (repSelect) {
      repSelect.addEventListener('change', e => {
        state.repertoireSide = e.target.value;
        if (typeof onFilterChange === 'function') {
          onFilterChange({ ...state });
        }
        renderLibraryContent();
      });
    }

    const catSelect = container.querySelector('#opening-category-select');
    if (catSelect) {
      catSelect.addEventListener('change', e => {
        state.category = e.target.value;
        if (typeof onFilterChange === 'function') {
          onFilterChange({ ...state });
        }
        renderLibraryContent();
      });
    }

    const diffSelect = container.querySelector('#opening-difficulty-select');
    if (diffSelect) {
      diffSelect.addEventListener('change', e => {
        state.difficulty = e.target.value;
        if (typeof onFilterChange === 'function') {
          onFilterChange({ ...state });
        }
        renderLibraryContent();
      });
    }

    const statusSelect = container.querySelector('#opening-status-select');
    if (statusSelect) {
      statusSelect.addEventListener('change', e => {
        state.status = e.target.value;
        if (typeof onFilterChange === 'function') {
          onFilterChange({ ...state });
        }
        renderLibraryContent();
      });
    }

    const resetBtn = container.querySelector('[data-action="reset-filters"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state.repertoireSide = 'all';
        state.category = 'all';
        state.difficulty = 'all';
        state.status = 'all';
        state.searchQuery = '';
        if (typeof onFilterChange === 'function') {
          onFilterChange({ ...state });
        }
        renderLibraryContent();
      });
    }

    container.querySelectorAll('[data-action="card-learn"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const openingId = btn.getAttribute('data-opening-id');
        if (openingId && typeof onOpenLearn === 'function') {
          onOpenLearn(openingId);
        }
      });
    });

    container.querySelectorAll('[data-action="card-practice"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const openingId = btn.getAttribute('data-opening-id');
        if (openingId && typeof onStartPractice === 'function') {
          onStartPractice(openingId);
        }
      });
    });
  };

  renderLibraryContent();
}
