/**
 * Komponen Halaman Detail Materi (Lesson Detail View)
 * Menampilkan:
 * 1. Judul materi & informasi kategori/XP
 * 2. Penjelasan teori catur berbahasa Indonesia yang terstruktur & akurat
 * 3. Intisari materi (Key Takeaways)
 * 4. Instruksi latihan & Papan Catur Interaktif (InteractiveChessboard)
 * 5. Tombol Tandai Selesai, Back (Materi Sebelumnya), dan Next (Materi Selanjutnya)
 */

import { getLessonById } from '../data/curriculum.js';
import { InteractiveChessboard } from './chessboardUI.js';
import { UI_ICONS } from './icons.js';

let activeBoardInstance = null;

export function destroyActiveLessonBoard() {
  if (activeBoardInstance) {
    activeBoardInstance.destroy();
    activeBoardInstance = null;
  }
}

export function updateLessonCompletionUI(container, { isCompleted, completionFeedback, xpReward }) {
  if (!container) return;

  const badgeEl = container.querySelector('[data-testid="lesson-status-badge"]');
  if (badgeEl) {
    badgeEl.className = `badge ${isCompleted ? 'badge-success' : 'badge-neutral'}`;
    badgeEl.innerHTML = isCompleted ? `${UI_ICONS.check} Selesai` : 'Belum Selesai';
  }

  const completeBtns = container.querySelectorAll('[data-action="mark-complete"]');
  completeBtns.forEach((btn, idx) => {
    btn.className = `btn ${isCompleted ? 'btn-completed' : 'btn-primary'}`;
    if (idx === 0) {
      btn.innerHTML = `${UI_ICONS.check} <span>${
        isCompleted ? 'Materi Telah Selesai (XP Diklaim)' : `Tandai Selesai (+${xpReward} XP)`
      }</span>`;
    } else {
      btn.innerHTML = `${UI_ICONS.check} <span>${isCompleted ? 'Sudah Selesai' : 'Tandai Selesai'}</span>`;
    }
  });

  const existingBanner = container.querySelector('.lesson-completion-banner');
  if (existingBanner) {
    existingBanner.remove();
  }

  if (completionFeedback) {
    const topbar = container.querySelector('.lesson-topbar');
    if (topbar) {
      const bannerDiv = document.createElement('div');
      bannerDiv.className = `lesson-completion-banner ${
        completionFeedback.alreadyCompleted ? 'is-info' : 'is-success'
      }`;
      bannerDiv.setAttribute('role', 'status');
      bannerDiv.innerHTML = `
        <div class="banner-icon">${UI_ICONS.trophy}</div>
        <div class="banner-text">
          <strong>${completionFeedback.title}</strong>
          <span>${completionFeedback.message}</span>
        </div>
      `;
      topbar.insertAdjacentElement('afterend', bannerDiv);
    }
  }
}

