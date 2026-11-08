/**
 * Layanan Analisis Engine Stockfish (MVP 5.4 — Stockfish Analysis Engine)
 * Menggunakan Stockfish 19 Lite Single-Threaded WASM (`stockfish-19-lite-single.js` & `.wasm`)
 * melalui Web Worker terpisah agar UI utama tidak pernah membeku.
 *
 * Ketentuan Arsitektur:
 * - Lifecycle & state sesi analisis terpisah sepenuhnya dari `stockfishEngine.js` (Play Against Computer).
 * - Mendukung protokol UCI (`uci` -> `uciok`, `isready` -> `readyok`, `position fen <fen>`, `go movetime <ms>`, `stop`).
 * - Mengonversi evaluasi UCI (centipawn `cp` dan `mate`) selalu ke perspektif Putih (White perspective).
 * - Mengonversi Best Move UCI dan Principal Variation (PV) menjadi notasi SAN yang legal menggunakan `chess.js`
 *   dengan memperhitungkan promosi pion, rokade, dan en passant tanpa memodifikasi posisi permainan pengguna.
 * - Hanya menganggap hasil evaluasi selesai ketika engine memberikan respons akhir (`bestmove`).
 * - Mengabaikan hasil Worker dari sesi analisis lama / posisi yang sudah berubah (stale analysis guard).
 * - Menjamin cleanup Worker dan listener secara menyeluruh ketika meninggalkan Analysis Studio.
 */

import { Chess, WHITE } from '../vendor/chess.js';
import { parseUciMove } from '../components/chessboardUI.js';
import {
  parseUciOptionLine,
  parseBestMoveLine
} from './stockfishEngine.js';

export const ANALYSIS_ENGINE_STATES = {
  IDLE: 'idle',
  LOADING: 'loading',
  READY: 'ready',
  ANALYZING: 'analyzing',
  STOPPED: 'stopped',
  ERROR: 'error'
};

export const ANALYSIS_ENGINE_STATE_LABELS = {
  [ANALYSIS_ENGINE_STATES.IDLE]: 'Ready',
  [ANALYSIS_ENGINE_STATES.LOADING]: 'Loading Engine',
  [ANALYSIS_ENGINE_STATES.READY]: 'Ready',
  [ANALYSIS_ENGINE_STATES.ANALYZING]: 'Analyzing',
  [ANALYSIS_ENGINE_STATES.STOPPED]: 'Stopped',
  [ANALYSIS_ENGINE_STATES.ERROR]: 'Error'
};

/**
 * Batas waktu analisis yang wajar dan responsif untuk desktop & mobile
 * agar perangkat mobile tidak bekerja terlalu berat namun tetap menghasilkan depth yang solid.
 */
export const DEFAULT_ANALYSIS_MOVETIME_MS = 1000;
export const MOBILE_ANALYSIS_MOVETIME_MS = 750;
export const MAX_SAFE_ANALYSIS_MOVETIME_MS = 2500;
export const MIN_SAFE_ANALYSIS_MOVETIME_MS = 100;

let cachedNodeAnalysisEngine = null;

/**
 * Membuat adapter Worker untuk lingkungan Node.js (pengujian otomatis lokal)
 * ketika global `Worker` browser tidak tersedia.
 * Tetap mengisolasi listener pada setiap instance adapter aktif.
 */
async function createNodeAnalysisWorkerAdapter() {
  const { createRequire } = await import('node:module');
  const requireFn = createRequire(import.meta.url);
  const initStockfish = requireFn('stockfish');

  if (!cachedNodeAnalysisEngine) {
    if (globalThis.__caturanSharedNodeStockfishEngine) {
      cachedNodeAnalysisEngine = globalThis.__caturanSharedNodeStockfishEngine;
    } else {
      const savedFetch = globalThis.fetch;
      cachedNodeAnalysisEngine = await Promise.resolve(initStockfish('lite-single'));
      if (savedFetch && !globalThis.fetch) {
        globalThis.fetch = savedFetch;
      }
      globalThis.__caturanSharedNodeStockfishEngine = cachedNodeAnalysisEngine;
    }
  }
  const engine = cachedNodeAnalysisEngine;

  let terminated = false;
  const adapter = {
    onmessage: null,
    onerror: null,
    postMessage(cmd) {
      if (terminated || !engine) return;
      try {
        engine.listener = line => {
          if (terminated) return;
          if (typeof adapter.onmessage === 'function') {
            adapter.onmessage({ data: String(line) });
          }
        };
        if (typeof engine.processCommand === 'function') {
          engine.processCommand(String(cmd));
        } else if (typeof engine.postMessage === 'function') {
          engine.postMessage(String(cmd));
        }
      } catch (err) {
        if (typeof adapter.onerror === 'function') {
          adapter.onerror(err);
        }
      }
    },
    terminate() {
      if (terminated) return;
      terminated = true;
      try {
        if (engine && typeof engine.processCommand === 'function') {
          engine.processCommand('stop');
        }
      } catch {
        // Abaikan error saat penghentian
      }
      adapter.onmessage = null;
      adapter.onerror = null;
    }
  };

  engine.listener = line => {
    if (terminated) return;
    if (typeof adapter.onmessage === 'function') {
      adapter.onmessage({ data: String(line) });
    }
  };

  return adapter;
}

/**
 * Mengekstrak giliran jalan ('w' atau 'b') dari string FEN
 */
export function getTurnFromFen(fen) {
  if (typeof fen !== 'string' || !fen.trim()) return WHITE;
  const parts = fen.trim().split(/\s+/);
  return parts[1] === 'b' ? 'b' : 'w';
}

/**
 * Mem-parsing baris `info ...` dari protokol UCI Stockfish.
 * Contoh:
 * `info depth 12 seldepth 16 multipv 1 score cp 35 nodes 14200 nps 280000 time 50 pv g1f3 d7d5 d2d4 g8f6`
 * `info depth 15 score mate -3 pv d8h4 g2g3 h4e4`
 */
