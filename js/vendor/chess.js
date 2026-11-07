/**
 * Chess.js - Pustaka Validasi Aturan dan Langkah Catur Standar FIDE
 * Mendukung penuh:
 * - FEN (Forsyth-Edwards Notation) load & export
 * - Langkah legal untuk seluruh bidak (Pion, Kuda, Gajah, Benteng, Menteri, Raja)
 * - Aturan khusus: Castling (Rokade pendek & panjang), En Passant, Pawn Promotion (Promosi Pion)
 * - Deteksi Check (Skak), Checkmate (Skakmat), Stalemate (Pat), Threefold/50-move/Insufficient material
 * - Pin & perlindungan Raja ( langkah yang membiarkan Raja sendiri dalam keadaan skak dilarang )
 * - Notasi SAN (Standard Algebraic Notation) & objek langkah verbose
 */

export const WHITE = 'w';
export const BLACK = 'b';
export const PAWN = 'p';
export const KNIGHT = 'n';
export const BISHOP = 'b';
export const ROOK = 'r';
export const QUEEN = 'q';
export const KING = 'k';

export const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

function coordsToSquare(row, col) {
  if (row < 0 || row > 7 || col < 0 || col > 7) return null;
  return FILES[col] + RANKS[row];
}

function squareToCoords(sq) {
  if (typeof sq !== 'string' || sq.length !== 2) return null;
  const col = FILES.indexOf(sq[0]);
  const row = RANKS.indexOf(sq[1]);
  if (col === -1 || row === -1) return null;
  return { row, col };
}

function swapColor(color) {
  return color === WHITE ? BLACK : WHITE;
}

export class Chess {
  constructor(fen = DEFAULT_POSITION) {
    this._board = Array.from({ length: 8 }, () => Array(8).fill(null));
    this._turn = WHITE;
    this._castling = { w: { k: true, q: true }, b: { k: true, q: true } };
    this._epSquare = null;
    this._halfMoves = 0;
    this._fullMoves = 1;
    this._history = [];
    this.load(fen);
  }

  reset() {
    this.load(DEFAULT_POSITION);
  }

  clear() {
    this._board = Array.from({ length: 8 }, () => Array(8).fill(null));
    this._turn = WHITE;
    this._castling = { w: { k: false, q: false }, b: { k: false, q: false } };
    this._epSquare = null;
    this._halfMoves = 0;
    this._fullMoves = 1;
    this._history = [];
    this._initialFen = DEFAULT_POSITION;
  }

  load(fen) {
    const tokens = fen.trim().split(/\s+/);
    if (tokens.length < 2) {
      throw new Error('FEN tidak valid: ' + fen);
    }

    const position = tokens[0];
    const rows = position.split('/');
    if (rows.length !== 8) {
      throw new Error('FEN harus memiliki 8 baris: ' + fen);
    }

    const newBoard = Array.from({ length: 8 }, () => Array(8).fill(null));

    for (let r = 0; r < 8; r++) {
      let c = 0;
      for (const ch of rows[r]) {
        if (/[1-8]/.test(ch)) {
          c += parseInt(ch, 10);
        } else {
          const color = ch === ch.toUpperCase() ? WHITE : BLACK;
          const type = ch.toLowerCase();
          if (!['p', 'n', 'b', 'r', 'q', 'k'].includes(type) || c > 7) {
            throw new Error('Karakter FEN tidak valid: ' + ch);
          }
          newBoard[r][c] = { type, color, square: coordsToSquare(r, c) };
          c++;
        }
      }
      if (c !== 8) {
        throw new Error('Jumlah kolom FEN pada baris tidak pas 8: ' + fen);
      }
    }

    this._board = newBoard;
    this._turn = tokens[1] === 'b' ? BLACK : WHITE;

    const castlingStr = tokens[2] || '-';
    this._castling = {
      w: { k: castlingStr.includes('K'), q: castlingStr.includes('Q') },
      b: { k: castlingStr.includes('k'), q: castlingStr.includes('q') }
    };

    this._epSquare = tokens[3] && tokens[3] !== '-' ? tokens[3] : null;
    this._halfMoves = parseInt(tokens[4] || '0', 10) || 0;
    this._fullMoves = parseInt(tokens[5] || '1', 10) || 1;
    this._history = [];
    this._initialFen = this.fen();
    return true;
  }

  fen() {
    let empty = 0;
    let fenRows = [];
    for (let r = 0; r < 8; r++) {
      let rowStr = '';
      empty = 0;
      for (let c = 0; c < 8; c++) {
        const piece = this._board[r][c];
        if (!piece) {
          empty++;
        } else {
          if (empty > 0) {
            rowStr += empty;
            empty = 0;
          }
          const ch = piece.color === WHITE ? piece.type.toUpperCase() : piece.type;
          rowStr += ch;
        }
      }
      if (empty > 0) rowStr += empty;
      fenRows.push(rowStr);
    }

    let castling = '';
    if (this._castling.w.k) castling += 'K';
    if (this._castling.w.q) castling += 'Q';
    if (this._castling.b.k) castling += 'k';
    if (this._castling.b.q) castling += 'q';
    if (!castling) castling = '-';

    const ep = this._epSquare || '-';
    return `${fenRows.join('/')} ${this._turn} ${castling} ${ep} ${this._halfMoves} ${this._fullMoves}`;
  }

