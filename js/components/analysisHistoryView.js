/**
 * Komponen Halaman Riwayat Analisis & Cloud Save (MVP 5.6)
 *
 * Fitur:
 * 1. Menampilkan daftar riwayat analisis yang tersimpan di Supabase secara rapi (Card list).
 * 2. Menampilkan informasi: Judul, Pemain Putih & Hitam, Hasil, Event, Jumlah Langkah, Tanggal Simpan, Badge Status Selesai.
 * 3. Search lokal/filter pada data yang dimuat (berdasarkan White, Black, Title, Event).
 * 4. Pengurutan: Terbaru (created_at DESC) vs Terlama (created_at ASC).
 * 5. Pagination yang efisien (20 item per halaman).
 * 6. Rename Analysis (Ubah judul langsung dengan modal/prompt dan simpan ke Supabase).
 * 7. Delete Analysis (Hapus riwayat dengan konfirmasi dialog).
 * 8. Reopen Saved Analysis (Membuka kembali Game Review secara utuh tanpa Stockfish ulang jika kompatibel).
 * 9. Loading state, Empty state, Error state, dan tombol Analisis Baru (CTA ke Studio).
 * 10. Desain solid Caturan: Light Mode & Dark Mode, responsif Desktop & HP, zero gradients.
 */

import { UI_ICONS } from './icons.js';
import { analysisHistoryService, isSnapshotCompatible, restoreGameReviewFromSnapshot } from '../services/analysisHistoryService.js';
import { validateAndParsePgn } from '../services/pgnService.js';
import { authService } from '../services/auth.js';
import { GAME_REVIEW_STATUS } from '../services/chessGameReviewService.js';
import { renderChessboardThumbnailHtml } from './chessboardThumbnail.js';

