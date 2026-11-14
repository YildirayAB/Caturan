/**
 * Komponen Game Review Panel (MVP 5.5 — Evaluation Graph & Game Review)
 *
 * Menyajikan 3 Tab Interaktif:
 * 1. Tab Grafik Evaluasi (Evaluation Graph SVG interaktif)
 * 2. Tab Statistik (Ringkasan Kualitas Langkah Putih & Hitam: Best, Excellent, Good, Inaccuracy, Mistake, Blunder)
 * 3. Tab Momen Penting (Critical Moments: Blunder & Mistake terbesar dengan aksi lompat ke papan)
 *
 * Serta Move Review List terpadu untuk navigasi per langkah.
 */

import { UI_ICONS } from './icons.js';
import { EvaluationGraphComponent } from './evaluationGraph.js';
import {
  MOVE_CLASSIFICATION,
  MOVE_CLASSIFICATION_META
} from '../config/gameReviewConfig.js';
import { GAME_REVIEW_STATUS } from '../services/chessGameReviewService.js';

export class GameReviewPanelComponent {
  constructor({
    container,
    onSelectPly = null,
    onStartGameAnalysis = null,
    onStopGameAnalysis = null,
    onSaveAnalysis = null
  } = {}) {
    this.container = container;
    this.onSelectPly = onSelectPly;
    this.onStartGameAnalysis = onStartGameAnalysis;
    this.onStopGameAnalysis = onStopGameAnalysis;
    this.onSaveAnalysis = onSaveAnalysis;

    this._activeTab = 'graph'; // 'graph' | 'stats' | 'critical'
    this._status = GAME_REVIEW_STATUS.IDLE;
    this._progress = { current: 0, total: 0, percent: 0, currentPly: 0 };
    this._report = null;
    this._graphData = null;
    this._activePly = 0;
    this._graphComponent = null;

    // State Simpan Analisis (MVP 5.6)
    this._saveStatus = 'idle'; // 'idle' | 'saving' | 'saved' | 'error'
    this._saveErrorMsg = null;
    this._savedHistoryId = null;
  }

  updateState({
    status,
    progress,
    report,
    graphData,
    activePly,
    saveStatus,
    saveErrorMsg,
    savedHistoryId
  } = {}) {
    if (saveStatus !== undefined) this._saveStatus = saveStatus;
    if (saveErrorMsg !== undefined) this._saveErrorMsg = saveErrorMsg;
    if (savedHistoryId !== undefined) this._savedHistoryId = savedHistoryId;

    const isOnlyActivePlyChange =
      activePly !== undefined &&
      status === undefined &&
      progress === undefined &&
      report === undefined &&
      graphData === undefined &&
      saveStatus === undefined;
      progress === undefined &&
      report === undefined &&
      graphData === undefined;

    if (status !== undefined) this._status = status;
    if (progress !== undefined) this._progress = progress;
    if (report !== undefined) this._report = report;
    if (graphData !== undefined) this._graphData = graphData;

    if (isOnlyActivePlyChange) {
      this.setActivePly(activePly);
      return;
    }

    if (activePly !== undefined) this._activePly = activePly;

    // Simpan posisi scroll sebelum render ulang untuk mencegah jump ke atas
    const scrollEl = this.container ? this.container.querySelector('[data-testid="game-review-moves-scroll"]') : null;
    const prevScrollTop = scrollEl ? scrollEl.scrollTop : null;

    this.render();

    if (prevScrollTop !== null) {
      const newScrollEl = this.container ? this.container.querySelector('[data-testid="game-review-moves-scroll"]') : null;
      if (newScrollEl) {
        newScrollEl.scrollTop = prevScrollTop;
      }
    }
  }

  setActivePly(ply) {
    this._activePly = ply;
    if (this._graphComponent) {
      this._graphComponent.setActivePly(ply);
    }
    this._highlightActiveMoveItem(ply);
  }

