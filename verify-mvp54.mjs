/**
 * VERIFICATION SUITE — CATURAN MVP 5.4 (STOCKFISH ANALYSIS ENGINE)
 *
 * Menguji seluruh 17 cakupan pengujian wajib MVP 5.4 + integrasi UI, isolasi engine
 * Play Against Computer, ketiadaan efek suara/gerak bidak otomatis saat menampilkan
 * rekomendasi langkah, serta kepatuhan zero-Supabase & zero-gradient CSS:
 *
 *  1. Engine service dapat diinisialisasi.
 *  2. UCI handshake ditangani (uci -> uciok, isready -> readyok).
 *  3. FEN dikirim dengan benar (position fen <FEN>).
 *  4. Evaluasi centipawn dapat diparse (score cp ...).
 *  5. Evaluasi mate dapat diparse (score mate ...).
 *  6. Perspektif evaluasi Putih dan Hitam benar (selalu dinormalisasi ke perspektif Putih).
 *  7. Best Move UCI dapat dikonversi menjadi SAN (beserta kotak asal/tujuan & penanda visual papan).
 *  8. Principal Variation dapat dikonversi menjadi SAN.
 *  9. Promosi pion ditangani (baik pada Best Move maupun PV).
 * 10. Stop Analysis bekerja dengan aman.
 * 11. Hasil analisis kedaluwarsa diabaikan ketika posisi berubah (stale result rejection).
 * 12. Analisis bekerja pada Review Mode.
 * 13. Analisis bekerja pada Explore Mode (termasuk variasi baru).
 * 14. Analisis tidak mengubah variasi atau mainline PGN, tidak menjalankan langkah otomatis, dan tidak memicu suara.
 * 15. Error Worker atau engine ditangani dengan aman.
 * 16. Tidak ada request Supabase yang dipicu & tidak ada penyimpanan hasil ke localStorage.
 * 17. Worker dan listener dibersihkan saat keluar dari halaman Analysis Studio.
 * 18. Isolasi penuh antara Stockfish Analysis Engine dan Stockfish Play Against Computer (MVP 3) + uji real Stockfish 19 Lite WASM.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'd:/Anti Gravity/project/Caturan';
const toUrl = rel => pathToFileURL(path.join(ROOT, rel)).href;

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
// Minimal DOM & Browser Environment Mock (Zero-Dependency, Node.js Compatible)
// ---------------------------------------------------------------------------
class MockEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.bubbles = Boolean(init.bubbles);
    this.target = null;
    this.currentTarget = null;
    Object.assign(this, init);
  }
  preventDefault() {}
  stopPropagation() {}
}

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
    this.clientHeight = 200;
    this.scrollLeft = 0;
    this.scrollWidth = 400;
    this.clientWidth = 200;
    this.disabled = false;
    this.value = '';
    this.placeholder = '';
    this.files = [];
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

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    if (!child.ownerDocument) child.ownerDocument = this.ownerDocument;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      this.children.splice(idx, 1);
      child.parentNode = null;
    }
    return child;
  }

  remove() {
    if (this.parentNode && typeof this.parentNode.removeChild === 'function') {
      this.parentNode.removeChild(this);
    }
  }

  closest(selector) {
    let curr = this;
    while (curr && curr instanceof MockElement) {
      if (matchesCompoundSelector(curr, selector)) {
        return curr;
      }
      curr = curr.parentNode;
    }
    return null;
  }

  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }

  dispatchEvent(event) {
    const evt = {
      type: event.type,
      target: event.target || this,
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
    let curr = this;
    while (curr && curr instanceof MockElement) {
      const fns = curr.listeners.get('click') || [];
      for (const fn of fns) {
        fn({
          type: 'click',
          target: this,
          currentTarget: curr,
          preventDefault: () => {},
          stopPropagation: () => {}
        });
      }
      curr = curr.parentNode;
    }
  }

  focus() {
    if (this.ownerDocument) {
      this.ownerDocument.activeElement = this;
    }
  }

  blur() {
    if (this.ownerDocument && this.ownerDocument.activeElement === this) {
      this.ownerDocument.activeElement = null;
    }
  }

  getBoundingClientRect() {
    return { top: 0, left: 0, right: 240, bottom: 44, width: 240, height: 44, x: 0, y: 0 };
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this._textContent + this.children.map(c => c.textContent).join('');
  }

  set textContent(val) {
    this.children = [];
    this._textContent = String(val ?? '');
    this._innerHTML = this._textContent
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  get innerHTML() {
    if (this.children.length === 0) return this._innerHTML;
    return this._innerHTML;
  }

  set innerHTML(html) {
    this._innerHTML = String(html ?? '');
    this._textContent = '';
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
  let workingSel = sel;
  const notMatch = workingSel.match(/:not\(\.([A-Za-z0-9_-]+)\)/);
  if (notMatch) {
    if (el.classList.contains(notMatch[1])) return false;
    workingSel = workingSel.replace(notMatch[0], '');
  }

  const attrRegex = /\[([^\]=]+)(?:="([^"]*)")?\]/g;
  let remaining = workingSel;
  let match;
  while ((match = attrRegex.exec(workingSel)) !== null) {
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
      idx -= 1;
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
      for (let i = stack.length - 1; i >= 1; i -= 1) {
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

const capturedNetworkRequests = [];

function setupMockBrowserEnvironment() {
  const storageMap = new Map();
  const sessionMap = new Map();

  const localStorageMock = {
    getItem: k => (storageMap.has(k) ? storageMap.get(k) : null),
    setItem: (k, v) => storageMap.set(k, String(v)),
    removeItem: k => storageMap.delete(k),
    clear: () => storageMap.clear(),
    dump: () => Object.fromEntries(storageMap.entries())
  };

  const sessionStorageMock = {
    getItem: k => (sessionMap.has(k) ? sessionMap.get(k) : null),
    setItem: (k, v) => sessionMap.set(k, String(v)),
    removeItem: k => sessionMap.delete(k),
    clear: () => sessionMap.clear()
  };

  const docListeners = new Map();
  const doc = {
    documentElement: new MockElement('html'),
    body: new MockElement('body'),
    activeElement: null,
    listeners: docListeners,
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (!docListeners.has(type)) return;
      const arr = docListeners.get(type).filter(f => f !== fn);
      docListeners.set(type, arr);
    },
    dispatchEvent(event) {
      const evt = {
        type: event.type,
        target: event.target || this.activeElement || this.body,
        currentTarget: this,
        preventDefault: () => {},
        stopPropagation: () => {},
        ...event
      };
      const fns = docListeners.get(evt.type) || [];
      for (const fn of [...fns]) {
        fn(evt);
      }
    },
    createElement(tag) {
      return new MockElement(tag, this);
    },
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
      <div id="sidebar-overlay" class="sidebar-overlay"></div>
      <div class="app-content-wrapper">
        <header class="app-topbar">
          <button id="mobile-menu-btn" type="button"></button>
          <div id="topbar-quick-stats"></div>
          <button id="board-prefs-toggle-btn" type="button"></button>
          <div id="board-prefs-popover" hidden></div>
          <button id="theme-toggle-btn" type="button"></button>
        </header>
        <main id="app-main-content" class="app-main"></main>
      </div>
    </div>
  `;

  const winListeners = new Map();
  const win = {
    innerWidth: 1366,
    innerHeight: 768,
    location: { hash: '' },
    history: {
      replaceState: (_s, _t, url) => {
        win.location.hash = String(url || '');
      },
      pushState: (_s, _t, url) => {
        win.location.hash = String(url || '');
      }
    },
    localStorage: localStorageMock,
    sessionStorage: sessionStorageMock,
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, []);
      winListeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      if (!winListeners.has(type)) return;
      winListeners.set(
        type,
        winListeners.get(type).filter(f => f !== fn)
      );
    },
    matchMedia: q => {
      const maxMatch = String(q).match(/max-width:\s*(\d+)px/);
      if (maxMatch) {
        const limit = Number(maxMatch[1]);
        return {
          matches: win.innerWidth <= limit,
          addEventListener: () => {},
          removeEventListener: () => {}
        };
      }
      return { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
    },
    scrollTo: () => {},
    scrollBy: () => {},
    requestAnimationFrame: cb => setTimeout(cb, 0),
    cancelAnimationFrame: id => clearTimeout(id)
  };

  globalThis.window = win;
  globalThis.document = doc;
  globalThis.localStorage = localStorageMock;
  globalThis.sessionStorage = sessionStorageMock;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      onLine: true,
      clipboard: {
        writeText: async () => {}
      }
    },
    configurable: true,
    writable: true
  });

  globalThis.fetch = async (url, options) => {
    capturedNetworkRequests.push({ url: String(url), options });
    return {
      ok: true,
      status: 200,
      json: async () => ({})
    };
  };
}

setupMockBrowserEnvironment();

// ---------------------------------------------------------------------------
// Import Modules Under Test
// ---------------------------------------------------------------------------
const {
  ChessAnalysisEngineService,
  chessAnalysisEngine,
  ANALYSIS_ENGINE_STATES,
  ANALYSIS_ENGINE_STATE_LABELS,
  parseUciInfoLine,
  normalizeScoreToWhitePerspective,
  convertUciMoveToSan,
  convertPvUciToSan,
  evaluateTerminalPosition
} = await import(toUrl('js/services/chessAnalysisEngineService.js'));

const {
  renderAnalysisView,
  destroyActiveAnalysisBoard,
  getActiveAnalysisBoard,
  getActiveAnalysisEngine,
  createInitialAnalysisSessionState,
  runAnalysisForActivePosition,
  stopAnalysisForActivePosition,
  SAMPLE_PGN_PLACEHOLDER
} = await import(toUrl('js/components/analysisView.js'));

const { validateAndParsePgn } = await import(toUrl('js/services/pgnService.js'));
const { chessAudioService } = await import(toUrl('js/services/chessAudioService.js'));
const { stockfishEngine } = await import(toUrl('js/services/stockfishEngine.js'));
const { CaturanApp } = await import(toUrl('js/main.js'));

// ---------------------------------------------------------------------------
// Mock UCI Worker Helper for Deterministic Protocol & Edge-Case Testing
// ---------------------------------------------------------------------------
function createMockUciWorker({
  autoHandshake = true,
  infoLines = [
    'info depth 6 seldepth 8 multipv 1 score cp 28 nodes 1200 pv g1f3 d7d5 d2d4 g8f6',
    'info depth 10 seldepth 14 multipv 1 score cp 35 nodes 8400 pv g1f3 d7d5 d2d4 g8f6 c2c4 e7e6'
  ],
  bestMoveLine = 'bestmove g1f3 ponder d7d5',
  searchDelayMs = 15,
  respondToStop = true,
  failOnCreate = false,
  emitWorkerError = false
} = {}) {
  if (failOnCreate) {
    throw new Error('Mock Worker gagal dibuat');
  }

  const sentCommands = [];
  const messageListeners = new Set();
  const errorListeners = new Set();
  let searchTimer = null;
  let terminated = false;

  const emitLine = line => {
    if (terminated) return;
    const evt = { data: line };
    for (const fn of [...messageListeners]) {
      fn(evt);
    }
  };

  const emitError = message => {
    if (terminated) return;
    const evt = { message };
    for (const fn of [...errorListeners]) {
      fn(evt);
    }
  };

  return {
    sentCommands,
    getListenerCounts() {
      return {
        message: messageListeners.size,
        error: errorListeners.size
      };
    },
    isTerminated() {
      return terminated;
    },
    emitLine,
    emitError,
    postMessage(cmd) {
      if (terminated) return;
      const clean = String(cmd).trim();
      sentCommands.push(clean);

      if (emitWorkerError && clean.startsWith('go')) {
        setTimeout(() => emitError('WASM runtime error saat kalkulasi'), 5);
        return;
      }

      if (clean === 'uci' && autoHandshake) {
        setTimeout(() => {
          emitLine('id name Stockfish 19 Lite WASM');
          emitLine('uciok');
        }, 2);
      } else if (clean === 'isready' && autoHandshake) {
        setTimeout(() => {
          emitLine('readyok');
        }, 2);
      } else if (clean.startsWith('go ')) {
        if (searchTimer) clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          searchTimer = null;
          for (const line of infoLines) {
            emitLine(line);
          }
          if (bestMoveLine) {
            emitLine(bestMoveLine);
          }
        }, searchDelayMs);
      } else if (clean === 'stop') {
        if (searchTimer) {
          clearTimeout(searchTimer);
          searchTimer = null;
        }
        if (respondToStop && bestMoveLine) {
          setTimeout(() => emitLine(bestMoveLine), 2);
        }
      }
    },
    addEventListener(type, fn) {
      if (type === 'message') messageListeners.add(fn);
      if (type === 'error') errorListeners.add(fn);
    },
    removeEventListener(type, fn) {
      if (type === 'message') messageListeners.delete(fn);
      if (type === 'error') errorListeners.delete(fn);
    },
    terminate() {
      terminated = true;
      if (searchTimer) {
        clearTimeout(searchTimer);
        searchTimer = null;
      }
      messageListeners.clear();
      errorListeners.clear();
    }
  };
}

function mountStudioWithGame(pgnText = SAMPLE_PGN_PLACEHOLDER, customEngine = null, viewportWidth = 1366) {
  globalThis.window.innerWidth = viewportWidth;
  const mount = document.createElement('div');
  document.body.appendChild(mount);
  const state = createInitialAnalysisSessionState();
  state.parsedGame = validateAndParsePgn(pgnText);
  state.rawPgnText = pgnText;
  state.lastValidatedRawPgn = pgnText;
  state.mobileScreen = 'review';
  if (customEngine) {
    state.analysisEngine = customEngine;
  }
  renderAnalysisView(mount, state, {
    analysisEngine: customEngine || undefined
  });
  return {
    mount,
    state,
    board: getActiveAnalysisBoard(),
    engine: getActiveAnalysisEngine()
  };
}

console.log('====================================================================');
console.log('MEMULAI VERIFIKASI CATURAN MVP 5.4 — STOCKFISH ANALYSIS ENGINE');
console.log('====================================================================\n');

// ---------------------------------------------------------------------------
// 1. Engine service dapat diinisialisasi
// ---------------------------------------------------------------------------
await runTest('1. Engine service (ChessAnalysisEngineService) dapat diinisialisasi dengan benar & status bertransisi ke Ready', async () => {
  let mockWorkerInstance = null;
  const service = new ChessAnalysisEngineService({
    workerFactory: () => {
      mockWorkerInstance = createMockUciWorker();
      return mockWorkerInstance;
    }
  });

  const observedStatuses = [];
  service.onStatusChange(s => observedStatuses.push(s.status));

  assert.equal(service.isReady, false);
  const ready = await service.init();
  assert.equal(ready, true, 'service.init() wajib mengembalikan true saat handshake berhasil');
  assert.equal(service.isReady, true);
  assert.equal(service.getStatus(), ANALYSIS_ENGINE_STATES.READY);
  assert.equal(service.getStatusLabel(), 'Ready');
  assert.ok(observedStatuses.includes(ANALYSIS_ENGINE_STATES.LOADING), 'Status Loading Engine wajib tercatat');
  assert.ok(observedStatuses.includes(ANALYSIS_ENGINE_STATES.READY), 'Status Ready wajib tercatat');

  service.terminate();
});

// ---------------------------------------------------------------------------
// 2. UCI handshake ditangani
// ---------------------------------------------------------------------------
await runTest('2. UCI handshake ditangani secara berurutan (uci -> uciok -> setoption -> isready -> readyok)', async () => {
  let mockWorker = null;
  const service = new ChessAnalysisEngineService({
    workerFactory: () => {
      mockWorker = createMockUciWorker();
      return mockWorker;
    }
  });

  await service.init();
  assert.ok(mockWorker, 'Worker wajib dibuat');
  const cmds = mockWorker.sentCommands;
  const uciIdx = cmds.indexOf('uci');
  const isReadyIdx = cmds.indexOf('isready');
  assert.ok(uciIdx !== -1, 'Perintah "uci" wajib dikirim');
  assert.ok(isReadyIdx > uciIdx, 'Perintah "isready" wajib dikirim setelah "uciok"');
  assert.ok(
    cmds.some(c => c.startsWith('setoption name Threads value 1')),
    'Konfigurasi Threads=1 wajib dikirim'
  );
  assert.ok(
    cmds.some(c => c.startsWith('setoption name MultiPV value 1')),
    'Konfigurasi MultiPV=1 wajib dikirim'
  );

  service.terminate();
});

// ---------------------------------------------------------------------------
// 3. FEN dikirim dengan benar
// ---------------------------------------------------------------------------
await runTest('3. FEN posisi aktif dikirim dengan benar ke Stockfish melalui perintah "position fen <FEN>"', async () => {
  let mockWorker = null;
  const service = new ChessAnalysisEngineService({
    workerFactory: () => {
      mockWorker = createMockUciWorker({
        infoLines: ['info depth 9 score cp 45 pv f1b5 a7a6'],
        bestMoveLine: 'bestmove f1b5'
      });
      return mockWorker;
    }
  });

  const targetFen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  const res = await service.analyzePosition(targetFen, { depth: 9, movetime: 600 });

  assert.equal(res.ok, true);
  assert.equal(res.fen, targetFen);
  assert.ok(
    mockWorker.sentCommands.includes(`position fen ${targetFen}`),
    `Worker wajib menerima "position fen ${targetFen}"`
  );
  assert.ok(
    mockWorker.sentCommands.some(c => c.startsWith('go depth 9 movetime 600')),
    'Worker wajib menerima perintah "go depth ... movetime ..."'
  );

  service.terminate();
});

// ---------------------------------------------------------------------------
// 4. Evaluasi centipawn dapat diparse
// ---------------------------------------------------------------------------
await runTest('4. Evaluasi centipawn (score cp) dapat diparse dengan akurat beserta depth dan PV', () => {
  const parsedPositive = parseUciInfoLine(
    'info depth 12 seldepth 18 multipv 1 score cp 120 nodes 25400 nps 120000 pv e2e4 e7e5 g1f3 b8c6'
  );
  assert.ok(parsedPositive);
  assert.equal(parsedPositive.depth, 12);
  assert.equal(parsedPositive.multipv, 1);
  assert.equal(parsedPositive.scoreType, 'cp');
  assert.equal(parsedPositive.scoreValue, 120);
  assert.deepEqual(parsedPositive.pvUci, ['e2e4', 'e7e5', 'g1f3', 'b8c6']);

  const parsedNegative = parseUciInfoLine(
    'info depth 10 score cp -85 upperbound pv d7d5 d2d4'
  );
  assert.ok(parsedNegative);
  assert.equal(parsedNegative.depth, 10);
  assert.equal(parsedNegative.scoreType, 'cp');
  assert.equal(parsedNegative.scoreValue, -85);
  assert.deepEqual(parsedNegative.pvUci, ['d7d5', 'd2d4']);
});

// ---------------------------------------------------------------------------
// 5. Evaluasi mate dapat diparse
// ---------------------------------------------------------------------------
await runTest('5. Evaluasi forced mate (score mate) dapat diparse dan diformat dengan jelas (mis. Mate in 4)', () => {
  const parsedMatePos = parseUciInfoLine(
    'info depth 15 score mate 4 pv d1h5 g7g6 h5e5'
  );
  assert.ok(parsedMatePos);
  assert.equal(parsedMatePos.depth, 15);
  assert.equal(parsedMatePos.scoreType, 'mate');
  assert.equal(parsedMatePos.scoreValue, 4);

  const normWhiteMate = normalizeScoreToWhitePerspective('mate', 4, 'w');
  assert.equal(normWhiteMate.formatted, 'Mate in 4');
  assert.equal(normWhiteMate.advantage, 'white');
  assert.ok(normWhiteMate.label.includes('Putih menang'));

  const parsedMateNeg = parseUciInfoLine('info depth 14 score mate -3 pv f7f6 d1h5');
  assert.equal(parsedMateNeg.scoreType, 'mate');
  assert.equal(parsedMateNeg.scoreValue, -3);

  const normBlackMate = normalizeScoreToWhitePerspective('mate', -3, 'w');
  assert.equal(normBlackMate.formatted, 'Mate in -3');
  assert.equal(normBlackMate.advantage, 'black');
  assert.ok(normBlackMate.label.includes('Hitam menang'));
});

// ---------------------------------------------------------------------------
// 6. Perspektif evaluasi Putih dan Hitam benar
// ---------------------------------------------------------------------------
await runTest('6. Perspektif evaluasi selalu dikonversi ke perspektif Putih (baik saat giliran Putih maupun giliran Hitam)', () => {
  // A. Giliran Putih ('w'), engine melaporkan +35 cp -> +0.35 (Putih unggul)
  const whiteTurnPlus = normalizeScoreToWhitePerspective('cp', 35, 'w');
  assert.equal(whiteTurnPlus.formatted, '+0.35');
  assert.equal(whiteTurnPlus.whiteCp, 35);
  assert.equal(whiteTurnPlus.advantage, 'white');

  // B. Giliran Hitam ('b'), engine melaporkan +85 cp (artinya Hitam unggul 85 cp dari sisi yang jalan)
  // Dalam perspektif Putih wajib menjadi -0.85 (Hitam unggul)!
  const blackTurnPlus = normalizeScoreToWhitePerspective('cp', 85, 'b');
  assert.equal(blackTurnPlus.formatted, '-0.85');
  assert.equal(blackTurnPlus.whiteCp, -85);
  assert.equal(blackTurnPlus.advantage, 'black');
  assert.ok(blackTurnPlus.label.includes('Hitam'));

  // C. Giliran Hitam ('b'), engine melaporkan -120 cp (artinya Hitam kalah 120 cp -> Putih unggul +1.20)
  const blackTurnMinus = normalizeScoreToWhitePerspective('cp', -120, 'b');
  assert.equal(blackTurnMinus.formatted, '+1.20');
  assert.equal(blackTurnMinus.whiteCp, 120);
  assert.equal(blackTurnMinus.advantage, 'white');
  assert.ok(blackTurnMinus.label.includes('Putih'));

  // D. Giliran Hitam ('b'), engine melaporkan mate 2 (Hitam melakukan skakmat dalam 2 langkah)
  // Dari perspektif Putih: Mate in -2 (Hitam menang)
  const blackTurnMate = normalizeScoreToWhitePerspective('mate', 2, 'b');
  assert.equal(blackTurnMate.whiteMate, -2);
  assert.equal(blackTurnMate.advantage, 'black');
  assert.equal(blackTurnMate.formatted, 'Mate in -2');

  // E. Evaluasi seimbang (0 cp)
  const equalScore = normalizeScoreToWhitePerspective('cp', 0, 'w');
  assert.equal(equalScore.formatted, '0.00');
  assert.equal(equalScore.advantage, 'equal');
  assert.equal(equalScore.label, 'Posisi seimbang');
});

// ---------------------------------------------------------------------------
// 7. Best Move UCI dapat dikonversi menjadi SAN
// ---------------------------------------------------------------------------
await runTest('7. Best Move UCI dikonversi menjadi notasi SAN yang legal beserta kotak asal dan tujuan', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const bestMove = convertUciMoveToSan(startFen, 'g1f3');
  assert.ok(bestMove);
  assert.equal(bestMove.san, 'Nf3');
  assert.equal(bestMove.from, 'g1');
  assert.equal(bestMove.to, 'f3');
  assert.equal(bestMove.uci, 'g1f3');
  assert.equal(bestMove.promotion, null);

  // Uji rokade (castling)
  const castleFen = 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
  const castleMove = convertUciMoveToSan(castleFen, 'e1g1');
  assert.ok(castleMove);
  assert.equal(castleMove.san, 'O-O');
  assert.equal(castleMove.from, 'e1');
  assert.equal(castleMove.to, 'g1');
});

// ---------------------------------------------------------------------------
// 8. Principal Variation dapat dikonversi menjadi SAN
// ---------------------------------------------------------------------------
await runTest('8. Principal Variation (PV) UCI dikonversi menjadi rangkaian langkah SAN secara berurutan', () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const pv = convertPvUciToSan(startFen, ['g1f3', 'd7d5', 'd2d4', 'g8f6', 'c2c4', 'e7e6']);
  assert.deepEqual(pv.sanMoves, ['Nf3', 'd5', 'd4', 'Nf6', 'c4', 'e6']);
  assert.equal(pv.sanLine, 'Nf3 d5 d4 Nf6 c4 e6');
  assert.equal(pv.moves.length, 6);
  assert.equal(pv.moves[0].from, 'g1');
  assert.equal(pv.moves[0].to, 'f3');
});

// ---------------------------------------------------------------------------
// 9. Promosi pion ditangani
// ---------------------------------------------------------------------------
await runTest('9. Promosi pion ditangani dengan benar pada konversi Best Move maupun Principal Variation (Queen, Rook, Bishop, Knight)', () => {
  const promoFen = '7k/P7/8/8/8/8/8/4K3 w - - 0 1';

  const queenPromo = convertUciMoveToSan(promoFen, 'a7a8q');
  assert.ok(queenPromo);
  assert.equal(queenPromo.san, 'a8=Q+');
  assert.equal(queenPromo.from, 'a7');
  assert.equal(queenPromo.to, 'a8');
  assert.equal(queenPromo.promotion, 'q');

  const knightPromo = convertUciMoveToSan(promoFen, 'a7a8n');
  assert.ok(knightPromo);
  assert.equal(knightPromo.san, 'a8=N');
  assert.equal(knightPromo.promotion, 'n');

  const pvPromo = convertPvUciToSan(promoFen, ['a7a8q', 'h8h7', 'a8e8']);
  assert.deepEqual(pvPromo.sanMoves, ['a8=Q+', 'Kh7', 'Qe8']);
  assert.equal(pvPromo.sanLine, 'a8=Q+ Kh7 Qe8');
});

// ---------------------------------------------------------------------------
// 10. Stop Analysis bekerja
// ---------------------------------------------------------------------------
await runTest('10. Stop Analysis menghentikan proses analisis yang sedang berjalan dengan aman & mengubah status ke Stopped', async () => {
  let mockWorker = null;
  const service = new ChessAnalysisEngineService({
    workerFactory: () => {
      mockWorker = createMockUciWorker({
        searchDelayMs: 500,
        respondToStop: false
      });
      return mockWorker;
    }
  });

  const { mount, state } = mountStudioWithGame(SAMPLE_PGN_PLACEHOLDER, service);
  const analyzeBtn = mount.querySelector('[data-testid="analysis-analyze-btn"]');
  const stopBtn = mount.querySelector('[data-testid="analysis-stop-btn"]');
  const statusBadge = mount.querySelector('[data-testid="analysis-engine-status-badge"]');

  // Mulai analisis
  const analysisPromise = runAnalysisForActivePosition(mount, state, { analysisEngine: service });
  await new Promise(r => setTimeout(r, 45));

  assert.equal(service.isAnalyzing(), true, 'Engine harus sedang menganalisis');
  assert.equal(stopBtn.disabled, false, 'Tombol Stop Analysis wajib aktif saat sedang menganalisis');
  assert.equal(analyzeBtn.disabled, true, 'Tombol Analyze Position wajib disabled saat sedang menganalisis');

  // Tekan Stop Analysis
  stopBtn.click();
  const res = await analysisPromise;

  assert.equal(res.stopped, true, 'Hasil analisis harus ditandai stopped: true');
  assert.equal(service.isAnalyzing(), false, 'Engine tidak boleh lagi berstatus analyzing');
  assert.equal(service.getStatus(), ANALYSIS_ENGINE_STATES.STOPPED);
  assert.equal(statusBadge.textContent.trim(), 'Stopped');
  assert.ok(mockWorker.sentCommands.includes('stop'), 'Perintah UCI "stop" wajib dikirim ke Worker');

  destroyActiveAnalysisBoard();
});

// ---------------------------------------------------------------------------
// 11. Hasil analisis kedaluwarsa diabaikan ketika posisi berubah
// ---------------------------------------------------------------------------
await runTest('11. Ketika posisi papan berubah saat analisis berlangsung, analisis lama dibatalkan & hasil kedaluwarsa (stale) diabaikan', async () => {
  let mockWorker = null;
  const service = new ChessAnalysisEngineService({
    workerFactory: () => {
      mockWorker = createMockUciWorker({
        searchDelayMs: 250,
        infoLines: ['info depth 10 score cp 50 pv e2e4 e7e5'],
        bestMoveLine: 'bestmove e2e4',
        respondToStop: false
      });
      return mockWorker;
    }
  });

  const { mount, state, board } = mountStudioWithGame(SAMPLE_PGN_PLACEHOLDER, service);
  assert.equal(board.getCurrentPly(), 0);

  // Mulai analisis pada Ply 0
  const pendingAnalysis = runAnalysisForActivePosition(mount, state, { analysisEngine: service });
  await new Promise(r => setTimeout(r, 45));
  assert.equal(service.isAnalyzing(), true);

  // Pindah ke Ply 1 ketika analisis masih berjalan
  board.nextMove();
  assert.equal(board.getCurrentPly(), 1);

  const staleRes = await pendingAnalysis;
  assert.equal(staleRes.stale, true, 'Request analisis posisi lama wajib ditandai stale');
  assert.equal(state.analysisResult, null, 'Hasil posisi lama tidak boleh disimpan sebagai hasil posisi baru');
  assert.equal(board.getRecommendedMove(), null, 'Penanda langkah rekomendasi lama tidak boleh tampil di posisi baru');

  // Simulasikan pesan terlambat (late message) dari Worker lama setelah dibatalkan
  mockWorker.emitLine('info depth 18 score cp 999 pv e2e4');
  mockWorker.emitLine('bestmove e2e4');
  assert.equal(state.analysisResult, null, 'Pesan Worker dari sesi lama wajib diabaikan sepenuhnya');

  const staleNotice = mount.querySelector('[data-testid="analysis-engine-stale-notice"]');
  assert.equal(staleNotice.classList.contains('hidden'), false, 'Pemberitahuan posisi berubah wajib ditampilkan');

  destroyActiveAnalysisBoard();
});

// ---------------------------------------------------------------------------
// 12. Analisis bekerja pada Review Mode
// ---------------------------------------------------------------------------
await runTest('12. Analisis bekerja pada Review Mode untuk posisi langkah yang sedang dipilih & menampilkan Evaluasi, Best Move, PV, serta Depth', async () => {
  let mockWorker = null;
  const service = new ChessAnalysisEngineService({
    workerFactory: () => {
      mockWorker = createMockUciWorker({
        infoLines: [
          'info depth 8 score cp 40 pv f1b5 a7a6 b5a4 g8f6',
          'info depth 12 score cp 45 pv f1b5 a7a6 b5a4 g8f6 e1g1'
        ],
        bestMoveLine: 'bestmove f1b5 ponder a7a6',
        searchDelayMs: 10
      });
      return mockWorker;
    }
  });

  const { mount, state, board } = mountStudioWithGame(SAMPLE_PGN_PLACEHOLDER, service);
  assert.equal(board.getMode(), 'review');

  // Pilih langkah ke-4 ply (setelah 1. e4 e5 2. Nf3 Nc6)
  board.goToPly(4);
  const expectedFenAtPly4 = board.getCurrentFen();

  // Pastikan sebelum tombol ditekan, analisis TIDAK berjalan otomatis
  assert.equal(mockWorker, null, 'Analisis tidak boleh berjalan otomatis tanpa kontrol pengguna');

  // Tekan tombol Analyze Position
  await runAnalysisForActivePosition(mount, state, { analysisEngine: service });

  assert.ok(mockWorker.sentCommands.includes(`position fen ${expectedFenAtPly4}`));
  assert.equal(
    mount.querySelector('[data-testid="analysis-engine-results"]').classList.contains('hidden'),
    false,
    'Panel hasil analisis wajib tampil setelah bestmove diterima'
  );
  assert.equal(mount.querySelector('[data-testid="analysis-eval-score"]').textContent, '+0.45');
  assert.ok(mount.querySelector('[data-testid="analysis-eval-label"]').textContent.includes('Putih'));
  assert.equal(mount.querySelector('[data-testid="analysis-depth-value"]').textContent, 'Depth 12');
  assert.equal(mount.querySelector('[data-testid="analysis-best-move-san"]').textContent, 'Best Move: Bb5');
  assert.equal(mount.querySelector('[data-testid="analysis-best-move-squares"]').textContent, 'Petak: f1 → b5');
  assert.equal(mount.querySelector('[data-testid="analysis-pv-line"]').textContent, 'Bb5 a6 Ba4 Nf6 O-O');

  // Verifikasi penanda visual pada papan
  const recMove = board.getRecommendedMove();
  assert.ok(recMove, 'Papan harus menyimpan penanda visual langkah rekomendasi');
  assert.equal(recMove.from, 'f1');
  assert.equal(recMove.to, 'b5');
  assert.equal(recMove.san, 'Bb5');
  assert.ok(mount.querySelector('.chess-square.square-best-move-from[data-square="f1"]'));
  assert.ok(mount.querySelector('.chess-square.square-best-move-to[data-square="b5"]'));
  assert.ok(mount.querySelector('[data-testid="analysis-best-move-arrow"]'));

  // Ketika berpindah ke langkah lain (Ply 5), hasil analisis lama wajib langsung dibersihkan
  board.goToPly(5);
  assert.equal(state.analysisResult, null, 'Hasil analisis lama tidak boleh dianggap sebagai hasil untuk posisi baru');
  assert.equal(board.getRecommendedMove(), null, 'Penanda visual Best Move lama wajib dihapus saat pindah posisi');
  assert.equal(
    mount.querySelector('[data-testid="analysis-engine-results"]').classList.contains('hidden'),
    true
  );

  destroyActiveAnalysisBoard();
});

// ---------------------------------------------------------------------------
// 13. Analisis bekerja pada Explore Mode
// ---------------------------------------------------------------------------
await runTest('13. Analisis bekerja pada Explore Mode untuk posisi terakhir setelah langkah eksplorasi pengguna', async () => {
  let mockWorker = null;
  const service = new ChessAnalysisEngineService({
    workerFactory: () => {
      mockWorker = createMockUciWorker({
        infoLines: [
          'info depth 11 score cp 25 pv g8f6 d2d3 f8c5 c2c3'
        ],
        bestMoveLine: 'bestmove g8f6 ponder d2d3',
        searchDelayMs: 10
      });
      return mockWorker;
    }
  });

  const { mount, state, board } = mountStudioWithGame(SAMPLE_PGN_PLACEHOLDER, service);

  // Aktifkan Explore Mode & buat variasi baru: 1. e4 e5 2. Bc4 (Italian Bishop's Opening, giliran Hitam)
  mount.querySelector('[data-testid="analysis-mode-explore-btn"]').click();
  assert.equal(board.getMode(), 'explore');
  board.goToPly(2);
  const moveRes = board.playSanMove('Bc4');
  assert.equal(moveRes.ok, true);
  assert.equal(board.getActiveLineId(), 'var-1');

  const exploreFen = board.getCurrentFen();
  assert.ok(exploreFen.includes(' b '), 'Giliran pada posisi eksplorasi adalah Hitam');

  // Jalankan analisis pada posisi eksplorasi
  await runAnalysisForActivePosition(mount, state, { analysisEngine: service });

  assert.ok(mockWorker.sentCommands.includes(`position fen ${exploreFen}`));

  // Karena giliran Hitam ('b') dan engine memberi score cp +25 (untung bagi Hitam),
  // maka dari perspektif Putih harus dinormalisasi menjadi -0.25!
  assert.equal(mount.querySelector('[data-testid="analysis-eval-score"]').textContent, '-0.25');
  assert.equal(mount.querySelector('[data-testid="analysis-best-move-san"]').textContent, 'Best Move: Nf6');
  assert.equal(mount.querySelector('[data-testid="analysis-best-move-squares"]').textContent, 'Petak: g8 → f6');
  assert.equal(mount.querySelector('[data-testid="analysis-pv-line"]').textContent, 'Nf6 d3 Bc5 c3');
  assert.equal(mount.querySelector('[data-testid="analysis-depth-value"]').textContent, 'Depth 11');

  // Uji tombol Analyze Again (Analisis Ulang) pada posisi aktif
  const commandsBeforeReanalyze = mockWorker.sentCommands.length;
  await runAnalysisForActivePosition(mount, state, { analysisEngine: service });
  assert.ok(
    mockWorker.sentCommands.length > commandsBeforeReanalyze,
    'Analyze Again harus mengirim permintaan analisis baru untuk posisi aktif'
  );

  destroyActiveAnalysisBoard();
});

// ---------------------------------------------------------------------------
// 14. Analisis tidak mengubah variasi atau mainline PGN, tidak menjalankan langkah otomatis, & tidak memicu suara
// ---------------------------------------------------------------------------
await runTest('14. Analisis tidak mengubah variasi atau mainline PGN, tidak menjalankan langkah rekomendasi ke papan, dan tidak memicu efek suara', async () => {
  const service = new ChessAnalysisEngineService({
    workerFactory: () =>
      createMockUciWorker({
        infoLines: ['info depth 10 score cp 35 pv g1f3 b8c6 f1c4'],
        bestMoveLine: 'bestmove g1f3',
        searchDelayMs: 10
      })
  });

  const { mount, state, board } = mountStudioWithGame(SAMPLE_PGN_PLACEHOLDER, service);
  mount.querySelector('[data-testid="analysis-mode-explore-btn"]').click();
  board.goToPly(2); // 1. e4 e5
  board.playSanMove('Bc4'); // Buat Variation 1
  board.switchToMainline(2); // Kembali ke Mainline ply 2

  const mainlineMovesBefore = JSON.stringify(board.getMainlineMoves());
  const variationsBefore = JSON.stringify(board.getVariations());
  const normalizedPgnBefore = state.parsedGame.normalizedPgn;
  const fenBeforeAnalysis = board.getCurrentFen();
  const plyBeforeAnalysis = board.getCurrentPly();

  let soundTriggeredDuringAnalysis = 0;
  const origPlaySoundForMove = chessAudioService.playSoundForMove.bind(chessAudioService);
  chessAudioService.playSoundForMove = (...args) => {
    soundTriggeredDuringAnalysis += 1;
    return origPlaySoundForMove(...args);
  };

  try {
    await runAnalysisForActivePosition(mount, state, { analysisEngine: service });
  } finally {
    chessAudioService.playSoundForMove = origPlaySoundForMove;
  }

  // 1. Posisi papan & ply tidak boleh berubah (langkah rekomendasi tidak dijalankan otomatis)
  assert.equal(board.getCurrentFen(), fenBeforeAnalysis, 'FEN papan tidak boleh berubah oleh rekomendasi engine');
  assert.equal(board.getCurrentPly(), plyBeforeAnalysis, 'Ply aktif tidak boleh berubah oleh rekomendasi engine');

  // 2. Mainline PGN & variasi pengguna tidak boleh berubah atau rusak
  assert.equal(JSON.stringify(board.getMainlineMoves()), mainlineMovesBefore, 'Mainline tidak boleh berubah');
  assert.equal(JSON.stringify(board.getVariations()), variationsBefore, 'Variasi pengguna tidak boleh berubah');
  assert.equal(state.parsedGame.normalizedPgn, normalizedPgnBefore, 'Normalized PGN tidak boleh berubah');

  // 3. Menampilkan rekomendasi engine tidak boleh memicu efek suara langkah
  assert.equal(
    soundTriggeredDuringAnalysis,
    0,
    'Menerima dan menampilkan rekomendasi langkah engine tidak boleh memicu suara langkah catur'
  );

  destroyActiveAnalysisBoard();
});

// ---------------------------------------------------------------------------
// 15. Error Worker atau engine ditangani dengan aman
// ---------------------------------------------------------------------------
await runTest('15. Error Worker, kegagalan inisialisasi, pesan UCI tidak valid, dan PV ilegal ditangani dengan aman tanpa crash', async () => {
  // A. Worker gagal dibuat
  const brokenInitService = new ChessAnalysisEngineService({
    workerFactory: () => createMockUciWorker({ failOnCreate: true })
  });
  const { mount: m1, state: s1 } = mountStudioWithGame(SAMPLE_PGN_PLACEHOLDER, brokenInitService);
  const resBrokenInit = await runAnalysisForActivePosition(m1, s1, { analysisEngine: brokenInitService });
  assert.equal(resBrokenInit.ok, false);
  assert.equal(brokenInitService.getStatus(), ANALYSIS_ENGINE_STATES.ERROR);
  assert.equal(
    m1.querySelector('[data-testid="analysis-engine-status-badge"]').textContent.trim(),
    'Error'
  );
  assert.equal(
    m1.querySelector('[data-testid="analysis-engine-error"]').classList.contains('hidden'),
    false,
    'Pesan error pada panel analisis harus tampil ketika Worker gagal'
  );
  destroyActiveAnalysisBoard();

  // B. Worker memancarkan runtime error saat analisis berlangsung
  const runtimeErrService = new ChessAnalysisEngineService({
    workerFactory: () => createMockUciWorker({ emitWorkerError: true })
  });
  const { mount: m2, state: s2 } = mountStudioWithGame(SAMPLE_PGN_PLACEHOLDER, runtimeErrService);
  const resRuntimeErr = await runAnalysisForActivePosition(m2, s2, { analysisEngine: runtimeErrService });
  assert.equal(resRuntimeErr.ok, false);
  assert.equal(runtimeErrService.getStatus(), ANALYSIS_ENGINE_STATES.ERROR);
  assert.equal(
    m2.querySelector('[data-testid="analysis-engine-error"]').classList.contains('hidden'),
    false
  );
  destroyActiveAnalysisBoard();

  // C. Pesan UCI tidak valid & PV mengandung langkah ilegal di tengah urutan
  const malformedService = new ChessAnalysisEngineService({
    workerFactory: () =>
      createMockUciWorker({
        infoLines: [
          'baris_uci_acak_tidak_valid_sama_sekali',
          'info depth 9 score cp 30 pv e2e4 e7e5 a1a8 g1f3' // a1a8 adalah langkah ilegal setelah 1. e4 e5
        ],
        bestMoveLine: 'bestmove e2e4'
      })
  });
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const resMalformed = await malformedService.analyzePosition(startFen);
  assert.equal(resMalformed.ok, true, 'Baris UCI tidak valid tidak boleh menyebabkan crash');
  assert.equal(resMalformed.bestMove.san, 'e4');
  // PV wajib berhenti secara aman sebelum langkah ilegal a1a8
  assert.deepEqual(resMalformed.pv.sanMoves, ['e4', 'e5']);
  malformedService.terminate();

  // D. Posisi terminal (Checkmate / Fool's Mate) ditangani dengan aman
  const foolsMateFen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
  const terminalEval = evaluateTerminalPosition(foolsMateFen);
  assert.ok(terminalEval, 'Posisi skakmat harus terdeteksi sebagai posisi terminal');
  assert.equal(terminalEval.evaluation.advantage, 'black');
});

// ---------------------------------------------------------------------------
// 16. Tidak ada request Supabase yang dipicu & tidak ada penyimpanan ke localStorage
// ---------------------------------------------------------------------------
await runTest('16. Zero Supabase Request & Zero LocalStorage Persistence selama analisis Stockfish berlangsung', async () => {
  capturedNetworkRequests.length = 0;
  const storageBefore = JSON.stringify(globalThis.localStorage.dump());

  const service = new ChessAnalysisEngineService({
    workerFactory: () =>
      createMockUciWorker({
        infoLines: ['info depth 10 score cp 55 pv e2e4 c7c5 g1f3'],
        bestMoveLine: 'bestmove e2e4',
        searchDelayMs: 5
      })
  });

  const { mount, state, board } = mountStudioWithGame(SAMPLE_PGN_PLACEHOLDER, service);
  await runAnalysisForActivePosition(mount, state, { analysisEngine: service });
  board.nextMove();
  await runAnalysisForActivePosition(mount, state, { analysisEngine: service });

  assert.equal(
    capturedNetworkRequests.length,
    0,
    'Analisis posisi Stockfish tidak boleh memicu request jaringan atau Supabase apa pun'
  );

  const storageAfter = JSON.stringify(globalThis.localStorage.dump());
  assert.equal(
    storageAfter,
    storageBefore,
    'Hasil analisis Stockfish tidak boleh disimpan ke localStorage pada MVP 5.4'
  );

  destroyActiveAnalysisBoard();
});

// ---------------------------------------------------------------------------
// 17. Worker dan listener dibersihkan saat keluar dari halaman
// ---------------------------------------------------------------------------
await runTest('17. Worker dihentikan (terminate) dan seluruh listener dibersihkan ketika pengguna meninggalkan halaman Analysis Studio', async () => {
  let createdWorker = null;
  const customEngine = new ChessAnalysisEngineService({
    workerFactory: () => {
      createdWorker = createMockUciWorker({
        searchDelayMs: 300,
        respondToStop: false
      });
      return createdWorker;
    }
  });

  const app = new CaturanApp({ requireAuth: false });
  await app.init();
  app.navigate('analysis');

  const mainEl = document.getElementById('app-main-content');
  app.analysisSessionState.analysisEngine = customEngine;
  const textarea = mainEl.querySelector('[data-testid="pgn-paste-textarea"]');
  textarea.value = SAMPLE_PGN_PLACEHOLDER;
  textarea.dispatchEvent(new MockEvent('input'));
  mainEl.querySelector('[data-testid="pgn-paste-submit-btn"]').click();

  // Mulai analisis lalu navigasikan keluar ke halaman Dashboard saat analisis masih berjalan
  const pending = runAnalysisForActivePosition(mainEl, app.analysisSessionState, {
    analysisEngine: customEngine
  });
  await new Promise(r => setTimeout(r, 45));

  assert.ok(createdWorker, 'Worker analisis harus telah dibuat');
  assert.equal(createdWorker.isTerminated(), false);
  assert.ok(createdWorker.getListenerCounts().message > 0);

  // Berpindah halaman ke Dashboard
  app.navigate('dashboard');
  await pending;

  assert.equal(
    createdWorker.isTerminated(),
    true,
    'Worker analisis wajib di-terminate saat keluar dari halaman Analysis Studio'
  );
  assert.equal(
    createdWorker.getListenerCounts().message,
    0,
    'Tidak boleh ada message listener Worker yang tertinggal setelah keluar halaman'
  );
  assert.equal(
    createdWorker.getListenerCounts().error,
    0,
    'Tidak boleh ada error listener Worker yang tertinggal setelah keluar halaman'
  );
  assert.equal(getActiveAnalysisBoard(), null);
});

// ---------------------------------------------------------------------------
// 18. Uji Integrasi Real Stockfish 19 Lite WASM & Isolasi dari Play Against Computer (MVP 3)
// ---------------------------------------------------------------------------
await runTest('18. Real Stockfish 19 Lite WASM menganalisis posisi nyata & terisolasi penuh dari Stockfish Play Against Computer (MVP 3)', async () => {
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  // 1) Jalankan analisis nyata dengan singleton chessAnalysisEngine (Stockfish 19 Lite WASM)
  const realAnalysisRes = await chessAnalysisEngine.analyzePosition(startFen, {
    depth: 8,
    movetime: 400
  });

  assert.equal(realAnalysisRes.ok, true, 'Analisis nyata Stockfish 19 Lite WASM harus berhasil');
  assert.equal(realAnalysisRes.completed, true);
  assert.ok(realAnalysisRes.depth >= 1, `Depth analisis harus >= 1 (aktual: ${realAnalysisRes.depth})`);
  assert.ok(realAnalysisRes.bestMove && realAnalysisRes.bestMove.san, 'Best Move SAN harus tersedia');
  assert.ok(
    /^[a-h][1-8]$/.test(realAnalysisRes.bestMove.from) &&
      /^[a-h][1-8]$/.test(realAnalysisRes.bestMove.to),
    'Kotak asal dan tujuan Best Move harus valid'
  );
  assert.ok(realAnalysisRes.pv && realAnalysisRes.pv.sanMoves.length >= 1, 'Principal Variation SAN harus tersedia');

  // 2) Pastikan stockfishEngine (Play Against Computer MVP 3) tetap bekerja independen tanpa konflik
  const playMoveRes = await stockfishEngine.requestBestMove({ fen: startFen, moveTimeMs: 300 });
  assert.ok(playMoveRes && playMoveRes.uciMove, 'Stockfish Play Against Computer harus tetap menghasilkan langkah terbaik');

  // 3) Terminasi chessAnalysisEngine tidak boleh merusak kemampuan inisialisasi ulang
  chessAnalysisEngine.terminate();
  assert.equal(chessAnalysisEngine.isReady, false);
  stockfishEngine.terminate();
});

// ---------------------------------------------------------------------------
// 19. Responsivitas Desktop & Mobile (<= 600px) serta Kepatuhan Palet Warna Solid Tanpa Gradient
// ---------------------------------------------------------------------------
await runTest('19. Panel analisis responsif pada Desktop & Mobile (320px-1920px) serta seluruh CSS bebas dari gradient', () => {
  const cssFiles = ['css/variables.css', 'css/layout.css', 'css/components.css', 'css/chessboard.css'];
  for (const rel of cssFiles) {
    const content = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    const stripped = content.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(
      /(?:linear|radial|conic)-gradient\s*\(/i.test(stripped),
      false,
      `File ${rel} dilarang menggunakan CSS gradient`
    );
  }

  const viewports = [320, 360, 390, 430, 600, 768, 1024, 1366, 1920];
  for (const vp of viewports) {
    const { mount } = mountStudioWithGame(SAMPLE_PGN_PLACEHOLDER, null, vp);
    assert.ok(
      mount.querySelector('[data-testid="analysis-engine-panel"]'),
      `Panel analisis Stockfish wajib tersedia pada viewport ${vp}px`
    );
    assert.ok(
      mount.querySelector('[data-testid="analysis-analyze-btn"]'),
      `Tombol Analyze Position wajib tersedia pada viewport ${vp}px`
    );
    assert.ok(
      mount.querySelector('[data-testid="analysis-stop-btn"]'),
      `Tombol Stop Analysis wajib tersedia pada viewport ${vp}px`
    );
    assert.ok(
      mount.querySelector('[data-testid="analysis-reanalyze-btn"]'),
      `Tombol Analyze Again wajib tersedia pada viewport ${vp}px`
    );
    destroyActiveAnalysisBoard();
  }
  globalThis.window.innerWidth = 1366;
});

// ---------------------------------------------------------------------------
// Ringkasan Akhir
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 20. FIX A — Global Mobile Header (Anti-Overlap, Brand Caturan Utuh, Touch Target >= 44px)
// ---------------------------------------------------------------------------
await runTest('20. [FIX A] Global mobile header menggunakan layout 2 baris rapi tanpa overlap, brand Caturan utuh, & touch target >= 44px', async () => {
  const layoutCss = fs.readFileSync(path.join(ROOT, 'css/layout.css'), 'utf8');
  const chessboardCss = fs.readFileSync(path.join(ROOT, 'css/chessboard.css'), 'utf8');

  // 1) Pastikan .topbar-app-name memiliki flex-shrink: 0 dan white-space: nowrap agar tidak tertimpa badge
  assert.ok(
    /\.topbar-app-name\s*\{[\s\S]*?flex-shrink:\s*0/m.test(layoutCss),
    '.topbar-app-name (Caturan) wajib memiliki flex-shrink: 0 agar tidak tertimpa elemen streak/XP'
  );

  // 2) Pastikan pada @media (max-width: 640px) .app-topbar menggunakan layout 2 baris (grid / flex-wrap) dengan row-gap
  assert.ok(
    /@media\s*\(max-width:\s*640px\)[\s\S]*?\.app-topbar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)[\s\S]*?row-gap:\s*8px/m.test(
      layoutCss
    ),
    '.app-topbar pada mobile (<= 640px) wajib menggunakan layout 2 baris (grid minmax(0, 1fr) dengan row-gap: 8px)'
  );

  // 3) Pastikan tombol Hamburger, Sound Effects, dan Theme Toggle memiliki touch target minimal 44x44px
  assert.ok(
    /\.mobile-menu-trigger,\s*\.theme-toggle-btn,\s*\.board-prefs-trigger-btn\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/m.test(
      layoutCss
    ),
    'Tombol Hamburger, Sound Effects, dan Theme Toggle wajib memenuhi touch target >= 44px'
  );
  assert.ok(
    /@media\s*\(max-width:\s*768px\)[\s\S]*?\.board-prefs-trigger-btn\s+\.theme-label\s*\{\s*display:\s*none/m.test(
      chessboardCss
    ),
    'Label teks tombol Sound Effects wajib disembunyikan pada <= 768px agar tidak bertabrakan dengan badge XP'
  );
});

// ---------------------------------------------------------------------------
// 21. FIX B — Player Information Cards (Multi-Baris Fleksibel, Nama & Giliran Utuh, Ikon Material Terpisah)
// ---------------------------------------------------------------------------
await runTest('21. [FIX B] Player information cards menampilkan Stockfish 19 Lite, warna bidak, giliran, & ikon material secara utuh tanpa terpotong', async () => {
  const { renderPlayGameView } = await import(toUrl('js/components/playGameView.js'));
  const compCss = fs.readFileSync(path.join(ROOT, 'css/components.css'), 'utf8');

  // 1) Verifikasi CSS: multi-baris fleksibel tanpa pemotongan teks pada .combatant-name dan .combatant-sub
  assert.ok(
    /\.play-mobile-combatant-main\s+\.combatant-name\s*\{[\s\S]*?white-space:\s*normal[\s\S]*?overflow:\s*visible/m.test(
      compCss
    ),
    'Nama pemain & Stockfish 19 Lite pada mobile player card wajib white-space: normal dan overflow: visible'
  );
  assert.ok(
    /\.play-mobile-captured-line\s+\.combatant-sub\s*\{[\s\S]*?white-space:\s*normal[\s\S]*?overflow:\s*visible/m.test(
      compCss
    ),
    'Keterangan warna bidak dan teks status giliran wajib white-space: normal dan overflow: visible'
  );
  assert.ok(
    /\.play-mobile-material-row\s*\{[\s\S]*?display:\s*flex[\s\S]*?border-top:\s*1px\s+solid/m.test(
      compCss
    ),
    'Area ikon material bidak (.play-mobile-material-row) wajib dipisahkan pada baris tersendiri'
  );

  // 2) Verifikasi DOM aktual pada mobile viewport (360px)
  globalThis.window.innerWidth = 360;
  const playMount = document.createElement('div');
  const board = await renderPlayGameView(playMount, {
    engine: null,
    colorPreference: 'white',
    difficulty: 'beginner',
    userEmail: 'alexander.maximilian.pratama@caturan.id'
  });

  const opponentBar = playMount.querySelector('[data-testid="play-mobile-opponent-bar"]');
  const playerBar = playMount.querySelector('[data-testid="play-mobile-player-bar"]');
  assert.ok(opponentBar && playerBar, 'Opponent bar dan Player bar mobile wajib dirender');

  // Nama Stockfish 19 Lite dan Bidak Hitam tampil utuh
  assert.ok(
    opponentBar.textContent.includes('Stockfish 19 Lite'),
    'Nama Stockfish 19 Lite wajib tampil utuh'
  );
  assert.equal(
    playMount.querySelector('[data-testid="play-mobile-cpu-color"]').textContent.trim(),
    'Bidak Hitam',
    'Keterangan Bidak Hitam wajib tampil utuh'
  );
  assert.equal(
    playMount.querySelector('[data-testid="play-mobile-turn-status"]').textContent.trim(),
    'Giliran Anda (Putih)',
    'Teks status giliran pengguna wajib tampil utuh'
  );

  // Pastikan baris material (.play-mobile-material-row) terpisah dari baris identitas (.combatant-name-line) dan baris status (.play-mobile-captured-line)
  const oppMaterialRow = playMount.querySelector('[data-testid="play-mobile-opponent-material-row"]');
  const playerMaterialRow = playMount.querySelector('[data-testid="play-mobile-player-material-row"]');
  assert.ok(
    oppMaterialRow && playerMaterialRow,
    'Baris material bidak wajib terpisah pada kartu Putih maupun Hitam'
  );
  assert.ok(oppMaterialRow.querySelector('#play-mobile-cpu-captured'));
  assert.ok(playerMaterialRow.querySelector('#play-mobile-player-captured'));

  board.destroy();
  globalThis.window.innerWidth = 1366;
});

// ---------------------------------------------------------------------------
// 22. FIX C — PGN Clipboard Paste on Mobile (Editable Textarea, Native Paste, Tombol Tempel dari Clipboard, Fallback, Contoh PGN, Clear, & Validasi)
// ---------------------------------------------------------------------------
await runTest('22. [FIX C] PGN Clipboard Paste pada Mobile bekerja penuh (editable textarea, native paste, tombol Tempel dari Clipboard, fallback izin ditolak/kosong, Contoh PGN, Clear, & masuk ke Game Review)', async () => {
  const compCss = fs.readFileSync(path.join(ROOT, 'css/components.css'), 'utf8');

  // 1) Verifikasi CSS interaksi teks mobile pada .analysis-textarea
  assert.ok(
    /\.analysis-textarea\s*\{[\s\S]*?user-select:\s*text[\s\S]*?-webkit-user-select:\s*text[\s\S]*?-webkit-touch-callout:\s*default[\s\S]*?pointer-events:\s*auto/m.test(
      compCss
    ),
    '.analysis-textarea wajib mengizinkan seleksi teks dan menu tempel native di mobile'
  );

  const mobileViewports = [320, 360, 390, 412, 430, 768, 1024, 1366, 1920];
  for (const vp of mobileViewports) {
    globalThis.window.innerWidth = vp;
    const mount = document.createElement('div');
    const state = createInitialAnalysisSessionState();

    let clipboardReadCalledOnLoad = false;
    globalThis.navigator.clipboard = {
      readText: async () => {
        clipboardReadCalledOnLoad = true;
        return SAMPLE_PGN_PLACEHOLDER;
      },
      writeText: async () => {}
    };

    renderAnalysisView(mount, state);

    // Pastikan tidak pernah membaca clipboard otomatis saat halaman dimuat
    assert.equal(
      clipboardReadCalledOnLoad,
      false,
      `Clipboard tidak boleh dibaca otomatis saat halaman dimuat (${vp}px)`
    );

    const textarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
    const pasteClipboardBtn = mount.querySelector('[data-testid="pgn-paste-clipboard-btn"]');
    const clearBtn = mount.querySelector('[data-testid="pgn-paste-clear-btn"]');
    const sampleBtn = mount.querySelector('[data-testid="pgn-load-sample-btn"]');
    const feedbackEl = mount.querySelector('[data-testid="pgn-clipboard-feedback"]');

    assert.ok(textarea, `Textarea PGN wajib ada pada ${vp}px`);
    assert.equal(textarea.hasAttribute('readonly'), false, 'Textarea PGN tidak boleh readonly');
    assert.equal(textarea.hasAttribute('disabled'), false, 'Textarea PGN tidak boleh disabled');
    assert.equal(textarea.disabled, false);
    assert.ok(
      !textarea.placeholder.includes('[Event "Partai Latihan Caturan"]'),
      'Placeholder tidak boleh menampilkan 9 baris PGN penuh yang membingungkan pengguna mobile'
    );
    assert.ok(pasteClipboardBtn, `Tombol Tempel dari Papan Klip wajib tersedia pada ${vp}px`);
    assert.ok(
      pasteClipboardBtn.textContent.includes('Tempel dari Papan Klip') ||
      pasteClipboardBtn.textContent.includes('Tempel dari Clipboard')
    );
    assert.ok(clearBtn && sampleBtn && feedbackEl);
  }

  // 2) Uji pada layar mobile 390px:
  globalThis.window.innerWidth = 390;
  const mount = document.createElement('div');
  const state = createInitialAnalysisSessionState();
  renderAnalysisView(mount, state);

  const textarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
  const pasteBtn = mount.querySelector('[data-testid="pgn-paste-clipboard-btn"]');
  const clearBtn = mount.querySelector('[data-testid="pgn-paste-clear-btn"]');
  const sampleBtn = mount.querySelector('[data-testid="pgn-load-sample-btn"]');
  const feedbackEl = mount.querySelector('[data-testid="pgn-clipboard-feedback"]');
  const validateCta = mount.querySelector('[data-testid="analysis-mobile-validate-cta"]');

  // A. Uji Native Paste event pada textarea (tanpa preventDefault)
  const nativePastedPgn = '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0';
  let pasteDefaultPrevented = false;
  textarea.value = '';
  textarea.dispatchEvent({
    type: 'paste',
    clipboardData: {
      getData: () => nativePastedPgn
    },
    preventDefault: () => {
      pasteDefaultPrevented = true;
    }
  });
  assert.equal(pasteDefaultPrevented, false, 'Event paste tidak boleh memanggil preventDefault()');
  assert.equal(textarea.value, nativePastedPgn, 'Native paste harus mengisi nilai textarea');
  assert.equal(state.rawPgnText, nativePastedPgn, 'Native paste harus memperbarui state.rawPgnText');
  assert.equal(state.parsedGame, null, 'Native paste tidak boleh memvalidasi otomatis sebelum tombol ditekan');

  // B. Uji tombol Clear
  clearBtn.click();
  const textareaAfterClear = mount.querySelector('[data-testid="pgn-paste-textarea"]');
  assert.equal(textareaAfterClear.value, '');
  assert.equal(state.rawPgnText, '');

  // C. Uji tombol "Tempel dari Clipboard" saat izin ditolak (Permission Denied Fallback)
  globalThis.navigator.clipboard = {
    readText: async () => {
      throw new Error('NotAllowedError: Write permission denied');
    }
  };
  mount.querySelector('[data-testid="pgn-paste-clipboard-btn"]').click();
  await new Promise(r => setTimeout(r, 15));

  const fbAfterDenied = mount.querySelector('[data-testid="pgn-clipboard-feedback"]');
  assert.equal(fbAfterDenied.classList.contains('hidden'), false, 'Pesan fallback wajib tampil saat izin clipboard ditolak');
  assert.equal(fbAfterDenied.getAttribute('data-status'), 'fallback');
  assert.ok(
    fbAfterDenied.textContent.toLowerCase().includes('long-press') ||
      fbAfterDenied.textContent.toLowerCase().includes('tahan'),
    'Pesan fallback harus memandu pengguna melakukan long-press -> Tempel pada textarea'
  );

  // D. Uji tombol "Tempel dari Clipboard" saat Clipboard API kosong
  globalThis.navigator.clipboard = {
    readText: async () => '   '
  };
  mount.querySelector('[data-testid="pgn-paste-clipboard-btn"]').click();
  await new Promise(r => setTimeout(r, 15));
  assert.equal(fbAfterDenied.getAttribute('data-status'), 'empty');

  // E. Uji tombol "Tempel dari Clipboard" saat Clipboard API tersedia & berisi PGN valid
  globalThis.navigator.clipboard = {
    readText: async () => SAMPLE_PGN_PLACEHOLDER
  };
  mount.querySelector('[data-testid="pgn-paste-clipboard-btn"]').click();
  await new Promise(r => setTimeout(r, 15));

  const currentTextarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
  assert.equal(
    currentTextarea.value,
    SAMPLE_PGN_PLACEHOLDER,
    'Tombol Tempel dari Clipboard harus mengisi textarea dengan teks PGN dari clipboard'
  );
  assert.equal(state.rawPgnText, SAMPLE_PGN_PLACEHOLDER);
  assert.equal(
    state.parsedGame,
    null,
    'Tombol Tempel dari Clipboard tidak boleh langsung memvalidasi sebelum pengguna menekan Validasi & Mulai Review'
  );
  assert.equal(fbAfterDenied.getAttribute('data-status'), 'success');
  assert.ok(fbAfterDenied.textContent.includes('berhasil ditempel'));

  // F. Uji tombol Contoh PGN setelah dikosongkan
  currentTextarea.value = '';
  state.rawPgnText = '';
  mount.querySelector('[data-testid="pgn-load-sample-btn"]').click();
  assert.equal(currentTextarea.value, SAMPLE_PGN_PLACEHOLDER, 'Tombol Contoh PGN harus mengisi contoh PGN ke textarea');
  assert.equal(state.rawPgnText, SAMPLE_PGN_PLACEHOLDER);

  // G. Tekan "Validasi & Mulai Review" -> PGN hasil paste berhasil divalidasi dan masuk ke Game Review
  mount.querySelector('[data-testid="analysis-mobile-validate-cta"]').click();
  assert.equal(state.parsedGame?.valid, true, 'PGN hasil paste harus berhasil divalidasi');
  assert.equal(state.mobileScreen, 'review', 'Harus berpindah ke layar Game Review setelah menekan Validasi & Mulai Review');
  assert.ok(getActiveAnalysisBoard(), 'Papan analisis interaktif harus aktif di Game Review');

  destroyActiveAnalysisBoard();
  globalThis.window.innerWidth = 1366;
});

console.log('\n====================================================================');
console.log(
  `RINGKASAN VERIFIKASI MVP 5.4: ${passedTests} LULUS, ${failedTests} GAGAL (Total: ${totalTests} Pengujian)`
);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
}
process.exit(0);
