/**
 * Komponen Papan Catur Interaktif (Interactive Chessboard UI)
 * Terintegrasi penuh dengan Chess.js untuk validasi langkah legal,
 * panduan latihan bertahap (multi-step guided practice), promosi pion,
 * indikator langkah legal, serta tombol Restart, Petunjuk, dan Balik Papan.
 */

import { Chess, WHITE, BLACK, PAWN, QUEEN, ROOK, BISHOP, KNIGHT } from '../vendor/chess.js';
import { getPieceSvg, UI_ICONS } from './icons.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const PIECE_NAMES_ID = {
  p: 'Pion',
  n: 'Kuda',
  b: 'Gajah',
  r: 'Benteng',
  q: 'Menteri',
  k: 'Raja'
};

export class InteractiveChessboard {
  /**
   * @param {HTMLElement} container - Elemen DOM tempat papan catur dirender
   * @param {Object} practiceConfig - Konfigurasi latihan dari data kurikulum
   * @param {Object} callbacks - Callback { onPracticeSuccess }
   */
  constructor(container, practiceConfig, callbacks = {}) {
    this.container = container;
    this.config = practiceConfig;
    this.callbacks = callbacks;

    this.chess = new Chess(this.config.initialFen);
    this.orientation = this.config.orientation === 'black' ? 'black' : 'white';
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.lastMove = null; // { from, to }
    this.hintSquares = [];
    this.currentStepIndex = 0;
    this.isPracticeSolved = false;
    this.freePlayMode = false;
    this.isLockedForReply = false;
    this.pendingPromotion = null; // { from, to }
    this.inspectedSquareInfo = 'Klik bidak untuk melihat langkah legal.';

    this.feedback = {
      type: 'info', // 'info' | 'success' | 'warning' | 'hint'
      message: 'Pilih bidak dan lakukan langkah sesuai instruksi latihan di atas.'
    };

    this._replyTimeout = null;
    this.render();
  }

  destroy() {
    if (this._replyTimeout) {
      clearTimeout(this._replyTimeout);
    }
  }

  restart() {
    if (this._replyTimeout) {
      clearTimeout(this._replyTimeout);
    }
    this.chess.load(this.config.initialFen);
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.lastMove = null;
    this.hintSquares = [];
    this.currentStepIndex = 0;
    this.isPracticeSolved = false;
    this.freePlayMode = false;
    this.isLockedForReply = false;
    this.pendingPromotion = null;
    this.inspectedSquareInfo = 'Posisi latihan diulang dari awal.';
    this.feedback = {
      type: 'info',
      message: 'Posisi berhasil direset. Silakan mulai dari Langkah 1.'
    };
    this.render();
  }