export function parseUciInfoLine(line) {
  if (typeof line !== 'string') return null;
  const trimmed = line.trim();
  if (!trimmed.startsWith('info ')) return null;

  // Abaikan info string murni yang tidak memuat evaluasi pencarian
  if (trimmed.startsWith('info string ')) return null;

  const tokens = trimmed.split(/\s+/);
  let depth = null;
  let seldepth = null;
  let multipv = 1;
  let scoreType = null; // 'cp' | 'mate'
  let rawScoreValue = null;
  let scoreBound = null; // 'upperbound' | 'lowerbound' | null
  let nodes = null;
  let timeMs = null;
  let pvUciMoves = [];

  for (let i = 1; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (token === 'depth' && i + 1 < tokens.length) {
      const val = Number(tokens[i + 1]);
      if (Number.isFinite(val) && val >= 0) {
        depth = Math.floor(val);
      }
      i += 1;
    } else if (token === 'seldepth' && i + 1 < tokens.length) {
      const val = Number(tokens[i + 1]);
      if (Number.isFinite(val) && val >= 0) {
        seldepth = Math.floor(val);
      }
      i += 1;
    } else if (token === 'multipv' && i + 1 < tokens.length) {
      const val = Number(tokens[i + 1]);
      if (Number.isFinite(val) && val >= 1) {
        multipv = Math.floor(val);
      }
      i += 1;
    } else if (token === 'score' && i + 2 < tokens.length) {
      const typeCandidate = tokens[i + 1];
      const valCandidate = Number(tokens[i + 2]);
      if ((typeCandidate === 'cp' || typeCandidate === 'mate') && Number.isFinite(valCandidate)) {
        scoreType = typeCandidate;
        rawScoreValue = Math.trunc(valCandidate);
        i += 2;
        if (
          i + 1 < tokens.length &&
          (tokens[i + 1] === 'upperbound' || tokens[i + 1] === 'lowerbound')
        ) {
          scoreBound = tokens[i + 1];
          i += 1;
        }
      }
    } else if (token === 'nodes' && i + 1 < tokens.length) {
      const val = Number(tokens[i + 1]);
      if (Number.isFinite(val) && val >= 0) {
        nodes = Math.floor(val);
      }
      i += 1;
    } else if (token === 'time' && i + 1 < tokens.length) {
      const val = Number(tokens[i + 1]);
      if (Number.isFinite(val) && val >= 0) {
        timeMs = Math.floor(val);
      }
      i += 1;
    } else if (token === 'pv') {
      pvUciMoves = tokens
        .slice(i + 1)
        .filter(m => /^[a-h][1-8][a-h][1-8][qrbnQRBN]?$/.test(m));
      break;
    }
  }

  if (depth === null && scoreType === null && pvUciMoves.length === 0) {
    return null;
  }

  return {
    depth,
    seldepth,
    multipv,
    scoreType,
    rawScoreValue,
    scoreValue: rawScoreValue,
    scoreBound,
    nodes,
    timeMs,
    pvUciMoves,
    pvUci: pvUciMoves,
    rawLine: trimmed
  };
}

/**
 * Mengonversi skor UCI Stockfish (yang selalu relatif terhadap side-to-move)
 * menjadi perspektif Putih (White perspective) secara konsisten.
 *
 * Konvensi:
 * - Jika `turn === 'w'`, nilai positif berarti Putih unggul.
 * - Jika `turn === 'b'`, nilai positif dari UCI berarti Hitam unggul, sehingga dikali `-1`
 *   agar dari perspektif Putih bernilai negatif.
 *
 * Contoh format:
 * - `+0.35` -> Sedikit unggul Putih
 * - `+1.20` -> Putih unggul
 * - `-0.85` -> Hitam unggul
 * - `0.00`  -> Posisi seimbang
 * - `Mate in 4` -> Terdapat forced mate dalam 4 langkah
 */
export function normalizeScoreToWhitePerspective(scoreType, rawScoreValue, turn = 'w') {
  if (
    (scoreType !== 'cp' && scoreType !== 'mate') ||
    typeof rawScoreValue !== 'number' ||
    !Number.isFinite(rawScoreValue)
  ) {
    return null;
  }

  const perspectiveMultiplier = turn === 'b' ? -1 : 1;
  const whiteValue = rawScoreValue === 0 ? 0 : rawScoreValue * perspectiveMultiplier;

  if (scoreType === 'mate') {
    const mateMoves = Math.abs(Math.trunc(whiteValue));
    let advantage = 'equal';
    let advantageLabel = 'Posisi seimbang';
    let formattedScore = `Mate in ${mateMoves}`;

    if (whiteValue > 0) {
      advantage = 'white';
      advantageLabel =
        mateMoves === 0
          ? 'Putih menang (Skakmat)'
          : `Putih menang — Skakmat paksa dalam ${mateMoves} langkah`;
      formattedScore = `Mate in ${mateMoves}`;
    } else if (whiteValue < 0) {
      advantage = 'black';
      advantageLabel =
        mateMoves === 0
          ? 'Hitam menang (Skakmat)'
          : `Hitam menang — Skakmat paksa dalam ${mateMoves} langkah`;
      formattedScore = `Mate in -${mateMoves}`;
    } else {
      // Mate 0 berarti pihak yang sedang giliran jalan sudah terkena skakmat
      if (turn === 'w') {
        advantage = 'black';
        advantageLabel = 'Hitam menang (Skakmat)';
        formattedScore = 'Mate in -0';
      } else {
        advantage = 'white';
        advantageLabel = 'Putih menang (Skakmat)';
        formattedScore = 'Mate in 0';
      }
    }

    return {
      type: 'mate',
      rawScore: rawScoreValue,
      whiteScore: whiteValue,
      whiteMate: whiteValue,
      whiteCp: null,
      centipawns: null,
      pawns: null,
      mateMoves,
      winningSide: advantage === 'white' ? 'w' : advantage === 'black' ? 'b' : null,
      advantage, // 'white' | 'black' | 'equal'
      advantageLabel,
      label: advantageLabel,
      formatted: formattedScore,
      displayText: `Mate in ${mateMoves}`
    };
  }

  // Centipawn (cp)
  const cpWhite = Math.trunc(whiteValue);
  const pawns = cpWhite / 100;
  const absPawns = Math.abs(pawns);

  let formatted = '0.00';
  if (Math.abs(cpWhite) < 5) {
    formatted = '0.00';
  } else if (cpWhite > 0) {
    formatted = `+${pawns.toFixed(2)}`;
  } else {
    formatted = `-${absPawns.toFixed(2)}`;
  }

  let advantage = 'equal';
  let advantageLabel = 'Posisi seimbang';

  if (Math.abs(cpWhite) <= 20) {
    advantage = 'equal';
    advantageLabel = 'Posisi seimbang';
  } else if (cpWhite > 20 && cpWhite < 75) {
    advantage = 'white';
    advantageLabel = 'Sedikit unggul Putih';
  } else if (cpWhite >= 75) {
    advantage = 'white';
    advantageLabel = 'Putih unggul';
  } else if (cpWhite < -20 && cpWhite > -75) {
    advantage = 'black';
    advantageLabel = 'Sedikit unggul Hitam';
  } else if (cpWhite <= -75) {
    advantage = 'black';
    advantageLabel = 'Hitam unggul';
  }

  return {
    type: 'cp',
    rawScore: rawScoreValue,
    whiteScore: cpWhite,
    whiteCp: cpWhite,
    whiteMate: null,
    centipawns: cpWhite,
    pawns: Number(pawns.toFixed(2)),
    mateMoves: null,
    winningSide: advantage === 'white' ? 'w' : advantage === 'black' ? 'b' : null,
    advantage,
    advantageLabel,
    label: advantageLabel,
    formatted,
    displayText: formatted
  };
}

