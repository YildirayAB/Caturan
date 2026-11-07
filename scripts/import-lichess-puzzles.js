/**
 * Script Pengambilan & Kurasi Dataset Puzzle Lichess Open Database (CC0 Public Domain)
 * Sumber: https://database.lichess.org/lichess_db_puzzle.csv.zst
 *
 * Strategi:
 * 1. Mengunduh secara streaming dari database resmi Lichess dan mengekstrak menggunakan
 *    decompressor Zstandard bawaan Node.js (`zlib.createZstdDecompress()`) ke direktori
 *    sementara `.tmp/` yang diabaikan oleh Git.
 * 2. Memvalidasi setiap kandidat puzzle menggunakan `Chess.js`:
 *    - Memuat FEN awal (posisi sebelum langkah lawan).
 *    - Menerapkan langkah UCI pertama (`Moves[0]`) secara otomatis sebagai langkah lawan.
 *    - Memastikan posisi setelah langkah pertama (`puzzleFen`) legal dan giliran sesuai.
 *    - Memvalidasi seluruh langkah solusi (`Moves[1..n]`) adalah langkah legal.
 * 3. Memilih 60 puzzle terkurasi:
 *    - 20 Pemula (Rating 600–1199)
 *    - 20 Menengah (Rating 1200–1799)
 *    - 20 Lanjutan (Rating 1800–2400)
 *    Terdistribusi merata pada 6 tema utama (masing-masing 10 puzzle):
 *    - mateIn1 (Mat dalam 1)
 *    - mateIn2 (Mat dalam 2)
 *    - fork (Garpu)
 *    - pin (Pin / Ikatan)
 *    - skewer (Tusukan)
 *    - discoveredAttack (Serangan Terbuka)
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import zlib from 'node:zlib';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { Chess } from '../js/vendor/chess.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const tmpDir = path.join(rootDir, '.tmp');
const sampleCsvPath = path.join(tmpDir, 'lichess_puzzle_sample.csv');
const outputJsonPath = path.join(rootDir, 'js', 'data', 'puzzles.json');
const outputJsPath = path.join(rootDir, 'js', 'data', 'puzzles.js');

const LICHESS_PUZZLE_URL = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';

const TARGET_THEMES = [
  'mateIn1',
  'mateIn2',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack'
];

// Target kuota 60 puzzle: 10 per tema, 20 per tingkat kesulitan
const QUOTA_MATRIX = {
  mateIn1: { beginner: 4, intermediate: 3, advanced: 3 },
  mateIn2: { beginner: 4, intermediate: 3, advanced: 3 },
  fork: { beginner: 3, intermediate: 4, advanced: 3 },
  pin: { beginner: 3, intermediate: 4, advanced: 3 },
  skewer: { beginner: 3, intermediate: 3, advanced: 4 },
  discoveredAttack: { beginner: 3, intermediate: 3, advanced: 4 }
};

function getDifficultyByRating(rating) {
  if (rating >= 600 && rating <= 1199) return 'beginner';
  if (rating >= 1200 && rating <= 1799) return 'intermediate';
  if (rating >= 1800 && rating <= 2400) return 'advanced';
  return null;
}

function parseUciMove(uci) {
  if (typeof uci !== 'string' || uci.length < 4) return null;
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion = uci.length > 4 ? uci.slice(4, 5).toLowerCase() : undefined;
  return promotion ? { from, to, promotion } : { from, to };
}

function validateAndParseRow(line) {
  if (!line || line.startsWith('PuzzleId,')) return null;
  const parts = line.split(',');
  if (parts.length < 8) return null;

  const [
    puzzleId,
    initialFen,
    movesStr,
    ratingStr,
    ratingDeviationStr,
    popularityStr,
    nbPlaysStr,
    themesStr,
    gameUrl = '',
    openingTags = ''
  ] = parts;

  if (!puzzleId || !initialFen || !movesStr) return null;

  const rating = Number.parseInt(ratingStr, 10);
  const ratingDeviation = Number.parseInt(ratingDeviationStr, 10);
  const popularity = Number.parseInt(popularityStr, 10);
  const nbPlays = Number.parseInt(nbPlaysStr, 10);

  if (!Number.isFinite(rating) || rating < 600 || rating > 2400) return null;
  if (!Number.isFinite(popularity) || popularity < 75) return null;
  if (!Number.isFinite(nbPlays) || nbPlays < 200) return null;

  const difficulty = getDifficultyByRating(rating);
  if (!difficulty) return null;

  const rawThemes = themesStr.trim().split(/\s+/).filter(Boolean);
  const supportedThemes = rawThemes.filter(t => TARGET_THEMES.includes(t));
  if (supportedThemes.length === 0) return null;

  const allMovesUci = movesStr.trim().split(/\s+/).filter(Boolean);
  // Panjang Moves harus minimal 2 (1 langkah lawan + minimal 1 langkah pemain) dan tidak terlalu panjang (maks 6 ply = 3 langkah pemain)
  if (allMovesUci.length < 2 || allMovesUci.length > 6 || allMovesUci.length % 2 !== 0) {
    return null;
  }

  // Validasi dengan Chess.js
  let chess;
  try {
    chess = new Chess(initialFen);
  } catch {
    return null;
  }

  // 1. Terapkan langkah pertama (langkah lawan yang menghasilkan posisi puzzle)
  const setupMoveObj = parseUciMove(allMovesUci[0]);
  if (!setupMoveObj) return null;

  let setupMoveResult;
  try {
    setupMoveResult = chess.move(setupMoveObj);
  } catch {
    return null;
  }
  if (!setupMoveResult) return null;

  const puzzleFen = chess.fen();
  const playerColor = chess.turn() === 'w' ? 'white' : 'black';

  // 2. Validasi seluruh langkah solusi (langkah ke-2 dan seterusnya)
  const solutionMovesUci = allMovesUci.slice(1);
  const solutionMovesSan = [];
  let hasPlayerPromotion = false;

  for (let i = 0; i < solutionMovesUci.length; i++) {
    const uci = solutionMovesUci[i];
    const moveObj = parseUciMove(uci);
    if (!moveObj) return null;

    let res;
    try {
      res = chess.move(moveObj);
    } catch {
      return null;
    }
    if (!res) return null;

    solutionMovesSan.push(res.san);
    if (i % 2 === 0 && moveObj.promotion) {
      hasPlayerPromotion = true;
    }
  }

  // Untuk mateIn1, pastikan hanya 1 langkah solusi pemain dan berakhir skakmat
  if (supportedThemes.includes('mateIn1')) {
    if (solutionMovesUci.length !== 1 || !chess.isCheckmate()) {
      return null;
    }
  }

  // Untuk mateIn2, pastikan 3 ply solusi (pemain -> lawan -> pemain) dan berakhir skakmat
  if (supportedThemes.includes('mateIn2')) {
    if (solutionMovesUci.length !== 3 || !chess.isCheckmate()) {
      return null;
    }
  }

  return {
    id: puzzleId.trim(),
    initialFen: initialFen.trim(),
    puzzleFen,
    setupMove: allMovesUci[0],
    setupMoveSan: setupMoveResult.san,
    moves: allMovesUci,
    solutionMoves: solutionMovesUci,
    solutionSan: solutionMovesSan,
    playerColor,
    rating,
    ratingDeviation: Number.isFinite(ratingDeviation) ? ratingDeviation : 75,
    popularity,
    nbPlays,
    difficulty,
    themes: supportedThemes,
    allThemes: rawThemes,
    hasPlayerPromotion,
    gameUrl: gameUrl.trim(),
    openingTags: openingTags ? openingTags.trim().split(/\s+/).filter(Boolean) : []
  };
}

function streamSampleFromLichess(targetLines = 250000) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(tmpDir, { recursive: true });

    if (fs.existsSync(sampleCsvPath)) {
      const stat = fs.statSync(sampleCsvPath);
      if (stat.size > 5 * 1024 * 1024) {
        console.log(`[Import] Menggunakan sampel CSV lokal di ${sampleCsvPath} (${Math.round(stat.size / 1024 / 1024)} MB)`);
        resolve(sampleCsvPath);
        return;
      }
    }

    console.log(`[Import] Mengunduh & mengekstrak stream dari ${LICHESS_PUZZLE_URL} ...`);
    const fileOut = fs.createWriteStream(sampleCsvPath, { encoding: 'utf8' });
    let lineCount = 0;
    let resolved = false;

    const finishSuccess = () => {
      if (resolved) return;
      resolved = true;
      fileOut.end(() => resolve(sampleCsvPath));
    };

    const req = https.get(LICHESS_PUZZLE_URL, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        req.destroy();
        reject(new Error(`Redirect terdeteksi ke ${res.headers.location}`));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP status ${res.statusCode}`));
        return;
      }

      const zstd = zlib.createZstdDecompress();
      const rl = readline.createInterface({
        input: res.pipe(zstd),
        crlfDelay: Infinity
      });

      rl.on('line', line => {
        if (resolved) return;
        fileOut.write(line + '\n');
        lineCount++;
        if (lineCount % 50000 === 0) {
          console.log(`[Import] Berhasil mengekstrak ${lineCount} baris puzzle...`);
        }
        if (lineCount >= targetLines) {
          rl.close();
          res.destroy();
          req.destroy();
          finishSuccess();
        }
      });

      rl.on('close', () => {
        finishSuccess();
      });

      zstd.on('error', err => {
        if (resolved) return;
        reject(err);
      });
    });

    req.on('error', err => {
      if (resolved) return;
      reject(err);
    });
  });
}

async function curatePuzzles() {
  await streamSampleFromLichess(250000);

  const buckets = {};
  for (const theme of TARGET_THEMES) {
    buckets[theme] = {
      beginner: [],
      intermediate: [],
      advanced: []
    };
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(sampleCsvPath, { encoding: 'utf8' }),
    crlfDelay: Infinity
  });

  let scanned = 0;
  for await (const line of rl) {
    scanned++;
    if (!line || line.startsWith('PuzzleId,')) continue;

    // Fast pre-check sebelum instansiasi Chess.js
    const parts = line.split(',');
    if (parts.length < 8) continue;
    const rating = Number.parseInt(parts[3], 10);
    const popularity = Number.parseInt(parts[5], 10);
    const nbPlays = Number.parseInt(parts[6], 10);
    if (!Number.isFinite(rating) || rating < 600 || rating > 2400) continue;
    if (!Number.isFinite(popularity) || popularity < 75 || !Number.isFinite(nbPlays) || nbPlays < 200) continue;

    const diff = getDifficultyByRating(rating);
    if (!diff) continue;

    const rawThemes = parts[7].trim().split(/\s+/).filter(Boolean);
    const supported = rawThemes.filter(t => TARGET_THEMES.includes(t));
    if (supported.length !== 1) continue;

    const targetTheme = supported[0];
    if (buckets[targetTheme][diff].length >= 25) {
      // Cek apakah semua bucket sudah penuh (>= 25)
      const allFull = TARGET_THEMES.every(
        t =>
          buckets[t].beginner.length >= 25 &&
          buckets[t].intermediate.length >= 25 &&
          buckets[t].advanced.length >= 25
      );
      if (allFull) break;
      continue;
    }

    const parsed = validateAndParseRow(line);
    if (!parsed) continue;

    buckets[targetTheme][parsed.difficulty].push(parsed);
  }

  console.log(`[Import] Selesai memindai ${scanned} baris CSV.`);
  for (const theme of TARGET_THEMES) {
    console.log(
      `  Tema ${theme}: beginner=${buckets[theme].beginner.length}, intermediate=${buckets[theme].intermediate.length}, advanced=${buckets[theme].advanced.length}`
    );
  }

  const selectedPuzzles = [];
  const usedIds = new Set();

  // Pilih berdasarkan QUOTA_MATRIX dengan mengutamakan popularitas tinggi & variasi promosi pion
  for (const theme of TARGET_THEMES) {
    for (const diff of ['beginner', 'intermediate', 'advanced']) {
      const needed = QUOTA_MATRIX[theme][diff];
      const candidates = buckets[theme][diff]
        .filter(p => !usedIds.has(p.id))
        .sort((a, b) => {
          // Prioritaskan puzzle yang hanya memiliki 1 tema target agar distribusi 6 kategori 100% eksklusif (6 x 10 = 60)
          const aSingle = a.themes.length === 1 ? 0 : 1;
          const bSingle = b.themes.length === 1 ? 0 : 1;
          if (aSingle !== bSingle) {
            return aSingle - bSingle;
          }
          // Utamakan yang memiliki promosi pion jika belum ada di daftar terpilih (maks 3)
          const currentPromoCount = selectedPuzzles.filter(x => x.hasPlayerPromotion).length;
          if (currentPromoCount < 3 && a.hasPlayerPromotion !== b.hasPlayerPromotion) {
            return a.hasPlayerPromotion ? -1 : 1;
          }
          return b.popularity - a.popularity || b.nbPlays - a.nbPlays;
        });

      const picked = candidates.slice(0, needed);
      for (const p of picked) {
        usedIds.add(p.id);
        selectedPuzzles.push({
          id: p.id,
          initialFen: p.initialFen,
          puzzleFen: p.puzzleFen,
          setupMove: p.setupMove,
          setupMoveSan: p.setupMoveSan,
          moves: p.moves,
          solutionMoves: p.solutionMoves,
          solutionSan: p.solutionSan,
          playerColor: p.playerColor,
          rating: p.rating,
          ratingDeviation: p.ratingDeviation,
          popularity: p.popularity,
          nbPlays: p.nbPlays,
          difficulty: p.difficulty,
          primaryTheme: theme,
          themes: p.themes.includes(theme) ? p.themes : [theme, ...p.themes],
          gameUrl: p.gameUrl,
          openingTags: p.openingTags
        });
      }
    }
  }

  console.log(`[Import] Total puzzle terpilih: ${selectedPuzzles.length}`);
  const promoSelected = selectedPuzzles.filter(p =>
    p.solutionMoves.some((m, idx) => idx % 2 === 0 && m.length === 5)
  );
  console.log(`[Import] Puzzle dengan promosi pion pemain: ${promoSelected.length}`);

  fs.writeFileSync(outputJsonPath, JSON.stringify(selectedPuzzles, null, 2), 'utf8');
  console.log(`[Import] Berhasil menyimpan dataset ke ${outputJsonPath}`);

  const jsModuleContent = `/**
 * Dataset Puzzle Catur Terkurasi — Caturan MVP 2
 * Sumber: Lichess Open Database — CC0 Public Domain (https://database.lichess.org/#puzzles)
 * Sinkron 100% dengan js/data/puzzles.json (60 puzzle tervalidasi Chess.js).
 */

