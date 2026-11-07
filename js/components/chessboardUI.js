/**
 * Komponen Papan Catur Interaktif (Interactive Chessboard UI)
 * Terintegrasi penuh dengan Chess.js untuk validasi langkah legal,
 * panduan latihan bertahap (multi-step guided practice), promosi pion,
 * indikator langkah legal, serta tombol Restart, Petunjuk, dan Balik Papan.
 */

import { Chess, WHITE, BLACK, PAWN, QUEEN, ROOK, BISHOP, KNIGHT } from '../vendor/chess.js';
import { getPieceSvg, UI_ICONS } from './icons.js';
import { getPuzzleCategoryById, getPuzzleDifficultyById } from '../data/puzzles.js';

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

export function parseUciMove(uci) {
  if (typeof uci !== 'string' || uci.trim().length < 4) return null;
  const clean = uci.trim();
  const from = clean.slice(0, 2);
  const to = clean.slice(2, 4);
  const promotion = clean.length > 4 ? clean.slice(4, 5).toLowerCase() : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

/**
 * Merender pratinjau papan catur 8x8 statis (misalnya untuk kartu Puzzle Harian di Dashboard Puzzle)
 */
export function renderStaticChessboardPreview(
  fen,
  { orientation = 'white', lastMove = null } = {}
) {
  let chess;
  try {
    chess = new Chess(fen);
  } catch {
    chess = new Chess();
  }

  const boardState = chess.board();
  const rowIndices = orientation === 'black' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
  const colIndices = orientation === 'black' ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

  let squaresHtml = '';
  for (let visualRowIdx = 0; visualRowIdx < 8; visualRowIdx++) {
    const r = rowIndices[visualRowIdx];
    for (let visualColIdx = 0; visualColIdx < 8; visualColIdx++) {
      const c = colIndices[visualColIdx];
      const sq = FILES[c] + RANKS[r];
      const isLight = (r + c) % 2 === 0;
      const piece = boardState[r][c];
      const isLastMove =
        lastMove && (lastMove.from === sq || lastMove.to === sq);
      const showRankLabel = visualColIdx === 0;
      const showFileLabel = visualRowIdx === 7;

      const classes = [
        'chess-square',
        'static-preview-square',
        isLight ? 'square-light' : 'square-dark',
        isLastMove ? 'square-last-move' : '',
        piece ? 'has-piece' : ''
      ]
        .filter(Boolean)
        .join(' ');

      squaresHtml += `
        <div class="${classes}" data-square="${sq}">
          ${showRankLabel ? `<span class="coord-label coord-rank">${RANKS[r]}</span>` : ''}
          ${showFileLabel ? `<span class="coord-label coord-file">${FILES[c]}</span>` : ''}
          ${piece ? `<span class="piece-wrapper">${getPieceSvg(piece.color, piece.type)}</span>` : ''}
        </div>
      `;
    }
  }

  return `
    <div class="chessboard-frame chessboard-preview-frame" aria-label="Pratinjau Posisi Puzzle">
      <div class="chessboard-grid">
        ${squaresHtml}
      </div>
    </div>
  `;
}

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

        const isDraggable = Boolean(
          piece && piece.color === turn && !this.isLockedForReply && !this.pendingPromotion
        );

        squaresHtml += `
          <button
            type="button"
            class="${classes}"
            data-square="${sq}"
            draggable="${isDraggable ? 'true' : 'false'}"
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

      sqBtn.addEventListener('dragstart', e => {
        const sq = sqBtn.getAttribute('data-square');
        const p = this.chess.get(sq);
        if (!p || p.color !== this.chess.turn() || this.isLockedForReply || this.pendingPromotion) {
          e.preventDefault();
          return;
        }
        this._dragSourceSquare = sq;
        this.selectedSquare = sq;
        this.legalMovesForSelected = this.chess.moves({ square: sq, verbose: true });
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', sq);
          e.dataTransfer.effectAllowed = 'move';
        }
      });

      sqBtn.addEventListener('dragover', e => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      });

      sqBtn.addEventListener('drop', e => {
        e.preventDefault();
        const targetSq = sqBtn.getAttribute('data-square');
        const sourceSq =
          this._dragSourceSquare ||
          (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
        this._dragSourceSquare = null;

        if (!sourceSq || !targetSq || sourceSq === targetSq) return;
        this.selectedSquare = sourceSq;
        this.legalMovesForSelected = this.chess.moves({ square: sourceSq, verbose: true });
        this._handleSquareClick(targetSq);
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

/**
 * Komponen Papan Catur Puzzle Interaktif (MVP 2 — Bagian 4 & Bagian 5)
 * Mengintegrasikan mekanisme InteractiveChessboard & Chess.js untuk validasi puzzle Lichess:
 * 1. Memuat FEN awal (sebelum langkah lawan) ke Chess.js.
 * 2. Menerapkan langkah UCI pertama secara otomatis sebagai langkah lawan yang menghasilkan posisi puzzle.
 * 3. Memvalidasi langkah pemain terhadap solusi UCI (serta mendukung multi-solusi checkmate pada Mat dalam 1).
 * 4. Menjalankan balasan lawan secara otomatis untuk puzzle multi-langkah.
 * 5. Mendukung promosi pion, sistem Hint 2 tahap, Restart Puzzle, dan Balik Papan.
 */
export class PuzzleChessboard {
  /**
   * @param {HTMLElement} container - Elemen DOM tempat papan catur puzzle dirender
   * @param {Object} puzzle - Data puzzle dari js/data/puzzles.js
   * @param {Object} callbacks - Callback { onHintUsed, onWrongMove, onPuzzleSolved, replyDelayMs }
   */
  constructor(container, puzzle, callbacks = {}) {
    this.container = container;
    this.puzzle = puzzle;
    this.callbacks = callbacks;
    this.replyDelayMs =
      typeof callbacks.replyDelayMs === 'number' && callbacks.replyDelayMs >= 0
        ? callbacks.replyDelayMs
        : 380;

    this.chess = new Chess();
    this.orientation = 'white';
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.lastMove = null;
    this.hintSquares = [];
    this.solutionMoves = [];
    this.solutionPlyIndex = 0;
    this.playedSolutionSan = [];
    this.setupMoveInfo = null;

    this.hintStage = 0; // 0 = belum pakai hint, 1 = hint umum tema, 2 = highlight petak asal
    this.maxHintLevelUsed = 0;
    this.wrongMovesCount = 0;
    this.isPuzzleSolved = false;
    this.isLockedForReply = false;
    this.pendingPromotion = null;
    this._dragSourceSquare = null;
    this._replyTimeout = null;
    this.currentAttemptId = this._createAttemptId();

    this._initPuzzlePosition();
    this.render();
  }

  _createAttemptId() {
    const pid = this.puzzle ? this.puzzle.id : 'puz';
    return `att_${pid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Menginisialisasi posisi awal puzzle sesuai Bagian 2:
   * 1. Muat FEN awal ke Chess.js.
   * 2. Terapkan langkah UCI pertama secara otomatis.
   * 3. Posisi setelah langkah tersebut adalah posisi yang ditampilkan kepada pengguna.
   * 4. Simpan langkah UCI kedua dan seterusnya sebagai solusi.
   * 5. Pastikan giliran pemain sesuai dengan posisi aktual.
   */
  _initPuzzlePosition() {
    if (!this.puzzle) return;

    this.chess.load(this.puzzle.initialFen);

    const allMoves = Array.isArray(this.puzzle.moves) ? this.puzzle.moves : [];
    const firstUci = allMoves[0] || this.puzzle.setupMove;
    const setupMoveObj = parseUciMove(firstUci);

    let setupResult = null;
    if (setupMoveObj) {
      setupResult = this.chess.move(setupMoveObj);
    }

    this.setupMoveInfo = setupResult
      ? {
          from: setupResult.from,
          to: setupResult.to,
          san: setupResult.san,
          color: setupResult.color
        }
      : null;

    this.lastMove = this.setupMoveInfo
      ? { from: this.setupMoveInfo.from, to: this.setupMoveInfo.to }
      : null;

    this.solutionMoves =
      allMoves.length > 1
        ? allMoves.slice(1)
        : Array.isArray(this.puzzle.solutionMoves)
        ? [...this.puzzle.solutionMoves]
        : [];

    const activeTurn = this.chess.turn();
    this.orientation = activeTurn === WHITE ? 'white' : 'black';

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.hintSquares = [];
    this.solutionPlyIndex = 0;
    this.playedSolutionSan = [];
    this.hintStage = 0;
    this.isPuzzleSolved = false;
    this.isLockedForReply = false;
    this.pendingPromotion = null;

    const sideName = activeTurn === WHITE ? 'Putih' : 'Hitam';
    const setupText = this.setupMoveInfo
      ? `Lawan baru saja melangkah ${this.setupMoveInfo.san}. `
      : '';

    this.inspectedSquareInfo = `${setupText}Anda memegang bidak ${sideName}.`;
    this.feedback = {
      type: 'info',
      message: `${setupText}Temukan langkah terbaik untuk ${sideName}! Klik atau seret bidak pada papan.`
    };
  }

  destroy() {
    if (this._replyTimeout) {
      clearTimeout(this._replyTimeout);
      this._replyTimeout = null;
    }
  }

  restart() {
    if (this._replyTimeout) {
      clearTimeout(this._replyTimeout);
      this._replyTimeout = null;
    }
    this.currentAttemptId = this._createAttemptId();
    this.maxHintLevelUsed = 0;
    this.wrongMovesCount = 0;
    this._initPuzzlePosition();
    this.feedback = {
      type: 'info',
      message: 'Posisi puzzle direset ke awal. Silakan temukan langkah terbaik!'
    };
    this.render();
  }

  flipBoard() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    this.render();
  }

  /**
   * Sistem Hint 2 Tahap (Bagian 5):
   * - Hint 1: Petunjuk umum berdasarkan tema.
   * - Hint 2: Highlight petak asal bidak yang perlu diperhatikan.
   * - Tidak menampilkan seluruh rangkaian solusi sebelum puzzle diselesaikan.
   */
  showHint() {
    if (this.isPuzzleSolved || this.solutionPlyIndex >= this.solutionMoves.length) {
      this.feedback = {
        type: 'info',
        message: 'Puzzle ini telah selesai! Anda dapat beralih ke Puzzle Berikutnya.'
      };
      this.render();
      return;
    }

    const expectedUci = this.solutionMoves[this.solutionPlyIndex];
    const moveObj = parseUciMove(expectedUci);
    const catInfo = getPuzzleCategoryById(this.puzzle.primaryTheme);
    const generalThemeHint = catInfo
      ? catInfo.generalHint
      : 'Perhatikan bidak lawan yang tidak terlindungi atau petak skak yang terbuka.';

    if (this.hintStage === 0) {
      this.hintStage = 1;
      this.maxHintLevelUsed = Math.max(this.maxHintLevelUsed, 1);

      this.feedback = {
        type: 'hint',
        message: `Petunjuk 1 (Tema): ${generalThemeHint} (Klik "Petunjuk" sekali lagi untuk menyorot petak bidak yang harus digerakkan).`
      };

      if (typeof this.callbacks.onHintUsed === 'function') {
        this.callbacks.onHintUsed({
          attemptId: this.currentAttemptId,
          puzzleId: this.puzzle.id,
          hintLevel: 1
        });
      }
      this.render();
      return;
    }

    // Tahap 2: Highlight petak asal bidak saja (tidak membocorkan petak tujuan/seluruh solusi)
    this.hintStage = 2;
    this.maxHintLevelUsed = Math.max(this.maxHintLevelUsed, 2);

    if (moveObj && moveObj.from) {
      const originSq = moveObj.from;
      const pieceOnOrigin = this.chess.get(originSq);
      const pieceName =
        pieceOnOrigin && PIECE_NAMES_ID[pieceOnOrigin.type]
          ? PIECE_NAMES_ID[pieceOnOrigin.type]
          : 'Bidak';

      this.hintSquares = [originSq];
      this.selectedSquare = originSq;
      this.legalMovesForSelected = this.chess.moves({ square: originSq, verbose: true });

      this.feedback = {
        type: 'hint',
        message: `Petunjuk 2 (Petak Asal): Perhatikan ${pieceName} Anda di petak ${originSq}. Pilih petak tujuan terbaik untuk mengeksekusi taktik!`
      };
    } else {
      this.feedback = {
        type: 'hint',
        message: `Petunjuk: ${generalThemeHint}`
      };
    }

    if (typeof this.callbacks.onHintUsed === 'function') {
      this.callbacks.onHintUsed({
        attemptId: this.currentAttemptId,
        puzzleId: this.puzzle.id,
        hintLevel: 2
      });
    }
    this.render();
  }

  _handleSquareClick(square) {
    if (this.isLockedForReply || this.pendingPromotion || this.isPuzzleSolved) return;

    const clickedPiece = this.chess.get(square);
    if (clickedPiece) {
      const colorName = clickedPiece.color === WHITE ? 'Putih' : 'Hitam';
      const pieceName = PIECE_NAMES_ID[clickedPiece.type] || clickedPiece.type;
      this.inspectedSquareInfo = `Petak ${square}: ${pieceName} ${colorName}`;
    } else {
      this.inspectedSquareInfo = `Petak ${square}: Kosong`;
    }

    // Jika sudah ada bidak yang dipilih dan mengklik petak tujuan legal
    if (this.selectedSquare) {
      const candidateMoves = this.legalMovesForSelected.filter(m => m.to === square);
      if (candidateMoves.length > 0) {
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

  /**
   * Mengeksekusi langkah pemain secara terprogram (berguna untuk pengujian otomatis & interaksi UI)
   */
  playMove(moveInput) {
    if (this.isLockedForReply || this.isPuzzleSolved) return false;
    const moveObj = typeof moveInput === 'string' ? parseUciMove(moveInput) : moveInput;
    if (!moveObj) return false;
    return this._executePlayerMove(moveObj);
  }

  _executePlayerMove(moveObj) {
    if (this.isPuzzleSolved || this.solutionPlyIndex >= this.solutionMoves.length) {
      return false;
    }

    let moveResult = null;
    try {
      moveResult = this.chess.move(moveObj);
    } catch {
      moveResult = null;
    }

    if (!moveResult) return false;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];

    const playedUci = `${moveResult.from}${moveResult.to}${
      moveResult.promotion ? moveResult.promotion.toLowerCase() : ''
    }`;
    const expectedUci = this.solutionMoves[this.solutionPlyIndex];

    // Untuk puzzle Mat dalam 1, terima semua langkah legal yang menghasilkan checkmate (Bagian 4)
    const isMateIn1 =
      this.puzzle.primaryTheme === 'mateIn1' ||
      (Array.isArray(this.puzzle.themes) && this.puzzle.themes.includes('mateIn1'));
    const isCorrect =
      playedUci === expectedUci ||
      (isMateIn1 && this.solutionMoves.length === 1 && this.chess.isCheckmate());

    if (!isCorrect) {
      // Langkah salah -> kembalikan papan ke posisi sebelum langkah salah & beri kesempatan mencoba lagi
      const attemptedSan = moveResult.san;
      this.chess.undo();
      this.wrongMovesCount++;

      this.feedback = {
        type: 'warning',
        message: `Langkah ${attemptedSan} sah secara aturan catur, tetapi belum merupakan solusi terbaik. Posisi telah dikembalikan—silakan coba lagi atau gunakan tombol "Petunjuk"!`
      };

      const failedAttemptId = this.currentAttemptId;
      // Buat ID percobaan baru untuk kesempatan berikutnya agar setiap percobaan salah tercatat unik
      this.currentAttemptId = this._createAttemptId();

      if (typeof this.callbacks.onWrongMove === 'function') {
        this.callbacks.onWrongMove({
          attemptId: failedAttemptId,
          puzzleId: this.puzzle.id,
          playedUci,
          playedSan: attemptedSan,
          hintsUsed: this.maxHintLevelUsed,
          wrongMoves: this.wrongMovesCount
        });
      }

      this.render();
      return false;
    }

    // Langkah benar!
    this.hintSquares = [];
    this.hintStage = 0;
    this.lastMove = { from: moveResult.from, to: moveResult.to };
    this.playedSolutionSan.push(moveResult.san);
    this.solutionPlyIndex++;

    // Cek apakah masih ada balasan otomatis lawan pada rangkaian solusi
    if (this.solutionPlyIndex < this.solutionMoves.length) {
      const replyUci = this.solutionMoves[this.solutionPlyIndex];
      this.feedback = {
        type: 'success',
        message: `Langkah tepat (${moveResult.san})! Lawan sedang merespons...`
      };

      if (this.replyDelayMs === 0) {
        this._applyOpponentReply(replyUci);
      } else {
        this.isLockedForReply = true;
        this.render();
        this._replyTimeout = setTimeout(() => {
          this._replyTimeout = null;
          this._applyOpponentReply(replyUci);
        }, this.replyDelayMs);
      }
      return true;
    }

    // Seluruh rangkaian solusi telah selesai!
    this._markPuzzleComplete(moveResult.san);
    this.render();
    return true;
  }

  _applyOpponentReply(replyUci) {
    const replyMoveObj = parseUciMove(replyUci);
    let replyResult = null;
    if (replyMoveObj) {
      try {
        replyResult = this.chess.move(replyMoveObj);
      } catch {
        replyResult = null;
      }
    }

    if (replyResult) {
      this.lastMove = { from: replyResult.from, to: replyResult.to };
      this.playedSolutionSan.push(replyResult.san);
    }

    this.isLockedForReply = false;
    this.solutionPlyIndex++;

    if (this.solutionPlyIndex >= this.solutionMoves.length) {
      this._markPuzzleComplete(replyResult ? replyResult.san : '');
    } else {
      const totalPlayerSteps = Math.ceil(this.solutionMoves.length / 2);
      const currentPlayerStep = Math.floor(this.solutionPlyIndex / 2) + 1;
      this.feedback = {
        type: 'info',
        message: `Lawan membalas ${
          replyResult ? replyResult.san : replyUci
        }. Lanjutkan dengan Langkah ${currentPlayerStep} dari ${totalPlayerSteps}!`
      };
    }

    this.render();
  }

  _markPuzzleComplete(lastPlayedSan) {
    this.isPuzzleSolved = true;
    const solutionDisplay =
      this.playedSolutionSan.length > 0
        ? this.playedSolutionSan.join(' → ')
        : (this.puzzle.solutionSan || []).join(' → ');

    this.feedback = {
      type: 'success',
      message: `Benar! Puzzle Selesai (${lastPlayedSan}). Rangkaian solusi: ${solutionDisplay}.`
    };

    if (typeof this.callbacks.onPuzzleSolved === 'function') {
      this.callbacks.onPuzzleSolved({
        attemptId: this.currentAttemptId,
        puzzleId: this.puzzle.id,
        hintsUsed: this.maxHintLevelUsed,
        wrongMoves: this.wrongMovesCount,
        solutionSan:
          this.playedSolutionSan.length > 0
            ? [...this.playedSolutionSan]
            : [...(this.puzzle.solutionSan || [])],
        solutionMoves: [...this.solutionMoves]
      });
    }
  }

  render() {
    if (!this.container) return;

    const turn = this.chess.turn();
    const turnText = turn === WHITE ? 'Giliran Putih' : 'Giliran Hitam';
    const inCheck = this.chess.inCheck();
    const isCheckmate = this.chess.isCheckmate();
    const isStalemate = this.chess.isStalemate();

    const totalPlayerSteps = Math.max(1, Math.ceil(this.solutionMoves.length / 2));
    const currentPlayerStep = Math.min(
      totalPlayerSteps,
      Math.floor(this.solutionPlyIndex / 2) + 1
    );

    const rowIndices =
      this.orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const colIndices =
      this.orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

    const boardState = this.chess.board();
    const legalTargetMap = new Map();
    for (const m of this.legalMovesForSelected) {
      legalTargetMap.set(m.to, m);
    }

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
        const isHintHighlight = hintSet.has(sq);
        const legalMove = legalTargetMap.get(sq);
        const isKingInCheck =
          inCheck && piece && piece.type === 'k' && piece.color === turn;

        const classes = [
          'chess-square',
          isLight ? 'square-light' : 'square-dark',
          isSelected ? 'square-selected' : '',
          isLastMove ? 'square-last-move' : '',
          isHintHighlight ? 'square-hint-highlight' : '',
          isKingInCheck ? 'square-king-check' : '',
          piece ? 'has-piece' : ''
        ]
          .filter(Boolean)
          .join(' ');

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

        const isDraggable = Boolean(
          piece &&
            piece.color === turn &&
            !this.isLockedForReply &&
            !this.pendingPromotion &&
            !this.isPuzzleSolved
        );

        squaresHtml += `
          <button
            type="button"
            class="${classes}"
            data-square="${sq}"
            draggable="${isDraggable ? 'true' : 'false'}"
            aria-label="Petak ${sq}${
          piece
            ? ` berisi ${PIECE_NAMES_ID[piece.type]} ${
                piece.color === WHITE ? 'Putih' : 'Hitam'
              }`
            : ''
        }"
          >
            ${showRankLabel ? `<span class="coord-label coord-rank">${RANKS[r]}</span>` : ''}
            ${showFileLabel ? `<span class="coord-label coord-file">${FILES[c]}</span>` : ''}
            ${
              piece
                ? `<span class="piece-wrapper">${getPieceSvg(piece.color, piece.type)}</span>`
                : ''
            }
            ${legalIndicatorHtml}
          </button>
        `;
      }
    }

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

    let statusAlertBadge = '';
    if (this.isPuzzleSolved) {
      statusAlertBadge = `<span class="board-state-badge badge-success" data-testid="puzzle-solved-badge">${UI_ICONS.check} Puzzle Selesai</span>`;
    } else if (isCheckmate) {
      statusAlertBadge = `<span class="board-state-badge badge-danger">Skakmat (Checkmate)!</span>`;
    } else if (isStalemate) {
      statusAlertBadge = `<span class="board-state-badge badge-warning">Stalemate (Remis)</span>`;
    } else if (inCheck) {
      statusAlertBadge = `<span class="board-state-badge badge-danger">Skak (Check)!</span>`;
    } else {
      statusAlertBadge = `<span class="board-state-badge badge-step">Langkah ${currentPlayerStep} / ${totalPlayerSteps}</span>`;
    }

    const hintBtnLabel =
      this.hintStage === 1 ? 'Petunjuk (Sorot Petak)' : 'Petunjuk';

    this.container.innerHTML = `
      <div class="chessboard-widget puzzle-chessboard-widget">
        <div class="chessboard-topbar">
          <div class="turn-indicator" data-turn="${turn}" data-testid="puzzle-turn-indicator">
            <span class="turn-dot ${turn === WHITE ? 'dot-white' : 'dot-black'}"></span>
            <span class="turn-label">${turnText}</span>
          </div>
          <div class="board-status-badges">
            ${statusAlertBadge}
          </div>
        </div>

        <div class="chessboard-frame">
          <div class="chessboard-grid" role="grid" aria-label="Papan Catur Puzzle Interaktif">
            ${squaresHtml}
          </div>
          ${promotionModalHtml}
        </div>

        <div class="chessboard-coord-statusbar">
          <span class="coord-inspector-text">${this.inspectedSquareInfo}</span>
          <span class="move-history-pill" data-testid="puzzle-move-history">
            Langkah Solusi: ${
              this.playedSolutionSan.length > 0
                ? this.playedSolutionSan.join(' → ')
                : 'Belum ada langkah'
            }
          </span>
        </div>

        <div class="chessboard-feedback feedback-${this.feedback.type}" role="status" data-testid="puzzle-board-feedback">
          <div class="feedback-content">
            <strong>${
              this.feedback.type === 'success'
                ? 'Benar:'
                : this.feedback.type === 'warning'
                ? 'Belum Tepat:'
                : this.feedback.type === 'hint'
                ? 'Petunjuk Taktik:'
                : 'Instruksi Puzzle:'
            }</strong>
            <span>${this.feedback.message}</span>
          </div>
        </div>

        <div class="chessboard-controls">
          <button type="button" class="btn btn-secondary btn-sm" data-action="restart-board" data-testid="puzzle-restart-btn">
            ${UI_ICONS.restart}
            <span>Restart Puzzle</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="hint-board" data-testid="puzzle-hint-btn" ${
            this.isPuzzleSolved ? 'disabled' : ''
          }>
            ${UI_ICONS.hint}
            <span>${hintBtnLabel}</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" data-action="flip-board" data-testid="puzzle-flip-btn">
            ${UI_ICONS.flip}
            <span>Balik Papan</span>
          </button>
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

      sqBtn.addEventListener('dragstart', e => {
        const sq = sqBtn.getAttribute('data-square');
        const p = this.chess.get(sq);
        if (
          !p ||
          p.color !== this.chess.turn() ||
          this.isLockedForReply ||
          this.pendingPromotion ||
          this.isPuzzleSolved
        ) {
          e.preventDefault();
          return;
        }
        this._dragSourceSquare = sq;
        this.selectedSquare = sq;
        this.legalMovesForSelected = this.chess.moves({ square: sq, verbose: true });
        if (e.dataTransfer) {
          e.dataTransfer.setData('text/plain', sq);
          e.dataTransfer.effectAllowed = 'move';
        }
      });

      sqBtn.addEventListener('dragover', e => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
      });

      sqBtn.addEventListener('drop', e => {
        e.preventDefault();
        const targetSq = sqBtn.getAttribute('data-square');
        const sourceSq =
          this._dragSourceSquare ||
          (e.dataTransfer ? e.dataTransfer.getData('text/plain') : null);
        this._dragSourceSquare = null;

        if (!sourceSq || !targetSq || sourceSq === targetSq) return;
        this.selectedSquare = sourceSq;
        this.legalMovesForSelected = this.chess.moves({ square: sourceSq, verbose: true });
        this._handleSquareClick(targetSq);
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
  }
}

export default InteractiveChessboard;
