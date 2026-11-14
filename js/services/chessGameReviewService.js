/**
 * Layanan Analisis Pertandingan PGN & Review Game (MVP 5.5 — Evaluation Graph & Game Review)
 *
 * Tanggung Jawab:
 * 1. Menerima PGN yang sudah divalidasi atau FEN snapshot partai.
 * 2. Menghasilkan snapshot FEN untuk seluruh urutan posisi (N+1 posisi untuk N ply).
 * 3. Menjalankan analisis engine Stockfish 19 Lite secara berurutan pada satu sesi aman.
 * 4. Mendukung jeda, pembatalan (stop), dan perlindungan hasil stale (request ID / session ID).
 * 5. Menghitung centipawn loss dan Move Classification (Best, Excellent, Good, Inaccuracy, Mistake, Blunder).
 * 6. Menangani skor mate secara khusus tanpa konversi centipawn palsu.
 * 7. Membangun dataset Evaluation Graph dan laporan ringkasan statistik Game Review.
 * 8. Zero Supabase Load & Zero LocalStorage Persistence (local-first & session-only).
 */

import { Chess } from '../vendor/chess.js';
import { parseUciMove } from '../components/chessboardUI.js';
import {
  chessAnalysisEngine,
  normalizeScoreToWhitePerspective,
  evaluateTerminalPosition,
  convertUciMoveToSan
} from './chessAnalysisEngineService.js';
import {
  MOVE_CLASSIFICATION,
  MOVE_CLASSIFICATION_META,
  CENTIPAWN_LOSS_THRESHOLDS,
  GAME_REVIEW_MOVETIME_MS,
  GAME_REVIEW_MOBILE_MOVETIME_MS
} from '../config/gameReviewConfig.js';

export const GAME_REVIEW_STATUS = {
  IDLE: 'idle',
  PREPARING: 'preparing',
  ANALYZING: 'analyzing',
  COMPLETED: 'completed',
  STOPPED: 'stopped',
  ERROR: 'error'
};

export const GAME_REVIEW_STATUS_LABELS = {
  [GAME_REVIEW_STATUS.IDLE]: 'Belum Dianalisis',
  [GAME_REVIEW_STATUS.PREPARING]: 'Mempersiapkan Posisi...',
  [GAME_REVIEW_STATUS.ANALYZING]: 'Menganalisis Pertandingan...',
  [GAME_REVIEW_STATUS.COMPLETED]: 'Analisis Selesai',
  [GAME_REVIEW_STATUS.STOPPED]: 'Analisis Dihentikan',
  [GAME_REVIEW_STATUS.ERROR]: 'Analisis Terkendala'
};

/**
 * Normalisasi UCI move string (e.g. "e2e4", "e7e8q") untuk perbandingan akurat
 */
export function normalizeUciMove(uci) {
  if (typeof uci !== 'string') return null;
  const parsed = parseUciMove(uci);
  if (!parsed || !parsed.from || !parsed.to) return null;
  return `${parsed.from}${parsed.to}${parsed.promotion ? parsed.promotion.toLowerCase() : ''}`;
}

/**
 * Menghasilkan snapshot seluruh posisi dari PGN atau parsed game
 * Mendukung custom initial FEN jika ada.
 */