/**
 * Mengonversi satu langkah UCI (misal `g1f3`, `e7e8q`, `e1g1`) menjadi informasi langkah SAN
 * menggunakan instance sementara `Chess` pada FEN yang sedang dianalisis tanpa memutasi papan utama.
 */
export function convertUciMoveToSan(fen, uciMove) {
  if (typeof fen !== 'string' || !fen.trim() || typeof uciMove !== 'string') {
    return null;
  }
  const parsed = parseUciMove(uciMove);
  if (!parsed || !parsed.from || !parsed.to) return null;

  try {
    const chess = new Chess(fen.trim());
    const moveSpec = {
      from: parsed.from,
      to: parsed.to
    };
    if (parsed.promotion) {
      moveSpec.promotion = String(parsed.promotion).toLowerCase();
    }
    const moveObj = chess.move(moveSpec);
    if (!moveObj) return null;

    return {
      uci: `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}`,
      san: moveObj.san,
      from: moveObj.from,
      to: moveObj.to,
      promotion: moveObj.promotion || null,
      piece: moveObj.piece,
      color: moveObj.color,
      captured: moveObj.captured || null,
      flags: moveObj.flags,
      fenAfter: chess.fen()
    };
  } catch {
    return null;
  }
}

/**
 * Mengonversi urutan langkah UCI pada Principal Variation (PV) menjadi daftar langkah SAN
 * secara berurutan menggunakan `chess.js`. Jika ditemukan langkah di tengah jalur yang tidak valid,
 * konversi berhenti secara aman pada langkah legal terakhir tanpa melempar crash.
 */
export function convertPvUciToSan(fen, pvUciMoves = [], maxPlies = 12) {
  if (typeof fen !== 'string' || !fen.trim() || !Array.isArray(pvUciMoves)) {
    return {
      sanMoves: [],
      uciMoves: [],
      moveObjects: [],
      moves: [],
      formattedSan: '',
      sanLine: '',
      formattedNumberedSan: '',
      truncatedOnIllegal: false
    };
  }

  let chess;
  try {
    chess = new Chess(fen.trim());
  } catch {
    return {
      sanMoves: [],
      uciMoves: [],
      moveObjects: [],
      moves: [],
      formattedSan: '',
      sanLine: '',
      formattedNumberedSan: '',
      truncatedOnIllegal: false
    };
  }

  const sanMoves = [];
  const validUciMoves = [];
  const moveObjects = [];
  const numberedTokens = [];
  let truncatedOnIllegal = false;

  const limit = Math.max(1, Math.min(24, Number(maxPlies) || 12));

  for (let i = 0; i < pvUciMoves.length && sanMoves.length < limit; i += 1) {
    const rawUci = pvUciMoves[i];
    const parsed = parseUciMove(rawUci);
    if (!parsed || !parsed.from || !parsed.to) {
      truncatedOnIllegal = true;
      break;
    }

    const turnBefore = chess.turn();
    const fenParts = chess.fen().split(/\s+/);
    const fullMoveNumber = Number(fenParts[5]) || 1;

    let applied = null;
    try {
      const spec = { from: parsed.from, to: parsed.to };
      if (parsed.promotion) {
        spec.promotion = String(parsed.promotion).toLowerCase();
      }
      applied = chess.move(spec);
    } catch {
      applied = null;
    }

    if (!applied) {
      truncatedOnIllegal = true;
      break;
    }

    const cleanUci = `${applied.from}${applied.to}${applied.promotion || ''}`;
    sanMoves.push(applied.san);
    validUciMoves.push(cleanUci);
    moveObjects.push({
      uci: cleanUci,
      san: applied.san,
      from: applied.from,
      to: applied.to,
      promotion: applied.promotion || null,
      color: turnBefore,
      moveNumber: fullMoveNumber
    });

    if (turnBefore === 'w') {
      numberedTokens.push(`${fullMoveNumber}. ${applied.san}`);
    } else if (numberedTokens.length === 0) {
      numberedTokens.push(`${fullMoveNumber}... ${applied.san}`);
    } else {
      numberedTokens.push(applied.san);
    }
  }

  const formattedSan = sanMoves.join(' ');
  return {
    sanMoves,
    uciMoves: validUciMoves,
    moveObjects,
    moves: moveObjects,
    formattedSan,
    sanLine: formattedSan,
    formattedNumberedSan: numberedTokens.join(' '),
    truncatedOnIllegal
  };
}

