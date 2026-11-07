/**
 * Komponen Papan Catur Interaktif (Interactive Chessboard UI)
 * Terintegrasi penuh dengan Chess.js untuk validasi langkah legal,
 * panduan latihan bertahap (multi-step guided practice), promosi pion,
 * indikator langkah legal, serta tombol Restart, Petunjuk, dan Balik Papan.
 */

import {
  Chess,
  DEFAULT_POSITION,
  WHITE,
  BLACK,
  PAWN,
  QUEEN,
  ROOK,
  BISHOP,
  KNIGHT
} from '../vendor/chess.js';
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

const PIECE_SORT_ORDER = { q: 1, r: 2, b: 3, n: 4, p: 5 };
const PIECE_MATERIAL_VALUES = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/**
 * Menghitung bidak yang telah ditangkap oleh Putih maupun Hitam dari riwayat langkah verbose Chess.js
 */
export function calculateCapturedPieces(verboseHistory = []) {
  const capturedByWhite = []; // Bidak hitam ('b') yang ditangkap oleh Putih
  const capturedByBlack = []; // Bidak putih ('w') yang ditangkap oleh Hitam

  if (Array.isArray(verboseHistory)) {
    for (const move of verboseHistory) {
      if (!move || !move.captured) continue;
      const capType = String(move.captured).toLowerCase();
      if (move.color === WHITE) {
        capturedByWhite.push(capType);
      } else if (move.color === BLACK) {
        capturedByBlack.push(capType);
      }
    }
  }

  const sortPieces = arr =>
    [...arr].sort((a, b) => (PIECE_SORT_ORDER[a] || 99) - (PIECE_SORT_ORDER[b] || 99));

  const sortedByWhite = sortPieces(capturedByWhite);
  const sortedByBlack = sortPieces(capturedByBlack);

  const whiteCapturedScore = sortedByWhite.reduce(
    (sum, t) => sum + (PIECE_MATERIAL_VALUES[t] || 0),
    0
  );
  const blackCapturedScore = sortedByBlack.reduce(
    (sum, t) => sum + (PIECE_MATERIAL_VALUES[t] || 0),
    0
  );

  return {
    capturedByWhite: sortedByWhite,
    capturedByBlack: sortedByBlack,
    whiteAdvantage: Math.max(0, whiteCapturedScore - blackCapturedScore),
    blackAdvantage: Math.max(0, blackCapturedScore - whiteCapturedScore)
  };
}

/**
 * Menyusun daftar langkah verbose Chess.js menjadi pasangan langkah bernomor (Putih & Hitam)
 */
export function buildMovePairs(verboseHistory = []) {
  const pairs = [];
  if (!Array.isArray(verboseHistory) || verboseHistory.length === 0) {
    return pairs;
  }

  let currentPair = null;
  for (let i = 0; i < verboseHistory.length; i++) {
    const move = verboseHistory[i];
    if (!move) continue;

    if (move.color === WHITE) {
      currentPair = {
        moveNumber: pairs.length + 1,
        white: {
          san: move.san,
          from: move.from,
          to: move.to,
          lan: move.lan,
          ply: i + 1
        },
        black: null
      };
      pairs.push(currentPair);
    } else {
      if (!currentPair || currentPair.black !== null) {
        currentPair = {
          moveNumber: pairs.length + 1,
          white: null,
          black: null
        };
        pairs.push(currentPair);
      }
      currentPair.black = {
        san: move.san,
        from: move.from,
        to: move.to,
        lan: move.lan,
        ply: i + 1
      };
    }
  }

  return pairs;
}

/**
 * Komponen Papan Catur Bermain Melawan Komputer (MVP 3 — Bagian 6, 7, 8)
 * Menggunakan Chess.js sebagai satu-satunya sumber kebenaran aturan catur
 * dan StockfishEngineService (Web Worker UCI) sebagai lawan komputer.
 */
export class ComputerChessboard {
  /**
   * @param {HTMLElement} container - Elemen DOM tempat papan catur dirender
   * @param {Object} options - Konfigurasi permainan { engine, colorPreference, difficulty, initialFen, onStateChange, onGameEnd }
   */
  constructor(container, options = {}) {
    this.container = container;
    this.engine = options.engine || null;
    this.callbacks = {
      onStateChange: options.onStateChange || null,
      onGameEnd: options.onGameEnd || null
    };

    this.colorPreference = options.colorPreference || 'white'; // 'white' | 'black' | 'random'
    this.difficultyId = options.difficulty || 'beginner';
    this.initialFen = options.initialFen || undefined;

    this.chess = new Chess(this.initialFen);
    this.playerColor = 'white'; // 'white' | 'black'
    this.playerTurnChar = WHITE;
    this.computerColor = 'black';
    this.computerTurnChar = BLACK;
    this.orientation = 'white';

    this.gameId = null;
    this.startedAt = null;
    this.finishedAt = null;

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.intendedMove = null;
    this.lastMove = null;
    this.pendingPromotion = null;
    this._dragSourceSquare = null;

    this.isEngineThinking = false;
    this.isGameOver = false;
    this.gameResult = null;
    this.engineError = null;
    this._hasRecordedEnd = false;
    this._pendingPlayerClaimableDraw = null;
    this._destroyed = false;

    this.inspectedSquareInfo = 'Klik atau seret bidak Anda untuk melangkah.';
    this.feedback = {
      type: 'info',
      message: 'Menyiapkan permainan baru melawan komputer...'
    };
  }

  _resolvePlayerColor(pref) {
    if (pref === 'black' || pref === 'b') return 'black';
    if (pref === 'random') {
      return Math.random() < 0.5 ? 'white' : 'black';
    }
    return 'white';
  }