export function generateGameSnapshots(parsedGame) {
  if (!parsedGame || !Array.isArray(parsedGame.moves)) {
    throw new Error('Data partai tidak valid atau tidak memiliki daftar langkah.');
  }

  const initialFen = parsedGame.initialFen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  let chess;
  try {
    chess = new Chess(initialFen);
  } catch (err) {
    throw new Error(`Initial FEN tidak valid: ${initialFen}`);
  }

  const snapshots = [];
  // Posisi awal (ply 0)
  snapshots.push({
    ply: 0,
    moveNumber: 1,
    turn: chess.turn(),
    fen: chess.fen(),
    playedMove: null, // Langkah yang membawa ke posisi ini
    playedMoveUci: null,
    san: null,
    comment: null,
    analysis: null // Diisi saat engine menganalisis
  });

  for (let i = 0; i < parsedGame.moves.length; i += 1) {
    const moveInfo = parsedGame.moves[i];
    let applied = null;
    try {
      if (typeof moveInfo === 'string') {
        applied = chess.move(moveInfo);
      } else if (moveInfo && moveInfo.san) {
        applied = chess.move(moveInfo.san);
      } else if (moveInfo && moveInfo.from && moveInfo.to) {
        applied = chess.move(moveInfo);
      }
    } catch {
      applied = null;
    }

    if (!applied) {
      break;
    }

    const currentTurn = chess.turn(); // Giliran pihak yang AKAN melangkah pada FEN baru
    const ply = i + 1;
    const moveNumber = Math.floor((ply - 1) / 2) + 1;
    const playedUci = `${applied.from}${applied.to}${applied.promotion ? applied.promotion.toLowerCase() : ''}`;

    snapshots.push({
      ply,
      moveNumber,
      turn: currentTurn, // Side to move in this snapshot
      playedBy: applied.color, // 'w' | 'b'
      fen: chess.fen(),
      playedMove: {
        san: applied.san,
        from: applied.from,
        to: applied.to,
        promotion: applied.promotion || null,
        piece: applied.piece,
        color: applied.color,
        captured: applied.captured || null,
        flags: applied.flags
      },
      playedMoveUci: playedUci,
      san: applied.san,
      comment: moveInfo?.comment || null,
      analysis: null
    });
  }

  return snapshots;
}

/**
 * Mengklasifikasikan langkah berdasarkan perbandingan evaluasi sebelum dan sesudah langkah.
 *
 * @param {Object} beforeSnap - Snapshot sebelum langkah (posisi awal langkah)
 * @param {Object} afterSnap - Snapshot sesudah langkah (posisi setelah langkah dimainkan)
 * @returns {Object} { classification, centipawnLoss, pawnsLoss, explanation, isMateRelated }
 */
export function classifyMove(beforeSnap, afterSnap) {
  // Support both (beforeSnap, afterSnap) signature and ({ evalBefore, evalAfter, moveObj, bestMove }) signature
  let before = beforeSnap;
  let after = afterSnap;

  if (beforeSnap && !afterSnap && beforeSnap.evalBefore !== undefined) {
    const opts = beforeSnap;
    const moveObj = opts.moveObj || {};
    const bestMove = opts.bestMove || null;
    const color = moveObj.color || 'w';
    const playedUci = (moveObj.from && moveObj.to) ? `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}` : '';
    const bestUci = bestMove ? (bestMove.uci || `${bestMove.from || ''}${bestMove.to || ''}${bestMove.promotion || ''}`) : '';

    before = {
      ply: color === 'w' ? 0 : 1,
      analysis: {
        evaluation: opts.evalBefore,
        bestMove: bestMove ? { uci: bestUci } : null
      }
    };

    after = {
      ply: color === 'w' ? 1 : 2,
      playedBy: color,
      playedMove: moveObj,
      playedMoveUci: playedUci,
      analysis: {
        evaluation: opts.evalAfter,
        bestMove: null
      }
    };
  }

  if (!before || !after || !after.playedMove) {
    return {
      classification: MOVE_CLASSIFICATION.GOOD,
      centipawnLoss: 0,
      pawnsLoss: 0,
      explanation: 'Posisi awal.',
      isMateRelated: false
    };
  }

  const color = after.playedBy || (after.ply % 2 === 1 ? 'w' : 'b');
  const playedUci = normalizeUciMove(after.playedMoveUci);
  const bestMoveBeforeUci = before.analysis?.bestMove ? normalizeUciMove(before.analysis.bestMove.uci) : null;

  // 1. Cek apakah langkah yang dimainkan sama persis dengan Best Move engine
  if (playedUci && bestMoveBeforeUci && playedUci === bestMoveBeforeUci) {
    return {
      classification: MOVE_CLASSIFICATION.BEST,
      centipawnLoss: 0,
      pawnsLoss: 0,
      explanation: 'Langkah terbaik sesuai rekomendasi Stockfish.',
      isMateRelated: false
    };
  }

  const evalBefore = before.analysis?.evaluation;
  const evalAfter = after.analysis?.evaluation;

  // 2. Penanganan Khusus Forced Mate
  const beforeIsMate = evalBefore && evalBefore.type === 'mate';
  const afterIsMate = evalAfter && evalAfter.type === 'mate';

  if (beforeIsMate || afterIsMate) {
    // Penanganan Mate
    return evaluateMateMoveClassification(color, evalBefore, evalAfter);
  }

  // 3. Penanganan Normal Centipawn Loss
  let cpBeforeWhite = 0;
  let cpAfterWhite = 0;

  if (evalBefore && typeof evalBefore.whiteCp === 'number') {
    cpBeforeWhite = evalBefore.whiteCp;
  }
  if (evalAfter && typeof evalAfter.whiteCp === 'number') {
    cpAfterWhite = evalAfter.whiteCp;
  }

  let cpLoss = 0;
  if (color === 'w') {
    cpLoss = Math.max(0, cpBeforeWhite - cpAfterWhite);
  } else {
    cpLoss = Math.max(0, cpAfterWhite - cpBeforeWhite);
  }

  const pawnsLoss = Number((cpLoss / 100).toFixed(2));
  let classification = MOVE_CLASSIFICATION.GOOD;

  if (cpLoss <= CENTIPAWN_LOSS_THRESHOLDS.EXCELLENT_MAX_CP) {
    classification = MOVE_CLASSIFICATION.EXCELLENT;
  } else if (cpLoss <= CENTIPAWN_LOSS_THRESHOLDS.GOOD_MAX_CP) {
    classification = MOVE_CLASSIFICATION.GOOD;
  } else if (cpLoss <= CENTIPAWN_LOSS_THRESHOLDS.INACCURACY_MAX_CP) {
    classification = MOVE_CLASSIFICATION.INACCURACY;
  } else if (cpLoss <= CENTIPAWN_LOSS_THRESHOLDS.MISTAKE_MAX_CP) {
    classification = MOVE_CLASSIFICATION.MISTAKE;
  } else {
    classification = MOVE_CLASSIFICATION.BLUNDER;
  }

  return {
    classification,
    centipawnLoss: cpLoss,
    pawnsLoss,
    explanation: MOVE_CLASSIFICATION_META[classification].description,
    isMateRelated: false
  };
}