  flipBoard() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    this.render();
  }

  showHint() {
    const steps = this.config.steps || [];
    if (this.isPracticeSolved || this.currentStepIndex >= steps.length) {
      this.feedback = {
        type: 'info',
        message: 'Latihan sudah selesai! Anda bebas bereksplorasi atau mengulang posisi.'
      };
      this.render();
      return;
    }

    const currentStep = steps[this.currentStepIndex];
    const expectedSan = currentStep.expectedMoves[0];
    const allVerbose = this.chess.moves({ verbose: true });
    const match = allVerbose.find(
      m =>
        m.san === expectedSan ||
        m.san.replace(/[+#]$/, '') === expectedSan.replace(/[+#]$/, '') ||
        m.lan === expectedSan
    );

    if (match) {
      this.hintSquares = [match.from, match.to];
      this.selectedSquare = match.from;
      this.legalMovesForSelected = this.chess.moves({ square: match.from, verbose: true });
    }

    this.feedback = {
      type: 'hint',
      message: `Petunjuk: ${currentStep.hint}`
    };
    this.render();
  }

  enableFreePlay() {
    this.freePlayMode = true;
    this.feedback = {
      type: 'info',
      message: 'Mode Eksplorasi Bebas aktif: Anda dapat menggerakkan bidak Putih maupun Hitam sesuai aturan catur.'
    };
    this.render();
  }

  _handleSquareClick(square) {
    if (this.isLockedForReply || this.pendingPromotion) return;

    const clickedPiece = this.chess.get(square);
    if (clickedPiece) {
      const colorName = clickedPiece.color === WHITE ? 'Putih' : 'Hitam';
      const pieceName = PIECE_NAMES_ID[clickedPiece.type] || clickedPiece.type;
      this.inspectedSquareInfo = `Petak ${square}: ${pieceName} ${colorName}`;
    } else {
      this.inspectedSquareInfo = `Petak ${square}: Kosong`;
    }

    // Jika sudah ada bidak yang dipilih dan pengguna mengklik petak tujuan legal
    if (this.selectedSquare) {
      const candidateMoves = this.legalMovesForSelected.filter(m => m.to === square);
      if (candidateMoves.length > 0) {
        // Cek apakah langkah promosi pion
        const isPromotion = candidateMoves.some(m => Boolean(m.promotion));
        if (isPromotion) {
          this.pendingPromotion = { from: this.selectedSquare, to: square };
          this.render();
          return;
        }
        this._executePlayerMove({ from: this.selectedSquare, to: square });
        return;
      }
    }

    // Pilih bidak milik warna yang sedang giliran jalan
    if (clickedPiece && clickedPiece.color === this.chess.turn()) {
      if (this.selectedSquare === square) {
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
      } else {
        this.selectedSquare = square;
        this.legalMovesForSelected = this.chess.moves({ square, verbose: true });
      }
      this.render();
      return;
    }

    // Klik petak kosong atau bidak lawan di luar jangkauan -> batalkan seleksi
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.render();
  }

  _handlePromotionSelect(promoPiece) {
    if (!this.pendingPromotion) return;
    const { from, to } = this.pendingPromotion;
    this.pendingPromotion = null;
    this._executePlayerMove({ from, to, promotion: promoPiece });
  }

  _executePlayerMove(moveObj) {
    const steps = this.config.steps || [];

    // Jika dalam mode eksplorasi bebas (setelah latihan selesai)
    if (this.freePlayMode || this.isPracticeSolved || steps.length === 0) {
      const moveResult = this.chess.move(moveObj);
      if (moveResult) {
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
        this.hintSquares = [];
        this.lastMove = { from: moveResult.from, to: moveResult.to };
        this.feedback = {
          type: 'info',
          message: `Langkah dieksekusi: ${moveResult.san}. ${this._getGameStateText()}`
        };
        this.render();
      }
      return;
    }

    // Validasi langkah terhadap urutan latihan (step saat ini)
    const currentStep = steps[this.currentStepIndex];
    const moveResult = this.chess.move(moveObj);
    if (!moveResult) return;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.hintSquares = [];

    const cleanPlayedSan = moveResult.san.replace(/[+#]$/, '');
    const isExpected = currentStep.expectedMoves.some(exp => {
      const cleanExp = exp.replace(/[+#]$/, '');
      return moveResult.san === exp || cleanPlayedSan === cleanExp || moveResult.lan === exp;
    });

    if (!isExpected) {
      // Langkah legal secara aturan catur, tetapi bukan langkah yang diminta instruksi latihan
      const playedSan = moveResult.san;
      this.chess.undo();
      this.feedback = {
        type: 'warning',
        message: `Langkah ${playedSan} adalah langkah catur yang sah, namun belum sesuai dengan sasaran latihan ini. Coba lagi atau klik tombol "Petunjuk"!`
      };
      this.render();
      return;
    }

    // Langkah benar sesuai skenario latihan!
    this.lastMove = { from: moveResult.from, to: moveResult.to };
    this.feedback = {
      type: 'success',
      message: currentStep.explanation || `Langkah tepat (${moveResult.san})!`
    };

    // Cek apakah ada balasan lawan otomatis pada langkah ini
    if (currentStep.opponentReply) {
      this.isLockedForReply = true;
      this.render();

      this._replyTimeout = setTimeout(() => {
        const replyMove = this.chess.move(currentStep.opponentReply);
        if (replyMove) {
          this.lastMove = { from: replyMove.from, to: replyMove.to };
        }
        this.isLockedForReply = false;
        this.currentStepIndex++;

        if (this.currentStepIndex >= steps.length) {
          this._markPracticeComplete();
        }
        this.render();
      }, 480);
    } else {
      this.currentStepIndex++;
      if (this.currentStepIndex >= steps.length) {
        this._markPracticeComplete();
      }
      this.render();
    }
  }

  _markPracticeComplete() {
    this.isPracticeSolved = true;
    if (typeof this.callbacks.onPracticeSuccess === 'function') {
      this.callbacks.onPracticeSuccess();
    }
  }

  _getGameStateText() {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === WHITE ? 'Hitam' : 'Putih';
      return `Skakmat (Checkmate)! ${winner} menang.`;
    }
    if (this.chess.isStalemate()) {
      return 'Stalemate (Pat)! Permainan berakhir Remis.';
    }
    if (this.chess.isDraw()) {
      return 'Permainan berakhir Remis (Draw).';
    }
    if (this.chess.inCheck()) {
      const checkedSide = this.chess.turn() === WHITE ? 'Raja Putih' : 'Raja Hitam';
      return `Perhatian: ${checkedSide} sedang dalam kondisi Skak (Check)!`;
    }
    return '';
  }

  render() {
    if (!this.container) return;

    const turn = this.chess.turn();
    const turnText = turn === WHITE ? 'Giliran Putih' : 'Giliran Hitam';
    const inCheck = this.chess.inCheck();
    const isCheckmate = this.chess.isCheckmate();
    const isStalemate = this.chess.isStalemate();

    const steps = this.config.steps || [];
    const totalSteps = steps.length;
    const displayStep = Math.min(this.currentStepIndex + 1, totalSteps);

    const rowIndices = this.orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const colIndices = this.orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

    const boardState = this.chess.board();
    const legalTargetMap = new Map();
    for (const m of this.legalMovesForSelected) {
      legalTargetMap.set(m.to, m);
    }

    const highlightSet = new Set(this.config.highlightSquares || []);
    const hintSet = new Set(this.hintSquares || []);

    let squaresHtml = '';
    for (let visualRowIdx = 0; visualRowIdx < 8; visualRowIdx++) {
      const r = rowIndices[visualRowIdx];
      for (let visualColIdx = 0; visualColIdx < 8; visualColIdx++) {
        const c = colIndices[visualColIdx];
        const sq = FILES[c] + RANKS[r];
        const isLight = (r + c) % 2 === 0;
        const piece = boardState[r][c];
        const isSelected = this.selectedSquare === sq;
        const isLastMove =
          this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq);
        const isPresetHighlight = highlightSet.has(sq);
        const isHintHighlight = hintSet.has(sq);
        const legalMove = legalTargetMap.get(sq);
        const isKingInCheck =
          inCheck && piece && piece.type === 'k' && piece.color === turn;

        const classes = [
          'chess-square',
          isLight ? 'square-light' : 'square-dark',
          isSelected ? 'square-selected' : '',
          isLastMove ? 'square-last-move' : '',
          isPresetHighlight ? 'square-preset-highlight' : '',
          isHintHighlight ? 'square-hint-highlight' : '',
          isKingInCheck ? 'square-king-check' : '',
          piece ? 'has-piece' : ''
        ]
          .filter(Boolean)
          .join(' ');

        // Label koordinat di tepi papan (baris di kolom paling kiri, kolom di baris paling bawah)
        const showRankLabel = visualColIdx === 0;
        const showFileLabel = visualRowIdx === 7;

        let legalIndicatorHtml = '';
        if (legalMove) {
          if (legalMove.captured) {
            legalIndicatorHtml = `<span class="legal-capture-ring" aria-hidden="true"></span>`;
          } else {
            legalIndicatorHtml = `<span class="legal-move-dot" aria-hidden="true"></span>`;
          }
        }

        squaresHtml += `
          <button
            type="button"
            class="${classes}"
            data-square="${sq}"
            aria-label="Petak ${sq}${piece ? ` berisi ${PIECE_NAMES_ID[piece.type]} ${piece.color === WHITE ? 'Putih' : 'Hitam'}` : ''}"
          >
            ${showRankLabel ? `<span class="coord-label coord-rank">${RANKS[r]}</span>` : ''}
            ${showFileLabel ? `<span class="coord-label coord-file">${FILES[c]}</span>` : ''}
            ${piece ? `<span class="piece-wrapper">${getPieceSvg(piece.color, piece.type)}</span>` : ''}
            ${legalIndicatorHtml}
          </button>
        `;
      }
    }

    // Modal Promosi Pion jika sedang menunggu pilihan
    let promotionModalHtml = '';
    if (this.pendingPromotion) {
      const promoColor = this.chess.turn();
      promotionModalHtml = `
        <div class="promotion-overlay" role="dialog" aria-label="Pilih bidak promosi pion">
          <div class="promotion-dialog">
            <p class="promotion-title">Pilih Promosi Pion:</p>
            <div class="promotion-options">
              <button type="button" class="promo-btn" data-promo="q" title="Menteri (Queen)">
                ${getPieceSvg(promoColor, 'q')}
                <span>Menteri</span>
              </button>
              <button type="button" class="promo-btn" data-promo="r" title="Benteng (Rook)">
                ${getPieceSvg(promoColor, 'r')}
                <span>Benteng</span>
              </button>
              <button type="button" class="promo-btn" data-promo="b" title="Gajah (Bishop)">
                ${getPieceSvg(promoColor, 'b')}
                <span>Gajah</span>
              </button>
              <button type="button" class="promo-btn" data-promo="n" title="Kuda (Knight)">
                ${getPieceSvg(promoColor, 'n')}
                <span>Kuda</span>
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Status badge di atas papan
    let statusAlertBadge = '';
    if (isCheckmate) {
      statusAlertBadge = `<span class="board-state-badge badge-danger">Skakmat (Checkmate)!</span>`;
    } else if (isStalemate) {
      statusAlertBadge = `<span class="board-state-badge badge-warning">Stalemate (Remis)</span>`;
    } else if (inCheck) {
      statusAlertBadge = `<span class="board-state-badge badge-danger">Skak (Check)!</span>`;
    } else if (this.isPracticeSolved) {
      statusAlertBadge = `<span class="board-state-badge badge-success">${UI_ICONS.check} Latihan Tuntas</span>`;
    } else {
      statusAlertBadge = `<span class="board-state-badge badge-step">Tahap ${displayStep} / ${totalSteps}</span>`;
    }

    this.container.innerHTML = `
      <div class="chessboard-widget">
        <div class="chessboard-topbar">
          <div class="turn-indicator" data-turn="${turn}">
            <span class="turn-dot ${turn === WHITE ? 'dot-white' : 'dot-black'}"></span>
            <span class="turn-label">${turnText}</span>
          </div>
          <div class="board-status-badges">
            ${statusAlertBadge}
          </div>
        </div>

        <div class="chessboard-frame">
          <div class="chessboard-grid" role="grid" aria-label="Papan Catur Interaktif">
            ${squaresHtml}
          </div>
          ${promotionModalHtml}
        </div>

        <div class="chessboard-coord-statusbar">
          <span class="coord-inspector-text">${this.inspectedSquareInfo}</span>
          <span class="move-history-pill">
            Langkah: ${this.chess.history().length > 0 ? this.chess.history().join(' → ') : 'Belum ada langkah'}
          </span>
        </div>

        <div class="chessboard-feedback feedback-${this.feedback.type}" role="status">
          <div class="feedback-content">
            <strong>${
              this.feedback.type === 'success'
                ? 'Berhasil:'
                : this.feedback.type === 'warning'
                ? 'Perhatikan:'
                : this.feedback.type === 'hint'
                ? 'Petunjuk Langkah:'
                : 'Info Latihan:'
            }</strong>
            <span>${this.feedback.message}</span>
          </div>
        </div>

        <div class="chessboard-controls">
          <button type="button" class="btn btn-secondary btn-sm" data-action="restart-board">
            ${UI_ICONS.restart}
            <span>Restart Posisi</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="hint-board" ${this.isPracticeSolved ? 'disabled' : ''}>
            ${UI_ICONS.hint}
            <span>Petunjuk</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="flip-board">
            ${UI_ICONS.flip}
            <span>Balik Papan</span>
          </button>
          ${
            this.isPracticeSolved && !this.freePlayMode
              ? `<button type="button" class="btn btn-outline btn-sm" data-action="free-play">
                  <span>Mode Eksplorasi Bebas</span>
                 </button>`
              : ''
          }
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const squares = this.container.querySelectorAll('.chess-square');
    squares.forEach(sqBtn => {
      sqBtn.addEventListener('click', () => {
        const sq = sqBtn.getAttribute('data-square');
        this._handleSquareClick(sq);
      });
    });

    const promoBtns = this.container.querySelectorAll('.promo-btn');
    promoBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const promo = btn.getAttribute('data-promo');
        this._handlePromotionSelect(promo);
      });
    });

    const restartBtn = this.container.querySelector('[data-action="restart-board"]');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.restart());
    }

    const hintBtn = this.container.querySelector('[data-action="hint-board"]');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => this.showHint());
    }

    const flipBtn = this.container.querySelector('[data-action="flip-board"]');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => this.flipBoard());
    }

    const freePlayBtn = this.container.querySelector('[data-action="free-play"]');
    if (freePlayBtn) {
      freePlayBtn.addEventListener('click', () => this.enableFreePlay());
    }
  }
}

export default InteractiveChessboard;