/**
 * Mengevaluasi posisi terminal (Checkmate / Stalemate / Draw) ketika tidak ada langkah legal (`bestmove (none)`).
 */
export function evaluateTerminalPosition(fen) {
  try {
    const chess = new Chess(fen);
    const turn = chess.turn();
    if (chess.isCheckmate()) {
      const evalInfo = normalizeScoreToWhitePerspective('mate', 0, turn);
      return {
        isTerminal: true,
        terminalType: 'checkmate',
        evaluation: evalInfo
      };
    }
    if (chess.isStalemate() || chess.isDraw()) {
      const evalInfo = normalizeScoreToWhitePerspective('cp', 0, turn);
      return {
        isTerminal: true,
        terminalType: chess.isStalemate() ? 'stalemate' : 'draw',
        evaluation: evalInfo
      };
    }
  } catch {
    // Abaikan jika FEN invalid
  }
  return {
    isTerminal: false,
    terminalType: null,
    evaluation: null
  };
}

export class ChessAnalysisEngineService {
  constructor({
    workerUrl = new URL('../vendor/stockfish/stockfish-19-lite-single.js', import.meta.url),
    workerFactory = null,
    initTimeoutMs = 15000,
    readyTimeoutMs = 10000,
    searchTimeoutBufferMs = 8000,
    defaultMoveTimeMs = DEFAULT_ANALYSIS_MOVETIME_MS
  } = {}) {
    this.workerUrl = workerUrl;
    this.workerFactory = workerFactory;
    this.initTimeoutMs = initTimeoutMs;
    this.readyTimeoutMs = readyTimeoutMs;
    this.searchTimeoutBufferMs = searchTimeoutBufferMs;
    this.defaultMoveTimeMs = defaultMoveTimeMs;

    this._worker = null;
    this._workerMessageHandler = null;
    this._workerErrorHandler = null;
    this._initPromise = null;
    this._isUciOk = false;
    this._isReady = false;
    this._state = ANALYSIS_ENGINE_STATES.IDLE;
    this._lastError = null;
    this._supportedOptions = new Map();
    this._engineInfo = {
      name: null,
      author: null
    };

    this._uciWaiter = null;
    this._readyWaiters = [];
    this._activeAnalysis = null;
    this._analysisRequestCounter = 0;
    this._activePositionFen = null;
    this._statusListeners = new Set();
  }

  get isReady() {
    return Boolean(this._worker && this._isUciOk && this._isReady);
  }

  isAnalyzing() {
    return Boolean(this._activeAnalysis && !this._activeAnalysis.cancelled);
  }

  getStatus() {
    return this._state;
  }

  getStatusLabel() {
    return ANALYSIS_ENGINE_STATE_LABELS[this._state] || 'Ready';
  }

  /**
   * Mendaftarkan listener perubahan status engine analisis
   */
  subscribeStatus(listener) {
    if (typeof listener !== 'function') return () => {};
    this._statusListeners.add(listener);
    return () => {
      this._statusListeners.delete(listener);
    };
  }

  onStatusChange(listener) {
    return this.subscribeStatus(listener);
  }

  _setState(newState, errorMessage = null) {
    this._state = newState;
    if (newState === ANALYSIS_ENGINE_STATES.ERROR) {
      this._lastError = errorMessage || 'Terjadi kendala pada engine analisis Stockfish.';
    } else if (newState !== ANALYSIS_ENGINE_STATES.ERROR) {
      this._lastError = null;
    }
    const statusSnapshot = this.getStatusSnapshot();
    for (const fn of this._statusListeners) {
      try {
        fn(statusSnapshot);
      } catch {
        // Jangan biarkan error listener merusak service
      }
    }
  }

  getStatusSnapshot() {
    const label = ANALYSIS_ENGINE_STATE_LABELS[this._state] || 'Ready';
    return {
      status: this._state,
      state: this._state,
      label,
      stateLabel: label,
      isWorkerActive: Boolean(this._worker),
      isUciOk: this._isUciOk,
      isReady: this._isReady,
      isAnalyzing: Boolean(this._activeAnalysis && !this._activeAnalysis.cancelled),
      activeRequestId: this._activeAnalysis ? this._activeAnalysis.requestId : null,
      activeFen: this._activeAnalysis ? this._activeAnalysis.fen : this._activePositionFen,
      errorMessage: this._lastError,
      engineInfo: { ...this._engineInfo },
      supportedOptions: Array.from(this._supportedOptions.keys())
    };
  }

  /**
   * Menginisialisasi Web Worker Stockfish 19 Lite dan menjalankan handshake UCI (`uci` -> `uciok`, `isready` -> `readyok`)
   */
  async init() {
    if (this._worker && this._isUciOk && this._isReady) {
      if (
        this._state === ANALYSIS_ENGINE_STATES.IDLE ||
        this._state === ANALYSIS_ENGINE_STATES.LOADING ||
        this._state === ANALYSIS_ENGINE_STATES.ERROR
      ) {
        this._setState(ANALYSIS_ENGINE_STATES.READY);
      }
      return true;
    }

    if (this._initPromise) {
      return this._initPromise;
    }

    this._initPromise = this._performInit();
    try {
      const ok = await this._initPromise;
      return ok;
    } catch (err) {
      this._initPromise = null;
      throw err;
    }
  }

  async _createWorkerInstance() {
    if (typeof this.workerFactory === 'function') {
      return await this.workerFactory(this.workerUrl);
    }
    if (typeof Worker === 'function') {
      const urlStr =
        this.workerUrl instanceof URL ? this.workerUrl.href : String(this.workerUrl);
      return new Worker(urlStr);
    }
    return await createNodeAnalysisWorkerAdapter(this.workerUrl);
  }