export const PUZZLE_CATEGORIES = [
  {
    id: 'mateIn1',
    title: 'Mat dalam 1',
    shortTitle: 'Mat dalam 1',
    description:
      'Temukan satu langkah mematikan yang langsung mengunci Raja lawan dalam kondisi skakmat (checkmate) tanpa jalan keluar.',
    generalHint:
      'Tema Mat dalam 1: Cari langkah skak yang langsung mematikan Raja lawan sehingga tidak bisa lari, menutup serangan, atau menangkap bidak penyerang.'
  },
  {
    id: 'mateIn2',
    title: 'Mat dalam 2',
    shortTitle: 'Mat dalam 2',
    description:
      'Rancang kombinasi paksa dua langkah beruntun: langkah pertama membatasi ruang gerak Raja lawan, langkah kedua mengeksekusi skakmat.',
    generalHint:
      'Tema Mat dalam 2: Cari langkah pemaksa (biasanya skak atau ancaman mutlak) yang memaksa respons tunggal lawan sebelum skakmat pada langkah kedua.'
  },
  {
    id: 'fork',
    title: 'Garpu',
    shortTitle: 'Garpu',
    description:
      'Serang dua atau lebih bidak berharga lawan sekaligus menggunakan satu bidak penyerang untuk memenangkan materi.',
    generalHint:
      'Tema Garpu (Fork): Perhatikan dua perwira atau Raja lawan yang dapat diserang secara bersamaan oleh satu bidak Anda pada satu petak cabang.'
  },
  {
    id: 'pin',
    title: 'Pin / Ikatan',
    shortTitle: 'Pin / Ikatan',
    description:
      'Manfaatkan perwira jarak jauh (Gajah, Benteng, atau Menteri) untuk mengikat bidak lawan yang melindungi Raja atau perwira bernilai tinggi di belakangnya.',
    generalHint:
      'Tema Pin / Ikatan: Cari jalur lurus atau diagonal di mana bidak lawan terikat di depan Raja atau perwira mahalnya, lalu manfaatkan ikatan tersebut.'
  },
  {
    id: 'skewer',
    title: 'Tusukan',
    shortTitle: 'Tusukan',
    description:
      'Serang bidak lawan yang paling berharga secara segaris sehingga ketika bidak tersebut menghindar, bidak di belakangnya dapat ditangkap.',
    generalHint:
      'Tema Tusukan (Skewer): Bidik Raja atau perwira bernilai tinggi lawan pada satu lajur, baris, atau diagonal yang menembus ke bidak lawan lain di belakangnya.'
  },
  {
    id: 'discoveredAttack',
    title: 'Serangan Terbuka',
    shortTitle: 'Serangan Terbuka',
    description:
      'Gerakkan satu bidak untuk membuka jalur serangan tersembunyi dari perwira jarak jauh di belakangnya sambil menciptakan ancaman ganda.',
    generalHint:
      'Tema Serangan Terbuka: Pindahkan bidak penutup dengan langkah yang mengancam atau memberi skak untuk membuka jalur tembak perwira di belakangnya.'
  }
];

