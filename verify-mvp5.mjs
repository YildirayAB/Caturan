/**
 * VERIFICATION SUITE — CATURAN MVP 5.1 (PGN IMPORT & VALIDATION)
 *
 * Menguji seluruh 20 skenario wajib MVP 5.1 secara fungsional, keamanan (XSS),
 * arsitektur zero-Supabase load, serta layout responsif di 8 viewport
 * (320px, 360px, 390px, 430px, 768px, 1024px, 1366px, 1920px).
 */

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
// Minimal DOM & Web APIs Environment (Zero-Dependency, Kompatibel dengan Node.js Murni)
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

  focus() {}

  getBoundingClientRect() {
    if (typeof this._rectProvider === 'function') {
      return this._rectProvider(this);
    }
    if (this._boundingRect) {
      return { ...this._boundingRect };
    }
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
  // Support :not(.class)
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

  const doc = {
    documentElement: new MockElement('html'),
    body: new MockElement('body'),
    addEventListener: () => {},
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

  globalThis.Event = MockEvent;
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
    innerWidth: 1366,
    innerHeight: 768,
    matchMedia: q => ({ matches: q.includes('860') ? globalThis.window.innerWidth <= 860 : false }),
    addEventListener: () => {},
    scrollTo: () => {},
    scrollBy: () => {},
    __CATURAN_ENV__: {}
  };

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

  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || String(input);
    capturedNetworkRequests.push({ url, method: init?.method || 'GET' });
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => ''
    };
  };
}

setupMockBrowserEnvironment();

// ---------------------------------------------------------------------------
// Import Modules Under Test
// ---------------------------------------------------------------------------
const { Chess, DEFAULT_POSITION } = await import(toUrl('js/vendor/chess.js'));
const {
  MAX_PGN_FILE_SIZE_BYTES,
  PGN_ERROR_CODES,
  VALID_PGN_RESULTS,
  NAG_MAP,
  formatFileSize,
  formatPgnResultLabel,
  validatePgnFileMeta,
  validateAndParsePgn
} = await import(toUrl('js/services/pgnService.js'));
const { AnalysisReplayBoard } = await import(toUrl('js/components/chessboardUI.js'));
const {
  MOBILE_ANALYSIS_BREAKPOINT,
  SAMPLE_PGN_PLACEHOLDER,
  isMobileAnalysisViewport,
  createInitialAnalysisSessionState,
  renderAnalysisView,
  getActiveAnalysisBoard,
  destroyActiveAnalysisBoard
} = await import(toUrl('js/components/analysisView.js'));
const { NAV_ITEMS, renderSidebar } = await import(toUrl('js/components/sidebar.js'));
const { storageService } = await import(toUrl('js/services/storage.js'));
const { progressService } = await import(toUrl('js/services/progress.js'));
const { CaturanApp } = await import(toUrl('js/main.js'));

console.log('====================================================================');
console.log('MEMULAI VERIFIKASI CATURAN MVP 5.1 — PGN IMPORT & VALIDATION');
console.log('====================================================================\n');

// ---------------------------------------------------------------------------
// SKENARIO 1: Import PGN Valid
// ---------------------------------------------------------------------------
await runTest('1. Import PGN valid (urutan langkah standar & verifikasi state hasil import)', () => {
  const validPgn = `
[Event "Kejuaraan Nasional Caturan"]
[Site "Bandung"]
[Date "2026.04.15"]
[White "Dewi Citra"]
[Black "Rizky Pratama"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0
  `;

  const res = validateAndParsePgn(validPgn);
  assert.equal(res.valid, true, 'PGN valid harus menghasilkan valid: true');
  assert.equal(res.totalPlies, 10, 'Jumlah ply harus 10');
  assert.equal(res.totalMoves, 5, 'Jumlah langkah penuh harus 5');
  assert.equal(res.movePairs.length, 5, 'Jumlah pasangan langkah (Putih & Hitam) harus 5');
  assert.equal(res.moves[0].san, 'e4');
  assert.equal(res.moves[9].san, 'Be7');
  assert.ok(res.normalizedPgn.includes('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1-0'));
});

// ---------------------------------------------------------------------------
// SKENARIO 2: Import PGN dengan Header Lengkap
// ---------------------------------------------------------------------------
await runTest('2. Import PGN dengan header lengkap (White, Black, Event, Site, Date, Round, Result, ECO, Opening)', () => {
  const fullHeaderPgn = `
[Event "Turnamen Grandmaster Nusantara"]
[Site "Surabaya, INA"]
[Date "2026.08.17"]
[Round "7"]
[White "Utut Adianto"]
[Black "Susanto Megaranto"]
[Result "1/2-1/2"]
[ECO "C65"]
[Opening "Ruy Lopez: Berlin Defense"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 Nf6 4. O-O Nxe4 5. d4 Nd6 6. Bxc6 dxc6 7. dxe5 Nf5 8. Qxd8+ Kxd8 1/2-1/2
  `;

  const res = validateAndParsePgn(fullHeaderPgn);
  assert.equal(res.valid, true);
  assert.equal(res.metadata.white, 'Utut Adianto');
  assert.equal(res.metadata.black, 'Susanto Megaranto');
  assert.equal(res.metadata.event, 'Turnamen Grandmaster Nusantara');
  assert.equal(res.metadata.site, 'Surabaya, INA');
  assert.equal(res.metadata.date, '2026.08.17');
  assert.equal(res.metadata.round, '7');
  assert.equal(res.metadata.result, '1/2-1/2');
  assert.equal(res.metadata.eco, 'C65');
  assert.equal(res.metadata.opening, 'Ruy Lopez: Berlin Defense');
  assert.equal(res.totalMoves, 8);
  assert.equal(res.totalPlies, 16);
});

// ---------------------------------------------------------------------------
// SKENARIO 3: Import PGN Tanpa Metadata Opsional (Fallback "Tidak diketahui")
// ---------------------------------------------------------------------------
await runTest('3. Import PGN tanpa metadata opsional & tag "?" menggunakan fallback "Tidak diketahui" (tanpa undefined/null/[object Object])', () => {
  const movetextOnlyPgn = '1. d4 d5 2. c4 e6 3. Nc3 Nf6';
  const res = validateAndParsePgn(movetextOnlyPgn);
  assert.equal(res.valid, true);
  assert.equal(res.metadata.white, 'Tidak diketahui');
  assert.equal(res.metadata.black, 'Tidak diketahui');
  assert.equal(res.metadata.event, 'Tidak diketahui');
  assert.equal(res.metadata.site, 'Tidak diketahui');
  assert.equal(res.metadata.date, 'Tidak diketahui');
  assert.equal(res.metadata.result, 'Tidak diketahui');
  assert.equal(res.metadata.resultCode, '*');

  const questionHeaderPgn = `
[Event "?"]
[Site "?"]
[Date "????.??.??"]
[White "?"]
[Black ""]
[Result "*"]

1. e4 c5 2. Nf3 d6 *
  `;
  const res2 = validateAndParsePgn(questionHeaderPgn);
  assert.equal(res2.valid, true);
  assert.equal(res2.metadata.white, 'Tidak diketahui');
  assert.equal(res2.metadata.black, 'Tidak diketahui');
  assert.equal(res2.metadata.event, 'Tidak diketahui');
  assert.equal(res2.metadata.site, 'Tidak diketahui');
  assert.equal(res2.metadata.date, 'Tidak diketahui');

  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  sessionState.parsedGame = res2;
  renderAnalysisView(mount, sessionState);

  const html = mount.innerHTML;
  const text = mount.textContent;
  assert.equal(/\bundefined\b/i.test(text), false, 'Tidak boleh ada teks undefined');
  assert.equal(/\bnull\b/i.test(text), false, 'Tidak boleh ada teks null');
  assert.equal(html.includes('[object Object]'), false, 'Tidak boleh ada [object Object]');
  assert.equal(mount.querySelector('[data-testid="pgn-meta-white"]').textContent, 'Tidak diketahui');
  assert.equal(mount.querySelector('[data-testid="pgn-meta-black"]').textContent, 'Tidak diketahui');
  assert.equal(mount.querySelector('[data-testid="pgn-meta-event"]').textContent, 'Tidak diketahui');
  assert.equal(mount.querySelector('[data-testid="pgn-meta-date"]').textContent, 'Tidak diketahui');
});