export function formatSaveDate(isoDateStr) {
  if (!isoDateStr) return '-';
  try {
    const d = new Date(isoDateStr);
    if (Number.isNaN(d.getTime())) return isoDateStr;
    const months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
      'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
    ];
    const day = d.getDate();
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${month} ${year}, ${hours}:${mins}`;
  } catch {
    return isoDateStr;
  }
}

export function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class AnalysisHistoryComponent {
  constructor({
    container,
    onNavigateToStudio = null,
    onOpenAnalysis = null
  } = {}) {
    this.container = container;
    this.onNavigateToStudio = onNavigateToStudio;
    this.onOpenAnalysis = onOpenAnalysis;

    this.state = {
      isLoading: true,
      error: null,
      items: [],
      totalCount: 0,
      page: 1,
      pageSize: 20,
      searchQuery: '',
      sortOrder: 'desc', // 'desc' | 'asc'
      activeMenuId: null, // ID item yang popup menunya terbuka
      editingItem: null,  // { id, title } untuk dialog rename
      deletingItem: null, // { id, title } untuk dialog delete
      actionLoadingId: null, // ID item yang sedang diproses (delete / rename)
      openingHistoryId: null
    };

    this._boundClickListener = null;
  }

  async init() {
    this._setupGlobalClickListener();
    await this.fetchData();
  }

  _setupGlobalClickListener() {
    if (this._boundClickListener) {
      document.removeEventListener('click', this._boundClickListener);
    }
    this._boundClickListener = (e) => {
      // Jika klik di luar menu titik tiga, tutup dropdown menu
      if (!e.target.closest('[data-action="toggle-item-menu"]') && !e.target.closest('.history-item-menu-dropdown')) {
        if (this.state.activeMenuId !== null) {
          this.state.activeMenuId = null;
          this.render();
        }
      }
    };
    document.addEventListener('click', this._boundClickListener);
  }

  async fetchData() {
    this.state.isLoading = true;
    this.state.error = null;
    this.render();

    try {
      const result = await analysisHistoryService.getAnalysisList({
        page: this.state.page,
        pageSize: this.state.pageSize,
        searchQuery: this.state.searchQuery,
        sortOrder: this.state.sortOrder
      });

      if (result.error) {
        this.state.error = result.error;
        this.state.items = [];
        this.state.totalCount = 0;
      } else {
        this.state.items = result.items || [];
        this.state.totalCount = result.totalCount || 0;
      }
    } catch (err) {
      this.state.error = err instanceof Error ? err.message : 'Gagal memuat riwayat analisis.';
      this.state.items = [];
      this.state.totalCount = 0;
    } finally {
      this.state.isLoading = false;
      this.render();
    }
  }

  _renderContentBodyHtml() {
    const {
      isLoading,
      error,
      items,
      totalCount,
      page,
      pageSize,
      searchQuery,
      activeMenuId,
      openingHistoryId
    } = this.state;

    const user = authService.getUser();
    const isAuthenticated = Boolean(user && user.id);
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const startItemIdx = totalCount > 0 ? (page - 1) * pageSize + 1 : 0;
    const endItemIdx = Math.min(page * pageSize, totalCount);

    if (!isAuthenticated) {
      return `
        <div class="history-empty-card" data-testid="history-unauthenticated">
          <div class="history-empty-icon">${UI_ICONS.lock || '🔒'}</div>
          <h3 class="history-empty-title">Masuk untuk Melihat Riwayat</h3>
          <p class="history-empty-desc">
            Fitur riwayat cloud membutuhkan akun terdaftar. Masuk untuk mengelola dan membuka analisis pertandingan Anda di berbagai perangkat.
          </p>
        </div>
      `;
    }

    if (isLoading) {
      return `
        <div class="history-loading-card" data-testid="history-loading-state">
          <span class="analysis-engine-spinner" style="width:28px;height:28px;"></span>
          <p class="history-loading-text">Memuat riwayat analisis tersimpan...</p>
        </div>
      `;
    }

    if (error) {
      return `
        <div class="history-error-card" data-testid="history-error-state">
          <div class="history-error-icon">${UI_ICONS.alertTriangle}</div>
          <h3 class="history-error-title">Gagal Memuat Riwayat</h3>
          <p class="history-error-desc">${escapeHtml(error)}</p>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="retry-fetch"
            data-testid="history-retry-btn"
          >
            ${UI_ICONS.restart} Coba Lagi
          </button>
        </div>
      `;
    }

    if (items.length === 0) {
      return `
        <div class="history-empty-card" data-testid="history-empty-state">
          <div class="history-empty-icon">${UI_ICONS.folder || '📁'}</div>
          <h3 class="history-empty-title">
            ${searchQuery ? 'Riwayat tidak ditemukan' : 'Belum ada analisis tersimpan.'}
          </h3>
          <p class="history-empty-desc">
            ${searchQuery
              ? `Tidak ada riwayat yang cocok dengan kata kunci "${escapeHtml(searchQuery)}".`
              : 'Pertandingan yang telah Anda review di Analysis Studio dapat disimpan secara permanen ke cloud.'}
          </p>
          ${!searchQuery ? `
            <button
              type="button"
              class="btn btn-primary"
              data-action="new-analysis"
              data-testid="history-empty-cta-btn"
            >
              Buka Analysis Studio
            </button>
          ` : `
            <button
              type="button"
              class="btn btn-secondary btn-sm"
              data-action="clear-search"
            >
              Reset Pencarian
            </button>
          `}
        </div>
      `;
    }

    return `
      <div class="history-list-grid" data-testid="history-list-grid">
        ${items.map(item => this._renderHistoryCard(item, activeMenuId, openingHistoryId)).join('')}
      </div>

      <!-- Pagination Bar -->
      <div class="history-pagination-bar" data-testid="history-pagination-bar">
        <div class="history-pagination-info" data-testid="history-pagination-info">
          Menampilkan ${startItemIdx}–${endItemIdx} dari ${totalCount} analisis
        </div>
        <div class="history-pagination-controls">
          <button
            type="button"
            class="btn btn-sm history-page-btn"
            data-action="prev-page"
            data-testid="history-prev-page-btn"
            ${page <= 1 ? 'disabled' : ''}
            aria-label="Halaman sebelumnya"
          >
            ${UI_ICONS.chevronLeft || '‹'}
          </button>

          ${this._renderPageNumbers(page, totalPages)}

          <button
            type="button"
            class="btn btn-sm history-page-btn"
            data-action="next-page"
            data-testid="history-next-page-btn"
            ${page >= totalPages ? 'disabled' : ''}
            aria-label="Halaman berikutnya"
          >
            ${UI_ICONS.chevronRight || '›'}
          </button>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.container) return;

    const {
      searchQuery,
      sortOrder,
      editingItem,
      deletingItem
    } = this.state;

    // Jika shell sudah terpasang, cukup update container konten & modal agar DOM input search tetap utuh
    const existingContentContainer = this.container.querySelector('.history-content-container');
    const existingSearchInput = this.container.querySelector('[data-testid="history-search-input"]');
    const existingSortSelect = this.container.querySelector('[data-testid="history-sort-select"]');

    if (existingContentContainer && existingSearchInput) {
      existingContentContainer.innerHTML = this._renderContentBodyHtml();
      
      // Sinkronkan nilai clear button jika ada
      const clearBtnContainer = this.container.querySelector('.history-search-group');
      if (clearBtnContainer) {
        const existingClearBtn = clearBtnContainer.querySelector('[data-action="clear-search"]');
        if (searchQuery && !existingClearBtn) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'history-search-clear-btn';
          btn.setAttribute('data-action', 'clear-search');
          btn.title = 'Hapus pencarian';
          btn.innerHTML = UI_ICONS.close || '×';
          clearBtnContainer.appendChild(btn);
          btn.addEventListener('click', () => {
            this.state.searchQuery = '';
            this.state.page = 1;
            existingSearchInput.value = '';
            existingSearchInput.focus();
            this.fetchData();
          });
        } else if (!searchQuery && existingClearBtn) {
          existingClearBtn.remove();
        }
      }

      if (existingSortSelect && existingSortSelect.value !== sortOrder) {
        existingSortSelect.value = sortOrder;
      }

      // Update Modal slot
      let modalSlot = this.container.querySelector('.history-modal-slot');
      if (!modalSlot) {
        modalSlot = document.createElement('div');
        modalSlot.className = 'history-modal-slot';
        this.container.appendChild(modalSlot);
      }
      modalSlot.innerHTML = `
        ${editingItem ? this._renderRenameModal(editingItem) : ''}
        ${deletingItem ? this._renderDeleteModal(deletingItem) : ''}
      `;

      this._bindContentEvents();
      return;
    }

    this.container.innerHTML = `
      <div class="analysis-history-page" data-testid="analysis-history-page">
        <!-- Header Riwayat Analisis -->
        <div class="analysis-history-header">
          <div class="history-header-left">
            <div class="history-header-icon-box" aria-hidden="true">
              ${UI_ICONS.cloud || UI_ICONS.history || '☁️'}
            </div>
            <div>
              <h1 class="analysis-history-title">Riwayat Analisis</h1>
              <p class="analysis-history-subtitle">
                Pertandingan yang telah Anda analisis dan simpan di cloud.
              </p>
            </div>
          </div>
          <div class="history-header-right">
            <button
              type="button"
              class="btn btn-primary analysis-new-btn"
              data-action="new-analysis"
              data-testid="history-new-analysis-btn"
            >
              ${UI_ICONS.plus || '+'}
              <span>Analisis Baru</span>
            </button>
          </div>
        </div>

        <!-- Filter & Search Controls -->
        <div class="history-controls-bar">
          <div class="history-search-group">
            <span class="history-search-icon" aria-hidden="true">${UI_ICONS.search}</span>
            <input
              type="text"
              class="form-control history-search-input"
              data-testid="history-search-input"
              placeholder="Cari judul, nama pemain, atau event..."
              value="${escapeHtml(searchQuery)}"
              aria-label="Cari riwayat analisis"
            />
            ${searchQuery ? `
              <button
                type="button"
                class="history-search-clear-btn"
                data-action="clear-search"
                title="Hapus pencarian"
              >
                ${UI_ICONS.close || '×'}
              </button>
            ` : ''}
          </div>

          <div class="history-sort-group">
            <label class="history-sort-label" for="history-sort-select">Urutkan:</label>
            <select
              id="history-sort-select"
              class="form-control history-sort-select"
              data-testid="history-sort-select"
            >
              <option value="desc" ${sortOrder === 'desc' ? 'selected' : ''}>Terbaru</option>
              <option value="asc" ${sortOrder === 'asc' ? 'selected' : ''}>Terlama</option>
            </select>
          </div>
        </div>

        <!-- Konten Utama: Loading / Error / Empty / List -->
        <div class="history-content-container">
          ${this._renderContentBodyHtml()}
        </div>

        <!-- Modals Slot: Rename Dialog & Delete Confirmation Dialog -->
        <div class="history-modal-slot">
          ${editingItem ? this._renderRenameModal(editingItem) : ''}
          ${deletingItem ? this._renderDeleteModal(deletingItem) : ''}
        </div>
      </div>
    `;

    this._bindAllEvents();
  }

  _renderHistoryCard(item, activeMenuId, openingHistoryId) {
    const isMenuOpen = activeMenuId === item.id;
    const isOpening = openingHistoryId === item.id;
    const dateFormatted = formatSaveDate(item.created_at);
    const whitePlayer = item.white_player || 'Putih';
    const blackPlayer = item.black_player || 'Hitam';
    const result = item.result || '*';
    const moveCount = item.move_count || 0;
    const title = item.title || `${whitePlayer} vs ${blackPlayer}`;

    const thumbnailHtml = renderChessboardThumbnailHtml({
      fen: item.final_fen || null,
      pgnText: item.pgn_text || null,
      reviewSnapshot: item.review_snapshot || null,
      className: 'history-board-thumbnail'
    });

    return `
      <div class="history-card ${isOpening ? 'is-opening' : ''}" data-testid="history-item-${item.id}">
        <!-- Mini Board Visual Preview Thumbnail (Final Mainline Position) -->
        <div class="history-card-left" data-action="open-analysis" data-id="${item.id}" role="button" tabindex="0" title="Buka analisis ${escapeHtml(title)}">
          ${thumbnailHtml}
        </div>

        <!-- Main Info -->
        <div class="history-card-main" data-action="open-analysis" data-id="${item.id}" role="button" tabindex="0">
          <div class="history-card-top-row">
            <h4 class="history-card-title" title="${escapeHtml(title)}">${escapeHtml(title)}</h4>
            <span class="badge badge-green history-card-badge">Selesai</span>
          </div>

          <div class="history-card-players">
            <span>${escapeHtml(whitePlayer)}</span>
            <span class="history-players-vs">vs</span>
            <span>${escapeHtml(blackPlayer)}</span>
            ${item.event ? `<span class="history-card-event">• ${escapeHtml(item.event)}</span>` : ''}
            <span class="history-card-result">• ${escapeHtml(result)}</span>
          </div>

          <div class="history-card-meta-row">
            <span class="history-meta-moves">${moveCount} langkah</span>
            <span class="history-meta-dot">•</span>
            <span class="history-meta-date">Disimpan: ${dateFormatted}</span>
          </div>
        </div>

        <!-- Action Dropdown Trigger -->
        <div class="history-card-actions">
          <button
            type="button"
            class="btn btn-icon history-menu-btn"
            data-action="toggle-item-menu"
            data-id="${item.id}"
            data-testid="history-menu-btn-${item.id}"
            aria-label="Pilihan aksi riwayat"
            aria-expanded="${isMenuOpen ? 'true' : 'false'}"
          >
            ${UI_ICONS.moreVertical || '⋮'}
          </button>

          ${isMenuOpen ? `
            <div class="history-item-menu-dropdown" data-testid="history-menu-dropdown-${item.id}">
              <button
                type="button"
                class="history-menu-item"
                data-action="rename-analysis"
                data-id="${item.id}"
                data-title="${escapeHtml(title)}"
                data-testid="history-rename-btn-${item.id}"
              >
                ${UI_ICONS.edit || '✏️'}
                <span>Ubah Judul</span>
              </button>
              <button
                type="button"
                class="history-menu-item is-delete"
                data-action="delete-analysis"
                data-id="${item.id}"
                data-title="${escapeHtml(title)}"
                data-testid="history-delete-btn-${item.id}"
              >
                ${UI_ICONS.trash || '🗑️'}
                <span>Hapus</span>
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  _renderPageNumbers(currentPage, totalPages) {
    const pages = [];
    for (let p = 1; p <= totalPages; p += 1) {
      if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
        pages.push(p);
      } else if (pages[pages.length - 1] !== '...') {
        pages.push('...');
      }
    }

    return pages.map(p => {
      if (p === '...') {
        return `<span class="history-page-ellipsis">…</span>`;
      }
      const isActive = p === currentPage;
      return `
        <button
          type="button"
          class="btn btn-sm history-page-num ${isActive ? 'is-active' : ''}"
          data-action="go-to-page"
          data-page="${p}"
          data-testid="history-page-btn-${p}"
          ${isActive ? 'aria-current="page"' : ''}
        >
          ${p}
        </button>
      `;
    }).join('');
  }

  _renderRenameModal(editingItem) {
    return `
      <div class="history-modal-backdrop" data-testid="rename-modal-backdrop">
        <div class="history-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="rename-modal-title">
          <div class="history-modal-header">
            <h3 id="rename-modal-title" class="history-modal-title">Ubah Judul Analisis</h3>
            <button type="button" class="history-modal-close" data-action="close-modal" aria-label="Tutup">
              ${UI_ICONS.close || '×'}
            </button>
          </div>
          <div class="history-modal-body">
            <label for="rename-input" class="form-label">Nama / Judul Analisis:</label>
            <input
              type="text"
              id="rename-input"
              class="form-control"
              data-testid="rename-input"
              value="${escapeHtml(editingItem.title)}"
              maxlength="150"
            />
          </div>
          <div class="history-modal-footer">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Batal</button>
            <button
              type="button"
              class="btn btn-primary"
              data-action="confirm-rename"
              data-testid="confirm-rename-btn"
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _renderDeleteModal(deletingItem) {
    return `
      <div class="history-modal-backdrop" data-testid="delete-modal-backdrop">
        <div class="history-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-modal-title">
          <div class="history-modal-header">
            <h3 id="delete-modal-title" class="history-modal-title">Hapus Riwayat Analisis?</h3>
            <button type="button" class="history-modal-close" data-action="close-modal" aria-label="Tutup">
              ${UI_ICONS.close || '×'}
            </button>
          </div>
          <div class="history-modal-body">
            <p>
              Apakah Anda yakin ingin menghapus riwayat analisis <strong>"${escapeHtml(deletingItem.title)}"</strong>?
            </p>
            <p class="history-modal-warning">
              Tindakan ini permanen dan akan menghapus data analisis tersimpan di cloud.
            </p>
          </div>
          <div class="history-modal-footer">
            <button type="button" class="btn btn-secondary" data-action="close-modal">Batal</button>
            <button
              type="button"
              class="btn btn-danger"
              data-action="confirm-delete"
              data-testid="confirm-delete-btn"
            >
              Hapus Analisis
            </button>
          </div>
        </div>
      </div>
    `;
  }

  _bindAllEvents() {
    // New Analysis CTA
    const newBtns = this.container.querySelectorAll('[data-action="new-analysis"]');
    newBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof this.onNavigateToStudio === 'function') {
          this.onNavigateToStudio();
        }
      });
    });

    // Search input (Automatic search dengan debounce 180ms tanpa unmount input)
    const searchInput = this.container.querySelector('[data-testid="history-search-input"]');
    if (searchInput) {
      let timeoutId = null;
      searchInput.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          this.state.searchQuery = searchInput.value.trim();
          this.state.page = 1;
          this.fetchData();
        }, 180);
      });
    }

    const clearSearchBtn = this.container.querySelector('[data-action="clear-search"]');
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        this.state.searchQuery = '';
        this.state.page = 1;
        const input = this.container.querySelector('[data-testid="history-search-input"]');
        if (input) {
          input.value = '';
          input.focus();
        }
        this.fetchData();
      });
    }

    // Sort select
    const sortSelect = this.container.querySelector('[data-testid="history-sort-select"]');
    if (sortSelect) {
      sortSelect.addEventListener('change', () => {
        this.state.sortOrder = sortSelect.value;
        this.state.page = 1;
        this.fetchData();
      });
    }

    this._bindContentEvents();
  }

  _bindContentEvents() {
    // Retry fetch
    const retryBtn = this.container.querySelector('[data-action="retry-fetch"]');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.fetchData();
      });
    }

    // Clear search dari empty-state CTA
    const resetSearchBtns = this.container.querySelectorAll('.history-content-container [data-action="clear-search"]');
    resetSearchBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.searchQuery = '';
        this.state.page = 1;
        const input = this.container.querySelector('[data-testid="history-search-input"]');
        if (input) {
          input.value = '';
          input.focus();
        }
        this.fetchData();
      });
    });

    // New analysis dari empty-state CTA
    const emptyNewBtns = this.container.querySelectorAll('.history-content-container [data-action="new-analysis"]');
    emptyNewBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        if (typeof this.onNavigateToStudio === 'function') {
          this.onNavigateToStudio();
        }
      });
    });

    // Pagination buttons
    const prevPageBtn = this.container.querySelector('[data-action="prev-page"]');
    if (prevPageBtn) {
      prevPageBtn.addEventListener('click', () => {
        if (this.state.page > 1) {
          this.state.page -= 1;
          this.fetchData();
        }
      });
    }

    const nextPageBtn = this.container.querySelector('[data-action="next-page"]');
    if (nextPageBtn) {
      nextPageBtn.addEventListener('click', () => {
        const totalPages = Math.ceil(this.state.totalCount / this.state.pageSize);
        if (this.state.page < totalPages) {
          this.state.page += 1;
          this.fetchData();
        }
      });
    }

    const pageNumBtns = this.container.querySelectorAll('[data-action="go-to-page"]');
    pageNumBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetPage = Number(btn.getAttribute('data-page'));
        if (targetPage && targetPage !== this.state.page) {
          this.state.page = targetPage;
          this.fetchData();
        }
      });
    });

    // Dropdown toggle
    const menuBtns = this.container.querySelectorAll('[data-action="toggle-item-menu"]');
    menuBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        this.state.activeMenuId = this.state.activeMenuId === id ? null : id;
        this.render();
      });
    });

    // Rename Analysis trigger
    const renameBtns = this.container.querySelectorAll('[data-action="rename-analysis"]');
    renameBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        this.state.activeMenuId = null;
        this.state.editingItem = { id, title };
        this.render();
      });
    });

    // Delete Analysis trigger
    const deleteBtns = this.container.querySelectorAll('[data-action="delete-analysis"]');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const title = btn.getAttribute('data-title');
        this.state.activeMenuId = null;
        this.state.deletingItem = { id, title };
        this.render();
      });
    });

    // Close Modal buttons
    const closeBtns = this.container.querySelectorAll('[data-action="close-modal"]');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.state.editingItem = null;
        this.state.deletingItem = null;
        this.render();
      });
    });

    // Confirm Rename
    const confirmRenameBtn = this.container.querySelector('[data-action="confirm-rename"]');
    if (confirmRenameBtn) {
      confirmRenameBtn.addEventListener('click', async () => {
        const inputEl = this.container.querySelector('#rename-input');
        const newTitle = inputEl ? inputEl.value.trim() : '';
        if (!newTitle || !this.state.editingItem) return;

        try {
          await analysisHistoryService.renameAnalysis(this.state.editingItem.id, newTitle);
          this.state.editingItem = null;
          await this.fetchData();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Gagal mengubah judul analisis.');
        }
      });
    }

    // Confirm Delete
    const confirmDeleteBtn = this.container.querySelector('[data-action="confirm-delete"]');
    if (confirmDeleteBtn) {
      confirmDeleteBtn.addEventListener('click', async () => {
        if (!this.state.deletingItem) return;

        try {
          await analysisHistoryService.deleteAnalysis(this.state.deletingItem.id);
          this.state.deletingItem = null;
          await this.fetchData();
        } catch (err) {
          alert(err instanceof Error ? err.message : 'Gagal menghapus riwayat analisis.');
        }
      });
    }

    // Open Analysis (Replay Saved Game)
    const openCardTriggers = this.container.querySelectorAll('[data-action="open-analysis"]');
    openCardTriggers.forEach(el => {
      el.addEventListener('click', async () => {
        const id = el.getAttribute('data-id');
        if (!id) return;
        await this._handleReopenAnalysis(id);
      });
    });
  }

  async _handleReopenAnalysis(id) {
    this.state.openingHistoryId = id;
    this.render();

    try {
      const record = await analysisHistoryService.getAnalysisById(id);
      if (!record || !record.pgn_text) {
        throw new Error('Data riwayat pertandingan tidak lengkap.');
      }

      // Validasi ulang PGN dengan parser terbaru
      const parsedGame = validateAndParsePgn(record.pgn_text);
      if (!parsedGame || !parsedGame.valid) {
        throw new Error('PGN tersimpan tidak dapat dibaca oleh parser catur.');
      }

      const snapshot = record.review_snapshot;
      let restoredReview = null;

      if (isSnapshotCompatible(snapshot)) {
        restoredReview = restoreGameReviewFromSnapshot(snapshot, parsedGame);
      }

      if (typeof this.onOpenAnalysis === 'function') {
        this.onOpenAnalysis({
          historyId: record.id,
          title: record.title,
          pgnText: record.pgn_text,
          parsedGame,
          restoredReview,
          isCompatible: Boolean(restoredReview)
        });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal membuka riwayat analisis.');
      this.state.openingHistoryId = null;
      this.render();
    }
  }

  destroy() {
    if (this._boundClickListener) {
      document.removeEventListener('click', this._boundClickListener);
      this._boundClickListener = null;
    }
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

export function renderAnalysisHistoryView(container, callbacks = {}) {
  const component = new AnalysisHistoryComponent({
    container,
    onNavigateToStudio: callbacks.onNavigateToStudio,
    onOpenAnalysis: callbacks.onOpenAnalysis
  });
  component.init();
  return component;
}

export default renderAnalysisHistoryView;