export const PUZZLE_DIFFICULTIES = [
  {
    id: 'beginner',
    title: 'Pemula',
    ratingRange: '600–1199',
    minRating: 600,
    maxRating: 1199,
    description: 'Pola taktik dasar yang ideal untuk membangun ketajaman visual di atas papan.'
  },
  {
    id: 'intermediate',
    title: 'Menengah',
    ratingRange: '1200–1799',
    minRating: 1200,
    maxRating: 1799,
    description: 'Kombinasi taktik multi-langkah yang menuntut perhitungan balasan lawan secara akurat.'
  },
  {
    id: 'advanced',
    title: 'Lanjutan',
    ratingRange: '1800–2400',
    minRating: 1800,
    maxRating: 2400,
    description: 'Posisi taktik kompleks tingkat turnamen dengan urutan langkah presisi tinggi.'
  }
];

export const PUZZLES_DATA = ${JSON.stringify(selectedPuzzles, null, 2)};

export function getAllPuzzles() {
  return PUZZLES_DATA;
}

export function getPuzzleById(puzzleId) {
  if (!puzzleId || typeof puzzleId !== 'string') return null;
  return PUZZLES_DATA.find(p => p.id === puzzleId.trim()) || null;
}

export function getPuzzleCategoryById(themeId) {
  return PUZZLE_CATEGORIES.find(c => c.id === themeId) || null;
}