// ---------------------------------------------------------------------------
// SKENARIO 4: Legalitas Seluruh Urutan SAN
// ---------------------------------------------------------------------------
await runTest('4. Legalitas seluruh urutan SAN secara berurutan (rokade, en passant, promosi pion, disambiguasi, skakmat)', () => {
  const promotionAndEpPgn = `
[Event "Uji Promosi dan En Passant"]
[White "Putih"]
[Black "Hitam"]
[Result "1-0"]

1. e4 d5 2. exd5 c5 3. dxc6 Nf6 4. cxb7 Nbd7 5. bxa8=Q Nb6 6. Qdf3 1-0
  `;
  const res = validateAndParsePgn(promotionAndEpPgn);
  assert.equal(res.valid, true, `Partai dengan en passant (dxc6) dan promosi (bxa8=Q) harus valid (error: ${res.errorMessage})`);
  assert.equal(res.moves[4].san, 'dxc6', 'Langkah ke-5 ply harus en passant dxc6');
  assert.equal(res.moves[8].san, 'bxa8=Q', 'Langkah ke-9 ply harus promosi bxa8=Q');
  assert.equal(res.moves[8].promotion, 'q');

  for (let i = 1; i < res.moves.length; i += 1) {
    assert.equal(
      res.moves[i].fenBefore,
      res.moves[i - 1].fenAfter,
      `FEN sebelum ply ${i + 1} harus sama dengan FEN sesudah ply ${i}`
    );
  }
});

// ---------------------------------------------------------------------------
// SKENARIO 5: Validasi Langkah Ilegal
// ---------------------------------------------------------------------------
await runTest('5. Validasi langkah ilegal dan format notasi tidak valid ditolak secara akurat', () => {
  const illegalMovePgn = `
[Event "Partai Langkah Ilegal"]
[White "Pemain A"]
[Black "Pemain B"]

1. e4 e5 2. Bc4 Bc5 3. Nxe5 Nxe4 4. Bxf7+ Kxf7 5. O-O
  `;
  const resIllegal = validateAndParsePgn(illegalMovePgn);
  assert.equal(resIllegal.valid, false, 'PGN dengan satu langkah ilegal wajib ditolak');
  assert.equal(resIllegal.errorCode, PGN_ERROR_CODES.ILLEGAL_MOVE);
  assert.ok(resIllegal.errorMessage.includes('Nxe5'), 'Pesan error harus menyebutkan langkah ilegal Nxe5');
  assert.equal(resIllegal.details.ply, 5);

  const kingIntoCheckPgn = '1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# Ke7';
  const resAfterMate = validateAndParsePgn(kingIntoCheckPgn);
  assert.equal(resAfterMate.valid, false, 'Langkah setelah skakmat wajib ditolak');
  assert.equal(resAfterMate.errorCode, PGN_ERROR_CODES.ILLEGAL_MOVE);

  const invalidNotationPgn = '1. e4 e5 2. g1f3 b8c6';
  const resInvalidSan = validateAndParsePgn(invalidNotationPgn);
  assert.equal(resInvalidSan.valid, false, 'Notasi UCI mentah g1f3 wajib ditolak sebagai format notasi tidak valid');
  assert.equal(resInvalidSan.errorCode, PGN_ERROR_CODES.INVALID_NOTATION);
});

// ---------------------------------------------------------------------------
// SKENARIO 6: PGN Kosong
// ---------------------------------------------------------------------------
await runTest('6. Validasi PGN kosong (string kosong, spasi, atau hanya komentar tanpa langkah)', () => {
  for (const emptyInput of ['', '   \n\t  ', null, undefined]) {
    const res = validateAndParsePgn(emptyInput);
    assert.equal(res.valid, false);
    assert.equal(res.errorCode, PGN_ERROR_CODES.EMPTY_PGN);
    assert.ok(res.errorMessage.toLowerCase().includes('kosong'));
  }

  const onlyHeadersNoMoves = '[Event "Tanpa Langkah"]\n[White "A"]\n[Black "B"]';
  const resNoMoves = validateAndParsePgn(onlyHeadersNoMoves);
  assert.equal(resNoMoves.valid, false);
  assert.equal(resNoMoves.errorCode, PGN_ERROR_CODES.EMPTY_PGN);
});

// ---------------------------------------------------------------------------
// SKENARIO 7: File Kosong
// ---------------------------------------------------------------------------
await runTest('7. Validasi file PGN kosong (ukuran 0 byte)', () => {
  const resZeroByte = validatePgnFileMeta({
    name: 'kosong.pgn',
    size: 0,
    type: 'application/x-chess-pgn'
  });
  assert.equal(resZeroByte.valid, false);
  assert.equal(resZeroByte.errorCode, PGN_ERROR_CODES.EMPTY_FILE);
  assert.ok(resZeroByte.errorMessage.includes('0 byte') || resZeroByte.errorMessage.includes('kosong'));
});

// ---------------------------------------------------------------------------
// SKENARIO 8: File Melebihi Batas Ukuran (Maksimal 2 MB)
// ---------------------------------------------------------------------------
await runTest('8. Validasi file melebihi batas ukuran aman 2 MB', () => {
  const exactly2MB = validatePgnFileMeta({
    name: 'batas-aman.pgn',
    size: MAX_PGN_FILE_SIZE_BYTES,
    type: 'text/plain'
  });
  assert.equal(exactly2MB.valid, true, 'File tepat 2 MB harus diizinkan');

  const over2MB = validatePgnFileMeta({
    name: 'terlalu-besar.pgn',
    size: MAX_PGN_FILE_SIZE_BYTES + 1024,
    type: 'text/plain'
  });
  assert.equal(over2MB.valid, false, 'File > 2 MB wajib ditolak');
  assert.equal(over2MB.errorCode, PGN_ERROR_CODES.FILE_TOO_LARGE);
  assert.ok(over2MB.errorMessage.includes('2 MB') || over2MB.errorMessage.includes('2.00 MB'));

  const hugeString = '1. e4 e5 '.repeat(300000);
  const hugeParseRes = validateAndParsePgn(hugeString);
  assert.equal(hugeParseRes.valid, false);
  assert.equal(hugeParseRes.errorCode, PGN_ERROR_CODES.FILE_TOO_LARGE);
});

// ---------------------------------------------------------------------------
// SKENARIO 9: Ekstensi Tidak Sesuai & File Bukan PGN
// ---------------------------------------------------------------------------
await runTest('9. Validasi ekstensi file tidak sesuai (.txt, .jpg, .pdf) dan deteksi isi file biner ber-ekstensi .pgn', () => {
  for (const badName of ['partai.txt', 'gambar.png', 'dokumen.pdf', 'tanpa_ekstensi']) {
    const metaRes = validatePgnFileMeta({ name: badName, size: 512, type: 'text/plain' });
    assert.equal(metaRes.valid, false, `File ${badName} harus ditolak karena bukan ekstensi .pgn`);
    assert.equal(metaRes.errorCode, PGN_ERROR_CODES.INVALID_FILE_TYPE);
  }

  const fakePgnBinaryContent = '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR';
  const contentRes = validateAndParsePgn(fakePgnBinaryContent);
  assert.equal(contentRes.valid, false, 'File biner yang diberi nama .pgn wajib ditolak oleh validasi isi');
  assert.equal(contentRes.errorCode, PGN_ERROR_CODES.INVALID_FILE_TYPE);
});