  _createGameId() {
    return `game_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Memulai permainan baru (Bagian 8 — New Game & Lifecycle):
   * 1. Menghentikan pencarian Stockfish yang sedang berjalan
   * 2. Membatalkan respons engine lama dengan gameId baru
   * 3. Mereset Chess.js ke posisi awal
   * 4. Mereset riwayat langkah & bidak tertangkap
   * 5. Menjalankan langkah pertama komputer secara otomatis apabila pemain memilih Hitam
   */
  async startNewGame({
    colorPreference = this.colorPreference,
    difficulty = this.difficultyId,
    initialFen = undefined
  } = {}) {
    if (this._destroyed) return null;

    this.colorPreference = colorPreference || 'white';
    this.difficultyId = difficulty || 'beginner';
    if (initialFen !== undefined) {
      this.initialFen = initialFen;
    }

    const resolvedColor = this._resolvePlayerColor(this.colorPreference);
    this.playerColor = resolvedColor;
    this.playerTurnChar = resolvedColor === 'black' ? BLACK : WHITE;
    this.computerColor = resolvedColor === 'white' ? 'black' : 'white';
    this.computerTurnChar = this.playerTurnChar === WHITE ? BLACK : WHITE;
    this.orientation = resolvedColor;

    const newGameId = this._createGameId();
    this.gameId = newGameId;
    this.startedAt = new Date().toISOString();
    this.finishedAt = null;

    if (this.initialFen) {
      this.chess.load(this.initialFen);
    } else {
      this.chess.reset();
    }

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.intendedMove = null;
    this.lastMove = null;
    this.pendingPromotion = null;
    this.isGameOver = false;
    this.gameResult = null;
    this.engineError = null;
    this._hasRecordedEnd = false;
    this._pendingPlayerClaimableDraw = null;
    this.isEngineThinking = true;

    const playerSideName = this.playerColor === 'white' ? 'Putih' : 'Hitam';
    this.inspectedSquareInfo = `Anda bermain sebagai ${playerSideName}.`;
    this.feedback = {
      type: 'info',
      message: 'Menyiapkan engine Stockfish untuk permainan baru...'
    };

    this.render();
    this._emitStateChange();

    if (this.engine) {
      try {
        const startRes = await this.engine.startNewGame({
          gameId: newGameId,
          difficulty: this.difficultyId
        });
        if (this._destroyed || this.gameId !== newGameId || startRes?.cancelled) {
          return null;
        }
      } catch (err) {
        if (this._destroyed || this.gameId !== newGameId) return null;
        this.isEngineThinking = false;
        this.engineError =
          err?.message || 'Gagal menginisialisasi engine Stockfish.';
        this.feedback = {
          type: 'warning',
          message: `Perhatian: ${this.engineError}`
        };
        this.render();
        this._emitStateChange();
        return null;
      }
    }

    if (this._destroyed || this.gameId !== newGameId) return null;

    this.isEngineThinking = false;

    // Cek apakah posisi awal sudah game over (mis. pada skenario pengujian posisi khusus)
    if (this._checkAndHandleGameEnd()) {
      this.render();
      this._emitStateChange();
      return this.getGameStateSnapshot();
    }

    // Jika giliran saat ini adalah komputer (mis. pemain memilih Hitam pada posisi awal standar),
    // komputer melakukan langkah pertama secara otomatis
    if (this.chess.turn() === this.computerTurnChar) {
      this.feedback = {
        type: 'info',
        message: 'Anda bermain sebagai Hitam. Komputer (Putih) sedang memikirkan langkah pertama...'
      };
      this.render();
      this._emitStateChange();
      await this._triggerComputerTurn(newGameId);
    } else {
      this.feedback = {
        type: 'info',
        message: `Permainan dimulai! Anda memegang bidak ${playerSideName}. Silakan lakukan langkah Anda.`
      };
      this.render();
      this._emitStateChange();
    }

    return this.getGameStateSnapshot();
  }

  flipBoard() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    this.render();
    this._emitStateChange();
  }

  /**
   * Pemain menyerah (Resign) — mengakhiri permainan sebagai kekalahan pemain
   */
  async resign() {
    if (this.isGameOver || this._destroyed) return null;

    const activeGameId = this.gameId;
    this.pendingPromotion = null;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.isEngineThinking = false;

    if (this.engine) {
      try {
        await this.engine.stopSearch('player_resigned');
        this.engine.setGameInProgress(false);
      } catch {
        // Abaikan
      }
    }

    if (this._destroyed || this.gameId !== activeGameId || this.isGameOver) {
      return this.gameResult;
    }

    this._finalizeGame({
      result: 'loss',
      termination: 'resign',
      winnerColor: this.computerColor,
      title: 'Anda Menyerah — Komputer Menang',
      description: 'Anda memilih menyerah pada pertandingan ini. Kemenangan diberikan kepada komputer.'
    });

    this.render();
    this._emitStateChange();
    return this.gameResult;
  }

  /**
   * Mengeksekusi langkah pemain secara terprogram maupun dari interaksi papan UI.
   * Seluruh langkah wajib divalidasi melalui Chess.js.
   */
  async playPlayerMove(moveInput) {
    if (this._destroyed || this.isGameOver || this.isEngineThinking) {
      return { ok: false, reason: 'not_ready_or_game_over' };
    }

    if (this.chess.turn() !== this.playerTurnChar) {
      return { ok: false, reason: 'not_player_turn' };
    }

    const moveObj = typeof moveInput === 'string' ? parseUciMove(moveInput) || moveInput : moveInput;
    if (!moveObj) {
      return { ok: false, reason: 'invalid_move_format' };
    }

    // Jika berupa objek { from, to } tanpa promotion, cek apakah langkah tersebut adalah promosi pion
    if (typeof moveObj === 'object' && moveObj.from && moveObj.to && !moveObj.promotion) {
      const legalFromSquare = this.chess.moves({ square: moveObj.from, verbose: true });
      const matchingTargets = legalFromSquare.filter(m => m.to === moveObj.to);
      if (matchingTargets.length > 0 && matchingTargets.some(m => Boolean(m.promotion))) {
        this.pendingPromotion = { from: moveObj.from, to: moveObj.to };
        this.selectedSquare = moveObj.from;
        this.legalMovesForSelected = legalFromSquare;
        this.render();
        this._emitStateChange();
        return { ok: false, pendingPromotion: true };
      }
    }

    let moveResult = null;
    try {
      moveResult = this.chess.move(moveObj);
    } catch {
      moveResult = null;
    }

    if (!moveResult) {
      return { ok: false, reason: 'illegal_move' };
    }

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.intendedMove = null;
    this.pendingPromotion = null;
    this.engineError = null;
    this.lastMove = {
      from: moveResult.from,
      to: moveResult.to,
      san: moveResult.san,
      color: moveResult.color
    };

    this.inspectedSquareInfo = `Langkah Anda: ${moveResult.san} (${moveResult.from} → ${moveResult.to})`;

    // Periksa apakah langkah pemain mengakhiri permainan secara otomatis
    // (Skakmat, Stalemate, Pengulangan Lima Kali, Aturan 75 Langkah, Materi Tidak Cukup)
    if (this._checkAndHandleGameEnd()) {
      this._pendingPlayerClaimableDraw = null;
      this.render();
      this._emitStateChange();
      return { ok: true, move: moveResult, gameOver: true, gameResult: this.gameResult };
    }

    // Deteksi apakah langkah pemain sendiri baru saja mencapai syarat Klaim Remis
    // (Threefold Repetition atau Fifty-Move Rule) sebelum komputer membalas otomatis
    if (this.chess.isThreefoldRepetition()) {
      this._pendingPlayerClaimableDraw = {
        reason: 'threefold_repetition',
        label: 'Pengulangan Tiga Kali',
        playerMoveFen: this.chess.fen(),
        historyIndexBeforeReply: this.chess._history.length,
        afterComputerFen: null
      };
    } else if (this.chess.isFiftyMoveRule()) {
      this._pendingPlayerClaimableDraw = {
        reason: 'fifty_move_rule',
        label: 'Aturan 50 Langkah',
        playerMoveFen: this.chess.fen(),
        historyIndexBeforeReply: this.chess._history.length,
        afterComputerFen: null
      };
    } else {
      this._pendingPlayerClaimableDraw = null;
    }

    const activeGameId = this.gameId;
    const claimCheckAfterPlayer = this.verifyDrawClaim();
    const claimHintAfterPlayer = claimCheckAfterPlayer.valid
      ? ` Anda berhak mengajukan Klaim Remis (${claimCheckAfterPlayer.label}).`
      : '';

    this.feedback = {
      type: 'info',
      message: this.engine
        ? `Anda melangkah ${moveResult.san}. Komputer sedang memikirkan balasan...${claimHintAfterPlayer}`
        : `Anda melangkah ${moveResult.san}.${claimHintAfterPlayer}`
    };

    const willTriggerComputer = Boolean(
      this.engine &&
        !this._destroyed &&
        !this.isGameOver &&
        this.chess.turn() === this.computerTurnChar
    );

    if (willTriggerComputer) {
      this.isEngineThinking = true;
      this.engineError = null;
    }

    this.render();
    this._emitStateChange();

    // Kirim posisi terkini ke Stockfish dan tunggu bestmove
    const replyRes = await this._triggerComputerTurn(activeGameId);
    const finalClaimInfo = this.verifyDrawClaim();
    return {
      ok: true,
      move: moveResult,
      computerReply: replyRes?.move || null,
      canClaimDraw: finalClaimInfo.valid,
      claimableDrawReason: finalClaimInfo.reason,
      gameOver: this.isGameOver,
      gameResult: this.gameResult
    };
  }

  async _triggerComputerTurn(expectedGameId = this.gameId) {
    if (
      this._destroyed ||
      this.isGameOver ||
      !this.engine ||
      expectedGameId !== this.gameId ||
      this.chess.turn() !== this.computerTurnChar
    ) {
      return null;
    }

    if (!this.isEngineThinking || this.engineError !== null) {
      this.isEngineThinking = true;
      this.engineError = null;
      this.render();
      this._emitStateChange();
    }

    const currentFen = this.chess.fen();

    let engineResponse = null;
    try {
      engineResponse = await this.engine.requestBestMove({
        fen: currentFen,
        gameId: expectedGameId
      });
    } catch (err) {
      if (this._destroyed || expectedGameId !== this.gameId || this.isGameOver) {
        return null;
      }
      this.isEngineThinking = false;
      this.engineError =
        err?.message || 'Terjadi kendala saat menunggu langkah komputer.';
      this.feedback = {
        type: 'warning',
        message: `${this.engineError} Anda dapat menekan "Coba Ulang Langkah Komputer" atau memulai Permainan Baru.`
      };
      this.render();
      this._emitStateChange();
      return { ok: false, error: this.engineError };
    }

    // Pastikan respons berasal dari game yang masih aktif dan belum berakhir
    if (
      this._destroyed ||
      !engineResponse ||
      engineResponse.cancelled ||
      expectedGameId !== this.gameId ||
      this.isGameOver
    ) {
      return { ok: false, cancelled: true };
    }

    const uciMove = engineResponse.uciMove;
    const parsedMove = engineResponse.parsed || parseUciMove(uciMove);

    if (!parsedMove) {
      this.isEngineThinking = false;
      this._checkAndHandleGameEnd();
      this.render();
      this._emitStateChange();
      return { ok: false, reason: 'no_bestmove' };
    }

    // WAJIB: Validasi langkah komputer menggunakan Chess.js (Bagian 7)
    let computerMoveResult = null;
    try {
      computerMoveResult = this.chess.move(parsedMove);
    } catch {
      computerMoveResult = null;
    }

    if (!computerMoveResult) {
      this.isEngineThinking = false;
      this.engineError = `Engine mengembalikan langkah tidak sah (${uciMove}) yang ditolak oleh validator Chess.js.`;
      this.feedback = {
        type: 'warning',
        message: this.engineError
      };
      this.render();
      this._emitStateChange();
      return { ok: false, reason: 'invalid_engine_move', uciMove };
    }

    this.isEngineThinking = false;
    this.lastMove = {
      from: computerMoveResult.from,
      to: computerMoveResult.to,
      san: computerMoveResult.san,
      color: computerMoveResult.color
    };
    this.inspectedSquareInfo = `Langkah Komputer: ${computerMoveResult.san} (${computerMoveResult.from} → ${computerMoveResult.to})`;

    if (this._pendingPlayerClaimableDraw) {
      this._pendingPlayerClaimableDraw.afterComputerFen = this.chess.fen();
    }

    // Periksa kondisi akhir permainan setelah langkah komputer
    if (this._checkAndHandleGameEnd()) {
      this._pendingPlayerClaimableDraw = null;
      this.render();
      this._emitStateChange();
      return {
        ok: true,
        move: computerMoveResult,
        gameOver: true,
        gameResult: this.gameResult
      };
    }

    const checkWarning = this.chess.inCheck()
      ? ' Perhatian: Raja Anda sedang dalam kondisi Skak (Check)!'
      : '';
    const claimCheck = this.verifyDrawClaim();
    const claimNote = claimCheck.valid
      ? ` Anda berhak mengajukan Klaim Remis (${claimCheck.label}).`
      : '';

    this.feedback = {
      type: this.chess.inCheck() ? 'warning' : 'info',
      message: `Komputer melangkah ${computerMoveResult.san}.${checkWarning} Sekarang giliran Anda.${claimNote}`
    };

    this.render();
    this._emitStateChange();

    return {
      ok: true,
      move: computerMoveResult,
      canClaimDraw: claimCheck.valid,
      claimableDrawReason: claimCheck.reason,
      gameOver: false
    };
  }

  async retryComputerTurn() {
    if (this.isGameOver || this.isEngineThinking) return null;
    if (this.chess.turn() !== this.computerTurnChar) return null;
    return this._triggerComputerTurn(this.gameId);
  }

  /**
   * Memilih / menetapkan langkah yang direncanakan (Intended Move) untuk klaim remis
   * TANPA mengubah posisi papan permainan (`this.chess` tetap utuh).
   */
  setIntendedMove(moveInput) {
    if (this._destroyed || this.isGameOver || !this.chess) {
      return { ok: false, reason: 'game_already_over', intendedMove: null };
    }

    if (moveInput === null || moveInput === undefined) {
      this.intendedMove = null;
      this.render();
      this._emitStateChange();
      return { ok: true, intendedMove: null, canClaimDraw: this.verifyDrawClaim().valid };
    }

    const resolved = this.chess._resolveLegalMove(moveInput);
    if (!resolved) {
      this.intendedMove = null;
      this.feedback = {
        type: 'warning',
        message: 'Langkah yang direncanakan tidak sah pada posisi saat ini. Permainan tetap berjalan.'
      };
      this.render();
      this._emitStateChange();
      return { ok: false, reason: 'illegal_intended_move', intendedMove: null };
    }

    this.intendedMove = resolved;
    const claimCheck = this.verifyDrawClaim(resolved);
    if (claimCheck.valid) {
      this.feedback = {
        type: 'info',
        message: `Langkah yang direncanakan (${resolved.san}) memenuhi syarat Klaim Remis (${claimCheck.label}). Tekan "Klaim Remis" untuk mengakhiri permainan sebagai Seri.`
      };
    } else {
      this.feedback = {
        type: 'info',
        message: `Langkah yang direncanakan: ${resolved.san} (${resolved.from} → ${resolved.to}).`
      };
    }

    this.render();
    this._emitStateChange();
    return {
      ok: true,
      intendedMove: { ...resolved },
      canClaimDraw: claimCheck.valid,
      claimEvaluation: claimCheck
    };
  }

  selectIntendedMove(moveInput) {
    return this.setIntendedMove(moveInput);
  }

  clearIntendedMove() {
    return this.setIntendedMove(null);
  }

  getIntendedMove() {
    return this.intendedMove ? { ...this.intendedMove } : null;
  }

  /**
   * Memverifikasi apakah kondisi Klaim Remis (Threefold Repetition atau Fifty-Move Rule)
   * benar-benar terpenuhi:
   * - Berdasarkan langkah yang direncanakan (`intendedMove` yang diberikan atau `this.intendedMove` yang dipilih)
   *   TANPA mengubah posisi permainan.
   * - Atau berdasarkan posisi saat ini yang sudah muncul di papan.
   */
  verifyDrawClaim(intendedMove = undefined) {
    if (this._destroyed || this.isGameOver || !this.chess) {
      return { valid: false, mode: null, reason: null, label: null, intendedMove: null };
    }

    if (this.chess.isCheckmate() || this.chess.isAutomaticDraw()) {
      return { valid: false, mode: null, reason: null, label: null, intendedMove: null };
    }

    // 1. Jika pemanggil memberikan intendedMove secara eksplisit, evaluasi langkah tersebut tanpa mengubah posisi papan
    if (intendedMove !== undefined && intendedMove !== null) {
      const ev = this.chess.evaluateDrawClaim(intendedMove);
      return {
        valid: ev.valid,
        mode: 'intended_move',
        reason: ev.reason,
        label: ev.label,
        intendedMove: ev.intendedMove || null,
        resultingFen: ev.resultingFen || null,
        repetitionCount: ev.repetitionCount,
        halfMoves: ev.halfMoves
      };
    }

    // 2. Verifikasi langsung terhadap posisi papan saat ini (mempertimbangkan susunan bidak, giliran, hak rokade, dan hak en passant legal)
    const currentEv = this.chess.evaluateDrawClaim(null);
    if (currentEv.valid) {
      return {
        valid: true,
        mode: 'current_position',
        reason: currentEv.reason,
        label: currentEv.label,
        intendedMove: null,
        resultingFen: currentEv.resultingFen,
        repetitionCount: currentEv.repetitionCount,
        halfMoves: currentEv.halfMoves
      };
    }

    // 3. Jika pengguna telah memilih langkah yang direncanakan (this.intendedMove), evaluasi langkah tersebut tanpa mengubah posisi papan
    if (this.intendedMove) {
      const intendedEv = this.chess.evaluateDrawClaim(this.intendedMove);
      if (intendedEv.valid) {
        return {
          valid: true,
          mode: 'intended_move',
          reason: intendedEv.reason,
          label: intendedEv.label,
          intendedMove: intendedEv.intendedMove,
          resultingFen: intendedEv.resultingFen,
          repetitionCount: intendedEv.repetitionCount,
          halfMoves: intendedEv.halfMoves
        };
      }
      return {
        valid: false,
        mode: 'intended_move',
        reason: intendedEv.reason || 'invalid_intended_move_claim',
        label: null,
        intendedMove: intendedEv.intendedMove || this.intendedMove
      };
    }

    // 4. Jika langkah pemain sendiri pada siklus giliran ini baru saja memenuhi syarat klaim sebelum komputer membalas,
    // verifikasi ulang secara ketat terhadap riwayat posisi di Chess.js
    if (this._pendingPlayerClaimableDraw) {
      const pending = this._pendingPlayerClaimableDraw;
      const currentFen = this.chess.fen();
      const matchesExpectedState =
        pending.afterComputerFen === null
          ? currentFen === pending.playerMoveFen &&
            this.chess._history.length === pending.historyIndexBeforeReply
          : currentFen === pending.afterComputerFen &&
            this.chess._history.length === pending.historyIndexBeforeReply + 1;

      if (matchesExpectedState) {
        if (
          pending.reason === 'threefold_repetition' &&
          this.chess.getPositionRepetitionCount(pending.playerMoveFen) >= 3
        ) {
          return {
            valid: true,
            mode: 'current_position',
            reason: 'threefold_repetition',
            label: 'Pengulangan Tiga Kali',
            intendedMove: null
          };
        }

        const entryAtReply = this.chess._history[pending.historyIndexBeforeReply];
        if (
          pending.reason === 'fifty_move_rule' &&
          entryAtReply &&
          entryAtReply.beforeFen === pending.playerMoveFen &&
          entryAtReply.halfMoves >= 100
        ) {
          return {
            valid: true,
            mode: 'current_position',
            reason: 'fifty_move_rule',
            label: 'Aturan 50 Langkah',
            intendedMove: null
          };
        }
      }
    }

    return { valid: false, mode: null, reason: null, label: null, intendedMove: null };
  }

  /**
   * Mengajukan Klaim Remis (Threefold Repetition atau Fifty-Move Rule)
   * baik berdasarkan posisi yang sudah muncul maupun berdasarkan langkah yang direncanakan (`intendedMove`).
   * - Gunakan langkah yang dipilih pengguna tanpa terlebih dahulu mengubah posisi permainan.
   * - Jika valid: akhiri permainan dengan hasil Draw.
   * - Jika salah / tidak valid: permainan tidak rusak dan tetap berjalan sesuai aturan standar.
   */
  async claimDraw(intendedMove = undefined) {
    if (this._destroyed || this.isGameOver) {
      return {
        ok: false,
        valid: false,
        reason: 'game_already_over',
        isGameOver: this.isGameOver
      };
    }

    const verification = this.verifyDrawClaim(intendedMove);
    if (!verification.valid) {
      // Jangan merusak state permainan jika klaim salah
      this.intendedMove = null;
      this.feedback = {
        type: 'warning',
        message:
          'Klaim Remis ditolak: posisi saat ini maupun langkah yang direncanakan belum memenuhi syarat Pengulangan Tiga Kali atau Aturan 50 Langkah. Permainan tetap berjalan.'
      };
      this.render();
      this._emitStateChange();
      return {
        ok: false,
        valid: false,
        reason: verification.reason || 'invalid_draw_claim',
        isGameOver: false
      };
    }

    const activeGameId = this.gameId;
    const savedIntendedMove =
      intendedMove !== undefined ? intendedMove : this.intendedMove;

    this.pendingPromotion = null;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.isEngineThinking = false;

    if (this.engine) {
      try {
        await this.engine.stopSearch('player_claimed_draw');
        this.engine.setGameInProgress(false);
      } catch {
        // Abaikan
      }
    }

    if (this._destroyed || this.gameId !== activeGameId || this.isGameOver) {
      return {
        ok: false,
        valid: false,
        reason: 'cancelled_or_game_over',
        isGameOver: this.isGameOver,
        gameResult: this.gameResult
      };
    }

    // Verifikasi ulang kondisi posisi / langkah yang direncanakan setelah penghentian engine
    const recheck = this.verifyDrawClaim(savedIntendedMove);
    if (!recheck.valid) {
      this.intendedMove = null;
      this.feedback = {
        type: 'warning',
        message:
          'Klaim Remis ditolak: kondisi posisi tidak memenuhi syarat klaim remis. Permainan tetap berjalan.'
      };
      this.render();
      this._emitStateChange();
      return {
        ok: false,
        valid: false,
        reason: recheck.reason || 'invalid_draw_claim',
        isGameOver: false
      };
    }

    this._pendingPlayerClaimableDraw = null;
    this.intendedMove = null;

    const isThreefold = recheck.reason === 'threefold_repetition';
    const isIntended = recheck.mode === 'intended_move' && recheck.intendedMove;
    const intendedSan = isIntended ? recheck.intendedMove.san : null;

    this._finalizeGame({
      result: 'draw',
      termination: recheck.reason,
      winnerColor: null,
      claimMode: recheck.mode || 'current_position',
      claimedIntendedMove: intendedSan,
      title: isThreefold
        ? 'Klaim Remis — Pengulangan Tiga Kali'
        : 'Klaim Remis — Aturan 50 Langkah',
      description: isThreefold
        ? isIntended
          ? `Permainan berakhir seri setelah Klaim Remis berdasarkan langkah yang direncanakan (${intendedSan}) yang membuat posisi identik muncul tiga kali.`
          : 'Permainan berakhir seri setelah Klaim Remis yang sah karena posisi identik (giliran, susunan bidak, hak rokade, dan hak en passant legal) telah berulang tiga kali.'
        : isIntended
        ? `Permainan berakhir seri setelah Klaim Remis berdasarkan langkah yang direncanakan (${intendedSan}) yang mencapai 100 halfmove (Aturan 50 Langkah).`
        : 'Permainan berakhir seri setelah Klaim Remis yang sah berdasarkan Aturan 50 Langkah tanpa langkah pion maupun penangkapan bidak.'
    });

    this.render();
    this._emitStateChange();

    return {
      ok: true,
      valid: true,
      result: 'draw',
      termination: recheck.reason,
      claimMode: recheck.mode || 'current_position',
      claimedIntendedMove: intendedSan,
      isGameOver: true,
      gameResult: this.gameResult
    };
  }

  /**
   * Memeriksa kondisi akhir permainan otomatis dari Chess.js dan menentukan hasil dari sudut pandang pemain.
   * Catatan penting (TASK 7):
   * - Threefold Repetition & Fifty-Move Rule TIDAK mengakhiri permainan secara otomatis (harus melalui Klaim Remis).
   * - Fivefold Repetition & Seventy-Five-Move Rule mengakhiri permainan secara otomatis sebagai Draw (Remis Otomatis).
   * - Apabila langkah ke-75 menghasilkan Checkmate, Checkmate diutamakan (dicek paling pertama).
   */
  _checkAndHandleGameEnd() {
    if (this.isGameOver) return true;

    // 1. Skakmat (Checkmate) — Diutamakan di atas seluruh aturan remis termasuk langkah ke-75
    if (this.chess.isCheckmate()) {
      const loserTurn = this.chess.turn();
      const playerWon = loserTurn === this.computerTurnChar;
      const winnerColor = loserTurn === WHITE ? 'black' : 'white';

      this._finalizeGame({
        result: playerWon ? 'win' : 'loss',
        termination: 'checkmate',
        winnerColor,
        title: playerWon
          ? 'Selamat! Anda Menang dengan Skakmat!'
          : 'Skakmat — Komputer Menang',
        description: playerWon
          ? 'Anda berhasil melakukan skakmat terhadap Raja komputer.'
          : 'Raja Anda terkena skakmat oleh komputer.'
      });
      return true;
    }

    // 2. Remis Otomatis karena Stalemate (Pat)
    if (this.chess.isStalemate()) {
      this._finalizeGame({
        result: 'draw',
        termination: 'stalemate',
        winnerColor: null,
        title: 'Remis Otomatis — Stalemate (Pat)',
        description:
          'Pihak yang sedang giliran melangkah tidak memiliki langkah legal dan Rajanya tidak sedang dalam keadaan skak.'
      });
      return true;
    }

    // 3. Remis Otomatis karena Pengulangan Posisi 5 Kali (Fivefold Repetition)
    if (this.chess.isFivefoldRepetition()) {
      this._finalizeGame({
        result: 'draw',
        termination: 'fivefold_repetition',
        winnerColor: null,
        title: 'Remis Otomatis — Pengulangan Lima Kali',
        description:
          'Posisi papan yang identik telah berulang sebanyak lima kali (Pengulangan Lima Kali) sehingga permainan berakhir dengan Remis Otomatis.'
      });
      return true;
    }

    // 4. Remis Otomatis karena Aturan 75 Langkah (Seventy-Five-Move Rule)
    if (this.chess.isSeventyFiveMoveRule()) {
      this._finalizeGame({
        result: 'draw',
        termination: 'seventy_five_move_rule',
        winnerColor: null,
        title: 'Remis Otomatis — Aturan 75 Langkah',
        description:
          'Telah berlangsung 75 langkah oleh masing-masing pemain tanpa langkah pion maupun penangkapan bidak (Aturan 75 Langkah) sehingga permainan berakhir dengan Remis Otomatis.'
      });
      return true;
    }

    // 5. Remis Otomatis karena Materi Tidak Cukup (Insufficient Material)
    if (this.chess.isInsufficientMaterial()) {
      this._finalizeGame({
        result: 'draw',
        termination: 'insufficient_material',
        winnerColor: null,
        title: 'Remis Otomatis — Materi Tidak Cukup',
        description:
          'Bidak yang tersisa di atas papan tidak mencukupi bagi kedua pihak untuk memaksakan skakmat.'
      });
      return true;
    }

    // 6. Kondisi Remis Otomatis lainnya dari Chess.js
    if (this.chess.isAutomaticDraw()) {
      this._finalizeGame({
        result: 'draw',
        termination: 'draw',
        winnerColor: null,
        title: 'Remis Otomatis',
        description: 'Permainan berakhir dengan Remis Otomatis sesuai aturan catur standar.'
      });
      return true;
    }

    return false;
  }

  _finalizeGame({
    result,
    termination,
    winnerColor = null,
    claimMode = null,
    claimedIntendedMove = null,
    title,
    description
  }) {
    if (this.isGameOver) return;

    this.isGameOver = true;
    this.isEngineThinking = false;
    this.intendedMove = null;
    this.finishedAt = new Date().toISOString();

    if (this.engine) {
      this.engine.setGameInProgress(false);
    }

    const pgn = typeof this.chess.pgn === 'function' ? this.chess.pgn() : '';

    this.gameResult = {
      id: this.gameId,
      result, // 'win' | 'loss' | 'draw'
      playerColor: this.playerColor,
      difficulty: this.difficultyId,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt,
      termination,
      winnerColor,
      claimMode,
      claimedIntendedMove,
      title,
      description,
      pgn,
      totalMoves: Math.ceil(this.chess.history().length / 2)
    };

    this.feedback = {
      type: result === 'win' ? 'success' : result === 'loss' ? 'warning' : 'info',
      message: `${title} — ${description}`
    };

    if (!this._hasRecordedEnd) {
      this._hasRecordedEnd = true;
      if (typeof this.callbacks.onGameEnd === 'function') {
        this.callbacks.onGameEnd({ ...this.gameResult });
      }
    }
  }

  getGameStateSnapshot() {
    const verboseHistory = this.chess.history({ verbose: true });
    const capturedInfo = calculateCapturedPieces(verboseHistory);
    const movePairs = buildMovePairs(verboseHistory);
    const turn = this.chess.turn();
    const inCheck = this.chess.inCheck();
    const claimCheck = this.verifyDrawClaim();
    const claimableIntendedMoves =
      !this.isGameOver && !this.isEngineThinking && turn === this.playerTurnChar
        ? this.chess.getClaimableIntendedMoves()
        : [];

    return {
      gameId: this.gameId,
      fen: this.chess.fen(),
      pgn: typeof this.chess.pgn === 'function' ? this.chess.pgn() : '',
      colorPreference: this.colorPreference,
      playerColor: this.playerColor,
      computerColor: this.computerColor,
      difficultyId: this.difficultyId,
      orientation: this.orientation,
      turn: turn === WHITE ? 'white' : 'black',
      isPlayerTurn: !this.isGameOver && !this.isEngineThinking && turn === this.playerTurnChar,
      isEngineThinking: this.isEngineThinking,
      inCheck,
      canClaimDraw: claimCheck.valid,
      claimableDrawMode: claimCheck.mode,
      claimableDrawReason: claimCheck.reason,
      claimableDrawLabel: claimCheck.label,
      intendedMove: this.intendedMove ? { ...this.intendedMove } : null,
      claimableIntendedMoves,
      isGameOver: this.isGameOver,
      gameResult: this.gameResult ? { ...this.gameResult } : null,
      engineError: this.engineError,
      movePairs,
      totalPly: verboseHistory.length,
      capturedInfo,
      startedAt: this.startedAt,
      finishedAt: this.finishedAt
    };
  }

  _emitStateChange() {
    if (typeof this.callbacks.onStateChange === 'function') {
      this.callbacks.onStateChange(this.getGameStateSnapshot());
    }
  }

  _handleSquareClick(square) {
    if (this.isGameOver || this.isEngineThinking || this.pendingPromotion) return;

    const clickedPiece = this.chess.get(square);
    if (clickedPiece) {
      const colorName = clickedPiece.color === WHITE ? 'Putih' : 'Hitam';
      const pieceName = PIECE_NAMES_ID[clickedPiece.type] || clickedPiece.type;
      this.inspectedSquareInfo = `Petak ${square}: ${pieceName} ${colorName}`;
    } else {
      this.inspectedSquareInfo = `Petak ${square}: Kosong`;
    }

    // Pastikan sedang giliran pemain
    if (this.chess.turn() !== this.playerTurnChar) {
      this.render();
      return;
    }

    // Jika sudah ada bidak yang dipilih dan mengklik petak tujuan legal
    if (this.selectedSquare) {
      const candidateMoves = this.legalMovesForSelected.filter(m => m.to === square);
      if (candidateMoves.length > 0) {
        const isPromotion = candidateMoves.some(m => Boolean(m.promotion));
        if (isPromotion) {
          this.pendingPromotion = { from: this.selectedSquare, to: square };
          this.render();
          this._emitStateChange();
          return;
        }
        this.playPlayerMove({ from: this.selectedSquare, to: square });
        return;
      }
    }

    // Pilih bidak milik pemain sendiri
    if (clickedPiece && clickedPiece.color === this.playerTurnChar) {
      if (this.selectedSquare === square) {
        this.selectedSquare = null;
        this.legalMovesForSelected = [];
        this.intendedMove = null;
      } else {
        this.selectedSquare = square;
        this.legalMovesForSelected = this.chess.moves({ square, verbose: true });
        // Jika salah satu langkah legal dari petak yang dipilih memenuhi syarat Klaim Remis
        // berdasarkan langkah yang direncanakan (Intended Move), tandai sebagai intendedMove tanpa mengubah posisi papan
        const qualifyingIntended = this.legalMovesForSelected.find(
          m => this.chess.evaluateDrawClaim(m).valid
        );
        this.intendedMove = qualifyingIntended || null;
      }
      this.render();
      this._emitStateChange();
      return;
    }

    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.intendedMove = null;
    this.render();
    this._emitStateChange();
  }

  _handlePromotionSelect(promoPiece) {
    if (!this.pendingPromotion) return;
    const { from, to } = this.pendingPromotion;
    this.pendingPromotion = null;
    this.playPlayerMove({ from, to, promotion: promoPiece });
  }

  _cancelPromotion() {
    if (!this.pendingPromotion) return;
    this.pendingPromotion = null;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.render();
    this._emitStateChange();
  }

  destroy() {
    this._destroyed = true;
    if (this.engine) {
      try {
        this.engine.stopSearch('board_destroyed');
        this.engine.setGameInProgress(false);
      } catch {
        // Abaikan
      }
    }
  }

  render() {
    if (!this.container || this._destroyed) return;

    const turn = this.chess.turn();
    const isPlayerTurn = !this.isGameOver && !this.isEngineThinking && turn === this.playerTurnChar;
    const turnSideText = turn === WHITE ? 'Putih' : 'Hitam';
    const turnText = this.isGameOver
      ? 'Permainan Selesai'
      : this.isEngineThinking
      ? 'Komputer sedang berpikir...'
      : isPlayerTurn
      ? `Giliran Anda (${turnSideText})`
      : `Giliran Komputer (${turnSideText})`;

    const inCheck = this.chess.inCheck();
    const isCheckmate = this.chess.isCheckmate();
    const isStalemate = this.chess.isStalemate();

    const rowIndices =
      this.orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const colIndices =
      this.orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

    const boardState = this.chess.board();
    const legalTargetMap = new Map();
    for (const m of this.legalMovesForSelected) {
      legalTargetMap.set(m.to, m);
    }

    const squareDescriptors = [];
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
        const legalMove = legalTargetMap.get(sq);
        const isKingInCheck =
          inCheck && piece && piece.type === 'k' && piece.color === turn;

        const classes = [
          'chess-square',
          isLight ? 'square-light' : 'square-dark',
          isSelected ? 'square-selected' : '',
          isLastMove ? 'square-last-move' : '',
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
            piece.color === this.playerTurnChar &&
            turn === this.playerTurnChar &&
            !this.isEngineThinking &&
            !this.pendingPromotion &&
            !this.isGameOver
        );

        const ariaLabel = `Petak ${sq}${
          piece
            ? ` berisi ${PIECE_NAMES_ID[piece.type]} ${
                piece.color === WHITE ? 'Putih' : 'Hitam'
              }`
            : ''
        }`;

        const innerHtml = `${
          showRankLabel ? `<span class="coord-label coord-rank">${RANKS[r]}</span>` : ''
        }${
          showFileLabel ? `<span class="coord-label coord-file">${FILES[c]}</span>` : ''
        }${
          piece
            ? `<span class="piece-wrapper">${getPieceSvg(piece.color, piece.type)}</span>`
            : ''
        }${legalIndicatorHtml}`;

        squareDescriptors.push({
          sq,
          classes,
          draggable: isDraggable ? 'true' : 'false',
          ariaLabel,
          innerHtml
        });
      }
    }

    let promotionModalHtml = '';
    if (this.pendingPromotion) {
      const promoColor = this.playerTurnChar;
      promotionModalHtml = `
        <div class="promotion-overlay" role="dialog" aria-label="Pilih bidak promosi pion" data-testid="play-promotion-dialog">
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
            <button type="button" class="btn btn-secondary btn-sm promo-cancel-btn" data-action="cancel-promotion">
              Batal
            </button>
          </div>
        </div>
      `;
    }

    const claimCheck = this.verifyDrawClaim();

    // Gunakan satu indikator langkah/status yang ringkas dan stabil di sisi kanan tanpa menggandakan teks berpikir
    let statusAlertBadge = '';
    if (isCheckmate) {
      statusAlertBadge = `<span class="board-state-badge badge-danger" data-testid="play-board-badge">Skakmat!</span>`;
    } else if (isStalemate) {
      statusAlertBadge = `<span class="board-state-badge badge-warning" data-testid="play-board-badge">Stalemate</span>`;
    } else if (this.isGameOver && this.gameResult) {
      const badgeClass =
        this.gameResult.result === 'win'
          ? 'badge-success'
          : this.gameResult.result === 'loss'
          ? 'badge-danger'
          : 'badge-warning';
      let label = 'Permainan Seri';
      if (this.gameResult.result === 'win') {
        label = 'Anda Menang';
      } else if (this.gameResult.result === 'loss') {
        label = 'Komputer Menang';
      } else if (this.gameResult.termination === 'fivefold_repetition') {
        label = 'Remis (5x Ulang)';
      } else if (this.gameResult.termination === 'seventy_five_move_rule') {
        label = 'Remis (75 Langkah)';
      } else if (
        this.gameResult.termination === 'threefold_repetition' ||
        this.gameResult.termination === 'fifty_move_rule'
      ) {
        label = 'Klaim Remis';
      } else {
        label = 'Remis Otomatis';
      }
      statusAlertBadge = `<span class="board-state-badge ${badgeClass}" data-testid="play-board-badge">${label}</span>`;
    } else if (claimCheck.valid) {
      statusAlertBadge = `<span class="board-state-badge badge-warning" data-testid="play-claimable-draw-badge">Klaim Remis</span>`;
    } else if (inCheck) {
      statusAlertBadge = `<span class="board-state-badge badge-danger" data-testid="play-board-badge">Skak (Check)!</span>`;
    } else {
      const moveNum = Math.floor(this.chess.history().length / 2) + 1;
      statusAlertBadge = `<span class="board-state-badge badge-step" data-testid="play-board-badge">Langkah #${moveNum}</span>`;
    }