export function getPuzzleDifficultyById(difficultyId) {
  return PUZZLE_DIFFICULTIES.find(d => d.id === difficultyId) || null;
}

/**
 * Mengambil hanya kategori yang benar-benar memiliki data puzzle (Bagian 3)
 */
export function getAvailablePuzzleCategories() {
  return PUZZLE_CATEGORIES.filter(cat =>
    PUZZLES_DATA.some(p => p.primaryTheme === cat.id || (Array.isArray(p.themes) && p.themes.includes(cat.id)))
  );
}

/**
 * Menyaring daftar puzzle berdasarkan tema dan/atau tingkat kesulitan
 */
export function getPuzzlesByFilter({ theme = 'all', difficulty = 'all' } = {}) {
  return PUZZLES_DATA.filter(puzzle => {
    const matchTheme =
      !theme ||
      theme === 'all' ||
      puzzle.primaryTheme === theme ||
      (Array.isArray(puzzle.themes) && puzzle.themes.includes(theme));
    const matchDiff =
      !difficulty || difficulty === 'all' || puzzle.difficulty === difficulty;
    return matchTheme && matchDiff;
  });
}

/**
 * Menghasilkan urutan deterministik puzzle harian agar bervariasi antar tema dan kesulitan
 */
function getDailyRotationPool() {
  const byTheme = new Map();
  for (const cat of PUZZLE_CATEGORIES) {
    byTheme.set(
      cat.id,
      PUZZLES_DATA.filter(p => p.primaryTheme === cat.id)
    );
  }
  const interleaved = [];
  const maxLen = Math.max(...Array.from(byTheme.values()).map(arr => arr.length), 0);
  for (let i = 0; i < maxLen; i++) {
    for (const cat of PUZZLE_CATEGORIES) {
      const list = byTheme.get(cat.id) || [];
      if (i < list.length) {
        interleaved.push(list[i]);
      }
    }
  }
  return interleaved.length > 0 ? interleaved : PUZZLES_DATA;
}