// ---------------------------------------------------------------------------
// SKENARIO 10: Result Tag
// ---------------------------------------------------------------------------
await runTest('10. Validasi Result tag (1-0, 0-1, 1/2-1/2, *) serta deteksi Result tidak valid atau bertentangan', () => {
  assert.deepEqual(VALID_PGN_RESULTS, ['1-0', '0-1', '1/2-1/2', '*']);

  const badResultHeaderPgn = `
[Event "Uji Result"]
[White "A"]
[Black "B"]
[Result "2-0"]

1. e4 e5 2. Nf3 Nc6
  `;
  const resBadHeader = validateAndParsePgn(badResultHeaderPgn);
  assert.equal(resBadHeader.valid, false);
  assert.equal(resBadHeader.errorCode, PGN_ERROR_CODES.INVALID_RESULT);

  const mismatchResultPgn = `
[Event "Uji Konflik Result"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 0-1
  `;
  const resMismatch = validateAndParsePgn(mismatchResultPgn);
  assert.equal(resMismatch.valid, false);
  assert.equal(resMismatch.errorCode, PGN_ERROR_CODES.INVALID_RESULT);

  const wrongCheckmateResultPgn = `
[Event "Fools Mate Salah Result"]
[Result "1-0"]

1. f3 e5 2. g4 Qh4# 1-0
  `;
  const resWrongMate = validateAndParsePgn(wrongCheckmateResultPgn);
  assert.equal(resWrongMate.valid, false, 'Skakmat oleh Hitam tidak boleh diklaim 1-0');
  assert.equal(resWrongMate.errorCode, PGN_ERROR_CODES.INVALID_RESULT);

  const correctCheckmateResultPgn = `
[Event "Fools Mate Benar"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
  `;
  const resCorrectMate = validateAndParsePgn(correctCheckmateResultPgn);
  assert.equal(resCorrectMate.valid, true);
  assert.equal(resCorrectMate.metadata.result, '0-1');
  assert.equal(resCorrectMate.finalStatus.isCheckmate, true);
});

// ---------------------------------------------------------------------------
// SKENARIO 11: Komentar dan NAG Sesuai Dukungan Parser
// ---------------------------------------------------------------------------
await runTest('11. Dukungan komentar ({...} & ;...), NAG ($1..$6, !, ?, !!, ??, !?, ?!), dan pesan jelas untuk variasi bersarang (...)', () => {
  const annotatedPgn = `
[Event "Partai Berkomentar"]
[White "Master A"]
[Black "Master B"]
[Result "1-0"]

{Komentar pembuka sebelum langkah pertama}
1. e4! {Langkah pembukaan favorit} e5 $2 2. Nf3!! Nc6?! ; Komentar akhir baris
3. Bc4 $1 Bc5? 4. b4!? Bxb4?? 1-0
  `;

  const res = validateAndParsePgn(annotatedPgn);
  assert.equal(res.valid, true, 'PGN dengan komentar dan NAG wajib berhasil diparse');
  assert.equal(res.initialComments.length, 1);
  assert.equal(res.initialComments[0], 'Komentar pembuka sebelum langkah pertama');

  assert.equal(res.moves[0].san, 'e4');
  assert.deepEqual(res.moves[0].comments, ['Langkah pembukaan favorit']);
  assert.equal(res.moves[0].nags[0].code, '$1');
  assert.equal(res.moves[0].nags[0].symbol, '!');

  assert.equal(res.moves[1].san, 'e5');
  assert.equal(res.moves[1].nags[0].code, '$2');

  const variationPgn = `
[Event "Partai Dengan Variasi"]
[White "A"]
[Black "B"]

1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 *
  `;
  const resVar = validateAndParsePgn(variationPgn);
  assert.equal(resVar.valid, false, 'Variasi bersarang tidak boleh dibuang diam-diam');
  assert.equal(resVar.errorCode, PGN_ERROR_CODES.UNSUPPORTED_VARIATION);
  assert.ok(resVar.errorMessage.includes('variasi'));
});

// ---------------------------------------------------------------------------
// SKENARIO 12: Multiple Games
// ---------------------------------------------------------------------------
await runTest('12. Deteksi multiple games (menolak beberapa partai sekaligus dengan pesan yang jelas)', () => {
  const multiGameWithHeaders = `
[Event "Partai 1"]
[White "A"]
[Black "B"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0

[Event "Partai 2"]
[White "C"]
[Black "D"]
[Result "0-1"]

1. f3 e5 2. g4 Qh4# 0-1
  `;

  const res1 = validateAndParsePgn(multiGameWithHeaders);
  assert.equal(res1.valid, false, 'Multiple games dengan header kedua tidak boleh hanya mengambil partai pertama diam-diam');
  assert.equal(res1.errorCode, PGN_ERROR_CODES.MULTIPLE_GAMES);
  assert.ok(res1.errorMessage.includes('beberapa partai'));

  const multiGameMovetextOnly = '1. e4 e5 1-0 1. d4 d5 1/2-1/2';
  const res2 = validateAndParsePgn(multiGameMovetextOnly);
  assert.equal(res2.valid, false, 'Multiple games tanpa header kedua juga wajib terdeteksi');
  assert.equal(res2.errorCode, PGN_ERROR_CODES.MULTIPLE_GAMES);
});

// ---------------------------------------------------------------------------
// SKENARIO 13: PGN Terpotong
// ---------------------------------------------------------------------------
await runTest('13. Deteksi PGN terpotong (komentar tidak ditutup, nomor langkah menggantung, atau header rusak)', () => {
  const unclosedCommentPgn = '1. e4 e5 {komentar ini terpotong sampai akhir file';
  const res1 = validateAndParsePgn(unclosedCommentPgn);
  assert.equal(res1.valid, false);
  assert.equal(res1.errorCode, PGN_ERROR_CODES.TRUNCATED_PGN);

  const danglingMoveNumPgn = '1. e4 e5 2. Nf3 Nc6 3.';
  const res2 = validateAndParsePgn(danglingMoveNumPgn);
  assert.equal(res2.valid, false);
  assert.equal(res2.errorCode, PGN_ERROR_CODES.TRUNCATED_PGN);

  const brokenHeaderPgn = '[Event "Turnamen Terpotong]\n1. e4 e5';
  const res3 = validateAndParsePgn(brokenHeaderPgn);
  assert.equal(res3.valid, false);
  assert.equal(res3.errorCode, PGN_ERROR_CODES.INVALID_HEADER);
});

// ---------------------------------------------------------------------------
// SKENARIO 14: FEN Awal dan Posisi Akhir
// ---------------------------------------------------------------------------
await runTest('14. Validasi FEN awal (standar & custom [FEN]) dan keakuratan posisi akhir (finalFen)', () => {
  const stdPgn = '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6';
  const resStd = validateAndParsePgn(stdPgn);
  assert.equal(resStd.valid, true);
  assert.equal(resStd.initialFen, DEFAULT_POSITION);

  const verifyChess = new Chess();
  ['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6'].forEach(m => verifyChess.move(m));
  assert.equal(resStd.finalFen, verifyChess.fen(), 'finalFen harus identik dengan hasil eksekusi berurutan Chess.js');

  const customStartFen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
  const customFenPgn = `
[Event "Posisi Custom Ruy Lopez"]
[SetUp "1"]
[FEN "${customStartFen}"]
[Result "*"]

3. Bb5 a6 4. Ba4 Nf6 *
  `;
  const resCustom = validateAndParsePgn(customFenPgn);
  assert.equal(resCustom.valid, true);
  assert.equal(resCustom.initialFen, customStartFen);
  assert.equal(resCustom.totalPlies, 4);
  assert.equal(resCustom.moves[0].san, 'Bb5');
  assert.equal(resCustom.moves[0].moveNumber, 3);
});

