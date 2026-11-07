/**
 * Komponen Halaman Detail & Mode Belajar Opening (MVP 4 — Bagian 5: Opening Detail & Learn Mode)
 * Menampilkan:
 * 1. Nama opening, Kode ECO, Repertoire Putih/Hitam, Kategori, Kesulitan, Status Belajar
 * 2. Pemilih Variasi dalam Keluarga Opening yang sama (Bagian 7)
 * 3. Deskripsi & Ide Utama (Key Ideas)
 * 4. Papan Catur Interaktif (OpeningLearnBoard) mulai dari posisi awal standar
 * 5. Daftar Notasi & Riwayat Langkah Interaktif (klik langkah untuk menuju ply tersebut via Chess.js)
 * 6. Tombol Navigasi Langkah (Awal, Sebelumnya, Berikutnya, Balik Papan)
 * 7. Explanation Panel (Tujuan umum, Ide pengembangan bidak, Kontrol pusat, Keamanan raja, Rencana umum)
 * 8. Tombol Latihan Opening
 */

import { UI_ICONS } from './icons.js';
import { OpeningLearnBoard } from './chessboardUI.js';
import { getOpeningById, getOpeningsByFamily } from '../data/openings.js';

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

export function renderOpeningLearnView(
  container,
  {
    openingId,
    statusInfo = { id: 'studying', label: 'Sedang Dipelajari' },
    onBackToLibrary,
    onBackToDashboard,
    onSelectVariation,
    onStartPractice
  } = {}
) {
  if (!container) return null;

  const opening = getOpeningById(openingId) || getOpeningById('italian-game-main');
  if (!opening) return null;

  const familyVariations = getOpeningsByFamily(opening.family);
  const repLabel =
    opening.repertoireSide === 'black' ? 'Repertoire Hitam' : 'Repertoire Putih';
  const statusBadgeClass = getStatusBadgeClass(statusInfo?.id);
  const exp = opening.explanationPanel || {};

  // Susun pasangan langkah (Putih & Hitam) untuk tabel notasi interaktif
  const moveRows = [];
  const annotations = Array.isArray(opening.moveAnnotations) ? opening.moveAnnotations : [];
  for (let i = 0; i < annotations.length; i += 2) {
    const whiteMove = annotations[i];
    const blackMove = annotations[i + 1] || null;
    moveRows.push({
      moveNumber: Math.floor(i / 2) + 1,
      whiteMove,
      blackMove
    });
  }

  container.innerHTML = `
    <div class="lesson-detail-view opening-learn-view" data-testid="opening-learn-view">
      <!-- Topbar Navigasi -->
      <div class="detail-topbar">
        <div class="detail-topbar-left">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="back-library"
            data-testid="opening-learn-back-library-btn"
          >
            ${UI_ICONS.chevronLeft}
            <span>Koleksi Opening</span>
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="back-dashboard"
            data-testid="opening-learn-back-dashboard-btn"
          >
            <span>Dashboard Opening</span>
          </button>
        </div>

        <div class="detail-topbar-right">
          <span class="badge ${statusBadgeClass}" data-testid="opening-learn-status-badge">
            ${escapeHtml(statusInfo?.label || 'Sedang Dipelajari')}
          </span>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            data-action="start-practice"
            data-testid="opening-detail-practice-btn"
          >
            ${UI_ICONS.target}
            <span>Latihan Opening Ini</span>
          </button>
        </div>
      </div>

      <!-- Header Detail Opening -->
      <header class="opening-detail-header">
        <div class="opening-detail-badges">
          <span class="badge badge-accent" data-testid="opening-detail-eco">ECO ${escapeHtml(opening.eco)}</span>
          <span class="badge badge-neutral" data-testid="opening-detail-repertoire">${escapeHtml(repLabel)}</span>
          <span class="badge badge-neutral">${escapeHtml(opening.category)}</span>
          <span class="badge badge-neutral">Kesulitan: ${escapeHtml(opening.difficultyLabel)}</span>
          <span class="badge badge-neutral">${opening.plyCount} ply (${opening.fullMoveCount} langkah)</span>
        </div>
        <h1 class="page-title" data-testid="opening-detail-name">${escapeHtml(opening.name)}</h1>
        <p class="opening-detail-variation-subtitle">
          Keluarga Pembukaan: <strong>${escapeHtml(opening.family)}</strong> • Variasi: <strong>${escapeHtml(opening.variationName)}</strong>
        </p>

        ${
          familyVariations.length > 1
            ? `
          <div class="opening-variation-switcher" data-testid="opening-variation-switcher">
            <span class="variation-switcher-label">Variasi dalam ${escapeHtml(opening.family)}:</span>
            <div class="variation-switcher-pills">
              ${familyVariations
                .map(
                  v => `
                <button
                  type="button"
                  class="btn btn-sm ${v.id === opening.id ? 'btn-primary' : 'btn-secondary'}"
                  data-action="switch-variation"
                  data-opening-id="${escapeHtml(v.id)}"
                  data-testid="variation-pill-${escapeHtml(v.id)}"
                >
                  <span>${escapeHtml(v.variationName)} (${escapeHtml(v.eco)})</span>
                </button>
              `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }
      </header>

      <!-- Workspace 2 Kolom: Papan Interaktif + Panel Penjelasan & Notasi -->
      <div class="lesson-workspace opening-learn-workspace">
        <!-- Kolom Kiri: Papan Catur Interaktif & Urutan Langkah -->
        <div class="lesson-board-column">
          <div id="opening-learn-board-mount"></div>

          <!-- Kartu Daftar Notasi Interaktif & Riwayat Langkah -->
          <section class="opening-notation-card" aria-labelledby="notation-card-heading">
            <div class="opening-notation-header">
              <div>
                <h2 id="notation-card-heading" class="opening-panel-title">Urutan Langkah & Riwayat Notasi</h2>
                <p class="opening-panel-subtitle">Klik langkah pada daftar di bawah untuk menerapkan posisi pada papan catur</p>
              </div>
              <code class="opening-pgn-badge" data-testid="opening-detail-pgn">${escapeHtml(opening.pgn)}</code>
            </div>

            <div class="opening-move-list" role="list" data-testid="opening-move-list">
              <button
                type="button"
                class="opening-ply-btn active"
                data-ply="0"
                data-testid="opening-ply-btn-0"
              >
                Posisi Awal
              </button>
              ${moveRows
                .map(
                  row => `
                <div class="opening-move-pair" role="listitem">
                  <span class="opening-move-num">${row.moveNumber}.</span>
                  <button
                    type="button"
                    class="opening-ply-btn"
                    data-ply="${row.whiteMove.ply}"
                    data-testid="opening-ply-btn-${row.whiteMove.ply}"
                  >
                    ${escapeHtml(row.whiteMove.san)}
                  </button>
                  ${
                    row.blackMove
                      ? `<button
                          type="button"
                          class="opening-ply-btn"
                          data-ply="${row.blackMove.ply}"
                          data-testid="opening-ply-btn-${row.blackMove.ply}"
                        >
                          ${escapeHtml(row.blackMove.san)}
                        </button>`
                      : `<span class="opening-ply-placeholder">...</span>`
                  }
                </div>
              `
                )
                .join('')}
            </div>
          </section>
        </div>

        <!-- Kolom Kanan: Deskripsi, Ide Utama, dan Explanation Panel -->
        <div class="lesson-theory-column opening-theory-column">
          <!-- Deskripsi & Ide Utama -->
          <article class="theory-card opening-overview-card">
            <h2 class="opening-panel-title">Deskripsi Pembukaan</h2>
            <p class="opening-description-text" data-testid="opening-detail-description">
              ${escapeHtml(opening.description)}
            </p>

            <h3 class="opening-subpanel-title">Ide Utama (Key Ideas)</h3>
            <ul class="opening-key-ideas-list" data-testid="opening-detail-key-ideas">
              ${(opening.keyIdeas || [])
                .map(idea => `<li>${escapeHtml(idea)}</li>`)
                .join('')}
            </ul>
          </article>

          <!-- Explanation Panel (Bagian 5) -->
          <article class="theory-card opening-explanation-panel" data-testid="opening-explanation-panel">
            <h2 class="opening-panel-title">Panel Penjelasan Strategis (Explanation Panel)</h2>
            <div class="explanation-grid">
              <div class="explanation-item">
                <h3 class="explanation-item-label">1. Tujuan Umum Opening</h3>
                <p class="explanation-item-text" data-testid="explanation-general-goal">
                  ${escapeHtml(exp.generalGoal || '')}
                </p>
              </div>

              <div class="explanation-item">
                <h3 class="explanation-item-label">2. Ide Pengembangan Bidak</h3>
                <p class="explanation-item-text" data-testid="explanation-piece-development">
                  ${escapeHtml(exp.pieceDevelopment || '')}
                </p>
              </div>

              <div class="explanation-item">
                <h3 class="explanation-item-label">3. Kontrol Pusat</h3>
                <p class="explanation-item-text" data-testid="explanation-center-control">
                  ${escapeHtml(exp.centerControl || '')}
                </p>
              </div>

              <div class="explanation-item">
                <h3 class="explanation-item-label">4. Keamanan Raja</h3>
                <p class="explanation-item-text" data-testid="explanation-king-safety">
                  ${escapeHtml(exp.kingSafety || '')}
                </p>
              </div>

              <div class="explanation-item">
                <h3 class="explanation-item-label">5. Rencana Umum</h3>
                <p class="explanation-item-text" data-testid="explanation-general-plan">
                  ${escapeHtml(exp.generalPlan || '')}
                </p>
              </div>
            </div>

            <div class="opening-guidance-notice" data-testid="opening-guidance-notice">
              <strong>Catatan Panduan Umum:</strong>
              <span>${escapeHtml(
                exp.guidanceNote ||
                  'Penjelasan di atas merupakan panduan belajar umum dan bukan satu-satunya prinsip atau langkah yang benar.'
              )}</span>
            </div>
          </article>

          <!-- Rekomendasi Latihan & CTA -->
          <article class="theory-card opening-practice-cta-card">
            <h2 class="opening-panel-title">Siap Menguji Ingatan Anda?</h2>
            <p class="opening-description-text">
              ${escapeHtml(opening.recommendedPractice || 'Uji kemampuan Anda mengingat urutan langkah variasi ini tanpa melihat kunci jawaban.')}
            </p>
            <div class="opening-cta-actions">
              <button
                type="button"
                class="btn btn-primary btn-lg"
                data-action="start-practice"
                data-testid="opening-bottom-practice-btn"
              >
                ${UI_ICONS.target}
                <span>Mulai Latihan Opening (${escapeHtml(opening.name)})</span>
              </button>
            </div>
          </article>
        </div>
      </div>
    </div>
  `;

  const boardMount = container.querySelector('#opening-learn-board-mount');
  const syncActivePlyButtons = stepState => {
    const plyBtns = container.querySelectorAll('.opening-ply-btn');
    plyBtns.forEach(btn => {
      const ply = Number(btn.getAttribute('data-ply'));
      if (ply === stepState.currentPly) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  };

  const boardInstance = new OpeningLearnBoard(boardMount, opening, {
    onStepChange: stepState => {
      syncActivePlyButtons(stepState);
    }
  });

  // Bind klik daftar langkah notasi
  container.querySelectorAll('.opening-ply-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetPly = Number(btn.getAttribute('data-ply'));
      boardInstance.goToPly(targetPly);
    });
  });

  // Bind navigasi kembali & variasi
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

  container.querySelectorAll('[data-action="switch-variation"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const varId = btn.getAttribute('data-opening-id');
      if (varId && varId !== opening.id && typeof onSelectVariation === 'function') {
        onSelectVariation(varId);
      }
    });
  });

  container.querySelectorAll('[data-action="start-practice"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof onStartPractice === 'function') {
        onStartPractice(opening.id);
      }
    });
  });

  return boardInstance;
}
