/**
 * Komponen Evaluation Graph SVG (MVP 5.5 — Evaluation Graph & Game Review)
 *
 * Fitur:
 * - Render kurva evaluasi interaktif menggunakan SVG murni (ringan & tanpa library eksternal).
 * - Sumbu horizontal: Plymouth / Move number.
 * - Sumbu vertikal: Evaluasi posisi dari perspektif Putih (+ unggul Putih, - unggul Hitam).
 * - Garis tengah 0.00 seimbang.
 * - Titik interaktif yang dapat diklik untuk melompat ke posisi papan catur.
 * - Highlight titik posisi aktif saat ini.
 * - Tooltip informasi posisi, langkah SAN, evaluasi, dan status mate.
 * - Skor forced mate ditampilkan dengan penanda khusus tanpa konversi centipawn palsu.
 * - Palet warna Caturan solid (bebas gradient).
 */

import { UI_ICONS } from './icons.js';

export class EvaluationGraphComponent {
  constructor({
    container,
    onSelectPoint = null,
    activePly = 0
  } = {}) {
    this.container = container;
    this.onSelectPoint = onSelectPoint;
    this.activePly = activePly;
    this._graphData = null;
    this._hoveredPoint = null;
  }

  setData(graphData, activePly = 0) {
    this._graphData = graphData;
    this.activePly = activePly;
    this.render();
  }

  setActivePly(ply) {
    this.activePly = ply;
    this._updateActiveMarker();
  }

