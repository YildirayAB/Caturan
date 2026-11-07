import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'd:/Anti Gravity/project/Caturan';
const toUrl = rel => pathToFileURL(path.join(ROOT, rel)).href;

// ---------------------------------------------------------------------------
// Minimal DOM & Web APIs Mock for UI Component & CaturanApp Testing
// ---------------------------------------------------------------------------
class MockElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this._innerHTML = '';
    this._textContent = '';
    this.style = {};
    this.scrollTop = 0;
    this.scrollHeight = 400;
    this.disabled = false;
    this.value = '';
    this.listeners = new Map();
    this.classList = {
      _set: new Set(),
      add: (...cls) => {
        cls.forEach(c => c && this.classList._set.add(c));
        this._syncClassAttr();
      },
      remove: (...cls) => {
        cls.forEach(c => this.classList._set.delete(c));
        this._syncClassAttr();
      },
      toggle: (c, force) => {
        const shouldAdd = force !== undefined ? Boolean(force) : !this.classList._set.has(c);
        if (shouldAdd) this.classList._set.add(c);
        else this.classList._set.delete(c);
        this._syncClassAttr();
        return shouldAdd;
      },
      contains: c => this.classList._set.has(c)
    };
  }

  _syncClassAttr() {
    this.attributes.set('class', [...this.classList._set].join(' '));
  }

  get className() {
    return this.attributes.get('class') || '';
  }

  set className(val) {
    this.classList._set = new Set(String(val || '').split(/\s+/).filter(Boolean));
    this._syncClassAttr();
  }

  get id() {
    return this.attributes.get('id') || '';
  }

  set id(val) {
    this.attributes.set('id', String(val));
  }

  setAttribute(name, val) {
    const strVal = String(val);
    this.attributes.set(name, strVal);
    if (name === 'class') {
      this.classList._set = new Set(strVal.split(/\s+/).filter(Boolean));
    }
    if (name === 'disabled') {
      this.disabled = true;
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'disabled') this.disabled = false;
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  dispatchEvent(event) {
    const evt = {
      type: event.type,
      target: this,
      currentTarget: this,
      preventDefault: () => {},
      stopPropagation: () => {},
      ...event
    };
    const fns = this.listeners.get(evt.type) || [];
    for (const fn of fns) {
      fn(evt);
    }
  }

  click() {
    if (this.disabled) return;
    this.dispatchEvent({ type: 'click' });
  }

  focus() {}

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map(c => c.textContent).join('');
  }

  set textContent(val) {
    this.children = [];
    this._innerContentRaw = '';
    this._textContent = String(val ?? '');
    this._innerHTML = this._textContent;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = String(html ?? '');
    this._textContent = this._innerHTML.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    this.children = parseHtmlFragment(this._innerHTML, this.ownerDocument, this);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const results = [];
    const selectors = String(selector)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const visit = node => {
      for (const child of node.children) {
        if (selectors.some(sel => matchesCompoundSelector(child, sel))) {
          results.push(child);
        }
        visit(child);
      }
    };
    visit(this);
    return results;
  }
}

function matchesSimpleSelector(el, sel) {
  if (!sel) return false;
  const attrRegex = /\[([^\]=]+)(?:="([^"]*)")?\]/g;
  let remaining = sel;
  let match;
  while ((match = attrRegex.exec(sel)) !== null) {
    const attrName = match[1].trim();
    const attrVal = match[2];
    if (!el.hasAttribute(attrName)) return false;
    if (attrVal !== undefined && el.getAttribute(attrName) !== attrVal) return false;
    remaining = remaining.replace(match[0], '');
  }

  if (!remaining) return true;

  const idMatch = remaining.match(/#([A-Za-z0-9_-]+)/);
  if (idMatch) {
    if (el.id !== idMatch[1]) return false;
    remaining = remaining.replace(idMatch[0], '');
  }

  const classMatches = [...remaining.matchAll(/\.([A-Za-z0-9_-]+)/g)];
  for (const cm of classMatches) {
    if (!el.classList.contains(cm[1])) return false;
    remaining = remaining.replace(cm[0], '');
  }

  const tag = remaining.trim();
  if (tag && tag !== '*' && el.tagName.toLowerCase() !== tag.toLowerCase()) {
    return false;
  }

  return true;
}

function matchesCompoundSelector(el, selector) {
  const parts = selector.trim().split(/\s+/);
  if (parts.length === 1) {
    return matchesSimpleSelector(el, parts[0]);
  }
  if (!matchesSimpleSelector(el, parts[parts.length - 1])) return false;
  let curr = el.parentNode;
  let idx = parts.length - 2;
  while (curr && idx >= 0) {
    if (matchesSimpleSelector(curr, parts[idx])) {
      idx--;
    }
    curr = curr.parentNode;
  }
  return idx < 0;
}

const VOID_TAGS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
  'path',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon'
]);

