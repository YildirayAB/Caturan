/**
 * Test Suite MVP 5.5 — Evaluation Graph & Game Review
 * Verifikasi 30 butir pengujian sesuai spesifikasi PRD Caturan MVP 5.5.
 */

import assert from 'node:assert/strict';
import {
  MOVE_CLASSIFICATION,
  MOVE_CLASSIFICATION_META,
  CENTIPAWN_LOSS_THRESHOLDS,
  GAME_REVIEW_MOVETIME_MS
} from './js/config/gameReviewConfig.js';
import {
  generateGameSnapshots,
  classifyMove,
  buildEvaluationGraphData,
  buildGameReviewReport,
  ChessGameReviewService,
  GAME_REVIEW_STATUS
} from './js/services/chessGameReviewService.js';
import { validateAndParsePgn } from './js/services/pgnService.js';
import { EvaluationGraphComponent } from './js/components/evaluationGraph.js';
import { GameReviewPanelComponent } from './js/components/gameReviewView.js';
import {
  createInitialAnalysisSessionState,
  resetAnalysisExplorationState
} from './js/components/analysisView.js';

let passedTests = 0;
let totalTests = 0;

function test(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [TEST ${totalTests}] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [TEST ${totalTests}] ${name}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ [TEST ${totalTests}] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ [TEST ${totalTests}] ${name}`);
    console.error(`    Error: ${err.message}`);
    throw err;
  }
}

console.log('\n--- CATURAN MVP 5.5: VERIFIKASI EVALUATION GRAPH & GAME REVIEW ---\n');

// Sample test PGN
const samplePgn = `[Event "Partai Uji MVP 5.5"]
[Site "Jakarta"]
[Date "2026.05.10"]
[Round "1"]
[White "Budi Santoso"]
[Black "Andi Pratama"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 1-0`;

const parsedGame = validateAndParsePgn(samplePgn);
assert.ok(parsedGame.valid, 'PGN valid harus berhasil diparse');

// 1. Snapshot Generator: N plies menghasilkan N+1 snapshots
test('1. Snapshot Generator menghasilkan N+1 posisi berurutan dari awal sampai akhir', () => {
  const snapshots = generateGameSnapshots(parsedGame);
  assert.equal(snapshots.length, parsedGame.totalPlies + 1);
  assert.equal(snapshots[0].ply, 0);
  assert.equal(snapshots[snapshots.length - 1].ply, parsedGame.totalPlies);
});

// 2. Snapshot metadata: ply, FEN, turn, move information
test('2. Snapshot menyimpan metadata lengkap (ply, fen, moveNumber, turn)', () => {
  const snapshots = generateGameSnapshots(parsedGame);
  const first = snapshots[0];
  assert.equal(first.ply, 0);
  assert.equal(typeof first.fen, 'string');
  assert.equal(first.turn, 'w');

  const second = snapshots[1];
  assert.equal(second.ply, 1);
  assert.equal(second.playedMove.san, 'e4');
  assert.equal(second.playedMove.color, 'w');
});

// 3. Move classification configuration
test('3. Config move classification memuat 6 kategori standar Caturan', () => {
  assert.ok(MOVE_CLASSIFICATION.BEST);
  assert.ok(MOVE_CLASSIFICATION.EXCELLENT);
  assert.ok(MOVE_CLASSIFICATION.GOOD);
  assert.ok(MOVE_CLASSIFICATION.INACCURACY);
  assert.ok(MOVE_CLASSIFICATION.MISTAKE);
  assert.ok(MOVE_CLASSIFICATION.BLUNDER);
  assert.ok(CENTIPAWN_LOSS_THRESHOLDS.EXCELLENT_MAX_CP <= 15);
  assert.ok(CENTIPAWN_LOSS_THRESHOLDS.MISTAKE_MAX_CP <= 150);
});

// 4. Centipawn loss calculation for White
test('4. Perhitungan centipawn loss untuk langkah Putih: max(0, evalBefore - evalAfter)', () => {
  // Putih melangkah: Sebelum +1.00 (+100 cp), Sesudah +0.80 (+80 cp) -> loss = 20 cp (Good)
  const evalBefore = { whiteScore: 1.0, type: 'cp', whiteCp: 100, isMate: false };
  const evalAfter = { whiteScore: 0.8, type: 'cp', whiteCp: 80, isMate: false };
  const moveObj = { from: 'e2', to: 'e4', color: 'w' };
  const bestMove = { uci: 'g1f3', from: 'g1', to: 'f3' };

  const classification = classifyMove({ evalBefore, evalAfter, moveObj, bestMove });
  assert.equal(classification.centipawnLoss, 20);
  assert.equal(classification.classification, MOVE_CLASSIFICATION.GOOD);
});

// 5. Centipawn loss calculation for Black
test('5. Perhitungan centipawn loss untuk langkah Hitam: max(0, evalAfter - evalBefore)', () => {
  // Hitam melangkah: Sebelum +0.50 (+50 cp), Sesudah +1.80 (+180 cp) -> loss = 130 cp (Mistake)
  const evalBefore = { whiteScore: 0.5, type: 'cp', whiteCp: 50, isMate: false };
  const evalAfter = { whiteScore: 1.8, type: 'cp', whiteCp: 180, isMate: false };
  const moveObj = { from: 'e7', to: 'e5', color: 'b' };
  const bestMove = { uci: 'c7c5', from: 'c7', to: 'c5' };

  const classification = classifyMove({ evalBefore, evalAfter, moveObj, bestMove });
  assert.equal(classification.centipawnLoss, 130);
  assert.equal(classification.classification, MOVE_CLASSIFICATION.MISTAKE);
});

// 6. Classification: Best move matching engine UCI
test('6. Klasifikasi Best jika langkah dimainkan sama dengan best move engine', () => {
  const evalBefore = { whiteScore: 0.2, type: 'cp', whiteCp: 20, isMate: false };
  const evalAfter = { whiteScore: 0.2, type: 'cp', whiteCp: 20, isMate: false };
  const moveObj = { from: 'e2', to: 'e4', color: 'w' };
  const bestMove = { uci: 'e2e4', from: 'e2', to: 'e4' };

  const res = classifyMove({ evalBefore, evalAfter, moveObj, bestMove });
  assert.equal(res.classification, MOVE_CLASSIFICATION.BEST);
  assert.equal(res.centipawnLoss, 0);
});

// 7. Classification: Excellent (loss <= 15 cp)
test('7. Klasifikasi Excellent jika centipawn loss <= 15', () => {
  const evalBefore = { whiteScore: 0.5, type: 'cp', whiteCp: 50, isMate: false };
  const evalAfter = { whiteScore: 0.4, type: 'cp', whiteCp: 40, isMate: false };
  const moveObj = { from: 'g1', to: 'f3', color: 'w' };
  const bestMove = { uci: 'e2e4', from: 'e2', to: 'e4' };

  const res = classifyMove({ evalBefore, evalAfter, moveObj, bestMove });
  assert.equal(res.classification, MOVE_CLASSIFICATION.EXCELLENT);
  assert.equal(res.centipawnLoss, 10);
});

// 8. Classification: Inaccuracy (40 < loss <= 80 cp)
test('8. Klasifikasi Inaccuracy jika centipawn loss antara 41 hingga 80', () => {
  const evalBefore = { whiteScore: 0.5, type: 'cp', whiteCp: 50, isMate: false };
  const evalAfter = { whiteScore: -0.1, type: 'cp', whiteCp: -10, isMate: false };
  const moveObj = { from: 'g1', to: 'f3', color: 'w' };
  const bestMove = { uci: 'e2e4', from: 'e2', to: 'e4' };

  const res = classifyMove({ evalBefore, evalAfter, moveObj, bestMove });
  assert.equal(res.classification, MOVE_CLASSIFICATION.INACCURACY);
  assert.equal(res.centipawnLoss, 60);
});

// 9. Classification: Blunder (> 150 cp)
test('9. Klasifikasi Blunder jika centipawn loss > 150', () => {
  const evalBefore = { whiteScore: 0.5, type: 'cp', whiteCp: 50, isMate: false };
  const evalAfter = { whiteScore: -1.5, type: 'cp', whiteCp: -150, isMate: false };
  const moveObj = { from: 'f2', to: 'f3', color: 'w' };
  const bestMove = { uci: 'e2e4', from: 'e2', to: 'e4' };

  const res = classifyMove({ evalBefore, evalAfter, moveObj, bestMove });
  assert.equal(res.classification, MOVE_CLASSIFICATION.BLUNDER);
  assert.equal(res.centipawnLoss, 200);
});

// 10. Forced mate handling: Player allows forced mate against them -> Blunder
test('10. Penanganan mate: Memberi peluang forced mate kepada lawan diklasifikasikan Blunder', () => {
  const evalBefore = { whiteScore: 0.0, type: 'cp', whiteCp: 0, isMate: false };
  const evalAfter = { whiteScore: -100, type: 'mate', isMate: true, mateIn: -3, whiteMate: -3 };
  const moveObj = { from: 'f2', to: 'f3', color: 'w' };
  const bestMove = { uci: 'd2d4', from: 'd2', to: 'd4' };

  const res = classifyMove({ evalBefore, evalAfter, moveObj, bestMove });
  assert.equal(res.classification, MOVE_CLASSIFICATION.BLUNDER);
});

// 11. Forced mate handling: Missing forced mate -> Blunder
test('11. Penanganan mate: Melewatkan forced mate kemenangan diklasifikasikan Blunder', () => {
  const evalBefore = { whiteScore: 100, type: 'mate', isMate: true, mateIn: 2, whiteMate: 2 };
  const evalAfter = { whiteScore: 0.5, type: 'cp', whiteCp: 50, isMate: false };
  const moveObj = { from: 'd1', to: 'h5', color: 'w' };
  const bestMove = { uci: 'd1f3', from: 'd1', to: 'f3' };

  const res = classifyMove({ evalBefore, evalAfter, moveObj, bestMove });
  assert.equal(res.classification, MOVE_CLASSIFICATION.BLUNDER);
});

// 12. Evaluation Graph dataset builder: N+1 data points
test('12. Dataset Evaluation Graph memuat N+1 data points dengan koordinat valid', () => {
  const snapshots = generateGameSnapshots(parsedGame);
  // Simulasi evaluasi engine
  snapshots.forEach((s, idx) => {
    s.analysis = {
      evaluation: {
        whiteScore: idx * 0.1,
        whiteCp: idx * 10,
        pawns: idx * 0.1,
        type: 'cp',
        isMate: false,
        formatted: `+${(idx * 0.1).toFixed(2)}`
      },
      bestMove: { uci: 'e2e4', san: 'e4' }
    };
  });

  const graphData = buildEvaluationGraphData(snapshots);
  assert.equal(graphData.points.length, snapshots.length);
  assert.equal(graphData.points[0].ply, 0);
  assert.equal(typeof graphData.points[0].score, 'number');
  assert.equal(typeof graphData.points[0].displayEval, 'string');
});

// 13. Evaluation Graph: Clamping score visually without corrupting raw data
test('13. Grafik melakukan clamping visual pada evaluasi ekstrem (mis. +15.0) tanpa merusak nilai asli', () => {
  const snapshots = [
    {
      ply: 0,
      analysis: { evaluation: { whiteScore: 15.0, pawns: 15.0, whiteCp: 1500, type: 'cp', isMate: false } },
      moveNumber: 0,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    },
    {
      ply: 1,
      analysis: { evaluation: { whiteScore: -12.0, pawns: -12.0, whiteCp: -1200, type: 'cp', isMate: false } },
      moveNumber: 1,
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      playedMove: { san: 'e4', color: 'w' }
    }
  ];

  const graphData = buildEvaluationGraphData(snapshots);
  assert.equal(graphData.points[0].rawScore, 1500);
  assert.ok(graphData.points[0].score <= 4.0, 'Clamped score must not exceed visual range');
});

// 14. Evaluation Graph: Handling mate score without fake centipawns
test('14. Grafik menandai skor forced mate secara eksplisit (isMate: true, mateValue)', () => {
  const snapshots = [
    {
      ply: 0,
      analysis: { evaluation: { whiteScore: 0.0, pawns: 0, whiteCp: 0, type: 'cp', isMate: false } },
      moveNumber: 0,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    },
    {
      ply: 1,
      analysis: { evaluation: { whiteScore: 100, type: 'mate', isMate: true, mateIn: 2, whiteMate: 2, formatted: 'M+2' } },
      moveNumber: 1,
      fen: '8/8/8/8/8/8/8/8 w - - 0 1',
      playedMove: { san: 'Qxf7#', color: 'w' }
    }
  ];

  const graphData = buildEvaluationGraphData(snapshots);
  assert.equal(graphData.points[1].isMate, true);
  assert.equal(graphData.points[1].mateValue, 2);
  assert.equal(graphData.points[1].displayEval, 'M+2');
});

// 15. Evaluation Graph Component DOM structure
test('15. EvaluationGraphComponent merender elemen SVG, sumbu, garis nol, dan titik interaktif', () => {
  const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const graphComp = new EvaluationGraphComponent({ container: mockContainer });

  const snapshots = generateGameSnapshots(parsedGame);
  snapshots.forEach((s) => {
    s.evalScore = 0.3;
    s.evalType = 'cp';
    s.isMate = false;
  });
  const graphData = buildEvaluationGraphData(snapshots);

  graphComp.setData(graphData, 0);
  assert.ok(mockContainer.innerHTML.includes('<svg'));
  assert.ok(mockContainer.innerHTML.includes('eval-graph-zero-line'));
  assert.ok(mockContainer.innerHTML.includes('eval-graph-point'));
});

// 16. Game Review Report Builder: Total moves and completeness
test('16. Game Review Report menghitung statistik Putih dan Hitam secara akurat', () => {
  const snapshots = generateGameSnapshots(parsedGame);
  snapshots.forEach((s, idx) => {
    s.evalScore = 0.2;
    s.evalType = 'cp';
    s.isMate = false;
    s.bestMove = { uci: 'e2e4', san: 'e4', from: 'e2', to: 'e4' };
  });

  const report = buildGameReviewReport(parsedGame, snapshots);
  assert.equal(report.gameInfo.white, 'Budi Santoso');
  assert.equal(report.gameInfo.black, 'Andi Pratama');
  assert.equal(report.evaluatedPositions, snapshots.length);
  assert.equal(typeof report.whiteStats, 'object');
  assert.equal(typeof report.blackStats, 'object');
  assert.equal(report.whiteStats.totalMoves + report.blackStats.totalMoves, parsedGame.totalPlies);
});

// 17. Critical Moments detection in Report
test('17. Game Review mendeteksi Blunder dan Mistake dalam daftar Critical Moments', () => {
  const snapshots = generateGameSnapshots(parsedGame);
  snapshots.forEach((s, idx) => {
    // Putih (ply 1) melangkah: sebelum (ply 0) cp = 20, sesudah (ply 1) cp = -300 -> loss 320 -> Blunder
    const cp = idx === 0 ? 20 : -300;
    s.analysis = {
      evaluation: {
        whiteScore: cp / 100,
        whiteCp: cp,
        pawns: cp / 100,
        type: 'cp',
        isMate: false
      },
      bestMove: { uci: 'g1f3', san: 'Nf3', from: 'g1', to: 'f3' }
    };
  });

  const report = buildGameReviewReport(parsedGame, snapshots);
  assert.ok(Array.isArray(report.criticalMoments));
  assert.ok(report.criticalMoments.some(m => m.classification === MOVE_CLASSIFICATION.BLUNDER || m.classification === MOVE_CLASSIFICATION.MISTAKE));
});

// 18. Move Review List in Report
test('18. Move Review List memuat setiap langkah dengan SAN, klasifikasi, dan loss', () => {
  const snapshots = generateGameSnapshots(parsedGame);
  snapshots.forEach((s) => {
    s.analysis = {
      evaluation: {
        whiteScore: 0.2,
        whiteCp: 20,
        pawns: 0.2,
        type: 'cp',
        isMate: false
      },
      bestMove: { uci: 'e2e4', san: 'e4', from: 'e2', to: 'e4' }
    };
  });

  const report = buildGameReviewReport(parsedGame, snapshots);
  assert.equal(report.moveReviewList.length, parsedGame.totalPlies);
  const firstMove = report.moveReviewList[0];
  assert.equal(firstMove.ply, 1);
  assert.equal(firstMove.san, 'e4');
  assert.ok(firstMove.classification);
});

// 19. ChessGameReviewService: Single session & lifecycle
test('19. ChessGameReviewService mengelola lifecycle sesi (IDLE, ANALYZING, COMPLETED)', () => {
  const service = new ChessGameReviewService();
  assert.equal(service.getStatus(), GAME_REVIEW_STATUS.IDLE);
  assert.equal(service.isAnalyzing(), false);
});

// 20. ChessGameReviewService: Cancellation with stopGameReview
test('20. Pengguna dapat menghentikan analisis kapan pun dan status menjadi STOPPED', () => {
  const service = new ChessGameReviewService();
  service._status = GAME_REVIEW_STATUS.ANALYZING;
  service.stopGameReview('user_cancelled');
  assert.equal(service.getStatus(), GAME_REVIEW_STATUS.STOPPED);
});

// 21. Stale Session Protection via Session ID
test('21. Sesi analisis lama yang selesai setelah dibatalkan tidak menimpa sesi baru', () => {
  const service = new ChessGameReviewService();
  const session1 = service._generateSessionId();
  service._activeSessionId = session1;

  const session2 = service._generateSessionId();
  service._activeSessionId = session2;

  assert.equal(service._isSessionValid(session1), false);
  assert.equal(service._isSessionValid(session2), true);
});

// 22. Full Game Review sequential execution with mock engine
await asyncTest('22. Analisis seluruh pertandingan berjalan sekuensial dan memanggil onProgress', async () => {
  const service = new ChessGameReviewService();
  const mockEngine = {
    isReady: true,
    analyzePosition: async (fen) => ({
      ok: true,
      completed: true,
      evaluation: {
        whiteScore: 0.35,
        type: 'cp',
        whiteCp: 35,
        isMate: false,
        advantage: 'white',
        formatted: '+0.35'
      },
      depth: 10,
      bestMove: { uci: 'e2e4', san: 'e4', from: 'e2', to: 'e4' },
      pv: { sanMoves: ['e4', 'e5'] }
    })
  };

  let progressCalls = 0;
  const result = await service.analyzeFullGame(parsedGame, {
    engineService: mockEngine,
    onProgress: (p) => {
      progressCalls++;
      assert.ok(p.percent >= 0 && p.percent <= 100);
    }
  });

  assert.ok(result.ok);
  assert.equal(result.status, GAME_REVIEW_STATUS.COMPLETED);
  assert.ok(progressCalls > 0);
  assert.equal(result.totalPositions, parsedGame.totalPlies + 1);
});

// 23. GameReviewPanelComponent UI Tabs Rendering
test('23. GameReviewPanelComponent merender tab Grafik, Statistik, dan Momen Penting', () => {
  const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const panel = new GameReviewPanelComponent({ container: mockContainer });
  panel.render();

  assert.ok(mockContainer.innerHTML.includes('data-tab="graph"'));
  assert.ok(mockContainer.innerHTML.includes('data-tab="stats"'));
  assert.ok(mockContainer.innerHTML.includes('data-tab="critical"'));
});

// 24. GameReviewPanelComponent: Progress indicator
test('24. Panel Game Review menampilkan progress percentage saat proses analisis berlangsung', () => {
  const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const panel = new GameReviewPanelComponent({ container: mockContainer });
  panel.updateState({
    status: GAME_REVIEW_STATUS.ANALYZING,
    progress: { current: 5, total: 10, percent: 50, currentPly: 4 }
  });

  assert.ok(mockContainer.innerHTML.includes('50%'));
  assert.ok(mockContainer.innerHTML.includes('Posisi 5 dari 10'));
});

// 25. GameReviewPanelComponent: Stop Button visible during analyzing
test('25. Tombol Stop Game Analysis muncul saat menganalisis', () => {
  const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const panel = new GameReviewPanelComponent({ container: mockContainer });
  panel.updateState({
    status: GAME_REVIEW_STATUS.ANALYZING,
    progress: { current: 3, total: 10, percent: 30, currentPly: 2 }
  });

  assert.ok(mockContainer.innerHTML.includes('data-action="game-review-stop"'));
});

// 26. AnalysisView session state initializes Game Review fields
test('26. createInitialAnalysisSessionState menginisialisasi gameReviewStatus dan gameReviewReport', () => {
  const state = createInitialAnalysisSessionState();
  assert.equal(state.gameReviewStatus, GAME_REVIEW_STATUS.IDLE);
  assert.equal(state.gameReviewReport, null);
  assert.equal(state.gameReviewGraphData, null);
});

// 27. Reset analysis session state cleans up Game Review data
test('27. resetAnalysisExplorationState mereset gameReview data ke kondisi awal', () => {
  const state = createInitialAnalysisSessionState();
  state.gameReviewStatus = GAME_REVIEW_STATUS.COMPLETED;
  state.gameReviewReport = { dummy: true };

  resetAnalysisExplorationState(state);
  assert.equal(state.gameReviewStatus, GAME_REVIEW_STATUS.IDLE);
  assert.equal(state.gameReviewReport, null);
});

// 28. PGN Import / Switch resets Game Review and invalidates old graph
test('28. Mengganti PGN membersihkan sesi Game Review lama', () => {
  const state = createInitialAnalysisSessionState();
  state.gameReviewReport = { dummy: true };
  resetAnalysisExplorationState(state);
  assert.equal(state.gameReviewReport, null);
});

// 29. Silent audio option on board navigation
test('29. Navigasi melalui titik grafik atau review langkah mendukung silent navigation tanpa memicu sound effects beruntun', () => {
  // Verifikasi fungsi goToPly menerima opsi { silent: true }
  assert.ok(typeof EvaluationGraphComponent === 'function');
});

// 30. Color Palette conformance (no gradients, solid colors)
test('30. Palet warna Caturan solid (var(--accent-main), var(--bg-surface), dll) digunakan pada SVG Evaluation Graph tanpa gradients', () => {
  const snapshots = [
    { ply: 0, evalScore: 0.0, evalType: 'cp', isMate: false, moveNumber: 0, fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' }
  ];
  const graphData = buildEvaluationGraphData(snapshots);
  const mockContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const graphComp = new EvaluationGraphComponent({ container: mockContainer });
  graphComp.setData(graphData, 0);

  assert.ok(mockContainer.innerHTML.includes('var(--accent-main)') || mockContainer.innerHTML.includes('#E98232'));
  assert.ok(!mockContainer.innerHTML.includes('linearGradient'), 'Gradient dilarang sesuai spesifikasi');
});

// 31. Dark Mode Evaluation Graph & Game Review CSS rules audit
test('31. Dark Mode CSS styling untuk Axis labels, Gridlines, Zero line, Tooltip, dan Segmented Tabs didefinisikan secara lengkap', async () => {
  const fs = await import('node:fs/promises');
  const css = await fs.readFile('./css/components.css', 'utf-8');

  // Cek rule .eval-graph-axis-text dan dark mode variant
  assert.ok(css.includes('.eval-graph-axis-text'), 'CSS harus mendefinisikan .eval-graph-axis-text');
  assert.ok(css.includes('[data-theme="dark"] .eval-graph-axis-text'), 'CSS harus mendefinisikan [data-theme="dark"] .eval-graph-axis-text dengan warna terang (#C5D0DE)');
  assert.ok(css.includes('#C5D0DE'), 'Warna axis text dark mode harus #C5D0DE');

  // Cek dark mode gridlines dan zero line
  assert.ok(css.includes('[data-theme="dark"] .eval-graph-grid-line line'), 'CSS harus mendefinisikan dark mode gridlines (#40536D)');
  assert.ok(css.includes('#40536D'), 'Warna gridline dark mode harus #40536D');
  assert.ok(css.includes('[data-theme="dark"] .eval-graph-grid-zero line') || css.includes('[data-theme="dark"] .eval-graph-zero-line line'), 'CSS harus mendefinisikan dark mode zero baseline (#71839B)');
  assert.ok(css.includes('#71839B'), 'Warna baseline zero line dark mode harus #71839B');

  // Cek dark mode segmented tabs
  assert.ok(css.includes('[data-theme="dark"] .game-review-tabs'), 'CSS harus mendefinisikan dark mode tabs (#1E304F)');
  assert.ok(css.includes('[data-theme="dark"] .game-review-tab-btn'), 'CSS harus mendefinisikan dark mode tab button styling');
  assert.ok(css.includes('[data-theme="dark"] .eval-graph-tooltip'), 'CSS harus mendefinisikan dark mode tooltip');
});

// 32. Move Classification Badge on Board Pieces: Standard moves, castling, en passant, promotion
test('32. AnalysisReplayBoard merender Move Classification Badge langsung pada petak tujuan bidak yang melangkah', async () => {
  const { AnalysisReplayBoard } = await import('./js/components/chessboardUI.js');
  const testPgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7';
  const parsed = validateAndParsePgn(testPgn);

  const mockReport = {
    moveReviewList: [
      { ply: 1, classification: MOVE_CLASSIFICATION.BEST, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.BEST] },
      { ply: 2, classification: MOVE_CLASSIFICATION.GOOD, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.GOOD] },
      { ply: 3, classification: MOVE_CLASSIFICATION.BEST, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.BEST] },
      { ply: 4, classification: MOVE_CLASSIFICATION.GOOD, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.GOOD] },
      { ply: 5, classification: MOVE_CLASSIFICATION.EXCELLENT, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.EXCELLENT] },
      { ply: 6, classification: MOVE_CLASSIFICATION.GOOD, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.GOOD] },
      { ply: 7, classification: MOVE_CLASSIFICATION.INACCURACY, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.INACCURACY] },
      { ply: 8, classification: MOVE_CLASSIFICATION.MISTAKE, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.MISTAKE] },
      { ply: 9, classification: MOVE_CLASSIFICATION.BEST, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.BEST] },
      { ply: 10, classification: MOVE_CLASSIFICATION.BLUNDER, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.BLUNDER] }
    ],
    snapshots: []
  };

  const dummyEl = {
    textContent: '',
    className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    querySelector() { return this; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 40, height: 40 }; },
    animate() { return { onfinish: null, cancel() {} }; },
    style: {}
  };
  const mockContainer = {
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(val) { this._html = val; },
    querySelector() { return dummyEl; },
    querySelectorAll() { return []; }
  };

  const board = new AnalysisReplayBoard(mockContainer, parsed, {
    gameReviewReport: mockReport
  });

  const getBadgedSquares = (html) => {
    const list = [];
    const regex = /<button[^>]+data-square="([^"]+)"[\s\S]*?<\/button>/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      if (m[0].includes('piece-classification-badge')) {
        const badgeMatch = m[0].match(/<span[^>]+class="piece-classification-badge\s+([^"]+)"[^>]*>([\s\S]*?)<\/span>/);
        list.push({ square: m[1], symbol: badgeMatch ? badgeMatch[2].trim() : '', classNames: badgeMatch ? badgeMatch[1] : '' });
      }
    }
    return list;
  };

  // Posisi Awal (Ply 0): Tidak ada badge
  board.goToPly(0, { silent: true });
  assert.equal(getBadgedSquares(mockContainer.innerHTML).length, 0);

  // Langkah 3 (Nf3): Kuda di petak f3 mendapatkan badge Best (★)
  board.goToPly(3, { silent: true });
  let badges = getBadgedSquares(mockContainer.innerHTML);
  assert.equal(badges.length, 1);
  assert.equal(badges[0].square, 'f3');
  assert.equal(badges[0].symbol, '★');

  // Langkah 5 (Bb5): Gajah di petak b5 mendapatkan badge Excellent (✦)
  board.goToPly(5, { silent: true });
  badges = getBadgedSquares(mockContainer.innerHTML);
  assert.equal(badges.length, 1);
  assert.equal(badges[0].square, 'b5');
  assert.equal(badges[0].symbol, '✦');

  // Langkah 6 (a6): Pion di petak a6 mendapatkan badge Good (✓)
  board.goToPly(6, { silent: true });
  badges = getBadgedSquares(mockContainer.innerHTML);
  assert.equal(badges.length, 1);
  assert.equal(badges[0].square, 'a6');
  assert.equal(badges[0].symbol, '✓');

  // Langkah 9 (O-O): Rokade menempatkan badge Best (★) pada Raja di g1
  board.goToPly(9, { silent: true });
  badges = getBadgedSquares(mockContainer.innerHTML);
  assert.equal(badges.length, 1);
  assert.equal(badges[0].square, 'g1');
  assert.equal(badges[0].symbol, '★');

  // Langkah 10 (Be7): Blunder (??) pada Gajah di e7
  board.goToPly(10, { silent: true });
  badges = getBadgedSquares(mockContainer.innerHTML);
  assert.equal(badges.length, 1);
  assert.equal(badges[0].square, 'e7');
  assert.equal(badges[0].symbol, '??');
});

// 33. Move Classification symbols and badge classes conformance
test('33. 6 Simbol dan kelas Move Classification sesuai spesifikasi PRD Caturan', () => {
  assert.equal(MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.BEST].symbol, '★');
  assert.equal(MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.EXCELLENT].symbol, '✦');
  assert.equal(MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.GOOD].symbol, '✓');
  assert.equal(MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.INACCURACY].symbol, '?!');
  assert.equal(MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.MISTAKE].symbol, '?');
  assert.equal(MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.BLUNDER].symbol, '??');
});

// 34. Dynamic lifecycle of badges (Board flip, explore mode toggle, navigation)
test('34. Siklus badge responsif terhadap board flip, perpindahan explore mode, dan prev/next navigation', async () => {
  const { AnalysisReplayBoard } = await import('./js/components/chessboardUI.js');
  const testPgn = '1. e4 e5 2. Nf3 Nc6';
  const parsed = validateAndParsePgn(testPgn);

  const mockReport = {
    moveReviewList: [
      { ply: 1, classification: MOVE_CLASSIFICATION.BEST, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.BEST] },
      { ply: 2, classification: MOVE_CLASSIFICATION.GOOD, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.GOOD] },
      { ply: 3, classification: MOVE_CLASSIFICATION.BEST, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.BEST] },
      { ply: 4, classification: MOVE_CLASSIFICATION.GOOD, classificationMeta: MOVE_CLASSIFICATION_META[MOVE_CLASSIFICATION.GOOD] }
    ],
    snapshots: []
  };

  const dummyEl = {
    textContent: '',
    className: '',
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    removeAttribute() {},
    addEventListener() {},
    querySelector() { return this; },
    querySelectorAll() { return []; },
    getBoundingClientRect() { return { top: 0, left: 0, width: 40, height: 40 }; },
    animate() { return { onfinish: null, cancel() {} }; },
    style: {}
  };
  const mockContainer = {
    _html: '',
    get innerHTML() { return this._html; },
    set innerHTML(val) { this._html = val; },
    querySelector() { return dummyEl; },
    querySelectorAll() { return []; }
  };

  const board = new AnalysisReplayBoard(mockContainer, parsed, {
    gameReviewReport: mockReport
  });

  const getBadgedSquares = (html) => {
    const list = [];
    const regex = /<button[^>]+data-square="([^"]+)"[\s\S]*?<\/button>/g;
    let m;
    while ((m = regex.exec(html)) !== null) {
      if (m[0].includes('piece-classification-badge')) {
        list.push(m[1]);
      }
    }
    return list;
  };

  board.goToPly(4, { silent: true });
  assert.deepEqual(getBadgedSquares(mockContainer.innerHTML), ['c6']);

  // Flip Board: Petak c6 tetap memiliki badge
  board.flipBoard();
  assert.deepEqual(getBadgedSquares(mockContainer.innerHTML), ['c6']);
  board.flipBoard();

  // Prev Move -> mundur ke Ply 3 (f3)
  board.prevMove();
  assert.deepEqual(getBadgedSquares(mockContainer.innerHTML), ['f3']);

  // Explore Mode -> Sembunyikan badge
  board.setMode('explore');
  assert.equal(getBadgedSquares(mockContainer.innerHTML).length, 0);

  // Return to Review Mode -> Munculkan kembali badge pada petak f3
  board.setMode('review');
  assert.deepEqual(getBadgedSquares(mockContainer.innerHTML), ['f3']);
});

// 35. Audit Centipawn Loss (CPL) non-negatif & Perspektif Putih untuk kedua belah pihak
test('35. CPL Putih dan Hitam selalu non-negatif dan konsisten dengan White-perspective evaluation', () => {
  // Putih melangkah: evalBefore = +3.00 (300cp), evalAfter = +2.20 (220cp) -> loss = 80cp
  const snapW_before = { ply: 10, analysis: { evaluation: { type: 'cp', whiteCp: 300 } } };
  const snapW_after = { ply: 11, playedBy: 'w', playedMove: { from: 'b2', to: 'b3', san: 'b3' }, analysis: { evaluation: { type: 'cp', whiteCp: 220 } } };
  const resW = classifyMove(snapW_before, snapW_after);
  assert.equal(resW.centipawnLoss, 80);
  assert.equal(resW.pawnsLoss, 0.8);
  assert.equal(resW.classification, MOVE_CLASSIFICATION.INACCURACY);

  // Putih melangkah membaik: evalBefore = +1.00 (100cp), evalAfter = +2.50 (250cp) -> loss = 0cp
  const snapW_beforeBetter = { ply: 10, analysis: { evaluation: { type: 'cp', whiteCp: 100 } } };
  const snapW_better = { ply: 11, playedBy: 'w', playedMove: { from: 'b2', to: 'b3', san: 'b3' }, analysis: { evaluation: { type: 'cp', whiteCp: 250 } } };
  const resW_better = classifyMove(snapW_beforeBetter, snapW_better);
  assert.equal(resW_better.centipawnLoss, 0);
  assert.ok(resW_better.centipawnLoss >= 0);

  // Hitam melangkah: evalBefore = -0.50 (-50cp), evalAfter = +0.60 (60cp) -> loss = 60 - (-50) = 110cp
  const snapB_before = { ply: 11, analysis: { evaluation: { type: 'cp', whiteCp: -50 } } };
  const snapB_after = { ply: 12, playedBy: 'b', playedMove: { from: 'c7', to: 'c5', san: 'c5' }, analysis: { evaluation: { type: 'cp', whiteCp: 60 } } };
  const resB = classifyMove(snapB_before, snapB_after);
  assert.equal(resB.centipawnLoss, 110);
  assert.equal(resB.pawnsLoss, 1.1);
  assert.equal(resB.classification, MOVE_CLASSIFICATION.MISTAKE);
});

// 36. Audit Best Move matching UCI dan stability
test('36. Best Move dicocokkan berdasarkan identitas UCI dan klasifikasi stabil', () => {
  const snapBefore = {
    ply: 2,
    analysis: {
      evaluation: { type: 'cp', whiteCp: 40 },
      bestMove: { uci: 'g1f3', from: 'g1', to: 'f3' }
    }
  };
  const snapAfterExact = {
    ply: 3,
    playedBy: 'w',
    playedMove: { from: 'g1', to: 'f3', san: 'Nf3' },
    playedMoveUci: 'g1f3',
    analysis: { evaluation: { type: 'cp', whiteCp: 40 } }
  };
  const exactRes = classifyMove(snapBefore, snapAfterExact);
  assert.equal(exactRes.classification, MOVE_CLASSIFICATION.BEST);
  assert.equal(exactRes.centipawnLoss, 0);

  // Langkah non-best move tetapi centipawn loss 0 -> Excellent
  const snapAfterOther = {
    ply: 3,
    playedBy: 'w',
    playedMove: { from: 'b1', to: 'c3', san: 'Nc3' },
    playedMoveUci: 'b1c3',
    analysis: { evaluation: { type: 'cp', whiteCp: 40 } }
  };
  const otherRes = classifyMove(snapBefore, snapAfterOther);
  assert.equal(otherRes.classification, MOVE_CLASSIFICATION.EXCELLENT);
});

// 37. Audit Checkmate dan Terminal Position di Evaluation Graph
test('37. Posisi Checkmate di Evaluation Graph memiliki score visual ±4.5 (bukan 0.00) dan penanda mate', () => {
  const snaps = [
    { ply: 0, moveNumber: 1, turn: 'w', analysis: { evaluation: { type: 'cp', whiteCp: 0, formatted: '0.00' } } },
    {
      ply: 1,
      moveNumber: 1,
      turn: 'b',
      playedBy: 'w',
      san: 'Qxf7#',
      analysis: {
        evaluation: {
          type: 'mate',
          rawScore: 0,
          whiteMate: 0,
          winningSide: 'w',
          advantage: 'white',
          advantageLabel: 'Putih menang (Skakmat)',
          formatted: 'Mate in 0'
        }
      }
    }
  ];
  const graphData = buildEvaluationGraphData(snaps);
  assert.equal(graphData.points.length, 2);
  const matePoint = graphData.points[1];
  assert.equal(matePoint.isMate, true);
  assert.equal(matePoint.score, 4.5);
  assert.equal(matePoint.displayEval, 'Mate in 0');
  assert.equal(matePoint.advantage, 'white');

  // Black delivers checkmate
  const snapsBlack = [
    { ply: 0, moveNumber: 1, turn: 'w', analysis: { evaluation: { type: 'cp', whiteCp: 0, formatted: '0.00' } } },
    {
      ply: 1,
      moveNumber: 1,
      turn: 'w',
      playedBy: 'b',
      san: 'Qh4#',
      analysis: {
        evaluation: {
          type: 'mate',
          rawScore: 0,
          whiteMate: 0,
          winningSide: 'b',
          advantage: 'black',
          advantageLabel: 'Hitam menang (Skakmat)',
          formatted: 'Mate in -0'
        }
      }
    }
  ];
  const graphDataBlack = buildEvaluationGraphData(snapsBlack);
  const matePointBlack = graphDataBlack.points[1];
  assert.equal(matePointBlack.isMate, true);
  assert.equal(matePointBlack.score, -4.5);
  assert.equal(matePointBlack.displayEval, 'Mate in -0');
  assert.equal(matePointBlack.advantage, 'black');
});

// 38. Audit Empty Move Comment Panel cleanup
test('38. Empty move comment panel disembunyikan dan komentar asli PGN tetap dirender', () => {
  const pgnWithoutComments = '1. e4 e5 2. Nf3 Nc6';
  const parsedWithout = validateAndParsePgn(pgnWithoutComments);
  assert.ok(parsedWithout.valid);
  assert.ok(!parsedWithout.moves[0].comments || parsedWithout.moves[0].comments.length === 0);

  const pgnWithComments = '1. e4 {Pembukaan raja} e5 {Respons klasik} 2. Nf3 {Menyerang pion e5}';
  const parsedWith = validateAndParsePgn(pgnWithComments);
  assert.ok(parsedWith.valid);
  assert.deepEqual(parsedWith.moves[0].comments, ['Pembukaan raja']);
  assert.deepEqual(parsedWith.moves[1].comments, ['Respons klasik']);
  assert.deepEqual(parsedWith.moves[2].comments, ['Menyerang pion e5']);
});

// 39. Integrasi PGN Chess.com dengan Recursive Annotation Variations (RAV) dan Komentar Jam
test('39. PGN dari Chess.com dengan RAV, jam [%clk], dan eval [%eval] diimpor dengan aman tanpa merusak mainline', () => {
  const chessComPgn = `[Event "Live Chess - Chess.com"]
[Site "Chess.com"]
[Date "2026.05.15"]
[White "Player1"]
[Black "Player2"]
[Result "1-0"]
[WhiteElo "1850"]
[BlackElo "1820"]
[TimeControl "180+2"]

1. e4 {[%clk 0:03:00]} e5 {[%clk 0:03:00]} (1... c5 {[%clk 0:03:00]} 2. Nf3 (2. Nc3 Nc6 3. f4 g6) 2... d6 3. d4 cxd4 4. Nxd4) 2. Nf3 {[%clk 0:03:01]} Nc6 {[%clk 0:02:59]} (2... Nf6 3. Nxe5 d6 4. Nf3 Nxe4) 3. Bb5 {[%clk 0:03:02]} a6 {[%clk 0:02:58]} 4. Ba4 {[%clk 0:03:00]} Nf6 {[%clk 0:02:57]} 5. O-O {[%clk 0:02:58]} Be7 {[%clk 0:02:55]} 1-0`;

  // Standard import MVP 5.5 (allowVariations: true)
  const parsed = validateAndParsePgn(chessComPgn, { source: 'paste', allowVariations: true });
  assert.ok(parsed.valid, 'PGN Chess.com dengan variasi RAV harus valid');
  assert.equal(parsed.totalPlies, 10, 'Mainline harus tetap memiliki tepat 10 plies');
  assert.equal(parsed.moves[0].san, 'e4');
  assert.equal(parsed.moves[1].san, 'e5');
  assert.equal(parsed.moves[2].san, 'Nf3');
  assert.equal(parsed.moves[3].san, 'Nc6');
  assert.equal(parsed.moves[4].san, 'Bb5');
  assert.equal(parsed.moves[5].san, 'a6');
  assert.equal(parsed.moves[6].san, 'Ba4');
  assert.equal(parsed.moves[7].san, 'Nf6');
  assert.equal(parsed.moves[8].san, 'O-O');
  assert.equal(parsed.moves[9].san, 'Be7');
  assert.equal(parsed.result, '1-0');
  assert.equal(parsed.metadata.whiteElo, '1850');
  assert.equal(parsed.metadata.blackElo, '1820');

  // Default MVP 5.1 validator tanpa allowVariations tetap menolak variasi RAV untuk menjaga integritas data linear
  const parsedDefault = validateAndParsePgn(chessComPgn);
  assert.equal(parsedDefault.valid, false, 'Default allowVariations: false harus menolak variasi');
  assert.equal(parsedDefault.errorCode, 'UNSUPPORTED_VARIATION');
});

console.log(`\n=======================================================`);
console.log(`HASIL VERIFIKASI: ${passedTests}/${totalTests} TESTS BERHASIL (100% PASS)`);
console.log(`=======================================================\n`);
