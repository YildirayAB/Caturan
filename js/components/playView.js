/**
 * Komponen Halaman Dashboard Bermain & Konfigurasi Permainan (Play Dashboard View — MVP 3 Bagian 4 & 5)
 * Menampilkan:
 * 1. Header:
 *    - Judul: Bermain Catur
 *    - Deskripsi: Latih kemampuan bermain catur melawan komputer.
 * 2. Kartu Pilihan Permainan (Bermain Melawan Komputer) & Pengaturan Sebelum Bermain:
 *    - Pilihan Warna Bidak: Putih, Hitam, Acak
 *    - Pilihan Tingkat Kesulitan: Pemula, Menengah, Lanjutan (beserta deskripsi singkat karakteristik)
 *    - Mode Permainan: Standard Chess (Posisi awal standar)
 *    - Tombol Mulai Bermain
 * 3. Statistik Permainan (100% dari progres aktual playProgress, bukan dummy):
 *    - Total permainan
 *    - Kemenangan
 *    - Kekalahan
 *    - Seri
 *    - Tingkat kemenangan (Win Rate)
 * 4. Riwayat Beberapa Permainan Terakhir
 */

import { UI_ICONS, getPieceSvg } from './icons.js';
import { renderStaticChessboardPreview } from './chessboardUI.js';
import { DEFAULT_POSITION } from '../vendor/chess.js';
import { PLAY_DIFFICULTIES, getPlayDifficultyById } from '../services/stockfishEngine.js';

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDateTimeId(isoString) {
  if (!isoString || typeof isoString !== 'string') return '-';
  const parsed = Date.parse(isoString);
  if (!Number.isFinite(parsed)) return '-';
  const d = new Date(parsed);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${day}/${m}/${y} ${hh}:${mm}`;
}

export const COLOR_CHOICES = [
  {
    id: 'white',
    label: 'Putih',
    subtitle: 'Anda melangkah lebih dulu',
    badge: 'Langkah Pertama'
  },
  {
    id: 'black',
    label: 'Hitam',
    subtitle: 'Komputer melangkah lebih dulu',
    badge: 'Merespons Lawan'
  },
  {
    id: 'random',
    label: 'Acak',
    subtitle: 'Diundi otomatis saat permainan dimulai',
    badge: '50% Putih / 50% Hitam'
  }
];

export function renderPlayView(
  container,
  {
    playSummary,
    selectedSettings = { colorPreference: 'white', difficulty: 'beginner' },
    unfinishedNotice = null,
    onUpdateSettings,
    onStartGame
  } = {}
) {
  if (!container || !playSummary) return;

  const {
    totalGames,
    wins,
    losses,
    draws,
    winRate,
    recentGames,
    byDifficulty
  } = playSummary;

  const activeColorPref = ['white', 'black', 'random'].includes(selectedSettings?.colorPreference)
    ? selectedSettings.colorPreference
    : 'white';
  const activeDifficulty = getPlayDifficultyById(selectedSettings?.difficulty || 'beginner');
  const activeColorObj =
    COLOR_CHOICES.find(c => c.id === activeColorPref) || COLOR_CHOICES[0];

  const previewOrientation = activeColorPref === 'black' ? 'black' : 'white';
  const boardPreviewHtml = renderStaticChessboardPreview(DEFAULT_POSITION, {
    orientation: previewOrientation
  });

  // Pilihan Warna Bidak
  const colorOptionsHtml = COLOR_CHOICES.map(choice => {
    const isSelected = choice.id === activeColorPref;
    let iconVisual = '';
    if (choice.id === 'white') {
      iconVisual = `<span class="color-choice-piece">${getPieceSvg('w', 'k')}</span>`;
    } else if (choice.id === 'black') {
      iconVisual = `<span class="color-choice-piece">${getPieceSvg('b', 'k')}</span>`;
    } else {
      iconVisual = `<span class="color-choice-icon">${UI_ICONS.shuffle}</span>`;
    }

    return `
      <button
        type="button"
        class="play-option-btn ${isSelected ? 'is-selected' : ''}"
        data-select-color="${choice.id}"
        data-testid="select-color-${choice.id}"
        aria-pressed="${isSelected ? 'true' : 'false'}"
      >
        <div class="play-option-top">
          ${iconVisual}
          <span class="play-option-title">${escapeHtml(choice.label)}</span>
          ${isSelected ? `<span class="badge badge-accent">Dipilih</span>` : ''}
        </div>
        <span class="play-option-desc">${escapeHtml(choice.subtitle)}</span>
      </button>
    `;
  }).join('');

  // Pilihan Tingkat Kesulitan
  const difficultyOptionsHtml = PLAY_DIFFICULTIES.map(diff => {
    const isSelected = diff.id === activeDifficulty.id;
    return `
      <button
        type="button"
        class="play-option-btn ${isSelected ? 'is-selected' : ''}"
        data-select-difficulty="${diff.id}"
        data-testid="select-difficulty-${diff.id}"
        aria-pressed="${isSelected ? 'true' : 'false'}"
      >
        <div class="play-option-top">
          <span class="play-option-title">${escapeHtml(diff.title)}</span>
          <span class="badge ${isSelected ? 'badge-accent' : 'badge-neutral'}">
            ${escapeHtml(diff.badgeLabel)}
          </span>
        </div>
        <span class="play-option-desc">${escapeHtml(diff.description)}</span>
      </button>
    `;
  }).join('');

  // Ringkasan Per Tingkat Kesulitan
  const difficultyBreakdownHtml = (byDifficulty || [])
    .map(
      d => `
        <div class="cat-mini-row">
          <div class="cat-mini-info">
            <span class="cat-mini-name">Tingkat ${escapeHtml(d.title)}</span>
            <span class="cat-mini-status ${d.totalGames > 0 ? 'status-in-progress' : ''}">
              ${d.totalGames} main • ${d.wins}M / ${d.losses}K / ${d.draws}S (${d.winRate}%)
            </span>
          </div>
          <div class="progress-bar-track progress-track-sm">
            <div class="progress-bar-fill" style="width: ${d.winRate}%"></div>
          </div>
        </div>
      `
    )
    .join('');

  // Riwayat Beberapa Permainan Terakhir
  let recentGamesHtml = '';
  if (!Array.isArray(recentGames) || recentGames.length === 0) {
    recentGamesHtml = `
      <div class="empty-state-box" data-testid="play-empty-history">
        <div class="empty-state-icon">${UI_ICONS.play}</div>
        <h4>Belum Ada Riwayat Permainan</h4>
        <p class="text-muted">
          Anda belum menyelesaikan permainan melawan komputer. Seluruh statistik di atas dimulai secara jujur dari 0—pilih pengaturan di atas dan klik <strong>Mulai Bermain</strong>!
        </p>
      </div>
    `;
  } else {
    recentGamesHtml = `
      <div class="puzzle-history-list" data-testid="play-recent-games-list">
        ${recentGames
          .map(game => {
            const badgeClass =
              game.result === 'win'
                ? 'badge-success'
                : game.result === 'loss'
                ? 'badge-danger'
                : 'badge-in-progress';
            const moveCount = game.pgn
              ? game.pgn.split(/\d+\./).filter(Boolean).length
              : 0;

            return `
              <div class="puzzle-history-item" data-testid="play-history-item-${escapeHtml(game.id)}">
                <div class="puzzle-history-main">
                  <div class="puzzle-history-top">
                    <span class="badge ${badgeClass}">${escapeHtml(game.resultLabel)}</span>
                    <strong>Melawan Stockfish (${escapeHtml(game.difficultyTitle)})</strong>
                    <span class="badge badge-neutral">Bidak ${escapeHtml(game.playerColorLabel)}</span>
                  </div>
                  <div class="puzzle-history-meta">
                    <span> Akhir: <strong>${escapeHtml(game.terminationLabel)}</strong></span>
                    <span>•</span>
                    <span>${moveCount > 0 ? `${moveCount} langkah` : 'Tanpa langkah'}</span>
                    <span>•</span>
                    <span>Selesai: ${escapeHtml(formatDateTimeId(game.finishedAt))}</span>
                    ${
                      game.pgn
                        ? `<span>•</span><span>PGN: <code>${escapeHtml(
                            game.pgn.length > 64 ? `${game.pgn.slice(0, 64)}...` : game.pgn
                          )}</code></span>`
                        : ''
                    }
                  </div>
                </div>
              </div>
            `;
          })
          .join('')}
      </div>
    `;
  }

  const unfinishedBannerHtml = unfinishedNotice
    ? `
      <div class="lesson-completion-banner is-info" role="status" data-testid="play-unfinished-banner">
        <div class="banner-icon">${UI_ICONS.info}</div>
        <div class="banner-text">
          <strong>Informasi Sesi Sebelumnya</strong>
          <span>${escapeHtml(unfinishedNotice)}</span>
        </div>
      </div>
    `
    : '';

  container.innerHTML = `
    <div class="dashboard-page play-dashboard-page">
      ${unfinishedBannerHtml}

      <!-- 1. Header Bermain Catur -->
      <section class="card greeting-banner" aria-labelledby="play-heading">
        <div class="greeting-content">
          <div class="greeting-eyebrow">
            <span class="app-pill">CATURAN • MVP 3 SPARRING</span>
          </div>
          <h1 id="play-heading" class="greeting-title">Bermain Catur</h1>
          <p class="greeting-description">
            Latih kemampuan bermain catur melawan komputer.
          </p>
        </div>
        <div class="greeting-side-box">
          <div class="level-summary-chip">
            <span class="chip-label">Ringkasan Pertandingan</span>
            <strong class="chip-value">${totalGames} Permainan Selesai</strong>
            <span class="chip-sub">Tingkat Kemenangan: ${winRate}% (${wins} Menang • ${losses} Kalah • ${draws} Seri)</span>
          </div>
        </div>
      </section>

      <!-- 2. Statistik Permainan (5 Metrik: Total, Menang, Kalah, Seri, Tingkat Kemenangan) -->
      <section class="dashboard-section" aria-label="Statistik Permainan">
        <div class="stats-grid play-stats-grid">
          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.play}</div>
            <div class="stat-body">
              <span class="stat-label">Total Permainan</span>
              <strong class="stat-value" data-testid="play-stat-total">${totalGames}</strong>
              <span class="stat-caption">Partai selesai melawan komputer</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.trophy}</div>
            <div class="stat-body">
              <span class="stat-label">Kemenangan</span>
              <strong class="stat-value" data-testid="play-stat-wins">${wins}</strong>
              <span class="stat-caption">Menang melawan Stockfish</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.flag}</div>
            <div class="stat-body">
              <span class="stat-label">Kekalahan</span>
              <strong class="stat-value" data-testid="play-stat-losses">${losses}</strong>
              <span class="stat-caption">Kalah skakmat atau menyerah</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.checkCircle}</div>
            <div class="stat-body">
              <span class="stat-label">Seri (Draw)</span>
              <strong class="stat-value" data-testid="play-stat-draws">${draws}</strong>
              <span class="stat-caption">Stalemate, repetisi, atau remis</span>
            </div>
          </article>

          <article class="card stat-card">
            <div class="stat-icon-box">${UI_ICONS.zap}</div>
            <div class="stat-body">
              <span class="stat-label">Tingkat Kemenangan</span>
              <strong class="stat-value" data-testid="play-stat-winrate">${winRate}%</strong>
              <span class="stat-caption">${wins} menang dari ${totalGames} permainan</span>
            </div>
          </article>
        </div>
      </section>

      <!-- 3. Kartu Pilihan Permainan: Bermain Melawan Komputer & Pengaturan -->
      <section class="card dashboard-panel" aria-labelledby="play-vs-computer-heading" data-testid="play-vs-computer-card">
        <div class="panel-header">
          <div>
            <div class="card-section-tag">MODE PERMAINAN TERSEDIA</div>
            <h2 id="play-vs-computer-heading" class="panel-title">Bermain Melawan Komputer</h2>
            <p class="panel-subtitle">
              Pertandingan catur standar melawan engine Stockfish 19 Lite (WebAssembly) langsung di browser Anda
            </p>
          </div>
          <span class="badge badge-accent">Standard Chess • Posisi Awal Standar</span>
        </div>

        <div class="play-setup-layout">
          <div class="play-setup-preview-col">
            ${boardPreviewHtml}
            <div class="play-selected-summary-box" data-testid="play-selected-config-summary">
              <div class="puzzle-meta-row">
                <span class="meta-row-label">Mode Permainan</span>
                <strong class="meta-row-value">Standard Chess</strong>
              </div>
              <div class="puzzle-meta-row">
                <span class="meta-row-label">Warna Bidak Dipilih</span>
                <strong class="meta-row-value" data-testid="play-selected-color-label">
                  ${escapeHtml(activeColorObj.label)}
                </strong>
              </div>
              <div class="puzzle-meta-row">
                <span class="meta-row-label">Tingkat Kesulitan</span>
                <strong class="meta-row-value" data-testid="play-selected-difficulty-label">
                  ${escapeHtml(activeDifficulty.title)} (${escapeHtml(activeDifficulty.badgeLabel)})
                </strong>
              </div>
            </div>
          </div>

          <div class="play-setup-controls-col">
            <!-- Pilihan Warna Bidak -->
            <div class="play-setting-group">
              <label class="play-setting-label">1. Pilih Warna Bidak</label>
              <div class="play-options-grid play-color-grid">
                ${colorOptionsHtml}
              </div>
            </div>

            <!-- Pilihan Tingkat Kesulitan -->
            <div class="play-setting-group">
              <label class="play-setting-label">2. Pilih Tingkat Kesulitan Komputer</label>
              <div class="play-options-grid play-difficulty-options-grid">
                ${difficultyOptionsHtml}
              </div>
            </div>

            <!-- Tombol Mulai Bermain -->
            <div class="play-start-action-row">
              <button
                type="button"
                class="btn btn-primary play-main-start-btn"
                data-action="start-play-game"
                data-testid="start-play-game-btn"
              >
                ${UI_ICONS.play}
                <span>Mulai Bermain</span>
                ${UI_ICONS.arrowRight}
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. Ringkasan Per Tingkat Kesulitan & Riwayat Beberapa Permainan Terakhir -->
      <div class="dashboard-two-col">
        <section class="card dashboard-panel" aria-labelledby="play-diff-stats-heading">
          <div class="panel-header">
            <div>
              <h2 id="play-diff-stats-heading" class="panel-title">Statistik per Tingkat Kesulitan</h2>
              <p class="panel-subtitle">Performa pertandingan Anda pada level Pemula, Menengah, dan Lanjutan</p>
            </div>
            <div class="overall-percent-pill" data-testid="play-overall-winrate-pill">
              ${winRate}%
            </div>
          </div>

          <div class="overall-progress-block">
            <div class="progress-bar-track progress-track-lg" role="progressbar" aria-valuenow="${winRate}" aria-valuemin="0" aria-valuemax="100">
              <div class="progress-bar-fill" style="width: ${winRate}%"></div>
            </div>
            <div class="overall-progress-stats">
              <span><strong>${wins}</strong> kemenangan</span>
              <span><strong>${totalGames}</strong> total permainan</span>
            </div>
          </div>

          <div class="category-mini-breakdown">
            ${difficultyBreakdownHtml}
          </div>
        </section>

        <section class="card dashboard-panel" aria-labelledby="play-recent-history-heading">
          <div class="panel-header">
            <div>
              <h2 id="play-recent-history-heading" class="panel-title">Riwayat Permainan Terakhir</h2>
              <p class="panel-subtitle">Catatan partai yang telah selesai dimainkan melawan komputer</p>
            </div>
          </div>
          ${recentGamesHtml}
        </section>
      </div>
    </div>
  `;

  // Bind pemilihan warna bidak
  const colorBtns = container.querySelectorAll('[data-select-color]');
  colorBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const colorId = btn.getAttribute('data-select-color');
      if (colorId && typeof onUpdateSettings === 'function') {
        onUpdateSettings({
          colorPreference: colorId,
          difficulty: activeDifficulty.id
        });
      }
    });
  });

  // Bind pemilihan tingkat kesulitan
  const diffBtns = container.querySelectorAll('[data-select-difficulty]');
  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const diffId = btn.getAttribute('data-select-difficulty');
      if (diffId && typeof onUpdateSettings === 'function') {
        onUpdateSettings({
          colorPreference: activeColorPref,
          difficulty: diffId
        });
      }
    });
  });

  // Bind tombol Mulai Bermain
  const startBtn = container.querySelector('[data-action="start-play-game"]');
  if (startBtn && typeof onStartGame === 'function') {
    startBtn.addEventListener('click', () => {
      onStartGame({
        colorPreference: activeColorPref,
        difficulty: activeDifficulty.id
      });
    });
  }
}