function parseHtmlFragment(html, ownerDocument, parentNode) {
  const rootChildren = [];
  const stack = [{ children: rootChildren, node: parentNode }];
  const tokenRegex = /<!--[\s\S]*?-->|<\/([A-Za-z0-9_-]+)\s*>|<([A-Za-z0-9_-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;

  while ((m = tokenRegex.exec(html)) !== null) {
    if (m[1]) {
      const closeTag = m[1].toUpperCase();
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].node.tagName === closeTag) {
          stack.length = i;
          break;
        }
      }
    } else if (m[2]) {
      const tagName = m[2];
      const attrStr = m[3] || '';
      const selfClose = Boolean(m[4]) || VOID_TAGS.has(tagName.toLowerCase());
      const el = new MockElement(tagName, ownerDocument);
      el.parentNode = stack[stack.length - 1].node;

      const attrPairRegex = /([A-Za-z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
      let am;
      while ((am = attrPairRegex.exec(attrStr)) !== null) {
        const k = am[1];
        const v = am[2] ?? am[3] ?? am[4] ?? '';
        el.setAttribute(k, v);
      }

      stack[stack.length - 1].children.push(el);
      if (!selfClose) {
        stack.push({ children: el.children, node: el });
      }
    } else if (m[5]) {
      const txt = m[5];
      if (stack.length > 1) {
        stack[stack.length - 1].node._textContent += txt;
        stack[stack.length - 1].node._innerHTML += txt;
      }
    }
  }
  return rootChildren;
}

function setupMockBrowserEnvironment() {
  const storageMap = new Map();
  const sessionMap = new Map();

  const localStorageMock = {
    getItem: k => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: k => storageMap.delete(k),
    clear: () => storageMap.clear()
  };

  const sessionStorageMock = {
    getItem: k => (sessionMap.has(k) ? sessionMap.get(k) : null),
    setItem: (k, v) => sessionMap.set(k, String(v)),
    removeItem: k => sessionMap.delete(k),
    clear: () => sessionMap.clear()
  };

  const doc = {
    documentElement: new MockElement('html'),
    body: new MockElement('body'),
    _elementsById: new Map(),
    addEventListener: () => {},
    getElementById(id) {
      return this.body.querySelector(`#${id}`);
    },
    querySelector(sel) {
      return this.body.querySelector(sel);
    },
    querySelectorAll(sel) {
      return this.body.querySelectorAll(sel);
    }
  };

  doc.body.ownerDocument = doc;
  doc.body.innerHTML = `
    <div id="app-shell" class="app-shell">
      <aside id="app-sidebar" class="app-sidebar"></aside>
      <div id="sidebar-backdrop" class="sidebar-backdrop"></div>
      <div class="app-content-area">
        <header class="app-topbar">
          <button id="mobile-menu-btn" type="button"></button>
          <div id="topbar-quick-stats"></div>
          <button id="theme-toggle-btn" type="button"></button>
        </header>
        <main id="app-main-content" class="app-main"></main>
      </div>
    </div>
  `;

  globalThis.localStorage = localStorageMock;
  globalThis.sessionStorage = sessionStorageMock;
  globalThis.document = doc;
  globalThis.window = {
    document: doc,
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    location: { hash: '#dashboard' },
    history: {
      replaceState: (_s, _t, url) => {
        if (typeof url === 'string' && url.startsWith('#')) {
          globalThis.window.location.hash = url;
        }
      }
    },
    innerWidth: 1280,
    matchMedia: q => ({ matches: q.includes('860') ? globalThis.window.innerWidth <= 860 : false }),
    addEventListener: () => {},
    scrollTo: () => {},
    __CATURAN_ENV__: {}
  };
  Object.defineProperty(globalThis, 'navigator', {
    value: { onLine: true },
    configurable: true,
    writable: true
  });
}

setupMockBrowserEnvironment();

// Import Caturan modules
const { Chess, DEFAULT_POSITION } = await import(toUrl('js/vendor/chess.js'));
const {
  StockfishEngineService,
  stockfishEngine,
  PLAY_DIFFICULTIES,
  PLAY_DIFFICULTY_IDS,
  getPlayDifficultyById,
  parseUciMoveString
} = await import(toUrl('js/services/stockfishEngine.js'));
const {
  storageService,
  createInitialProgressState,
  createInitialPlayProgressState,
  sanitizePlayProgress,
  mergePlayProgress,
  mergeProgressStates
} = await import(toUrl('js/services/storage.js'));
const {
  progressService,
  formatPlayResultLabel,
  formatPlayTerminationLabel
} = await import(toUrl('js/services/progress.js'));
const {
  InteractiveChessboard,
  PuzzleChessboard,
  ComputerChessboard,
  calculateCapturedPieces,
  buildMovePairs
} = await import(toUrl('js/components/chessboardUI.js'));
const { renderPlayView } = await import(toUrl('js/components/playView.js'));
const {
  renderPlayGameView,
  getActivePlayBoard,
  destroyActivePlayBoard
} = await import(toUrl('js/components/playGameView.js'));
const { CaturanApp } = await import(toUrl('js/main.js'));
const { CURRICULUM_CATEGORIES, getAllLessons } = await import(toUrl('js/data/curriculum.js'));
const { getAllPuzzles, getAvailablePuzzleCategories } = await import(toUrl('js/data/puzzles.js'));

console.log('=== MULAI PENGUJIAN MENYELURUH CATURAN MVP 3 & TASK 7 (DRAW RULES REFINEMENT) ===\n');

// ============================================================================
// 1. PENGUJIAN ENGINE STOCKFISH 19 LITE SINGLE-THREADED (UCI & WORKER)
// ============================================================================
console.log('1. Menguji StockfishEngineService (Worker, UCI Handshake, Skill Level, Bestmove, Stop, Terminate)...');
{
  const engine = new StockfishEngineService();
  const readyState = await engine.init();
  assert.equal(readyState.isUciOk, true, 'Engine harus menerima uciok');
  assert.equal(readyState.isReady, true, 'Engine harus menerima readyok');
  assert.ok(
    readyState.engineInfo.name.includes('Stockfish 19'),
    `Nama engine harus Stockfish 19, aktual: ${readyState.engineInfo.name}`
  );
  assert.equal(
    engine.supportsOption('Skill Level'),
    true,
    'Stockfish 19 Lite WASM harus mendukung opsi UCI Skill Level'
  );
  assert.equal(
    engine.supportsOption('NonExistentOptionXYZ'),
    false,
    'Opsi UCI tidak valid harus terdeteksi false'
  );

  // Uji startNewGame & pencarian FEN pada 3 level kesulitan
  for (const diffId of Object.values(PLAY_DIFFICULTY_IDS)) {
    const startRes = await engine.startNewGame({ gameId: `test_${diffId}`, difficulty: diffId });
    assert.equal(startRes.cancelled, false);
    assert.equal(startRes.difficulty.id, diffId);
    assert.equal(engine.getDifficulty().id, diffId);

    const chess = new Chess();
    chess.move('e4');
    const bestRes = await engine.requestBestMove({
      fen: chess.fen(),
      moveTimeMs: 120,
      gameId: `test_${diffId}`
    });
    assert.equal(bestRes.cancelled, false);
    assert.ok(bestRes.uciMove, `Bestmove harus diterima untuk kesulitan ${diffId}`);
    assert.ok(bestRes.parsed, 'Bestmove harus terparse ke {from, to}');

    const applied = chess.move(bestRes.parsed);
    assert.ok(applied, `Langkah Stockfish (${bestRes.uciMove}) harus legal menurut Chess.js`);
  }

  // Uji proteksi perubahan tingkat kesulitan saat game sedang berlangsung
  engine.setGameInProgress(true);
  assert.throws(
    () => engine.setDifficulty('advanced'),
    /Tingkat kesulitan tidak dapat diubah ketika permainan sedang berlangsung/
  );
  engine.setGameInProgress(false);

  // Uji pembatalan pencarian (stopSearch) & isolasi gameId lama
  await engine.startNewGame({ gameId: 'old_game_1', difficulty: 'advanced' });
  const staleSearchPromise = engine.requestBestMove({
    fen: DEFAULT_POSITION,
    moveTimeMs: 2500,
    gameId: 'old_game_1'
  });
  await engine.startNewGame({ gameId: 'new_game_2', difficulty: 'beginner' });
  const staleRes = await staleSearchPromise;
  assert.equal(
    staleRes.cancelled,
    true,
    'Respons pencarian dari game lama harus dibatalkan (cancelled: true)'
  );

  const expiredReq = await engine.requestBestMove({
    fen: DEFAULT_POSITION,
    moveTimeMs: 100,
    gameId: 'old_game_1'
  });
  assert.equal(expiredReq.cancelled, true);

  engine.terminate();
  assert.equal(engine.getEngineStatus().isReady, false, 'Setelah terminate(), isReady harus false');
  const reinitState = await engine.init();
  assert.equal(reinitState.isReady, true, 'Worker harus dapat dibuat ulang setelah terminate()');
  engine.terminate();
  console.log('   [LULUS] StockfishEngineService & protokol UCI berfungsi penuh.');
}

// ============================================================================
// 2. PENGUJIAN ATURAN CATUR STANDAR & PENYEMPURNAAN ATURAN REMIS (TASK 7)
// ============================================================================
console.log('2. Menguji aturan permainan catur standar & 9 skenario penyempurnaan aturan remis (TASK 7)...');
{
  const engine = new StockfishEngineService();

  // 2a. Bermain sebagai Putih & Hitam melawan Stockfish
  const mountWhite = new MockElement('div');
  let lastSnapshot = null;
  const whiteBoard = new ComputerChessboard(mountWhite, {
    engine,
    colorPreference: 'white',
    difficulty: 'beginner',
    onStateChange: snap => {
      lastSnapshot = snap;
    }
  });

  await whiteBoard.startNewGame({ colorPreference: 'white', difficulty: 'beginner' });
  assert.equal(whiteBoard.playerColor, 'white');
  assert.equal(lastSnapshot.isPlayerTurn, true);

  const illegalRes = await whiteBoard.playPlayerMove({ from: 'e2', to: 'e5' });
  assert.equal(illegalRes.ok, false);
  assert.equal(illegalRes.reason, 'illegal_move');

  const legalRes = await whiteBoard.playPlayerMove({ from: 'e2', to: 'e4' });
  assert.equal(legalRes.ok, true);
  assert.equal(legalRes.move.san, 'e4');
  assert.ok(legalRes.computerReply, 'Stockfish harus membalas langkah Putih secara otomatis');

  const blackBoard = new ComputerChessboard(new MockElement('div'), {
    engine,
    colorPreference: 'black',
    difficulty: 'beginner'
  });
  const blackStartSnap = await blackBoard.startNewGame({
    colorPreference: 'black',
    difficulty: 'beginner'
  });
  assert.equal(blackBoard.playerColor, 'black');
  assert.equal(blackBoard.chess.history().length, 1);
  assert.equal(blackStartSnap.isPlayerTurn, true);

  // 2b. Castling, En Passant, Pawn Promotion, Check, Checkmate, Stalemate, Insufficient Material, Resign
  const castleFen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
  const castleChess = new Chess(castleFen);
  assert.ok(castleChess.move('O-O'));
  const castleQueenChess = new Chess(castleFen);
  assert.ok(castleQueenChess.move('O-O-O'));

  const epChess = new Chess();
  epChess.move('e4');
  epChess.move('a6');
  epChess.move('e5');
  epChess.move('d5');
  assert.ok(epChess.move('exd6'));
  assert.equal(epChess.get('d5'), null);

  for (const promoPiece of ['q', 'r', 'b', 'n']) {
    const promoFen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';
    const promoMount = new MockElement('div');
    const promoBoard = new ComputerChessboard(promoMount, {
      engine: null,
      colorPreference: 'white',
      difficulty: 'beginner',
      initialFen: promoFen
    });
    await promoBoard.startNewGame({
      colorPreference: 'white',
      difficulty: 'beginner',
      initialFen: promoFen
    });
    const pendingRes = await promoBoard.playPlayerMove({ from: 'a7', to: 'a8' });
    assert.equal(pendingRes.pendingPromotion, true);
    promoBoard._handlePromotionSelect(promoPiece);
    const historyVerbose = promoBoard.chess.history({ verbose: true });
    assert.equal(historyVerbose[0].promotion, promoPiece);
    promoBoard.destroy();
  }

  // Stalemate & Insufficient Material
  const stalemateFen = '7k/5K2/8/8/8/8/8/6Q1 w - - 0 1';
  const staleBoard = new ComputerChessboard(new MockElement('div'), {
    engine: null,
    colorPreference: 'white',
    difficulty: 'beginner',
    initialFen: stalemateFen
  });
  await staleBoard.startNewGame({
    colorPreference: 'white',
    difficulty: 'beginner',
    initialFen: stalemateFen
  });
  const staleMoveRes = await staleBoard.playPlayerMove({ from: 'g1', to: 'g6' });
  assert.equal(staleMoveRes.gameOver, true);
  assert.equal(staleMoveRes.gameResult.result, 'draw');
  assert.equal(staleMoveRes.gameResult.termination, 'stalemate');

  const insuffFen = '4k3/8/8/8/8/8/4p3/4K3 w - - 0 1';
  const insuffBoard = new ComputerChessboard(new MockElement('div'), {
    engine: null,
    colorPreference: 'white',
    difficulty: 'beginner',
    initialFen: insuffFen
  });
  await insuffBoard.startNewGame({
    colorPreference: 'white',
    difficulty: 'beginner',
    initialFen: insuffFen
  });
  const insuffRes = await insuffBoard.playPlayerMove({ from: 'e1', to: 'e2' });
  assert.equal(insuffRes.gameOver, true);
  assert.equal(insuffRes.gameResult.result, 'draw');
  assert.equal(insuffRes.gameResult.termination, 'insufficient_material');

  // --------------------------------------------------------------------------
  // PENGUJIAN 9 SKENARIO TASK 7 & TASK 8 (FINAL FIDE DRAW CLAIM EDGE CASE AUDIT)
  // --------------------------------------------------------------------------

  // SKENARIO 1 (TASK 8): Threefold berdasarkan posisi yang sudah muncul
  console.log('   -> Menguji Skenario 1 (TASK 8): Threefold repetition berdasarkan posisi yang sudah muncul 3 kali...');
  {
    const repChess = new Chess();
    repChess.move('Nf3');
    repChess.move('Nf6');
    repChess.move('Ng1');
    repChess.move('Ng8'); // Kemunculan ke-2
    repChess.move('Nf3');
    repChess.move('Nf6');
    repChess.move('Ng1');

    const repMount = new MockElement('div');
    let repEndedResult = null;
    const repBoard = new ComputerChessboard(repMount, {
      engine: null,
      colorPreference: 'black',
      difficulty: 'beginner',
      onGameEnd: res => {
        repEndedResult = res;
      }
    });
    repBoard.chess = repChess;
    repBoard.playerColor = 'black';
    repBoard.playerTurnChar = 'b';
    repBoard.computerColor = 'white';
    repBoard.computerTurnChar = 'w';
    repBoard.gameId = 'test_threefold_current_pos';

    // Lakukan langkah Ng8 sehingga posisi awal muncul untuk ke-3 kalinya di papan
    const repMoveRes = await repBoard.playPlayerMove({ from: 'f6', to: 'g8' });
    assert.equal(repMoveRes.ok, true);
    assert.equal(
      repMoveRes.gameOver,
      false,
      'Threefold repetition tidak boleh otomatis mengakhiri permainan'
    );
    assert.equal(repBoard.chess.isThreefoldRepetition(), true);
    assert.equal(repBoard.getGameStateSnapshot().canClaimDraw, true);
    assert.equal(repBoard.getGameStateSnapshot().claimableDrawMode, 'current_position');

    // Klaim berdasarkan posisi yang sudah muncul 3 kali
    const claimRes = await repBoard.claimDraw();
    assert.equal(claimRes.ok, true);
    assert.equal(claimRes.result, 'draw');
    assert.equal(claimRes.termination, 'threefold_repetition');
    assert.equal(claimRes.claimMode, 'current_position');
    assert.equal(repBoard.isGameOver, true);
    assert.equal(repEndedResult.result, 'draw');
    assert.equal(repEndedResult.termination, 'threefold_repetition');
  }

  // SKENARIO 2 (TASK 8): Threefold berdasarkan intended move (tanpa terlebih dahulu mengubah posisi permainan)
  console.log('   -> Menguji Skenario 2 (TASK 8): Threefold repetition berdasarkan intended move tanpa mengubah posisi papan...');
  {
    const intendedRepChess = new Chess();
    intendedRepChess.move('Nf3');
    intendedRepChess.move('Nf6');
    intendedRepChess.move('Ng1');
    intendedRepChess.move('Ng8'); // Posisi awal sudah muncul 2 kali
    intendedRepChess.move('Nf3');
    intendedRepChess.move('Nf6');
    intendedRepChess.move('Ng1'); // Sekarang giliran Hitam; langkah Ng8 (f6->g8) AKAN membuat posisi awal muncul ke-3 kalinya!

    const fenBeforeClaim = intendedRepChess.fen();
    const historyLenBeforeClaim = intendedRepChess.history().length;

    const intendedMount = new MockElement('div');
    let intendedEndedResult = null;
    const intendedBoard = new ComputerChessboard(intendedMount, {
      engine: null,
      colorPreference: 'black',
      difficulty: 'beginner',
      onGameEnd: res => {
        intendedEndedResult = res;
      }
    });
    intendedBoard.chess = intendedRepChess;
    intendedBoard.playerColor = 'black';
    intendedBoard.playerTurnChar = 'b';
    intendedBoard.computerColor = 'white';
    intendedBoard.computerTurnChar = 'w';
    intendedBoard.gameId = 'test_threefold_intended_move';

    // Pastikan posisi saat ini baru muncul 1 kali dan belum threefold
    assert.equal(intendedBoard.chess.isThreefoldRepetition(), false);
    assert.equal(intendedBoard.chess.canClaimDraw(), false);

    // Uji klaim berdasarkan intended move yang SALAH terlebih dahulu (mis. Nh5 yang tidak mengulang posisi 3x)
    const wrongIntendedClaim = await intendedBoard.claimDraw({ from: 'f6', to: 'h5' });
    assert.equal(wrongIntendedClaim.ok, false, 'Klaim dengan intended move yang tidak menghasilkan 3x repetisi harus ditolak');
    assert.equal(intendedBoard.isGameOver, false, 'Jika klaim salah, permainan tidak boleh berakhir/rusak');
    assert.equal(intendedBoard.chess.fen(), fenBeforeClaim, 'Posisi permainan tidak boleh berubah setelah klaim salah');
    assert.equal(intendedBoard.chess.history().length, historyLenBeforeClaim, 'Riwayat langkah tidak boleh rusak setelah klaim salah');

    // Uji pemilihan intended move yang VALID melalui setIntendedMove('Ng8') TANPA mengubah posisi papan
    const setRes = intendedBoard.setIntendedMove({ from: 'f6', to: 'g8' });
    assert.equal(setRes.ok, true);
    assert.equal(setRes.canClaimDraw, true, 'setIntendedMove dengan langkah pemicu 3x repetisi harus mengaktifkan canClaimDraw');
    assert.equal(
      intendedBoard.chess.fen(),
      fenBeforeClaim,
      'setIntendedMove TIDAK boleh mengubah posisi FEN permainan'
    );
    assert.equal(
      intendedBoard.chess.history().length,
      historyLenBeforeClaim,
      'setIntendedMove TIDAK boleh menambah riwayat langkah sebelum klaim'
    );

    // Klaim remis menggunakan intended move yang telah dipilih
    const validIntendedClaim = await intendedBoard.claimDraw();
    assert.equal(validIntendedClaim.ok, true, 'Klaim remis berdasarkan intended move harus valid');
    assert.equal(validIntendedClaim.result, 'draw');
    assert.equal(validIntendedClaim.termination, 'threefold_repetition');
    assert.equal(validIntendedClaim.claimMode, 'intended_move');
    assert.equal(validIntendedClaim.claimedIntendedMove, 'Ng8');
    assert.equal(
      intendedBoard.chess.fen(),
      fenBeforeClaim,
      'Posisi papan tetap tidak dimutasi saat klaim intended move disahkan'
    );
    assert.equal(intendedBoard.isGameOver, true);
    assert.ok(intendedEndedResult);
    assert.equal(intendedEndedResult.result, 'draw');
    assert.equal(intendedEndedResult.termination, 'threefold_repetition');
  }

  // SKENARIO 3 (TASK 8): Fifty-Move Rule berdasarkan posisi yang sudah mencapai 100 halfmoves
  console.log('   -> Menguji Skenario 3 (TASK 8): Fifty-Move Rule berdasarkan posisi yang sudah mencapai 100 halfmoves...');
  {
    const fiftyAlready100Fen = '4k3/8/8/8/8/8/8/R3K3 b - - 100 50';
    const fiftyMount = new MockElement('div');
    let fiftyEndedResult = null;
    const fiftyBoard = new ComputerChessboard(fiftyMount, {
      engine: null,
      colorPreference: 'black',
      difficulty: 'beginner',
      initialFen: fiftyAlready100Fen,
      onGameEnd: res => {
        fiftyEndedResult = res;
      }
    });
    await fiftyBoard.startNewGame({
      colorPreference: 'black',
      difficulty: 'beginner',
      initialFen: fiftyAlready100Fen
    });

    assert.equal(fiftyBoard.isGameOver, false, '100 halfmoves tidak boleh otomatis mengakhiri permainan');
    assert.equal(fiftyBoard.chess.isFiftyMoveRule(), true);
    assert.equal(fiftyBoard.getGameStateSnapshot().canClaimDraw, true);
    assert.equal(fiftyBoard.getGameStateSnapshot().claimableDrawMode, 'current_position');

    const validFiftyClaim = await fiftyBoard.claimDraw();
    assert.equal(validFiftyClaim.ok, true);
    assert.equal(validFiftyClaim.result, 'draw');
    assert.equal(validFiftyClaim.termination, 'fifty_move_rule');
    assert.equal(validFiftyClaim.claimMode, 'current_position');
    assert.equal(fiftyBoard.isGameOver, true);
    assert.ok(fiftyEndedResult);
    assert.equal(fiftyEndedResult.result, 'draw');
    assert.equal(fiftyEndedResult.termination, 'fifty_move_rule');
  }

  // SKENARIO 4 (TASK 8): Fifty-Move Rule berdasarkan intended move pada halfmove ke-99
  console.log('   -> Menguji Skenario 4 (TASK 8): Fifty-Move Rule berdasarkan intended move pada halfmove ke-99...');
  {
    // Posisi pada halfmove ke-99 dengan pion Putih di h2 dan Benteng Putih di a1
    const halfMove99Fen = '4k3/p7/8/8/8/8/7P/R3K3 w - - 99 50';
    const hm99Mount = new MockElement('div');
    let hm99EndedResult = null;
    const hm99Board = new ComputerChessboard(hm99Mount, {
      engine: null,
      colorPreference: 'white',
      difficulty: 'beginner',
      initialFen: halfMove99Fen,
      onGameEnd: res => {
        hm99EndedResult = res;
      }
    });
    await hm99Board.startNewGame({
      colorPreference: 'white',
      difficulty: 'beginner',
      initialFen: halfMove99Fen
    });

    const fenAt99 = hm99Board.chess.fen();
    assert.equal(hm99Board.chess._halfMoves, 99);
    assert.equal(hm99Board.chess.isFiftyMoveRule(), false, 'Pada halfmove 99 tanpa intended move, belum mencapai 100 halfmoves');
    assert.equal(hm99Board.getGameStateSnapshot().canClaimDraw, false);

    // Uji klaim yang SALAH pada halfmove 99:
    // 1) Langkah pion (h2->h3) mereset halfMoves menjadi 0 -> TIDAK berhak klaim 50 langkah!
    const pawnIntendedClaim = await hm99Board.claimDraw({ from: 'h2', to: 'h3' });
    assert.equal(pawnIntendedClaim.ok, false, 'Langkah pion pada halfmove 99 mereset halfmove clock sehingga klaim harus ditolak');
    assert.equal(hm99Board.isGameOver, false);
    assert.equal(hm99Board.chess.fen(), fenAt99, 'Posisi papan tidak boleh berubah setelah klaim salah');
    assert.equal(hm99Board.chess._halfMoves, 99);

    // 2) Langkah tangkapan (Rxa7 / a1->a7) mereset halfMoves menjadi 0 -> TIDAK berhak klaim 50 langkah!
    const captureIntendedClaim = await hm99Board.claimDraw({ from: 'a1', to: 'a7' });
    assert.equal(captureIntendedClaim.ok, false, 'Langkah tangkapan pada halfmove 99 mereset halfmove clock sehingga klaim harus ditolak');
    assert.equal(hm99Board.isGameOver, false);
    assert.equal(hm99Board.chess.fen(), fenAt99);

    // 3) Langkah legal non-pion & non-tangkapan (Ra2 / a1->a2) mencapai 100 halfmoves -> VALID!
    assert.equal(hm99Board.chess.isFiftyMoveRule('Ra2'), true);
    assert.equal(hm99Board.chess.canClaimDraw({ from: 'a1', to: 'a2' }), true);
    assert.equal(hm99Board.chess.fen(), fenAt99, 'Evaluasi canClaimDraw(intendedMove) tidak boleh mengubah FEN');

    const validHm99Claim = await hm99Board.claimDraw({ from: 'a1', to: 'a2' });
    assert.equal(validHm99Claim.ok, true, 'Klaim 50 langkah dengan intended move Ra2 pada halfmove 99 harus berhasil');
    assert.equal(validHm99Claim.result, 'draw');
    assert.equal(validHm99Claim.termination, 'fifty_move_rule');
    assert.equal(validHm99Claim.claimMode, 'intended_move');
    assert.equal(validHm99Claim.claimedIntendedMove, 'Ra2');
    assert.equal(hm99Board.chess.fen(), fenAt99, 'Posisi permainan tidak diubah sebelum mengakhiri permainan sebagai Draw');
    assert.equal(hm99Board.isGameOver, true);
    assert.ok(hm99EndedResult);
    assert.equal(hm99EndedResult.result, 'draw');
    assert.equal(hm99EndedResult.termination, 'fifty_move_rule');
  }

  // SKENARIO 5 (TASK 8): Posisi dengan en passant legal dibedakan dengan benar
  console.log('   -> Menguji Skenario 5 (TASK 8): Posisi dengan en passant legal dibedakan dengan benar...');
  {
    // Posisi di mana pion hitam berada di d4, lalu Putih melangkah e2-e4 sehingga tangkapan exd3 (dxe3 e.p.) LEGAL bagi Hitam
    const legalEpChess = new Chess('4k3/8/8/8/3p4/8/4P3/4K3 w - - 0 1');
    legalEpChess.move('e4'); // Sekarang giliran Hitam, epSquare = e3, dan dxe3 LEGAL!
    const fenWithLegalEp = legalEpChess.fen();
    const keyWithLegalEp = legalEpChess._positionKey(fenWithLegalEp);
    assert.ok(
      keyWithLegalEp.endsWith(' e3'),
      `Ketika tangkapan en passant legal tersedia, _positionKey harus menyertakan e3 (aktual: ${keyWithLegalEp})`
    );

    // Bolak-balik Raja sehingga kembali ke susunan bidak & giliran yang sama, tetapi hak en passant sudah hilang
    legalEpChess.move('Kd7');
    legalEpChess.move('Kd1');
    legalEpChess.move('Ke8');
    legalEpChess.move('Ke1'); // Kemunculan ke-1 tanpa ep
    const keyWithoutEp = legalEpChess._positionKey(legalEpChess.fen());
    assert.ok(keyWithoutEp.endsWith(' -'));
    assert.notEqual(
      keyWithLegalEp,
      keyWithoutEp,
      'Posisi dengan tangkapan en passant legal harus memiliki identitas posisi berbeda dari posisi tanpa en passant'
    );

    legalEpChess.move('Kd7');
    legalEpChess.move('Kd1');
    legalEpChess.move('Ke8');
    legalEpChess.move('Ke1'); // Kemunculan ke-2 tanpa ep (BUKAN ke-3 karena kemunculan pertama memiliki legal ep!)
    assert.equal(legalEpChess.getPositionRepetitionCount(), 2);
    assert.equal(
      legalEpChess.isThreefoldRepetition(),
      false,
      'Skenario 5: Posisi dengan en passant legal tidak boleh dihitung sama dengan posisi selanjutnya ketika en passant sudah tidak tersedia'
    );
  }

  // SKENARIO 6 (TASK 8): Posisi dengan target en passant tetapi tanpa tangkapan legal tidak salah dianggap berbeda
  console.log('   -> Menguji Skenario 6 (TASK 8): Posisi dengan target en passant tanpa tangkapan legal dianggap identik...');
  {
    // Sub-kasus 6a: Pion maju 2 langkah (1. e4 -> FEN memiliki target ep 'e3'), tetapi lawan TIDAK memiliki pion di lajur d4/f4
    const pseudoEpChess = new Chess();
    pseudoEpChess.move('e4'); // FEN mentah memiliki 'e3', tetapi tidak ada pion hitam di d4/f4
    assert.equal(pseudoEpChess._epSquare, 'e3', 'Target ep mentah di FEN adalah e3');
    const keyAfterE4 = pseudoEpChess._positionKey(pseudoEpChess.fen());
    assert.ok(
      keyAfterE4.endsWith(' -'),
      `Karena tidak ada tangkapan en passant legal, _positionKey harus menormalisasi ep menjadi '-' (aktual: ${keyAfterE4})`
    );

    // Ulangi posisi setelah 1. e4 sebanyak 2 kali lagi melalui langkah Kuda:
    pseudoEpChess.move('Nf6');
    pseudoEpChess.move('Nf3');
    pseudoEpChess.move('Ng8');
    pseudoEpChess.move('Ng1'); // Kemunculan ke-2 dari posisi setelah 1. e4!
    assert.equal(
      pseudoEpChess.getPositionRepetitionCount(),
      2,
      'Posisi setelah 3. Ng1 harus terhitung sudah muncul 2 kali (identik dengan posisi setelah 1. e4)'
    );

    pseudoEpChess.move('Nf6');
    pseudoEpChess.move('Nf3');
    pseudoEpChess.move('Ng8');
    // Sebelum 5. Ng1, uji juga bahwa Ng1 terdeteksi sebagai intended move untuk Threefold Repetition!
    assert.equal(
      pseudoEpChess.isThreefoldRepetition('Ng1'),
      true,
      'Langkah Ng1 harus terdeteksi akan menghasilkan pengulangan ke-3 (karena posisi setelah 1. e4 dihitung sama)'
    );
    pseudoEpChess.move('Ng1'); // Kemunculan ke-3!
    assert.equal(pseudoEpChess.getPositionRepetitionCount(), 3);
    assert.equal(
      pseudoEpChess.isThreefoldRepetition(),
      true,
      'Skenario 6a: Posisi dengan target en passant semu (tanpa pion penangkap) harus dihitung identik sehingga mencapai Threefold Repetition'
    );

    // Sub-kasus 6b: Ada pion lawan di petak samping (d4), TETAPI pion tersebut ter-pin ke Rajanya sehingga tangkapan dxe3 ILEGAL!
    // Putih: Raja e1, Menteri d1, Pion e2. Hitam: Raja d8, Pion d4.
    // Saat Putih melangkah e2-e4, pion hitam di d4 berada di lajur d yang di-pin oleh Menteri Putih d1 terhadap Raja Hitam d8!
    const pinnedEpChess = new Chess('3k4/8/8/8/3p4/8/4P3/3QK3 w - - 0 1');
    pinnedEpChess.move('e4'); // FEN mentah memiliki target ep 'e3', tapi dxe3 ilegal karena Raja Hitam di d8 akan skak oleh Qd1!
    assert.equal(pinnedEpChess._epSquare, 'e3');
    const pinnedKey = pinnedEpChess._positionKey(pinnedEpChess.fen());
    assert.ok(
      pinnedKey.endsWith(' -'),
      `Skenario 6b: Ketika pion penangkap en passant ter-pin (dxe3 ilegal), _positionKey harus menormalisasi ep menjadi '-' (aktual: ${pinnedKey})`
    );
  }

  // SKENARIO 7 (TASK 8): Hak rokade yang berubah menghasilkan identitas posisi berbeda
  console.log('   -> Menguji Skenario 7 (TASK 8): Hak rokade yang berubah menghasilkan identitas posisi berbeda...');
  {
    const castlingRepChess = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
    const initialKeyWithFullCastling = castlingRepChess._positionKey();
    assert.ok(initialKeyWithFullCastling.includes(' KQkq '));

    // Gerakkan Benteng h1 ke g1 lalu kembali ke h1 -> susunan bidak kembali identik, tetapi hak rokade 'K' hilang!
    castlingRepChess.move('Rg1');
    castlingRepChess.move('Rg8');
    castlingRepChess.move('Rh1');
    castlingRepChess.move('Rh8');

    const keyAfterRookMoved = castlingRepChess._positionKey();
    assert.ok(keyAfterRookMoved.includes(' Qq '));
    assert.notEqual(
      initialKeyWithFullCastling,
      keyAfterRookMoved,
      'Skenario 7: Kehilangan hak rokade harus menghasilkan _positionKey yang berbeda meskipun susunan bidak identik'
    );

    // Ulangi lagi sekali -> baru terhitung 2 kali (bukan 3 kali karena posisi awal memiliki KQkq)
    castlingRepChess.move('Rg1');
    castlingRepChess.move('Rg8');
    castlingRepChess.move('Rh1');
    castlingRepChess.move('Rh8');
    assert.equal(castlingRepChess.getPositionRepetitionCount(), 2);
    assert.equal(castlingRepChess.isThreefoldRepetition(), false);
  }

  // SKENARIO 8 (TASK 8): Fivefold dan Seventy-Five-Move Rule tetap otomatis
  console.log('   -> Menguji Skenario 8 (TASK 8): Fivefold Repetition dan Seventy-Five-Move Rule tetap otomatis Draw...');
  {
    // 8a. Fivefold Repetition otomatis Draw
    const fivefoldChess = new Chess();
    for (let cycle = 0; cycle < 3; cycle++) {
      fivefoldChess.move('Nf3');
      fivefoldChess.move('Nf6');
      fivefoldChess.move('Ng1');
      fivefoldChess.move('Ng8');
    }
    fivefoldChess.move('Nf3');
    fivefoldChess.move('Nf6');
    fivefoldChess.move('Ng1');

    let fiveEndedResult = null;
    const fiveBoard = new ComputerChessboard(new MockElement('div'), {
      engine: null,
      colorPreference: 'black',
      difficulty: 'beginner',
      onGameEnd: res => {
        fiveEndedResult = res;
      }
    });
    fiveBoard.chess = fivefoldChess;
    fiveBoard.playerColor = 'black';
    fiveBoard.playerTurnChar = 'b';
    fiveBoard.computerColor = 'white';
    fiveBoard.computerTurnChar = 'w';
    fiveBoard.gameId = 'test_fivefold_auto';

    const fiveRes = await fiveBoard.playPlayerMove({ from: 'f6', to: 'g8' }); // Kemunculan ke-5!
    assert.equal(fiveRes.gameOver, true);
    assert.equal(fiveEndedResult.result, 'draw');
    assert.equal(fiveEndedResult.termination, 'fivefold_repetition');

    // 8b. Seventy-Five-Move Rule otomatis Draw
    const seventyFiveFen = '4k3/8/8/8/8/8/8/R3K3 w - - 149 75';
    let sfEndedResult = null;
    const sfBoard = new ComputerChessboard(new MockElement('div'), {
      engine: null,
      colorPreference: 'white',
      difficulty: 'beginner',
      initialFen: seventyFiveFen,
      onGameEnd: res => {
        sfEndedResult = res;
      }
    });
    await sfBoard.startNewGame({
      colorPreference: 'white',
      difficulty: 'beginner',
      initialFen: seventyFiveFen
    });
    const sfMoveRes = await sfBoard.playPlayerMove({ from: 'a1', to: 'a2' });
    assert.equal(sfMoveRes.gameOver, true);
    assert.equal(sfEndedResult.result, 'draw');
    assert.equal(sfEndedResult.termination, 'seventy_five_move_rule');
  }

  // SKENARIO 9 (TASK 8): Checkmate pada langkah ke-75 tetap menang
  console.log('   -> Menguji Skenario 9 (TASK 8): Checkmate pada langkah ke-75 tetap menang...');
  {
    const mateAt75Fen = '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 149 75';
    let mate75EndedResult = null;
    const mate75Board = new ComputerChessboard(new MockElement('div'), {
      engine: null,
      colorPreference: 'white',
      difficulty: 'beginner',
      initialFen: mateAt75Fen,
      onGameEnd: res => {
        mate75EndedResult = res;
      }
    });
    await mate75Board.startNewGame({
      colorPreference: 'white',
      difficulty: 'beginner',
      initialFen: mateAt75Fen
    });

    // Pastikan langkah skakmat Rd8# juga tidak bisa diklaim sebagai remis melalui intended move
    assert.equal(
      mate75Board.chess.canClaimDraw({ from: 'd1', to: 'd8' }),
      false,
      'Langkah yang menghasilkan Checkmate tidak boleh dianggap sebagai klaim remis'
    );

    const mate75Res = await mate75Board.playPlayerMove({ from: 'd1', to: 'd8' }); // Rd8# pada halfMoves = 150!
    assert.equal(mate75Board.chess._halfMoves, 150);
    assert.equal(mate75Board.chess.isCheckmate(), true);
    assert.equal(mate75Board.chess.isSeventyFiveMoveRule(), false);
    assert.equal(mate75Board.chess.isDraw(), false);
    assert.equal(mate75Res.gameOver, true);
    assert.ok(mate75EndedResult);
    assert.equal(mate75EndedResult.result, 'win');
    assert.equal(mate75EndedResult.termination, 'checkmate');
  }

  whiteBoard.destroy();
  blackBoard.destroy();
  engine.terminate();
  console.log('   [LULUS] Seluruh 9 skenario audit FIDE Draw Claim & Position Identity (TASK 8) berfungsi akurat.');
}

// ============================================================================
// 3. PENGUJIAN UI BAHASA INDONESIA (KLAIM REMIS, REMIS OTOMATIS, DLL.)
// ============================================================================
console.log('3. Menguji UI Bahasa Indonesia (Klaim Remis, Remis Otomatis, Pengulangan Lima Kali, Aturan 75 Langkah)...');
{
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  progressService.resetAllProgress();

  // Verifikasi helper label terminasi Bahasa Indonesia
  assert.ok(formatPlayTerminationLabel('threefold_repetition').includes('Klaim Remis'));
  assert.ok(formatPlayTerminationLabel('fifty_move_rule').includes('Klaim Remis'));
  assert.equal(
    formatPlayTerminationLabel('fivefold_repetition'),
    'Remis Otomatis — Pengulangan Lima Kali'
  );
  assert.equal(
    formatPlayTerminationLabel('seventy_five_move_rule'),
    'Remis Otomatis — Aturan 75 Langkah'
  );

  const app = new CaturanApp({ requireAuth: false });
  await app.init();

  app.navigate('play');
  assert.equal(app.currentRoute, 'play');

  const mainEl = document.getElementById('app-main-content');
  mainEl.querySelector('[data-testid="start-play-game-btn"]').click();
  assert.equal(app.currentRoute, 'play-game');

  const activeBoard = getActivePlayBoard();
  assert.ok(activeBoard);
  await new Promise(r => setTimeout(r, 350));

  // Pastikan tombol Klaim Remis ada di UI playGameView dan nonaktif saat belum memenuhi syarat
  const uiClaimBtn = mainEl.querySelector('[data-testid="play-claim-draw-btn"]');
  assert.ok(uiClaimBtn, 'Tombol Klaim Remis harus ada di panel kontrol playGameView');
  assert.ok(uiClaimBtn.textContent.includes('Klaim Remis'));
  assert.equal(uiClaimBtn.disabled, true, 'Tombol Klaim Remis harus disabled saat awal permainan');

  // Simulasikan posisi 50-move rule pada papan aktif di UI dan verifikasi tombol + banner Klaim Remis menyala
  activeBoard.engine = null;
  activeBoard.chess.load('4k3/8/8/8/8/8/8/R3K3 w - - 99 50');
  await activeBoard.playPlayerMove({ from: 'a1', to: 'a2' }); // Mencapai 100 halfmoves (Aturan 50 Langkah)

  assert.equal(activeBoard.isGameOver, false, 'Permainan di UI belum berakhir sebelum Klaim Remis ditekan');
  assert.equal(uiClaimBtn.disabled, false, 'Tombol Klaim Remis harus aktif ketika syarat klaim terpenuhi');
  const claimBanner = mainEl.querySelector('[data-testid="play-claim-draw-banner"]');
  assert.ok(claimBanner, 'Banner Klaim Remis harus tampil di UI saat syarat klaim terpenuhi');
  assert.ok(claimBanner.textContent.includes('Klaim Remis'));

  // Klik tombol Klaim Remis di UI -> harus mengakhiri permainan dengan hasil Seri & menampilkan dialog hasil akhir
  uiClaimBtn.click();
  await new Promise(r => setTimeout(r, 80));
  assert.equal(activeBoard.isGameOver, true, 'Klik tombol Klaim Remis di UI harus mengakhiri permainan');

  const resultDialog = mainEl.querySelector('[data-testid="play-result-dialog"]');
  assert.ok(resultDialog, 'Dialog hasil akhir harus tampil setelah Klaim Remis');
  assert.equal(mainEl.querySelector('[data-testid="play-result-outcome"]').textContent.trim(), 'Seri');
  assert.ok(
    mainEl.querySelector('[data-testid="play-result-termination"]').textContent.includes('Klaim Remis'),
    'Alasan berakhir pada dialog hasil akhir harus menampilkan Klaim Remis'
  );

  // Uji tampilan UI saat Fivefold Repetition (Remis Otomatis — Pengulangan Lima Kali)
  mainEl.querySelector('[data-testid="play-again-btn"]').click();
  await new Promise(r => setTimeout(r, 250));
  activeBoard.engine = null;
  activeBoard.chess.reset();
  for (let i = 0; i < 3; i++) {
    activeBoard.chess.move('Nf3');
    activeBoard.chess.move('Nf6');
    activeBoard.chess.move('Ng1');
    activeBoard.chess.move('Ng8');
  }
  activeBoard.chess.move('Nf3');
  activeBoard.chess.move('Nf6');
  await activeBoard.playPlayerMove({ from: 'f3', to: 'g1' });
  activeBoard.playerColor = 'black';
  activeBoard.playerTurnChar = 'b';
  activeBoard.computerColor = 'white';
  activeBoard.computerTurnChar = 'w';
  await activeBoard.playPlayerMove({ from: 'f6', to: 'g8' }); // Pengulangan ke-5!

  assert.equal(activeBoard.isGameOver, true);
  assert.ok(
    mainEl.querySelector('[data-testid="play-result-title"]').textContent.includes('Remis Otomatis') &&
      mainEl.querySelector('[data-testid="play-result-title"]').textContent.includes('Pengulangan Lima Kali')
  );
  assert.equal(
    mainEl.querySelector('[data-testid="play-result-termination"]').textContent.trim(),
    'Remis Otomatis — Pengulangan Lima Kali'
  );

  // Uji tampilan UI saat Seventy-Five-Move Rule (Remis Otomatis — Aturan 75 Langkah)
  mainEl.querySelector('[data-testid="play-again-btn"]').click();
  await new Promise(r => setTimeout(r, 250));
  activeBoard.engine = null;
  activeBoard.playerColor = 'white';
  activeBoard.playerTurnChar = 'w';
  activeBoard.computerColor = 'black';
  activeBoard.computerTurnChar = 'b';
  activeBoard.chess.load('4k3/8/8/8/8/8/8/R3K3 w - - 149 75');
  await activeBoard.playPlayerMove({ from: 'a1', to: 'a2' }); // Langkah ke-75 (150 halfmoves)

  assert.equal(activeBoard.isGameOver, true);
  assert.ok(
    mainEl.querySelector('[data-testid="play-result-title"]').textContent.includes('Remis Otomatis') &&
      mainEl.querySelector('[data-testid="play-result-title"]').textContent.includes('Aturan 75 Langkah')
  );
  assert.equal(
    mainEl.querySelector('[data-testid="play-result-termination"]').textContent.trim(),
    'Remis Otomatis — Aturan 75 Langkah'
  );

  // Pastikan seluruh CSS tetap 100% solid color (tanpa gradient)
  const cssFiles = ['css/variables.css', 'css/layout.css', 'css/components.css', 'css/chessboard.css'];
  for (const relCss of cssFiles) {
    const content = fs.readFileSync(path.join(ROOT, relCss), 'utf8');
    const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(
      /linear-gradient|radial-gradient|conic-gradient/i.test(withoutComments),
      false,
      `File ${relCss} tidak boleh menggunakan CSS gradient`
    );
  }

  destroyActivePlayBoard({ terminateEngine: true });
  console.log('   [LULUS] UI Bahasa Indonesia untuk Klaim Remis & Remis Otomatis konsisten dengan desain Caturan.');
}

// ============================================================================
// 4. PENGUJIAN SKENARIO 8: STATISTIK PERMAINAN & PLAYPROGRESS
// ============================================================================
console.log('4. Menguji Skenario 8: Statistik permainan dan playProgress mencatat seluruh hasil dengan benar...');
{
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  progressService.resetAllProgress();

  // Rekam berbagai skenario terminasi (termasuk threefold claim, 50-move claim, fivefold auto-draw, 75-move auto-draw, checkmate pada langkah ke-75, dan resign)
  progressService.recordPlayGameFinished({
    id: 'game_stat_threefold_claim',
    result: 'draw',
    playerColor: 'white',
    difficulty: 'beginner',
    startedAt: '2026-11-07T10:00:00.000Z',
    finishedAt: '2026-11-07T10:05:00.000Z',
    termination: 'threefold_repetition',
    pgn: '1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8'
  });

  progressService.recordPlayGameFinished({
    id: 'game_stat_fifty_claim',
    result: 'draw',
    playerColor: 'black',
    difficulty: 'intermediate',
    startedAt: '2026-11-07T10:10:00.000Z',
    finishedAt: '2026-11-07T10:20:00.000Z',
    termination: 'fifty_move_rule',
    pgn: '1. Ra2'
  });

  progressService.recordPlayGameFinished({
    id: 'game_stat_fivefold_auto',
    result: 'draw',
    playerColor: 'white',
    difficulty: 'advanced',
    startedAt: '2026-11-07T10:25:00.000Z',
    finishedAt: '2026-11-07T10:35:00.000Z',
    termination: 'fivefold_repetition',
    pgn: '1. Nf3 Nf6'
  });

  progressService.recordPlayGameFinished({
    id: 'game_stat_seventyfive_auto',
    result: 'draw',
    playerColor: 'black',
    difficulty: 'beginner',
    startedAt: '2026-11-07T10:40:00.000Z',
    finishedAt: '2026-11-07T10:55:00.000Z',
    termination: 'seventy_five_move_rule',
    pgn: '1. Ra2'
  });

  progressService.recordPlayGameFinished({
    id: 'game_stat_checkmate_move75',
    result: 'win',
    playerColor: 'white',
    difficulty: 'intermediate',
    startedAt: '2026-11-07T11:00:00.000Z',
    finishedAt: '2026-11-07T11:15:00.000Z',
    termination: 'checkmate',
    pgn: '75. Rd8#'
  });

  progressService.recordPlayGameFinished({
    id: 'game_stat_resign_loss',
    result: 'loss',
    playerColor: 'black',
    difficulty: 'advanced',
    startedAt: '2026-11-07T11:20:00.000Z',
    finishedAt: '2026-11-07T11:25:00.000Z',
    termination: 'resign',
    pgn: '1. e4 e5'
  });

  // Pastikan duplikasi ID tidak menambah total permainan
  const dupRes = progressService.recordPlayGameFinished({
    id: 'game_stat_fivefold_auto',
    result: 'draw',
    playerColor: 'white',
    difficulty: 'advanced',
    startedAt: '2026-11-07T10:25:00.000Z',
    finishedAt: '2026-11-07T10:35:00.000Z',
    termination: 'fivefold_repetition'
  });
  assert.equal(dupRes.alreadyRecorded, true);

  const playSum = progressService.getPlaySummary();
  assert.equal(playSum.totalGames, 6, 'Total permainan harus 6');
  assert.equal(playSum.wins, 1, 'Total kemenangan harus 1');
  assert.equal(playSum.losses, 1, 'Total kekalahan harus 1');
  assert.equal(playSum.draws, 4, 'Total seri harus 4 (threefold, 50-move, fivefold, 75-move)');
  assert.equal(playSum.winRate, 17); // Math.round(1/6 * 100) = 17%

  const recordedTerminations = new Set(playSum.recentGames.map(g => g.termination));
  assert.equal(recordedTerminations.has('threefold_repetition'), true);
  assert.equal(recordedTerminations.has('fifty_move_rule'), true);
  assert.equal(recordedTerminations.has('fivefold_repetition'), true);
  assert.equal(recordedTerminations.has('seventy_five_move_rule'), true);
  assert.equal(recordedTerminations.has('checkmate'), true);
  assert.equal(recordedTerminations.has('resign'), true);

  // Uji merge deterministik Laptop A & Laptop B dengan terminasi baru
  const stateA = createInitialProgressState();
  stateA.playProgress = sanitizePlayProgress({
    recentGames: [
      {
        id: 'g_fivefold_1',
        result: 'draw',
        playerColor: 'white',
        difficulty: 'beginner',
        startedAt: '2026-11-07T12:00:00.000Z',
        finishedAt: '2026-11-07T12:10:00.000Z',
        termination: 'fivefold_repetition'
      }
    ]
  });
  const stateB = createInitialProgressState();
  stateB.playProgress = sanitizePlayProgress({
    recentGames: [
      {
        id: 'g_75move_2',
        result: 'draw',
        playerColor: 'black',
        difficulty: 'advanced',
        startedAt: '2026-11-07T12:15:00.000Z',
        finishedAt: '2026-11-07T12:30:00.000Z',
        termination: 'seventy_five_move_rule'
      }
    ]
  });
  const merged = mergeProgressStates(stateA, stateB);
  assert.equal(merged.playProgress.totalGames, 2);
  assert.equal(merged.playProgress.draws, 2);
  assert.equal(merged.playProgress.recentGames[0].termination, 'fivefold_repetition');
  assert.equal(merged.playProgress.recentGames[1].termination, 'seventy_five_move_rule');
  console.log('   [LULUS] Skenario 8: Statistik permainan & playProgress mencatat seluruh jenis terminasi dengan akurat.');
}

// ============================================================================
// 5. PENGUJIAN SKENARIO 9: TIDAK ADA REGRESI PADA MVP 1 DAN MVP 2
// ============================================================================
console.log('5. Menguji Skenario 9: Tidak ada regresi pada MVP 1 (30 Materi Belajar) dan MVP 2 (60 Puzzle)...');
{
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  progressService.resetAllProgress();

  const lessons = getAllLessons();
  const puzzles = getAllPuzzles();
  const puzzleCats = getAvailablePuzzleCategories();
  assert.equal(CURRICULUM_CATEGORIES.length, 6, 'Kurikulum MVP 1 harus tetap 6 level');
  assert.equal(lessons.length, 30, 'Kurikulum MVP 1 harus tetap 30 materi');
  assert.equal(puzzles.length, 60, 'Dataset Puzzle MVP 2 harus tetap 60 puzzle');
  assert.equal(puzzleCats.length, 6, 'Kategori Puzzle MVP 2 harus tetap 6 kategori');

  // Uji InteractiveChessboard (MVP 1)
  const lessonMount = new MockElement('div');
  let lessonSolved = false;
  const lessonBoard = new InteractiveChessboard(lessonMount, lessons[0].practice, () => {
    lessonSolved = true;
  });
  assert.ok(lessonBoard.chess, 'InteractiveChessboard MVP 1 harus berhasil diinisialisasi');

  // Uji penyelesaian materi & perhitungan XP (MVP 1)
  progressService.completeLesson(lessons[0].id);
  assert.equal(progressService.getSummary().completedCount, 1);
  assert.equal(progressService.getSummary().totalXp, lessons[0].xpReward);

  // Uji PuzzleChessboard & penyelesaian puzzle (MVP 2)
  const samplePuzzle = puzzles[0];
  const puzzleMount = new MockElement('div');
  let solvedCallbackPayload = null;
  const puzzleBoard = new PuzzleChessboard(puzzleMount, samplePuzzle, {
    replyDelayMs: 0,
    onPuzzleSolved: payload => {
      solvedCallbackPayload = payload;
    }
  });
  for (let i = 0; i < puzzleBoard.solutionMoves.length; i += 2) {
    const moveUci = puzzleBoard.solutionMoves[i];
    const ok = puzzleBoard.playMove(moveUci);
    assert.equal(ok, true, `Langkah solusi puzzle ${moveUci} harus diterima`);
  }
  assert.equal(puzzleBoard.isPuzzleSolved, true, 'PuzzleChessboard MVP 2 harus berhasil diselesaikan');
  assert.ok(solvedCallbackPayload, 'Callback onPuzzleSolved MVP 2 harus terpanggil');
  puzzleBoard.destroy();

  console.log('   [LULUS] Skenario 9: Tidak ada regresi pada MVP 1 (Learn & XP) maupun MVP 2 (Puzzle).');
}

// ============================================================================
// 6. PENGUJIAN BUILD STATIC (dist/), VERCEL.JSON & DEV SERVER MIME TYPE (.wasm)
// ============================================================================
console.log('6. Menguji aset static dist/, konfigurasi vercel.json, dan MIME type application/wasm...');
{
  const vendorJsPath = path.join(ROOT, 'js/vendor/stockfish/stockfish-19-lite-single.js');
  const vendorWasmPath = path.join(ROOT, 'js/vendor/stockfish/stockfish-19-lite-single.wasm');
  const distJsPath = path.join(ROOT, 'dist/js/vendor/stockfish/stockfish-19-lite-single.js');
  const distWasmPath = path.join(ROOT, 'dist/js/vendor/stockfish/stockfish-19-lite-single.wasm');
  const distCopyingPath = path.join(ROOT, 'dist/js/vendor/stockfish/Copying.txt');
  const distNoticePath = path.join(ROOT, 'dist/THIRD_PARTY_NOTICES.md');

  assert.equal(fs.existsSync(vendorJsPath), true);
  assert.equal(fs.existsSync(vendorWasmPath), true);
  assert.equal(fs.existsSync(distJsPath), true);
  assert.equal(fs.existsSync(distWasmPath), true);
  assert.equal(fs.existsSync(distCopyingPath), true);
  assert.equal(fs.existsSync(distNoticePath), true);

  const wasmBuf = fs.readFileSync(distWasmPath);
  assert.ok(wasmBuf.length > 1800000);
  assert.equal(wasmBuf.subarray(0, 4).toString('binary'), '\x00asm');

  const devServerCode = fs.readFileSync(path.join(ROOT, 'dev-server.js'), 'utf8');
  assert.ok(devServerCode.includes("'.wasm': 'application/wasm'"));

  const vercelJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
  assert.equal(vercelJson.outputDirectory, 'dist');
  const wasmHeaderRule = (vercelJson.headers || []).find(h => String(h.source).includes('.wasm'));
  assert.ok(wasmHeaderRule);
  const contentTypeHeader = wasmHeaderRule.headers.find(h => h.key.toLowerCase() === 'content-type');
  assert.equal(contentTypeHeader.value, 'application/wasm');

  console.log('   [LULUS] Build static dist/, header vercel.json, dan MIME type application/wasm terverifikasi.');
}

console.log('\n=== SELURUH PENGUJIAN MVP 3 & TASK 7 (9 SKENARIO REMIS) LULUS 100% TANPA ERROR ===');
process.exit(0);
