/**
 * PGN Parser & Validation Service — Caturan MVP 5.1 (Chess Analysis Studio)
 *
 * Bertanggung jawab untuk:
 * 1. Memvalidasi file .pgn (ekstensi, ukuran maksimal 2 MB, deteksi file kosong/biner).
 * 2. Memvalidasi teks PGN (deteksi input kosong, PGN terpotong, multiple games).
 * 3. Mem-parsing dan memvalidasi header/tag PGN ([Event], [Site], [Date], [White], [Black], [Result], [FEN], [SetUp]).
 * 4. Mendukung komentar ({...} dan ;...) serta Numeric Annotation Glyphs (NAG: $1..$255 dan !, ?, !!, ??, !?, ?!).
 * 5. Mendeteksi variasi bercabang (...) dan memberikan pesan keterbatasan yang jujur tanpa membuang data secara diam-diam.
 * 6. Memvalidasi urutan notasi SAN dan legalitas seluruh langkah secara berurutan menggunakan Chess.js.
 * 7. Memvalidasi konsistensi hasil pertandingan (Result tag & token terminasi akhir).
 * 8. Menghasilkan struktur partai tervalidasi lengkap (metadata dengan fallback aman, daftar ply, pasangan langkah,
 *    FEN awal, FEN akhir, posisi per ply, serta PGN ternormalisasi) sepenuhnya di browser tanpa request database.
 */

import { Chess, DEFAULT_POSITION, WHITE } from '../vendor/chess.js';

export const MAX_PGN_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB (2.097.152 byte)

export const PGN_ERROR_CODES = {
  EMPTY_PGN: 'EMPTY_PGN',
  EMPTY_FILE: 'EMPTY_FILE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  INVALID_HEADER: 'INVALID_HEADER',
  INVALID_NOTATION: 'INVALID_NOTATION',
  ILLEGAL_MOVE: 'ILLEGAL_MOVE',
  INVALID_RESULT: 'INVALID_RESULT',
  TRUNCATED_PGN: 'TRUNCATED_PGN',
  MULTIPLE_GAMES: 'MULTIPLE_GAMES',
  UNSUPPORTED_VARIATION: 'UNSUPPORTED_VARIATION',
  PARSER_ERROR: 'PARSER_ERROR'
};

export const VALID_PGN_RESULTS = ['1-0', '0-1', '1/2-1/2', '*'];

export const NAG_MAP = {
  $1: { symbol: '!', label: 'Langkah baik (!)' },
  $2: { symbol: '?', label: 'Langkah kurang tepat (?)' },
  $3: { symbol: '!!', label: 'Langkah sangat kuat / brilian (!!)' },
  $4: { symbol: '??', label: 'Kesalahan besar / blunder (??)' },
  $5: { symbol: '!?', label: 'Langkah menarik (!?)' },
  $6: { symbol: '?!', label: 'Langkah meragukan (?!)' },
  $7: { symbol: '□', label: 'Langkah satu-satunya' },
  $10: { symbol: '=', label: 'Posisi seimbang (=)' },
  $13: { symbol: '∞', label: 'Posisi tidak jelas (∞)' },
  $14: { symbol: '⩲', label: 'Putih sedikit lebih baik (⩲)' },
  $15: { symbol: '⩱', label: 'Hitam sedikit lebih baik (⩱)' },
  $16: { symbol: '±', label: 'Putih unggul jelas (±)' },
  $17: { symbol: '∓', label: 'Hitam unggul jelas (∓)' },
  $18: { symbol: '+-', label: 'Putih unggul menang (+-)' },
  $19: { symbol: '-+', label: 'Hitam unggul menang (-+)' }
};

const SUFFIX_TO_NAG = {
  '!!': '$3',
  '??': '$4',
  '!?': '$5',
  '?!': '$6',
  '!': '$1',
  '?': '$2'
};

const ERROR_TITLES_ID = {
  [PGN_ERROR_CODES.EMPTY_PGN]: 'PGN Kosong',
  [PGN_ERROR_CODES.EMPTY_FILE]: 'File PGN Kosong',
  [PGN_ERROR_CODES.FILE_TOO_LARGE]: 'Ukuran File Melebihi Batas',
  [PGN_ERROR_CODES.INVALID_FILE_TYPE]: 'Format File Tidak Didukung',
  [PGN_ERROR_CODES.INVALID_HEADER]: 'Header PGN Tidak Valid',
  [PGN_ERROR_CODES.INVALID_NOTATION]: 'Format Notasi Tidak Valid',
  [PGN_ERROR_CODES.ILLEGAL_MOVE]: 'Langkah Catur Ilegal',
  [PGN_ERROR_CODES.INVALID_RESULT]: 'Hasil Pertandingan Tidak Valid',
  [PGN_ERROR_CODES.TRUNCATED_PGN]: 'PGN Terpotong atau Tidak Lengkap',
  [PGN_ERROR_CODES.MULTIPLE_GAMES]: 'Partai Lebih dari Satu',
  [PGN_ERROR_CODES.UNSUPPORTED_VARIATION]: 'Format Variasi Belum Didukung',
  [PGN_ERROR_CODES.PARSER_ERROR]: 'Gagal Memproses PGN'
};