// ---------------------------------------------------------------------------
// SKENARIO 15: Navigasi Langkah Sebelumnya dan Berikutnya
// ---------------------------------------------------------------------------
await runTest('15. Navigasi langkah sebelumnya (prevMove) dan langkah berikutnya (nextMove) pada Interactive Analysis Board', () => {
  const sampleRes = validateAndParsePgn(SAMPLE_PGN_PLACEHOLDER);
  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  sessionState.parsedGame = sampleRes;
  sessionState.rawPgnText = SAMPLE_PGN_PLACEHOLDER;

  renderAnalysisView(mount, sessionState);
  const board = getActiveAnalysisBoard();
  assert.ok(board instanceof AnalysisReplayBoard);

  // Mulai di ply 0
  assert.equal(board.getReplayState().currentPly, 0);
  assert.equal(board.getCurrentFen(), sampleRes.initialFen);

  // Klik tombol Berikutnya 3 kali (ply 1, 2, 3)
  mount.querySelector('[data-testid="analysis-btn-next"]').click();
  assert.equal(board.getReplayState().currentPly, 1);
  assert.equal(board.getCurrentFen(), sampleRes.moves[0].fenAfter);
  assert.deepEqual(board.getReplayState().lastMove, { from: 'e2', to: 'e4' });
  assert.equal(mount.querySelector('[data-square="e4"]').classList.contains('square-last-move'), true);

  mount.querySelector('[data-testid="analysis-btn-next"]').click();
  assert.equal(board.getReplayState().currentPly, 2);
  assert.equal(board.getCurrentFen(), sampleRes.moves[1].fenAfter);

  mount.querySelector('[data-testid="analysis-btn-next"]').click();
  assert.equal(board.getReplayState().currentPly, 3);
  assert.equal(board.getCurrentFen(), sampleRes.moves[2].fenAfter);

  // Klik tombol Sebelumnya 2 kali (kembali ke ply 2 lalu ply 1)
  mount.querySelector('[data-testid="analysis-btn-prev"]').click();
  assert.equal(board.getReplayState().currentPly, 2);
  assert.equal(board.getCurrentFen(), sampleRes.moves[1].fenAfter);

  mount.querySelector('[data-testid="analysis-btn-prev"]').click();
  assert.equal(board.getReplayState().currentPly, 1);
  assert.equal(board.getCurrentFen(), sampleRes.moves[0].fenAfter);

  destroyActiveAnalysisBoard();
});

// ---------------------------------------------------------------------------
// SKENARIO 16: Navigasi ke Posisi Awal, Posisi Akhir, Klik Daftar SAN, & Orientasi Papan
// ---------------------------------------------------------------------------
await runTest('16. Navigasi ke posisi awal (firstMove), posisi akhir (lastMovePosition), klik langsung daftar SAN, & balik orientasi papan', () => {
  const sampleRes = validateAndParsePgn(SAMPLE_PGN_PLACEHOLDER);
  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  sessionState.parsedGame = sampleRes;
  sessionState.rawPgnText = SAMPLE_PGN_PLACEHOLDER;

  renderAnalysisView(mount, sessionState);
  const board = getActiveAnalysisBoard();

  // Klik langsung pada daftar notasi SAN: pilih Ply 7 (4. Ba4)
  const ply7Btn = mount.querySelector('[data-testid="analysis-move-ply-7"]');
  assert.ok(ply7Btn, 'Tombol daftar notasi SAN untuk ply 7 harus tersedia');
  ply7Btn.click();
  assert.equal(board.getReplayState().currentPly, 7);
  assert.equal(board.getCurrentFen(), sampleRes.moves[6].fenAfter);
  assert.equal(ply7Btn.classList.contains('active'), true);

  // Klik tombol "Akhir" (Posisi Akhir) -> Ply 16
  mount.querySelector('[data-testid="analysis-btn-last"]').click();
  assert.equal(board.getReplayState().currentPly, 16);
  assert.equal(board.getCurrentFen(), sampleRes.finalFen);
  assert.equal(mount.querySelector('[data-testid="analysis-btn-next"]').disabled, true);
  assert.equal(mount.querySelector('[data-testid="analysis-btn-last"]').disabled, true);

  // Klik tombol "Awal" (Posisi Awal) -> kembali ke Ply 0
  mount.querySelector('[data-testid="analysis-btn-first"]').click();
  assert.equal(board.getReplayState().currentPly, 0);
  assert.equal(board.getCurrentFen(), sampleRes.initialFen);
  assert.equal(mount.querySelector('[data-testid="analysis-btn-first"]').disabled, true);
  assert.equal(mount.querySelector('[data-testid="analysis-btn-prev"]').disabled, true);

  // Klik tombol "Balik Papan" (Flip Board)
  assert.equal(board.getReplayState().orientation, 'white');
  mount.querySelector('[data-testid="analysis-btn-flip"]').click();
  assert.equal(board.getReplayState().orientation, 'black');
  assert.equal(
    mount.querySelector('[data-testid="analysis-orientation-indicator"]').textContent,
    'Hitam di Bawah'
  );

  destroyActiveAnalysisBoard();
});