    const boardClaimDrawButtonHtml =
      claimCheck.valid && !this.isGameOver
        ? `<div class="board-claim-draw-bar" data-testid="board-claim-draw-bar">
             <button
               type="button"
               class="btn btn-primary btn-sm"
               data-action="board-claim-draw"
               data-testid="board-claim-draw-btn"
             >
               Klaim Remis (${claimCheck.label})
             </button>
           </div>`
        : '';

    const dotClass = [
      'turn-dot',
      turn === WHITE ? 'dot-white' : 'dot-black',
      this.isEngineThinking ? 'dot-thinking' : ''
    ]
      .filter(Boolean)
      .join(' ');

    const orientationLabel = `Orientasi: ${
      this.orientation === 'white' ? 'Putih di Bawah' : 'Hitam di Bawah'
    }`;

    const feedbackTitle =
      this.feedback.type === 'success'
        ? 'Hasil:'
        : this.feedback.type === 'warning'
        ? 'Perhatian:'
        : 'Status Permainan:';

    const existingWidget = this.container.querySelector('.play-chessboard-widget');
    const existingSquares = existingWidget
      ? existingWidget.querySelectorAll('.chess-square')
      : [];

    // Jika widget papan sudah terpasang di DOM, perbarui elemen secara in-place
    // agar posisi vertikal papan (.chessboard-frame), fokus browser, dan scroll tidak bergeser/berkedip
    if (existingWidget && existingSquares.length === 64) {
      const turnIndEl = existingWidget.querySelector('[data-testid="play-turn-indicator"]');
      if (turnIndEl) {
        turnIndEl.setAttribute('data-turn', turn);
        turnIndEl.setAttribute('data-thinking', this.isEngineThinking ? 'true' : 'false');
        const dotEl = turnIndEl.querySelector('.turn-dot');
        if (dotEl && dotEl.className !== dotClass) {
          dotEl.className = dotClass;
        }
        const labelEl = turnIndEl.querySelector('.turn-label');
        if (labelEl && labelEl.textContent !== turnText) {
          labelEl.textContent = turnText;
        }
      }

      const badgesEl = existingWidget.querySelector('.board-status-badges');
      if (badgesEl && badgesEl._lastBadgeHtml !== statusAlertBadge) {
        badgesEl.innerHTML = statusAlertBadge;
        badgesEl._lastBadgeHtml = statusAlertBadge;
      }

      for (let i = 0; i < 64; i++) {
        const sqBtn = existingSquares[i];
        const desc = squareDescriptors[i];
        if (sqBtn.getAttribute('data-square') !== desc.sq) {
          sqBtn.setAttribute('data-square', desc.sq);
        }
        if (sqBtn.className !== desc.classes) {
          sqBtn.className = desc.classes;
        }
        if (sqBtn.getAttribute('draggable') !== desc.draggable) {
          sqBtn.setAttribute('draggable', desc.draggable);
        }
        if (sqBtn.getAttribute('aria-label') !== desc.ariaLabel) {
          sqBtn.setAttribute('aria-label', desc.ariaLabel);
        }
        if (sqBtn._lastSquareHtml !== desc.innerHtml) {
          sqBtn.innerHTML = desc.innerHtml;
          sqBtn._lastSquareHtml = desc.innerHtml;
        }
      }

      const promoSlotEl = existingWidget.querySelector('[data-testid="play-promotion-slot"]');
      if (promoSlotEl && promoSlotEl._lastPromoHtml !== promotionModalHtml) {
        promoSlotEl.innerHTML = promotionModalHtml;
        promoSlotEl._lastPromoHtml = promotionModalHtml;
        this._bindPromotionEvents();
      }

      const coordTextEl = existingWidget.querySelector('.coord-inspector-text');
      if (coordTextEl && coordTextEl.textContent !== this.inspectedSquareInfo) {
        coordTextEl.textContent = this.inspectedSquareInfo;
      }

      const orientPillEl = existingWidget.querySelector('.move-history-pill');
      if (orientPillEl && orientPillEl.textContent.trim() !== orientationLabel) {
        orientPillEl.textContent = orientationLabel;
      }

      const feedbackEl = existingWidget.querySelector('[data-testid="play-board-feedback"]');
      if (feedbackEl) {
        const nextFeedbackClass = `chessboard-feedback feedback-${this.feedback.type}`;
        if (feedbackEl.className !== nextFeedbackClass) {
          feedbackEl.className = nextFeedbackClass;
        }
        const fbTitleEl = feedbackEl.querySelector('.feedback-title');
        if (fbTitleEl && fbTitleEl.textContent !== feedbackTitle) {
          fbTitleEl.textContent = feedbackTitle;
        }
        const fbMsgEl = feedbackEl.querySelector('.feedback-message');
        if (fbMsgEl && fbMsgEl.textContent !== this.feedback.message) {
          fbMsgEl.textContent = this.feedback.message;
        }
      }

      const claimSlotEl = existingWidget.querySelector('[data-testid="board-claim-draw-slot"]');
      if (claimSlotEl && claimSlotEl._lastClaimHtml !== boardClaimDrawButtonHtml) {
        claimSlotEl.innerHTML = boardClaimDrawButtonHtml;
        claimSlotEl._lastClaimHtml = boardClaimDrawButtonHtml;
        this._bindClaimDrawEvents();
      }

      return;
    }