/**
 * Logika evaluasi klasifikasi langkah yang melibatkan situasi Forced Mate
 */
function evaluateMateMoveClassification(color, evalBefore, evalAfter) {
  // Evaluasi sebelum dan sesudah sudah dari White perspective:
  // whiteMate > 0 -> White has forced mate in N
  // whiteMate < 0 -> Black has forced mate in N
  const beforeMate = evalBefore?.type === 'mate' ? evalBefore.whiteMate : null;
  const afterMate = evalAfter?.type === 'mate' ? evalAfter.whiteMate : null;

  const playerSideSign = color === 'w' ? 1 : -1;

  // Kasus A: Pemain sebelumnya memiliki forced mate (beforeMate * playerSideSign > 0)
  if (beforeMate !== null && beforeMate * playerSideSign > 0) {
    // Jika sesudah melangkah posisi masih forced mate untuk pemain
    if (afterMate !== null && afterMate * playerSideSign > 0) {
      const movesBefore = Math.abs(beforeMate);
      const movesAfter = Math.abs(afterMate);
      if (movesAfter <= movesBefore) {
        return {
          classification: MOVE_CLASSIFICATION.BEST,
          centipawnLoss: 0,
          pawnsLoss: 0,
          explanation: 'Mempertahankan atau mempercepat skakmat paksa.',
          isMateRelated: true
        };
      } else {
        // Memperpanjang mate
        return {
          classification: MOVE_CLASSIFICATION.INACCURACY,
          centipawnLoss: 45,
          pawnsLoss: 0.45,
          explanation: 'Memperlambat skakmat paksa.',
          isMateRelated: true
        };
      }
    } else {
      // Melewatkan forced mate dan lawan tidak lagi terkena mate paksa
      return {
        classification: MOVE_CLASSIFICATION.BLUNDER,
        centipawnLoss: 300,
        pawnsLoss: 3.0,
        explanation: 'Melewatkan skakmat paksa yang tersedia.',
        isMateRelated: true
      };
    }
  }

  // Kasus B: Pemain sebelumnya TIDAK sedang terkena forced mate (beforeMate * playerSideSign >= 0 atau beforeMate == null),
  // tetapi sesudah melangkah justru terkena forced mate lawan (afterMate * playerSideSign < 0)
  if (
    (beforeMate === null || beforeMate * playerSideSign >= 0) &&
    afterMate !== null &&
    afterMate * playerSideSign < 0
  ) {
    return {
      classification: MOVE_CLASSIFICATION.BLUNDER,
      centipawnLoss: 400,
      pawnsLoss: 4.0,
      explanation: 'Mengizinkan lawan melakukan skakmat paksa.',
      isMateRelated: true
    };
  }

  // Kasus C: Pemain sebelumnya memang sudah terkena forced mate
  if (beforeMate !== null && beforeMate * playerSideSign < 0) {
    if (afterMate !== null && afterMate * playerSideSign < 0) {
      return {
        classification: MOVE_CLASSIFICATION.GOOD,
        centipawnLoss: 20,
        pawnsLoss: 0.2,
        explanation: 'Posisi sudah dalam keadaan skakmat paksa lawan.',
        isMateRelated: true
      };
    } else {
      // Lawan kehilangan mate
      return {
        classification: MOVE_CLASSIFICATION.EXCELLENT,
        centipawnLoss: 0,
        pawnsLoss: 0,
        explanation: 'Berhasil lolos dari skakmat paksa.',
        isMateRelated: true
      };
    }
  }

  // Fallback jika tidak tercakup secara eksplisit
  return {
    classification: MOVE_CLASSIFICATION.GOOD,
    centipawnLoss: 0,
    pawnsLoss: 0,
    explanation: 'Langkah dalam situasi skakmat.',
    isMateRelated: true
  };
}