export function renderLessonDetailView(
  container,
  { lessonId, isCompleted, completionFeedback, onBackToLearn, onSelectLesson, onMarkComplete }
) {
  if (!container) return;

  destroyActiveLessonBoard();

  const data = getLessonById(lessonId);
  if (!data) {
    container.innerHTML = `
      <div class="card empty-state-box">
        <h2>Materi Tidak Ditemukan</h2>
        <p>Materi yang Anda cari tidak tersedia dalam kurikulum.</p>
        <button type="button" class="btn btn-primary" data-action="back-learn">Kembali ke Kurikulum</button>
      </div>
    `;
    const btn = container.querySelector('[data-action="back-learn"]');
    if (btn && onBackToLearn) btn.addEventListener('click', onBackToLearn);
    return;
  }

  const { lesson, prevLesson, nextLesson, totalLessons, currentIndex } = data;

  const theorySectionsHtml = (lesson.theory || [])
    .map(
      sec => `
      <div class="theory-section">
        <h3 class="theory-heading">${sec.heading}</h3>
        <p class="theory-paragraph">${sec.content}</p>
        ${
          Array.isArray(sec.bulletPoints) && sec.bulletPoints.length > 0
            ? `<ul class="theory-bullet-list">
                ${sec.bulletPoints.map(pt => `<li>${pt}</li>`).join('')}
               </ul>`
            : ''
        }
      </div>
    `
    )
    .join('');

  const keyTakeawaysHtml =
    Array.isArray(lesson.keyTakeaways) && lesson.keyTakeaways.length > 0
      ? `
      <div class="key-takeaways-box">
        <div class="takeaways-header">
          ${UI_ICONS.info}
          <h4>Intisari Materi (Poin Penting)</h4>
        </div>
        <ul class="takeaways-list">
          ${lesson.keyTakeaways.map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>
    `
      : '';

  let xpAlertHtml = '';
  if (completionFeedback) {
    xpAlertHtml = `
      <div class="lesson-completion-banner ${completionFeedback.alreadyCompleted ? 'is-info' : 'is-success'}" role="status">
        <div class="banner-icon">${UI_ICONS.trophy}</div>
        <div class="banner-text">
          <strong>${completionFeedback.title}</strong>
          <span>${completionFeedback.message}</span>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="lesson-detail-page">
      <!-- Breadcrumb & Bar Navigasi Atas -->
      <div class="lesson-topbar">
        <button type="button" class="btn btn-secondary btn-sm" data-action="back-learn">
          ${UI_ICONS.arrowLeft}
          <span>Kembali ke Daftar Kurikulum</span>
        </button>

        <div class="lesson-topbar-meta">
          <span class="badge badge-neutral">${lesson.categoryTitle}</span>
          <span class="badge badge-neutral">Materi ${currentIndex} / ${totalLessons}</span>
          <span class="badge badge-accent">+${lesson.xpReward} XP</span>
          <span class="badge ${isCompleted ? 'badge-success' : 'badge-neutral'}" data-testid="lesson-status-badge">
            ${isCompleted ? `${UI_ICONS.check} Selesai` : 'Belum Selesai'}
          </span>
        </div>
      </div>

      ${xpAlertHtml}

      <!-- Header Judul Materi -->
      <header class="card lesson-hero-card">
        <div class="lesson-hero-content">
          <span class="lesson-order-eyebrow">MATERI PEMBELAJARAN #${lesson.order}</span>
          <h1 class="lesson-main-title">${lesson.title}</h1>
          <p class="lesson-main-subtitle">${lesson.subtitle}</p>
        </div>
        <div class="lesson-hero-actions">
          <button
            type="button"
            class="btn ${isCompleted ? 'btn-completed' : 'btn-primary'}"
            data-action="mark-complete"
            data-testid="mark-complete-btn"
          >
            ${UI_ICONS.check}
            <span>${isCompleted ? 'Materi Telah Selesai (XP Diklaim)' : `Tandai Selesai (+${lesson.xpReward} XP)`}</span>
          </button>
        </div>
      </header>

      <!-- Layout 2 Kolom: Kiri Teori, Kanan Papan Catur Interaktif -->
      <div class="lesson-workspace-grid">
        <!-- Kolom Kiri: Penjelasan Teori -->
        <article class="card lesson-theory-card" aria-label="Penjelasan Teori">
          <div class="card-section-tag">TEORI & KONSEP CATUR</div>
          ${theorySectionsHtml}
          ${keyTakeawaysHtml}
        </article>

        <!-- Kolom Kanan: Instruksi Latihan & Papan Catur Interaktif -->
        <aside class="card lesson-practice-card" aria-label="Latihan Papan Catur Interaktif">
          <div class="practice-header">
            <div class="card-section-tag">PRAKTIK PAPAN INTERAKTIF</div>
            <h2 class="practice-title">${lesson.practice.title}</h2>
            <div class="practice-instruction-box">
              <p>${lesson.practice.instruction}</p>
            </div>
          </div>

          <div id="lesson-chessboard-mount" class="chessboard-mount-container"></div>
        </aside>
      </div>

      <!-- Bar Navigasi Bawah: Back, Tandai Selesai, Next -->
      <footer class="card lesson-bottom-nav" aria-label="Navigasi Antar Materi">
        <div class="bottom-nav-left">
          ${
            prevLesson
              ? `<button type="button" class="btn btn-secondary" data-goto-lesson="${prevLesson.id}" data-testid="btn-prev-lesson">
                  ${UI_ICONS.arrowLeft}
                  <div class="nav-btn-text">
                    <small>Materi Sebelumnya (Back)</small>
                    <strong>${prevLesson.title}</strong>
                  </div>
                 </button>`
              : `<button type="button" class="btn btn-secondary" disabled>
                  ${UI_ICONS.arrowLeft}
                  <span>Awal Kurikulum</span>
                 </button>`
          }
        </div>

        <div class="bottom-nav-center">
          <button
            type="button"
            class="btn ${isCompleted ? 'btn-completed' : 'btn-primary'}"
            data-action="mark-complete"
          >
            ${UI_ICONS.check}
            <span>${isCompleted ? 'Sudah Selesai' : 'Tandai Selesai'}</span>
          </button>
        </div>

        <div class="bottom-nav-right">
          ${
            nextLesson
              ? `<button type="button" class="btn btn-primary" data-goto-lesson="${nextLesson.id}" data-testid="btn-next-lesson">
                  <div class="nav-btn-text text-right">
                    <small>Materi Selanjutnya (Next)</small>
                    <strong>${nextLesson.title}</strong>
                  </div>
                  ${UI_ICONS.arrowRight}
                 </button>`
              : `<button type="button" class="btn btn-secondary" data-action="back-learn">
                  <span>Kembali ke Kurikulum</span>
                  ${UI_ICONS.check}
                 </button>`
          }
        </div>
      </footer>
    </div>
  `;

  // Mount Interactive Chessboard
  const boardMount = container.querySelector('#lesson-chessboard-mount');
  if (boardMount && lesson.practice) {
    activeBoardInstance = new InteractiveChessboard(boardMount, lesson.practice, {
      onPracticeSuccess: () => {
        // Ketika seluruh langkah latihan di papan selesai, otomatis tandai materi selesai jika belum selesai
        if (!isCompleted && typeof onMarkComplete === 'function') {
          onMarkComplete(lesson.id, true);
        }
      }
    });
  }

  // Bind tombol kembali ke daftar kurikulum
  const backBtns = container.querySelectorAll('[data-action="back-learn"]');
  backBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof onBackToLearn === 'function') {
        onBackToLearn();
      }
    });
  });

  // Bind tombol Tandai Selesai
  const completeBtns = container.querySelectorAll('[data-action="mark-complete"]');
  completeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (typeof onMarkComplete === 'function') {
        onMarkComplete(lesson.id, false);
      }
    });
  });

  // Bind tombol Back / Next materi
  const gotoBtns = container.querySelectorAll('[data-goto-lesson]');
  gotoBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-goto-lesson');
      if (targetId && typeof onSelectLesson === 'function') {
        onSelectLesson(targetId);
      }
    });
  });
}