// Pola ketat notasi SAN standar FIDE (termasuk rokade, disambiguasi, tangkapan, promosi, skak/skakmat)
const STRICT_SAN_REGEX =
  /^(?:O-O(?:-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h](?:x[a-h])?[1-8](?:=[QRBN])?)[+#]?$/;

// Pola fragmen langkah yang terpotong di akhir input PGN
const TRUNCATED_MOVE_FRAGMENT_REGEX =
  /^(?:[KQRBN]|[KQRBN][a-h]|[KQRBN][1-8]|[KQRBN][a-h]?[1-8]?x|[a-h]x|[a-h][18]=|O-|O-O-|0-|0-0-|1-|0-|1\/2-|1\/2|1\/2-1\/?)$/;

export function formatFileSize(bytes) {
  const num = Number(bytes);
  if (!Number.isFinite(num) || num < 0) return '0 B';
  if (num < 1024) return `${Math.round(num)} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatPgnResultLabel(result) {
  switch (result) {
    case '1-0':
      return '1-0 (Putih Menang)';
    case '0-1':
      return '0-1 (Hitam Menang)';
    case '1/2-1/2':
      return '1/2-1/2 (Remis)';
    case '*':
      return '* (Belum Selesai / Tidak Diketahui)';
    default:
      return 'Tidak diketahui';
  }
}

function getUtf8ByteLength(str) {
  if (typeof str !== 'string') return 0;
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str).length;
  }
  return Buffer.byteLength(str, 'utf8');
}

function createErrorResponse(errorCode, errorMessage, details = null) {
  return {
    ok: false,
    valid: false,
    errorCode,
    errorTitle: ERROR_TITLES_ID[errorCode] || 'Validasi PGN Gagal',
    errorMessage,
    details,
    errorDetails: details,
    data: null
  };
}

function normalizeMetadataValue(rawVal, fallback = 'Tidak diketahui') {
  if (typeof rawVal !== 'string') return fallback;
  const trimmed = rawVal.trim();
  if (!trimmed || trimmed === '?' || trimmed === '??' || /^\?+(\.\?+)+$/.test(trimmed)) {
    return fallback;
  }
  return trimmed;
}

/**
 * Memvalidasi apakah konten teks tampak seperti file biner atau format non-PGN (misal HTML/JSON/PDF/PNG)
 */
function isBinaryOrUnsupportedContent(text) {
  if (typeof text !== 'string') return true;
  // Cek null byte atau karakter kontrol non-teks
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(text)) {
    return true;
  }
  const trimmed = text.trim();
  // Cek signature file non-PGN yang umum salah unggah
  if (
    /^%PDF-/i.test(trimmed) ||
    /^\x89PNG/i.test(trimmed) ||
    /^GIF8[79]a/i.test(trimmed) ||
    /^<!DOCTYPE\s+html/i.test(trimmed) ||
    /^<html[\s>]/i.test(trimmed) ||
    /^<\?xml[\s>]/i.test(trimmed)
  ) {
    return true;
  }
  // Cek jika seluruh isi merupakan objek JSON murni {"key": ...}
  if (/^\{\s*"[^"]+"\s*:[\s\S]*\}$/.test(trimmed)) {
    try {
      JSON.parse(trimmed);
      return true;
    } catch {
      // Bukan JSON, lanjutkan sebagai komentar PGN
    }
  }
  return false;
}

/**
 * Memvalidasi metadata objek File dari input browser sebelum membaca isinya.
 */
export function validatePgnFileMeta(file) {
  if (!file || typeof file !== 'object') {
    return createErrorResponse(
      PGN_ERROR_CODES.INVALID_FILE_TYPE,
      'File tidak ditemukan. Silakan pilih file berekstensi .pgn terlebih dahulu.'
    );
  }

  const fileName = typeof file.name === 'string' ? file.name.trim() : '';
  if (!fileName || !fileName.toLowerCase().endsWith('.pgn')) {
    return createErrorResponse(
      PGN_ERROR_CODES.INVALID_FILE_TYPE,
      `Format file "${fileName || 'tanpa nama'}" tidak didukung. Harap unggah file catur dengan ekstensi .pgn.`
    );
  }

  if (typeof file.size === 'number') {
    if (file.size <= 0) {
      return createErrorResponse(
        PGN_ERROR_CODES.EMPTY_FILE,
        `File "${fileName}" kosong (0 byte). Silakan pilih file .pgn yang berisi notasi permainan catur.`
      );
    }
    if (file.size > MAX_PGN_FILE_SIZE_BYTES) {
      return createErrorResponse(
        PGN_ERROR_CODES.FILE_TOO_LARGE,
        `Ukuran file "${fileName}" (${formatFileSize(file.size)}) melebihi batas maksimal 2 MB.`
      );
    }
  }

  return {
    ok: true,
    valid: true,
    fileName,
    fileSize: typeof file.size === 'number' ? file.size : 0
  };
}

/**
 * Memvalidasi FEN kustom dari tag [FEN] secara menyeluruh menggunakan Chess.js
 */
function validateInitialFenHeader(fenStr) {
  if (typeof fenStr !== 'string' || !fenStr.trim()) {
    return { valid: false, reason: 'String FEN kosong.' };
  }
  const trimmed = fenStr.trim();
  const tokens = trimmed.split(/\s+/);
  if (tokens.length !== 6) {
    return {
      valid: false,
      reason: 'Format FEN harus memiliki 6 bagian (posisi, giliran, rokade, en passant, halfmove, fullmove).'
    };
  }

  if (tokens[1] !== 'w' && tokens[1] !== 'b') {
    return { valid: false, reason: 'Bagian giliran pada FEN harus "w" atau "b".' };
  }

  if (!/^(?:-|K?Q?k?q?)$/.test(tokens[2]) || tokens[2] === '') {
    return { valid: false, reason: 'Bagian hak rokade pada FEN tidak valid.' };
  }

  if (tokens[3] !== '-' && !/^[a-h][36]$/.test(tokens[3])) {
    return { valid: false, reason: 'Petak en passant pada FEN tidak valid.' };
  }

  if (!/^\d+$/.test(tokens[4]) || !/^[1-9]\d*$/.test(tokens[5])) {
    return { valid: false, reason: 'Nilai halfmove atau fullmove pada FEN tidak valid.' };
  }

  let probe;
  try {
    probe = new Chess(trimmed);
  } catch (err) {
    return { valid: false, reason: err?.message || 'Gagal memuat posisi FEN.' };
  }

  // Pastikan terdapat tepat 1 Raja Putih dan 1 Raja Hitam
  const board = probe.board();
  let whiteKings = 0;
  let blackKings = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (p && p.type === 'k') {
        if (p.color === 'w') whiteKings += 1;
        if (p.color === 'b') blackKings += 1;
      }
    }
  }

  if (whiteKings !== 1 || blackKings !== 1) {
    return {
      valid: false,
      reason: 'Posisi FEN harus memiliki tepat satu Raja Putih dan satu Raja Hitam.'
    };
  }

  return { valid: true, fen: probe.fen() };
}

/**
 * Memisahkan bagian Header PGN dan Movetext, serta memvalidasi sintaks tag [NamaTag "Nilai"]
 */
function parseHeadersAndExtractMovetext(normalizedText) {
  const lines = normalizedText.split('\n');
  const headers = {};
  const headerOrder = [];
  const movetextLines = [];
  let inMovetext = false;
  let inMultilineComment = false;

  const singleTagRegex = /^\[([A-Za-z][A-Za-z0-9_]*)\s+"((?:[^"\\]|\\.)*)"\]$/;
  const multiTagGlobalRegex = /\[([A-Za-z][A-Za-z0-9_]*)\s+"((?:[^"\\]|\\.)*)"\]/g;

  for (let idx = 0; idx < lines.length; idx += 1) {
    const rawLine = lines[idx];
    const trimmed = rawLine.trim();

    if (!trimmed) {
      if (inMovetext) {
        movetextLines.push('');
      }
      continue;
    }

    // Baris escape spesifikasi PGN (% di kolom pertama)
    if (!inMultilineComment && rawLine.startsWith('%')) {
      continue;
    }

    if (!inMovetext) {
      // Jika baris dimulai dengan '[' pada area header
      if (trimmed.startsWith('[')) {
        // Cek apakah satu tag tunggal
        const singleMatch = trimmed.match(singleTagRegex);
        if (singleMatch) {
          const key = singleMatch[1];
          const val = singleMatch[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
          headers[key] = val;
          if (!headerOrder.includes(key)) headerOrder.push(key);
          continue;
        }

        // Cek apakah terdapat beberapa tag valid dalam satu baris (mis. [Event "A"] [Site "B"])
        const matches = [...trimmed.matchAll(multiTagGlobalRegex)];
        const reconstructed = matches.map(m => m[0]).join('').replace(/\s+/g, '');
        const compactTrimmed = trimmed.replace(/\s+/g, '');
        if (matches.length > 0 && reconstructed === compactTrimmed) {
          for (const m of matches) {
            const key = m[1];
            const val = m[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            headers[key] = val;
            if (!headerOrder.includes(key)) headerOrder.push(key);
          }
          continue;
        }

        // Jika baris dimulai dengan '[' tetapi tidak ditutup dengan ']' atau tanda kutip ganjil
        const quoteCount = (trimmed.match(/(?<!\\)"/g) || []).length;
        if (!trimmed.endsWith(']') || quoteCount % 2 !== 0) {
          // Cek apakah tidak ada baris langkah setelahnya -> bisa juga header tidak valid / terpotong
          const hasRemainingNonEmpty = lines.slice(idx + 1).some(l => l.trim().length > 0);
          if (!hasRemainingNonEmpty && Object.keys(headers).length === 0) {
            return {
              ok: false,
              errorCode: PGN_ERROR_CODES.INVALID_HEADER,
              errorMessage: `Format header PGN tidak valid atau terpotong pada baris ${idx + 1}: "${trimmed}". Gunakan format standar [NamaTag "Nilai"].`
            };
          }
          return {
            ok: false,
            errorCode: PGN_ERROR_CODES.INVALID_HEADER,
            errorMessage: `Header PGN tidak valid pada baris ${idx + 1}: "${trimmed}". Pastikan tanda kutip dan kurung siku ditutup dengan benar.`
          };
        }

        return {
          ok: false,
          errorCode: PGN_ERROR_CODES.INVALID_HEADER,
          errorMessage: `Format tag header PGN tidak valid pada baris ${idx + 1}: "${trimmed}". Gunakan format [NamaTag "Nilai"].`
        };
      }

      // Cek apakah baris di atas movetext mencoba menulis header tetapi lupa '[' pembuka (misal: Event "Turnamen"])
      if (/^[A-Za-z][A-Za-z0-9_]*\s+"[^"]*"\]$/.test(trimmed)) {
        return {
          ok: false,
          errorCode: PGN_ERROR_CODES.INVALID_HEADER,
          errorMessage: `Header PGN kehilangan kurung siku pembuka '[' pada baris ${idx + 1}: "${trimmed}".`
        };
      }

      // Mulai masuk ke bagian movetext
      inMovetext = true;
    }

    // Di dalam movetext, periksa apakah ada tag header partai kedua di luar komentar {...}
    if (inMovetext) {
      // Lacak status komentar kurung kurawal agar '[...]' di dalam komentar tidak salah dianggap header partai baru
      let lineOutsideComment = '';
      for (let c = 0; c < rawLine.length; c += 1) {
        const ch = rawLine[c];
        if (!inMultilineComment && ch === ';') {
          break; // sisa baris adalah komentar ';'
        }
        if (ch === '{') {
          if (inMultilineComment) {
            // Komentar bersarang tidak valid, akan ditangani di lexer movetext
          }
          inMultilineComment = true;
          continue;
        }
        if (ch === '}') {
          if (inMultilineComment) {
            inMultilineComment = false;
            continue;
          }
        }
        if (!inMultilineComment) {
          lineOutsideComment += ch;
        }
      }

      const trimmedOutside = lineOutsideComment.trim();
      if (trimmedOutside.startsWith('[')) {
        if (singleTagRegex.test(trimmedOutside) || multiTagGlobalRegex.test(trimmedOutside)) {
          return {
            ok: false,
            errorCode: PGN_ERROR_CODES.MULTIPLE_GAMES,
            errorMessage:
              'File atau teks PGN berisi beberapa partai (lebih dari satu partai catur). Pada Caturan MVP 5.1, fitur pemilihan banyak partai belum tersedia — silakan impor satu partai per proses.'
          };
        }
        return {
          ok: false,
          errorCode: PGN_ERROR_CODES.INVALID_HEADER,
          errorMessage: `Ditemukan tag atau kurung siku yang tidak valid di tengah notasi permainan pada baris ${idx + 1}: "${trimmedOutside}".`
        };
      }

      movetextLines.push(rawLine);
    }
  }

  return {
    ok: true,
    headers,
    headerOrder,
    movetext: movetextLines.join('\n')
  };
}

/**
 * Memindai movetext secara leksikal untuk memisahkan token langkah, komentar ({...} & ;...),
 * serta mengekstrak variasi RAV (...) ke dalam struktur variasi terpisah.
 */
function tokenizeMovetext(movetext) {
  const items = [];
  const rawVariations = [];
  let i = 0;
  const len = movetext.length;
  let variationDepth = 0;
  let currentVariationText = '';
  let variationStartPlyIndex = -1;
  let hasVariations = false;

  while (i < len) {
    const ch = movetext[i];

    // Lewati whitespace
    if (/\s/.test(ch)) {
      if (variationDepth > 0) {
        currentVariationText += ch;
      }
      i += 1;
      continue;
    }

    // Komentar kurung kurawal { ... }
    if (ch === '{') {
      const startIdx = i;
      i += 1;
      let commentBody = '';
      let closed = false;
      while (i < len) {
        if (movetext[i] === '}') {
          closed = true;
          i += 1;
          break;
        }
        commentBody += movetext[i];
        i += 1;
      }
      if (!closed) {
        return {
          ok: false,
          errorCode: PGN_ERROR_CODES.TRUNCATED_PGN,
          errorMessage:
            'PGN terpotong atau tidak lengkap: komentar "{" tidak memiliki kurung kurawal penutup "}" hingga akhir teks.',
          offset: startIdx
        };
      }
      if (variationDepth === 0) {
        const cleanComment = commentBody.replace(/\s+/g, ' ').trim();
        if (cleanComment) {
          items.push({ type: 'comment', text: cleanComment, itemIndex: items.length });
        }
      } else {
        currentVariationText += `{${commentBody}}`;
      }
      continue;
    }

    if (ch === '}') {
      return {
        ok: false,
        errorCode: PGN_ERROR_CODES.INVALID_NOTATION,
        errorMessage:
          'Format notasi PGN tidak valid: ditemukan tanda penutup komentar "}" tanpa tanda pembuka "{".'
      };
    }

    // Komentar satu baris ; ... \n
    if (ch === ';') {
      i += 1;
      let lineComment = '';
      while (i < len && movetext[i] !== '\n') {
        lineComment += movetext[i];
        i += 1;
      }
      if (variationDepth === 0) {
        const cleanComment = lineComment.trim();
        if (cleanComment) {
          items.push({ type: 'comment', text: cleanComment });
        }
      } else {
        currentVariationText += ` ;${lineComment}\n`;
      }
      continue;
    }

    // Variasi RAV ( ... )
    if (ch === '(') {
      hasVariations = true;
      if (variationDepth === 0) {
        variationStartPlyIndex = items.length;
        currentVariationText = '';
      } else {
        currentVariationText += '(';
      }
      variationDepth += 1;
      i += 1;
      continue;
    }

    if (ch === ')') {
      if (variationDepth <= 0) {
        return {
          ok: false,
          errorCode: PGN_ERROR_CODES.INVALID_NOTATION,
          errorMessage:
            'Format notasi PGN tidak valid: ditemukan tanda kurung tutup ")" tanpa kurung buka "(" yang sesuai.'
        };
      }
      variationDepth -= 1;
      if (variationDepth === 0) {
        const cleanVar = currentVariationText.trim();
        if (cleanVar) {
          rawVariations.push({
            parentItemIndex: variationStartPlyIndex,
            text: cleanVar
          });
        }
        currentVariationText = '';
        variationStartPlyIndex = -1;
      } else {
        currentVariationText += ')';
      }
      i += 1;
      continue;
    }

    // Jika di dalam variasi, kumpulkan karakter variasi
    if (variationDepth > 0) {
      currentVariationText += ch;
      i += 1;
      continue;
    }

    // Kurung siku di luar komentar di dalam movetext
    if (ch === '[' || ch === ']') {
      return {
        ok: false,
        errorCode: PGN_ERROR_CODES.INVALID_NOTATION,
        errorMessage: `Format notasi PGN tidak valid: ditemukan karakter "${ch}" di dalam urutan langkah.`
      };
    }

    // Kumpulkan token reguler hingga bertemu karakter pemisah
    let token = '';
    while (
      i < len &&
      !/\s/.test(movetext[i]) &&
      !['{', '}', ';', '(', ')', '[', ']'].includes(movetext[i])
    ) {
      token += movetext[i];
      i += 1;
    }

    if (token) {
      items.push({ type: 'token', value: token, itemIndex: items.length });
    }
  }

  if (variationDepth > 0) {
    return {
      ok: false,
      errorCode: PGN_ERROR_CODES.TRUNCATED_PGN,
      errorMessage:
        'PGN terpotong atau tidak lengkap: tanda kurung variasi "(" tidak ditutup dengan ")".'
    };
  }

  return {
    ok: true,
    items,
    hasVariations,
    rawVariations
  };
}

/**
 * Memecah token gabungan nomor langkah + SAN seperti "1.e4" atau "12...Nf6" menjadi token terpisah
 */
function expandRawToken(tokenValue) {
  // Jangan pecah token hasil pertandingan seperti 1-0, 0-1, 1/2-1/2, atau 0-0 / 0-0-0
  if (
    VALID_PGN_RESULTS.includes(tokenValue) ||
    /^0-0(-0)?[+#!?]*$/.test(tokenValue) ||
    /^\d+\/\d+-\d+\/\d+$/.test(tokenValue) ||
    /^\d+-\d+$/.test(tokenValue)
  ) {
    return [tokenValue];
  }

  const attachedMatch = tokenValue.match(/^(\d+\.+)(.+)$/);
  if (attachedMatch) {
    return [attachedMatch[1], attachedMatch[2]];
  }
  return [tokenValue];
}

/**
 * Memisahkan anotasi tradisional di akhir langkah (seperti Nf3!, Qh4??, e4!?) dari string SAN
 */
function extractSanAndTraditionalSuffix(rawMoveToken) {
  let clean = rawMoveToken;
  const extractedNags = [];

  const suffixMatch = clean.match(/(\!\!|\?\?|\!\?|\?\!|\!|\?)+$/);
  if (suffixMatch) {
    const suffixStr = suffixMatch[0];
    clean = clean.slice(0, clean.length - suffixStr.length);
    const glyphMatches = suffixStr.match(/\!\!|\?\?|\!\?|\?\!|\!|\?/g) || [];
    for (const glyph of glyphMatches) {
      if (SUFFIX_TO_NAG[glyph]) {
        extractedNags.push(SUFFIX_TO_NAG[glyph]);
      }
    }
  }

  // Normalisasi rokade yang menggunakan angka nol (0-0 / 0-0-0) menjadi huruf O (O-O / O-O-O)
  if (/^0-0-0([+#])?$/.test(clean)) {
    clean = clean.replace(/^0-0-0/, 'O-O-O');
  } else if (/^0-0([+#])?$/.test(clean)) {
    clean = clean.replace(/^0-0/, 'O-O');
  }

  return {
    sanCandidate: clean,
    suffixNags: extractedNags
  };
}

/**
 * Membangun string PGN yang telah dinormalisasi dari header dan langkah tervalidasi
 */
function buildNormalizedPgn(headers, headerOrder, initialFen, moves, gameComments, result) {
  const standardSevenTagRoster = ['Event', 'Site', 'Date', 'Round', 'White', 'Black', 'Result'];
  const headerLines = [];
  const emittedKeys = new Set();

  const hasAnyOriginalHeader = Object.keys(headers).length > 0;
  if (hasAnyOriginalHeader) {
    for (const key of standardSevenTagRoster) {
      if (headers[key] !== undefined || key === 'Result') {
        const val = key === 'Result' ? result : headers[key];
        if (val !== undefined) {
          const escapedVal = String(val).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
          headerLines.push(`[${key} "${escapedVal}"]`);
          emittedKeys.add(key);
        }
      }
    }
    for (const key of headerOrder) {
      if (!emittedKeys.has(key) && headers[key] !== undefined) {
        const escapedVal = String(headers[key]).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        headerLines.push(`[${key} "${escapedVal}"]`);
        emittedKeys.add(key);
      }
    }
  } else if (initialFen !== DEFAULT_POSITION) {
    headerLines.push('[SetUp "1"]');
    headerLines.push(`[FEN "${initialFen}"]`);
  }

  const moveTokens = [];
  for (const gc of gameComments) {
    moveTokens.push(`{ ${gc.replace(/\}/g, ')')} }`);
  }

  for (let i = 0; i < moves.length; i += 1) {
    const m = moves[i];
    if (m.color === 'w') {
      moveTokens.push(`${m.moveNumber}. ${m.san}`);
    } else if (i === 0 || (moves[i - 1] && moves[i - 1].comments.length > 0)) {
      moveTokens.push(`${m.moveNumber}... ${m.san}`);
    } else {
      moveTokens.push(m.san);
    }

    if (m.nags && m.nags.length > 0) {
      for (const nag of m.nags) {
        moveTokens.push(typeof nag === 'object' ? nag.code : nag);
      }
    }

    if (m.comments && m.comments.length > 0) {
      for (const commentText of m.comments) {
        moveTokens.push(`{ ${commentText.replace(/\}/g, ')')} }`);
      }
    }
  }

  if (result && VALID_PGN_RESULTS.includes(result)) {
    moveTokens.push(result);
  }

  const movetextBody = moveTokens.join(' ').trim();
  if (headerLines.length > 0) {
    return `${headerLines.join('\n')}\n\n${movetextBody}`;
  }
  return movetextBody;
}

/**
 * Fungsi utama untuk memvalidasi dan mem-parsing teks PGN secara menyeluruh.
 * Dapat dipanggil baik oleh fitur Upload PGN File maupun Paste PGN.
 *
 * @param {string} rawPgnText - Konten teks PGN mentah dari pengguna
 * @param {Object} options - Opsi tambahan { source: 'paste' | 'file', fileName, fileSize, allowVariations }
 */

/**
 * Mem-parsing sub-variasi RAV secara rekursif dan memvalidasi legalitas langkah
 */
function parseVariationTree(movetext, startFen) {
  let i = 0;
  const len = movetext.length;
  let variationDepth = 0;
  let currentVariationText = '';
  const items = [];
  const subVariations = [];
  let currentItemIndex = -1;

  while (i < len) {
    const ch = movetext[i];
    if (/\s/.test(ch)) {
      if (variationDepth > 0) currentVariationText += ch;
      i += 1;
      continue;
    }
    if (ch === '{') {
      i += 1;
      let commentBody = '';
      while (i < len && movetext[i] !== '}') {
        commentBody += movetext[i];
        i += 1;
      }
      if (i < len && movetext[i] === '}') i += 1;
      if (variationDepth === 0) {
        items.push({ type: 'comment', text: commentBody.trim() });
      } else {
        currentVariationText += '{' + commentBody + '}';
      }
      continue;
    }
    if (ch === ';') {
      i += 1;
      let lineComment = '';
      while (i < len && movetext[i] !== '\n') {
        lineComment += movetext[i];
        i += 1;
      }
      if (variationDepth === 0) {
        items.push({ type: 'comment', text: lineComment.trim() });
      } else {
        currentVariationText += ' ;' + lineComment + '\n';
      }
      continue;
    }
    if (ch === '(') {
      if (variationDepth === 0) {
        currentItemIndex = items.length;
        currentVariationText = '';
      } else {
        currentVariationText += '(';
      }
      variationDepth += 1;
      i += 1;
      continue;
    }
    if (ch === ')') {
      variationDepth -= 1;
      if (variationDepth === 0) {
        const cleanVar = currentVariationText.trim();
        if (cleanVar) {
          subVariations.push({
            parentItemIndex: currentItemIndex,
            text: cleanVar
          });
        }
        currentVariationText = '';
      } else {
        currentVariationText += ')';
      }
      i += 1;
      continue;
    }
    if (variationDepth > 0) {
      currentVariationText += ch;
      i += 1;
      continue;
    }
    let token = '';
    while (i < len && !/\s/.test(movetext[i]) && !['{', '}', ';', '(', ')', '[', ']'].includes(movetext[i])) {
      token += movetext[i];
      i += 1;
    }
    if (token) {
      items.push({ type: 'token', value: token });
    }
  }

  const chess = new Chess(startFen);
  const moves = [];

  for (let idx = 0; idx < items.length; idx += 1) {
    const item = items[idx];
    if (item.type === 'comment') {
      if (moves.length > 0) {
        moves[moves.length - 1].comments.push(item.text);
      }
      continue;
    }
    const val = item.value;
    if (/^\d+\.+$/.test(val) || /^\d+\.\.\.$/.test(val) || val.startsWith('$') || ['1-0', '0-1', '1/2-1/2', '*'].includes(val)) {
      continue;
    }
    let cleanVal = val.replace(/^\d+\.+/, '');
    cleanVal = cleanVal.replace(/(\!\!|\?\?|\!\?|\?\!|\!|\?)+$/, '');
    if (/^0-0-0([+#])?$/.test(cleanVal)) cleanVal = cleanVal.replace(/^0-0-0/, 'O-O-O');
    else if (/^0-0([+#])?$/.test(cleanVal)) cleanVal = cleanVal.replace(/^0-0/, 'O-O');

    const fenBefore = chess.fen();
    const applied = chess.move(cleanVal);
    if (!applied) {
      break;
    }
    moves.push({
      ply: moves.length + 1,
      san: applied.san,
      fenBefore,
      fenAfter: chess.fen(),
      itemIndex: idx,
      comments: [],
      childVariations: []
    });
  }

  const childVariations = [];
  for (const sv of subVariations) {
    let subFen = startFen;
    let targetMove = null;
    for (let mIdx = moves.length - 1; mIdx >= 0; mIdx -= 1) {
      if (moves[mIdx].itemIndex < sv.parentItemIndex) {
        targetMove = moves[mIdx];
        subFen = moves[mIdx].fenBefore;
        break;
      }
    }
    const childTree = parseVariationTree(sv.text, subFen);
    childTree.parentFen = subFen;
    childTree.rawText = sv.text;
    if (targetMove) {
      targetMove.childVariations.push(childTree);
    }
    childVariations.push(childTree);
  }

  let totalPliesRecursive = moves.length;
  for (const cv of childVariations) {
    totalPliesRecursive += cv.totalPliesRecursive || cv.totalPlies;
  }

  return {
    startFen,
    moves,
    totalPlies: moves.length,
    totalPliesRecursive,
    childVariations,
    variations: childVariations
  };
}

export function validateAndParsePgn(rawPgnText, options = {}) {
  const source = options.source === 'file' ? 'file' : 'paste';
  const fileName = typeof options.fileName === 'string' ? options.fileName.trim() : null;
  const fileSize = typeof options.fileSize === 'number' ? options.fileSize : null;
  const allowVariations = Boolean(options.allowVariations);

  try {
    // 1. Validasi metadata file jika berasal dari upload file
    if (source === 'file') {
      if (fileName !== null && (!fileName || !fileName.toLowerCase().endsWith('.pgn'))) {
        return createErrorResponse(
          PGN_ERROR_CODES.INVALID_FILE_TYPE,
          `Format file "${fileName || 'tanpa nama'}" tidak didukung. Harap pilih file dengan ekstensi .pgn.`
        );
      }
      if (fileSize !== null && fileSize <= 0) {
        return createErrorResponse(
          PGN_ERROR_CODES.EMPTY_FILE,
          `File "${fileName || '.pgn'}" kosong (0 byte). Silakan pilih file PGN yang berisi notasi permainan.`
        );
      }
      if (fileSize !== null && fileSize > MAX_PGN_FILE_SIZE_BYTES) {
        return createErrorResponse(
          PGN_ERROR_CODES.FILE_TOO_LARGE,
          `Ukuran file "${fileName || '.pgn'}" (${formatFileSize(fileSize)}) melebihi batas maksimal 2 MB.`
        );
      }
    }

    if (typeof rawPgnText !== 'string') {
      return createErrorResponse(
        source === 'file' ? PGN_ERROR_CODES.EMPTY_FILE : PGN_ERROR_CODES.EMPTY_PGN,
        source === 'file'
          ? 'File PGN tidak dapat dibaca atau kosong.'
          : 'Konten PGN tidak boleh kosong. Silakan masukkan teks PGN terlebih dahulu.'
      );
    }

    const byteLen = getUtf8ByteLength(rawPgnText);
    if (byteLen > MAX_PGN_FILE_SIZE_BYTES) {
      return createErrorResponse(
        PGN_ERROR_CODES.FILE_TOO_LARGE,
        `Ukuran konten PGN (${formatFileSize(byteLen)}) melebihi batas aman maksimal 2 MB.`
      );
    }

    const cleanedText = rawPgnText.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

    if (cleanedText.trim().length === 0) {
      if (source === 'file') {
        return createErrorResponse(
          PGN_ERROR_CODES.EMPTY_FILE,
          `File "${fileName || '.pgn'}" kosong atau hanya berisi spasi. Pilih file .pgn yang berisi notasi langkah catur.`
        );
      }
      return createErrorResponse(
        PGN_ERROR_CODES.EMPTY_PGN,
        'Konten PGN kosong. Silakan tempelkan notasi PGN terlebih dahulu sebelum memproses.'
      );
    }

    // 2. Cek apakah isi file merupakan data biner atau format non-PGN (HTML/PDF/PNG/JSON)
    if (isBinaryOrUnsupportedContent(cleanedText)) {
      return createErrorResponse(
        PGN_ERROR_CODES.INVALID_FILE_TYPE,
        'Isi file atau teks bukan format PGN yang didukung (terdeteksi data biner atau dokumen format lain).'
      );
    }

    // 3. Parse Header/Tag PGN & pisahkan dari Movetext
    const headerParseResult = parseHeadersAndExtractMovetext(cleanedText);
    if (!headerParseResult.ok) {
      return createErrorResponse(headerParseResult.errorCode, headerParseResult.errorMessage);
    }

    const { headers, headerOrder, movetext } = headerParseResult;

    // 4. Validasi Tag [Result] jika tersedia di Header
    if (headers.Result !== undefined) {
      const rawHeaderResult = headers.Result.trim();
      if (!VALID_PGN_RESULTS.includes(rawHeaderResult)) {
        return createErrorResponse(
          PGN_ERROR_CODES.INVALID_RESULT,
          `Tag header [Result "${rawHeaderResult}"] tidak valid. Hasil pertandingan harus berupa 1-0, 0-1, 1/2-1/2, atau *.`
        );
      }
    }

    // 5. Validasi Tag [SetUp] dan [FEN] jika tersedia di Header
    let initialFen = DEFAULT_POSITION;
    if (headers.SetUp !== undefined && headers.SetUp !== '0' && headers.SetUp !== '1') {
      return createErrorResponse(
        PGN_ERROR_CODES.INVALID_HEADER,
        `Tag header [SetUp "${headers.SetUp}"] tidak valid. Gunakan nilai "0" atau "1".`
      );
    }
    if (headers.SetUp === '1' && (!headers.FEN || !headers.FEN.trim())) {
      return createErrorResponse(
        PGN_ERROR_CODES.INVALID_HEADER,
        'Tag header [SetUp "1"] ditemukan, tetapi tag [FEN] tidak tersedia.'
      );
    }
    if (headers.FEN !== undefined) {
      const fenCheck = validateInitialFenHeader(headers.FEN);
      if (!fenCheck.valid) {
        return createErrorResponse(
          PGN_ERROR_CODES.INVALID_HEADER,
          `Tag header [FEN] tidak valid: ${fenCheck.reason}`
        );
      }
      initialFen = fenCheck.fen;
    }

    // 6. Tokenisasi Movetext (komentar, variasi, token langkah/NAG/result)
    const lexResult = tokenizeMovetext(movetext);
    if (!lexResult.ok) {
      return createErrorResponse(lexResult.errorCode, lexResult.errorMessage);
    }

    if (lexResult.hasVariations && !allowVariations) {
      return createErrorResponse(
        PGN_ERROR_CODES.UNSUPPORTED_VARIATION,
        'PGN ini mengandung cabang variasi langkah (...). Parser Caturan MVP 5.1 saat ini hanya mendukung urutan langkah utama (mainline) secara linear dan menolak membuang variasi secara diam-diam agar informasi partai Anda tetap utuh.'
      );
    }

    // Ekspansi token gabungan seperti "1.e4" menjadi ["1.", "e4"]
    const stream = [];
    for (const item of lexResult.items) {
      if (item.type === 'comment') {
        stream.push(item);
      } else {
        const subTokens = expandRawToken(item.value);
        for (const st of subTokens) {
          stream.push({ type: 'token', value: st, itemIndex: item.itemIndex });
        }
      }
    }

    if (stream.length === 0) {
      return createErrorResponse(
        PGN_ERROR_CODES.EMPTY_PGN,
        'Konten PGN kosong atau hanya berisi header tanpa daftar langkah permainan (notasi SAN).'
      );
    }

    // 7. Evaluasi urutan token menggunakan Chess.js
    const chess = new Chess(initialFen);
    const moves = [];
    const gameComments = [];
    let movetextResult = null;
    let pendingMoveNumberToken = null;

    for (let idx = 0; idx < stream.length; idx += 1) {
      const entry = stream[idx];

      if (entry.type === 'comment') {
        if (moves.length === 0) {
          gameComments.push(entry.text);
        } else {
          moves[moves.length - 1].comments.push(entry.text);
        }
        continue;
      }

      const rawTok = entry.value.trim();
      if (!rawTok) continue;

      // Jika sebelumnya sudah ada token hasil pertandingan, lalu masih ada token langkah/partai lagi -> Multiple Games!
      if (movetextResult !== null) {
        return createErrorResponse(
          PGN_ERROR_CODES.MULTIPLE_GAMES,
          'File atau teks PGN berisi beberapa partai (lebih dari satu partai catur). Pada Caturan MVP 5.1, fitur pemilihan banyak partai belum tersedia — silakan impor satu partai per proses.'
        );
      }

      // Cek apakah token adalah hasil pertandingan yang valid (1-0, 0-1, 1/2-1/2, *)
      if (VALID_PGN_RESULTS.includes(rawTok)) {
        if (pendingMoveNumberToken !== null) {
          return createErrorResponse(
            PGN_ERROR_CODES.TRUNCATED_PGN,
            `PGN terpotong atau tidak lengkap: nomor langkah "${pendingMoveNumberToken}" langsung diikuti hasil akhir tanpa notasi langkah.`
          );
        }
        movetextResult = rawTok;
        continue;
      }

      // Cek apakah token merupakan fragmen hasil atau langkah yang terpotong di akhir PGN
      const isLastToken = idx === stream.length - 1;
      if (isLastToken && TRUNCATED_MOVE_FRAGMENT_REGEX.test(rawTok)) {
        return createErrorResponse(
          PGN_ERROR_CODES.TRUNCATED_PGN,
          `PGN terpotong atau tidak lengkap pada akhir notasi: "${rawTok}".`
        );
      }

      // Cek apakah token menyerupai format skor/hasil pertandingan yang tidak valid (misal 2-0, 0-2, 1-1, 1/2-0)
      if (
        (/^\d+-\d+$/.test(rawTok) && !/^0-0(-0)?$/.test(rawTok)) ||
        /^\d+\/\d+-\d+(?:\/\d+)?$/.test(rawTok) ||
        /^\d+-\d+\/\d+$/.test(rawTok)
      ) {
        return createErrorResponse(
          PGN_ERROR_CODES.INVALID_RESULT,
          `Hasil pertandingan "${rawTok}" pada akhir notasi tidak valid. Gunakan 1-0, 0-1, 1/2-1/2, atau *.`
        );
      }

      // Cek apakah token adalah NAG ($1 .. $255)
      if (rawTok.startsWith('$')) {
        if (!/^\$\d+$/.test(rawTok)) {
          return createErrorResponse(
            PGN_ERROR_CODES.INVALID_NOTATION,
            `Format NAG "${rawTok}" tidak valid. Gunakan format angka seperti $1, $2, atau $3.`
          );
        }
        const nagNum = parseInt(rawTok.slice(1), 10);
        if (nagNum < 0 || nagNum > 255 || moves.length === 0) {
          return createErrorResponse(
            PGN_ERROR_CODES.INVALID_NOTATION,
            `Token NAG "${rawTok}" tidak valid atau muncul sebelum langkah pertama.`
          );
        }
        const targetMove = moves[moves.length - 1];
        const nagInfo = NAG_MAP[rawTok] || { symbol: rawTok, label: `NAG ${rawTok}` };
        targetMove.nags.push({
          code: rawTok,
          symbol: nagInfo.symbol,
          label: nagInfo.label
        });
        targetMove.nagSymbols.push(nagInfo.symbol);
        targetMove.nagLabels.push(nagInfo.label);
        continue;
      }

      // Cek apakah token adalah simbol anotasi mandiri (!, ?, !!, ??, !?, ?!)
      if (/^(\!\!|\?\?|\!\?|\?\!|\!|\?)$/.test(rawTok)) {
        if (moves.length === 0) {
          return createErrorResponse(
            PGN_ERROR_CODES.INVALID_NOTATION,
            `Simbol anotasi "${rawTok}" tidak dapat muncul sebelum langkah pertama.`
          );
        }
        const mappedNag = SUFFIX_TO_NAG[rawTok];
        const targetMove = moves[moves.length - 1];
        if (mappedNag) {
          const nagInfo = NAG_MAP[mappedNag] || { symbol: rawTok, label: rawTok };
          targetMove.nags.push({
            code: mappedNag,
            symbol: nagInfo.symbol,
            label: nagInfo.label
          });
          targetMove.nagSymbols.push(nagInfo.symbol);
          targetMove.nagLabels.push(nagInfo.label);
        }
        continue;
      }

      // Cek apakah token adalah nomor langkah (misal: "1.", "1...", "24.")
      if (/^\d+\.+$/.test(rawTok)) {
        if (pendingMoveNumberToken !== null) {
          return createErrorResponse(
            PGN_ERROR_CODES.TRUNCATED_PGN,
            `PGN tidak lengkap: nomor langkah "${pendingMoveNumberToken}" tidak memiliki langkah sebelum "${rawTok}".`
          );
        }
        const parsedMoveNum = parseInt(rawTok, 10);
        const expectedFullMove = chess._fullMoves;
        if (parsedMoveNum !== expectedFullMove) {
          return createErrorResponse(
            PGN_ERROR_CODES.INVALID_NOTATION,
            `Urutan nomor langkah tidak valid: tertulis "${rawTok}", padahal permainan berada pada langkah ke-${expectedFullMove}.`
          );
        }
        pendingMoveNumberToken = rawTok;
        continue;
      }

      // Cek jika ada angka murni atau elipsis yatim di akhir/tengah PGN
      if (/^\d+$/.test(rawTok) || /^\.+$/.test(rawTok)) {
        if (isLastToken) {
          return createErrorResponse(
            PGN_ERROR_CODES.TRUNCATED_PGN,
            `PGN terpotong atau tidak lengkap pada token "${rawTok}".`
          );
        }
        return createErrorResponse(
          PGN_ERROR_CODES.INVALID_NOTATION,
          `Format notasi PGN tidak valid pada token "${rawTok}".`
        );
      }

      // Selain itu, token harus berupa langkah SAN!
      const { sanCandidate, suffixNags } = extractSanAndTraditionalSuffix(rawTok);

      if (!STRICT_SAN_REGEX.test(sanCandidate)) {
        return createErrorResponse(
          PGN_ERROR_CODES.INVALID_NOTATION,
          `Format notasi SAN tidak valid pada "${rawTok}" (langkah ke-${chess._fullMoves}). Gunakan notasi aljabar standar (contoh: e4, Nf3, Bxc4, O-O, exd5, e8=Q).`,
          {
            ply: moves.length + 1,
            moveNumber: chess._fullMoves,
            token: rawTok
          }
        );
      }

      const currentMoveNumber = chess._fullMoves;
      const currentTurnChar = chess.turn();
      const currentTurnSide = currentTurnChar === WHITE ? 'white' : 'black';
      const currentTurnLabel = currentTurnChar === WHITE ? 'Putih' : 'Hitam';
      const fenBefore = chess.fen();

      // Validasi legalitas langkah secara berurutan menggunakan Chess.js
      const appliedMove = chess.move(sanCandidate);
      if (!appliedMove) {
        return createErrorResponse(
          PGN_ERROR_CODES.ILLEGAL_MOVE,
          `Langkah catur ilegal pada langkah ke-${currentMoveNumber} (${currentTurnLabel}): "${sanCandidate}" tidak sah menurut aturan catur pada posisi saat ini.`,
          {
            ply: moves.length + 1,
            moveNumber: currentMoveNumber,
            color: currentTurnSide,
            token: sanCandidate,
            fenBefore
          }
        );
      }

      const fenAfter = chess.fen();
      const inCheck = chess.inCheck();
      const isCheckmate = chess.isCheckmate();
      const isStalemate = chess.isStalemate();
      const isDraw = chess.isDraw();

      const nags = suffixNags.map(code => {
        const info = NAG_MAP[code] || { symbol: code, label: code };
        return {
          code,
          symbol: info.symbol,
          label: info.label
        };
      });
      const nagSymbols = nags.map(n => n.symbol).filter(Boolean);
      const nagLabels = nags.map(n => n.label).filter(Boolean);

      moves.push({
        ply: moves.length + 1,
        moveNumber: currentMoveNumber,
        color: currentTurnChar,
        colorSide: currentTurnSide,
        colorChar: currentTurnChar,
        san: appliedMove.san,
        rawSan: rawTok,
        uci: `${appliedMove.from}${appliedMove.to}${appliedMove.promotion || ''}`,
        from: appliedMove.from,
        to: appliedMove.to,
        piece: appliedMove.piece,
        captured: appliedMove.captured || null,
        promotion: appliedMove.promotion || null,
        flags: appliedMove.flags,
        fenBefore,
        fenAfter,
        inCheck,
        isCheckmate,
        isStalemate,
        isDraw,
        nags,
        nagSymbols,
        nagLabels,
        comments: [],
        itemIndex: entry.itemIndex !== undefined ? entry.itemIndex : moves.length
      });

      pendingMoveNumberToken = null;
    }

    // 8. Cek apakah PGN berhenti mendadak setelah nomor langkah (misal: "1. e4 e5 2.")
    if (pendingMoveNumberToken !== null) {
      return createErrorResponse(
        PGN_ERROR_CODES.TRUNCATED_PGN,
        `PGN terpotong atau tidak lengkap: nomor langkah "${pendingMoveNumberToken}" tidak diikuti oleh notasi langkah.`
      );
    }

    // 9. Pastikan terdapat minimal 1 langkah legal dalam partai PGN
    if (moves.length === 0) {
      return createErrorResponse(
        PGN_ERROR_CODES.TRUNCATED_PGN,
        'PGN tidak lengkap: tidak ditemukan langkah permainan catur yang dapat divalidasi.'
      );
    }

    // 10. Validasi konsistensi hasil pertandingan antara Header [Result], token akhir movetext, dan posisi papan
    const headerResult = headers.Result ? headers.Result.trim() : null;
    if (
      headerResult &&
      movetextResult &&
      headerResult !== '*' &&
      movetextResult !== '*' &&
      headerResult !== movetextResult
    ) {
      return createErrorResponse(
        PGN_ERROR_CODES.INVALID_RESULT,
        `Hasil pertandingan pada header [Result "${headerResult}"] bertentangan dengan hasil pada akhir notasi ("${movetextResult}").`
      );
    }

    let finalResult = '*';
    if (movetextResult && movetextResult !== '*') {
      finalResult = movetextResult;
    } else if (headerResult && headerResult !== '*') {
      finalResult = headerResult;
    } else if (chess.isCheckmate()) {
      finalResult = chess.turn() === WHITE ? '0-1' : '1-0';
    } else if (chess.isDraw()) {
      finalResult = '1/2-1/2';
    } else if (movetextResult) {
      finalResult = movetextResult;
    } else if (headerResult) {
      finalResult = headerResult;
    }

    // Cek apabila hasil eksplisit bertentangan dengan kondisi skakmat atau remis otomatis di papan akhir
    if (chess.isCheckmate()) {
      const actualMateResult = chess.turn() === WHITE ? '0-1' : '1-0';
      if (
        (finalResult === '1-0' || finalResult === '0-1' || finalResult === '1/2-1/2') &&
        finalResult !== actualMateResult
      ) {
        return createErrorResponse(
          PGN_ERROR_CODES.INVALID_RESULT,
          `Hasil pertandingan yang tertulis (${finalResult}) bertentangan dengan posisi akhir skakmat di papan (${actualMateResult}).`
        );
      }
    } else if (chess.isStalemate() || chess.isAutomaticDraw()) {
      if (finalResult === '1-0' || finalResult === '0-1') {
        return createErrorResponse(
          PGN_ERROR_CODES.INVALID_RESULT,
          `Hasil pertandingan yang tertulis (${finalResult}) bertentangan dengan posisi akhir remis otomatis di papan (1/2-1/2).`
        );
      }
    }

    // 11. Susun pasangan langkah (Putih & Hitam) untuk navigasi tabel notasi
    const movePairs = [];
    for (const m of moves) {
      if (m.color === 'w') {
        movePairs.push({
          moveNumber: m.moveNumber,
          white: m,
          black: null
        });
      } else {
        const lastPair = movePairs[movePairs.length - 1];
        if (lastPair && lastPair.moveNumber === m.moveNumber && !lastPair.black) {
          lastPair.black = m;
        } else {
          movePairs.push({
            moveNumber: m.moveNumber,
            white: null,
            black: m
          });
        }
      }
    }

    // 12. Susun daftar posisi untuk setiap ply (0 .. totalPlies)
    const initialChess = new Chess(initialFen);
    const positions = [
      {
        ply: 0,
        moveNumber: 0,
        fen: initialFen,
        turn: initialChess.turn(),
        lastMove: null,
        move: null,
        inCheck: initialChess.inCheck(),
        isCheckmate: initialChess.isCheckmate(),
        isStalemate: initialChess.isStalemate(),
        isDraw: initialChess.isDraw()
      }
    ];

    for (const m of moves) {
      positions.push({
        ply: m.ply,
        moveNumber: m.moveNumber,
        fen: m.fenAfter,
        turn: m.colorChar === WHITE ? 'b' : 'w',
        lastMove: { from: m.from, to: m.to },
        move: m,
        inCheck: m.inCheck,
        isCheckmate: m.isCheckmate,
        isStalemate: m.isStalemate,
        isDraw: m.isDraw
      });
    }

    const finalFen = chess.fen();
    const totalPlies = moves.length;
    const totalMoves = movePairs.length;

    const hasResultMeta = Boolean(headerResult || movetextResult || chess.isGameOver());
    const metadata = {
      white: normalizeMetadataValue(headers.White, 'Tidak diketahui'),
      black: normalizeMetadataValue(headers.Black, 'Tidak diketahui'),
      event: normalizeMetadataValue(headers.Event, 'Tidak diketahui'),
      site: normalizeMetadataValue(headers.Site, 'Tidak diketahui'),
      date: normalizeMetadataValue(headers.Date || headers.UTCDate, 'Tidak diketahui'),
      round: normalizeMetadataValue(headers.Round, 'Tidak diketahui'),
      result: hasResultMeta ? finalResult : 'Tidak diketahui',
      resultCode: finalResult,
      resultLabel: hasResultMeta ? formatPgnResultLabel(finalResult) : 'Tidak diketahui',
      eco: normalizeMetadataValue(headers.ECO, 'Tidak diketahui'),
      opening: normalizeMetadataValue(headers.Opening, 'Tidak diketahui'),
      timeControl: normalizeMetadataValue(headers.TimeControl, 'Tidak diketahui'),
      whiteElo: normalizeMetadataValue(headers.WhiteElo, '-'),
      blackElo: normalizeMetadataValue(headers.BlackElo, '-')
    };

    const normalizedPgn = buildNormalizedPgn(
      headers,
      headerOrder,
      initialFen,
      moves,
      gameComments,
      finalResult
    );

    let gameStatusSummary = `Partai selesai (${formatPgnResultLabel(finalResult)})`;
    if (chess.isCheckmate()) {
      const winnerSide = chess.turn() === WHITE ? 'Hitam' : 'Putih';
      gameStatusSummary = `Skakmat — ${winnerSide} Menang (${finalResult})`;
    } else if (chess.isStalemate()) {
      gameStatusSummary = 'Remis — Stalemate (1/2-1/2)';
    } else if (chess.isAutomaticDraw()) {
      gameStatusSummary = 'Remis Otomatis (1/2-1/2)';
    } else if (finalResult === '*') {
      gameStatusSummary = `Posisi setelah ${totalMoves} langkah (${totalPlies} ply)`;
    }

    const finalStatus = {
      inCheck: chess.inCheck(),
      isCheckmate: chess.isCheckmate(),
      isStalemate: chess.isStalemate(),
      isDraw: chess.isDraw(),
      isGameOver: chess.isGameOver(),
      turn: chess.turn(),
      description: gameStatusSummary
    };


    // 13. Susun variasi RAV bila allowVariations diaktifkan
    const parsedVariations = [];
    let totalVariationPlies = 0;
    if (allowVariations && lexResult.rawVariations && lexResult.rawVariations.length > 0) {
      for (const rv of lexResult.rawVariations) {
        let branchFen = initialFen;
        let targetMove = null;
        for (let mIdx = moves.length - 1; mIdx >= 0; mIdx -= 1) {
          if (moves[mIdx].itemIndex <= rv.parentItemIndex) {
            targetMove = moves[mIdx];
            branchFen = moves[mIdx].fenBefore;
            break;
          }
        }
        if (!targetMove && moves.length > 0) {
          branchFen = moves[moves.length - 1].fenBefore;
          targetMove = moves[moves.length - 1];
        }
        const varTree = parseVariationTree(rv.text, branchFen);
        varTree.parentFen = branchFen;
        varTree.rawText = rv.text;
        parsedVariations.push(varTree);
        totalVariationPlies += varTree.totalPliesRecursive || varTree.totalPlies;
        if (targetMove) {
          if (!targetMove.variations) targetMove.variations = [];
          targetMove.variations.push(varTree);
        }
      }
    }

    const parsedData = {
      variations: parsedVariations,
      hasVariations: parsedVariations.length > 0,
      totalVariationPlies,
      headers: { ...headers },
      metadata,
      initialFen,
      finalFen,
      isCustomInitialFen: initialFen !== DEFAULT_POSITION,
      totalPlies,
      totalMoves,
      result: finalResult,
      resultLabel: metadata.resultLabel,
      moves,
      movePairs,
      positions,
      initialComments: gameComments,
      gameComments,
      finalStatus,
      movetextPgn: chess.pgn(),
      normalizedPgn,
      gameStatusSummary,
      sourceInfo: {
        source,
        fileName: fileName || null,
        fileSize: fileSize !== null ? fileSize : byteLen,
        formattedSize: formatFileSize(fileSize !== null ? fileSize : byteLen)
      }
    };

    return {
      ok: true,
      valid: true,
      errorCode: null,
      errorTitle: null,
      errorMessage: null,
      details: null,
      errorDetails: null,
      ...parsedData,
      data: parsedData
    };
  } catch (err) {
    return createErrorResponse(
      PGN_ERROR_CODES.PARSER_ERROR,
      'Terjadi kesalahan saat memproses format PGN. Pastikan notasi dan struktur PGN sesuai standar catur.'
    );
  }
}

export const pgnService = {
  MAX_PGN_FILE_SIZE_BYTES,
  PGN_ERROR_CODES,
  VALID_PGN_RESULTS,
  NAG_MAP,
  formatFileSize,
  formatPgnResultLabel,
  validatePgnFileMeta,
  validateAndParsePgn
};

export default pgnService;