/**
 * Menghasilkan dataset terstruktur untuk Evaluation Graph
 */
export function buildEvaluationGraphData(snapshots = []) {
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return {
      points: [],
      minScore: -3,
      maxScore: 3,
      hasMate: false
    };
  }

  let hasMate = false;
  const points = snapshots.map((snap, index) => {
    const ply = snap.ply;
    const moveNumber = snap.moveNumber;
    const evalData = snap.analysis?.evaluation;

    let displayEval = '0.00';
    let numericScore = 0; // Skala -5.0 sampai +5.0 untuk grafik visual
    let rawScore = 0;
    let isMate = false;
    let mateValue = null;
    let advantage = 'equal';
    let label = 'Posisi seimbang';

    if (evalData) {
      advantage = evalData.advantage || 'equal';
      label = evalData.advantageLabel || 'Posisi seimbang';
      if (evalData.type === 'mate') {
        isMate = true;
        hasMate = true;
        mateValue = evalData.whiteMate;
        // Skala visual mate dijepit pada batas ±4.5 agar grafik tetap proporsional
        // whiteMate > 0 -> White forced mate, whiteMate < 0 -> Black forced mate
        // Jika whiteMate === 0, tentukan arah keunggulan berdasarkan winningSide / advantage
        if (evalData.whiteMate > 0 || evalData.winningSide === 'w' || evalData.advantage === 'white') {
          numericScore = 4.5;
        } else if (evalData.whiteMate < 0 || evalData.winningSide === 'b' || evalData.advantage === 'black') {
          numericScore = -4.5;
        } else {
          numericScore = 0;
        }
        displayEval = evalData.formatted || (evalData.whiteMate !== null ? `M${Math.abs(evalData.whiteMate || 0)}` : 'Mate');
        rawScore = evalData.whiteMate;
      } else {
        const pawns = typeof evalData.pawns === 'number' ? evalData.pawns : 0;
        rawScore = evalData.whiteCp || 0;
        // Clamp visual antara -4.0 dan +4.0 pawns
        numericScore = Math.max(-4.0, Math.min(4.0, pawns));
        displayEval = evalData.formatted || '0.00';
      }
    }

    const playedMoveSan = snap.playedMove ? snap.playedMove.san : (ply === 0 ? 'Posisi Awal' : null);
    const classification = snap.classification || null;

    return {
      index,
      ply,
      moveNumber,
      turn: snap.turn,
      playedBy: snap.playedBy || null,
      san: playedMoveSan,
      fen: snap.fen,
      score: numericScore,
      rawScore,
      displayEval,
      isMate,
      mateValue,
      advantage,
      label,
      classification
    };
  });

  return {
    points,
    minScore: -3.5,
    maxScore: 3.5,
    hasMate
  };
}

/**
 * Menghitung ringkasan statistik Game Review untuk Putih dan Hitam serta Critical Moments
 */
