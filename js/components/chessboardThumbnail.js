/**
 * Chessboard Thumbnail Component — Caturan MVP 5.6
 *
 * Komponen ringan untuk merender miniatur papan catur (SVG 64 petak + bidak)
 * berdasarkan string FEN posisi akhir pertandingan catur.
 *
 * Karakteristik:
 * 1. 100% SVG murni tanpa Worker, tanpa Stockfish engine, tanpa dependensi audio/motion.
 * 2. Menggunakan CSS variables Caturan (--board-light-sq, --board-dark-sq, dll) sehingga
 *    otomatis merespons pergantian Light Mode & Dark Mode tanpa reload halaman.
 * 3. Menjaga rasio 1:1, sudut membulat, dan tidak dapat dimainkan/diinteraksi.
 * 4. Mendukung rekonstruksi posisi akhir mainline dari PGN secara aman (mengabaikan RAV).
 */

import { Chess, DEFAULT_POSITION } from '../vendor/chess.js';
import { PIECE_SVGS } from './icons.js';
import { validateAndParsePgn } from '../services/pgnService.js';

// Cache in-memory untuk FEN akhir dari PGN agar tidak berulang kali mem-parse PGN yang sama
const pgnFinalFenCache = new Map();

/**
 * Mengekstrak atau merekonstruksi FEN posisi akhir mainline dari PGN atau snapshot
 * @param {string} pgnText - Teks PGN lengkap
 * @param {Object} [reviewSnapshot] - Objek snapshot review jika tersedia
 * @returns {string|null} FEN string posisi akhir atau null jika tidak dapat direkonstruksi
 */
export function extractFinalFenFromPgn(pgnText, reviewSnapshot = null) {
  // 1. Prioritas 1: Ambil finalFen dari snapshot jika tersedia
  if (reviewSnapshot && typeof reviewSnapshot === 'object') {
    if (reviewSnapshot.finalFen && typeof reviewSnapshot.finalFen === 'string' && reviewSnapshot.finalFen.trim()) {
      return reviewSnapshot.finalFen.trim();
    }
    if (Array.isArray(reviewSnapshot.positions) && reviewSnapshot.positions.length > 0) {
      const lastPos = reviewSnapshot.positions[reviewSnapshot.positions.length - 1];
      if (lastPos && lastPos.fen && typeof lastPos.fen === 'string' && lastPos.fen.trim()) {
        return lastPos.fen.trim();
      }
    }
  }

  // 2. Prioritas 2: Rekonstruksi dari PGN tersimpan
  if (!pgnText || typeof pgnText !== 'string' || !pgnText.trim()) {
    return null;
  }

  const cacheKey = pgnText.trim();
  if (pgnFinalFenCache.has(cacheKey)) {
    return pgnFinalFenCache.get(cacheKey);
  }

  try {
    const parsed = validateAndParsePgn(pgnText, { allowVariations: true });
    if (parsed && parsed.ok && parsed.data) {
      const fen = parsed.data.finalFen || (parsed.data.positions && parsed.data.positions.length > 0 ? parsed.data.positions[parsed.data.positions.length - 1]?.fen : null);
      if (fen) {
        pgnFinalFenCache.set(cacheKey, fen);
        return fen;
      }
    } else if (parsed && parsed.finalFen) {
      pgnFinalFenCache.set(cacheKey, parsed.finalFen);
      return parsed.finalFen;
    }
  } catch (err) {
    console.warn('[chessboardThumbnail] Gagal parse PGN dengan validateAndParsePgn:', err?.message || err);
  }

  // Fallback engine parser catur chess.js (chess.js v1.x menggunakan load_pgn atau load)
  try {
    const chess = new Chess();
    if (typeof chess.load_pgn === 'function') {
      chess.load_pgn(pgnText);
    } else if (typeof chess.loadPgn === 'function') {
      chess.loadPgn(pgnText);
    }
    const fen = chess.fen();
    if (fen && fen !== DEFAULT_POSITION) {
      pgnFinalFenCache.set(cacheKey, fen);
      return fen;
    }
  } catch (err) {
    // Abaikan jika fallback chess.js juga tidak dapat mem-parse notasi yang rusak
  }

  return null;
}

/**
 * Parsing penempatan bidak dari string FEN menjadi array 8x8
 * @param {string} fen
 * @returns {Array<Array<{color: string, type: string}|null>>}
 */
export function parseFenToPieceBoard(fen) {
  const board = Array.from({ length: 8 }, () => Array(8).fill(null));
  if (!fen || typeof fen !== 'string') return board;

  const fenPlacement = fen.trim().split(/\s+/)[0];
  const ranks = fenPlacement.split('/');
  if (ranks.length !== 8) return board;

  for (let r = 0; r < 8; r += 1) {
    const rankStr = ranks[r];
    let file = 0;
    for (let i = 0; i < rankStr.length; i += 1) {
      const ch = rankStr[i];
      if (ch >= '1' && ch <= '8') {
        file += parseInt(ch, 10);
      } else {
        const color = ch === ch.toUpperCase() ? 'w' : 'b';
        const type = ch.toLowerCase();
        if (file < 8) {
          board[r][file] = { color, type };
        }
        file += 1;
      }
    }
  }

  return board;
}