    const squaresHtml = squareDescriptors
      .map(
        d => `
          <button
            type="button"
            class="${d.classes}"
            data-square="${d.sq}"
            draggable="${d.draggable}"
            aria-label="${d.ariaLabel}"
          >${d.innerHtml}</button>
        `
      )
      .join('');

    this.container.innerHTML = `
      <div class="chessboard-widget play-chessboard-widget">
        <div class="chessboard-topbar" data-testid="play-status-bar">
          <div class="turn-indicator" data-turn="${turn}" data-thinking="${
      this.isEngineThinking ? 'true' : 'false'
    }" data-testid="play-turn-indicator">
            <span class="${dotClass}"></span>
            <span class="turn-label">${turnText}</span>
          </div>
          <div class="board-status-badges">
            ${statusAlertBadge}
          </div>
        </div>

        <div class="chessboard-frame">
          <div class="chessboard-grid" role="grid" aria-label="Papan Catur Melawan Komputer">
            ${squaresHtml}
          </div>
          <div class="promotion-slot" data-testid="play-promotion-slot">${promotionModalHtml}</div>
        </div>

        <div class="chessboard-coord-statusbar">
          <span class="coord-inspector-text">${this.inspectedSquareInfo}</span>
          <span class="move-history-pill">${orientationLabel}</span>
        </div>

        <div class="chessboard-feedback feedback-${this.feedback.type}" role="status" data-testid="play-board-feedback">
          <div class="feedback-content">
            <strong class="feedback-title">${feedbackTitle}</strong>
            <span class="feedback-message">${this.feedback.message}</span>
          </div>
          <div class="board-claim-draw-slot" data-testid="board-claim-draw-slot">${boardClaimDrawButtonHtml}</div>
        </div>
      </div>
    `;