export function buildGameReviewReport(snapshotsOrGame = [], metadataOrSnapshots = {}) {
  let snapshots = snapshotsOrGame;
  let metadata = metadataOrSnapshots;

  // Support both buildGameReviewReport(snapshots, metadata) and buildGameReviewReport(parsedGame, snapshots)
  if (snapshotsOrGame && Array.isArray(snapshotsOrGame.moves) && Array.isArray(metadataOrSnapshots)) {
    metadata = {
      white: snapshotsOrGame.headers?.White || snapshotsOrGame.white,
      black: snapshotsOrGame.headers?.Black || snapshotsOrGame.black,
      result: snapshotsOrGame.headers?.Result || snapshotsOrGame.result,
      event: snapshotsOrGame.headers?.Event || snapshotsOrGame.event,
      date: snapshotsOrGame.headers?.Date || snapshotsOrGame.date
    };
    snapshots = metadataOrSnapshots;
  }

  const whiteStats = {
    [MOVE_CLASSIFICATION.BEST]: 0,
    [MOVE_CLASSIFICATION.EXCELLENT]: 0,
    [MOVE_CLASSIFICATION.GOOD]: 0,
    [MOVE_CLASSIFICATION.INACCURACY]: 0,
    [MOVE_CLASSIFICATION.MISTAKE]: 0,
    [MOVE_CLASSIFICATION.BLUNDER]: 0,
    totalMoves: 0
  };

  const blackStats = {
    [MOVE_CLASSIFICATION.BEST]: 0,
    [MOVE_CLASSIFICATION.EXCELLENT]: 0,
    [MOVE_CLASSIFICATION.GOOD]: 0,
    [MOVE_CLASSIFICATION.INACCURACY]: 0,
    [MOVE_CLASSIFICATION.MISTAKE]: 0,
    [MOVE_CLASSIFICATION.BLUNDER]: 0,
    totalMoves: 0
  };

  const criticalMoments = [];
  const moveReviewList = [];

  // Lewati ply 0 (posisi awal) untuk review langkah
  for (let i = 1; i < snapshots.length; i += 1) {
    const snap = snapshots[i];
    const prevSnap = snapshots[i - 1];
    const color = snap.playedBy || (snap.ply % 2 === 1 ? 'w' : 'b');
    const classInfo = snap.classification || classifyMove(prevSnap, snap);
    snap.classification = classInfo;

    const stats = color === 'w' ? whiteStats : blackStats;
    if (stats[classInfo.classification] !== undefined) {
      stats[classInfo.classification] += 1;
      stats.totalMoves += 1;
    }

    const item = {
      ply: snap.ply,
      moveNumber: snap.moveNumber,
      playedBy: color,
      san: snap.san,
      fen: snap.fen,
      classification: classInfo.classification,
      classificationMeta: MOVE_CLASSIFICATION_META[classInfo.classification] || MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.GOOD],
      centipawnLoss: classInfo.centipawnLoss,
      pawnsLoss: classInfo.pawnsLoss,
      evalBefore: prevSnap.analysis?.evaluation || null,
      evalAfter: snap.analysis?.evaluation || null,
      bestMove: prevSnap.analysis?.bestMove || null,
      isMateRelated: Boolean(classInfo.isMateRelated)
    };
    moveReviewList.push(item);

    // Momen Penting: Blunder, Mistake, atau perubahan drastis
    if (
      classInfo.classification === MOVE_CLASSIFICATION.BLUNDER ||
      classInfo.classification === MOVE_CLASSIFICATION.MISTAKE ||
      classInfo.centipawnLoss >= 90
    ) {
      criticalMoments.push({
        ...item,
        severity: classInfo.classification === MOVE_CLASSIFICATION.BLUNDER ? 'high' : 'medium'
      });
    }
  }

  // Urutkan momen kritis berdasarkan besarnya kerugian (loss)
  criticalMoments.sort((a, b) => (b.centipawnLoss || 0) - (a.centipawnLoss || 0));

  return {
    gameInfo: {
      white: metadata.white || 'Pemain Putih',
      black: metadata.black || 'Pemain Hitam',
      result: metadata.result || '*',
      event: metadata.event || 'Partai Caturan',
      date: metadata.date || '?',
      totalPlies: snapshots.length > 0 ? snapshots.length - 1 : 0,
      totalMoves: Math.ceil((snapshots.length > 0 ? snapshots.length - 1 : 0) / 2)
    },
    evaluatedPositions: snapshots.length,
    whiteStats,
    blackStats,
    criticalMoments,
    moveReviewList
  };
}