  render() {
    if (!this.container) return;

    const isIdle = this._status === GAME_REVIEW_STATUS.IDLE;
    const isAnalyzing = this._status === GAME_REVIEW_STATUS.ANALYZING || this._status === GAME_REVIEW_STATUS.PREPARING;
    const isCompleted = this._status === GAME_REVIEW_STATUS.COMPLETED;
    const isStopped = this._status === GAME_REVIEW_STATUS.STOPPED;
    const isError = this._status === GAME_REVIEW_STATUS.ERROR;

    // Status Badge & Controls
    let statusBadgeHtml = '';
    if (isCompleted) {
      statusBadgeHtml = `<span class="badge badge-green game-review-status-badge" data-testid="game-review-status-badge">${UI_ICONS.checkCircle} <span>Analisis Selesai</span></span>`;
    } else if (isAnalyzing) {
      statusBadgeHtml = `<span class="badge badge-orange game-review-status-badge is-analyzing" data-testid="game-review-status-badge"><span class="analysis-engine-spinner"></span> <span>Menganalisis (${this._progress.percent}%)</span></span>`;
    } else if (isStopped) {
      statusBadgeHtml = `<span class="badge game-review-status-badge is-stopped" data-testid="game-review-status-badge"><span>Analisis Dihentikan</span></span>`;
    } else if (isError) {
      statusBadgeHtml = `<span class="badge badge-red game-review-status-badge is-error" data-testid="game-review-status-badge"><span>Kendala Analisis</span></span>`;
    } else {
      statusBadgeHtml = `<span class="badge game-review-status-badge is-idle" data-testid="game-review-status-badge"><span>Belum Dianalisis</span></span>`;
    }

    this.container.innerHTML = `
      <section class="card game-review-card" data-testid="game-review-card" role="region" aria-label="Game Review & Evaluation Graph">
        <div class="game-review-header">
          <div class="game-review-title-group">
            <span class="game-review-icon" aria-hidden="true">${UI_ICONS.chart || UI_ICONS.activity || '📊'}</span>
            <div>
              <h3 class="game-review-title">Game Review</h3>
              <p class="game-review-subtitle" data-testid="game-review-subtitle">
                ${isCompleted ? `${this._report?.gameInfo?.totalMoves || 0} langkah dianalisis secara lengkap` : 'Analisis kualitas langkah dan grafik evaluasi'}
              </p>
            </div>
          </div>
          ${statusBadgeHtml}
        </div>

        <!-- Progress Bar (Tampil saat menganalisis / stopped) -->
        ${isAnalyzing || (isStopped && this._progress.total > 0) ? `
          <div class="game-review-progress-box" data-testid="game-review-progress-box">
            <div class="game-review-progress-info">
              <span class="game-review-progress-label">Posisi ${this._progress.current} dari ${this._progress.total}</span>
              <span class="game-review-progress-pct">${this._progress.percent}%</span>
            </div>
            <div class="game-review-progress-bar-bg">
              <div class="game-review-progress-bar-fill" style="width: ${this._progress.percent}%"></div>
            </div>
          </div>
        ` : ''}

        <!-- Action Controls -->
        <div class="game-review-actions-row">
          ${!isAnalyzing ? `
            <button
              type="button"
              class="btn btn-primary btn-sm analysis-touch-btn game-review-btn"
              data-action="game-review-start"
              data-testid="game-review-start-btn"
            >
              ${UI_ICONS.zap}
              <span>${isCompleted || isStopped ? 'Analyze Again' : 'Analyze Game'}</span>
            </button>
          ` : `
            <button
              type="button"
              class="btn btn-secondary btn-sm analysis-touch-btn game-review-btn game-review-stop-btn"
              data-action="game-review-stop"
              data-testid="game-review-stop-btn"
            >
              <span>Stop Game Analysis</span>
            </button>
          `}

          ${isCompleted ? `
            <button
              type="button"
              class="btn btn-sm analysis-touch-btn game-review-btn game-review-save-btn ${this._saveStatus === 'saved' ? 'btn-success is-saved' : 'btn-outline-primary'}"
              data-action="game-review-save"
              data-testid="game-review-save-btn"
              ${this._saveStatus === 'saving' || this._saveStatus === 'saved' ? 'disabled' : ''}
              title="${this._saveStatus === 'saved' ? 'Analisis telah tersimpan di cloud' : 'Simpan hasil analisis ke akun Anda'}"
            >
              ${this._saveStatus === 'saving' ? `
                <span class="analysis-engine-spinner" style="width:14px;height:14px;margin-right:4px;"></span>
                <span>Menyimpan...</span>
              ` : this._saveStatus === 'saved' ? `
                ${UI_ICONS.check}
                <span>Tersimpan di Cloud</span>
              ` : `
                ${UI_ICONS.save || UI_ICONS.cloud}
                <span>Simpan Analisis</span>
              `}
            </button>
          ` : ''}
        </div>

        ${this._saveStatus === 'error' && this._saveErrorMsg ? `
          <div class="game-review-save-error" data-testid="game-review-save-error" role="alert">
            <span class="save-error-icon">${UI_ICONS.alertTriangle}</span>
            <span class="save-error-text">${this._saveErrorMsg}</span>
          </div>
        ` : ''}

        <!-- Tab Selector: Grafik Evaluasi | Statistik | Momen Penting -->
        <div class="game-review-tabs" role="tablist" aria-label="Pilihan Tampilan Game Review">
          <button
            type="button"
            role="tab"
            class="btn btn-sm game-review-tab-btn ${this._activeTab === 'graph' ? 'active' : ''}"
            data-tab="graph"
            data-testid="game-review-tab-graph"
            aria-selected="${this._activeTab === 'graph' ? 'true' : 'false'}"
          >
            <span>Grafik Evaluasi</span>
          </button>
          <button
            type="button"
            role="tab"
            class="btn btn-sm game-review-tab-btn ${this._activeTab === 'stats' ? 'active' : ''}"
            data-tab="stats"
            data-testid="game-review-tab-stats"
            aria-selected="${this._activeTab === 'stats' ? 'true' : 'false'}"
          >
            <span>Statistik</span>
          </button>
          <button
            type="button"
            role="tab"
            class="btn btn-sm game-review-tab-btn ${this._activeTab === 'critical' ? 'active' : ''}"
            data-tab="critical"
            data-testid="game-review-tab-critical"
            aria-selected="${this._activeTab === 'critical' ? 'true' : 'false'}"
          >
            <span>Momen Penting</span>
          </button>
        </div>

        <!-- Tab Contents -->
        <div class="game-review-tab-content">
          <!-- 1. GRAPH TAB -->
          <div class="game-review-tab-pane ${this._activeTab === 'graph' ? 'active' : 'hidden'}" data-testid="game-review-pane-graph">
            <div id="eval-graph-container" data-testid="eval-graph-container"></div>
          </div>

          <!-- 2. STATS TAB -->
          <div class="game-review-tab-pane ${this._activeTab === 'stats' ? 'active' : 'hidden'}" data-testid="game-review-pane-stats">
            ${this._renderStatsPane()}
          </div>

          <!-- 3. CRITICAL MOMENTS TAB -->
          <div class="game-review-tab-pane ${this._activeTab === 'critical' ? 'active' : 'hidden'}" data-testid="game-review-pane-critical">
            ${this._renderCriticalMomentsPane()}
          </div>
        </div>

        <!-- MOVE REVIEW LIST (Daftar Langkah dengan Klasifikasi) -->
        ${this._renderMoveReviewList()}
      </section>
    `;

    // Pasang Evaluation Graph jika ada di Tab Graph
    const graphMount = this.container.querySelector('#eval-graph-container');
    if (graphMount && this._graphData) {
      if (!this._graphComponent) {
        this._graphComponent = new EvaluationGraphComponent({
          container: graphMount,
          onSelectPoint: (ply) => {
            this.setActivePly(ply);
            if (typeof this.onSelectPly === 'function') {
              this.onSelectPly(ply);
            }
          },
          activePly: this._activePly
        });
      } else {
        this._graphComponent.container = graphMount;
      }
      this._graphComponent.setData(this._graphData, this._activePly);
    }

    this._bindEvents();
  }