    const mountedSquares = this.container.querySelectorAll('.chess-square');
    for (let i = 0; i < mountedSquares.length && i < squareDescriptors.length; i++) {
      mountedSquares[i]._lastSquareHtml = squareDescriptors[i].innerHtml;
    }
    const mountedBadges = this.container.querySelector('.board-status-badges');
    if (mountedBadges) mountedBadges._lastBadgeHtml = statusAlertBadge;
    const mountedPromo = this.container.querySelector('[data-testid="play-promotion-slot"]');
    if (mountedPromo) mountedPromo._lastPromoHtml = promotionModalHtml;
    const mountedClaim = this.container.querySelector('[data-testid="board-claim-draw-slot"]');
    if (mountedClaim) mountedClaim._lastClaimHtml = boardClaimDrawButtonHtml;

    this._bindEvents();
  }

  _bindPromotionEvents() {
    const promoBtns = this.container.querySelectorAll('.promo-btn');
    promoBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const promo = btn.getAttribute('data-promo');
        this._handlePromotionSelect(promo);
      });
    });

    const cancelPromoBtn = this.container.querySelector('[data-action="cancel-promotion"]');
    if (cancelPromoBtn) {
      cancelPromoBtn.addEventListener('click', () => this._cancelPromotion());
    }
  }

  _bindClaimDrawEvents() {
    const boardClaimDrawBtn = this.container.querySelector('[data-action="board-claim-draw"]');
    if (boardClaimDrawBtn) {
      boardClaimDrawBtn.addEventListener('click', () => {
        this.claimDraw();
      });
    }
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
          p.color !== this.playerTurnChar ||
          this.chess.turn() !== this.playerTurnChar ||
          this.isEngineThinking ||
          this.pendingPromotion ||
          this.isGameOver
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

    this._bindPromotionEvents();
    this._bindClaimDrawEvents();
  }
}

/**
 * Memvalidasi daftar langkah opening menggunakan Chess.js dari posisi awal standar.
 * Memastikan tidak ada langkah PGN yang belum divalidasi yang dieksekusi di atas papan.
 */