/**
 * Service Game Review Utama
 */
export class ChessGameReviewService {
  constructor({ engineService = chessAnalysisEngine } = {}) {
    this.engineService = engineService;
    this._status = GAME_REVIEW_STATUS.IDLE;
    this._progress = {
      current: 0,
      total: 0,
      percent: 0,
      currentPly: 0
    };
    this._activeSessionId = 0;
    this._isCancelled = false;
    this._snapshots = [];
    this._report = null;
    this._graphData = null;
    this._listeners = new Set();
  }

  getStatus() {
    return this._status;
  }

  isAnalyzing() {
    return this._status === GAME_REVIEW_STATUS.ANALYZING || this._status === GAME_REVIEW_STATUS.PREPARING;
  }

  getProgress() {
    return { ...this._progress };
  }

  getReport() {
    return this._report;
  }

  getGraphData() {
    return this._graphData;
  }

  getSnapshots() {
    return this._snapshots;
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  _notify(data = {}) {
    const payload = {
      status: this._status,
      statusLabel: GAME_REVIEW_STATUS_LABELS[this._status] || 'Idle',
      progress: { ...this._progress },
      report: this._report,
      graphData: this._graphData,
      snapshots: this._snapshots,
      ...data
    };
    for (const listener of this._listeners) {
      try {
        listener(payload);
      } catch {
        // Abaikan error listener
      }
    }
  }

  /**
   * Menghentikan proses review yang sedang berjalan
   */
  stopAnalysis(reason = 'user_cancelled') {
    if (this._status === GAME_REVIEW_STATUS.ANALYZING || this._status === GAME_REVIEW_STATUS.PREPARING) {
      this._isCancelled = true;
      if (this.engineService && typeof this.engineService.stopAnalysis === 'function') {
        try {
          this.engineService.stopAnalysis('game_review_stopped_by_user');
        } catch {
          // Abaikan
        }
      }
      this._status = GAME_REVIEW_STATUS.STOPPED;
      this._notify({ stopped: true, reason: 'Pengguna menghentikan analisis pertandingan.' });
      return { stopped: true };
    }
    return { stopped: false };
  }

  stopGameReview(reason = 'user_cancelled') {
    return this.stopAnalysis(reason);
  }

  /**
   * Reset data review sesi ini
   */
  reset() {
    this._isCancelled = true;
    this._status = GAME_REVIEW_STATUS.IDLE;
    this._progress = { current: 0, total: 0, percent: 0, currentPly: 0 };
    this._snapshots = [];
    this._report = null;
    this._graphData = null;
    this._notify();
  }

  _generateSessionId() {
    return ++this._activeSessionId;
  }

  _isSessionValid(sessionId) {
    return this._activeSessionId === sessionId && !this._isCancelled;
  }

  async analyzeFullGame(parsedGame, { engineService = this.engineService, moveTimeMs = null, isMobile = false, onProgress = null } = {}) {
    if (engineService) {
      this.engineService = engineService;
    }
    let unsub = null;
    if (typeof onProgress === 'function') {
      unsub = this.subscribe((state) => {
        if (state.progress) {
          onProgress(state.progress);
        }
      });
    }

    try {
      const res = await this.analyzeGame(parsedGame, { moveTimeMs, isMobile });
      return { ok: true, status: this._status, totalPositions: this._snapshots.length, ...res };
    } catch (err) {
      return { ok: false, status: this._status, error: err.message };
    } finally {
      if (unsub) unsub();
    }
  }

  /**
   * Menjalankan analisis seluruh posisi untuk partai PGN
   * @param {Object} parsedGame - Objek hasil parse dari pgnService
   * @param {Object} options - { moveTimeMs, isMobile }
   */
  async analyzeGame(parsedGame, { moveTimeMs = null, isMobile = false } = {}) {
    if (!parsedGame || !Array.isArray(parsedGame.moves)) {
      this._status = GAME_REVIEW_STATUS.ERROR;
      const errorMsg = 'Partai PGN tidak valid untuk dilakukan Game Review.';
      this._notify({ error: errorMsg });
      throw new Error(errorMsg);
    }

    const sessionId = ++this._activeSessionId;
    this._isCancelled = false;
    this._status = GAME_REVIEW_STATUS.PREPARING;

    let snapshots;
    try {
      snapshots = generateGameSnapshots(parsedGame);
    } catch (err) {
      this._status = GAME_REVIEW_STATUS.ERROR;
      const msg = err instanceof Error ? err.message : 'Gagal membuat snapshot posisi permainan.';
      this._notify({ error: msg });
      throw new Error(msg);
    }

    this._snapshots = snapshots;
    const totalPositions = snapshots.length;
    this._progress = {
      current: 0,
      total: totalPositions,
      percent: 0,
      currentPly: 0
    };
    this._notify();

    // Pastikan engine siap jika ada method init
    if (this.engineService && typeof this.engineService.init === 'function') {
      try {
        await this.engineService.init();
      } catch (err) {
        if (this._activeSessionId !== sessionId) return;
        this._status = GAME_REVIEW_STATUS.ERROR;
        const msg = err instanceof Error ? err.message : 'Gagal menginisialisasi Stockfish Engine.';
        this._notify({ error: msg });
        throw new Error(msg);
      }
    }

    if (this._isCancelled || this._activeSessionId !== sessionId) {
      return;
    }

    this._status = GAME_REVIEW_STATUS.ANALYZING;
    const effectiveMoveTime =
      typeof moveTimeMs === 'number' && moveTimeMs > 0
        ? moveTimeMs
        : isMobile
          ? GAME_REVIEW_MOBILE_MOVETIME_MS
          : GAME_REVIEW_MOVETIME_MS;

    for (let i = 0; i < snapshots.length; i += 1) {
      if (this._isCancelled || this._activeSessionId !== sessionId) {
        this._status = GAME_REVIEW_STATUS.STOPPED;
        this._notify();
        return;
      }

      const snap = snapshots[i];
      this._progress.current = i;
      this._progress.currentPly = snap.ply;
      this._progress.percent = Math.floor((i / totalPositions) * 100);
      this._notify();

      let result;
      try {
        result = await this.engineService.analyzePosition(snap.fen, {
          moveTimeMs: effectiveMoveTime,
          isMobile,
          allowDuplicateInFlight: true
        });
      } catch (err) {
        if (this._isCancelled || this._activeSessionId !== sessionId) return;
        this._status = GAME_REVIEW_STATUS.ERROR;
        const msg = err instanceof Error ? err.message : `Gagal menganalisis ply ${snap.ply}`;
        this._notify({ error: msg });
        throw new Error(msg);
      }

      if (this._isCancelled || this._activeSessionId !== sessionId) {
        this._status = GAME_REVIEW_STATUS.STOPPED;
        this._notify();
        return;
      }

      if (result && result.ok) {
        snap.analysis = result;
      } else if (result && result.cancelled) {
        this._status = GAME_REVIEW_STATUS.STOPPED;
        this._notify();
        return;
      } else {
        // Fallback evaluasi posisi terminal atau default seimbang
        const terminal = evaluateTerminalPosition(snap.fen);
        snap.analysis = {
          ok: true,
          fen: snap.fen,
          depth: 0,
          evaluation: terminal.evaluation || normalizeScoreToWhitePerspective('cp', 0, snap.turn),
          bestMove: null,
          pv: { moves: [], formattedSan: '' }
        };
      }

      // Hitung klasifikasi jika sudah ada snapshot sebelumnya
      if (i > 0) {
        snap.classification = classifyMove(snapshots[i - 1], snap);
      }

      this._progress.current = i + 1;
      this._progress.percent = Math.floor(((i + 1) / totalPositions) * 100);
      // Buat grafik evaluasi parsial secara real-time
      this._graphData = buildEvaluationGraphData(snapshots.slice(0, i + 1));
      this._notify();
    }

    if (this._activeSessionId !== sessionId) {
      return;
    }

    // Bangun laporan akhir Game Review
    this._status = GAME_REVIEW_STATUS.COMPLETED;
    this._progress.current = totalPositions;
    this._progress.percent = 100;
    this._graphData = buildEvaluationGraphData(snapshots);
    this._report = buildGameReviewReport(snapshots, parsedGame.headers || {});
    this._notify({ completed: true });

    return {
      status: this._status,
      report: this._report,
      graphData: this._graphData,
      snapshots: this._snapshots
    };
  }

  destroy() {
    this.reset();
    this._listeners.clear();
  }
}

export const chessGameReview = new ChessGameReviewService();
export default chessGameReview;