  _renderStatsPane() {
    if (!this._report || !this._report.whiteStats || !this._report.blackStats) {
      return `
        <div class="game-review-empty-state" data-testid="game-review-stats-empty">
          <p>Jalankan <strong>Analyze Game</strong> untuk melihat statistik akurasi langkah Putih dan Hitam.</p>
        </div>
      `;
    }

    const categories = [
      MOVE_CLASSIFICATION.BEST,
      MOVE_CLASSIFICATION.EXCELLENT,
      MOVE_CLASSIFICATION.GOOD,
      MOVE_CLASSIFICATION.INACCURACY,
      MOVE_CLASSIFICATION.MISTAKE,
      MOVE_CLASSIFICATION.BLUNDER
    ];

    const rowsHtml = categories.map(cat => {
      const meta = MOVE_CLASSIFICATION_META[cat];
      const wCount = this._report.whiteStats[cat] || 0;
      const bCount = this._report.blackStats[cat] || 0;
      return `
        <div class="game-review-stat-row" data-classification="${cat}">
          <span class="game-review-stat-val val-white">${wCount}</span>
          <div class="game-review-stat-label-wrap">
            <span class="badge ${meta.badgeClass} game-review-stat-pill">${meta.symbol} ${meta.label}</span>
          </div>
          <span class="game-review-stat-val val-black">${bCount}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="game-review-stats-table" data-testid="game-review-stats-table">
        <div class="game-review-stats-header">
          <div class="game-review-player-col">
            <span class="analysis-player-color-dot dot-white"></span>
            <strong>${this._report.gameInfo.white}</strong>
          </div>
          <span class="game-review-vs-label">Klasifikasi</span>
          <div class="game-review-player-col text-right">
            <strong>${this._report.gameInfo.black}</strong>
            <span class="analysis-player-color-dot dot-black"></span>
          </div>
        </div>
        <div class="game-review-stat-rows">
          ${rowsHtml}
        </div>
      </div>
    `;
  }

  _renderCriticalMomentsPane() {
    if (!this._report || !Array.isArray(this._report.criticalMoments) || this._report.criticalMoments.length === 0) {
      return `
        <div class="game-review-empty-state" data-testid="game-review-critical-empty">
          <p>${this._status === GAME_REVIEW_STATUS.COMPLETED ? 'Tidak ada blunder atau mistake signifikan dalam partai ini.' : 'Jalankan <strong>Analyze Game</strong> untuk mendeteksi momen krusial.'}</p>
        </div>
      `;
    }

    const itemsHtml = this._report.criticalMoments.map(m => {
      const meta = m.classificationMeta || MOVE_CLASSIFICATION_META[m.classification];
      const isSelected = m.ply === this._activePly;
      const playerText = m.playedBy === 'w' ? 'Putih' : 'Hitam';
      return `
        <div
          class="game-review-critical-item ${isSelected ? 'is-selected' : ''}"
          data-action="select-ply"
          data-ply="${m.ply}"
          data-testid="game-review-critical-item-${m.ply}"
        >
          <div class="critical-item-top">
            <span class="critical-move-title">Langkah ${m.moveNumber} (${playerText}): <strong>${m.san}</strong></span>
            <span class="badge ${meta.badgeClass}">${meta.symbol} ${meta.label}</span>
          </div>
          <div class="critical-item-details">
            <span>Kehilangan: <strong>${m.centipawnLoss} cp</strong></span>
            ${m.bestMove ? `<span>Rekomendasi: <strong>${m.bestMove.san}</strong></span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="game-review-critical-list" data-testid="game-review-critical-list">
        ${itemsHtml}
      </div>
    `;
  }

  _renderMoveReviewList() {
    if (!this._report || !Array.isArray(this._report.moveReviewList) || this._report.moveReviewList.length === 0) {
      return '';
    }

    const itemsHtml = this._report.moveReviewList.map(item => {
      const meta = item.classificationMeta || MOVE_CLASSIFICATION_META[item.classification];
      const isSelected = item.ply === this._activePly;
      const playerText = item.playedBy === 'w' ? 'P' : 'H';
      return `
        <div
          class="move-review-item ${isSelected ? 'is-selected' : ''}"
          data-action="select-ply"
          data-ply="${item.ply}"
          data-testid="move-review-item-${item.ply}"
        >
          <span class="move-review-num">${item.moveNumber}.${item.playedBy === 'b' ? '..' : ''}</span>
          <strong class="move-review-san">${item.san}</strong>
          <span class="badge ${meta.badgeClass} move-review-badge">${meta.symbol} ${meta.name}</span>
          <span class="move-review-loss">${item.centipawnLoss > 0 ? `-${item.pawnsLoss}` : '0.00'}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="game-review-moves-section" data-testid="game-review-moves-section">
        <div class="game-review-moves-header">
          <span class="game-review-moves-title">Daftar Review Langkah</span>
        </div>
        <div class="game-review-moves-scroll" data-testid="game-review-moves-scroll">
          ${itemsHtml}
        </div>
      </div>
    `;
  }

  _highlightActiveMoveItem(ply) {
    if (!this.container) return;
    const items = this.container.querySelectorAll('[data-action="select-ply"]');
    items.forEach(el => {
      const p = Number(el.getAttribute('data-ply'));
      if (p === ply) {
        el.classList.add('is-selected');
        // Jangan paksa scroll melompat atau mengacaukan viewport container
        // Biarkan posisi scroll pengguna tetap stabil
      } else {
        el.classList.remove('is-selected');
      }
    });
  }

  _bindEvents() {
    // Tab switching
    const tabBtns = this.container.querySelectorAll('.game-review-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab && tab !== this._activeTab) {
          this._activeTab = tab;
          this.render();
        }
      });
    });

    // Start / Stop buttons
    const startBtn = this.container.querySelector('[data-action="game-review-start"]');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (typeof this.onStartGameAnalysis === 'function') {
          this.onStartGameAnalysis();
        }
      });
    }

    const stopBtn = this.container.querySelector('[data-action="game-review-stop"]');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        if (typeof this.onStopGameAnalysis === 'function') {
          this.onStopGameAnalysis();
        }
      });
    }

    // Save Analysis button (MVP 5.6)
    const saveBtn = this.container.querySelector('[data-action="game-review-save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        if (this._saveStatus === 'saving' || this._saveStatus === 'saved') return;
        if (typeof this.onSaveAnalysis === 'function') {
          this.onSaveAnalysis();
        }
      });
    }

    // Select ply items (Critical moments & move review list)
    const plyItems = this.container.querySelectorAll('[data-action="select-ply"]');
    plyItems.forEach(item => {
      item.addEventListener('click', () => {
        const ply = Number(item.getAttribute('data-ply'));
        if (Number.isFinite(ply)) {
          this.setActivePly(ply);
          if (typeof this.onSelectPly === 'function') {
            this.onSelectPly(ply);
          }
        }
      });
    });
  }

  destroy() {
    if (this._graphComponent) {
      this._graphComponent.destroy();
      this._graphComponent = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}