  board() {
    return this._board.map((row, r) =>
      row.map((cell, c) =>
        cell ? { square: coordsToSquare(r, c), type: cell.type, color: cell.color } : null
      )
    );
  }

  turn() {
    return this._turn;
  }

  get(square) {
    const coords = squareToCoords(square);
    if (!coords) return null;
    const cell = this._board[coords.row][coords.col];
    return cell ? { type: cell.type, color: cell.color, square } : null;
  }

  put(piece, square) {
    const coords = squareToCoords(square);
    if (!coords || !piece || !piece.type || !piece.color) return false;
    this._board[coords.row][coords.col] = {
      type: piece.type.toLowerCase(),
      color: piece.color,
      square
    };
    return true;
  }

  remove(square) {
    const coords = squareToCoords(square);
    if (!coords) return null;
    const existing = this._board[coords.row][coords.col];
    this._board[coords.row][coords.col] = null;
    return existing;
  }

  _findKing(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this._board[r][c];
        if (p && p.type === KING && p.color === color) {
          return { row: r, col: c, square: coordsToSquare(r, c) };
        }
      }
    }
    return null;
  }

  /**
   * Mengecek apakah petak (targetRow, targetCol) diserang oleh pemain dengan warna `attackerColor`
   */
  _isSquareAttacked(targetRow, targetCol, attackerColor) {
    // 1. Serangan pion
    const pawnDir = attackerColor === WHITE ? 1 : -1; // Pion putih berada di baris lebih besar (bawah) menyerang ke atas (row - 1)
    const pawnSourceRow = targetRow + pawnDir;
    if (pawnSourceRow >= 0 && pawnSourceRow <= 7) {
      for (const dc of [-1, 1]) {
        const sc = targetCol + dc;
        if (sc >= 0 && sc <= 7) {
          const p = this._board[pawnSourceRow][sc];
          if (p && p.color === attackerColor && p.type === PAWN) {
            return true;
          }
        }
      }
    }

    // 2. Serangan kuda
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    for (const [dr, dc] of knightOffsets) {
      const r = targetRow + dr;
      const c = targetCol + dc;
      if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
        const p = this._board[r][c];
        if (p && p.color === attackerColor && p.type === KNIGHT) {
          return true;
        }
      }
    }

    // 3. Serangan raja
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = targetRow + dr;
        const c = targetCol + dc;
        if (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
          const p = this._board[r][c];
          if (p && p.color === attackerColor && p.type === KING) {
            return true;
          }
        }
      }
    }

    // 4. Serangan lurus (Benteng & Menteri)
    const orthoDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of orthoDirs) {
      let r = targetRow + dr;
      let c = targetCol + dc;
      while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
        const p = this._board[r][c];
        if (p) {
          if (p.color === attackerColor && (p.type === ROOK || p.type === QUEEN)) {
            return true;
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }

    // 5. Serangan diagonal (Gajah & Menteri)
    const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagDirs) {
      let r = targetRow + dr;
      let c = targetCol + dc;
      while (r >= 0 && r <= 7 && c >= 0 && c <= 7) {
        const p = this._board[r][c];
        if (p) {
          if (p.color === attackerColor && (p.type === BISHOP || p.type === QUEEN)) {
            return true;
          }
          break;
        }
        r += dr;
        c += dc;
      }
    }

    return false;
  }

  isAttacked(square, attackerColor) {
    const coords = squareToCoords(square);
    if (!coords) return false;
    return this._isSquareAttacked(coords.row, coords.col, attackerColor);
  }

  inCheck(color = this._turn) {
    const king = this._findKing(color);
    if (!king) return false;
    return this._isSquareAttacked(king.row, king.col, swapColor(color));
  }

  isCheck() {
    return this.inCheck(this._turn);
  }

  /**
   * Menghasilkan seluruh langkah pseudo-legal untuk warna aktif
   */
  _generatePseudoMoves(filterSquare = null) {
    const moves = [];
    const color = this._turn;
    const enemy = swapColor(color);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this._board[r][c];
        if (!piece || piece.color !== color) continue;

        const fromSq = coordsToSquare(r, c);
        if (filterSquare && filterSquare !== fromSq) continue;

        if (piece.type === PAWN) {
          const dir = color === WHITE ? -1 : 1;
          const startRow = color === WHITE ? 6 : 1;
          const promoRow = color === WHITE ? 0 : 7;

          // Maju 1 langkah
          const nextR = r + dir;
          if (nextR >= 0 && nextR <= 7 && !this._board[nextR][c]) {
            const toSq = coordsToSquare(nextR, c);
            if (nextR === promoRow) {
              for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) {
                moves.push({
                  color, from: fromSq, to: toSq, piece: PAWN,
                  promotion: promo, flags: 'np'
                });
              }
            } else {
              moves.push({
                color, from: fromSq, to: toSq, piece: PAWN, flags: 'n'
              });

              // Maju 2 langkah dari baris awal
              const doubleR = r + dir * 2;
              if (r === startRow && !this._board[doubleR][c]) {
                moves.push({
                  color, from: fromSq, to: coordsToSquare(doubleR, c),
                  piece: PAWN, flags: 'b'
                });
              }
            }
          }

          // Tangkap menyilang & En Passant
          for (const dc of [-1, 1]) {
            const capC = c + dc;
            if (nextR >= 0 && nextR <= 7 && capC >= 0 && capC <= 7) {
              const toSq = coordsToSquare(nextR, capC);
              const target = this._board[nextR][capC];

              if (target && target.color === enemy) {
                if (nextR === promoRow) {
                  for (const promo of [QUEEN, ROOK, BISHOP, KNIGHT]) {
                    moves.push({
                      color, from: fromSq, to: toSq, piece: PAWN,
                      captured: target.type, promotion: promo, flags: 'cp'
                    });
                  }
                } else {
                  moves.push({
                    color, from: fromSq, to: toSq, piece: PAWN,
                    captured: target.type, flags: 'c'
                  });
                }
              } else if (this._epSquare && toSq === this._epSquare) {
                // Pastikan ada pion lawan di sampingnya
                const epPawn = this._board[r][capC];
                if (epPawn && epPawn.color === enemy && epPawn.type === PAWN) {
                  moves.push({
                    color, from: fromSq, to: toSq, piece: PAWN,
                    captured: PAWN, flags: 'e'
                  });
                }
              }
            }
          }
        } else if (piece.type === KNIGHT) {
          const offsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
          ];
          for (const [dr, dc] of offsets) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
              const target = this._board[nr][nc];
              if (!target) {
                moves.push({ color, from: fromSq, to: coordsToSquare(nr, nc), piece: KNIGHT, flags: 'n' });
              } else if (target.color === enemy) {
                moves.push({
                  color, from: fromSq, to: coordsToSquare(nr, nc),
                  piece: KNIGHT, captured: target.type, flags: 'c'
                });
              }
            }
          }
        } else if (piece.type === KING) {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr;
              const nc = c + dc;
              if (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
                const target = this._board[nr][nc];
                if (!target) {
                  moves.push({ color, from: fromSq, to: coordsToSquare(nr, nc), piece: KING, flags: 'n' });
                } else if (target.color === enemy) {
                  moves.push({
                    color, from: fromSq, to: coordsToSquare(nr, nc),
                    piece: KING, captured: target.type, flags: 'c'
                  });
                }
              }
            }
          }

          // Castling (Rokade)
          const homeRow = color === WHITE ? 7 : 0;
          if (r === homeRow && c === 4 && !this._isSquareAttacked(homeRow, 4, enemy)) {
            // Kingside (O-O)
            if (
              this._castling[color].k &&
              !this._board[homeRow][5] &&
              !this._board[homeRow][6] &&
              this._board[homeRow][7] &&
              this._board[homeRow][7].type === ROOK &&
              this._board[homeRow][7].color === color &&
              !this._isSquareAttacked(homeRow, 5, enemy) &&
              !this._isSquareAttacked(homeRow, 6, enemy)
            ) {
              moves.push({
                color, from: fromSq, to: coordsToSquare(homeRow, 6),
                piece: KING, flags: 'k'
              });
            }
            // Queenside (O-O-O)
            if (
              this._castling[color].q &&
              !this._board[homeRow][3] &&
              !this._board[homeRow][2] &&
              !this._board[homeRow][1] &&
              this._board[homeRow][0] &&
              this._board[homeRow][0].type === ROOK &&
              this._board[homeRow][0].color === color &&
              !this._isSquareAttacked(homeRow, 3, enemy) &&
              !this._isSquareAttacked(homeRow, 2, enemy)
            ) {
              moves.push({
                color, from: fromSq, to: coordsToSquare(homeRow, 2),
                piece: KING, flags: 'q'
              });
            }
          }
        } else {
          // Sliding pieces: Bishop, Rook, Queen
          const dirs = [];
          if (piece.type === BISHOP || piece.type === QUEEN) {
            dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
          }
          if (piece.type === ROOK || piece.type === QUEEN) {
            dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
          }
          for (const [dr, dc] of dirs) {
            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nr <= 7 && nc >= 0 && nc <= 7) {
              const target = this._board[nr][nc];
              if (!target) {
                moves.push({
                  color, from: fromSq, to: coordsToSquare(nr, nc),
                  piece: piece.type, flags: 'n'
                });
              } else {
                if (target.color === enemy) {
                  moves.push({
                    color, from: fromSq, to: coordsToSquare(nr, nc),
                    piece: piece.type, captured: target.type, flags: 'c'
                  });
                }
                break;
              }
              nr += dr;
              nc += dc;
            }
          }
        }
      }
    }

    return moves;
  }

  /**
   * Menjalankan langkah pada state internal tanpa menambahkan notasi SAN dulu
   */
  _applyRawMove(move) {
    const from = squareToCoords(move.from);
    const to = squareToCoords(move.to);
    const snapshot = {
      move: { ...move },
      castling: JSON.parse(JSON.stringify(this._castling)),
      epSquare: this._epSquare,
      halfMoves: this._halfMoves,
      fullMoves: this._fullMoves,
      turn: this._turn,
      capturedPiece: this._board[to.row][to.col] ? { ...this._board[to.row][to.col] } : null,
      epCapturedPiece: null,
      epCapturedCoords: null
    };

    const movingPiece = this._board[from.row][from.col];
    this._board[from.row][from.col] = null;

    // En passant capture
    if (move.flags === 'e') {
      const epRow = from.row;
      const epCol = to.col;
      snapshot.epCapturedPiece = { ...this._board[epRow][epCol] };
      snapshot.epCapturedCoords = { row: epRow, col: epCol };
      this._board[epRow][epCol] = null;
    }

    // Castling rook move
    if (move.flags === 'k') {
      const rook = this._board[from.row][7];
      this._board[from.row][7] = null;
      this._board[from.row][5] = { ...rook, square: coordsToSquare(from.row, 5) };
    } else if (move.flags === 'q') {
      const rook = this._board[from.row][0];
      this._board[from.row][0] = null;
      this._board[from.row][3] = { ...rook, square: coordsToSquare(from.row, 3) };
    }

    // Place piece (or promoted piece)
    const finalType = move.promotion ? move.promotion : movingPiece.type;
    this._board[to.row][to.col] = {
      type: finalType,
      color: movingPiece.color,
      square: move.to
    };

    // Update castling rights
    if (movingPiece.type === KING) {
      this._castling[movingPiece.color].k = false;
      this._castling[movingPiece.color].q = false;
    }
    if (movingPiece.type === ROOK) {
      if (move.from === 'h1') this._castling.w.k = false;
      if (move.from === 'a1') this._castling.w.q = false;
      if (move.from === 'h8') this._castling.b.k = false;
      if (move.from === 'a8') this._castling.b.q = false;
    }
    if (move.to === 'h1') this._castling.w.k = false;
    if (move.to === 'a1') this._castling.w.q = false;
    if (move.to === 'h8') this._castling.b.k = false;
    if (move.to === 'a8') this._castling.b.q = false;

    // Update en passant target square
    if (move.flags === 'b') {
      const epRow = (from.row + to.row) / 2;
      this._epSquare = coordsToSquare(epRow, from.col);
    } else {
      this._epSquare = null;
    }

    // Update clocks
    if (movingPiece.type === PAWN || move.captured) {
      this._halfMoves = 0;
    } else {
      this._halfMoves++;
    }

    if (this._turn === BLACK) {
      this._fullMoves++;
    }

    this._turn = swapColor(this._turn);
    return snapshot;
  }

  _revertRawMove(snapshot) {
    const { move } = snapshot;
    const from = squareToCoords(move.from);
    const to = squareToCoords(move.to);

    this._turn = snapshot.turn;
    this._castling = snapshot.castling;
    this._epSquare = snapshot.epSquare;
    this._halfMoves = snapshot.halfMoves;
    this._fullMoves = snapshot.fullMoves;

    // Kembalikan bidak ke asal
    this._board[from.row][from.col] = {
      type: move.piece,
      color: move.color,
      square: move.from
    };

    // Kembalikan petak tujuan
    this._board[to.row][to.col] = snapshot.capturedPiece;

    // Kembalikan pion en passant jika ada
    if (snapshot.epCapturedCoords) {
      this._board[snapshot.epCapturedCoords.row][snapshot.epCapturedCoords.col] = snapshot.epCapturedPiece;
    }

    // Kembalikan benteng rokade jika ada
    if (move.flags === 'k') {
      const rook = this._board[from.row][5];
      this._board[from.row][5] = null;
      this._board[from.row][7] = { ...rook, square: coordsToSquare(from.row, 7) };
    } else if (move.flags === 'q') {
      const rook = this._board[from.row][3];
      this._board[from.row][3] = null;
      this._board[from.row][0] = { ...rook, square: coordsToSquare(from.row, 0) };
    }
  }

  _generateLegalMoves(filterSquare = null) {
    const pseudo = this._generatePseudoMoves(filterSquare);
    const legal = [];
    const moverColor = this._turn;

    for (const m of pseudo) {
      const snap = this._applyRawMove(m);
      const kingInDanger = this.inCheck(moverColor);
      this._revertRawMove(snap);
      if (!kingInDanger) {
        legal.push(m);
      }
    }
    return legal;
  }

  _moveToSan(move, allLegalMoves) {
    if (move.flags === 'k') {
      return this._appendCheckSymbol('O-O', move);
    }
    if (move.flags === 'q') {
      return this._appendCheckSymbol('O-O-O', move);
    }

    let san = '';
    if (move.piece !== PAWN) {
      san += move.piece.toUpperCase();

      // Disambiguasi jika ada bidak sejenis yang bisa ke petak yang sama
      const ambiguous = allLegalMoves.filter(
        m => m.piece === move.piece && m.to === move.to && m.from !== move.from
      );
      if (ambiguous.length > 0) {
        const sameFile = ambiguous.some(m => m.from[0] === move.from[0]);
        const sameRank = ambiguous.some(m => m.from[1] === move.from[1]);
        if (!sameFile) {
          san += move.from[0];
        } else if (!sameRank) {
          san += move.from[1];
        } else {
          san += move.from;
        }
      }
    } else if (move.captured) {
      san += move.from[0];
    }

    if (move.captured) {
      san += 'x';
    }

    san += move.to;

    if (move.promotion) {
      san += '=' + move.promotion.toUpperCase();
    }

    return this._appendCheckSymbol(san, move);
  }

  _appendCheckSymbol(baseSan, move) {
    const snap = this._applyRawMove(move);
    let suffix = '';
    if (this.inCheck(this._turn)) {
      const replies = this._generateLegalMoves();
      suffix = replies.length === 0 ? '#' : '+';
    }
    this._revertRawMove(snap);
    return baseSan + suffix;
  }

  moves(options = {}) {
    const { square = null, verbose = false } = options;
    const allLegal = this._generateLegalMoves();
    const filtered = square ? allLegal.filter(m => m.from === square) : allLegal;

    return filtered.map(m => {
      const san = this._moveToSan(m, allLegal);
      if (verbose) {
        return {
          ...m,
          san,
          lan: `${m.from}${m.to}${m.promotion || ''}`
        };
      }
      return san;
    });
  }

  /**
   * Mencari objek langkah legal (verbose) dari input string (SAN / LAN / UCI) atau objek { from, to, promotion }
   * tanpa mengubah state papan maupun riwayat permainan.
   */
  _resolveLegalMove(moveInput) {
    if (!moveInput) return null;
    const legalMoves = this.moves({ verbose: true });
    let chosen = null;

    if (typeof moveInput === 'string') {
      const clean = moveInput.trim();
      chosen = legalMoves.find(
        m =>
          m.san === clean ||
          m.san.replace(/[+#]$/, '') === clean.replace(/[+#]$/, '') ||
          m.lan === clean
      );
      if (!chosen && clean.length >= 4) {
        const from = clean.slice(0, 2);
        const to = clean.slice(2, 4);
        const promo = clean[4] ? clean[4].toLowerCase() : undefined;
        chosen = legalMoves.find(
          m => m.from === from && m.to === to && (!m.promotion || m.promotion === (promo || QUEEN))
        );
      }
    } else if (typeof moveInput === 'object') {
      const { from, to, promotion, san } = moveInput;
      if (from && to) {
        chosen = legalMoves.find(
          m =>
            m.from === from &&
            m.to === to &&
            (!m.promotion || m.promotion === (promotion ? promotion.toLowerCase() : QUEEN))
        );
      } else if (typeof san === 'string') {
        const clean = san.trim();
        chosen = legalMoves.find(
          m => m.san === clean || m.san.replace(/[+#]$/, '') === clean.replace(/[+#]$/, '')
        );
      }
    }

    return chosen || null;
  }

  move(moveInput) {
    const chosen = this._resolveLegalMove(moveInput);
    if (!chosen) {
      return null;
    }

    const beforeFen = this.fen();
    const beforeKey = this._positionKey(beforeFen);
    const snapshot = this._applyRawMove(chosen);
    const afterFen = this.fen();
    const afterKey = this._positionKey(afterFen);
    const moveRecord = {
      ...chosen,
      before: beforeFen,
      after: afterFen,
      beforeKey,
      afterKey
    };
    snapshot.moveRecord = moveRecord;
    this._history.push(snapshot);
    return moveRecord;
  }

  undo() {
    if (this._history.length === 0) return null;
    const last = this._history.pop();
    this._revertRawMove(last);
    return last.moveRecord;
  }

  history(options = {}) {
    const { verbose = false } = options;
    return this._history.map(h => (verbose ? h.moveRecord : h.moveRecord.san));
  }

  pgn() {
    if (this._history.length === 0) return '';
    const tokens = [];
    for (let i = 0; i < this._history.length; i++) {
      const snap = this._history[i];
      const san = snap.moveRecord.san;
      if (snap.turn === WHITE) {
        tokens.push(`${snap.fullMoves}. ${san}`);
      } else if (i === 0) {
        tokens.push(`${snap.fullMoves}... ${san}`);
      } else {
        tokens.push(san);
      }
    }
    return tokens.join(' ');
  }

  /**
   * Memeriksa apakah pada state papan saat ini benar-benar terdapat minimal satu
   * langkah tangkapan en passant yang legal (termasuk memvalidasi bahwa langkah tersebut
   * tidak membiarkan Raja sendiri dalam keadaan skak / pin).
   */
  _hasLegalEnPassantCapture() {
    if (!this._epSquare) return false;
    const epCoords = squareToCoords(this._epSquare);
    if (!epCoords) return false;

    const pawnRow = this._turn === WHITE ? epCoords.row + 1 : epCoords.row - 1;
    if (pawnRow < 0 || pawnRow > 7) return false;

    for (const dc of [-1, 1]) {
      const col = epCoords.col + dc;
      if (col < 0 || col > 7) continue;
      const p = this._board[pawnRow][col];
      if (p && p.color === this._turn && p.type === PAWN) {
        const fromSq = coordsToSquare(pawnRow, col);
        const legalFromPawn = this._generateLegalMoves(fromSq);
        if (legalFromPawn.some(m => m.flags === 'e' && m.to === this._epSquare)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Menghasilkan kunci identitas posisi berdasarkan 4 komponen aturan FIDE (Article 9.2.3):
   * 1. Susunan bidak (piece placement)
   * 2. Pemain yang mendapat giliran (turn: w / b)
   * 3. Hak rokade (castling rights: KQkq / -)
   * 4. Hak en passant HANYA JIKA tangkapan en passant benar-benar tersedia secara legal
   *    (bila tidak ada tangkapan en passant legal, dinormalisasi menjadi '-')
   */
  _positionKey(fenStr = this.fen()) {
    if (typeof fenStr !== 'string') return '';
    const trimmed = fenStr.trim();
    if (!trimmed) return '';

    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 2) return '';

    const placement = tokens[0];
    const turn = tokens[1] === 'b' ? BLACK : WHITE;
    const rawCastling = tokens[2] || '-';
    const castling =
      rawCastling === '-'
        ? '-'
        : ['K', 'Q', 'k', 'q'].filter(ch => rawCastling.includes(ch)).join('') || '-';
    const rawEp = tokens[3] && tokens[3] !== '-' ? tokens[3] : '-';

    if (rawEp === '-') {
      return `${placement} ${turn} ${castling} -`;
    }

    // Periksa apakah tangkapan en passant ke rawEp benar-benar legal pada posisi tersebut
    let hasLegalEp = false;
    if (trimmed === this.fen()) {
      hasLegalEp = this._hasLegalEnPassantCapture();
    } else {
      try {
        const probe = new Chess(trimmed);
        hasLegalEp = probe._hasLegalEnPassantCapture();
      } catch {
        hasLegalEp = false;
      }
    }

    const effectiveEp = hasLegalEp ? rawEp : '-';
    return `${placement} ${turn} ${castling} ${effectiveEp}`;
  }

  /**
   * Menghitung berapa kali posisi `targetFen` (default: posisi saat ini) telah muncul
   * sepanjang riwayat permainan, dengan mempertimbangkan susunan bidak, giliran,
   * hak rokade, dan hak en passant yang benar-benar legal.
   */
  getPositionRepetitionCount(targetFen = this.fen()) {
    const targetKey = this._positionKey(targetFen);
    if (!targetKey) return 0;

    const initialFen =
      this._history.length > 0
        ? this._history[0].moveRecord.before
        : this._initialFen || this.fen();

    let count = this._positionKey(initialFen) === targetKey ? 1 : 0;

    for (const h of this._history) {
      const afterFen = h.moveRecord ? h.moveRecord.after : null;
      if (afterFen && this._positionKey(afterFen) === targetKey) {
        count++;
      }
    }

    return count;
  }

  isCheckmate() {
    return this.inCheck(this._turn) && this._generateLegalMoves().length === 0;
  }

  isStalemate() {
    return !this.inCheck(this._turn) && this._generateLegalMoves().length === 0;
  }

  /**
   * Mengevaluasi kelayakan Klaim Remis baik berdasarkan posisi saat ini (`intendedMove == null`)
   * maupun berdasarkan langkah legal yang direncanakan (`intendedMove != null`)
   * TANPA mengubah posisi papan maupun riwayat permainan.
   */
  evaluateDrawClaim(intendedMove = null) {
    if (this.isCheckmate() || this.isAutomaticDraw()) {
      return {
        valid: false,
        mode: intendedMove != null ? 'intended_move' : 'current_position',
        reason: null,
        label: null,
        intendedMove: null
      };
    }

    // 1. Evaluasi klaim berdasarkan langkah yang direncanakan (Intended-Move Draw Claim)
    if (intendedMove !== null && intendedMove !== undefined) {
      const resolvedMove = this._resolveLegalMove(intendedMove);
      if (!resolvedMove) {
        return {
          valid: false,
          mode: 'intended_move',
          reason: 'illegal_intended_move',
          label: null,
          intendedMove: null
        };
      }

      let nextFen = '';
      let nextPosKey = '';
      let nextHalfMoves = 0;
      let nextIsCheckmate = false;

      // Simulasikan langkah secara sementara lalu kembalikan state utuh tanpa memodifikasi _history
      const snap = this._applyRawMove(resolvedMove);
      try {
        nextFen = this.fen();
        nextPosKey = this._positionKey(nextFen);
        nextHalfMoves = this._halfMoves;
        nextIsCheckmate = this.isCheckmate();
      } finally {
        this._revertRawMove(snap);
      }

      // Apabila langkah yang direncanakan menghasilkan Checkmate, Checkmate diutamakan (bukan Draw)
      if (nextIsCheckmate) {
        return {
          valid: false,
          mode: 'intended_move',
          reason: 'checkmate_takes_precedence',
          label: null,
          intendedMove: resolvedMove,
          resultingFen: nextFen,
          resultingPositionKey: nextPosKey,
          halfMoves: nextHalfMoves
        };
      }

      // Hitung berapa kali posisi hasil langkah tersebut sudah pernah muncul sebelumnya + 1 (saat langkah dijalankan)
      const priorOccurrences = this.getPositionRepetitionCount(nextFen);
      const resultingRepetitionCount = priorOccurrences + 1;

      if (resultingRepetitionCount >= 3) {
        return {
          valid: true,
          mode: 'intended_move',
          reason: 'threefold_repetition',
          label: 'Pengulangan Tiga Kali',
          intendedMove: resolvedMove,
          resultingFen: nextFen,
          resultingPositionKey: nextPosKey,
          repetitionCount: resultingRepetitionCount,
          halfMoves: nextHalfMoves
        };
      }

      if (nextHalfMoves >= 100) {
        return {
          valid: true,
          mode: 'intended_move',
          reason: 'fifty_move_rule',
          label: 'Aturan 50 Langkah',
          intendedMove: resolvedMove,
          resultingFen: nextFen,
          resultingPositionKey: nextPosKey,
          repetitionCount: resultingRepetitionCount,
          halfMoves: nextHalfMoves
        };
      }

      return {
        valid: false,
        mode: 'intended_move',
        reason: 'invalid_intended_move_claim',
        label: null,
        intendedMove: resolvedMove,
        resultingFen: nextFen,
        resultingPositionKey: nextPosKey,
        repetitionCount: resultingRepetitionCount,
        halfMoves: nextHalfMoves
      };
    }

    // 2. Evaluasi klaim berdasarkan posisi saat ini yang sudah muncul di papan
    const currentFen = this.fen();
    const currentRepCount = this.getPositionRepetitionCount(currentFen);
    if (currentRepCount >= 3) {
      return {
        valid: true,
        mode: 'current_position',
        reason: 'threefold_repetition',
        label: 'Pengulangan Tiga Kali',
        intendedMove: null,
        resultingFen: currentFen,
        resultingPositionKey: this._positionKey(currentFen),
        repetitionCount: currentRepCount,
        halfMoves: this._halfMoves
      };
    }

    if (this._halfMoves >= 100) {
      return {
        valid: true,
        mode: 'current_position',
        reason: 'fifty_move_rule',
        label: 'Aturan 50 Langkah',
        intendedMove: null,
        resultingFen: currentFen,
        resultingPositionKey: this._positionKey(currentFen),
        repetitionCount: currentRepCount,
        halfMoves: this._halfMoves
      };
    }

    return {
      valid: false,
      mode: 'current_position',
      reason: null,
      label: null,
      intendedMove: null,
      resultingFen: currentFen,
      repetitionCount: currentRepCount,
      halfMoves: this._halfMoves
    };
  }

  /**
   * Mengembalikan daftar seluruh langkah legal pada giliran saat ini yang dapat digunakan
   * untuk mengajukan Klaim Remis berdasarkan langkah yang direncanakan (Intended-Move Draw Claim).
   */
  getClaimableIntendedMoves() {
    if (this.isCheckmate() || this.isAutomaticDraw()) return [];
    const legalMoves = this.moves({ verbose: true });
    const claimable = [];
    for (const m of legalMoves) {
      const ev = this.evaluateDrawClaim(m);
      if (ev.valid) {
        claimable.push({
          ...m,
          claimReason: ev.reason,
          claimLabel: ev.label,
          repetitionCount: ev.repetitionCount,
          halfMoves: ev.halfMoves
        });
      }
    }
    return claimable;
  }

  /**
   * Threefold Repetition:
   * - Tanpa parameter: posisi saat ini telah muncul sedikitnya 3 kali.
   * - Dengan `intendedMove`: langkah legal yang direncanakan akan membuat posisi yang sama muncul minimal 3 kali.
   * Tidak otomatis mengakhiri permainan; memberikan hak Klaim Remis kepada pemain.
   */
  isThreefoldRepetition(intendedMove = null) {
    if (intendedMove !== null && intendedMove !== undefined) {
      const ev = this.evaluateDrawClaim(intendedMove);
      return Boolean(ev.valid && ev.reason === 'threefold_repetition');
    }
    if (this.isCheckmate()) return false;
    return this.getPositionRepetitionCount(this.fen()) >= 3;
  }

  /**
   * Fivefold Repetition: posisi saat ini telah muncul sedikitnya 5 kali.
   * Otomatis mengakhiri permainan sebagai Remis Otomatis (kecuali langkah tersebut Checkmate).
   */
  isFivefoldRepetition() {
    if (this.isCheckmate()) return false;
    return this.getPositionRepetitionCount(this.fen()) >= 5;
  }

  /**
   * Fifty-Move Rule:
   * - Tanpa parameter: 50 langkah oleh masing-masing pemain (100 halfmove) telah tercapai.
   * - Dengan `intendedMove`: langkah legal yang direncanakan akan mencapai minimal 100 halfmoves.
   * Tidak otomatis mengakhiri permainan; memberikan hak Klaim Remis kepada pemain.
   */
  isFiftyMoveRule(intendedMove = null) {
    if (intendedMove !== null && intendedMove !== undefined) {
      const ev = this.evaluateDrawClaim(intendedMove);
      return Boolean(ev.valid && ev.reason === 'fifty_move_rule');
    }
    return !this.isCheckmate() && this._halfMoves >= 100;
  }

  isFiftyMoves(intendedMove = null) {
    return this.isFiftyMoveRule(intendedMove);
  }

  /**
   * Seventy-Five-Move Rule: 75 langkah oleh masing-masing pemain (150 halfmove) tanpa langkah pion atau tangkapan.
   * Otomatis mengakhiri permainan sebagai Remis Otomatis.
   * Apabila langkah ke-75 menghasilkan Checkmate, Checkmate selalu diutamakan (!this.isCheckmate()).
   */
  isSeventyFiveMoveRule() {
    return !this.isCheckmate() && this._halfMoves >= 150;
  }

  isSeventyFiveMoves() {
    return this.isSeventyFiveMoveRule();
  }

  isInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this._board[r][c];
        if (p && p.type !== KING) {
          pieces.push({ ...p, row: r, col: c });
        }
      }
    }
    if (pieces.length === 0) return true; // K vs K
    if (pieces.length === 1 && (pieces[0].type === KNIGHT || pieces[0].type === BISHOP)) {
      return true; // K+N vs K atau K+B vs K
    }
    // K+B vs K+B dengan seluruh gajah berada pada warna petak yang sama
    if (pieces.length >= 2 && pieces.every(p => p.type === BISHOP)) {
      const firstSquareColor = (pieces[0].row + pieces[0].col) % 2;
      if (pieces.every(p => (p.row + p.col) % 2 === firstSquareColor)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Memeriksa apakah permainan memenuhi syarat Remis Otomatis:
   * - Stalemate
   * - Fivefold Repetition (Pengulangan Lima Kali)
   * - Seventy-Five-Move Rule (Aturan 75 Langkah)
   * - Insufficient Material (Materi Tidak Cukup)
   * Catatan: Checkmate selalu diutamakan di atas aturan remis.
   */
  isAutomaticDraw() {
    if (this.isCheckmate()) return false;
    return (
      this.isStalemate() ||
      this.isFivefoldRepetition() ||
      this.isSeventyFiveMoveRule() ||
      this.isInsufficientMaterial()
    );
  }

  /**
   * Memeriksa apakah pemain saat ini berhak mengajukan Klaim Remis
   * (baik berdasarkan posisi saat ini maupun berdasarkan `intendedMove` apabila diberikan)
   */
  canClaimDraw(intendedMove = null) {
    return this.evaluateDrawClaim(intendedMove).valid;
  }

  /**
   * Mengembalikan alasan Klaim Remis yang aktif ('threefold_repetition' | 'fifty_move_rule' | null)
   */
  getClaimableDrawReason(intendedMove = null) {
    const ev = this.evaluateDrawClaim(intendedMove);
    return ev.valid ? ev.reason : null;
  }

  isDraw() {
    return this.isAutomaticDraw();
  }

  isGameOver() {
    return this.isCheckmate() || this.isAutomaticDraw();
  }
}

export default Chess;