export function validateOpeningSequenceWithChess(opening) {
  const initialFen =
    opening && typeof opening.initialFen === 'string' && opening.initialFen.trim()
      ? opening.initialFen.trim()
      : DEFAULT_POSITION;

  const game = new Chess(initialFen);
  const rawMoves = Array.isArray(opening?.moves) ? opening.moves : [];
  const annotations = Array.isArray(opening?.moveAnnotations) ? opening.moveAnnotations : [];
  const validMoves = [];

  for (let i = 0; i < rawMoves.length; i += 1) {
    const moveToken = rawMoves[i];
    const applied = game.move(moveToken);
    if (!applied) {
      throw new Error(
        `Langkah opening tidak valid pada ply ${i + 1} (${String(moveToken)}) untuk ${opening?.id || 'unknown'}`
      );
    }
    const ann = annotations[i] || {};
    validMoves.push({
      ply: i + 1,
      moveNumber: Math.floor(i / 2) + 1,
      color: applied.color === WHITE ? 'white' : 'black',
      colorChar: applied.color,
      san: applied.san,
      uci: `${applied.from}${applied.to}${applied.promotion || ''}`,
      from: applied.from,
      to: applied.to,
      piece: applied.piece,
      idea:
        typeof ann.idea === 'string' && ann.idea.trim()
          ? ann.idea.trim()
          : `Langkah pengembangan ${applied.san} dari ${applied.from} ke ${applied.to}.`,
      fenAfter: game.fen()
    });
  }

  return {
    initialFen,
    validMoves,
    finalFen: game.fen()
  };
}

/**
 * Komponen Papan Catur Mode Belajar Opening (MVP 4 — Bagian 5: Opening Detail & Learn Mode)
 * - Mulai dari posisi awal standar.
 * - Pengguna dapat maju satu langkah, mundur satu langkah, kembali ke posisi awal, membalik papan,
 *   serta memilih langkah langsung dari daftar notasi.
 * - Setiap langkah diterapkan melalui Chess.js, meng-highlight langkah terakhir, dan memperbarui riwayat SAN.
 */
export class OpeningLearnBoard {
  constructor(container, opening, callbacks = {}) {
    this.container = container;
    this.opening = opening;
    this.callbacks = callbacks;

    const validated = validateOpeningSequenceWithChess(opening);
    this.initialFen = validated.initialFen;
    this.validMoves = validated.validMoves;

    this.chess = new Chess(this.initialFen);
    this.orientation = opening?.repertoireSide === 'black' ? 'black' : 'white';
    this.currentPly = 0;
    this.lastMove = null;
    this.inspectedSquareInfo =
      'Posisi awal standar. Gunakan tombol navigasi atau klik daftar langkah untuk mempelajari urutan pembukaan.';

    this.render();
  }

  destroy() {
    // Tidak ada timer aktif pada mode Learn
  }

  loadOpening(opening) {
    this.opening = opening;
    const validated = validateOpeningSequenceWithChess(opening);
    this.initialFen = validated.initialFen;
    this.validMoves = validated.validMoves;
    this.orientation = opening?.repertoireSide === 'black' ? 'black' : 'white';
    this.goToPly(0);
  }

  getStepState() {
    const activeMove = this.currentPly > 0 ? this.validMoves[this.currentPly - 1] : null;
    const nextMove =
      this.currentPly < this.validMoves.length ? this.validMoves[this.currentPly] : null;
    return {
      currentPly: this.currentPly,
      totalPlies: this.validMoves.length,
      fen: this.chess.fen(),
      historySan: this.chess.history(),
      pgn: this.chess.pgn(),
      lastMove: this.lastMove ? { ...this.lastMove } : null,
      activeMove,
      nextMove,
      orientation: this.orientation
    };
  }

  goToPly(targetPly) {
    const clampedPly = Math.max(0, Math.min(this.validMoves.length, Math.floor(Number(targetPly) || 0)));
    this.chess.load(this.initialFen);
    let lastApplied = null;

    for (let i = 0; i < clampedPly; i += 1) {
      const step = this.validMoves[i];
      const moveRes = this.chess.move(step.san);
      if (!moveRes) {
        throw new Error(`Gagal menerapkan langkah tervalidasi ${step.san} pada ply ${i + 1}.`);
      }
      lastApplied = step;
    }

    this.currentPly = clampedPly;
    this.lastMove = lastApplied ? { from: lastApplied.from, to: lastApplied.to } : null;

    if (lastApplied) {
      const sideLabel = lastApplied.color === 'white' ? 'Putih' : 'Hitam';
      const moveLabel =
        lastApplied.color === 'white'
          ? `${lastApplied.moveNumber}. ${lastApplied.san}`
          : `${lastApplied.moveNumber}... ${lastApplied.san}`;
      this.inspectedSquareInfo = `Langkah ${moveLabel} (${sideLabel}): ${lastApplied.from} → ${lastApplied.to}`;
    } else {
      this.inspectedSquareInfo = 'Posisi awal standar (sebelum langkah pertama dimainkan).';
    }

    this.render();

    if (typeof this.callbacks.onStepChange === 'function') {
      this.callbacks.onStepChange(this.getStepState());
    }
    return this.getStepState();
  }

  nextMove() {
    if (this.currentPly < this.validMoves.length) {
      return this.goToPly(this.currentPly + 1);
    }
    return this.getStepState();
  }

  prevMove() {
    if (this.currentPly > 0) {
      return this.goToPly(this.currentPly - 1);
    }
    return this.getStepState();
  }

  resetToStart() {
    return this.goToPly(0);
  }

  goToEnd() {
    return this.goToPly(this.validMoves.length);
  }