  render() {
    if (!this.container) return;

    if (!this._graphData || !Array.isArray(this._graphData.points) || this._graphData.points.length === 0) {
      this.container.innerHTML = `
        <div class="eval-graph-empty" data-testid="eval-graph-empty">
          <p class="eval-graph-empty-text">Grafik evaluasi akan muncul setelah Game Review dijalankan.</p>
        </div>
      `;
      return;
    }

    const points = this._graphData.points;
    const totalPoints = points.length;

    // Dimensi SVG
    const width = 640;
    const height = 180;
    const padding = { top: 20, right: 30, bottom: 28, left: 45 };
    const plotWidth = width - padding.left - padding.right;
    const plotHeight = height - padding.top - padding.bottom;

    // Skala vertikal: -3.5 s.d +3.5 pawns
    const minEval = -3.5;
    const maxEval = 3.5;
    const evalRange = maxEval - minEval;

    const getY = (val) => {
      const clamped = Math.max(minEval, Math.min(maxEval, val));
      const normalized = (maxEval - clamped) / evalRange;
      return padding.top + normalized * plotHeight;
    };

    const getX = (index) => {
      if (totalPoints <= 1) return padding.left + plotWidth / 2;
      return padding.left + (index / (totalPoints - 1)) * plotWidth;
    };

    const zeroY = getY(0);

    // Bangun koordinat titik dan path SVG
    let pathD = '';
    const renderedPoints = points.map((p, idx) => {
      const x = getX(idx);
      const y = getY(p.score);
      if (idx === 0) {
        pathD += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        pathD += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return { ...p, x, y };
    });

    // Area fill Putih dan Hitam (Solid Caturan colors)
    // Area di atas garis 0 (Putih) dan di bawah garis 0 (Hitam)
    const activePoint = renderedPoints.find(p => p.ply === this.activePly) || renderedPoints[0];

    // Grid horizontal lines (-3, -2, -1, 0, +1, +2, +3)
    const gridLevels = [3, 2, 1, 0, -1, -2, -3];
    const gridLinesSvg = gridLevels.map(lvl => {
      const y = getY(lvl);
      const label = lvl > 0 ? `+${lvl}.00` : lvl === 0 ? '0.00' : `${lvl}.00`;
      const isZero = lvl === 0;
      return `
        <g class="eval-graph-grid-line ${isZero ? 'eval-graph-grid-zero eval-graph-zero-line' : ''}">
          <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${isZero ? 'var(--text-muted)' : 'var(--border-color)'}" stroke-width="${isZero ? '1.5' : '1'}" stroke-dasharray="${isZero ? 'none' : '3,3'}" />
          <text x="${padding.left - 6}" y="${y + 3}" text-anchor="end" class="eval-graph-axis-text">${label}</text>
        </g>
      `;
    }).join('');

    // X-axis step labels (Pilih interval langkah agar tidak terlalu rapat)
    const stepInterval = Math.max(1, Math.ceil(totalPoints / 10));
    const stepLabelsSvg = renderedPoints.map((p, idx) => {
      if (idx === 0 || idx === totalPoints - 1 || idx % stepInterval === 0) {
        const label = idx === 0 ? 'Awal' : `${Math.floor((p.ply - 1) / 2) + 1}`;
        return `
          <text x="${p.x}" y="${height - 8}" text-anchor="middle" class="eval-graph-axis-text">${label}</text>
        `;
      }
      return '';
    }).join('');

    // Circles for data points
    const pointsSvg = renderedPoints.map((p) => {
      const isSelected = p.ply === this.activePly;
      const isMate = p.isMate;
      const radius = isSelected ? 5.5 : isMate ? 4.5 : 3.5;
      const fillColor = isMate ? 'var(--status-danger-text)' : 'var(--accent-main)';
      return `
        <circle
          cx="${p.x.toFixed(1)}"
          cy="${p.y.toFixed(1)}"
          r="${radius}"
          class="eval-graph-point ${isSelected ? 'is-selected' : ''} ${isMate ? 'is-mate' : ''}"
          data-ply="${p.ply}"
          data-testid="eval-graph-point-${p.ply}"
          fill="${fillColor}"
          stroke="var(--bg-surface)"
          stroke-width="1.5"
        />
      `;
    }).join('');

    // Active vertical guide line
    const activeGuideX = activePoint ? activePoint.x : padding.left;
    const activeGuideY = activePoint ? activePoint.y : zeroY;

    this.container.innerHTML = `
      <div class="eval-graph-wrapper" data-testid="eval-graph-wrapper">
        <div class="eval-graph-header">
          <div class="eval-graph-title-wrap">
            <span class="eval-graph-title">Grafik Evaluasi</span>
            <span class="eval-graph-subtitle-info" title="Evaluasi dari perspektif Putih (+ unggul Putih, - unggul Hitam)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="16" x2="12" y2="12"/>
                <line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
            </span>
          </div>
          <span class="badge eval-graph-badge" data-testid="eval-graph-current-badge">
            ${activePoint ? `${activePoint.ply === 0 ? 'Posisi Awal' : `Langkah ${Math.floor((activePoint.ply - 1) / 2) + 1}`}: ${activePoint.displayEval}` : '0.00'}
          </span>
        </div>

        <div class="eval-graph-svg-container" data-testid="eval-graph-svg-container">
          <svg
            viewBox="0 0 ${width} ${height}"
            class="eval-graph-svg"
            data-testid="eval-graph-svg"
            preserveAspectRatio="xMidYMid meet"
          >
            <!-- Grid Lines & Axis Labels -->
            ${gridLinesSvg}
            ${stepLabelsSvg}

            <!-- Evaluation Line -->
            <path
              d="${pathD}"
              fill="none"
              stroke="var(--accent-main)"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="eval-graph-path"
            />

            <!-- Active Position Guide Line -->
            <line
              x1="${activeGuideX}"
              y1="${padding.top}"
              x2="${activeGuideX}"
              y2="${height - padding.bottom}"
              stroke="var(--accent-main)"
              stroke-width="1.5"
              stroke-dasharray="4,3"
              class="eval-graph-active-guide"
              data-testid="eval-graph-active-guide"
            />

            <!-- Data Points -->
            ${pointsSvg}
          </svg>

          <!-- Floating Tooltip -->
          <div class="eval-graph-tooltip hidden" data-testid="eval-graph-tooltip"></div>
        </div>
      </div>
    `;

    this._bindEvents(renderedPoints);
  }

  _bindEvents(renderedPoints) {
    const svgEl = this.container.querySelector('[data-testid="eval-graph-svg"]');
    const tooltipEl = this.container.querySelector('[data-testid="eval-graph-tooltip"]');
    if (!svgEl) return;

    const circles = svgEl.querySelectorAll('.eval-graph-point');
    circles.forEach(circle => {
      const ply = Number(circle.getAttribute('data-ply'));
      const pointData = renderedPoints.find(p => p.ply === ply);

      circle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activePly = ply;
        this._updateActiveMarker();
        if (typeof this.onSelectPoint === 'function') {
          this.onSelectPoint(ply, pointData);
        }
      });

      circle.addEventListener('mouseenter', () => {
        if (!tooltipEl || !pointData) return;
        const moveText = pointData.ply === 0 ? 'Posisi Awal' : `Langkah ${pointData.moveNumber} (${pointData.playedBy === 'w' ? 'Putih' : 'Hitam'})`;
        const sanText = pointData.san || '-';
        const evalText = pointData.isMate ? `Skakmat: ${pointData.displayEval}` : `Evaluasi: ${pointData.displayEval}`;

        tooltipEl.innerHTML = `
          <strong>${moveText}</strong>
          <div>${sanText}</div>
          <div class="eval-tooltip-val">${evalText}</div>
        `;
        tooltipEl.classList.remove('hidden');

        // Posisi Tooltip
        const containerRect = this.container.getBoundingClientRect();
        const circleRect = circle.getBoundingClientRect();
        const left = circleRect.left - containerRect.left + circleRect.width / 2;
        const top = circleRect.top - containerRect.top - 10;

        tooltipEl.style.left = `${Math.max(40, Math.min(containerRect.width - 40, left))}px`;
        tooltipEl.style.top = `${Math.max(10, top - 45)}px`;
      });

      circle.addEventListener('mouseleave', () => {
        if (tooltipEl) {
          tooltipEl.classList.add('hidden');
        }
      });
    });
  }

  _updateActiveMarker() {
    if (!this.container) return;
    const circles = this.container.querySelectorAll('.eval-graph-point');
    let activeCircle = null;
    circles.forEach(circle => {
      const ply = Number(circle.getAttribute('data-ply'));
      if (ply === this.activePly) {
        circle.classList.add('is-selected');
        circle.setAttribute('r', '5.5');
        activeCircle = circle;
      } else {
        circle.classList.remove('is-selected');
        circle.setAttribute('r', circle.classList.contains('is-mate') ? '4.5' : '3.5');
      }
    });

    if (activeCircle && this._graphData?.points) {
      const guide = this.container.querySelector('[data-testid="eval-graph-active-guide"]');
      const cx = activeCircle.getAttribute('cx');
      if (guide && cx) {
        guide.setAttribute('x1', cx);
        guide.setAttribute('x2', cx);
      }

      const pointData = this._graphData.points.find(p => p.ply === this.activePly);
      const badge = this.container.querySelector('[data-testid="eval-graph-current-badge"]');
      if (badge && pointData) {
        const moveLabel = pointData.ply === 0 ? 'Posisi Awal' : `Langkah ${Math.floor((pointData.ply - 1) / 2) + 1}`;
        badge.textContent = `${moveLabel}: ${pointData.displayEval}`;
      }
    }
  }

  destroy() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this._graphData = null;
    this.onSelectPoint = null;
  }
}
