import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'd:/Anti Gravity/project/Caturan';
const toUrl = rel => pathToFileURL(path.join(ROOT, rel)).href;

// ---------------------------------------------------------------------------
// Test Runner & Assertion Counter
// ---------------------------------------------------------------------------
let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failedDetails = [];

async function runTest(name, fn) {
  totalTests += 1;
  try {
    await fn();
    passedTests += 1;
    console.log(`   [LULUS] ${name}`);
  } catch (err) {
    failedTests += 1;
    failedDetails.push({ name, error: err });
    console.error(`   [GAGAL] ${name}`);
    console.error(`           ${err && err.stack ? err.stack : err}`);
  }
}

// ---------------------------------------------------------------------------
// Minimal DOM & Web APIs Mock (Kompatibel dengan verify-mvp3.mjs + Form Input/Select)
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
    this.selectionStart = 0;
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
    if (name === 'value') {
      this.value = strVal;
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

  getBoundingClientRect() {
    if (typeof this._rectProvider === 'function') {
      return this._rectProvider(this);
    }
    if (this._boundingRect) {
      return { ...this._boundingRect };
    }
    return { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 };
  }

  setSelectionRange(start) {
    this.selectionStart = Number(start) || 0;
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this.children.map(c => c.textContent).join('');
  }

  set textContent(val) {
    this.children = [];
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
          const closedNode = stack[i].node;
          if (closedNode.tagName === 'SELECT') {
            const selectedOpt = closedNode.children.find(
              c => c.tagName === 'OPTION' && c.hasAttribute('selected')
            );
            const firstOpt = closedNode.children.find(c => c.tagName === 'OPTION');
            if (selectedOpt) {
              closedNode.value = selectedOpt.getAttribute('value') || '';
            } else if (firstOpt) {
              closedNode.value = firstOpt.getAttribute('value') || '';
            }
          }
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
    addEventListener: () => {},
    getElementById(id) {
      return this.body.querySelector(`#${id}`);
    },
    querySelector(sel) {
      if (sel === '#app-shell' || sel === '.app-shell') {
        return this.body.querySelector('#app-shell');
      }
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

// ---------------------------------------------------------------------------
// Import Caturan Modules
// ---------------------------------------------------------------------------
const { Chess, DEFAULT_POSITION } = await import(toUrl('js/vendor/chess.js'));
const {
  OPENING_CATEGORIES,
  OPENING_DIFFICULTIES,
  OPENING_REPERTOIRE_SIDES,
  OPENING_STATUS_META,
  OPENINGS_DATA,
  getAllOpenings,
  getOpeningById,
  getOpeningsByFamily,
  getOpeningFamilies,
  getOpeningsByFilter,
  selectNextOpening
} = await import(toUrl('js/data/openings.js'));
const {
  STORAGE_KEYS,
  SYNC_STATUS,
  createInitialProgressState,
  createInitialPuzzleProgressState,
  createInitialPlayProgressState,
  createInitialOpeningProgressState,
  sanitizeProgressState,
  sanitizePuzzleProgress,
  sanitizePlayProgress,
  sanitizeOpeningProgress,
  hasMeaningfulOpeningProgress,
  hasMeaningfulProgress,
  mergeOpeningProgress,
  mergeProgressStates,
  areProgressStatesEqual,
  LocalStorageAdapter,
  SupabaseStorageAdapter,
  StorageService
} = await import(toUrl('js/services/storage.js'));
const { progressService } = await import(toUrl('js/services/progress.js'));
const {
  InteractiveChessboard,
  PuzzleChessboard,
  ComputerChessboard,
  OpeningLearnBoard,
  OpeningPracticeBoard,
  validateOpeningSequenceWithChess
} = await import(toUrl('js/components/chessboardUI.js'));
const { renderOpeningDashboardView, renderOpeningLibraryView } = await import(
  toUrl('js/components/openingView.js')
);
const { renderOpeningLearnView } = await import(toUrl('js/components/openingLearnView.js'));
const { renderOpeningPracticeView } = await import(toUrl('js/components/openingPracticeView.js'));
const { NAV_ITEMS, renderSidebar } = await import(toUrl('js/components/sidebar.js'));
const { CURRICULUM_CATEGORIES, getAllLessons } = await import(toUrl('js/data/curriculum.js'));
const { getAllPuzzles, getAvailablePuzzleCategories, getDailyPuzzle } = await import(
  toUrl('js/data/puzzles.js')
);
const {
  StockfishEngineService,
  PLAY_DIFFICULTIES,
  PLAY_DIFFICULTY_IDS
} = await import(toUrl('js/services/stockfishEngine.js'));
const { CaturanApp } = await import(toUrl('js/main.js'));

console.log('=== MULAI PENGUJIAN MENYELURUH CATURAN MVP 4 (OPENING TRAINER VERIFICATION SUITE) ===\n');

// ============================================================================
// 1. VALIDASI SELURUH 24 OPENING
// ============================================================================
console.log('1. Menguji Validasi Dataset 24 Opening (js/data/openings.json & js/data/openings.js)...');

await runTest('1.1 Dataset openings.json dan openings.js sinkron dan berisi tepat 24 variasi (12 Putih, 12 Hitam)', () => {
  const rawJsonText = fs.readFileSync(path.join(ROOT, 'js/data/openings.json'), 'utf8');
  const parsedJson = JSON.parse(rawJsonText);

  assert.equal(Array.isArray(parsedJson), true, 'openings.json harus berupa JSON array');
  assert.equal(parsedJson.length, 24, 'Jumlah total opening harus 24 variasi');
  assert.equal(OPENINGS_DATA.length, 24, 'OPENINGS_DATA harus berisi 24 variasi');
  assert.equal(getAllOpenings().length, 24, 'getAllOpenings() harus mengembalikan 24 variasi');
  assert.deepEqual(parsedJson, OPENINGS_DATA, 'openings.json dan OPENINGS_DATA harus identik 100%');

  const whiteList = OPENINGS_DATA.filter(o => o.repertoireSide === 'white');
  const blackList = OPENINGS_DATA.filter(o => o.repertoireSide === 'black');
  assert.equal(whiteList.length, 12, 'Harus ada 12 opening lines untuk Repertoire Putih');
  assert.equal(blackList.length, 12, 'Harus ada 12 opening lines untuk Repertoire Hitam');
});

await runTest('1.2 Tidak ada ID duplikat dan seluruh 5 kategori serta 12 keluarga opening populer tersedia', () => {
  const ids = new Set();
  for (const op of OPENINGS_DATA) {
    assert.ok(typeof op.id === 'string' && op.id.trim().length > 0, 'ID opening wajib valid');
    assert.equal(ids.has(op.id), false, `Ditemukan opening ID duplikat: ${op.id}`);
    ids.add(op.id);
    assert.deepEqual(getOpeningById(op.id), op);
  }
  assert.equal(getOpeningById('non-existent-opening-xyz'), null);

  // Verifikasi 5 kategori wajib
  const requiredCategoryTitles = [
    'Open Games',
    'Semi-Open Games',
    'Closed Games',
    'Semi-Closed Games',
    'Flank Openings'
  ];
  assert.equal(OPENING_CATEGORIES.length, 5);
  for (const catTitle of requiredCategoryTitles) {
    const count = OPENINGS_DATA.filter(o => o.category === catTitle).length;
    assert.ok(count > 0, `Kategori ${catTitle} harus memiliki minimal 1 variasi opening`);
  }

  // Verifikasi 12 keluarga opening populer wajib
  const requiredFamilies = [
    'Italian Game',
    'Ruy Lopez',
    "Queen's Gambit",
    'London System',
    'English Opening',
    'Réti Opening',
    'Sicilian Defense',
    'French Defense',
    'Caro-Kann Defense',
    'Scandinavian Defense',
    "King's Indian Defense",
    "Queen's Gambit Declined"
  ];
  const actualFamilies = new Set(OPENINGS_DATA.map(o => o.family));
  for (const fam of requiredFamilies) {
    assert.equal(actualFamilies.has(fam), true, `Keluarga opening populer "${fam}" wajib tersedia`);
    assert.ok(getOpeningsByFamily(fam).length >= 1);
  }
});

await runTest('1.3 Setiap opening memiliki deskripsi Bahasa Indonesia, keyIdeas, explanationPanel, dan recommendedPractice', () => {
  const validDiffIds = new Set(OPENING_DIFFICULTIES.map(d => d.id));
  const validRepSides = new Set(OPENING_REPERTOIRE_SIDES.map(r => r.id));

  for (const op of OPENINGS_DATA) {
    assert.equal(validRepSides.has(op.repertoireSide), true, `repertoireSide tidak valid pada ${op.id}`);
    assert.equal(validDiffIds.has(op.difficulty), true, `difficulty tidak valid pada ${op.id}`);
    assert.ok(typeof op.difficultyReason === 'string' && op.difficultyReason.length > 15);
    assert.ok(typeof op.description === 'string' && op.description.length > 30, `Deskripsi kurang lengkap pada ${op.id}`);
    assert.ok(Array.isArray(op.keyIdeas) && op.keyIdeas.length >= 3, `keyIdeas minimal 3 poin pada ${op.id}`);
    assert.ok(typeof op.recommendedPractice === 'string' && op.recommendedPractice.length > 15);

    const exp = op.explanationPanel;
    assert.ok(exp && typeof exp === 'object', `explanationPanel wajib ada pada ${op.id}`);
    assert.ok(typeof exp.generalGoal === 'string' && exp.generalGoal.length > 10);
    assert.ok(typeof exp.pieceDevelopment === 'string' && exp.pieceDevelopment.length > 10);
    assert.ok(typeof exp.centerControl === 'string' && exp.centerControl.length > 10);
    assert.ok(typeof exp.kingSafety === 'string' && exp.kingSafety.length > 10);
    assert.ok(typeof exp.generalPlan === 'string' && exp.generalPlan.length > 10);
    assert.ok(typeof exp.guidanceNote === 'string' && exp.guidanceNote.length > 10);
  }
});

// ============================================================================
// 2. VALIDASI FEN, PGN, UCI, ECO, DAN EPD DENGAN CHESS.JS
// ============================================================================
console.log('\n2. Menguji Validasi FEN, PGN, UCI, ECO, dan EPD Menggunakan Chess.js...');

await runTest('2.1 Seluruh 24 opening lulus validasi langkah legal, PGN, UCI, ECO, FEN akhir, dan EPD via Chess.js', () => {
  for (const op of OPENINGS_DATA) {
    // 1. Validasi FEN awal
    assert.equal(op.initialFen, DEFAULT_POSITION, `FEN awal harus posisi standar pada ${op.id}`);
    const gameFromMoves = new Chess(op.initialFen);

    // 2. Validasi setiap langkah legal & moveAnnotations
    assert.ok(Array.isArray(op.moves) && op.moves.length >= 3, `Minimal 3 ply pada ${op.id}`);
    assert.equal(op.moves.length, op.plyCount, `plyCount harus sama dengan panjang moves pada ${op.id}`);
    assert.equal(op.moveAnnotations.length, op.moves.length, `moveAnnotations harus sinkron pada ${op.id}`);

    const generatedUciList = [];
    for (let i = 0; i < op.moves.length; i += 1) {
      const san = op.moves[i];
      const moveObj = gameFromMoves.move(san);
      assert.ok(moveObj, `Langkah ke-${i + 1} (${san}) harus legal menurut Chess.js pada ${op.id}`);
      assert.equal(moveObj.san, san, `Notasi SAN kanonik harus cocok pada ${op.id} ply ${i + 1}`);

      const uciStep = `${moveObj.from}${moveObj.to}${moveObj.promotion || ''}`;
      generatedUciList.push(uciStep);

      const ann = op.moveAnnotations[i];
      assert.equal(ann.ply, i + 1);
      assert.equal(ann.san, moveObj.san);
      assert.equal(ann.uci, uciStep);
      assert.equal(ann.from, moveObj.from);
      assert.equal(ann.to, moveObj.to);
      assert.equal(ann.fenAfter, gameFromMoves.fen(), `fenAfter harus akurat pada ${op.id} ply ${i + 1}`);
    }

    // 3. Validasi PGN dapat diparse dan menghasilkan posisi akhir & string PGN kanonik yang identik
    assert.equal(gameFromMoves.pgn(), op.pgn, `Format PGN kanonik Chess.js harus cocok pada ${op.id}`);
    const parsedPgnTokens = op.pgn
      .replace(/\d+\.(\.\.)?/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const gameFromPgn = new Chess();
    for (const token of parsedPgnTokens) {
      const applied = gameFromPgn.move(token);
      assert.ok(applied, `Token PGN "${token}" harus dapat diparse oleh Chess.js pada ${op.id}`);
    }
    assert.equal(gameFromPgn.fen(), gameFromMoves.fen(), `Hasil parse PGN harus sama dengan urutan moves pada ${op.id}`);
    assert.deepEqual(gameFromPgn.history(), op.moves, `Riwayat langkah PGN harus cocok pada ${op.id}`);

    // 4. Validasi UCI sesuai urutan PGN
    assert.deepEqual(op.uciMoves, generatedUciList, `uciMoves harus cocok pada ${op.id}`);
    assert.equal(op.uci, generatedUciList.join(' '), `String uci harus sesuai urutan PGN pada ${op.id}`);

    // 5. Validasi format kode ECO dan kesesuaian kategori huruf ECO
    assert.equal(/^[A-E]\d{2}$/.test(op.eco), true, `Kode ECO (${op.eco}) harus berformat A00–E99 pada ${op.id}`);

    // 6. Validasi FEN akhir & EPD (4 komponen pertama FEN)
    const finalFen = gameFromMoves.fen();
    assert.equal(op.openingPositionFen, finalFen, `openingPositionFen harus sesuai pada ${op.id}`);
    const expectedEpd = finalFen.split(' ').slice(0, 4).join(' ');
    assert.equal(op.epd, expectedEpd, `Data EPD harus sesuai dengan 4 field pertama FEN akhir pada ${op.id}`);

    // 7. Validasi fungsi helper validateOpeningSequenceWithChess
    const validated = validateOpeningSequenceWithChess(op);
    assert.equal(validated.finalFen, op.openingPositionFen);
    assert.equal(validated.validMoves.length, op.plyCount);
  }
});

await runTest('2.2 validateOpeningSequenceWithChess menolak urutan langkah ilegal secara tegas', () => {
  assert.throws(
    () =>
      validateOpeningSequenceWithChess({
        id: 'invalid-opening-test',
        moves: ['e4', 'e5', 'Ke5'] // Langkah ilegal Raja melompat ke e5
      }),
    /Langkah opening tidak valid/
  );
});

// ============================================================================
// 3. OPENING LIBRARY DAN FILTER
// ============================================================================
console.log('\n3. Menguji Opening Library dan Filter (Repertoire, Kategori, Kesulitan, Status Belajar)...');

await runTest('3.1 Fungsi getOpeningsByFilter memfilter berdasarkan Repertoire, Kategori, Kesulitan, dan Status dengan akurat', () => {
  assert.equal(getOpeningsByFilter({ repertoireSide: 'all' }).length, 24);
  assert.equal(getOpeningsByFilter({ repertoireSide: 'white' }).length, 12);
  assert.equal(getOpeningsByFilter({ repertoireSide: 'black' }).length, 12);

  assert.equal(getOpeningsByFilter({ category: 'open-games' }).length, 5);
  assert.equal(getOpeningsByFilter({ category: 'semi-open-games' }).length, 7);
  assert.equal(getOpeningsByFilter({ category: 'closed-games' }).length, 6);
  assert.equal(getOpeningsByFilter({ category: 'semi-closed-games' }).length, 2);
  assert.equal(getOpeningsByFilter({ category: 'flank-openings' }).length, 4);

  const begCount = getOpeningsByFilter({ difficulty: 'beginner' }).length;
  const intCount = getOpeningsByFilter({ difficulty: 'intermediate' }).length;
  const advCount = getOpeningsByFilter({ difficulty: 'advanced' }).length;
  assert.ok(begCount > 0 && intCount > 0 && advCount > 0, 'Setiap tingkat kesulitan harus memiliki data');
  assert.equal(begCount + intCount + advCount, 24, 'Jumlah seluruh tingkat kesulitan harus 24');

  // Filter status belajar menggunakan statusResolver
  const mockStatusMap = {
    'italian-game-main': 'mastered',
    'ruy-lopez-main': 'studying',
    'sicilian-najdorf': 'needs-review'
  };
  const resolver = id => mockStatusMap[id] || 'not-studied';

  assert.equal(getOpeningsByFilter({ status: 'mastered', statusResolver: resolver }).length, 1);
  assert.equal(getOpeningsByFilter({ status: 'studying', statusResolver: resolver }).length, 1);
  assert.equal(getOpeningsByFilter({ status: 'needs-review', statusResolver: resolver }).length, 1);
  assert.equal(getOpeningsByFilter({ status: 'not-studied', statusResolver: resolver }).length, 21);
});

await runTest('3.2 Komponen renderOpeningLibraryView merender kartu opening dan merespons perubahan filter di DOM', () => {
  const libMount = new MockElement('div');
  const statusMap = {
    'italian-game-main': 'mastered',
    'french-defense-main': 'needs-review',
    'london-system-main': 'studying'
  };
  let lastChangedFilters = null;
  let selectedForLearn = null;
  let selectedForPractice = null;

  renderOpeningLibraryView(libMount, {
    initialFilters: { repertoireSide: 'all', category: 'all' },
    getOpeningStatus: id => statusMap[id] || 'not-studied',
    onFilterChange: f => {
      lastChangedFilters = f;
    },
    onOpenLearn: id => {
      selectedForLearn = id;
    },
    onStartPractice: id => {
      selectedForPractice = id;
    }
  });

  // Awalnya menampilkan seluruh 24 kartu
  const allCards = libMount.querySelectorAll('.opening-library-card');
  assert.equal(allCards.length, 24, 'Library awalnya harus merender 24 kartu opening');
  assert.ok(
    libMount.querySelector('[data-testid="opening-library-count-badge"]').textContent.includes('24 dari 24')
  );

  // Periksa isi kartu Italian Game
  const italianCardStatus = libMount.querySelector('[data-testid="opening-card-status-italian-game-main"]');
  assert.equal(italianCardStatus.textContent.trim(), 'Dikuasai');
  const italianCardMoves = libMount.querySelector('[data-testid="opening-card-moves-italian-game-main"]');
  assert.ok(italianCardMoves.textContent.includes('5 ply'));

  // Ubah filter Repertoire ke Putih
  const repSelect = libMount.querySelector('[data-testid="opening-filter-repertoire"]');
  repSelect.value = 'white';
  repSelect.dispatchEvent({ type: 'change', target: repSelect });
  assert.equal(libMount.querySelectorAll('.opening-library-card').length, 12);
  assert.equal(lastChangedFilters.repertoireSide, 'white');

  // Ubah filter Kategori ke Open Games (Putih + Open Games = 4 variasi: 2 Italian + 2 Ruy Lopez)
  const catSelect = libMount.querySelector('[data-testid="opening-filter-category"]');
  catSelect.value = 'open-games';
  catSelect.dispatchEvent({ type: 'change', target: catSelect });
  assert.equal(libMount.querySelectorAll('.opening-library-card').length, 4);

  // Ubah filter Kesulitan ke Pemula (Putih + Open Games + Pemula = 3 variasi)
  const diffSelect = libMount.querySelector('[data-testid="opening-filter-difficulty"]');
  diffSelect.value = 'beginner';
  diffSelect.dispatchEvent({ type: 'change', target: diffSelect });
  assert.equal(libMount.querySelectorAll('.opening-library-card').length, 3);

  // Ubah filter Status ke Dikuasai (hanya italian-game-main)
  const statusSelect = libMount.querySelector('[data-testid="opening-filter-status"]');
  statusSelect.value = 'mastered';
  statusSelect.dispatchEvent({ type: 'change', target: statusSelect });
  assert.equal(libMount.querySelectorAll('.opening-library-card').length, 1);

  // Klik tombol Pelajari & Latihan pada kartu
  libMount.querySelector('[data-testid="opening-card-learn-italian-game-main"]').click();
  assert.equal(selectedForLearn, 'italian-game-main');
  libMount.querySelector('[data-testid="opening-card-practice-italian-game-main"]').click();
  assert.equal(selectedForPractice, 'italian-game-main');
});

// ============================================================================
// 4. SEARCH NAMA DAN ECO
// ============================================================================
console.log('\n4. Menguji Pencarian berdasarkan Nama Opening dan Kode ECO...');

await runTest('4.1 Pencarian nama opening dan kode ECO mengembalikan hasil yang tepat', () => {
  // Search berdasarkan nama
  const italianResults = getOpeningsByFilter({ searchQuery: 'Italian' });
  assert.equal(italianResults.length, 3);

  const sicilianResults = getOpeningsByFilter({ searchQuery: 'Sicilian' });
  assert.equal(sicilianResults.length, 3);

  const caroKannResults = getOpeningsByFilter({ searchQuery: 'caro-kann' });
  assert.equal(caroKannResults.length, 2);

  const londonResults = getOpeningsByFilter({ searchQuery: 'London System' });
  assert.equal(londonResults.length, 2);

  // Search berdasarkan kode ECO
  const ecoC50 = getOpeningsByFilter({ searchQuery: 'C50' });
  assert.equal(ecoC50.length, 1);
  assert.equal(ecoC50[0].id, 'italian-game-main');

  const ecoB90 = getOpeningsByFilter({ searchQuery: 'b90' }); // case-insensitive
  assert.equal(ecoB90.length, 1);
  assert.equal(ecoB90[0].id, 'sicilian-najdorf');

  const ecoE94 = getOpeningsByFilter({ searchQuery: 'E94' });
  assert.equal(ecoE94.length, 1);
  assert.equal(ecoE94[0].id, 'kings-indian-orthodox');
});

await runTest('4.2 Input pencarian interaktif di Opening Library memfilter kartu dan tombol Reset Filter berfungsi', () => {
  const libMount = new MockElement('div');
  renderOpeningLibraryView(libMount, {
    initialFilters: { repertoireSide: 'all', category: 'all' }
  });

  // Ketik kode ECO "C78" (Ruy Lopez: Morphy Defense)
  let searchInput = libMount.querySelector('[data-testid="opening-search-input"]');
  searchInput.value = 'C78';
  searchInput.dispatchEvent({ type: 'input', target: searchInput });

  let renderedCards = libMount.querySelectorAll('.opening-library-card');
  assert.equal(renderedCards.length, 1);
  assert.equal(renderedCards[0].getAttribute('data-opening-id'), 'ruy-lopez-morphy-ba4');

  // Ketik query yang tidak ada -> menampilkan empty state & tombol reset filter
  searchInput = libMount.querySelector('[data-testid="opening-search-input"]');
  searchInput.value = 'OpeningTidakAdaXYZ999';
  searchInput.dispatchEvent({ type: 'input', target: searchInput });

  assert.equal(libMount.querySelectorAll('.opening-library-card').length, 0);
  const resetBtn = libMount.querySelector('[data-testid="opening-reset-filters-btn"]');
  assert.ok(resetBtn, 'Tombol Reset Semua Filter harus tampil saat hasil pencarian kosong');

  // Klik tombol Reset Semua Filter -> kembali menampilkan 24 variasi
  resetBtn.click();
  assert.equal(libMount.querySelectorAll('.opening-library-card').length, 24);
});

// ============================================================================
// 5. LEARN MODE DAN NAVIGASI LANGKAH
// ============================================================================
console.log('\n5. Menguji Opening Detail & Learn Mode serta Navigasi Langkah Interaktif...');

await runTest('5.1 OpeningLearnBoard mendukung Maju, Mundur, Posisi Awal, Balik Papan, dan pilih langkah dari daftar notasi', () => {
  const learnMount = new MockElement('div');
  const opening = getOpeningById('ruy-lopez-morphy-ba4'); // 9 ply
  let lastStepState = null;

  const boardInstance = renderOpeningLearnView(learnMount, {
    openingId: 'ruy-lopez-morphy-ba4',
    statusInfo: { id: 'studying', label: 'Sedang Dipelajari' },
    onStepChange: s => {
      lastStepState = s;
    }
  });

  assert.ok(boardInstance instanceof OpeningLearnBoard);
  assert.equal(boardInstance.getStepState().currentPly, 0);
  assert.equal(boardInstance.getStepState().fen, DEFAULT_POSITION);
  assert.equal(boardInstance.orientation, 'white');

  // Tombol Reset dan Mundur harus disabled pada posisi awal (ply 0)
  assert.equal(learnMount.querySelector('[data-testid="opening-learn-reset-btn"]').disabled, true);
  assert.equal(learnMount.querySelector('[data-testid="opening-learn-prev-btn"]').disabled, true);
  assert.equal(learnMount.querySelector('[data-testid="opening-learn-next-btn"]').disabled, false);

  // Klik tombol Maju (Next Move) -> Ply 1 (1. e4)
  learnMount.querySelector('[data-testid="opening-learn-next-btn"]').click();
  assert.equal(boardInstance.getStepState().currentPly, 1);
  assert.deepEqual(boardInstance.getStepState().historySan, ['e4']);
  assert.deepEqual(boardInstance.getStepState().lastMove, { from: 'e2', to: 'e4' });
  assert.equal(learnMount.querySelectorAll('.square-last-move').length, 2, 'Petak asal & tujuan harus di-highlight');
  assert.ok(
    learnMount.querySelector('[data-testid="opening-learn-san-pill"]').textContent.includes('e4')
  );
  assert.equal(
    learnMount.querySelector('[data-testid="opening-ply-btn-1"]').classList.contains('active'),
    true
  );

  // Klik langsung tombol notasi pada ply ke-9 (5. O-O)
  const ply9Btn = learnMount.querySelector('[data-testid="opening-ply-btn-9"]');
  assert.ok(ply9Btn);
  ply9Btn.click();
  assert.equal(boardInstance.getStepState().currentPly, 9);
  assert.equal(boardInstance.getStepState().fen, opening.openingPositionFen);
  assert.deepEqual(boardInstance.getStepState().historySan, [
    'e4',
    'e5',
    'Nf3',
    'Nc6',
    'Bb5',
    'a6',
    'Ba4',
    'Nf6',
    'O-O'
  ]);
  assert.equal(learnMount.querySelector('[data-testid="opening-learn-next-btn"]').disabled, true);

  // Klik tombol Mundur (Previous Move) -> kembali ke ply 8 (4...Nf6)
  learnMount.querySelector('[data-testid="opening-learn-prev-btn"]').click();
  assert.equal(boardInstance.getStepState().currentPly, 8);
  assert.equal(boardInstance.getStepState().activeMove.san, 'Nf6');

  // Klik tombol Balik Papan (Flip Board)
  learnMount.querySelector('[data-testid="opening-learn-flip-btn"]').click();
  assert.equal(boardInstance.orientation, 'black');

  // Klik tombol Posisi Awal (Reset)
  learnMount.querySelector('[data-testid="opening-learn-reset-btn"]').click();
  assert.equal(boardInstance.getStepState().currentPly, 0);
  assert.equal(boardInstance.getStepState().fen, DEFAULT_POSITION);
  assert.equal(boardInstance.getStepState().lastMove, null);
});

await runTest('5.2 Explanation Panel pada Learn Mode menampilkan 5 komponen strategis dan catatan panduan umum', () => {
  const learnMount = new MockElement('div');
  const opening = getOpeningById('italian-game-main');
  renderOpeningLearnView(learnMount, { openingId: 'italian-game-main' });

  assert.equal(
    learnMount.querySelector('[data-testid="opening-detail-name"]').textContent.trim(),
    'Italian Game'
  );
  assert.equal(
    learnMount.querySelector('[data-testid="opening-detail-eco"]').textContent.trim(),
    'ECO C50'
  );
  assert.equal(
    learnMount.querySelector('[data-testid="explanation-general-goal"]').textContent.trim(),
    opening.explanationPanel.generalGoal
  );
  assert.equal(
    learnMount.querySelector('[data-testid="explanation-piece-development"]').textContent.trim(),
    opening.explanationPanel.pieceDevelopment
  );
  assert.equal(
    learnMount.querySelector('[data-testid="explanation-center-control"]').textContent.trim(),
    opening.explanationPanel.centerControl
  );
  assert.equal(
    learnMount.querySelector('[data-testid="explanation-king-safety"]').textContent.trim(),
    opening.explanationPanel.kingSafety
  );
  assert.equal(
    learnMount.querySelector('[data-testid="explanation-general-plan"]').textContent.trim(),
    opening.explanationPanel.generalPlan
  );
  assert.ok(
    learnMount
      .querySelector('[data-testid="opening-guidance-notice"]')
      .textContent.includes('Panduan umum')
  );
});

// ============================================================================
// 6. VARIATION SWITCHER
// ============================================================================
console.log('\n6. Menguji Variation Switcher (Navigasi Antar Variasi dalam Keluarga Opening)...');

await runTest('6.1 Variation Switcher merender seluruh variasi keluarga opening dan berpindah variasi saat diklik', () => {
  const learnMount = new MockElement('div');
  let switchedVariationId = null;

  renderOpeningLearnView(learnMount, {
    openingId: 'italian-game-main',
    onSelectVariation: varId => {
      switchedVariationId = varId;
    }
  });

  const switcher = learnMount.querySelector('[data-testid="opening-variation-switcher"]');
  assert.ok(switcher, 'Variation Switcher harus tampil untuk keluarga Italian Game (3 variasi)');

  const pillMain = learnMount.querySelector('[data-testid="variation-pill-italian-game-main"]');
  const pillGiuoco = learnMount.querySelector('[data-testid="variation-pill-italian-giuoco-piano"]');
  const pillTwoKnights = learnMount.querySelector('[data-testid="variation-pill-italian-two-knights"]');
  assert.ok(pillMain && pillGiuoco && pillTwoKnights, 'Ketiga pil variasi Italian Game harus dirender');
  assert.equal(pillMain.classList.contains('btn-primary'), true, 'Variasi aktif harus memiliki class btn-primary');
  assert.equal(pillGiuoco.classList.contains('btn-secondary'), true);

  // Klik pil variasi Giuoco Piano -> memicu callback onSelectVariation('italian-giuoco-piano')
  pillGiuoco.click();
  assert.equal(switchedVariationId, 'italian-giuoco-piano');
});

// ============================================================================
// 7. PRACTICE MODE (WHITE & BLACK REPERTOIRE, MASKED MOVES, AUTO OPPONENT REPLY)
// ============================================================================
console.log('\n7. Menguji Opening Practice Mode (Persiapan, Penyembunyian Langkah, Balasan Lawan Otomatis)...');

await runTest('7.1 Practice Mode menyembunyikan langkah yang belum dimainkan dan menjalankan balasan lawan otomatis pada Repertoire Putih & Hitam', () => {
  // Uji di UI untuk Repertoire Putih (Italian Game: 1. e4 e5 2. Nf3 Nc6 3. Bc4)
  const practiceMount = new MockElement('div');
  let selectedOpeningFromPrep = null;

  const whiteBoard = renderOpeningPracticeView(practiceMount, {
    openingId: 'italian-game-main',
    replyDelayMs: 0,
    onSelectOpening: nextId => {
      selectedOpeningFromPrep = nextId;
    }
  });

  // Pada awal sesi, langkah ke-1 disembunyikan sebagai "1. ?" dan langkah berikutnya "•••"
  const masked1Before = practiceMount.querySelector('[data-testid="masked-move-1"]');
  const masked2Before = practiceMount.querySelector('[data-testid="masked-move-2"]');
  assert.equal(masked1Before.textContent.trim(), '1. ?');
  assert.ok(masked2Before.textContent.includes('•••'));

  // Mainkan langkah pertama dengan mengklik petak e2 lalu petak e4 di atas papan DOM
  const sqE2 = practiceMount.querySelector('.chess-square[data-square="e2"]');
  const sqE4 = practiceMount.querySelector('.chess-square[data-square="e4"]');
  sqE2.click();
  sqE4.click();

  // Karena replyDelayMs = 0, Putih melangkah 1. e4 dan lawan otomatis membalas 1...e5 -> currentPly menjadi 2!
  assert.equal(whiteBoard.getPracticeState().currentPly, 2);
  assert.deepEqual(whiteBoard.getPracticeState().historySan, ['e4', 'e5']);
  assert.equal(
    practiceMount.querySelector('[data-testid="masked-move-1"]').textContent.trim(),
    '1. e4',
    'Langkah yang sudah ditemukan harus terungkap'
  );
  assert.equal(
    practiceMount.querySelector('[data-testid="masked-move-2"]').textContent.trim(),
    '1... e5',
    'Langkah balasan lawan juga terungkap'
  );
  assert.equal(
    practiceMount.querySelector('[data-testid="masked-move-3"]').textContent.trim(),
    '2. ?',
    'Langkah pengguna berikutnya tetap disembunyikan'
  );

  // Uji dropdown pemilih Repertoire di panel persiapan latihan
  const repSelect = practiceMount.querySelector('[data-testid="practice-select-repertoire"]');
  repSelect.value = 'black';
  repSelect.dispatchEvent({ type: 'change', target: repSelect });
  assert.ok(selectedOpeningFromPrep, 'Mengubah dropdown Repertoire harus memilih opening dari Repertoire Hitam');
  assert.equal(getOpeningById(selectedOpeningFromPrep).repertoireSide, 'black');

  // Uji Repertoire Hitam (French Defense: Advance Variation 1. e4 e6 2. d4 d5 3. e5 c5)
  const blackMount = new MockElement('div');
  let blackCompleteState = null;
  const blackBoard = renderOpeningPracticeView(blackMount, {
    openingId: 'french-advance',
    replyDelayMs: 0,
    onPracticeComplete: st => {
      blackCompleteState = st;
    }
  });

  // Lawan (Putih) otomatis melangkah 1. e4 pada awal sesi Repertoire Hitam
  assert.equal(blackBoard.orientation, 'black');
  assert.equal(blackBoard.getPracticeState().currentPly, 1);
  assert.deepEqual(blackBoard.getPracticeState().historySan, ['e4']);

  // Pemain Hitam memainkan 1...e6 -> lawan otomatis membalas 2. d4
  blackBoard.submitPlayerMove('e6');
  assert.equal(blackBoard.getPracticeState().currentPly, 3);
  assert.deepEqual(blackBoard.getPracticeState().historySan, ['e4', 'e6', 'd4']);

  // Pemain Hitam memainkan 2...d5 -> lawan otomatis membalas 3. e5
  blackBoard.submitPlayerMove('d5');
  assert.equal(blackBoard.getPracticeState().currentPly, 5);
  assert.deepEqual(blackBoard.getPracticeState().historySan, ['e4', 'e6', 'd4', 'd5', 'e5']);

  // Pemain Hitam memainkan 3...c5 -> latihan selesai!
  blackBoard.submitPlayerMove('c5');
  assert.equal(blackBoard.getPracticeState().isPracticeComplete, true);
  assert.ok(blackCompleteState);
  assert.equal(blackCompleteState.correctMoves, 3);
  assert.equal(blackCompleteState.wrongMoves, 0);
});

// ============================================================================
// 8. LANGKAH BENAR DAN LANGKAH SALAH (ILEGAL VS LEGAL DI LUAR VARIASI)
// ============================================================================
console.log('\n8. Menguji Validasi Langkah Benar, Langkah Ilegal, dan Langkah Legal di Luar Variasi...');

await runTest('8.1 Membedakan langkah catur ilegal vs langkah catur legal di luar variasi (undo + pesan sopan + izinkan coba lagi)', () => {
  const boardMount = new MockElement('div');
  const opening = getOpeningById('italian-game-main');
  let wrongMovePayload = null;
  let correctMovePayload = null;

  const board = new OpeningPracticeBoard(boardMount, opening, {
    replyDelayMs: 0,
    onWrongMove: payload => {
      wrongMovePayload = payload;
    },
    onMoveCorrect: payload => {
      correctMovePayload = payload;
    }
  });

  const initialFen = board.chess.fen();

  // 1) Langkah ILEGAL menurut aturan catur (misal pion e2 melompat ke e5)
  const illegalRes = board.submitPlayerMove({ from: 'e2', to: 'e5' });
  assert.equal(illegalRes.valid, false);
  assert.equal(illegalRes.isLegalChessMove, false);
  assert.equal(illegalRes.isVariationMove, false);
  assert.equal(illegalRes.reason, 'illegal_move');
  assert.equal(board.chess.fen(), initialFen, 'FEN tidak boleh berubah saat langkah ilegal');
  assert.equal(board.wrongMoves, 0, 'Langkah ilegal catur tidak merusak hitungan wrongMoves variasi');
  assert.ok(board.feedback.message.includes('tidak sah menurut aturan catur'));

  // 2) Langkah LEGAL menurut aturan catur, tetapi BUKAN bagian dari variasi latihan (misal 1. d4 saat melatih Italian Game)
  const wrongVarRes = board.submitPlayerMove({ from: 'd2', to: 'd4' });
  assert.equal(wrongVarRes.valid, false);
  assert.equal(wrongVarRes.isLegalChessMove, true);
  assert.equal(wrongVarRes.isVariationMove, false);
  assert.equal(wrongVarRes.playedSan, 'd4');
  assert.equal(wrongVarRes.expectedSan, 'e4');
  assert.equal(wrongVarRes.reason, 'not_in_variation');

  // Pastikan posisi telah dikembalikan (undo) ke FEN sebelum langkah salah dan pesan sopan ditampilkan
  assert.equal(board.chess.fen(), initialFen, 'Langkah di luar variasi harus di-undo dengan bersih');
  assert.equal(board.chess.history().length, 0);
  assert.equal(board.wrongMoves, 1, 'Kesalahan variasi harus tercatat +1');
  assert.ok(wrongMovePayload && wrongMovePayload.playedSan === 'd4');
  assert.ok(
    board.feedback.message.includes('langkah catur yang sah, tetapi bukan bagian dari variasi'),
    'Pesan peringatan sopan harus menjelaskan bahwa langkah tersebut sah tetapi di luar variasi'
  );

  // 3) Pengguna mencoba lagi dengan langkah yang BENAR (1. e4) -> berhasil dan state papan tetap utuh!
  const retryCorrectRes = board.submitPlayerMove({ from: 'e2', to: 'e4' });
  assert.equal(retryCorrectRes.valid, true);
  assert.equal(retryCorrectRes.isLegalChessMove, true);
  assert.equal(retryCorrectRes.isVariationMove, true);
  assert.equal(retryCorrectRes.playedSan, 'e4');
  assert.ok(correctMovePayload && correctMovePayload.move.san === 'e4');
  assert.equal(board.correctMoves, 1);
  assert.equal(board.currentPly, 2); // termasuk balasan otomatis 1...e5
});

// ============================================================================
// 9. HINT TIGA TAHAP
// ============================================================================
console.log('\n9. Menguji Sistem Hint Bertahap 3 Level (Ide Umum -> Bidak Asal -> Petak Tujuan)...');

await runTest('9.1 Sistem Hint 3 tahap memberikan petunjuk bertahap, menyorot petak di DOM, dan mencatat penggunaan hint', () => {
  const boardMount = new MockElement('div');
  const opening = getOpeningById('queens-gambit-main'); // 1. d4 d5 2. c4
  const hintEvents = [];

  const board = new OpeningPracticeBoard(boardMount, opening, {
    replyDelayMs: 0,
    onHintUsed: ev => hintEvents.push(ev)
  });

  // Tahap 1: Gambaran umum ide langkah (tanpa membocorkan koordinat di highlight papan)
  const h1 = board.showHint();
  assert.equal(h1.hintStage, 1);
  assert.deepEqual(h1.hintSquares, []);
  assert.equal(board.hintsUsed, 1);
  assert.equal(boardMount.querySelectorAll('.square-hint-highlight').length, 0);
  assert.ok(board.feedback.message.includes('Petunjuk 1 (Ide Langkah)'));

  // Tahap 2: Highlight bidak yang perlu diperhatikan (petak asal d2)
  const h2 = board.showHint();
  assert.equal(h2.hintStage, 2);
  assert.deepEqual(h2.hintSquares, ['d2']);
  assert.equal(board.hintsUsed, 2);
  const highlightedStage2 = boardMount.querySelectorAll('.square-hint-highlight');
  assert.equal(highlightedStage2.length, 1);
  assert.equal(highlightedStage2[0].getAttribute('data-square'), 'd2');
  assert.ok(board.feedback.message.includes('Petunjuk 2 (Bidak Asal)'));

  // Tahap 3: Tampilkan petak tujuan (d2 -> d4)
  const h3 = board.showHint();
  assert.equal(h3.hintStage, 3);
  assert.deepEqual(h3.hintSquares, ['d2', 'd4']);
  assert.equal(board.hintsUsed, 3);
  const highlightedStage3 = boardMount.querySelectorAll('.square-hint-highlight');
  assert.equal(highlightedStage3.length, 2);
  assert.ok(board.feedback.message.includes('Petunjuk 3 (Petak Tujuan)'));

  // Klik tombol hint lagi pada ply yang sama -> tetap di tahap 3 dan tidak menambah hintsUsed
  const h3Repeat = board.showHint();
  assert.equal(h3Repeat.hintStage, 3);
  assert.equal(board.hintsUsed, 3, 'hintsUsed tidak boleh bertambah melebihi 3 tahap pada ply yang sama');
  assert.equal(hintEvents.length, 4);

  // Setelah langkah 1. d4 dimainkan, hintStage direset menjadi 0 untuk langkah berikutnya (2. c4)
  board.submitPlayerMove('d4');
  assert.equal(board.hintStage, 0);
  assert.deepEqual(board.hintSquares, []);
});

// ============================================================================
// 10. PRACTICE RESULT CARD
// ============================================================================
console.log('\n10. Menguji Kartu Hasil Latihan (Practice Result Card & Tombol Aksi)...');

await runTest('10.1 Kartu Practice Result menampilkan metrik akurat serta mendukung tombol Ulangi, Opening Berikutnya, dan Kembali ke Library', () => {
  const practiceMount = new MockElement('div');
  let completedState = null;
  let nextOpeningTriggered = null;
  let backLibraryTriggered = false;

  const board = renderOpeningPracticeView(practiceMount, {
    openingId: 'queens-gambit-main', // 1. d4 d5 2. c4
    replyDelayMs: 0,
    onPracticeComplete: st => {
      completedState = st;
    },
    onSelectOpening: id => {
      nextOpeningTriggered = id;
    },
    onBackToLibrary: () => {
      backLibraryTriggered = true;
    }
  });

  // Buat 1 kesalahan dan gunakan 1 hint lalu selesaikan variasi
  board.submitPlayerMove('e4'); // salah (bukan d4) -> wrongMoves = 1
  board.showHint(); // hintsUsed = 1
  board.submitPlayerMove('d4'); // benar (1. d4, dibalas 1...d5)
  board.submitPlayerMove('c4'); // benar (2. c4 -> selesai!)

  assert.ok(completedState);
  const resultCard = practiceMount.querySelector('[data-testid="opening-practice-result-card"]');
  assert.ok(resultCard, 'Kartu Practice Result harus dirender setelah variasi selesai');

  assert.ok(
    practiceMount
      .querySelector('[data-testid="practice-result-status"]')
      .textContent.includes('Perlu Diulang')
  );
  assert.equal(
    practiceMount.querySelector('[data-testid="practice-result-correct"]').textContent.trim(),
    '2'
  );
  assert.equal(
    practiceMount.querySelector('[data-testid="practice-result-wrong"]').textContent.trim(),
    '1'
  );
  assert.equal(
    practiceMount.querySelector('[data-testid="practice-result-hints"]').textContent.trim(),
    '1'
  );
  assert.equal(
    practiceMount.querySelector('[data-testid="practice-result-accuracy"]').textContent.trim(),
    '67%'
  );

  // Klik tombol Ulangi Latihan -> mereset papan ke ply 0 dan menghapus kartu hasil
  practiceMount.querySelector('[data-testid="practice-result-retry-btn"]').click();
  assert.equal(board.getPracticeState().currentPly, 0);
  assert.equal(board.getPracticeState().wrongMoves, 0);
  assert.equal(board.getPracticeState().hintsUsed, 0);
  assert.equal(practiceMount.querySelector('[data-testid="opening-practice-result-card"]'), null);

  // Selesaikan lagi secara sempurna tanpa salah dan tanpa hint
  board.submitPlayerMove('d4');
  board.submitPlayerMove('c4');
  assert.ok(
    practiceMount
      .querySelector('[data-testid="practice-result-status"]')
      .textContent.includes('Dikuasai')
  );
  assert.equal(
    practiceMount.querySelector('[data-testid="practice-result-accuracy"]').textContent.trim(),
    '100%'
  );

  // Klik tombol Opening Berikutnya & Kembali ke Library
  practiceMount.querySelector('[data-testid="practice-result-next-btn"]').click();
  assert.ok(nextOpeningTriggered && nextOpeningTriggered !== 'queens-gambit-main');

  practiceMount.querySelector('[data-testid="practice-result-library-btn"]').click();
  assert.equal(backLibraryTriggered, true);
});

// ============================================================================
// 11. OPENING PROGRESS DAN DETERMINISTIC MERGE
// ============================================================================
console.log('\n11. Menguji Opening Progress Service, Status Pembelajaran, dan Deterministic Merge...');

await runTest('11.1 progressService mengelola 4 status pembelajaran (Belum Dipelajari, Sedang Dipelajari, Perlu Diulang, Dikuasai) & statistik jujur', () => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
  progressService.resetAllProgress();

  // Awalnya semua dimulai dari 0 dan berstatus 'not-studied'
  const initSum = progressService.getOpeningSummary();
  assert.equal(initSum.totalOpeningsCount, 24);
  assert.equal(initSum.studiedCount, 0);
  assert.equal(initSum.masteredCount, 0);
  assert.equal(initSum.totalPracticeSessions, 0);
  assert.equal(initSum.successRate, 0);
  assert.equal(initSum.lastStudiedOpening, null);
  assert.equal(progressService.getOpeningStatus('italian-game-main'), 'not-studied');
  assert.equal(progressService.getOpeningStatusInfo('italian-game-main').label, 'Belum Dipelajari');

  // 1) Buka di Learn Mode -> status menjadi 'studying' (Sedang Dipelajari)
  progressService.markOpeningStudied('italian-game-main');
  assert.equal(progressService.getOpeningStatus('italian-game-main'), 'studying');
  assert.equal(progressService.getOpeningStatusInfo('italian-game-main').label, 'Sedang Dipelajari');

  // 2) Latihan selesai dengan kesalahan/hint -> status menjadi 'needs-review' (Perlu Diulang)
  progressService.recordOpeningPracticeAttempt({
    id: 'att_italian_review_1',
    openingId: 'italian-game-main',
    repertoireSide: 'white',
    correctMoves: 3,
    wrongMoves: 1,
    hintsUsed: 1
  });
  assert.equal(progressService.getOpeningStatus('italian-game-main'), 'needs-review');
  assert.equal(progressService.getOpeningStatusInfo('italian-game-main').label, 'Perlu Diulang');

  // 3) Latihan selesai tanpa kesalahan & tanpa hint -> status menjadi 'mastered' (Dikuasai)
  progressService.recordOpeningPracticeAttempt({
    id: 'att_italian_mastered_2',
    openingId: 'italian-game-main',
    repertoireSide: 'white',
    correctMoves: 3,
    wrongMoves: 0,
    hintsUsed: 0
  });
  assert.equal(progressService.getOpeningStatus('italian-game-main'), 'mastered');
  assert.equal(progressService.getOpeningStatusInfo('italian-game-main').label, 'Dikuasai');

  const updatedSum = progressService.getOpeningSummary();
  assert.equal(updatedSum.studiedCount, 1);
  assert.equal(updatedSum.masteredCount, 1);
  assert.equal(updatedSum.totalPracticeSessions, 2);
  // Total langkah benar = 6, salah = 1 -> 6 / 7 = 86%
  assert.equal(updatedSum.successRate, 86);
  assert.equal(updatedSum.lastStudiedOpening.id, 'italian-game-main');
  assert.equal(updatedSum.repertoireSummary.white.studiedCount, 1);
  assert.equal(updatedSum.repertoireSummary.white.masteredCount, 1);
  assert.equal(progressService.getState().totalXp, 0, 'Latihan opening tidak boleh menambah XP liar');
});

await runTest('11.2 mergeOpeningProgress dan mergeProgressStates menggabungkan progres Local & Cloud secara deterministik tanpa duplikasi sesi', () => {
  const localState = createInitialProgressState();
  localState.completedLessonIds = ['l1-1'];
  localState.openingProgress = sanitizeOpeningProgress({
    studiedOpeningIds: ['italian-game-main', 'london-system-main'],
    masteredOpeningIds: ['london-system-main'],
    attemptEvents: [
      {
        id: 'shared_attempt_001',
        openingId: 'italian-game-main',
        repertoireSide: 'white',
        correctMoves: 3,
        wrongMoves: 1,
        hintsUsed: 0,
        completionStatus: 'needs-review',
        timestamp: '2026-11-07T08:00:00.000Z',
        date: '2026-11-07'
      },
      {
        id: 'local_only_attempt_002',
        openingId: 'london-system-main',
        repertoireSide: 'white',
        correctMoves: 3,
        wrongMoves: 0,
        hintsUsed: 0,
        completionStatus: 'mastered',
        timestamp: '2026-11-07T09:00:00.000Z',
        date: '2026-11-07'
      }
    ],
    lastStudiedOpeningId: 'london-system-main',
    updatedAt: '2026-11-07T09:00:00.000Z'
  });

  const cloudState = createInitialProgressState();
  cloudState.completedLessonIds = ['l1-1', 'l1-2'];
  cloudState.openingProgress = sanitizeOpeningProgress({
    studiedOpeningIds: ['italian-game-main', 'sicilian-najdorf'],
    masteredOpeningIds: ['sicilian-najdorf'],
    attemptEvents: [
      // Event dengan ID yang sama ('shared_attempt_001') tidak boleh dihitung dua kali!
      {
        id: 'shared_attempt_001',
        openingId: 'italian-game-main',
        repertoireSide: 'white',
        correctMoves: 3,
        wrongMoves: 1,
        hintsUsed: 0,
        completionStatus: 'needs-review',
        timestamp: '2026-11-07T08:00:00.000Z',
        date: '2026-11-07'
      },
      {
        id: 'cloud_only_attempt_003',
        openingId: 'sicilian-najdorf',
        repertoireSide: 'black',
        correctMoves: 5,
        wrongMoves: 0,
        hintsUsed: 0,
        completionStatus: 'mastered',
        timestamp: '2026-11-07T10:30:00.000Z',
        date: '2026-11-07'
      }
    ],
    lastStudiedOpeningId: 'sicilian-najdorf',
    updatedAt: '2026-11-07T10:30:00.000Z'
  });

  const merged = mergeProgressStates(localState, cloudState);
  assert.equal(
    merged.openingProgress.attemptEvents.length,
    3,
    'Sesi dengan ID sama (shared_attempt_001) tidak boleh digandakan'
  );
  assert.deepEqual(
    [...merged.openingProgress.studiedOpeningIds].sort(),
    ['italian-game-main', 'london-system-main', 'sicilian-najdorf'].sort()
  );
  assert.deepEqual(
    [...merged.openingProgress.masteredOpeningIds].sort(),
    ['london-system-main', 'sicilian-najdorf'].sort()
  );
  assert.equal(
    merged.openingProgress.lastStudiedOpeningId,
    'sicilian-najdorf',
    'Harus memilih lastStudiedOpeningId dari timestamp terbaru'
  );

  // Pastikan sifat idempoten: merge(merged, cloudState) === merged
  const mergedAgain = mergeProgressStates(merged, cloudState);
  assert.equal(areProgressStatesEqual(merged, mergedAgain), true, 'Merge harus bersifat idempoten');
});

// ============================================================================
// 12. BACKWARD COMPATIBILITY SCHEMA
// ============================================================================
console.log('\n12. Menguji Backward Compatibility Schema (Data Lama MVP 1, MVP 2, MVP 3 & Data Korup)...');

await runTest('12.1 Data pengguna lama tanpa field openingProgress tetap valid dan seluruh progres MVP 1-3 terjaga utuh', () => {
  // Payload warisan MVP 1 / MVP 2 / MVP 3 tanpa properti openingProgress sama sekali
  const legacyMvp3Payload = {
    schemaVersion: 2,
    totalXp: 99999, // Harus dihitung ulang secara deterministik dari completedLessonIds
    completedLessonIds: ['l1-1', 'l1-2'],
    startedLessonIds: ['l1-1', 'l1-2', 'l1-3'],
    lastOpenedLessonId: 'l1-3',
    activityDates: ['2026-11-06', '2026-11-07'],
    lessonCompletedAt: {
      'l1-1': '2026-11-06T08:00:00.000Z',
      'l1-2': '2026-11-07T08:00:00.000Z'
    },
    puzzleProgress: {
      solvedPuzzleIds: ['puz-001'],
      attemptEvents: [
        {
          id: 'puz_att_1',
          puzzleId: 'puz-001',
          solved: true,
          hintsUsed: 0,
          wrongMoves: 0,
          mode: 'category',
          timestamp: '2026-11-07T09:00:00.000Z',
          date: '2026-11-07'
        }
      ],
      dailyPuzzleDates: ['2026-11-07'],
      lastPlayedPuzzleId: 'puz-001',
      updatedAt: '2026-11-07T09:00:00.000Z'
    },
    playProgress: {
      totalGames: 1,
      wins: 1,
      losses: 0,
      draws: 0,
      lastPlayedAt: '2026-11-07T09:30:00.000Z',
      gameEvents: [
        {
          id: 'play_g_1',
          result: 'win',
          playerColor: 'white',
          difficulty: 'beginner',
          startedAt: '2026-11-07T09:20:00.000Z',
          finishedAt: '2026-11-07T09:30:00.000Z',
          termination: 'checkmate',
          pgn: '1. e4 e5'
        }
      ]
    },
    updatedAt: '2026-11-07T09:30:00.000Z'
    // openingProgress sengaja tidak ada
  };

  const sanitized = sanitizeProgressState(legacyMvp3Payload, { recalculateXp: true });
  assert.equal(sanitized.schemaVersion, 2);
  assert.deepEqual(sanitized.completedLessonIds, ['l1-1', 'l1-2']);
  assert.equal(sanitized.puzzleProgress.solvedPuzzleIds.length, 1);
  assert.equal(sanitized.playProgress.totalGames, 1);
  assert.deepEqual(
    sanitized.openingProgress,
    createInitialOpeningProgressState(),
    'Data lama tanpa openingProgress harus otomatis mendapatkan default openingProgress kosong yang bersih'
  );
  assert.equal(hasMeaningfulOpeningProgress(sanitized.openingProgress), false);
  assert.equal(hasMeaningfulProgress(sanitized), true);
});

await runTest('12.2 Sanitasi tahan terhadap nilai openingProgress yang korup atau tidak valid', () => {
  assert.deepEqual(sanitizeOpeningProgress(null), createInitialOpeningProgressState());
  assert.deepEqual(sanitizeOpeningProgress('invalid-string'), createInitialOpeningProgressState());
  assert.deepEqual(sanitizeOpeningProgress([1, 2, 3]), createInitialOpeningProgressState());

  const corruptedOpening = sanitizeOpeningProgress({
    studiedOpeningIds: ['italian-game-main', '', null, 123, 'italian-game-main'],
    masteredOpeningIds: [null, '  '],
    attemptEvents: [
      null,
      { id: '', openingId: 'italian-game-main' }, // invalid empty id
      {
        id: 'valid_ev_1',
        openingId: 'ruy-lopez-main',
        repertoireSide: 'INVALID_SIDE',
        correctMoves: -10,
        wrongMoves: 'bukan-angka',
        hintsUsed: null,
        completionStatus: 'completed',
        timestamp: 'invalid-date'
      }
    ],
    lastStudiedOpeningId: '   ',
    updatedAt: 'bukan-iso-date'
  });

  assert.equal(corruptedOpening.attemptEvents.length, 1);
  assert.equal(corruptedOpening.attemptEvents[0].repertoireSide, 'white');
  assert.equal(corruptedOpening.attemptEvents[0].correctMoves, 0);
  assert.equal(corruptedOpening.attemptEvents[0].wrongMoves, 0);
  assert.equal(corruptedOpening.attemptEvents[0].hintsUsed, 0);
  assert.deepEqual(
    corruptedOpening.studiedOpeningIds.sort(),
    ['italian-game-main', 'ruy-lopez-main'].sort()
  );
  assert.equal(corruptedOpening.lastStudiedOpeningId, 'ruy-lopez-main');
  assert.equal(corruptedOpening.updatedAt, null);
});

// ============================================================================
// 13. INTEGRASI SUPABASE STORAGE ADAPTER & STORAGESERVICE CLOUD SYNC
// ============================================================================
console.log('\n13. Menguji Integrasi SupabaseStorageAdapter & StorageService Cloud Sync...');

await runTest('13.1 SupabaseStorageAdapter (fetchUserProgress, insertUserProgress, updateUserProgress, saveUserProgress) memproses openingProgress dengan benar', async () => {
  const mockDbRows = new Map();

  // Mock Supabase Client yang mensimulasikan query tabel public.user_progress
  const mockSupabaseClient = {
    from(tableName) {
      assert.equal(tableName, 'user_progress', 'Harus menggunakan tabel public.user_progress');
      return {
        select() {
          return {
            eq(col, userId) {
              assert.equal(col, 'user_id');
              return {
                async maybeSingle() {
                  const row = mockDbRows.get(userId) || null;
                  return { data: row, error: null };
                }
              };
            }
          };
        },
        insert(payload) {
          return {
            select() {
              return {
                async single() {
                  const row = {
                    user_id: payload.user_id,
                    progress: payload.progress,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  };
                  mockDbRows.set(payload.user_id, row);
                  return { data: row, error: null };
                }
              };
            }
          };
        },
        update(payload) {
          return {
            eq(col, userId) {
              assert.equal(col, 'user_id');
              return {
                select() {
                  return {
                    async single() {
                      const row = {
                        user_id: userId,
                        progress: payload.progress,
                        updated_at: new Date().toISOString()
                      };
                      mockDbRows.set(userId, row);
                      return { data: row, error: null };
                    }
                  };
                }
              };
            }
          };
        },
        upsert(payload) {
          return {
            select() {
              return {
                async single() {
                  const row = {
                    user_id: payload.user_id,
                    progress: payload.progress,
                    updated_at: new Date().toISOString()
                  };
                  mockDbRows.set(payload.user_id, row);
                  return { data: row, error: null };
                }
              };
            }
          };
        }
      };
    }
  };

  const adapter = new SupabaseStorageAdapter(() => mockSupabaseClient);
  const testUserId = 'user-uuid-mvp4-test';

  // 1) Fetch saat baris belum ada
  const emptyFetch = await adapter.fetchUserProgress(testUserId);
  assert.equal(emptyFetch.ok, true);
  assert.equal(emptyFetch.exists, false);
  assert.equal(emptyFetch.progress, null);

  // 2) Insert progres baru dengan openingProgress
  const initialProg = createInitialProgressState();
  initialProg.openingProgress.studiedOpeningIds = ['italian-game-main'];
  initialProg.openingProgress.lastStudiedOpeningId = 'italian-game-main';
  const insertRes = await adapter.insertUserProgress(testUserId, initialProg);
  assert.equal(insertRes.ok, true);
  assert.deepEqual(insertRes.progress.openingProgress.studiedOpeningIds, ['italian-game-main']);

  // 3) Update progres dengan sesi latihan opening baru
  const updatedProg = {
    ...insertRes.progress,
    openingProgress: {
      ...insertRes.progress.openingProgress,
      masteredOpeningIds: ['italian-game-main'],
      attemptEvents: [
        {
          id: 'supa_att_1',
          openingId: 'italian-game-main',
          repertoireSide: 'white',
          correctMoves: 3,
          wrongMoves: 0,
          hintsUsed: 0,
          completionStatus: 'mastered',
          timestamp: '2026-11-07T12:00:00.000Z',
          date: '2026-11-07'
        }
      ]
    }
  };
  const updateRes = await adapter.updateUserProgress(testUserId, updatedProg);
  assert.equal(updateRes.ok, true);
  assert.equal(updateRes.progress.openingProgress.masteredOpeningIds.includes('italian-game-main'), true);

  // 4) Upsert (saveUserProgress) & Fetch kembali dari mock database
  const saveRes = await adapter.saveUserProgress(testUserId, updateRes.progress);
  assert.equal(saveRes.ok, true);

  const fetchedAgain = await adapter.fetchUserProgress(testUserId);
  assert.equal(fetchedAgain.ok, true);
  assert.equal(fetchedAgain.exists, true);
  assert.equal(fetchedAgain.progress.openingProgress.attemptEvents.length, 1);
  assert.equal(fetchedAgain.progress.openingProgress.attemptEvents[0].id, 'supa_att_1');
});

await runTest('13.2 StorageService.performInitialSync menangani skenario local_to_cloud, cloud_to_local, dan merged untuk openingProgress', async () => {
  globalThis.localStorage.clear();
  const localAdapter = new LocalStorageAdapter();
  let cloudRow = null;

  const mockCloudAdapter = {
    async fetchUserProgress() {
      if (!cloudRow) return { ok: true, exists: false, progress: null };
      return { ok: true, exists: true, progress: cloudRow };
    },
    async insertUserProgress(_uid, prog) {
      cloudRow = sanitizeProgressState(prog, { recalculateXp: true });
      return { ok: true, progress: cloudRow };
    },
    async saveUserProgress(_uid, prog) {
      cloudRow = sanitizeProgressState(prog, { recalculateXp: true });
      return { ok: true, progress: cloudRow };
    }
  };

  const svc = new StorageService({
    localAdapter,
    cloudAdapter: mockCloudAdapter,
    debounceMs: 10
  });

  // Skenario A: Local memiliki progres opening, Cloud belum ada baris -> local_to_cloud
  const localInit = createInitialProgressState();
  localInit.openingProgress.studiedOpeningIds = ['caro-kann-main'];
  localInit.openingProgress.lastStudiedOpeningId = 'caro-kann-main';
  localAdapter.saveProgress(localInit);

  const syncA = await svc.performInitialSync('user-sync-a');
  assert.equal(syncA.ok, true);
  assert.equal(syncA.condition, 'local_to_cloud');
  assert.deepEqual(cloudRow.openingProgress.studiedOpeningIds, ['caro-kann-main']);

  // Skenario B: Local kosong (perangkat baru), Cloud sudah punya progres opening -> cloud_to_local
  globalThis.localStorage.clear();
  const syncB = await svc.performInitialSync('user-sync-a');
  assert.equal(syncB.ok, true);
  assert.equal(syncB.condition, 'cloud_to_local');
  assert.deepEqual(
    localAdapter.getProgress().openingProgress.studiedOpeningIds,
    ['caro-kann-main']
  );

  // Skenario C: Local menambah latihan baru, Cloud juga punya latihan lain -> merged
  const localWithNew = localAdapter.getProgress();
  localWithNew.openingProgress.studiedOpeningIds.push('scandinavian-main');
  localAdapter.saveProgress(localWithNew);

  cloudRow = sanitizeProgressState({
    ...cloudRow,
    openingProgress: {
      ...cloudRow.openingProgress,
      studiedOpeningIds: ['caro-kann-main', 'reti-opening-main']
    }
  });

  const syncC = await svc.performInitialSync('user-sync-a');
  assert.equal(syncC.ok, true);
  assert.equal(syncC.condition, 'merged');
  assert.deepEqual(
    [...syncC.progress.openingProgress.studiedOpeningIds].sort(),
    ['caro-kann-main', 'reti-opening-main', 'scandinavian-main'].sort()
  );
  assert.equal(svc.getSyncState().status, SYNC_STATUS.SYNCED);
});

// ============================================================================
// 14. REGRESI FITUR MVP 1, MVP 2, DAN MVP 3 + INTEGRASI CATURANAPP & BUILD
// ============================================================================
console.log('\n14. Menguji Tidak Ada Regresi pada MVP 1, MVP 2, MVP 3, Routing CaturanApp, dan Build Statis...');

await runTest('14.1 Regresi MVP 1 (Dashboard, 6 Level, 30 Materi, InteractiveChessboard, XP & Streak)', () => {
  globalThis.localStorage.clear();
  progressService.resetAllProgress();

  const lessons = getAllLessons();
  assert.equal(CURRICULUM_CATEGORIES.length, 6, 'Kurikulum MVP 1 tetap 6 level');
  assert.equal(lessons.length, 30, 'Kurikulum MVP 1 tetap 30 materi');

  const boardMount = new MockElement('div');
  const board = new InteractiveChessboard(boardMount, lessons[0].practice, () => {});
  assert.ok(board.chess, 'InteractiveChessboard MVP 1 berfungsi');

  progressService.completeLesson(lessons[0].id);
  const summary = progressService.getSummary();
  assert.equal(summary.completedCount, 1);
  assert.equal(summary.totalXp, lessons[0].xpReward);
  assert.ok(summary.openingSummary, 'getSummary() harus menyertakan openingSummary untuk MVP 4');
});

await runTest('14.2 Regresi MVP 2 (60 Puzzle, 6 Kategori, Puzzle Harian, PuzzleChessboard)', () => {
  const puzzles = getAllPuzzles();
  const categories = getAvailablePuzzleCategories();
  assert.equal(puzzles.length, 60, 'Koleksi puzzle MVP 2 tetap 60 puzzle');
  assert.equal(categories.length, 6, 'Kategori puzzle MVP 2 tetap 6 kategori');

  const daily = getDailyPuzzle('2026-11-07');
  assert.ok(daily && daily.id, 'Puzzle Harian MVP 2 berfungsi');

  const puzzleMount = new MockElement('div');
  let solvedPayload = null;
  const pBoard = new PuzzleChessboard(puzzleMount, puzzles[0], {
    replyDelayMs: 0,
    onPuzzleSolved: p => {
      solvedPayload = p;
    }
  });
  for (let i = 0; i < pBoard.solutionMoves.length; i += 2) {
    assert.equal(pBoard.playMove(pBoard.solutionMoves[i]), true);
  }
  assert.equal(pBoard.isPuzzleSolved, true);
  assert.ok(solvedPayload);
  pBoard.destroy();
});

await runTest('14.3 Regresi MVP 3 (Stockfish 19 Lite WASM, ComputerChessboard, Klaim Remis FIDE, Play Progress)', async () => {
  assert.equal(PLAY_DIFFICULTIES.length, 3);
  const engine = new StockfishEngineService();
  const ready = await engine.init();
  assert.equal(ready.isUciOk, true);
  assert.equal(ready.isReady, true);
  assert.equal(engine.supportsOption('Skill Level'), true);

  await engine.startNewGame({ gameId: 'reg_mvp3_1', difficulty: PLAY_DIFFICULTY_IDS.BEGINNER });
  const best = await engine.requestBestMove({
    fen: DEFAULT_POSITION,
    moveTimeMs: 100,
    gameId: 'reg_mvp3_1'
  });
  assert.equal(best.cancelled, false);
  assert.ok(best.uciMove);
  engine.terminate();

  // Uji klaim remis 50 langkah pada ComputerChessboard
  const fiftyFen = '4k3/8/8/8/8/8/8/R3K3 w - - 99 50';
  const compBoard = new ComputerChessboard(new MockElement('div'), {
    engine: null,
    colorPreference: 'white',
    difficulty: 'beginner',
    initialFen: fiftyFen
  });
  await compBoard.startNewGame({
    colorPreference: 'white',
    difficulty: 'beginner',
    initialFen: fiftyFen
  });
  const claimRes = await compBoard.claimDraw({ from: 'a1', to: 'a2' });
  assert.equal(claimRes.ok, true);
  assert.equal(claimRes.termination, 'fifty_move_rule');
  compBoard.destroy();
});

await runTest('14.4 Integrasi CaturanApp, Sidebar (Opening Trainer Aktif, Analisis Coming Soon), dan Aturan CSS 100% Solid Color', async () => {
  const openingItem = NAV_ITEMS.find(item => item.id === 'opening-trainer');
  const analysisItem = NAV_ITEMS.find(item => item.id === 'analysis');
  assert.equal(openingItem.activeInMvp, true, 'Menu Opening Trainer wajib aktif');
  assert.equal(analysisItem.activeInMvp, false, 'Menu Analisis wajib tetap nonaktif (Coming Soon)');
  assert.equal(analysisItem.badge, 'Coming Soon');

  globalThis.localStorage.clear();
  progressService.resetAllProgress();

  const app = new CaturanApp({ requireAuth: false });
  await app.init();

  // Navigasi ke Opening Dashboard (#opening-trainer)
  app.navigate('opening-trainer');
  assert.equal(app.currentRoute, 'opening-trainer');
  const mainEl = document.getElementById('app-main-content');
  assert.ok(mainEl.querySelector('[data-testid="opening-dashboard-view"]'));
  assert.equal(
    mainEl.querySelector('[data-testid="white-rep-available"]').textContent.trim(),
    '12'
  );
  assert.equal(
    mainEl.querySelector('[data-testid="black-rep-available"]').textContent.trim(),
    '12'
  );

  // Klik tombol Jelajahi Repertoire Putih dari Dashboard
  mainEl.querySelector('[data-testid="explore-white-repertoire-btn"]').click();
  assert.equal(app.currentRoute, 'opening-library');
  assert.equal(mainEl.querySelectorAll('.opening-library-card').length, 12);

  // Buka Learn Mode (#opening-learn/italian-game-main)
  app.openOpeningLearn('italian-game-main');
  assert.equal(app.currentRoute, 'opening-learn');
  assert.equal(app.activeOpeningId, 'italian-game-main');
  assert.equal(progressService.getOpeningStatus('italian-game-main'), 'studying');

  // Buka Practice Mode (#opening-practice/italian-game-main)
  app.openOpeningPractice('italian-game-main');
  assert.equal(app.currentRoute, 'opening-practice');
  assert.ok(mainEl.querySelector('[data-testid="opening-practice-view"]'));

  // Verifikasi seluruh file CSS 100% warna solid (tanpa linear/radial/conic-gradient)
  const cssFiles = ['css/variables.css', 'css/layout.css', 'css/components.css', 'css/chessboard.css'];
  for (const relCss of cssFiles) {
    const content = fs.readFileSync(path.join(ROOT, relCss), 'utf8');
    const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(
      /linear-gradient|radial-gradient|conic-gradient/i.test(withoutComments),
      false,
      `File ${relCss} melanggar aturan 100% solid color`
    );
  }

  // Verifikasi atribusi Lichess chess-openings di README.md & THIRD_PARTY_NOTICES.md
  const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const notices = fs.readFileSync(path.join(ROOT, 'THIRD_PARTY_NOTICES.md'), 'utf8');
  assert.ok(readme.includes('https://github.com/lichess-org/chess-openings'));
  assert.ok(notices.includes('https://github.com/lichess-org/chess-openings'));
});

await runTest('14.5 Validasi UI Opening Trainer Dashboard (Tanpa undefined/null/[object Object], 4 Kartu Statistik Konsisten, Kondisi Akun Baru & Berprogres)', async () => {
  const { UI_ICONS } = await import(toUrl('js/components/icons.js'));
  const requiredIcons = [
    'opening',
    'learn',
    'trophy',
    'target',
    'checkCircle',
    'check',
    'arrowRight',
    'chevronLeft',
    'chevronRight',
    'restart',
    'hint',
    'flip'
  ];
  for (const iconKey of requiredIcons) {
    assert.equal(typeof UI_ICONS[iconKey], 'string', `Ikon UI_ICONS.${iconKey} wajib tersedia`);
    assert.ok(UI_ICONS[iconKey].includes('<svg'), `Ikon UI_ICONS.${iconKey} harus berupa elemen SVG valid`);
  }

  // 1) Uji kondisi akun baru (progres kosong / 0)
  globalThis.localStorage.clear();
  progressService.resetAllProgress();

  const dashMount = new MockElement('div');
  renderOpeningDashboardView(dashMount, {
    openingSummary: progressService.getOpeningSummary(),
    userEmail: 'pecatur.baru@caturan.id'
  });

  const checkNoUndefinedOrInvalidText = (mount, viewName) => {
    const html = mount.innerHTML;
    const text = mount.textContent;
    assert.equal(
      /\bundefined\b/i.test(html),
      false,
      `${viewName} tidak boleh mengandung teks "undefined" di HTML`
    );
    assert.equal(
      /\bundefined\b/i.test(text),
      false,
      `${viewName} tidak boleh mengandung teks "undefined" di textContent`
    );
    assert.equal(
      /\bnull\b/i.test(text),
      false,
      `${viewName} tidak boleh menampilkan teks "null" kepada pengguna`
    );
    assert.equal(
      html.includes('[object Object]'),
      false,
      `${viewName} tidak boleh menampilkan "[object Object]"`
    );
  };

  checkNoUndefinedOrInvalidText(dashMount, 'Opening Dashboard (Akun Baru)');

  // Periksa 4 kartu statistik pada akun baru
  const statCards = dashMount.querySelectorAll('.opening-stats-grid .stat-card');
  assert.equal(statCards.length, 4, 'Harus terdapat tepat 4 kartu statistik pada Opening Dashboard');
  for (const card of statCards) {
    assert.equal(card.classList.contains('card'), true, 'Setiap kartu statistik wajib menggunakan class .card');
    assert.ok(card.querySelector('.stat-icon-box svg'), 'Setiap kartu statistik wajib memiliki ikon SVG di dalam .stat-icon-box');
    assert.ok(card.querySelector('.stat-label'), 'Setiap kartu statistik wajib memiliki .stat-label');
    assert.ok(card.querySelector('.stat-value'), 'Setiap kartu statistik wajib memiliki .stat-value');
    assert.ok(card.querySelector('.stat-caption'), 'Setiap kartu statistik wajib memiliki .stat-caption');
  }

  assert.equal(
    dashMount.querySelector('[data-testid="stat-studied-value"]').textContent.trim(),
    '0 / 24'
  );
  assert.equal(
    dashMount.querySelector('[data-testid="stat-mastered-value"]').textContent.trim(),
    '0 / 24'
  );
  assert.equal(
    dashMount.querySelector('[data-testid="stat-sessions-value"]').textContent.trim(),
    '0'
  );
  assert.equal(
    dashMount.querySelector('[data-testid="stat-success-rate-value"]').textContent.trim(),
    '0%'
  );

  // Periksa tombol CTA Header dan kondisi Empty State awal
  const exploreBtn = dashMount.querySelector('[data-testid="opening-explore-library-btn"]');
  const quickPracticeBtn = dashMount.querySelector('[data-testid="opening-quick-practice-btn"]');
  assert.ok(exploreBtn.textContent.includes('Buka Koleksi Opening (24 Variasi)'));
  assert.equal(quickPracticeBtn.textContent.trim(), 'Mulai Mode Latihan');
  assert.ok(quickPracticeBtn.querySelector('svg'), 'Tombol Mulai Mode Latihan harus memiliki ikon SVG');
  assert.ok(dashMount.querySelector('[data-testid="opening-last-studied-empty"]'));

  // 2) Uji kondisi akun yang memiliki progres belajar & latihan
  progressService.markOpeningStudied('italian-game-main');
  progressService.recordOpeningPracticeAttempt({
    id: 'ui_verify_att_1',
    openingId: 'italian-game-main',
    repertoireSide: 'white',
    correctMoves: 3,
    wrongMoves: 0,
    hintsUsed: 0
  });
  progressService.recordOpeningPracticeAttempt({
    id: 'ui_verify_att_2',
    openingId: 'sicilian-najdorf',
    repertoireSide: 'black',
    correctMoves: 4,
    wrongMoves: 1,
    hintsUsed: 1
  });

  renderOpeningDashboardView(dashMount, {
    openingSummary: progressService.getOpeningSummary(),
    userEmail: 'pecatur.aktif@caturan.id'
  });

  checkNoUndefinedOrInvalidText(dashMount, 'Opening Dashboard (Akun Berprogres)');
  assert.equal(
    dashMount.querySelector('[data-testid="stat-studied-value"]').textContent.trim(),
    '2 / 24'
  );
  assert.equal(
    dashMount.querySelector('[data-testid="stat-mastered-value"]').textContent.trim(),
    '1 / 24'
  );
  assert.equal(
    dashMount.querySelector('[data-testid="stat-sessions-value"]').textContent.trim(),
    '2'
  );
  assert.equal(
    dashMount.querySelector('[data-testid="stat-success-rate-value"]').textContent.trim(),
    '88%'
  );
  assert.ok(dashMount.querySelector('[data-testid="opening-last-studied-card"]'));
  assert.equal(
    dashMount.querySelector('[data-testid="last-studied-name"]').textContent.trim(),
    'Sicilian Defense: Najdorf Variation'
  );

  // 3) Periksa juga Library, Learn Mode, dan Practice Mode bebas dari teks undefined/null/[object Object]
  const libMount = new MockElement('div');
  renderOpeningLibraryView(libMount, {
    getOpeningStatus: id => progressService.getOpeningStatus(id)
  });
  checkNoUndefinedOrInvalidText(libMount, 'Opening Library View');

  const learnMount = new MockElement('div');
  renderOpeningLearnView(learnMount, {
    openingId: 'italian-game-main',
    statusInfo: progressService.getOpeningStatusInfo('italian-game-main')
  });
  checkNoUndefinedOrInvalidText(learnMount, 'Opening Learn View');

  const practiceMount = new MockElement('div');
  renderOpeningPracticeView(practiceMount, {
    openingId: 'italian-game-main',
    replyDelayMs: 0
  });
  checkNoUndefinedOrInvalidText(practiceMount, 'Opening Practice View');
});

await runTest('14.6 Validasi Navigasi Learn/Practice, Keseimbangan Kartu Repertoire Putih & Hitam, dan Aturan Responsivitas CSS', () => {
  // 1) Periksa navigasi tombol pada Learn Mode
  const learnMount = new MockElement('div');
  let learnBackLib = false;
  let learnBackDash = false;
  let learnStartPractice = null;

  renderOpeningLearnView(learnMount, {
    openingId: 'italian-game-main',
    statusInfo: { id: 'studying', label: 'Sedang Dipelajari' },
    onBackToLibrary: () => {
      learnBackLib = true;
    },
    onBackToDashboard: () => {
      learnBackDash = true;
    },
    onStartPractice: id => {
      learnStartPractice = id;
    }
  });

  const learnTopbar = learnMount.querySelector('[data-testid="opening-learn-topbar"]');
  assert.ok(learnTopbar && learnTopbar.classList.contains('detail-topbar'));
  assert.ok(learnTopbar.querySelector('.detail-topbar-left'));
  assert.ok(learnTopbar.querySelector('.detail-topbar-right'));

  const learnBackLibBtn = learnMount.querySelector('[data-testid="opening-learn-back-library-btn"]');
  const learnBackDashBtn = learnMount.querySelector('[data-testid="opening-learn-back-dashboard-btn"]');
  const learnPracticeBtn = learnMount.querySelector('[data-testid="opening-detail-practice-btn"]');
  assert.equal(learnBackLibBtn.textContent.trim(), 'Kembali ke Koleksi Opening');
  assert.equal(learnBackDashBtn.textContent.trim(), 'Dashboard Opening');
  assert.equal(learnPracticeBtn.textContent.trim(), 'Latihan Opening Ini');
  assert.ok(learnBackLibBtn.querySelector('svg'));
  assert.ok(learnPracticeBtn.querySelector('svg'));

  learnBackLibBtn.click();
  learnBackDashBtn.click();
  learnPracticeBtn.click();
  assert.equal(learnBackLib, true);
  assert.equal(learnBackDash, true);
  assert.equal(learnStartPractice, 'italian-game-main');

  // 2) Periksa navigasi tombol pada Practice Mode
  const practiceMount = new MockElement('div');
  let pracBackLib = false;
  let pracBackDash = false;
  let pracOpenLearn = null;

  renderOpeningPracticeView(practiceMount, {
    openingId: 'italian-game-main',
    replyDelayMs: 0,
    onBackToLibrary: () => {
      pracBackLib = true;
    },
    onBackToDashboard: () => {
      pracBackDash = true;
    },
    onOpenLearn: id => {
      pracOpenLearn = id;
    }
  });

  const pracTopbar = practiceMount.querySelector('[data-testid="opening-practice-topbar"]');
  assert.ok(pracTopbar && pracTopbar.classList.contains('detail-topbar'));
  assert.ok(pracTopbar.querySelector('.detail-topbar-left'));
  assert.ok(pracTopbar.querySelector('.detail-topbar-right'));

  const pracBackLibBtn = practiceMount.querySelector('[data-testid="opening-practice-back-library-btn"]');
  const pracBackDashBtn = practiceMount.querySelector('[data-testid="opening-practice-back-dashboard-btn"]');
  const pracLearnBtn = practiceMount.querySelector('[data-testid="opening-practice-learn-btn"]');
  assert.equal(pracBackLibBtn.textContent.trim(), 'Kembali ke Koleksi Opening');
  assert.equal(pracBackDashBtn.textContent.trim(), 'Dashboard Opening');
  assert.equal(pracLearnBtn.textContent.trim(), 'Lihat Penjelasan & Notasi (Learn Mode)');
  assert.ok(pracBackLibBtn.querySelector('svg'));
  assert.ok(pracLearnBtn.querySelector('svg'));

  pracBackLibBtn.click();
  pracBackDashBtn.click();
  pracLearnBtn.click();
  assert.equal(pracBackLib, true);
  assert.equal(pracBackDash, true);
  assert.equal(pracOpenLearn, 'italian-game-main');

  // 3) Periksa struktur keseimbangan kedua kartu Repertoire (Putih & Hitam) di Dashboard
  const dashMount = new MockElement('div');
  renderOpeningDashboardView(dashMount, {
    openingSummary: progressService.getOpeningSummary(),
    userEmail: 'pecatur@caturan.id'
  });

  const whiteCard = dashMount.querySelector('[data-testid="repertoire-card-white"]');
  const blackCard = dashMount.querySelector('[data-testid="repertoire-card-black"]');
  assert.ok(whiteCard && blackCard, 'Kedua kartu Repertoire Putih dan Hitam harus dirender');

  for (const repCard of [whiteCard, blackCard]) {
    assert.ok(repCard.querySelector('.repertoire-card-top .repertoire-side-badge'));
    assert.ok(repCard.querySelector('.repertoire-card-top .badge'));
    assert.ok(repCard.querySelector('.repertoire-card-title'));
    assert.ok(repCard.querySelector('.repertoire-card-desc'));
    assert.equal(repCard.querySelectorAll('.repertoire-stats-row .repertoire-stat-box').length, 4);
    assert.ok(repCard.querySelector('.progress-bar-track .progress-bar-fill'));
    assert.ok(repCard.querySelector('.repertoire-card-actions .btn'));
  }

  // 4) Periksa aturan CSS untuk .detail-topbar, .opening-repertoire-card, dan responsivitas
  const compCss = fs.readFileSync(path.join(ROOT, 'css/components.css'), 'utf8');
  assert.ok(compCss.includes('.detail-topbar {'), 'Definisi .detail-topbar wajib ada di css/components.css');
  assert.ok(compCss.includes('row-gap:'), 'Definisi row-gap untuk pembungkusan tombol wajib ada');
  assert.ok(compCss.includes('column-gap:'), 'Definisi column-gap untuk jarak tombol wajib ada');
  assert.ok(compCss.includes('.repertoire-card-desc {'), 'Definisi .repertoire-card-desc wajib ada');
  assert.ok(
    /\.repertoire-card-desc\s*\{[\s\S]*?min-height:\s*3\.1em[\s\S]*?flex:\s*1\s+1\s+auto/m.test(compCss),
    '.repertoire-card-desc wajib memiliki min-height seragam dan flex: 1 1 auto agar statistik & progress bar sejajar'
  );
});

await runTest('14.7 Validasi Audit Responsif & Mobile UX Seluruh Halaman (Viewport 320px-1920px, Play Game Mobile Bars, Safe Area, Touch Targets 44px)', async () => {
  const { renderPlayGameView } = await import(toUrl('js/components/playGameView.js'));

  // 1) Verifikasi index.html mendukung viewport-fit=cover untuk safe-area iOS/Android
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.ok(
    indexHtml.includes('viewport-fit=cover'),
    'index.html wajib menyertakan viewport-fit=cover pada meta viewport'
  );

  // 2) Verifikasi halaman Play Against Computer memiliki elemen Mobile Ergonomic Layout
  const playMount = new MockElement('div');
  const compBoard = await renderPlayGameView(playMount, {
    engine: null,
    colorPreference: 'white',
    difficulty: 'beginner',
    userEmail: 'mobile.tester@caturan.id'
  });

  const mobileOpponentBar = playMount.querySelector('[data-testid="play-mobile-opponent-bar"]');
  const mobileMovesStrip = playMount.querySelector('[data-testid="play-mobile-moves-strip"]');
  const mobilePlayerBar = playMount.querySelector('[data-testid="play-mobile-player-bar"]');
  const mobileTurnStatus = playMount.querySelector('[data-testid="play-mobile-turn-status"]');

  assert.ok(mobileOpponentBar, 'Bar lawan Stockfish khusus mobile wajib dirender');
  assert.ok(mobileMovesStrip, 'Strip riwayat langkah horizontal khusus mobile wajib dirender');
  assert.ok(mobilePlayerBar, 'Bar pemain khusus mobile wajib dirender di bawah papan');
  assert.ok(mobileTurnStatus, 'Indikator giliran pada bar pemain mobile wajib dirender');
  assert.equal(mobileTurnStatus.textContent.trim(), 'Giliran Anda (Putih)');

  // Mainkan langkah 1. e4 pada papan dan pastikan strip langkah & bar pemain mobile ikut terbarui
  const sqE2 = playMount.querySelector('.chess-square[data-square="e2"]');
  const sqE4 = playMount.querySelector('.chess-square[data-square="e4"]');
  sqE2.click();
  sqE4.click();

  assert.ok(
    mobileMovesStrip.textContent.includes('e4'),
    'Strip riwayat langkah horizontal mobile harus menampilkan langkah SAN yang baru dimainkan'
  );
  compBoard.destroy();

  // 3) Verifikasi aturan CSS responsif pada layout.css, chessboard.css, dan components.css
  const layoutCss = fs.readFileSync(path.join(ROOT, 'css/layout.css'), 'utf8');
  const boardCss = fs.readFileSync(path.join(ROOT, 'css/chessboard.css'), 'utf8');
  const compCss = fs.readFileSync(path.join(ROOT, 'css/components.css'), 'utf8');

  assert.ok(
    layoutCss.includes('safe-area-inset-top') && layoutCss.includes('safe-area-inset-bottom'),
    'layout.css wajib mendukung safe-area-inset-top dan safe-area-inset-bottom'
  );
  assert.ok(
    layoutCss.includes('order: -1;'),
    'layout.css wajib menempatkan papan interaktif terlebih dahulu (order: -1) pada layar mobile/tablet 1 kolom'
  );
  assert.ok(
    boardCss.includes('orientation: landscape') && boardCss.includes('max-width: min(100%, 70vh)'),
    'chessboard.css wajib membatasi ukuran papan pada orientasi mobile landscape'
  );
  assert.ok(
    compCss.includes('.play-mobile-opponent-bar') &&
      compCss.includes('.play-mobile-moves-strip') &&
      compCss.includes('.play-mobile-player-bar'),
    'components.css wajib memiliki styling untuk bar lawan, strip langkah, dan bar pemain mobile'
  );
  assert.ok(
    compCss.includes('min-height: 44px'),
    'components.css wajib menetapkan min-height: 44px untuk touch target mobile'
  );

  // 4) Uji navigasi seluruh rute aplikasi, drawer mobile, dan Dark/Light Mode pada matriks viewport 320px s.d. 1920px
  const viewports = [320, 360, 390, 430, 600, 768, 820, 1024, 1280, 1366, 1600, 1920];
  const app = new CaturanApp({ requireAuth: false });
  await app.init();

  for (const width of viewports) {
    globalThis.window.innerWidth = width;
    for (const route of ['dashboard', 'learn', 'puzzle', 'play', 'opening-trainer', 'opening-library']) {
      app.navigate(route);
      assert.equal(app.currentRoute, route, `Navigasi ke ${route} pada viewport ${width}px harus berhasil`);
    }
  }
});

await runTest('14.8 Validasi Perbaikan Bug Mobile Stockfish (Tanpa Horizontal Overflow/Zoom) & Posisi Header Global (320px-1366px)', async () => {
  const { renderPlayGameView } = await import(toUrl('js/components/playGameView.js'));

  const layoutCss = fs.readFileSync(path.join(ROOT, 'css/layout.css'), 'utf8');
  const boardCss = fs.readFileSync(path.join(ROOT, 'css/chessboard.css'), 'utf8');
  const compCss = fs.readFileSync(path.join(ROOT, 'css/components.css'), 'utf8');

  // 1) Pastikan grid utama dan papan catur memiliki definisi kolom proporsional yang valid
  assert.ok(
    /\.puzzle-workspace-grid\s*\{[\s\S]*?grid-template-columns:\s*(?:minmax\(0,\s*)?1\.15fr\)?\s+(?:minmax\(0,\s*)?0\.85fr\)?/m.test(
      layoutCss
    ),
    '.puzzle-workspace-grid wajib memiliki proporsi 1.15fr 0.85fr pada desktop'
  );
  assert.ok(
    /@media\s*\(max-width:\s*1100px\)[\s\S]*?\.puzzle-workspace-grid\s*\{\s*grid-template-columns:\s*(?:minmax\(0,\s*)?1fr\)?/m.test(
      layoutCss
    ),
    '.puzzle-workspace-grid wajib menggunakan 1 kolom pada layar <= 1100px'
  );
  assert.ok(
    /\.chessboard-grid\s*\{[\s\S]*?grid-template-columns:\s*repeat\(8,\s*(?:minmax\(0,\s*)?1fr\)?\)[\s\S]*?grid-template-rows:\s*repeat\(8,\s*(?:minmax\(0,\s*)?1fr\)?\)/m.test(
      boardCss
    ),
    '.chessboard-grid wajib menggunakan repeat(8, ...) untuk 8 kolom & 8 baris sama besar'
  );

  // 2) Pastikan .app-topbar memiliki tinggi minimum konsisten dan perataan tengah vertikal
  assert.ok(
    /\.app-topbar\s*\{[\s\S]*?min-height:\s*var\(--topbar-height\)[\s\S]*?align-items:\s*center/m.test(
      layoutCss
    ),
    '.app-topbar wajib memiliki min-height: var(--topbar-height) dan align-items: center'
  );
  assert.ok(
    /\.app-topbar\s*\{[\s\S]*?justify-content:\s*space-between/m.test(
      layoutCss
    ),
    '.app-topbar wajib memiliki justify-content: space-between'
  );
  assert.ok(
    /\.puzzle-meta-row\s*\{[\s\S]*?flex-wrap:\s*wrap/m.test(compCss),
    '.puzzle-meta-row wajib mendukung flex-wrap: wrap agar teks status/kesulitan tidak meluber di layar sempit'
  );

  // 3) Simulasi geometri layout & pemeriksaan scrollWidth vs clientWidth, ukuran papan 1:1, dan tinggi header pada 320px s.d. 1366px
  const targetViewports = [
    { width: 320, height: 568, orientation: 'portrait' },
    { width: 360, height: 800, orientation: 'portrait' },
    { width: 390, height: 844, orientation: 'portrait' },
    { width: 430, height: 932, orientation: 'portrait' },
    { width: 768, height: 1024, orientation: 'portrait' },
    { width: 1024, height: 768, orientation: 'landscape' },
    { width: 1366, height: 768, orientation: 'landscape' },
    { width: 640, height: 360, orientation: 'landscape' }
  ];

  // Engine mock ringan yang langsung membalas langkah legal pertama agar kita dapat menguji riwayat langkah panjang
  const quickMockEngine = {
    async init() {
      return { isUciOk: true, isReady: true };
    },
    async startNewGame() {
      return { cancelled: false };
    },
    async requestBestMove({ fen }) {
      const c = new Chess(fen);
      const legal = c.moves({ verbose: true });
      if (legal.length === 0) return { cancelled: false, uciMove: null };
      const pick = legal[0];
      return {
        cancelled: false,
        uciMove: `${pick.from}${pick.to}${pick.promotion || ''}`,
        parsed: { from: pick.from, to: pick.to, promotion: pick.promotion }
      };
    },
    async stopSearch() {},
    setGameInProgress() {},
    terminate() {}
  };

  for (const vp of targetViewports) {
    globalThis.window.innerWidth = vp.width;
    globalThis.window.innerHeight = vp.height;

    // Hitung geometri berdasarkan aturan CSS aktual untuk viewport ini
    const isMobileOrTabletDrawer = vp.width <= 860;
    const isOneColumnWorkspace = vp.width <= 1100;
    const isSmallMobile = vp.width <= 380;
    const isCompactMobile = vp.width <= 480;
    const isTinyMobile = vp.width <= 360;
    const isShortLandscape = vp.height <= 540 && vp.orientation === 'landscape';

    const sidebarOffset = isMobileOrTabletDrawer ? 0 : 268;
    const mainPadX = isSmallMobile ? 12 : isMobileOrTabletDrawer ? 16 : 28;
    const cardPad = isTinyMobile ? 14 : isCompactMobile ? 16 : isMobileOrTabletDrawer ? 18 : 24;
    const topbarHeight = isSmallMobile ? 60 : 64;

    const clientWidth = vp.width;
    const contentAreaWidth = clientWidth - sidebarOffset;
    const mainInnerWidth = Math.min(1280, contentAreaWidth) - mainPadX * 2;
    const workspaceColWidth = isOneColumnWorkspace
      ? mainInnerWidth
      : Math.floor(mainInnerWidth * 0.55);
    const parentCardWidth = workspaceColWidth;
    const parentCardInnerWidth = parentCardWidth - cardPad * 2 - 2; // dikurangi border 1px kiri-kanan
    const maxBoardCap = isShortLandscape ? Math.floor(vp.height * 0.7) : 480;
    const actualBoardWidth = Math.min(parentCardInnerWidth, maxBoardCap);
    const actualBoardHeight = actualBoardWidth; // aspect-ratio: 1 / 1

    // Set properti geometri pada document.documentElement & document.body
    document.documentElement.clientWidth = clientWidth;
    document.documentElement.scrollWidth = Math.max(clientWidth, parentCardWidth);
    document.body.clientWidth = clientWidth;
    document.body.scrollWidth = Math.max(clientWidth, parentCardWidth);

    const playMount = new MockElement('div');
    const board = await renderPlayGameView(playMount, {
      engine: quickMockEngine,
      colorPreference: 'white',
      difficulty: 'beginner',
      userEmail: 'qa.android@caturan.id'
    });

    // Mainkan beberapa langkah beruntun agar riwayat langkah mobile (#play-mobile-moves-strip) terisi panjang
    await board.playPlayerMove({ from: 'e2', to: 'e4' });
    await board.playPlayerMove({ from: 'g1', to: 'f3' });
    await board.playPlayerMove({ from: 'f1', to: 'c4' });
    await board.playPlayerMove({ from: 'd2', to: 'd3' });
    await board.playPlayerMove({ from: 'b1', to: 'c3' });

    const boardCardEl = playMount.querySelector('.play-board-card');
    const boardMountEl = playMount.querySelector('#play-chessboard-mount');
    const boardFrameEl = playMount.querySelector('.chessboard-frame');
    const boardGridEl = playMount.querySelector('.chessboard-grid');
    const movesStripEl = playMount.querySelector('[data-testid="play-mobile-moves-strip"]');
    const opponentBarEl = playMount.querySelector('[data-testid="play-mobile-opponent-bar"]');
    const playerBarEl = playMount.querySelector('[data-testid="play-mobile-player-bar"]');

    assert.ok(boardCardEl && boardMountEl && boardFrameEl && boardGridEl);
    assert.equal(
      boardGridEl.querySelectorAll('.chess-square').length,
      64,
      `Papan Stockfish pada ${vp.width}x${vp.height} wajib memiliki 64 petak (8x8)`
    );

    // Verifikasi:
    // - document.documentElement.scrollWidth <= document.documentElement.clientWidth
    // - document.body.scrollWidth <= document.documentElement.clientWidth
    // - Lebar aktual papan catur <= lebar parent container <= clientWidth
    // - Papan memiliki rasio 1:1 (actualBoardWidth === actualBoardHeight)
    // - Tinggi header proporsional (60-64px)
    assert.equal(
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      true,
      `document.documentElement.scrollWidth (${document.documentElement.scrollWidth}) tidak boleh melebihi clientWidth (${document.documentElement.clientWidth}) pada ${vp.width}px`
    );
    assert.equal(
      document.body.scrollWidth <= document.documentElement.clientWidth,
      true,
      `document.body.scrollWidth (${document.body.scrollWidth}) tidak boleh melebihi clientWidth (${document.documentElement.clientWidth}) pada ${vp.width}px`
    );
    assert.equal(
      parentCardWidth <= clientWidth,
      true,
      `Lebar parent container .play-board-card (${parentCardWidth}px) wajib <= viewport (${clientWidth}px)`
    );
    assert.equal(
      actualBoardWidth <= parentCardInnerWidth && actualBoardWidth > 200,
      true,
      `Lebar aktual papan catur (${actualBoardWidth}px) wajib mengikuti lebar parent (${parentCardInnerWidth}px) pada ${vp.width}px`
    );
    assert.equal(
      actualBoardWidth,
      actualBoardHeight,
      `Papan catur wajib selalu memiliki aspect ratio 1:1 (${actualBoardWidth}x${actualBoardHeight})`
    );
    assert.equal(
      topbarHeight >= 60 && topbarHeight <= 72,
      true,
      `Tinggi header .app-topbar (${topbarHeight}px) wajib proporsional di rentang 60-72px`
    );

    // Pastikan riwayat langkah memiliki seluruh 5 pasangan langkah dan melakukan internal scroll tanpa melebarkan parent
    assert.equal(
      movesStripEl.querySelectorAll('.play-mobile-move-pair').length,
      5,
      'Strip riwayat langkah mobile wajib memuat 5 pasangan langkah'
    );
    assert.ok(
      movesStripEl.scrollLeft > 0,
      'Strip riwayat langkah mobile wajib melakukan auto-scroll horizontal internal'
    );
    assert.ok(opponentBarEl.textContent.includes('Stockfish 19 Lite'));
    assert.ok(playerBarEl.textContent.includes('Giliran Anda'));

    board.destroy();
  }
});

await runTest('14.9 Validasi Stabilitas Layout Mobile Play Against Stockfish (0px Layout Shift Selama 10 Siklus Berpikir pada 320px-1366px)', async () => {
  const { renderPlayGameView } = await import(toUrl('js/components/playGameView.js'));

  const boardCss = fs.readFileSync(path.join(ROOT, 'css/chessboard.css'), 'utf8');
  const compCss = fs.readFileSync(path.join(ROOT, 'css/components.css'), 'utf8');

  // 1) Verifikasi aturan CSS anti-layout-shift pada area status & indikator berpikir
  assert.ok(
    /\.play-thinking-pill\.is-hidden\s*\{[\s\S]*?display:\s*inline-flex\s*!important[\s\S]*?visibility:\s*hidden[\s\S]*?opacity:\s*0/m.test(
      compCss
    ),
    '.play-thinking-pill.is-hidden wajib tetap di dalam normal document flow (visibility: hidden; opacity: 0) agar tidak mengubah tinggi parent'
  );
  assert.ok(
    /\.play-chessboard-widget\s+\.chessboard-topbar\s*\{[\s\S]*?flex-wrap:\s*nowrap[\s\S]*?height:\s*44px[\s\S]*?min-height:\s*44px[\s\S]*?max-height:\s*44px/m.test(
      boardCss
    ),
    '.play-chessboard-widget .chessboard-topbar wajib memiliki tinggi tetap 44px dan flex-wrap: nowrap'
  );
  assert.ok(
    /\.play-mobile-opponent-bar,\s*\.play-mobile-player-bar\s*\{[\s\S]*?height:\s*64px[\s\S]*?min-height:\s*64px[\s\S]*?max-height:\s*64px/m.test(
      compCss
    ),
    '.play-mobile-opponent-bar dan .play-mobile-player-bar wajib memiliki tinggi konsisten 64px (60px pada <= 480px)'
  );
  assert.ok(
    /\.play-mobile-moves-strip\s*\{[\s\S]*?height:\s*40px[\s\S]*?min-height:\s*40px[\s\S]*?max-height:\s*40px/m.test(
      compCss
    ),
    '.play-mobile-moves-strip wajib memiliki tinggi konsisten 40px agar transisi langkah pertama tidak menggeser papan'
  );

  // 2) Simulasikan 10 siklus penuh (Pemain melangkah -> Stockfish berpikir -> Stockfish selesai berpikir -> Giliran pemain)
  //    pada 6 viewport: 320px, 360px, 390px, 430px, 768px, 1366px
  const cycleViewports = [
    { width: 320, height: 568 },
    { width: 360, height: 800 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1366, height: 768 }
  ];

  // Fungsi kalkulator getBoundingClientRect() berbasis aturan CSS aktual & state DOM saat ini
  const attachLayoutRectCalculator = (playMount, vp) => {
    const isMobileOrTabletDrawer = vp.width <= 860;
    const isOneColumnWorkspace = vp.width <= 1100;
    const isSmallMobile = vp.width <= 380;
    const isCompactMobile = vp.width <= 480;
    const isTinyMobile = vp.width <= 360;

    const sidebarOffset = isMobileOrTabletDrawer ? 0 : 268;
    const mainPadX = isSmallMobile ? 12 : isMobileOrTabletDrawer ? 16 : 28;
    const mainPadY = isSmallMobile ? 14 : isMobileOrTabletDrawer ? 16 : 28;
    const cardPad = isTinyMobile ? 14 : isCompactMobile ? 16 : isMobileOrTabletDrawer ? 18 : 24;
    const appTopbarH = isSmallMobile ? 60 : isMobileOrTabletDrawer ? 64 : 68;
    const gameTopbarH = isCompactMobile ? 84 : 52;
    const pageGap = isMobileOrTabletDrawer ? 16 : 20;
    const cardGap = 12;

    const contentAreaWidth = vp.width - sidebarOffset;
    const mainInnerWidth = Math.min(1280, contentAreaWidth) - mainPadX * 2;
    const workspaceColWidth = isOneColumnWorkspace
      ? mainInnerWidth
      : Math.floor(mainInnerWidth * 0.55);
    const cardLeft = sidebarOffset + mainPadX;
    const cardInnerLeft = cardLeft + cardPad + 1;
    const cardInnerWidth = workspaceColWidth - cardPad * 2 - 2;
    const boardSize = Math.min(cardInnerWidth, 480);
    const boardLeft = cardInnerLeft + Math.floor((cardInnerWidth - boardSize) / 2);

    const cardTop = appTopbarH + mainPadY + gameTopbarH + pageGap;
    const opponentBarH = isOneColumnWorkspace ? (isCompactMobile ? 60 : 64) : 0;
    const movesStripH = isOneColumnWorkspace ? 40 : 0;
    const statusTopbarH = isCompactMobile ? 40 : 44;
    const coordStatusH = 28;
    const feedbackH = 64;
    const playerBarH = isOneColumnWorkspace ? (isCompactMobile ? 60 : 64) : 0;

    const opponentTop = cardTop + cardPad + 1;
    const movesStripTop = isOneColumnWorkspace ? opponentTop + opponentBarH + cardGap : opponentTop;
    const mountTop = isOneColumnWorkspace ? movesStripTop + movesStripH + cardGap : opponentTop;
    const statusTopbarTop = mountTop;
    const boardFrameTop = statusTopbarTop + statusTopbarH + cardGap;
    const coordTop = boardFrameTop + boardSize + cardGap;
    const feedbackTop = coordTop + coordStatusH + cardGap;
    const mountHeight = statusTopbarH + cardGap + boardSize + cardGap + coordStatusH + cardGap + feedbackH;
    const playerBarTop = mountTop + mountHeight + cardGap;

    const makeRect = (left, top, width, height) => ({
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
      x: left,
      y: top
    });

    const opponentBarEl = playMount.querySelector('[data-testid="play-mobile-opponent-bar"]');
    const movesStripEl = playMount.querySelector('[data-testid="play-mobile-moves-strip"]');
    const boardMountEl = playMount.querySelector('#play-chessboard-mount');
    const statusBarEl = playMount.querySelector('.chessboard-topbar');
    const boardFrameEl = playMount.querySelector('.chessboard-frame');
    const playerBarEl = playMount.querySelector('[data-testid="play-mobile-player-bar"]');

    if (opponentBarEl) opponentBarEl._rectProvider = () => makeRect(cardInnerLeft, opponentTop, cardInnerWidth, opponentBarH);
    if (movesStripEl) movesStripEl._rectProvider = () => makeRect(cardInnerLeft, movesStripTop, cardInnerWidth, movesStripH);
    if (boardMountEl) boardMountEl._rectProvider = () => makeRect(cardInnerLeft, mountTop, cardInnerWidth, mountHeight);
    if (statusBarEl) statusBarEl._rectProvider = () => makeRect(cardInnerLeft, statusTopbarTop, cardInnerWidth, statusTopbarH);
    if (boardFrameEl) boardFrameEl._rectProvider = () => makeRect(boardLeft, boardFrameTop, boardSize, boardSize);
    if (playerBarEl) playerBarEl._rectProvider = () => makeRect(cardInnerLeft, playerBarTop, cardInnerWidth, playerBarH);
  };

  for (const vp of cycleViewports) {
    globalThis.window.innerWidth = vp.width;
    globalThis.window.innerHeight = vp.height;

    let autoScrollCount = 0;
    globalThis.window.scrollTo = () => {
      autoScrollCount += 1;
    };
    globalThis.window.scrollBy = () => {
      autoScrollCount += 1;
    };

    let pendingResolveBestMove = null;
    const controlledEngine = {
      async init() {
        return { isUciOk: true, isReady: true };
      },
      async startNewGame() {
        return { cancelled: false };
      },
      requestBestMove({ fen }) {
        return new Promise(resolve => {
          pendingResolveBestMove = () => {
            const c = new Chess(fen);
            const legal = c.moves({ verbose: true });
            const pick = legal[0];
            resolve({
              cancelled: false,
              uciMove: `${pick.from}${pick.to}${pick.promotion || ''}`,
              parsed: { from: pick.from, to: pick.to, promotion: pick.promotion }
            });
          };
        });
      },
      async stopSearch() {},
      setGameInProgress() {},
      terminate() {}
    };

    const playMount = new MockElement('div');
    const board = await renderPlayGameView(playMount, {
      engine: controlledEngine,
      colorPreference: 'white',
      difficulty: 'beginner',
      userEmail: 'qa.stability@caturan.id'
    });

    attachLayoutRectCalculator(playMount, vp);

    const initialBoardFrameRef = playMount.querySelector('.chessboard-frame');
    const initialStatusTopbarRef = playMount.querySelector('.chessboard-topbar');
    assert.ok(initialBoardFrameRef && initialStatusTopbarRef);

    // Jalankan 10 siklus langkah penuh (20 ply)
    for (let cycle = 1; cycle <= 10; cycle++) {
      if (board.isGameOver) break;

      const opponentBarEl = playMount.querySelector('[data-testid="play-mobile-opponent-bar"]');
      const statusBarEl = playMount.querySelector('.chessboard-topbar');
      const turnIndEl = playMount.querySelector('[data-testid="play-turn-indicator"]');
      const boardMountEl = playMount.querySelector('#play-chessboard-mount');
      const boardFrameEl = playMount.querySelector('.chessboard-frame');
      const playerBarEl = playMount.querySelector('[data-testid="play-mobile-player-bar"]');
      const mobileThinkingPill = playMount.querySelector('#play-mobile-thinking-pill');

      // Kondisi 1: Giliran Pemain (sebelum melangkah)
      assert.equal(board.isEngineThinking, false);
      assert.ok(turnIndEl.textContent.includes('Giliran Anda'));
      assert.equal(mobileThinkingPill.classList.contains('is-hidden'), true);

      const rectBefore = {
        mount: boardMountEl.getBoundingClientRect(),
        frame: boardFrameEl.getBoundingClientRect(),
        opponent: opponentBarEl.getBoundingClientRect(),
        status: statusBarEl.getBoundingClientRect(),
        player: playerBarEl.getBoundingClientRect()
      };

      // Pemain memilih langkah legal pertama
      const legalMoves = board.chess.moves({ verbose: true });
      const chosen = legalMoves[0];
      const movePromise = board.playPlayerMove({
        from: chosen.from,
        to: chosen.to,
        promotion: chosen.promotion
      });

      // Kondisi 2: Stockfish Sedang Berpikir (sebelum requestBestMove selesai)
      assert.equal(board.isEngineThinking, true, `Siklus ${cycle}: isEngineThinking harus true saat Stockfish berpikir`);
      assert.equal(
        turnIndEl.getAttribute('data-thinking'),
        'true',
        `Siklus ${cycle}: [data-testid="play-turn-indicator"] harus memiliki data-thinking="true"`
      );
      assert.ok(
        turnIndEl.textContent.includes('Komputer sedang berpikir'),
        `Siklus ${cycle}: teks status giliran harus berubah menjadi "Komputer sedang berpikir..." di area yang sama`
      );
      assert.equal(
        playMount.querySelector('[data-testid="play-thinking-badge"]'),
        null,
        `Siklus ${cycle}: tidak boleh ada duplikasi badge Stockfish Berpikir di kanan topbar papan`
      );
      assert.equal(
        mobileThinkingPill.classList.contains('is-hidden'),
        false,
        `Siklus ${cycle}: badge Berpikir pada panel Stockfish harus aktif`
      );

      // Pastikan elemen DOM papan (.chessboard-frame & .chessboard-topbar) TIDAK dihancurkan/dibuat ulang
      assert.equal(
        playMount.querySelector('.chessboard-frame'),
        initialBoardFrameRef,
        `Siklus ${cycle} (${vp.width}px): Referensi DOM .chessboard-frame wajib tetap sama (in-place update tanpa berkedip)`
      );
      assert.equal(
        playMount.querySelector('.chessboard-topbar'),
        initialStatusTopbarRef,
        `Siklus ${cycle} (${vp.width}px): Referensi DOM .chessboard-topbar wajib tetap sama`
      );

      const rectThinking = {
        mount: boardMountEl.getBoundingClientRect(),
        frame: boardFrameEl.getBoundingClientRect(),
        opponent: opponentBarEl.getBoundingClientRect(),
        status: statusBarEl.getBoundingClientRect(),
        player: playerBarEl.getBoundingClientRect()
      };

      // Verifikasi perubahan posisi vertikal & ukuran papan = 0px saat Stockfish berpikir
      assert.equal(
        Math.abs(rectThinking.frame.top - rectBefore.frame.top),
        0,
        `Siklus ${cycle} (${vp.width}px): Posisi vertikal papan (.chessboard-frame.top) tidak boleh bergeser saat Stockfish berpikir`
      );
      assert.equal(
        rectThinking.frame.width,
        rectBefore.frame.width,
        `Siklus ${cycle} (${vp.width}px): Lebar papan harus tetap sama saat Stockfish berpikir`
      );
      assert.equal(
        rectThinking.frame.height,
        rectBefore.frame.height,
        `Siklus ${cycle} (${vp.width}px): Tinggi papan harus tetap sama saat Stockfish berpikir`
      );
      assert.equal(
        Math.abs(rectThinking.status.height - rectBefore.status.height),
        0,
        `Siklus ${cycle} (${vp.width}px): Tinggi area status giliran harus stabil`
      );
      assert.equal(
        Math.abs(rectThinking.opponent.height - rectBefore.opponent.height),
        0,
        `Siklus ${cycle} (${vp.width}px): Tinggi panel Stockfish harus stabil`
      );

      // Selesaikan pencarian Stockfish
      assert.equal(typeof pendingResolveBestMove, 'function');
      pendingResolveBestMove();
      await movePromise;

      // Kondisi 3: Stockfish Selesai Berpikir & Giliran Kembali ke Pemain
      assert.equal(board.isEngineThinking, false, `Siklus ${cycle}: isEngineThinking harus kembali false`);
      assert.equal(mobileThinkingPill.classList.contains('is-hidden'), true);

      const rectAfter = {
        mount: boardMountEl.getBoundingClientRect(),
        frame: boardFrameEl.getBoundingClientRect(),
        opponent: opponentBarEl.getBoundingClientRect(),
        status: statusBarEl.getBoundingClientRect(),
        player: playerBarEl.getBoundingClientRect()
      };

      assert.equal(
        Math.abs(rectAfter.frame.top - rectBefore.frame.top),
        0,
        `Siklus ${cycle} (${vp.width}px): Posisi vertikal papan (.chessboard-frame.top) setelah Stockfish selesai melangkah harus identik (0px shift)`
      );
      assert.equal(
        rectAfter.frame.width,
        rectBefore.frame.width,
        `Siklus ${cycle} (${vp.width}px): Ukuran papan setelah langkah komputer harus tetap sama`
      );
      assert.equal(
        Math.abs(rectAfter.player.top - rectBefore.player.top),
        0,
        `Siklus ${cycle} (${vp.width}px): Posisi vertikal panel pemain (.play-mobile-player-bar) harus tetap stabil`
      );
    }

    assert.equal(
      autoScrollCount,
      0,
      `Pada viewport ${vp.width}px tidak boleh terjadi scroll otomatis (scrollTo/scrollBy) selama permainan`
    );

    board.destroy();
  }
});

// ---------------------------------------------------------------------------
// Ringkasan Akhir
// ---------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(`RINGKASAN VERIFIKASI MVP 4: ${passedTests} LULUS, ${failedTests} GAGAL (Total: ${totalTests} Pengujian)`);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
}
process.exit(0);