  flipBoard() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    this.render();
    if (typeof this.callbacks.onStepChange === 'function') {
      this.callbacks.onStepChange(this.getStepState());
    }
  }

  render() {
    if (!this.container) return;

    const turn = this.chess.turn();
    const turnText = turn === WHITE ? 'Giliran Putih' : 'Giliran Hitam';
    const rowIndices =
      this.orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const colIndices =
      this.orientation === 'white' ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];

    const boardState = this.chess.board();
    let squaresHtml = '';

    for (let visualRowIdx = 0; visualRowIdx < 8; visualRowIdx += 1) {
      const r = rowIndices[visualRowIdx];
      for (let visualColIdx = 0; visualColIdx < 8; visualColIdx += 1) {
        const c = colIndices[visualColIdx];
        const sq = FILES[c] + RANKS[r];
        const isLight = (r + c) % 2 === 0;
        const piece = boardState[r][c];
        const isLastMove =
          this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq);
        const showRankLabel = visualColIdx === 0;
        const showFileLabel = visualRowIdx === 7;

        const classes = [
          'chess-square',
          isLight ? 'square-light' : 'square-dark',
          isLastMove ? 'square-last-move' : '',
          piece ? 'has-piece' : ''
        ]
          .filter(Boolean)
          .join(' ');

        squaresHtml += `
          <div
            class="${classes}"
            data-square="${sq}"
            aria-label="Petak ${sq}${piece ? ` berisi ${PIECE_NAMES_ID[piece.type]} ${piece.color === WHITE ? 'Putih' : 'Hitam'}` : ''}"
          >
            ${showRankLabel ? `<span class="coord-label coord-rank">${RANKS[r]}</span>` : ''}
            ${showFileLabel ? `<span class="coord-label coord-file">${FILES[c]}</span>` : ''}
            ${piece ? `<span class="piece-wrapper">${getPieceSvg(piece.color, piece.type)}</span>` : ''}
          </div>
        `;
      }
    }

    const activeMove = this.currentPly > 0 ? this.validMoves[this.currentPly - 1] : null;
    const nextMove =
      this.currentPly < this.validMoves.length ? this.validMoves[this.currentPly] : null;

    let stepExplanationTitle = 'Posisi Awal Pembukaan';
    let stepExplanationBody =
      this.validMoves.length > 0
        ? `Klik tombol "Langkah Berikutnya" untuk melihat langkah pertama (${this.validMoves[0].moveNumber}. ${this.validMoves[0].san}).`
        : 'Urutan langkah pembukaan siap dipelajari.';

    if (activeMove) {
      const prefix =
        activeMove.color === 'white'
          ? `${activeMove.moveNumber}. ${activeMove.san}`
          : `${activeMove.moveNumber}... ${activeMove.san}`;
      stepExplanationTitle = `Langkah ${prefix} (${activeMove.color === 'white' ? 'Putih' : 'Hitam'})`;
      stepExplanationBody = activeMove.idea;
    }

    const historySan = this.chess.history();

    this.container.innerHTML = `
      <div class="chessboard-widget opening-learn-board-widget" data-testid="opening-learn-board">
        <div class="chessboard-topbar">
          <div class="turn-indicator" data-turn="${turn}">
            <span class="turn-dot ${turn === WHITE ? 'dot-white' : 'dot-black'}"></span>
            <span class="turn-label">${turnText}</span>
          </div>
          <div class="board-status-badges">
            <span class="board-state-badge badge-step" data-testid="opening-learn-ply-badge">
              Langkah ${this.currentPly} / ${this.validMoves.length}
            </span>
          </div>
        </div>

        <div class="chessboard-frame">
          <div class="chessboard-grid" role="grid" aria-label="Papan Catur Pembelajaran Opening">
            ${squaresHtml}
          </div>
        </div>

        <div class="chessboard-coord-statusbar">
          <span class="coord-inspector-text" data-testid="opening-learn-coord-info">${this.inspectedSquareInfo}</span>
          <span class="move-history-pill" data-testid="opening-learn-san-pill">
            Riwayat SAN: ${historySan.length > 0 ? historySan.join(' ') : 'Posisi Awal'}
          </span>
        </div>

        <div class="chessboard-feedback feedback-info" role="status" data-testid="opening-learn-step-feedback">
          <div class="feedback-content">
            <strong>${stepExplanationTitle}:</strong>
            <span>${stepExplanationBody}</span>
            ${
              nextMove
                ? `<div class="opening-next-move-preview">Langkah selanjutnya dalam variasi: <code>${
                    nextMove.color === 'white'
                      ? `${nextMove.moveNumber}. ${nextMove.san}`
                      : `${nextMove.moveNumber}... ${nextMove.san}`
                  }</code></div>`
                : `<div class="opening-next-move-preview">Seluruh langkah variasi telah ditampilkan (${this.validMoves.length} ply).</div>`
            }
          </div>
        </div>

        <div class="chessboard-controls opening-learn-controls">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="learn-reset"
            data-testid="opening-learn-reset-btn"
            ${this.currentPly === 0 ? 'disabled' : ''}
          >
            ${UI_ICONS.restart}
            <span>Posisi Awal</span>
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="learn-prev"
            data-testid="opening-learn-prev-btn"
            ${this.currentPly === 0 ? 'disabled' : ''}
          >
            ${UI_ICONS.chevronLeft}
            <span>Mundur</span>
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            data-action="learn-next"
            data-testid="opening-learn-next-btn"
            ${this.currentPly >= this.validMoves.length ? 'disabled' : ''}
          >
            <span>Maju</span>
            ${UI_ICONS.chevronRight}
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="learn-flip"
            data-testid="opening-learn-flip-btn"
          >
            ${UI_ICONS.flip}
            <span>Balik Papan</span>
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    const resetBtn = this.container.querySelector('[data-action="learn-reset"]');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetToStart());
    }

    const prevBtn = this.container.querySelector('[data-action="learn-prev"]');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.prevMove());
    }

    const nextBtn = this.container.querySelector('[data-action="learn-next"]');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextMove());
    }

    const flipBtn = this.container.querySelector('[data-action="learn-flip"]');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => this.flipBoard());
    }
  }
}

/**
 * Komponen Papan Catur Mode Latihan Opening (MVP 4 — Bagian 6: Opening Practice Mode)
 * Fitur Inti MVP 4:
 * 1. Mulai dari posisi awal standar.
 * 2. Sembunyikan langkah yang harus dimainkan pengguna.
 * 3. Ketika giliran pengguna, validasi setiap langkah dengan Chess.js:
 *    - Langkah ilegal: ditolak karena melanggar aturan catur.
 *    - Langkah legal tetapi bukan bagian dari variasi latihan:
 *      tampilkan pesan sopan bahwa langkah tersebut bukan bagian dari variasi,
 *      batalkan langkah (undo), catat kesalahan, dan izinkan pengguna mencoba lagi.
 *    - Langkah benar sesuai variasi: tampilkan langkah tersebut di papan & riwayat.
 * 4. Ketika giliran lawan, jalankan langkah lawan secara otomatis berdasarkan variasi.
 * 5. Sistem Hint 3 tahap (Hint 1: ide langkah umum, Hint 2: highlight bidak asal, Hint 3: petak tujuan).
 */
export class OpeningPracticeBoard {
  constructor(container, opening, callbacks = {}) {
    this.container = container;
    this.opening = opening;
    this.callbacks = callbacks;
    this.replyDelayMs =
      typeof callbacks.replyDelayMs === 'number' && callbacks.replyDelayMs >= 0
        ? callbacks.replyDelayMs
        : 320;

    const validated = validateOpeningSequenceWithChess(opening);
    this.initialFen = validated.initialFen;
    this.validMoves = validated.validMoves;

    this.playerColor =
      callbacks.repertoireSide === 'black' || opening?.repertoireSide === 'black'
        ? 'black'
        : 'white';
    this.playerTurnChar = this.playerColor === 'black' ? BLACK : WHITE;

    this.chess = new Chess(this.initialFen);
    this.orientation = this.playerColor;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.lastMove = null;
    this.hintSquares = [];
    this.hintStage = 0; // 0 = belum pakai hint pada ply ini, 1 = ide umum, 2 = bidak asal, 3 = petak tujuan
    this.currentPly = 0;
    this.correctMoves = 0;
    this.wrongMoves = 0;
    this.hintsUsed = 0;
    this.isPracticeComplete = false;
    this.isLockedForOpponent = false;
    this.pendingPromotion = null;
    this._dragSourceSquare = null;
    this._replyTimeout = null;
    this.attemptId = this._createAttemptId();

    this.totalPlayerMovesInVariation = this.validMoves.filter(
      m => m.color === this.playerColor
    ).length;

    this._initPracticeSession();
  }

  _createAttemptId() {
    const oid = this.opening ? this.opening.id : 'opening';
    return `open_att_${oid}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  _initPracticeSession() {
    if (this._replyTimeout) {
      clearTimeout(this._replyTimeout);
      this._replyTimeout = null;
    }

    this.chess.load(this.initialFen);
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.lastMove = null;
    this.hintSquares = [];
    this.hintStage = 0;
    this.currentPly = 0;
    this.correctMoves = 0;
    this.wrongMoves = 0;
    this.hintsUsed = 0;
    this.isPracticeComplete = false;
    this.isLockedForOpponent = false;
    this.pendingPromotion = null;
    this.attemptId = this._createAttemptId();

    const sideName = this.playerColor === 'white' ? 'Putih' : 'Hitam';
    this.inspectedSquareInfo = `Repertoire ${sideName} — ${this.opening?.name || 'Opening'}`;
    this.feedback = {
      type: 'info',
      message: `Mulai latihan ${this.opening?.name || 'Opening'} sebagai ${sideName}. Temukan langkah pembukaan yang sesuai dengan variasi!`
    };

    this.render();
    this._checkAndRunOpponentTurn();
  }

  destroy() {
    if (this._replyTimeout) {
      clearTimeout(this._replyTimeout);
      this._replyTimeout = null;
    }
  }

  restart() {
    this._initPracticeSession();
  }

  flipBoard() {
    this.orientation = this.orientation === 'white' ? 'black' : 'white';
    this.render();
  }

  getPracticeState() {
    const totalAttempts = this.correctMoves + this.wrongMoves;
    const accuracy =
      totalAttempts > 0 ? Math.round((this.correctMoves / totalAttempts) * 100) : 100;
    return {
      attemptId: this.attemptId,
      openingId: this.opening?.id || null,
      repertoireSide: this.playerColor,
      currentPly: this.currentPly,
      totalPlies: this.validMoves.length,
      correctMoves: this.correctMoves,
      totalPlayerMoves: this.totalPlayerMovesInVariation,
      wrongMoves: this.wrongMoves,
      hintsUsed: this.hintsUsed,
      hintStage: this.hintStage,
      accuracy,
      isPracticeComplete: this.isPracticeComplete,
      fen: this.chess.fen(),
      historySan: this.chess.history()
    };
  }

  _checkAndRunOpponentTurn() {
    if (this.isPracticeComplete || this.currentPly >= this.validMoves.length) {
      return;
    }

    const expectedStep = this.validMoves[this.currentPly];
    if (expectedStep.color !== this.playerColor) {
      this.isLockedForOpponent = true;
      this.render();

      const executeOpponentStep = () => {
        if (this.isPracticeComplete || this.currentPly >= this.validMoves.length) return;
        const oppStep = this.validMoves[this.currentPly];
        const moveRes = this.chess.move(oppStep.san);
        if (moveRes) {
          this.lastMove = { from: moveRes.from, to: moveRes.to };
          this.currentPly += 1;
        }
        this.isLockedForOpponent = false;
        this.hintStage = 0;
        this.hintSquares = [];

        if (this.currentPly >= this.validMoves.length) {
          this._completePractice();
          return;
        }

        const oppPrefix =
          oppStep.color === 'white'
            ? `${oppStep.moveNumber}. ${oppStep.san}`
            : `${oppStep.moveNumber}... ${oppStep.san}`;
        this.feedback = {
          type: 'info',
          message: `Lawan memainkan ${oppPrefix}. Sekarang giliran Anda menemukan langkah berikutnya dalam variasi!`
        };
        this.render();
        if (typeof this.callbacks.onStateChange === 'function') {
          this.callbacks.onStateChange(this.getPracticeState());
        }
      };

      if (this.replyDelayMs === 0) {
        executeOpponentStep();
      } else {
        this._replyTimeout = setTimeout(executeOpponentStep, this.replyDelayMs);
      }
    }
  }

  /**
   * Sistem Petunjuk (Hint) Bertahap 3 Level (Bagian 6):
   * - Hint 1: Gambaran umum ide langkah.
   * - Hint 2: Highlight bidak yang perlu diperhatikan (petak asal).
   * - Hint 3: Tampilkan petak tujuan jika pengguna masih kesulitan.
   */
  showHint() {
    if (this.isPracticeComplete || this.currentPly >= this.validMoves.length) {
      this.feedback = {
        type: 'info',
        message: 'Variasi latihan telah selesai! Anda dapat mengulangi latihan atau memilih opening berikutnya.'
      };
      this.render();
      return null;
    }

    if (this.isLockedForOpponent || this.chess.turn() !== this.playerTurnChar) {
      return null;
    }

    const expectedStep = this.validMoves[this.currentPly];
    const nextStage = Math.min(3, this.hintStage + 1);

    if (nextStage > this.hintStage) {
      this.hintStage = nextStage;
      this.hintsUsed += 1;
    }

    const pieceName = PIECE_NAMES_ID[expectedStep.piece] || 'Bidak';

    if (this.hintStage === 1) {
      this.hintSquares = [];
      this.feedback = {
        type: 'hint',
        message: `Petunjuk 1 (Ide Langkah): ${expectedStep.idea}`
      };
    } else if (this.hintStage === 2) {
      this.hintSquares = [expectedStep.from];
      this.selectedSquare = expectedStep.from;
      this.legalMovesForSelected = this.chess.moves({ square: expectedStep.from, verbose: true });
      this.feedback = {
        type: 'hint',
        message: `Petunjuk 2 (Bidak Asal): Perhatikan ${pieceName} di petak ${expectedStep.from}. (${expectedStep.idea})`
      };
    } else {
      this.hintSquares = [expectedStep.from, expectedStep.to];
      this.selectedSquare = expectedStep.from;
      this.legalMovesForSelected = this.chess.moves({ square: expectedStep.from, verbose: true });
      this.feedback = {
        type: 'hint',
        message: `Petunjuk 3 (Petak Tujuan): Gerakkan ${pieceName} dari petak ${expectedStep.from} menuju petak ${expectedStep.to} (${expectedStep.san}).`
      };
    }

    this.render();

    if (typeof this.callbacks.onHintUsed === 'function') {
      this.callbacks.onHintUsed({
        hintStage: this.hintStage,
        hintsUsed: this.hintsUsed,
        expectedStep,
        state: this.getPracticeState()
      });
    }
    if (typeof this.callbacks.onStateChange === 'function') {
      this.callbacks.onStateChange(this.getPracticeState());
    }

    return {
      hintStage: this.hintStage,
      hintsUsed: this.hintsUsed,
      hintSquares: [...this.hintSquares],
      expectedStep
    };
  }

  /**
   * Mengeksekusi dan memvalidasi langkah pemain menggunakan Chess.js.
   * Membedakan antara:
   * - Langkah ilegal (melanggar aturan catur)
   * - Langkah legal tetapi bukan bagian dari variasi latihan (dibatalkan/undo + pesan sopan)
   * - Langkah benar sesuai variasi latihan
   */
  submitPlayerMove(moveInput) {
    if (this.isPracticeComplete || this.isLockedForOpponent) {
      return { valid: false, reason: 'locked' };
    }

    if (this.chess.turn() !== this.playerTurnChar) {
      return { valid: false, reason: 'not_player_turn' };
    }

    const expectedStep = this.validMoves[this.currentPly];
    if (!expectedStep) {
      return { valid: false, reason: 'no_expected_step' };
    }

    // 1. Validasi aturan catur menggunakan Chess.js
    const moveResult = this.chess.move(moveInput);
    if (!moveResult) {
      this.feedback = {
        type: 'warning',
        message:
          'Langkah tersebut tidak sah menurut aturan catur. Pilih bidak Anda dan klik petak yang memiliki indikator langkah legal.'
      };
      this.render();
      return {
        valid: false,
        isLegalChessMove: false,
        isVariationMove: false,
        reason: 'illegal_move'
      };
    }

    this.selectedSquare = null;
    this.legalMovesForSelected = [];

    const playedUci = `${moveResult.from}${moveResult.to}${moveResult.promotion || ''}`;
    const isVariationMatch =
      moveResult.san === expectedStep.san ||
      moveResult.san.replace(/[+#]$/, '') === expectedStep.san.replace(/[+#]$/, '') ||
      playedUci === expectedStep.uci;

    // 2. Langkah legal menurut aturan catur, tetapi BUKAN bagian dari variasi latihan
    if (!isVariationMatch) {
      const playedSan = moveResult.san;
      // Kembalikan ke posisi sebelumnya tanpa merusak state papan
      this.chess.undo();
      this.wrongMoves += 1;

      this.feedback = {
        type: 'warning',
        message: `Langkah ${playedSan} adalah langkah catur yang sah, tetapi bukan bagian dari variasi "${this.opening.name}" yang sedang dilatih. Posisi telah dikembalikan — silakan coba lagi atau gunakan tombol Petunjuk.`
      };
      this.render();

      if (typeof this.callbacks.onWrongMove === 'function') {
        this.callbacks.onWrongMove({
          playedSan,
          playedUci,
          expectedSan: expectedStep.san,
          wrongMoves: this.wrongMoves,
          state: this.getPracticeState()
        });
      }
      if (typeof this.callbacks.onStateChange === 'function') {
        this.callbacks.onStateChange(this.getPracticeState());
      }

      return {
        valid: false,
        isLegalChessMove: true,
        isVariationMove: false,
        playedSan,
        expectedSan: expectedStep.san,
        reason: 'not_in_variation'
      };
    }

    // 3. Langkah benar sesuai variasi latihan!
    this.lastMove = { from: moveResult.from, to: moveResult.to };
    this.correctMoves += 1;
    this.currentPly += 1;
    this.hintStage = 0;
    this.hintSquares = [];

    this.feedback = {
      type: 'success',
      message: `Tepat (${moveResult.san})! ${expectedStep.idea}`
    };

    if (typeof this.callbacks.onMoveCorrect === 'function') {
      this.callbacks.onMoveCorrect({
        move: moveResult,
        step: expectedStep,
        state: this.getPracticeState()
      });
    }

    if (this.currentPly >= this.validMoves.length) {
      this._completePractice();
      return {
        valid: true,
        isLegalChessMove: true,
        isVariationMove: true,
        playedSan: moveResult.san,
        completed: true
      };
    }

    this.render();
    if (typeof this.callbacks.onStateChange === 'function') {
      this.callbacks.onStateChange(this.getPracticeState());
    }

    // Jalankan balasan lawan otomatis berdasarkan variasi
    this._checkAndRunOpponentTurn();

    return {
      valid: true,
      isLegalChessMove: true,
      isVariationMove: true,
      playedSan: moveResult.san,
      completed: this.isPracticeComplete
    };
  }

  _completePractice() {
    this.isPracticeComplete = true;
    this.isLockedForOpponent = false;
    this.selectedSquare = null;
    this.legalMovesForSelected = [];
    this.hintSquares = [];

    const practiceState = this.getPracticeState();
    const isMasteredClean = this.wrongMoves === 0 && this.hintsUsed === 0;

    this.feedback = {
      type: 'success',
      message: isMasteredClean
        ? `Luar biasa! Anda menyelesaikan seluruh urutan variasi "${this.opening.name}" tanpa kesalahan dan tanpa petunjuk.`
        : `Latihan selesai! Anda telah menuntaskan urutan langkah variasi "${this.opening.name}".`
    };

    this.render();

    if (typeof this.callbacks.onStateChange === 'function') {
      this.callbacks.onStateChange(practiceState);
    }
    if (typeof this.callbacks.onPracticeComplete === 'function') {
      this.callbacks.onPracticeComplete(practiceState);
    }
  }

  _handleSquareClick(square) {
    if (this.isPracticeComplete || this.isLockedForOpponent || this.pendingPromotion) return;
    if (this.chess.turn() !== this.playerTurnChar) return;

    const clickedPiece = this.chess.get(square);
    if (clickedPiece) {
      const colorName = clickedPiece.color === WHITE ? 'Putih' : 'Hitam';
      const pieceName = PIECE_NAMES_ID[clickedPiece.type] || clickedPiece.type;
      this.inspectedSquareInfo = `Petak ${square}: ${pieceName} ${colorName}`;
    } else {
      this.inspectedSquareInfo = `Petak ${square}: Kosong`;
    }

    if (this.selectedSquare && this.selectedSquare !== square) {
      const candidateMoves = this.legalMovesForSelected.filter(m => m.to === square);
      if (candidateMoves.length > 0) {
        const isPromotion = candidateMoves.some(m => Boolean(m.promotion));
        if (isPromotion) {
          this.pendingPromotion = { from: this.selectedSquare, to: square };
          this.render();
          return;
        }
        this.submitPlayerMove({ from: this.selectedSquare, to: square });
        return;
      }

      // Jika pengguna mengklik petak yang bukan langkah legal bagi bidak yang sedang dipilih
      // dan bukan memilih bidak kawan lain, validasikan via submitPlayerMove untuk umpan balik langkah ilegal
      if (!clickedPiece || clickedPiece.color !== this.playerTurnChar) {
        this.submitPlayerMove({ from: this.selectedSquare, to: square });
        return;
      }
    }

    if (clickedPiece && clickedPiece.color === this.playerTurnChar) {
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
    this.submitPlayerMove({ from, to, promotion: promoPiece });
  }

  render() {
    if (!this.container) return;

    const turn = this.chess.turn();
    const turnText = turn === WHITE ? 'Giliran Putih' : 'Giliran Hitam';
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

    for (let visualRowIdx = 0; visualRowIdx < 8; visualRowIdx += 1) {
      const r = rowIndices[visualRowIdx];
      for (let visualColIdx = 0; visualColIdx < 8; visualColIdx += 1) {
        const c = colIndices[visualColIdx];
        const sq = FILES[c] + RANKS[r];
        const isLight = (r + c) % 2 === 0;
        const piece = boardState[r][c];
        const isSelected = this.selectedSquare === sq;
        const isLastMove =
          this.lastMove && (this.lastMove.from === sq || this.lastMove.to === sq);
        const isHintHighlight = hintSet.has(sq);
        const legalMove = legalTargetMap.get(sq);
        const showRankLabel = visualColIdx === 0;
        const showFileLabel = visualRowIdx === 7;

        const classes = [
          'chess-square',
          isLight ? 'square-light' : 'square-dark',
          isSelected ? 'square-selected' : '',
          isLastMove ? 'square-last-move' : '',
          isHintHighlight ? 'square-hint-highlight' : '',
          piece ? 'has-piece' : ''
        ]
          .filter(Boolean)
          .join(' ');

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
            piece.color === this.playerTurnChar &&
            turn === this.playerTurnChar &&
            !this.isLockedForOpponent &&
            !this.isPracticeComplete &&
            !this.pendingPromotion
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

    const historySan = this.chess.history();
    let statusBadgeHtml = '';
    if (this.isPracticeComplete) {
      statusBadgeHtml = `<span class="board-state-badge badge-success" data-testid="opening-practice-status-badge">${UI_ICONS.check} Variasi Selesai</span>`;
    } else if (this.isLockedForOpponent) {
      statusBadgeHtml = `<span class="board-state-badge badge-step" data-testid="opening-practice-status-badge">Lawan Melangkah...</span>`;
    } else {
      statusBadgeHtml = `<span class="board-state-badge badge-step" data-testid="opening-practice-status-badge">Langkah Anda (${this.correctMoves + 1} / ${this.totalPlayerMovesInVariation})</span>`;
    }

    const hintBtnLabel =
      this.hintStage === 0
        ? 'Petunjuk (1/3: Ide)'
        : this.hintStage === 1
        ? 'Petunjuk (2/3: Bidak)'
        : this.hintStage === 2
        ? 'Petunjuk (3/3: Petak)'
        : 'Petunjuk Maksimal (3/3)';

    this.container.innerHTML = `
      <div class="chessboard-widget opening-practice-board-widget" data-testid="opening-practice-board">
        <div class="chessboard-topbar">
          <div class="turn-indicator" data-turn="${turn}">
            <span class="turn-dot ${turn === WHITE ? 'dot-white' : 'dot-black'}"></span>
            <span class="turn-label">${turnText}</span>
          </div>
          <div class="board-status-badges">
            ${statusBadgeHtml}
          </div>
        </div>

        <div class="chessboard-frame">
          <div class="chessboard-grid" role="grid" aria-label="Papan Catur Latihan Opening">
            ${squaresHtml}
          </div>
        </div>

        <div class="chessboard-coord-statusbar">
          <span class="coord-inspector-text">${this.inspectedSquareInfo}</span>
          <span class="move-history-pill" data-testid="opening-practice-san-pill">
             langkah: ${historySan.length > 0 ? historySan.join(' → ') : 'Posisi Awal'}
          </span>
        </div>

        <div class="chessboard-feedback feedback-${this.feedback.type}" role="status" data-testid="opening-practice-feedback">
          <div class="feedback-content">
            <strong>${
              this.feedback.type === 'success'
                ? 'Langkah Benar:'
                : this.feedback.type === 'warning'
                ? 'Perhatikan:'
                : this.feedback.type === 'hint'
                ? 'Petunjuk Latihan:'
                : 'Instruksi:'
            }</strong>
            <span>${this.feedback.message}</span>
          </div>
        </div>

        <div class="chessboard-controls opening-practice-controls">
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="practice-restart"
            data-testid="opening-practice-restart-btn"
          >
            ${UI_ICONS.restart}
            <span>Ulangi dari Awal</span>
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="practice-hint"
            data-testid="opening-practice-hint-btn"
            ${this.isPracticeComplete || this.isLockedForOpponent ? 'disabled' : ''}
          >
            ${UI_ICONS.hint}
            <span>${hintBtnLabel}</span>
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            data-action="practice-flip"
            data-testid="opening-practice-flip-btn"
          >
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
          p.color !== this.playerTurnChar ||
          this.chess.turn() !== this.playerTurnChar ||
          this.isLockedForOpponent ||
          this.isPracticeComplete ||
          this.pendingPromotion
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

    const restartBtn = this.container.querySelector('[data-action="practice-restart"]');
    if (restartBtn) {
      restartBtn.addEventListener('click', () => this.restart());
    }

    const hintBtn = this.container.querySelector('[data-action="practice-hint"]');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => this.showHint());
    }

    const flipBtn = this.container.querySelector('[data-action="practice-flip"]');
    if (flipBtn) {
      flipBtn.addEventListener('click', () => this.flipBoard());
    }
  }
}

export default InteractiveChessboard;