  async _performInit() {
    this._cleanupWorkerOnly(false);
    this._setState(ANALYSIS_ENGINE_STATES.LOADING);

    let worker;
    try {
      worker = await this._createWorkerInstance();
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? `Gagal memuat Web Worker Stockfish: ${err.message}`
          : 'Gagal membuat Web Worker Stockfish.';
      this._setState(ANALYSIS_ENGINE_STATES.ERROR, msg);
      throw new Error(msg);
    }

    if (!worker || typeof worker.postMessage !== 'function') {
      const msg = 'Web Worker Stockfish tidak valid atau tidak mendukung komunikasi postMessage.';
      this._setState(ANALYSIS_ENGINE_STATES.ERROR, msg);
      throw new Error(msg);
    }

    this._worker = worker;
    this._isUciOk = false;
    this._isReady = false;
    this._supportedOptions.clear();
    this._engineInfo = { name: null, author: null };

    const onMessage = event => {
      if (this._worker !== worker) return;
      const rawData = typeof event === 'string' ? event : event?.data;
      if (typeof rawData !== 'string') return;
      const lines = rawData.split(/\r?\n/);
      for (const line of lines) {
        this._handleEngineLine(line);
      }
    };

    const onError = err => {
      if (this._worker !== worker) return;
      const rawMsg =
        err instanceof Error
          ? err.message
          : typeof err?.message === 'string'
            ? err.message
            : 'Terjadi kegagalan pada Web Worker / WASM Stockfish.';
      const errorObj = new Error(rawMsg);
      this._setState(ANALYSIS_ENGINE_STATES.ERROR, rawMsg);
      this._rejectAllWaiters(errorObj);
    };

    this._workerMessageHandler = onMessage;
    this._workerErrorHandler = onError;

    if (typeof worker.addEventListener === 'function') {
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
    } else {
      worker.onmessage = onMessage;
      worker.onerror = onError;
    }

    try {
      // 1. Handshake UCI (`uci` -> `uciok`)
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          this._uciWaiter = null;
          reject(new Error('Waktu inisialisasi UCI Stockfish habis (timeout menunggu uciok).'));
        }, this.initTimeoutMs);

        this._uciWaiter = {
          resolve: () => {
            clearTimeout(timer);
            resolve();
          },
          reject: err => {
            clearTimeout(timer);
            reject(err);
          }
        };