/**
 * Merender miniatur papan catur (SVG) berbasis FEN
 * @param {Object} options
 * @param {string} [options.fen] - FEN posisi papan
 * @param {string} [options.pgnText] - Teks PGN alternatif jika FEN tidak diberikan
 * @param {Object} [options.reviewSnapshot] - Objek snapshot
 * @param {number} [options.size] - Ukuran pixel opsional (jika diisi, diterapkan inline style; jika tidak diisi, ukuran diatur penuh oleh class CSS)
 * @param {string} [options.orientation='white'] - Orientasi papan ('white' | 'black')
 * @param {string} [options.className=''] - Tambahan class CSS
 * @returns {string} String HTML/SVG siap render
 */
export function renderChessboardThumbnailHtml({
  fen = null,
  pgnText = null,
  reviewSnapshot = null,
  size = null,
  orientation = 'white',
  className = ''
} = {}) {
  let targetFen = (fen && typeof fen === 'string' && fen.trim()) ? fen.trim() : null;
  if (!targetFen) {
    targetFen = extractFinalFenFromPgn(pgnText, reviewSnapshot);
  }

  const squareSize = 10; // Setiap petak 10x10 unit viewBox (total 80x80)
  const totalViewBox = 80;
  const inlineStyle = typeof size === 'number' ? `style="width:${size}px; height:${size}px;"` : '';
  const clipId = `cb-thumb-clip-${Math.floor(Math.random() * 1000000)}`;

  // Fallback Jujur: Jika posisi akhir sama sekali tidak tersedia atau tidak dapat dibaca,
  // render papan netral 64 petak kosong (tanpa bidak) — JANGAN berpura-pura menampilkan posisi awal (starting position).
  if (!targetFen) {
    let emptySquaresSvg = '';
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const x = c * squareSize;
        const y = r * squareSize;
        const isDark = (r + c) % 2 === 1;
        const fillClass = isDark ? 'cb-thumb-dark-sq' : 'cb-thumb-light-sq';
        emptySquaresSvg += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" class="${fillClass}" opacity="0.6" />`;
      }
    }
    return `
      <div class="chessboard-thumbnail-wrapper cb-thumb-empty-neutral ${className}" ${inlineStyle} aria-hidden="true" title="Posisi akhir tidak tersedia">
        <svg
          viewBox="0 0 ${totalViewBox} ${totalViewBox}"
          class="chessboard-thumbnail-svg"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <clipPath id="${clipId}">
              <rect width="${totalViewBox}" height="${totalViewBox}" rx="6" ry="6" />
            </clipPath>
          </defs>
          <g clip-path="url(#${clipId})">
            <g class="cb-thumb-squares">${emptySquaresSvg}</g>
          </g>
          <rect width="${totalViewBox}" height="${totalViewBox}" rx="6" ry="6" fill="none" class="cb-thumb-border" stroke-width="1.5" stroke-dasharray="3,3" />
        </svg>
      </div>
    `;
  }

  const boardPieces = parseFenToPieceBoard(targetFen);
  const isFlipped = orientation === 'black';

  let squaresSvg = '';
  let piecesSvg = '';

  for (let visualRow = 0; visualRow < 8; visualRow += 1) {
    for (let visualCol = 0; visualCol < 8; visualCol += 1) {
      const x = visualCol * squareSize;
      const y = visualRow * squareSize;

      // Hitung koordinat catur sesungguhnya berdasarkan orientasi
      const rankIdx = isFlipped ? 7 - visualRow : visualRow;
      const fileIdx = isFlipped ? 7 - visualCol : visualCol;

      const isDark = (visualRow + visualCol) % 2 === 1;
      const fillClass = isDark ? 'cb-thumb-dark-sq' : 'cb-thumb-light-sq';

      squaresSvg += `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" class="${fillClass}" />`;

      const piece = boardPieces[rankIdx][fileIdx];
      if (piece) {
        const pieceKey = `${piece.color}${piece.type.toUpperCase()}`;
        const rawPieceSvg = PIECE_SVGS[pieceKey];
        if (rawPieceSvg) {
          // Ekstrak inner content SVG dari PIECE_SVGS dan bungkus dalam <g transform="...">
          const innerSvg = rawPieceSvg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
          // Scale 45x45 ke ukuran squareSize (10x10) -> scale(10 / 45) = scale(0.2222)
          piecesSvg += `<g transform="translate(${x}, ${y}) scale(${squareSize / 45})" class="cb-thumb-piece">${innerSvg}</g>`;
        }
      }
    }
  }

  return `
    <div class="chessboard-thumbnail-wrapper ${className}" ${inlineStyle} aria-hidden="true">
      <svg
        viewBox="0 0 ${totalViewBox} ${totalViewBox}"
        class="chessboard-thumbnail-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="${clipId}">
            <rect width="${totalViewBox}" height="${totalViewBox}" rx="6" ry="6" />
          </clipPath>
        </defs>
        <g clip-path="url(#${clipId})">
          <g class="cb-thumb-squares">${squaresSvg}</g>
          <g class="cb-thumb-pieces">${piecesSvg}</g>
        </g>
        <rect width="${totalViewBox}" height="${totalViewBox}" rx="6" ry="6" fill="none" class="cb-thumb-border" stroke-width="1.5" />
      </svg>
    </div>
  `;
}