/**
 * Pemilihan Puzzle Harian secara deterministik berdasarkan tanggal lokal 'YYYY-MM-DD'.
 * Kedua perangkat pada tanggal lokal yang sama dijamin mendapatkan puzzle harian yang sama persis.
 */
export function getDailyPuzzle(dateStr) {
  const pool = getDailyRotationPool();
  if (pool.length === 0) return null;

  let targetDate = dateStr;
  if (typeof targetDate !== 'string' || !/^\\d{4}-\\d{2}-\\d{2}$/.test(targetDate.trim())) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    targetDate = \`\${y}-\${m}-\${d}\`;
  } else {
    targetDate = targetDate.trim();
  }

  const [year, month, day] = targetDate.split('-').map(Number);
  const epochDays = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  const index = ((epochDays % pool.length) + pool.length) % pool.length;
  return pool[index];
}

/**
 * Memilih puzzle berikutnya dalam satu pool latihan tanpa mengulangi puzzle yang sama
 * sebelum seluruh pool habis (Bagian 9).
 */
export function selectNextPuzzle({
  theme = 'all',
  difficulty = 'all',
  solvedPuzzleIds = [],
  sessionPlayedIds = [],
  currentPuzzleId = null
} = {}) {
  const pool = getPuzzlesByFilter({ theme, difficulty });
  if (pool.length === 0) {
    return { puzzle: null, updatedSessionPlayedIds: [], poolReset: false };
  }

  const playedSet = new Set(sessionPlayedIds);
  if (currentPuzzleId) {
    playedSet.add(currentPuzzleId);
  }

  const solvedSet = new Set(solvedPuzzleIds);

  // Cari puzzle di dalam pool yang belum dimainkan pada siklus sesi ini
  let candidates = pool.filter(p => !playedSet.has(p.id));
  let poolReset = false;

  if (candidates.length === 0) {
    // Seluruh puzzle di dalam pool sudah dimainkan -> mulai siklus baru
    poolReset = true;
    playedSet.clear();
    if (currentPuzzleId && pool.length > 1) {
      playedSet.add(currentPuzzleId);
      candidates = pool.filter(p => p.id !== currentPuzzleId);
    } else {
      candidates = [...pool];
    }
  }

  // Prioritaskan puzzle yang belum pernah diselesaikan pengguna jika masih tersedia di kandidat
  const unsolvedCandidates = candidates.filter(p => !solvedSet.has(p.id));
  const nextPuzzle =
    unsolvedCandidates.length > 0 ? unsolvedCandidates[0] : candidates[0];

  if (nextPuzzle) {
    playedSet.add(nextPuzzle.id);
  }

  return {
    puzzle: nextPuzzle || null,
    updatedSessionPlayedIds: Array.from(playedSet),
    poolReset
  };
}
`;

  fs.writeFileSync(outputJsPath, jsModuleContent, 'utf8');
  console.log(`[Import] Berhasil menghasilkan modul ES ${outputJsPath}`);
}

curatePuzzles().catch(err => {
  console.error('[Import] Gagal mengambil/memproses dataset:', err);
  process.exit(1);
});