        this._sendRawCommand('uci');
      });

      // Konfigurasi opsi standar analisis (Threads=1, MultiPV=1, Skill Level maksimum bila ada)
      this._sendRawCommand('setoption name Threads value 1');
      this._sendRawCommand('setoption name MultiPV value 1');
      if (this._supportedOptions.has('Skill Level')) {
        const optMeta = this._supportedOptions.get('Skill Level');
        const maxSkill = typeof optMeta?.max === 'number' ? optMeta.max : 20;
        this._sendRawCommand(`setoption name Skill Level value ${maxSkill}`);
      }

      // 2. Sinkronisasi kesiapan (`isready` -> `readyok`)
      await this.waitReady();

      this._setState(ANALYSIS_ENGINE_STATES.READY);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menginisialisasi engine Stockfish.';
      this._cleanupWorkerOnly(false);
      this._setState(ANALYSIS_ENGINE_STATES.ERROR, msg);
      throw err instanceof Error ? err : new Error(msg);
    }
  }

  _sendRawCommand(cmd) {
    if (!this._worker || typeof this._worker.postMessage !== 'function') {
      throw new Error('Web Worker Stockfish belum aktif.');
    }
    this._worker.postMessage(cmd);
  }

  async waitReady(timeoutMs = this.readyTimeoutMs) {
    if (!this._worker || !this._isUciOk) {
      throw new Error('Engine analisis belum menyelesaikan handshake UCI (uciok).');
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._readyWaiters = this._readyWaiters.filter(w => w !== waiterObj);
        reject(new Error('Engine analisis tidak merespons (timeout menunggu readyok).'));
      }, timeoutMs);

      const waiterObj = {
        resolve: () => {
          clearTimeout(timer);
          resolve(true);
        },
        reject: err => {
          clearTimeout(timer);
          reject(err);
        }
      };

      this._readyWaiters.push(waiterObj);
      this._sendRawCommand('isready');
    });
  }

  _handleEngineLine(rawLine) {
    if (typeof rawLine !== 'string') return;
    const line = rawLine.trim();
    if (!line) return;

    if (line.startsWith('id name ')) {
      this._engineInfo.name = line.slice('id name '.length).trim();
      return;
    }
    if (line.startsWith('id author ')) {
      this._engineInfo.author = line.slice('id author '.length).trim();
      return;
    }

    if (line.startsWith('option name ')) {
      const opt = parseUciOptionLine(line);
      if (opt && opt.name) {
        this._supportedOptions.set(opt.name, opt);
      }
      return;
    }

    if (line === 'uciok') {
      this._isUciOk = true;
      if (this._uciWaiter) {
        const waiter = this._uciWaiter;
        this._uciWaiter = null;
        waiter.resolve();
      }
      return;
    }

    if (line === 'readyok') {
      this._isReady = true;
      if (this._readyWaiters.length > 0) {
        const waiter = this._readyWaiters.shift();
        waiter.resolve();
      }
      return;
    }

    if (line.startsWith('info ')) {
      if (!this._activeAnalysis || this._activeAnalysis.cancelled) return;
      const parsedInfo = parseUciInfoLine(line);
      if (!parsedInfo) return;

      // Hanya gunakan jalur utama (multipv === 1) sesuai batasan MVP 5.4
      if (parsedInfo.multipv && parsedInfo.multipv > 1) return;

      const active = this._activeAnalysis;
      if (typeof parsedInfo.depth === 'number' && parsedInfo.depth >= active.maxDepth) {
        active.maxDepth = parsedInfo.depth;
      }
      if (parsedInfo.scoreType && typeof parsedInfo.rawScoreValue === 'number') {
        active.latestScoreType = parsedInfo.scoreType;
        active.latestRawScore = parsedInfo.rawScoreValue;
        if (typeof parsedInfo.depth === 'number') {
          active.latestScoreDepth = parsedInfo.depth;
        }
      }
      if (Array.isArray(parsedInfo.pvUciMoves) && parsedInfo.pvUciMoves.length > 0) {
        active.latestPvUciMoves = parsedInfo.pvUciMoves;
      }
      return;
    }

    if (line.startsWith('bestmove ')) {
      const bestMoveInfo = parseBestMoveLine(line);
      if (!this._activeAnalysis) return;

      const current = this._activeAnalysis;
      this._activeAnalysis = null;
      if (current.timeoutId) {
        clearTimeout(current.timeoutId);
        current.timeoutId = null;
      }

      const isStalePosition =
        this._activePositionFen && current.fen !== this._activePositionFen;

      if (current.cancelled || isStalePosition) {
        const stopReason = current.cancelReason || (isStalePosition ? 'position_changed' : 'stopped');
        if (this._state === ANALYSIS_ENGINE_STATES.ANALYZING) {
          this._setState(
            stopReason === 'stopped' || stopReason === 'stopped_by_user'
              ? ANALYSIS_ENGINE_STATES.STOPPED
              : ANALYSIS_ENGINE_STATES.READY
          );
        }
        current.resolve({
          ok: false,
          completed: false,
          cancelled: true,
          stopped: stopReason === 'stopped' || stopReason === 'stopped_by_user',
          stale: Boolean(isStalePosition || stopReason === 'position_changed'),
          reason: stopReason,
          requestId: current.requestId,
          fen: current.fen
        });
        return;
      }

      const finalResult = this._buildFinalAnalysisResult(current, bestMoveInfo, line);
      this._setState(ANALYSIS_ENGINE_STATES.READY);
      current.resolve(finalResult);
    }
  }

  _buildFinalAnalysisResult(analysisContext, bestMoveInfo, rawBestMoveLine) {
    const fen = analysisContext.fen;
    const turn = getTurnFromFen(fen);
    const uciBestMove = bestMoveInfo ? bestMoveInfo.uciMove : null;

    // Konversi evaluasi ke perspektif Putih
    let evaluation = null;
    if (
      analysisContext.latestScoreType &&
      typeof analysisContext.latestRawScore === 'number'
    ) {
      evaluation = normalizeScoreToWhitePerspective(
        analysisContext.latestScoreType,
        analysisContext.latestRawScore,
        turn
      );
    }

    // Jika posisi terminal (misal skakmat / stalemate) atau belum ada info score
    if (!evaluation) {
      const terminalCheck = evaluateTerminalPosition(fen);
      if (terminalCheck.isTerminal && terminalCheck.evaluation) {
        evaluation = terminalCheck.evaluation;
      } else {
        evaluation = normalizeScoreToWhitePerspective('cp', 0, turn);
      }
    }

    // Konversi Best Move UCI -> SAN dengan chess.js
    let bestMove = null;
    if (uciBestMove) {
      bestMove = convertUciMoveToSan(fen, uciBestMove);
    }

    // Jika bestmove dari baris `bestmove` tidak ada tetapi PV memiliki langkah pertama yang legal
    if (
      !bestMove &&
      Array.isArray(analysisContext.latestPvUciMoves) &&
      analysisContext.latestPvUciMoves.length > 0
    ) {
      bestMove = convertUciMoveToSan(fen, analysisContext.latestPvUciMoves[0]);
    }

    // Susun daftar UCI untuk Principal Variation (PV):
    // Pastikan langkah pertama PV konsisten dengan bestMove apabila PV kosong atau dimulai dengan bestMove
    let pvCandidateUci = Array.isArray(analysisContext.latestPvUciMoves)
      ? [...analysisContext.latestPvUciMoves]
      : [];
    if (bestMove && pvCandidateUci.length === 0) {
      pvCandidateUci = [bestMove.uci];
    } else if (bestMove && pvCandidateUci[0] !== bestMove.uci) {
      pvCandidateUci = [bestMove.uci];
    }

    const pvConverted = convertPvUciToSan(fen, pvCandidateUci, 12);
    const finalDepth =
      analysisContext.maxDepth > 0
        ? analysisContext.maxDepth
        : bestMove
          ? 1
          : 0;

    return {
      ok: true,
      completed: true,
      cancelled: false,
      stopped: false,
      stale: false,
      requestId: analysisContext.requestId,
      fen,
      turn,
      depth: finalDepth,
      evaluation,
      bestMove: bestMove
        ? {
            uci: bestMove.uci,
            san: bestMove.san,
            from: bestMove.from,
            to: bestMove.to,
            promotion: bestMove.promotion
          }
        : null,
      pv: {
        uciMoves: pvConverted.uciMoves,
        sanMoves: pvConverted.sanMoves,
        moveObjects: pvConverted.moveObjects,
        moves: pvConverted.moveObjects,
        formattedSan: pvConverted.formattedSan,
        sanLine: pvConverted.formattedSan,
        formattedNumberedSan: pvConverted.formattedNumberedSan,
        truncatedOnIllegal: pvConverted.truncatedOnIllegal
      },
      rawBestMoveLine
    };
  }

  /**
   * Memberitahu service bahwa posisi aktif pada papan telah berubah.
   * Jika ada analisis yang sedang berjalan untuk posisi lama, otomatis dihentikan & ditandai kedaluwarsa (stale).
   */
  async notifyPositionChanged(newFen) {
    const cleanFen = typeof newFen === 'string' ? newFen.trim() : null;
    this._activePositionFen = cleanFen;

    if (this._activeAnalysis && this._activeAnalysis.fen !== cleanFen) {
      await this.stopAnalysis('position_changed');
      return {
        stoppedPrevious: true,
        activeFen: cleanFen
      };
    }

    return {
      stoppedPrevious: false,
      activeFen: cleanFen
    };
  }

  /**
   * Menghentikan analisis yang sedang berlangsung dengan aman.
   */
  async stopAnalysis(reason = 'stopped') {
    const isUserStop = reason === 'stopped' || reason === 'stopped_by_user';
    if (!this._activeAnalysis) {
      if (isUserStop && this._state === ANALYSIS_ENGINE_STATES.ANALYZING) {
        this._setState(ANALYSIS_ENGINE_STATES.STOPPED);
      }
      return {
        stopped: false,
        reason
      };
    }

    const searchToStop = this._activeAnalysis;
    searchToStop.cancelled = true;
    searchToStop.cancelReason = reason;

    if (searchToStop.timeoutId) {
      clearTimeout(searchToStop.timeoutId);
      searchToStop.timeoutId = null;
    }

    if (this._worker && this._isUciOk) {
      try {
        this._sendRawCommand('stop');
      } catch {
        // Abaikan jika worker sudah ditutup
      }
    }

    this._activeAnalysis = null;
    this._setState(
      isUserStop ? ANALYSIS_ENGINE_STATES.STOPPED : ANALYSIS_ENGINE_STATES.READY
    );

    searchToStop.resolve({
      ok: false,
      completed: false,
      cancelled: true,
      stopped: isUserStop,
      stale: reason === 'position_changed' || reason === 'superseded',
      reason,
      requestId: searchToStop.requestId,
      fen: searchToStop.fen
    });

    if (this._worker && this._isUciOk && !isUserStop) {
      try {
        await this.waitReady();
      } catch {
        // Abaikan jika worker sedang di-reset
      }
    }

    return {
      stopped: true,
      reason,
      requestId: searchToStop.requestId
    };
  }

  /**
   * Menganalisis posisi FEN menggunakan Stockfish.
   * Mendukung pemanggilan `analyzePosition(fen, options)` maupun `analyzePosition({ fen, ... })`.
   * - Cegah permintaan analisis ganda yang tidak disengaja untuk FEN yang sama saat masih berjalan.
   * - Validasi FEN terlebih dahulu menggunakan `chess.js`.
   * - Hasil akhir hanya dikembalikan ketika `bestmove` diterima dari UCI.
   */
  async analyzePosition(fenOrOptions, maybeOptions = {}) {
    let fen = null;
    let opts = {};

    if (typeof fenOrOptions === 'string') {
      fen = fenOrOptions;
      opts = maybeOptions && typeof maybeOptions === 'object' ? maybeOptions : {};
    } else if (fenOrOptions && typeof fenOrOptions === 'object') {
      fen = fenOrOptions.fen;
      opts = fenOrOptions;
    }

    const moveTimeMs = opts.moveTimeMs ?? opts.movetime ?? null;
    const depth = opts.depth ?? null;
    const isMobile = Boolean(opts.isMobile);
    const allowDuplicateInFlight = Boolean(opts.allowDuplicateInFlight);

    if (!fen || typeof fen !== 'string' || !fen.trim()) {
      const msg = 'FEN posisi catur wajib diisi untuk menjalankan analisis Stockfish.';
      this._setState(ANALYSIS_ENGINE_STATES.ERROR, msg);
      return {
        ok: false,
        completed: false,
        cancelled: false,
        stopped: false,
        stale: false,
        errorMessage: msg
      };
    }

    const cleanFen = fen.trim();

    // Validasi FEN dengan Chess.js agar tidak mengirim FEN rusak ke engine
    let probeChess;
    try {
      probeChess = new Chess(cleanFen);
    } catch {
      const msg = 'Posisi FEN tidak valid dan tidak dapat dianalisis oleh Stockfish.';
      this._setState(ANALYSIS_ENGINE_STATES.ERROR, msg);
      return {
        ok: false,
        completed: false,
        cancelled: false,
        stopped: false,
        stale: false,
        fen: cleanFen,
        errorMessage: msg
      };
    }

    // Cegah permintaan analisis ganda yang tidak disengaja untuk posisi yang sama
    if (
      !allowDuplicateInFlight &&
      this._activeAnalysis &&
      !this._activeAnalysis.cancelled &&
      this._activeAnalysis.fen === cleanFen &&
      this._activeAnalysis.promise
    ) {
      return this._activeAnalysis.promise;
    }

    this._activePositionFen = cleanFen;

    // Jika ada analisis lama yang sedang berjalan, hentikan terlebih dahulu
    if (this._activeAnalysis) {
      await this.stopAnalysis('superseded');
    }

    const wasAlreadyReady = this.isReady;

    try {
      await this.init();
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'Gagal menginisialisasi engine Stockfish.';
      this._setState(ANALYSIS_ENGINE_STATES.ERROR, msg);
      return {
        ok: false,
        completed: false,
        cancelled: false,
        stopped: false,
        stale: false,
        fen: cleanFen,
        errorMessage: msg
      };
    }

    // Cek apakah posisi sudah berubah selama proses inisialisasi async
    if (this._activePositionFen && this._activePositionFen !== cleanFen) {
      return {
        ok: false,
        completed: false,
        cancelled: true,
        stopped: false,
        stale: true,
        reason: 'position_changed',
        requestId: ++this._analysisRequestCounter,
        fen: cleanFen
      };
    }

    // Jika posisi sudah terminal (Checkmate / Stalemate / Draw), kembalikan evaluasi akurat
    if (probeChess.isGameOver()) {
      const terminalInfo = evaluateTerminalPosition(cleanFen);
      const reqId = ++this._analysisRequestCounter;
      this._setState(ANALYSIS_ENGINE_STATES.READY);
      return {
        ok: true,
        completed: true,
        cancelled: false,
        stopped: false,
        stale: false,
        isTerminalPosition: true,
        terminalType: terminalInfo.terminalType,
        requestId: reqId,
        fen: cleanFen,
        turn: probeChess.turn(),
        depth: 0,
        evaluation:
          terminalInfo.evaluation ||
          normalizeScoreToWhitePerspective('cp', 0, probeChess.turn()),
        bestMove: null,
        pv: {
          uciMoves: [],
          sanMoves: [],
          moveObjects: [],
          moves: [],
          formattedSan: '',
          sanLine: '',
          formattedNumberedSan: '',
          truncatedOnIllegal: false
        },
        rawBestMoveLine: 'bestmove (none)'
      };
    }

    if (wasAlreadyReady) {
      try {
        await this.waitReady();
      } catch (err) {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Engine analisis tidak merespons (readyok gagal).';
        this._setState(ANALYSIS_ENGINE_STATES.ERROR, msg);
        return {
          ok: false,
          completed: false,
          cancelled: false,
          stopped: false,
          stale: false,
          fen: cleanFen,
          errorMessage: msg
        };
      }
    }

    if (this._activePositionFen && this._activePositionFen !== cleanFen) {
      return {
        ok: false,
        completed: false,
        cancelled: true,
        stopped: false,
        stale: true,
        reason: 'position_changed',
        requestId: ++this._analysisRequestCounter,
        fen: cleanFen
      };
    }

    const defaultTime = isMobile ? MOBILE_ANALYSIS_MOVETIME_MS : this.defaultMoveTimeMs;
    const requestedTime =
      typeof moveTimeMs === 'number' && Number.isFinite(moveTimeMs)
        ? Math.floor(moveTimeMs)
        : defaultTime;
    const effectiveMoveTime = Math.max(
      MIN_SAFE_ANALYSIS_MOVETIME_MS,
      Math.min(MAX_SAFE_ANALYSIS_MOVETIME_MS, requestedTime)
    );

    const effectiveDepth =
      typeof depth === 'number' && Number.isFinite(depth) && depth >= 1
        ? Math.min(22, Math.floor(depth))
        : null;

    const requestId = ++this._analysisRequestCounter;
    const totalTimeoutMs = Math.max(6000, effectiveMoveTime + this.searchTimeoutBufferMs);

    this._setState(ANALYSIS_ENGINE_STATES.ANALYZING);

    const searchPromise = new Promise(resolve => {
      const timeoutId = setTimeout(() => {
        if (this._activeAnalysis && this._activeAnalysis.requestId === requestId) {
          this._activeAnalysis = null;
          try {
            this._sendRawCommand('stop');
          } catch {
            // Abaikan
          }
          const timeoutMsg = 'Engine analisis tidak merespons dalam batas waktu yang ditentukan.';
          this._setState(ANALYSIS_ENGINE_STATES.ERROR, timeoutMsg);
          resolve({
            ok: false,
            completed: false,
            cancelled: false,
            stopped: false,
            stale: false,
            requestId,
            fen: cleanFen,
            errorMessage: timeoutMsg
          });
        }
      }, totalTimeoutMs);

      const handleRejectAsErrorResult = err => {
        const msg =
          err instanceof Error && err.message
            ? err.message
            : 'Terjadi kegagalan pada Web Worker / WASM Stockfish.';
        resolve({
          ok: false,
          completed: false,
          cancelled: false,
          stopped: false,
          stale: false,
          requestId,
          fen: cleanFen,
          errorMessage: msg
        });
      };

      this._activeAnalysis = {
        requestId,
        fen: cleanFen,
        cancelled: false,
        cancelReason: null,
        maxDepth: 0,
        latestScoreType: null,
        latestRawScore: null,
        latestScoreDepth: 0,
        latestPvUciMoves: [],
        timeoutId,
        resolve,
        reject: handleRejectAsErrorResult,
        promise: null
      };

      try {
        this._sendRawCommand(`position fen ${cleanFen}`);
        if (effectiveDepth !== null) {
          this._sendRawCommand(`go depth ${effectiveDepth} movetime ${effectiveMoveTime}`);
        } else {
          this._sendRawCommand(`go movetime ${effectiveMoveTime}`);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        this._activeAnalysis = null;
        const msg = err instanceof Error ? err.message : 'Gagal mengirim perintah analisis ke Stockfish.';
        this._setState(ANALYSIS_ENGINE_STATES.ERROR, msg);
        handleRejectAsErrorResult(err instanceof Error ? err : new Error(msg));
      }
    });

    if (this._activeAnalysis && this._activeAnalysis.requestId === requestId) {
      this._activeAnalysis.promise = searchPromise;
    }

    return searchPromise;
  }

  _rejectAllWaiters(errorObj) {
    if (this._uciWaiter) {
      const uciW = this._uciWaiter;
      this._uciWaiter = null;
      uciW.reject(errorObj);
    }

    while (this._readyWaiters.length > 0) {
      const rw = this._readyWaiters.shift();
      rw.reject(errorObj);
    }

    if (this._activeAnalysis) {
      const active = this._activeAnalysis;
      this._activeAnalysis = null;
      if (active.timeoutId) {
        clearTimeout(active.timeoutId);
      }
      active.reject(errorObj);
    }
  }

  _cleanupWorkerOnly(emitStateChange = true) {
    if (this._activeAnalysis) {
      const active = this._activeAnalysis;
      this._activeAnalysis = null;
      if (active.timeoutId) {
        clearTimeout(active.timeoutId);
      }
      active.resolve({
        ok: false,
        completed: false,
        cancelled: true,
        stopped: true,
        stale: true,
        reason: 'worker_terminated',
        requestId: active.requestId,
        fen: active.fen
      });
    }

    this._rejectAllWaiters(new Error('Web Worker Stockfish Analysis dihentikan.'));

    if (this._worker) {
      try {
        if (typeof this._worker.removeEventListener === 'function') {
          if (this._workerMessageHandler) {
            this._worker.removeEventListener('message', this._workerMessageHandler);
          }
          if (this._workerErrorHandler) {
            this._worker.removeEventListener('error', this._workerErrorHandler);
          }
        }
        this._worker.onmessage = null;
        this._worker.onerror = null;
        this._worker.terminate();
      } catch {
        // Abaikan error saat terminasi worker
      }
      this._worker = null;
    }

    this._workerMessageHandler = null;
    this._workerErrorHandler = null;
    this._isUciOk = false;
    this._isReady = false;
    if (emitStateChange) {
      this._setState(ANALYSIS_ENGINE_STATES.IDLE);
    }
  }

  /**
   * Menghentikan analisis aktif dan menutup Web Worker serta seluruh listener
   * saat pengguna meninggalkan halaman Chess Analysis Studio.
   */
  terminate() {
    this._initPromise = null;
    this._activePositionFen = null;
    this._cleanupWorkerOnly(true);
    this._statusListeners.clear();
  }

  destroy() {
    this.terminate();
  }
}

export const chessAnalysisEngine = new ChessAnalysisEngineService();
export default chessAnalysisEngine;