// ---------------------------------------------------------------------------
// SKENARIO 17: Validasi Tampilan Pesan Error pada UI (Upload & Paste)
// ---------------------------------------------------------------------------
await runTest('17. Validasi tampilan pesan error Bahasa Indonesia pada UI Analysis Studio (Paste & Upload File)', async () => {
  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  renderAnalysisView(mount, sessionState);

  // 1) Klik Paste / Import saat textarea kosong
  mount.querySelector('[data-testid="pgn-paste-submit-btn"]').click();

  const errAlert = mount.querySelector('[data-testid="pgn-error-alert"]');
  assert.equal(errAlert.classList.contains('hidden'), false, 'Banner error harus tampil saat input kosong');
  const errTitle = mount.querySelector('[data-testid="pgn-error-title"]').textContent;
  const errMsg = mount.querySelector('[data-testid="pgn-error-message"]').textContent;
  assert.ok(errTitle.length > 0);
  assert.ok(errMsg.toLowerCase().includes('kosong'));
  assert.equal(/at\s+\w+\s*\(|ReferenceError|TypeError/i.test(errMsg), false, 'Tidak boleh menampilkan stack trace');

  // 2) Simulasikan upload file .pgn via file picker
  const fileInput = mount.querySelector('[data-testid="pgn-file-input"]');
  const mockValidFile = {
    name: 'partai-turnamen.pgn',
    size: SAMPLE_PGN_PLACEHOLDER.length,
    type: 'application/x-chess-pgn',
    text: async () => SAMPLE_PGN_PLACEHOLDER
  };
  fileInput.files = [mockValidFile];
  fileInput.dispatchEvent({ type: 'change', target: { files: [mockValidFile] } });
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.equal(sessionState.parsedGame.valid, true, 'Upload file .pgn valid harus berhasil diproses');
  assert.equal(
    mount.querySelector('[data-testid="pgn-selected-filename"]').textContent,
    'partai-turnamen.pgn'
  );
  assert.ok(
    mount.querySelector('[data-testid="pgn-selected-filesize"]').textContent.includes('B'),
    'Ukuran file harus ditampilkan'
  );

  // 3) Simulasikan upload file dengan ekstensi salah (.txt)
  const fileInput2 = mount.querySelector('[data-testid="pgn-file-input"]');
  const mockBadExtFile = {
    name: 'catatan.txt',
    size: 120,
    type: 'text/plain',
    text: async () => '1. e4 e5'
  };
  fileInput2.dispatchEvent({ type: 'change', target: { files: [mockBadExtFile] } });
  await new Promise(resolve => setTimeout(resolve, 20));

  assert.equal(sessionState.parsedGame, null);
  assert.equal(sessionState.validationError.errorCode, PGN_ERROR_CODES.INVALID_FILE_TYPE);
  assert.equal(mount.querySelector('[data-testid="pgn-error-alert"]').classList.contains('hidden'), false);
});

// ---------------------------------------------------------------------------
// SKENARIO 18: Perlindungan terhadap Input HTML / JavaScript (XSS Protection)
// ---------------------------------------------------------------------------
await runTest('18. Perlindungan keamanan terhadap input HTML/JavaScript berbahaya di header & komentar PGN', () => {
  const maliciousPgn = `
[Event "<script>window.__xssExecuted = true;</script><img src=x onerror=alert(1)>"]
[Site "<svg onload=alert(2)>"]
[Date "2026.05.10"]
[White "<b><script>alert('white')</script>HackerWhite</b>"]
[Black "<iframe src='javascript:alert(3)'></iframe>HackerBlack"]
[Result "1-0"]

{<script>window.__xssComment = true;</script>}
1. e4 {<img src=x onerror="window.__xssMove=true">} e5 2. Nf3 Nc6 1-0
  `;

  globalThis.window.__xssExecuted = false;
  globalThis.window.__xssComment = false;
  globalThis.window.__xssMove = false;

  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  renderAnalysisView(mount, sessionState);

  const textarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
  textarea.value = maliciousPgn;
  textarea.dispatchEvent(new MockEvent('input'));
  mount.querySelector('[data-testid="pgn-paste-submit-btn"]').click();

  const previewSection = mount.querySelector('[data-testid="pgn-preview-section"]');
  assert.equal(previewSection.classList.contains('hidden'), false);
  assert.equal(previewSection.querySelectorAll('script').length, 0, 'Tidak boleh ada elemen <script> yang terinjeksi ke DOM');
  assert.equal(previewSection.querySelectorAll('iframe').length, 0, 'Tidak boleh ada elemen <iframe> yang terinjeksi ke DOM');
  assert.equal(previewSection.querySelectorAll('img').length, 0, 'Tidak boleh ada elemen <img> yang terinjeksi ke DOM');
  assert.equal(globalThis.window.__xssExecuted, false);
  assert.equal(globalThis.window.__xssComment, false);
  assert.equal(globalThis.window.__xssMove, false);

  const whiteText = mount.querySelector('[data-testid="pgn-meta-white"]').textContent;
  assert.ok(whiteText.includes('<script>'), 'String berbahaya harus diperlakukan murni sebagai textContent');
});

// ---------------------------------------------------------------------------
// SKENARIO 19: Tidak Ada Request Supabase selama Import dan Replay
// ---------------------------------------------------------------------------
await runTest('19. Arsitektur Supabase Free Plan: ZERO request jaringan/Supabase & ZERO penyimpanan PGN ke LocalStorage selama import dan replay', async () => {
  globalThis.localStorage.clear();
  progressService.resetAllProgress();

  const app = new CaturanApp({ requireAuth: false });
  await app.init();

  const analysisNavItem = NAV_ITEMS.find(item => item.id === 'analysis');
  assert.ok(analysisNavItem, 'Item menu analysis harus ada di NAV_ITEMS');
  assert.equal(analysisNavItem.activeInMvp, true, 'Menu Analisis wajib aktif pada MVP 5.1');

  const analysisNavBtn = document.querySelector('#app-sidebar [data-nav="analysis"]');
  assert.ok(analysisNavBtn, 'Tombol menu Analisis wajib dirender aktif di sidebar');

  capturedNetworkRequests.length = 0;
  const localStorageBefore = JSON.stringify(globalThis.localStorage.dump());

  analysisNavBtn.click();
  assert.equal(app.currentRoute, 'analysis');

  const mainEl = document.getElementById('app-main-content');
  assert.ok(mainEl.querySelector('[data-testid="analysis-studio-page"]'));

  // Import PGN
  const textarea = mainEl.querySelector('[data-testid="pgn-paste-textarea"]');
  textarea.value = SAMPLE_PGN_PLACEHOLDER;
  textarea.dispatchEvent(new MockEvent('input'));
  mainEl.querySelector('[data-testid="pgn-paste-submit-btn"]').click();

  // Navigasi langkah demi langkah
  mainEl.querySelector('[data-testid="analysis-btn-next"]').click();
  mainEl.querySelector('[data-testid="analysis-btn-next"]').click();
  mainEl.querySelector('[data-testid="analysis-btn-prev"]').click();
  mainEl.querySelector('[data-testid="analysis-move-ply-8"]').click();
  mainEl.querySelector('[data-testid="analysis-btn-last"]').click();
  mainEl.querySelector('[data-testid="analysis-btn-first"]').click();
  mainEl.querySelector('[data-testid="analysis-btn-flip"]').click();

  assert.equal(
    capturedNetworkRequests.length,
    0,
    `Tidak boleh ada request jaringan/Supabase selama import dan replay PGN (aktual: ${capturedNetworkRequests.length})`
  );

  const localStorageAfter = JSON.stringify(globalThis.localStorage.dump());
  assert.equal(
    localStorageAfter,
    localStorageBefore,
    'LocalStorage tidak boleh menyimpan PGN secara otomatis'
  );
  assert.equal(
    localStorageAfter.includes('Budi Santoso'),
    false,
    'Metadata/isi PGN tidak boleh disimpan ke LocalStorage'
  );
});

// ---------------------------------------------------------------------------
// SKENARIO 20: Responsive Layout, Palet Warna Solid, Touch Target >= 44px, & Internal Scroll
// ---------------------------------------------------------------------------
await runTest('20. Responsive layout (320px, 360px, 390px, 430px, 768px, 1024px, 1366px, 1920px), Touch target >= 44px, & Palet Warna Solid', async () => {
  // 1) Verifikasi seluruh file CSS bebas dari gradient dan memiliki palet warna Caturan yang tepat
  const variablesCss = fs.readFileSync(path.join(ROOT, 'css/variables.css'), 'utf8');
  assert.ok(variablesCss.includes('#F8F5EF'), 'Light Mode background #F8F5EF wajib ada di variables.css');
  assert.ok(variablesCss.includes('#17243A'), 'Light Mode text #17243A wajib ada di variables.css');
  assert.ok(variablesCss.includes('#101C30'), 'Dark Mode background #101C30 wajib ada di variables.css');
  assert.ok(variablesCss.includes('#F5F3EF'), 'Dark Mode text #F5F3EF wajib ada di variables.css');
  assert.ok(variablesCss.includes('#E98232'), 'Accent color #E98232 wajib ada di variables.css');

  const cssFiles = ['css/variables.css', 'css/layout.css', 'css/components.css', 'css/chessboard.css'];
  for (const relCss of cssFiles) {
    const content = fs.readFileSync(path.join(ROOT, relCss), 'utf8');
    const withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '');
    assert.equal(
      /linear-gradient|radial-gradient|conic-gradient/i.test(withoutComments),
      false,
      `File ${relCss} tidak boleh menggunakan gradient CSS`
    );
  }

  // 2) Verifikasi aturan CSS responsif Analysis Studio untuk touch target >= 44px & internal scroll
  const componentsCss = fs.readFileSync(path.join(ROOT, 'css/components.css'), 'utf8');
  const chessboardCss = fs.readFileSync(path.join(ROOT, 'css/chessboard.css'), 'utf8');

  assert.ok(
    /\.analysis-touch-btn\s*\{[\s\S]*?min-height:\s*44px/i.test(componentsCss),
    '.analysis-touch-btn harus memiliki min-height: 44px'
  );
  assert.ok(
    /\.analysis-ply-btn\s*\{[\s\S]*?min-height:\s*44px/i.test(componentsCss),
    '.analysis-ply-btn harus memiliki min-height: 44px'
  );
  assert.ok(
    /\.analysis-replay-controls\s+\.analysis-nav-btn\s*\{[\s\S]*?min-height:\s*44px/i.test(chessboardCss),
    '.analysis-nav-btn harus memiliki min-height: 44px'
  );
  assert.ok(
    /\.analysis-move-list-scroll\s*\{[\s\S]*?overflow-y:\s*auto/i.test(componentsCss),
    '.analysis-move-list-scroll harus mendukung scroll internal (overflow-y: auto)'
  );

  // 3) Uji perilaku responsif CaturanApp pada 8 target perangkat:
  //    320px, 360px, 390px, 430px, 768px, 1024px, 1366px, 1920px
  const targetWidths = [320, 360, 390, 430, 768, 1024, 1366, 1920];
  const app = new CaturanApp({ requireAuth: false });
  await app.init();
  app.navigate('analysis');

  for (const width of targetWidths) {
    globalThis.window.innerWidth = width;
    const isMobile = app.isMobileViewport();
    assert.equal(isMobile, width <= 860, `Deteksi viewport mobile pada ${width}px harus akurat`);

    app._syncSidebarDOM();
    if (width <= 860) {
      assert.equal(
        app.isMobileSidebarOpen,
        false,
        `Pada layar ${width}px drawer mobile harus tertutup secara default agar tidak menutupi papan`
      );
    }
  }
  globalThis.window.innerWidth = 1366;
});

// ===========================================================================
// PENGUJIAN KHUSUS MOBILE PGN IMPORT & FULL-SCREEN GAME REVIEW (<= 600px)
// ===========================================================================

// ---------------------------------------------------------------------------
// SKENARIO 21: Mobile Pertama Kali Membuka Screen PGN Import & Papan Review Tidak Tampil Sebelum PGN Valid
// ---------------------------------------------------------------------------
await runTest('21. [Mobile <= 600px] Pertama kali membuka Screen 1 (PGN Import) & papan review tidak tampil sebelum PGN valid', () => {
  globalThis.window.innerWidth = 390;
  assert.equal(MOBILE_ANALYSIS_BREAKPOINT, 600);
  assert.equal(isMobileAnalysisViewport(), true);

  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  renderAnalysisView(mount, sessionState);

  const pageEl = mount.querySelector('[data-testid="analysis-studio-page"]');
  assert.ok(pageEl, 'Halaman Analysis Studio harus dirender');
  assert.equal(pageEl.getAttribute('data-mobile-screen'), 'import', 'State awal mobile harus berada di screen import');
  assert.equal(sessionState.mobileScreen, 'import');

  // Topbar Mobile Screen 1: tombol kembali, judul Chess Analysis Studio, deskripsi pendek
  const importTopbar = mount.querySelector('[data-testid="analysis-mobile-import-topbar"]');
  assert.ok(importTopbar, 'Topbar Mobile PGN Import wajib ada');
  assert.ok(mount.querySelector('[data-testid="analysis-mobile-import-back-btn"]'), 'Tombol kembali pada halaman PGN Import wajib ada');
  assert.ok(importTopbar.textContent.includes('Chess Analysis Studio'), 'Judul Chess Analysis Studio wajib ada');
  assert.ok(importTopbar.textContent.includes('Import dan review permainan catur Anda'), 'Deskripsi pendek mobile wajib ada');

  // Tombol CTA utama tunggal "Validasi & Mulai Review"
  const ctaBtn = mount.querySelector('[data-testid="analysis-mobile-validate-cta"]');
  assert.ok(ctaBtn, 'Tombol aksi utama Validasi & Mulai Review wajib tersedia di mobile');
  assert.ok(ctaBtn.textContent.includes('Validasi & Mulai Review'));

  // Papan review tidak boleh tampil sebelum PGN valid
  const inputSection = mount.querySelector('[data-testid="pgn-input-section"]');
  const previewSection = mount.querySelector('[data-testid="pgn-preview-section"]');
  assert.equal(inputSection.classList.contains('hidden'), false, 'Screen PGN Import harus tampil');
  assert.equal(previewSection.classList.contains('hidden'), true, 'Screen Game Review wajib disembunyikan sebelum PGN valid');
  assert.equal(getActiveAnalysisBoard(), null, 'Instance papan catur belum boleh diinisialisasi saat masih di halaman Import kosong');

  globalThis.window.innerWidth = 1366;
});

// ---------------------------------------------------------------------------
// SKENARIO 22: Paste PGN Valid di Mobile Langsung Berpindah ke Game Review (Tanpa Tombol Kedua)
// ---------------------------------------------------------------------------
await runTest('22. [Mobile <= 600px] Paste PGN valid & tekan "Validasi & Mulai Review" otomatis berpindah ke Screen 2 (Game Review)', () => {
  globalThis.window.innerWidth = 390;

  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  renderAnalysisView(mount, sessionState);

  const textarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
  textarea.value = SAMPLE_PGN_PLACEHOLDER;
  textarea.dispatchEvent(new MockEvent('input'));

  // Tekan CTA utama mobile: Validasi & Mulai Review
  const mobileValidateCta = mount.querySelector('[data-testid="analysis-mobile-validate-cta"]');
  mobileValidateCta.click();

  // Harus otomatis pindah ke screen 'review' tanpa meminta pengguna menekan tombol kedua
  assert.equal(sessionState.parsedGame?.valid, true);
  assert.equal(sessionState.mobileScreen, 'review', 'State mobileScreen wajib langsung berpindah ke review');

  const pageEl = mount.querySelector('[data-testid="analysis-studio-page"]');
  assert.equal(pageEl.getAttribute('data-mobile-screen'), 'review');

  const inputSection = mount.querySelector('[data-testid="pgn-input-section"]');
  const previewSection = mount.querySelector('[data-testid="pgn-preview-section"]');
  assert.equal(inputSection.classList.contains('hidden'), true, 'Pada Screen 2 (Game Review), form import harus disembunyikan');
  assert.equal(previewSection.classList.contains('hidden'), false, 'Pada Screen 2 (Game Review), area review harus ditampilkan');
  assert.ok(getActiveAnalysisBoard(), 'Interactive Chessboard harus langsung aktif pada Game Review');

  destroyActiveAnalysisBoard();
  globalThis.window.innerWidth = 1366;
});

// ---------------------------------------------------------------------------
// SKENARIO 23: Upload File PGN Valid di Mobile Langsung Berpindah ke Game Review
// ---------------------------------------------------------------------------
await runTest('23. [Mobile <= 600px] Upload file .pgn valid di mobile langsung memvalidasi & berpindah ke Game Review', async () => {
  globalThis.window.innerWidth = 360;

  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  renderAnalysisView(mount, sessionState);

  const fileInput = mount.querySelector('[data-testid="pgn-file-input"]');
  const mockValidFile = {
    name: 'mobile-partai.pgn',
    size: SAMPLE_PGN_PLACEHOLDER.length,
    type: 'application/x-chess-pgn',
    text: async () => SAMPLE_PGN_PLACEHOLDER
  };
  fileInput.files = [mockValidFile];
  fileInput.dispatchEvent({ type: 'change', target: { files: [mockValidFile] } });
  await new Promise(resolve => setTimeout(resolve, 25));

  assert.equal(sessionState.parsedGame?.valid, true, 'File PGN valid harus lolos validasi');
  assert.equal(sessionState.mobileScreen, 'review', 'Upload file PGN valid harus otomatis berpindah ke Game Review');

  const pageEl = mount.querySelector('[data-testid="analysis-studio-page"]');
  assert.equal(pageEl.getAttribute('data-mobile-screen'), 'review');
  assert.equal(mount.querySelector('[data-testid="pgn-input-section"]').classList.contains('hidden'), true);
  assert.equal(mount.querySelector('[data-testid="pgn-preview-section"]').classList.contains('hidden'), false);

  destroyActiveAnalysisBoard();
  globalThis.window.innerWidth = 1366;
});

// ---------------------------------------------------------------------------
// SKENARIO 24: PGN Invalid di Mobile Tetap di Halaman Import, Menampilkan Error Jelas, & Mempertahankan Input
// ---------------------------------------------------------------------------
await runTest('24. [Mobile <= 600px] PGN invalid tetap di halaman Import, menampilkan error Bahasa Indonesia yang jelas, & mempertahankan isi PGN', () => {
  globalThis.window.innerWidth = 390;

  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  renderAnalysisView(mount, sessionState);

  const invalidPgnText = '1. e4 e5 2. Bc4 Bc5 3. Nxe5';
  const textarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
  textarea.value = invalidPgnText;
  textarea.dispatchEvent(new MockEvent('input'));

  mount.querySelector('[data-testid="analysis-mobile-validate-cta"]').click();

  // 1) Tetap berada di halaman import
  assert.equal(sessionState.parsedGame, null);
  assert.equal(sessionState.mobileScreen, 'import', 'Jika PGN invalid, wajib tetap berada di halaman import');
  const pageEl = mount.querySelector('[data-testid="analysis-studio-page"]');
  assert.equal(pageEl.getAttribute('data-mobile-screen'), 'import');
  assert.equal(mount.querySelector('[data-testid="pgn-input-section"]').classList.contains('hidden'), false);
  assert.equal(mount.querySelector('[data-testid="pgn-preview-section"]').classList.contains('hidden'), true);

  // 2) Error message tampil jelas tanpa stack trace
  const errAlert = mount.querySelector('[data-testid="pgn-error-alert"]');
  assert.equal(errAlert.classList.contains('hidden'), false, 'Pesan error wajib tampil pada halaman import');
  const errMsg = mount.querySelector('[data-testid="pgn-error-message"]').textContent;
  assert.ok(errMsg.includes('Nxe5'), 'Pesan error harus menjelaskan langkah ilegal yang menyebabkan gagal validasi');
  assert.equal(/at\s+\w+\s*\(|ReferenceError|TypeError|SyntaxError/i.test(errMsg), false, 'Tidak boleh ada raw exception/stack trace');

  // 3) Isi PGN tidak hilang agar pengguna dapat memperbaikinya
  const preservedTextarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
  assert.equal(preservedTextarea.value, invalidPgnText, 'Isi textarea PGN wajib dipertahankan saat gagal validasi');
  assert.equal(sessionState.rawPgnText, invalidPgnText);

  globalThis.window.innerWidth = 1366;
});

// ---------------------------------------------------------------------------
// SKENARIO 25: Tombol Kembali dari Game Review Mengembalikan ke PGN Import & Mempertahankan Data PGN + Ply
// ---------------------------------------------------------------------------
await runTest('25. [Mobile <= 600px] Tombol kembali dari Game Review (UI & Browser Back) mengembalikan ke PGN Import dengan data PGN & ply tetap terjaga', async () => {
  globalThis.window.innerWidth = 390;

  const app = new CaturanApp({ requireAuth: false });
  await app.init();
  app.navigate('analysis');

  const mainEl = document.getElementById('app-main-content');
  const textarea = mainEl.querySelector('[data-testid="pgn-paste-textarea"]');
  textarea.value = SAMPLE_PGN_PLACEHOLDER;
  textarea.dispatchEvent(new MockEvent('input'));

  // Validasi & masuk ke Game Review
  mainEl.querySelector('[data-testid="analysis-mobile-validate-cta"]').click();
  assert.equal(app.analysisSessionState.mobileScreen, 'review');
  assert.equal(globalThis.window.location.hash, '#analysis/review', 'Hash URL mobile review harus disinkronkan ke #analysis/review');

  // Pindah ke ply 5 pada Game Review
  mainEl.querySelector('[data-testid="analysis-mobile-ply-5"]').click();
  assert.equal(app.analysisSessionState.currentPly, 5);

  // Klik tombol kembali di Review Topbar
  const backToImportBtn = mainEl.querySelector('[data-testid="analysis-mobile-back-to-import-btn"]');
  assert.ok(backToImportBtn, 'Tombol panah kembali pada Review Topbar wajib ada');
  backToImportBtn.click();

  // Harus kembali ke PGN Import dengan data PGN tetap ada
  assert.equal(app.analysisSessionState.mobileScreen, 'import');
  assert.equal(globalThis.window.location.hash, '#analysis');
  assert.equal(app.analysisSessionState.rawPgnText, SAMPLE_PGN_PLACEHOLDER, 'Teks PGN sebelumnya wajib tetap tersimpan');
  assert.equal(app.analysisSessionState.currentPly, 5, 'Posisi langkah terakhir (ply 5) wajib tetap tersimpan di memori sesi');
  assert.equal(
    mainEl.querySelector('[data-testid="pgn-paste-textarea"]').value,
    SAMPLE_PGN_PLACEHOLDER,
    'Textarea pada halaman Import harus tetap menampilkan PGN sebelumnya'
  );

  // Masuk kembali ke Review tanpa kehilangan state
  mainEl.querySelector('[data-testid="analysis-mobile-validate-cta"]').click();
  assert.equal(app.analysisSessionState.mobileScreen, 'review');

  // Simulasikan tombol Back browser/Android (hash berubah dari #analysis/review kembali ke #analysis)
  globalThis.window.location.hash = '#analysis';
  app._handleHashRoute(false);
  assert.equal(app.analysisSessionState.mobileScreen, 'import', 'Tombol Back browser harus mengembalikan dari Game Review ke PGN Import');
  assert.equal(app.analysisSessionState.rawPgnText, SAMPLE_PGN_PLACEHOLDER, 'Data PGN tetap terjaga setelah Back browser');

  destroyActiveAnalysisBoard();
  globalThis.window.innerWidth = 1366;
});

// ---------------------------------------------------------------------------
// SKENARIO 26: Komponen Mobile Screen 2 (Game Review): Topbar, Compact Game Info, Papan 1:1, Move Strip, & Bottom Toolbar
// ---------------------------------------------------------------------------
await runTest('26. [Mobile <= 600px] Komponen Game Review (Topbar, Game Info Ringkas, Papan 1:1, Move Strip Horizontal, & Bottom Toolbar) berfungsi penuh', () => {
  globalThis.window.innerWidth = 390;

  const mount = document.createElement('div');
  const sessionState = createInitialAnalysisSessionState();
  renderAnalysisView(mount, sessionState);

  const textarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
  textarea.value = SAMPLE_PGN_PLACEHOLDER;
  textarea.dispatchEvent(new MockEvent('input'));
  mount.querySelector('[data-testid="analysis-mobile-validate-cta"]').click();

  // A. Review Topbar
  const reviewTopbar = mount.querySelector('[data-testid="analysis-mobile-review-topbar"]');
  assert.ok(reviewTopbar, 'Review Topbar wajib ada');
  assert.ok(reviewTopbar.textContent.includes('Review Partai'), 'Judul Review Partai wajib ada');
  assert.ok(mount.querySelector('[data-testid="analysis-mobile-back-to-import-btn"]'));

  // B. Game Information Panel Ringkas (tanpa rating palsu)
  const gameInfo = mount.querySelector('[data-testid="analysis-mobile-game-info"]');
  assert.ok(gameInfo, 'Game Information Panel ringkas wajib ada');
  assert.equal(mount.querySelector('[data-testid="analysis-mobile-white"]').textContent, 'Budi Santoso');
  assert.equal(mount.querySelector('[data-testid="analysis-mobile-black"]').textContent, 'Andi Pratama');
  assert.ok(mount.querySelector('[data-testid="analysis-mobile-result"]').textContent.includes('1-0'));
  assert.ok(mount.querySelector('[data-testid="analysis-mobile-event-date"]').textContent.includes('Partai Latihan Caturan'));
  assert.ok(mount.querySelector('[data-testid="analysis-mobile-valid-badge"]').textContent.includes('PGN Valid'));

  // C. Interactive Chessboard 1:1
  const board = getActiveAnalysisBoard();
  assert.ok(board instanceof AnalysisReplayBoard);
  assert.equal(board.getReplayState().orientation, 'white', 'Orientasi default Putih di bawah');
  assert.equal(mount.querySelectorAll('.chess-square').length, 64, 'Papan wajib merender 64 petak catur');
  assert.ok(mount.querySelectorAll('.coord-label').length >= 16, 'Koordinat a-h dan 1-8 wajib tetap dirender');

  // D. Move Navigation Strip di bawah papan
  const moveStrip = mount.querySelector('[data-testid="analysis-mobile-move-strip"]');
  assert.ok(moveStrip, 'Move Navigation Strip wajib ada di bawah papan');
  const stripScroll = mount.querySelector('[data-testid="analysis-mobile-strip-scroll"]');
  assert.ok(stripScroll, 'Container horizontal scroll Move Strip wajib ada');
  const sanPills = stripScroll.querySelectorAll('[data-mobile-ply]');
  assert.equal(sanPills.length, 17, 'Move Strip merender pill Awal (ply 0) + 16 ply langkah SAN');

  // Klik langkah langsung pada Move Strip (ply 6 -> 3... a6)
  const pillPly6 = mount.querySelector('[data-testid="analysis-mobile-ply-6"]');
  pillPly6.click();
  assert.equal(board.getReplayState().currentPly, 6);
  assert.equal(board.getCurrentFen(), sessionState.parsedGame.moves[5].fenAfter, 'FEN papan harus sesuai dengan langkah yang dipilih di Move Strip');
  assert.equal(pillPly6.classList.contains('active'), true, 'Langkah aktif di Move Strip wajib memiliki class active');

  // Tombol Sebelumnya & Berikutnya pada Move Strip
  mount.querySelector('[data-testid="analysis-mobile-strip-prev"]').click();
  assert.equal(board.getReplayState().currentPly, 5);
  mount.querySelector('[data-testid="analysis-mobile-strip-next"]').click();
  assert.equal(board.getReplayState().currentPly, 6);

  // E. Bottom Toolbar (Awal, Sebelumnya, Berikutnya, Akhir, Balik Papan)
  const bottomToolbar = mount.querySelector('[data-testid="analysis-mobile-bottom-toolbar"]');
  assert.ok(bottomToolbar, 'Bottom Toolbar wajib ada');

  const btnFirst = mount.querySelector('[data-testid="analysis-mobile-btn-first"]');
  const btnPrev = mount.querySelector('[data-testid="analysis-mobile-btn-prev"]');
  const btnNext = mount.querySelector('[data-testid="analysis-mobile-btn-next"]');
  const btnLast = mount.querySelector('[data-testid="analysis-mobile-btn-last"]');
  const btnFlip = mount.querySelector('[data-testid="analysis-mobile-btn-flip"]');

  assert.ok(btnFirst && btnPrev && btnNext && btnLast && btnFlip, 'Ke-5 tombol Bottom Toolbar wajib lengkap');

  // Uji Akhir
  btnLast.click();
  assert.equal(board.getReplayState().currentPly, 16);
  assert.equal(board.getCurrentFen(), sessionState.parsedGame.finalFen);
  assert.equal(btnNext.disabled, true, 'Tombol Berikutnya di Bottom Toolbar harus disabled pada posisi akhir');
  assert.equal(btnLast.disabled, true, 'Tombol Akhir di Bottom Toolbar harus disabled pada posisi akhir');

  // Uji Sebelumnya dari posisi akhir
  btnPrev.click();
  assert.equal(board.getReplayState().currentPly, 15);
  assert.equal(board.getCurrentFen(), sessionState.parsedGame.moves[14].fenAfter);

  // Uji Berikutnya kembali ke akhir
  btnNext.click();
  assert.equal(board.getReplayState().currentPly, 16);

  // Uji Awal
  btnFirst.click();
  assert.equal(board.getReplayState().currentPly, 0);
  assert.equal(board.getCurrentFen(), sessionState.parsedGame.initialFen);
  assert.equal(btnFirst.disabled, true, 'Tombol Awal di Bottom Toolbar harus disabled pada posisi awal');
  assert.equal(btnPrev.disabled, true, 'Tombol Sebelumnya di Bottom Toolbar harus disabled pada posisi awal');

  // Uji Balik Papan (Flip Board)
  assert.equal(board.getReplayState().orientation, 'white');
  btnFlip.click();
  assert.equal(board.getReplayState().orientation, 'black', 'Tombol Balik Papan di Bottom Toolbar harus membalik orientasi papan');

  destroyActiveAnalysisBoard();
  globalThis.window.innerWidth = 1366;
});

// ---------------------------------------------------------------------------
// SKENARIO 27: Verifikasi Breakpoint Mobile (320px, 360px, 390px, 430px, 600px) & Non-Regresi Desktop (768px, 1024px, 1366px)
// ---------------------------------------------------------------------------
await runTest('27. Verifikasi multi-viewport mobile (320px, 360px, 390px, 430px, 600px) & non-regresi desktop/tablet (768px, 1024px, 1366px)', () => {
  const mobileWidths = [320, 360, 390, 430, 600];
  for (const w of mobileWidths) {
    globalThis.window.innerWidth = w;
    assert.equal(isMobileAnalysisViewport(), true, `Lebar ${w}px wajib terdeteksi sebagai mobile analysis viewport (<= 600px)`);

    const mount = document.createElement('div');
    const state = createInitialAnalysisSessionState();
    renderAnalysisView(mount, state);

    assert.equal(
      mount.querySelector('[data-testid="analysis-studio-page"]').getAttribute('data-mobile-screen'),
      'import',
      `Pada ${w}px harus mulai dari screen import`
    );
    assert.equal(mount.querySelector('[data-testid="pgn-preview-section"]').classList.contains('hidden'), true);

    // Import PGN valid pada ukuran layar ini
    const textarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
    textarea.value = SAMPLE_PGN_PLACEHOLDER;
    textarea.dispatchEvent(new MockEvent('input'));
    mount.querySelector('[data-testid="analysis-mobile-validate-cta"]').click();

    assert.equal(
      mount.querySelector('[data-testid="analysis-studio-page"]').getAttribute('data-mobile-screen'),
      'review',
      `Pada ${w}px harus berpindah ke screen review setelah validasi`
    );
    assert.equal(mount.querySelector('[data-testid="pgn-input-section"]').classList.contains('hidden'), true);
    assert.equal(mount.querySelector('[data-testid="pgn-preview-section"]').classList.contains('hidden'), false);
    destroyActiveAnalysisBoard();
  }

  // Non-Regresi Tablet & Desktop (768px, 1024px, 1366px)
  const desktopWidths = [768, 1024, 1366];
  for (const w of desktopWidths) {
    globalThis.window.innerWidth = w;
    assert.equal(isMobileAnalysisViewport(), false, `Lebar ${w}px wajib terdeteksi sebagai non-mobile (> 600px)`);

    const mount = document.createElement('div');
    const state = createInitialAnalysisSessionState();
    renderAnalysisView(mount, state);

    // Sebelum ada partai valid, input section tampil
    assert.equal(mount.querySelector('[data-testid="pgn-input-section"]').classList.contains('hidden'), false);
    assert.equal(mount.querySelector('[data-testid="pgn-preview-section"]').classList.contains('hidden'), true);

    // Import PGN via tombol desktop
    const textarea = mount.querySelector('[data-testid="pgn-paste-textarea"]');
    textarea.value = SAMPLE_PGN_PLACEHOLDER;
    textarea.dispatchEvent(new MockEvent('input'));
    mount.querySelector('[data-testid="pgn-paste-submit-btn"]').click();

    // Pada desktop, preview section tampil dan pengguna dapat men-toggle panel input berdampingan dengan preview
    assert.equal(mount.querySelector('[data-testid="pgn-preview-section"]').classList.contains('hidden'), false);
    const toggleInputBtn = mount.querySelector('[data-testid="analysis-reimport-btn"]');
    assert.ok(toggleInputBtn, `Tombol Impor Ulang PGN desktop harus ada pada ${w}px`);
    toggleInputBtn.click();
    assert.equal(
      mount.querySelector('[data-testid="pgn-input-section"]').classList.contains('hidden'),
      false,
      `Pada desktop ${w}px, panel input dan preview dapat tampil bersama saat di-toggle`
    );
    assert.equal(
      mount.querySelector('[data-testid="pgn-preview-section"]').classList.contains('hidden'),
      false,
      `Pada desktop ${w}px, preview tetap tampil saat panel input dibuka`
    );
    destroyActiveAnalysisBoard();
  }

  // Verifikasi aturan CSS untuk mencegah horizontal overflow & menjaga isolasi mobile vs desktop
  const componentsCss = fs.readFileSync(path.join(ROOT, 'css/components.css'), 'utf8');
  assert.ok(
    /\.analysis-mobile-only\s*\{[\s\S]*?display:\s*none\s*!important/i.test(componentsCss),
    '.analysis-mobile-only harus display: none !important secara default pada desktop (> 600px)'
  );
  assert.ok(
    /@media\s*\(\s*max-width:\s*600px\s*\)/i.test(componentsCss),
    'Media query @media (max-width: 600px) wajib ada di css/components.css'
  );
  assert.ok(
    /\.analysis-mobile-strip-scroll\s*\{[\s\S]*?overflow-x:\s*auto/i.test(componentsCss),
    '.analysis-mobile-strip-scroll wajib memiliki overflow-x: auto agar tidak menimbulkan horizontal overflow halaman'
  );

  globalThis.window.innerWidth = 1366;
});

// ---------------------------------------------------------------------------
// Ringkasan Akhir
// ---------------------------------------------------------------------------
console.log('\n====================================================================');
console.log(
  `RINGKASAN VERIFIKASI MVP 5.1: ${passedTests} LULUS, ${failedTests} GAGAL (Total: ${totalTests} Pengujian)`
);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
}
process.exit(0);
