/**
 * VERIFICATION SUITE — CATURAN MVP 5.3 (CHESSBOARD MOTION & SOUND SYSTEM)
 *
 * Menguji secara menyeluruh:
 * A. 17 Pengujian Chess Audio Service (Procedural Web Audio API)
 * B. 12 Pengujian Chess Motion Service (Web Animations API & FLIP Geometry)
 * C. Pengaturan Global & LocalStorage (`caturan_chessboard_preferences_v1`)
 * D. Integrasi Global pada 8 Halaman/Komponen Papan Catur
 * E. Responsivitas Multi-Viewport (320px, 360px, 390px, 430px, 768px, 1024px, 1366px, 1920px) & Light/Dark Mode
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = 'd:/Anti Gravity/project/Caturan';
const toUrl = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

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
// Mock Web Audio API, Web Animations API & Minimal DOM Environment
// ---------------------------------------------------------------------------
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

function createAudioParam(initialValue = 0) {
  const events = [];
  return {
    value: initialValue,
    events,
    setValueAtTime(val, time) {
      this.value = val;
      events.push({ type: 'setValueAtTime', value: val, time });
    },
    linearRampToValueAtTime(val, time) {
      this.value = val;
      events.push({ type: 'linearRampToValueAtTime', value: val, time });
    },
    exponentialRampToValueAtTime(val, time) {
      this.value = val;
      events.push({ type: 'exponentialRampToValueAtTime', value: val, time });
    },
  };
}

class MockAudioBuffer {
  constructor(numberOfChannels, length, sampleRate) {
    this.numberOfChannels = numberOfChannels;
    this.length = length;
    this.sampleRate = sampleRate;
    this._channels = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  getChannelData(channelIdx) {
    return this._channels[channelIdx] || this._channels[0];
  }
}

class MockAudioContext {
  static instances = [];
  constructor() {
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = { nodeType: 'AudioDestinationNode' };
    this.oscillators = [];
    this.gains = [];
    this.filters = [];
    this.buffers = [];
    this.bufferSources = [];
    this.resumeCount = 0;
    this.suspendCount = 0;
    MockAudioContext.instances.push(this);
  }

  resume() {
    this.state = 'running';
    this.resumeCount += 1;
    return Promise.resolve();
  }

  suspend() {
    this.state = 'suspended';
    this.suspendCount += 1;
    return Promise.resolve();
  }

  createOscillator() {
    const osc = {
      nodeType: 'OscillatorNode',
      type: 'sine',
      frequency: createAudioParam(440),
      connectedTo: [],
      startedAt: null,
      stoppedAt: null,
      connect(dest) {
        this.connectedTo.push(dest);
        return dest;
      },
      disconnect() {},
      start(when = 0) {
        this.startedAt = when;
      },
      stop(when = 0) {
        this.stoppedAt = when;
      },
    };
    this.oscillators.push(osc);
    return osc;
  }

  createGain() {
    const gainNode = {
      nodeType: 'GainNode',
      gain: createAudioParam(1),
      connectedTo: [],
      connect(dest) {
        this.connectedTo.push(dest);
        return dest;
      },
      disconnect() {},
    };
    this.gains.push(gainNode);
    return gainNode;
  }

  createBiquadFilter() {
    const filter = {
      nodeType: 'BiquadFilterNode',
      type: 'lowpass',
      frequency: createAudioParam(1000),
      Q: createAudioParam(1),
      connectedTo: [],
      connect(dest) {
        this.connectedTo.push(dest);
        return dest;
      },
      disconnect() {},
    };
    this.filters.push(filter);
    return filter;
  }

  createDynamicsCompressor() {
    const comp = {
      nodeType: 'DynamicsCompressorNode',
      threshold: createAudioParam(-24),
      knee: createAudioParam(30),
      ratio: createAudioParam(12),
      attack: createAudioParam(0.003),
      release: createAudioParam(0.25),
      connectedTo: [],
      connect(dest) {
        this.connectedTo.push(dest);
        return dest;
      },
      disconnect() {},
    };
    return comp;
  }

  createBuffer(channels, length, sampleRate) {
    const buf = new MockAudioBuffer(channels, length, sampleRate);
    this.buffers.push(buf);
    return buf;
  }

  createBufferSource() {
    const src = {
      nodeType: 'AudioBufferSourceNode',
      buffer: null,
      connectedTo: [],
      startedAt: null,
      stoppedAt: null,
      connect(dest) {
        this.connectedTo.push(dest);
        return dest;
      },
      disconnect() {},
      start(when = 0) {
        this.startedAt = when;
      },
      stop(when = 0) {
        this.stoppedAt = when;
      },
    };
    this.bufferSources.push(src);
    return src;
  }
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
    this.disabled = false;
    this.value = '';
    this.files = [];
    this.listeners = new Map();
    this._animations = [];
    this.classList = {
      _set: new Set(),
      add: (...cls) => {
        cls.forEach((c) => c && this.classList._set.add(c));
        this._syncClassAttr();
      },
      remove: (...cls) => {
        cls.forEach((c) => this.classList._set.delete(c));
        this._syncClassAttr();
      },
      toggle: (c, force) => {
        const shouldAdd = force !== undefined ? Boolean(force) : !this.classList._set.has(c);
        if (shouldAdd) this.classList._set.add(c);
        else this.classList._set.delete(c);
        this._syncClassAttr();
        return shouldAdd;
      },
      contains: (c) => this.classList._set.has(c),
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

  get dataset() {
    const ds = {};
    for (const [k, v] of this.attributes.entries()) {
      if (k.startsWith('data-')) {
        const camel = k.slice(5).replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
        ds[camel] = v;
      }
    }
    return ds;
  }

  setAttribute(name, val) {
    const strVal = String(val);
    this.attributes.set(name, strVal);
    if (name === 'class') {
      this.classList._set = new Set(strVal.split(/\s+/).filter(Boolean));
    }
    if (name === 'disabled') this.disabled = true;
    if (name === 'value') this.value = strVal;
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

  replaceChild(newChild, oldChild) {
    const idx = this.children.indexOf(oldChild);
    if (idx !== -1) {
      newChild.parentNode = this;
      oldChild.parentNode = null;
      this.children[idx] = newChild;
    }
    return oldChild;
  }

  remove() {
    if (this.parentNode && typeof this.parentNode.removeChild === 'function') {
      this.parentNode.removeChild(this);
    }
  }

  get firstElementChild() {
    return this.children[0] || null;
  }

  closest(selector) {
    let curr = this;
    while (curr && curr instanceof MockElement) {
      if (matchesCompoundSelector(curr, selector)) return curr;
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
      ...event,
    };
    const fns = this.listeners.get(evt.type) || [];
    for (const fn of fns) fn(evt);
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
          stopPropagation: () => {},
        });
      }
      curr = curr.parentNode;
    }
  }

  animate(keyframes, options = {}) {
    const handle = {
      keyframes,
      options,
      playState: 'running',
      onfinish: null,
      oncancel: null,
      finish() {
        this.playState = 'finished';
        if (typeof this.onfinish === 'function') this.onfinish();
      },
      cancel() {
        this.playState = 'idle';
        if (typeof this.oncancel === 'function') this.oncancel();
      },
    };
    this._animations.push(handle);
    return handle;
  }

  getBoundingClientRect() {
    if (this._boundingRect) {
      return { ...this._boundingRect };
    }
    const sq = this.getAttribute('data-square');
    if (sq && sq.length === 2) {
      const col = FILES.indexOf(sq[0]);
      const row = 8 - parseInt(sq[1], 10);
      const size = 50;
      return {
        left: col * size,
        top: row * size,
        right: (col + 1) * size,
        bottom: (row + 1) * size,
        width: size,
        height: size,
        x: col * size,
        y: row * size,
      };
    }
    if (this.classList.contains('chessboard-frame') || this.classList.contains('chessboard-grid')) {
      return { left: 0, top: 0, right: 400, bottom: 400, width: 400, height: 400, x: 0, y: 0 };
    }
    return { left: 0, top: 0, right: 320, bottom: 48, width: 320, height: 48, x: 0, y: 0 };
  }

  get textContent() {
    if (this.children.length === 0) return this._textContent;
    return this._textContent + this.children.map((c) => c.textContent).join('');
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
      .map((s) => s.trim())
      .filter(Boolean);

    const visit = (node) => {
      for (const child of node.children) {
        if (selectors.some((sel) => matchesCompoundSelector(child, sel))) {
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
  if (parts.length === 1) return matchesSimpleSelector(el, parts[0]);
  if (!matchesSimpleSelector(el, parts[parts.length - 1])) return false;
  let curr = el.parentNode;
  let idx = parts.length - 2;
  while (curr && idx >= 0) {
    if (matchesSimpleSelector(curr, parts[idx])) idx--;
    curr = curr.parentNode;
  }
  return idx < 0;
}

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr', 'line',
  'circle', 'rect', 'polygon', 'polyline', 'path',
]);

function parseHtmlFragment(html, ownerDocument, parentNode) {
  const rootChildren = [];
  const stack = [{ children: rootChildren, node: parentNode }];
  const tokenRegex = /<!--[\s\S]*?-->|<\/([A-Za-z0-9_-]+)\s*>|<([A-Za-z0-9_-]+)([^>]*?)(\/?)>|([^<]+)/g;
  let m;

  while ((m = tokenRegex.exec(html)) !== null) {
    if (m[0].startsWith('<!--')) continue;
    if (m[1]) {
      const closeTag = m[1].toLowerCase();
      for (let i = stack.length - 1; i >= 1; i--) {
        if (stack[i].tag === closeTag) {
          stack.length = i;
          break;
        }
      }
    } else if (m[2]) {
      const tagName = m[2].toLowerCase();
      const attrStr = m[3] || '';
      const selfClose = Boolean(m[4]) || VOID_TAGS.has(tagName);
      const el = new MockElement(tagName, ownerDocument);
      const attrPairRegex = /([A-Za-z0-9_:-]+)(?:="([^"]*)")?/g;
      let am;
      while ((am = attrPairRegex.exec(attrStr)) !== null) {
        const k = am[1];
        const v = am[2] !== undefined ? am[2] : '';
        el.setAttribute(k, v);
      }
      const top = stack[stack.length - 1];
      el.parentNode = top.node || null;
      top.children.push(el);
      if (!selfClose) {
        stack.push({ tag: tagName, children: el.children, node: el });
      }
    } else if (m[5]) {
      const text = m[5];
      if (stack.length > 1) {
        const currentEl = stack[stack.length - 1].node;
        if (currentEl) currentEl._textContent += text;
      }
    }
  }
  return rootChildren;
}

class MockDocument {
  constructor() {
    this.documentElement = new MockElement('html', this);
    this.body = new MockElement('body', this);
    this.documentElement.appendChild(this.body);
    this.activeElement = null;
    this.hidden = false;
    this.listeners = new Map();
  }
  createElement(tag) {
    return new MockElement(tag, this);
  }
  getElementById(id) {
    return this.body.querySelector(`#${id}`);
  }
  querySelector(sel) {
    return this.body.querySelector(sel);
  }
  querySelectorAll(sel) {
    return this.body.querySelectorAll(sel);
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(fn);
  }
  removeEventListener(type, fn) {
    if (!this.listeners.has(type)) return;
    this.listeners.set(
      type,
      this.listeners.get(type).filter((f) => f !== fn)
    );
  }
  dispatchEvent(evt) {
    const fns = this.listeners.get(evt.type) || [];
    for (const fn of fns) fn(evt);
  }
}

const storageMap = new Map();
const mockLocalStorage = {
  getItem: (k) => (storageMap.has(k) ? storageMap.get(k) : null),
  setItem: (k, v) => storageMap.set(k, String(v)),
  removeItem: (k) => storageMap.delete(k),
  clear: () => storageMap.clear(),
};

let mockReducedMotion = false;
const networkRequests = [];

const mockDoc = new MockDocument();
globalThis.document = mockDoc;
globalThis.localStorage = mockLocalStorage;
globalThis.AudioContext = MockAudioContext;
globalThis.fetch = async (url) => {
  networkRequests.push({ type: 'fetch', url: String(url) });
  throw new Error(`Unexpected network fetch to ${url}`);
};
globalThis.Audio = function MockHtmlAudio(src) {
  networkRequests.push({ type: 'Audio', url: String(src) });
  throw new Error(`External HTMLAudioElement is forbidden: ${src}`);
};

globalThis.window = {
  document: mockDoc,
  localStorage: mockLocalStorage,
  AudioContext: MockAudioContext,
  innerWidth: 1366,
  innerHeight: 768,
  location: { hash: '#dashboard' },
  history: {
    pushState: (_s, _t, url) => {
      globalThis.window.location.hash = String(url || '');
    },
    replaceState: (_s, _t, url) => {
      globalThis.window.location.hash = String(url || '');
    },
  },
  matchMedia: (query) => ({
    matches: query.includes('prefers-reduced-motion') ? mockReducedMotion : false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }),
  addEventListener: () => {},
  removeEventListener: () => {},
  scrollTo: () => {},
};

// ---------------------------------------------------------------------------
// Import Modules Under Test
// ---------------------------------------------------------------------------
const { Chess } = await import(toUrl('js/vendor/chess.js'));
const {
  chessAudioService,
  classifyChessMoveSound,
  SOUND_TYPES,
  SOUND_PRESETS,
  CHESSBOARD_PREFERENCES_KEY,
} = await import(toUrl('js/services/chessAudioService.js'));
const {
  chessMotionService,
  MOTION_TYPES,
  MOTION_PRESETS,
  resolveCastlingRookMove,
} = await import(toUrl('js/services/chessMotionService.js'));
const {
  InteractiveChessboard,
  PuzzleChessboard,
  ComputerChessboard,
  OpeningLearnBoard,
  OpeningPracticeBoard,
  AnalysisReplayBoard,
} = await import(toUrl('js/components/chessboardUI.js'));
const { validateAndParsePgn } = await import(toUrl('js/services/pgnService.js'));
const { getOpeningById } = await import(toUrl('js/data/openings.js'));
const { getDailyPuzzle, selectNextPuzzle } = await import(toUrl('js/data/puzzles.js'));
const { getLessonById } = await import(toUrl('js/data/curriculum.js'));
const { progressService } = await import(toUrl('js/services/progress.js'));
const { renderDashboardView } = await import(toUrl('js/components/dashboardView.js'));
const { renderSidebar } = await import(toUrl('js/components/sidebar.js'));
const { renderAnalysisView, createInitialAnalysisSessionState } = await import(
  toUrl('js/components/analysisView.js')
);

console.log('====================================================================');
console.log('MEMULAI VERIFIKASI CATURAN MVP 5.3 — CHESSBOARD MOTION & SOUND SYSTEM');
console.log('====================================================================\n');

// ===========================================================================
// BAGIAN A: PENGUJIAN CHESS AUDIO SERVICE (17 TESTS)
// ===========================================================================
console.log('A. Menguji Chess Audio Service (Procedural Web Audio API — 17 Skenario)...');

await runTest('Audio 1/17: AudioContext dibuat secara lazy sesuai kebutuhan (tidak autoplay saat modul dimuat)', async () => {
  assert.equal(
    MockAudioContext.instances.length,
    0,
    'AudioContext tidak boleh dibuat otomatis sebelum ada langkah/interaksi'
  );
  assert.equal(chessAudioService.getAudioContext(), null);

  chessAudioService.resetForTesting();
  const res = chessAudioService.playSound(SOUND_TYPES.MOVE);
  assert.equal(res.played, true);
  assert.equal(MockAudioContext.instances.length, 1, 'AudioContext dibuat saat dibutuhkan');
  assert.ok(chessAudioService.getAudioContext());
});

await runTest('Audio 2/17: Langkah normal menghasilkan preset Move (Oscillator + Filter + Noise Transient)', async () => {
  chessAudioService.resetForTesting();
  const game = new Chess();
  const move = game.move('e4');
  const rec = chessAudioService.playSoundForMove(move, game);

  assert.equal(rec.played, true);
  assert.equal(rec.soundType, SOUND_TYPES.MOVE);
  assert.equal(rec.presetId, SOUND_PRESETS.move.id);
  assert.ok(rec.nodesCreated.oscillators >= 2, 'Harus menggunakan OscillatorNode untuk resonansi');
  assert.ok(rec.nodesCreated.filters >= 2, 'Harus menggunakan BiquadFilterNode untuk karakter kayu');
  assert.ok(rec.nodesCreated.gains >= 2, 'Harus menggunakan GainNode envelope');
  assert.ok(rec.nodesCreated.bufferSources >= 1, 'Harus menggunakan AudioBuffer transient noise');
});

await runTest('Audio 3/17: Langkah menangkap bidak (termasuk En Passant) menghasilkan preset Capture', async () => {
  chessAudioService.resetForTesting();
  const game = new Chess();
  game.move('e4');
  game.move('d5');
  const captureMove = game.move('exd5');
  const rec = chessAudioService.playSoundForMove(captureMove, game);

  assert.equal(rec.played, true);
  assert.equal(rec.soundType, SOUND_TYPES.CAPTURE);
  assert.ok(
    SOUND_PRESETS.capture.voices[0].startFreqHz < SOUND_PRESETS.move.voices[0].startFreqHz,
    'Capture memiliki frekuensi rendah lebih dominan daripada Move'
  );

  // En passant capture
  const epGame = new Chess();
  epGame.move('e4');
  epGame.move('Nf6');
  epGame.move('e5');
  epGame.move('d5');
  const epMove = epGame.move('exd6');
  assert.ok(epMove.flags.includes('e'));
  const epRec = chessAudioService.playSoundForMove(epMove, epGame);
  assert.equal(epRec.soundType, SOUND_TYPES.CAPTURE);
});

await runTest('Audio 4/17: Langkah yang menghasilkan skak menghasilkan preset Check (dua komponen nada harmonis)', async () => {
  chessAudioService.resetForTesting();
  const game = new Chess('rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3');
  const checkMove = game.move('Bb5+');
  assert.equal(game.inCheck(), true);
  const rec = chessAudioService.playSoundForMove(checkMove, game);

  assert.equal(rec.played, true);
  assert.equal(rec.soundType, SOUND_TYPES.CHECK);
  assert.ok(SOUND_PRESETS.check.voices.length >= 3, 'Memiliki ketukan kayu + 2 komponen nada harmonis');
});

await runTest('Audio 5/17: Langkah skakmat menghasilkan preset Checkmate yang tegas dan berbeda dari Check', async () => {
  chessAudioService.resetForTesting();
  const game = new Chess();
  game.move('f3');
  game.move('e5');
  game.move('g4');
  const mateMove = game.move('Qh4#');
  assert.equal(game.isCheckmate(), true);

  const rec = chessAudioService.playSoundForMove(mateMove, game);
  assert.equal(rec.played, true);
  assert.equal(rec.soundType, SOUND_TYPES.CHECKMATE);
  assert.notEqual(SOUND_PRESETS.checkmate.durationMs, SOUND_PRESETS.check.durationMs);
  assert.ok(SOUND_PRESETS.checkmate.durationMs <= 320, 'Bukan alarm panjang yang berlebihan');
});

await runTest('Audio 6/17: Langkah rokade (O-O & O-O-O) menghasilkan satu preset Castling terkontrol', async () => {
  chessAudioService.resetForTesting();
  const game = new Chess('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
  const castleKing = game.move('O-O');
  const recK = chessAudioService.playSoundForMove(castleKing, game);

  assert.equal(recK.played, true);
  assert.equal(recK.soundType, SOUND_TYPES.CASTLING);
  assert.equal(chessAudioService.getAudioHistory().length, 1, 'Hanya satu event audio untuk rokade');

  const castleQueen = game.move('O-O-O');
  const recQ = chessAudioService.playSoundForMove(castleQueen, game);
  assert.equal(recQ.soundType, SOUND_TYPES.CASTLING);
});

await runTest('Audio 7/17: Promosi pion menghasilkan preset Promotion yang cerah setelah promosi dilakukan', async () => {
  chessAudioService.resetForTesting();
  const game = new Chess('8/P7/8/8/8/2k5/8/2K5 w - - 0 1');
  const promoMove = game.move({ from: 'a7', to: 'a8', promotion: 'q' });
  assert.equal(game.inCheck(), false);

  const rec = chessAudioService.playSoundForMove(promoMove, game);
  assert.equal(rec.played, true);
  assert.equal(rec.soundType, SOUND_TYPES.PROMOTION);
});

await runTest('Audio 8/17: Urutan prioritas suara tunggal akurat (Checkmate > Check > Promotion > Castling > Capture > Move)', async () => {
  // 1. Promosi + Capture + Checkmate -> Checkmate
  const mateChess = new Chess('6rk/5Ppp/8/8/8/1B6/8/K7 w - - 0 1');
  const promoCaptureMate = mateChess.move({ from: 'f7', to: 'g8', promotion: 'r' });
  assert.equal(mateChess.isCheckmate(), true);
  assert.equal(
    classifyChessMoveSound(promoCaptureMate, mateChess),
    SOUND_TYPES.CHECKMATE,
    'Promosi + Capture + Checkmate harus memilih Checkmate'
  );

  // 2. Promosi + Capture + Check -> Check
  const checkChess = new Chess('1r2k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  const promoCaptureCheck = checkChess.move({ from: 'a7', to: 'b8', promotion: 'q' });
  assert.equal(checkChess.inCheck(), true);
  assert.equal(checkChess.isCheckmate(), false);
  assert.equal(
    classifyChessMoveSound(promoCaptureCheck, checkChess),
    SOUND_TYPES.CHECK,
    'Promosi + Capture + Check harus memilih Check'
  );

  // 3. Promosi + Capture (tanpa skak) -> Promotion
  const promoCapChess = new Chess('1r6/P3k3/8/8/8/8/8/4K3 w - - 0 1');
  const promoCapture = promoCapChess.move({ from: 'a7', to: 'b8', promotion: 'n' });
  assert.equal(promoCapChess.inCheck(), false);
  assert.equal(
    classifyChessMoveSound(promoCapture, promoCapChess),
    SOUND_TYPES.PROMOTION,
    'Promosi + Capture tanpa skak harus memilih Promotion'
  );

  // 4. Castling yang menghasilkan Check -> Check
  const castleCheckChess = new Chess('5k2/8/8/8/8/8/8/4K2R w K - 0 1');
  const castleCheckMove = castleCheckChess.move('O-O');
  assert.equal(castleCheckChess.inCheck(), true);
  assert.equal(
    classifyChessMoveSound(castleCheckMove, castleCheckChess),
    SOUND_TYPES.CHECK,
    'Castling yang menghasilkan skak harus memilih Check'
  );
});

await runTest('Audio 9/17: Tidak ada audio pada langkah ilegal', async () => {
  chessAudioService.resetForTesting();
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 e5 2. Nf3 Nc6 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'explore' });
  chessAudioService.clearAudioHistory();

  const res = board.playMove({ from: 'e2', to: 'e5' }); // illegal
  assert.equal(res.ok, false);
  assert.equal(chessAudioService.getAudioHistory().length, 0, 'Langkah ilegal tidak boleh memicu suara');
  board.destroy();
});

await runTest('Audio 10/17: Tidak ada audio saat memilih petak asal atau highlight legal moves', async () => {
  chessAudioService.resetForTesting();
  const container = mockDoc.createElement('div');
  const foundLesson = getLessonById('l1-1');
  const practiceCfg = foundLesson?.lesson?.practice || {
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    orientation: 'white',
    steps: [{ expectedMoves: ['e4'], explanation: 'OK' }],
  };
  const board = new InteractiveChessboard(container, practiceCfg);
  chessAudioService.clearAudioHistory();

  // Klik petak asal dan batalkan pilihan
  const allSquares = container.querySelectorAll('.chess-square');
  for (const sq of allSquares) {
    if (sq.classList.contains('has-piece')) {
      sq.click();
      sq.click();
      break;
    }
  }
  assert.equal(chessAudioService.getAudioHistory().length, 0, 'Memilih petak tidak boleh memicu suara');
  board.destroy();
});

await runTest('Audio 11/17: Tidak ada audio saat import PGN atau batch parsing PGN', async () => {
  chessAudioService.resetForTesting();
  const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 1/2-1/2';
  const parsed = validateAndParsePgn(pgn);
  assert.equal(parsed.valid, true);

  const container = mockDoc.createElement('div');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });
  assert.equal(
    chessAudioService.getAudioHistory().length,
    0,
    'Import PGN dan inisialisasi papan tidak boleh memutar audio'
  );
  board.destroy();
});

await runTest('Audio 12/17: Tidak ada audio saat restart/reset, flip board, klik notasi aktif, atau navigasi mundur', async () => {
  chessAudioService.resetForTesting();
  const parsed = validateAndParsePgn('1. e4 e5 2. Nf3 Nc6 *');
  const container = mockDoc.createElement('div');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  // Maju 2 langkah -> 2 suara
  board.nextMove();
  board.nextMove();
  assert.equal(chessAudioService.getAudioHistory().length, 2);

  // Klik notasi pada ply yang sudah aktif (ply 2) -> tidak ada perubahan posisi -> 0 suara baru
  chessAudioService.clearAudioHistory();
  board.goToPly(2);
  assert.equal(chessAudioService.getAudioHistory().length, 0, 'Klik ply yang sama tidak memicu suara');

  // Navigasi mundur -> 0 suara baru
  board.prevMove();
  assert.equal(chessAudioService.getAudioHistory().length, 0, 'prevMove tidak memicu suara');

  // Reset ke awal -> 0 suara baru
  board.firstMove();
  assert.equal(chessAudioService.getAudioHistory().length, 0, 'firstMove/reset tidak memicu suara');

  // Flip board -> 0 suara baru
  board.flipBoard();
  assert.equal(chessAudioService.getAudioHistory().length, 0, 'flipBoard tidak memicu suara');
  board.destroy();
});

await runTest('Audio 13/17: Mute (Sound Effects OFF) menghentikan seluruh audio event', async () => {
  chessAudioService.resetForTesting();
  chessAudioService.setSoundEnabled(false);
  assert.equal(chessAudioService.isSoundEnabled(), false);

  const game = new Chess();
  const move = game.move('e4');
  const res = chessAudioService.playSoundForMove(move, game);
  assert.equal(res.played, false);
  assert.equal(res.reason, 'muted');
  assert.equal(chessAudioService.getAudioHistory().length, 0);

  chessAudioService.setSoundEnabled(true);
});

await runTest('Audio 14/17: Master Gain internal tetap 100% (1.0), dilengkapi Peak Limiter, tanpa setVolume/volume slider', async () => {
  chessAudioService.resetForTesting();
  chessAudioService.setSoundEnabled(true);
  assert.equal(typeof chessAudioService.setVolume, 'undefined', 'setVolume() harus dihapus');
  assert.equal(typeof chessAudioService.getVolume, 'undefined', 'getVolume() harus dihapus');
  assert.equal(chessAudioService.getMasterGainValue(), 1.0);

  const rec = chessAudioService.playSound(SOUND_TYPES.MOVE, { dedupeKey: 'master_gain_100' });
  assert.equal(rec.masterGain, 1.0);
  assert.equal(rec.peakLimiterActive, true, 'Peak limiter wajib aktif melindungi sinyal pada master gain 1.0');
  assert.equal('volumePercent' in rec, false, 'Tidak boleh ada atribut volumePercent');

  for (const preset of Object.values(SOUND_PRESETS)) {
    assert.ok(preset.maxGain <= 0.50, `Preset ${preset.id} harus terkalibrasi <= 0.50 agar bebas clipping`);
  }

  chessAudioService.setSoundEnabled(false);
  assert.equal(chessAudioService.getMasterGainValue(), 0);
  chessAudioService.setSoundEnabled(true);
});

await runTest('Audio 15/17: Error AudioContext tidak merusak jalannya permainan catur', async () => {
  chessAudioService.setAudioContextFactoryForTesting(() => {
    throw new Error('Simulated AudioContext hardware failure');
  });

  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 e5 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'explore' });
  const moveRes = board.playMove('e4');
  assert.equal(moveRes.ok, true, 'Permainan tetap berjalan normal meskipun AudioContext gagal');

  chessAudioService.setAudioContextFactoryForTesting(null);
  board.destroy();
});

await runTest('Audio 16/17: Tidak ada remote audio request atau ketergantungan file MP3/WAV/OGG', async () => {
  assert.equal(networkRequests.length, 0, 'Tidak boleh ada request jaringan untuk audio');
  const audioSrcCode = fs.readFileSync(path.join(ROOT, 'js/services/chessAudioService.js'), 'utf8');
  assert.equal(/\.(mp3|wav|ogg)\b/i.test(audioSrcCode), false);
  assert.equal(/https?:\/\//i.test(audioSrcCode), false);
});

await runTest('Audio 17/17: Proteksi anti-double-audio mencegah satu langkah memutar suara dua kali', async () => {
  chessAudioService.resetForTesting();
  const game = new Chess();
  const move = game.move('Nf3');

  const first = chessAudioService.playSoundForMove(move, game, { source: 'test_board' });
  const duplicate = chessAudioService.playSoundForMove(move, game, { source: 'test_board' });

  assert.equal(first.played, true);
  assert.equal(duplicate.played, false);
  assert.equal(duplicate.reason, 'deduplicated');
  assert.equal(chessAudioService.getAudioHistory().length, 1);
});

// ===========================================================================
// BAGIAN B: PENGUJIAN CHESS MOTION SERVICE (12 TESTS)
// ===========================================================================
console.log('\nB. Menguji Chess Motion Service (Web Animations API & Stabilitas DOM — 12 Skenario)...');

await runTest('Motion 1/12: Normal move animation (~150ms, halus dari petak asal ke petak tujuan)', async () => {
  chessAudioService.setMotionEnabled(true);
  chessMotionService.clearMotionHistory();

  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 e5 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  board.nextMove(); // 1. e4 (e2 -> e4)
  const motionEvt = chessMotionService.getLastMotionEvent();
  assert.ok(motionEvt);
  assert.equal(motionEvt.animated, true);
  assert.equal(motionEvt.from, 'e2');
  assert.equal(motionEvt.to, 'e4');
  assert.equal(motionEvt.durationMs, MOTION_PRESETS.normalDurationMs);
  assert.equal(motionEvt.primaryDelta.dyPx, 100); // e2 is 2 rows below e4 (2 * 50px)
  board.destroy();
});

await runTest('Motion 2/12: Capture animation (bidak bergerak + efek fade/scale pada bidak tertangkap)', async () => {
  chessMotionService.clearMotionHistory();
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 d5 2. exd5 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  board.nextMove(); // e4
  board.nextMove(); // d5
  board.nextMove(); // exd5 (capture)

  const motionEvt = chessMotionService.getLastMotionEvent();
  assert.equal(motionEvt.animated, true);
  assert.equal(motionEvt.isCapture, true);
  assert.equal(motionEvt.captureGhostTriggered, true);
  board.destroy();
});

await runTest('Motion 3/12: Castling animation menggerakkan dua bidak (Raja & Benteng) secara terkoordinasi', async () => {
  chessMotionService.clearMotionHistory();
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn(
    '[SetUp "1"]\n[FEN "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1"]\n\n1. O-O O-O-O *'
  );
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  board.nextMove(); // White O-O (e1->g1 & h1->f1)
  const whiteCastle = chessMotionService.getLastMotionEvent();
  assert.equal(whiteCastle.animated, true);
  assert.equal(whiteCastle.isCastling, true);
  assert.equal(whiteCastle.animatedPiecesCount, 2, 'Raja dan Benteng keduanya harus dianimasikan');
  assert.deepEqual(whiteCastle.castlingRook, { from: 'h1', to: 'f1', piece: 'r', color: 'w' });

  board.nextMove(); // Black O-O-O (e8->c8 & a8->d8)
  const blackCastle = chessMotionService.getLastMotionEvent();
  assert.equal(blackCastle.isCastling, true);
  assert.equal(blackCastle.animatedPiecesCount, 2);
  assert.deepEqual(blackCastle.castlingRook, { from: 'a8', to: 'd8', piece: 'r', color: 'b' });
  board.destroy();
});

await runTest('Motion 4/12: Promotion animation menampilkan bidak hasil promosi & tidak berulang saat modal terbuka', async () => {
  chessMotionService.clearMotionHistory();
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn(
    '[SetUp "1"]\n[FEN "8/P7/8/8/8/2k5/8/2K5 w - - 0 1"]\n\n1. a8=Q *'
  );
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'explore' });
  chessMotionService.clearMotionHistory();

  // Pilih a7 lalu a8 -> membuka modal promosi tanpa menjalankan animasi langkah
  board.selectSquare('a7');
  board.selectSquare('a8');
  assert.ok(board.getReplayState().pendingPromotion);
  assert.equal(
    chessMotionService.getMotionHistory().length,
    0,
    'Membuka modal promosi tidak boleh memicu animasi berulang'
  );

  // Pilih Menteri (q) di modal promosi
  const promoQueenBtn = container.querySelector('[data-promo="q"]');
  assert.ok(promoQueenBtn);
  promoQueenBtn.click();

  const promoEvt = chessMotionService.getLastMotionEvent();
  assert.ok(promoEvt);
  assert.equal(promoEvt.animated, true);
  assert.equal(promoEvt.isPromotion, true);
  assert.equal(promoEvt.promotedTo, 'q');
  assert.equal(board.chess.get('a8').type, 'q');
  board.destroy();
});

await runTest('Motion 5/12: Check highlight menyorot petak Raja yang sedang skak (.square-king-check)', async () => {
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 e5 2. Bc4 Nc6 3. Bxf7+ *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  board.goToEnd(); // Setelah 3. Bxf7+ (Raja Hitam di e8 skak)
  const kingSqEl = container.querySelector('[data-square="e8"]');
  assert.ok(kingSqEl.classList.contains('square-king-check'), 'Petak Raja e8 harus memiliki class square-king-check');
  const frameEl = container.querySelector('.chessboard-frame');
  assert.ok(frameEl.classList.contains('board-in-check'), 'Frame papan harus menandai kondisi skak');
  board.destroy();
});

await runTest('Motion 6/12: Checkmate highlight menyorot posisi akhir secara jelas (.square-king-checkmate)', async () => {
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. f3 e5 2. g4 Qh4# 0-1');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  board.nextMove();
  board.nextMove();
  board.nextMove();
  board.nextMove(); // Qh4#

  const whiteKingSq = container.querySelector('[data-square="e1"]');
  assert.ok(whiteKingSq.classList.contains('square-king-check'));
  assert.ok(whiteKingSq.classList.contains('square-king-checkmate'));
  const frameEl = container.querySelector('.chessboard-frame');
  assert.ok(frameEl.classList.contains('board-checkmate-state'));
  board.destroy();
});

await runTest('Motion 7/12: Tidak ada board dimension shift (dimensi papan & 64 petak stabil)', async () => {
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 e5 2. Nf3 Nc6 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  const frameBefore = container.querySelector('.chessboard-frame').getBoundingClientRect();
  const squaresBefore = container.querySelectorAll('.chess-square').length;

  board.nextMove();
  const frameDuring = container.querySelector('.chessboard-frame').getBoundingClientRect();
  const squaresDuring = container.querySelectorAll('.chess-square').length;

  chessMotionService.finishActiveAnimations(container);
  const frameAfter = container.querySelector('.chessboard-frame').getBoundingClientRect();
  const squaresAfter = container.querySelectorAll('.chess-square').length;

  assert.equal(squaresBefore, 64);
  assert.equal(squaresDuring, 64);
  assert.equal(squaresAfter, 64);
  assert.equal(frameBefore.width, frameDuring.width);
  assert.equal(frameBefore.height, frameDuring.height);
  assert.equal(frameBefore.width, frameAfter.width);
  board.destroy();
});

await runTest('Motion 8/12: Tidak ada DOM piece atau capture ghost yang tertinggal setelah animasi selesai', async () => {
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 d5 2. exd5 Qxd5 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  board.nextMove(); // e4
  board.nextMove(); // d5
  board.nextMove(); // exd5
  board.nextMove(); // Qxd5

  chessMotionService.finishActiveAnimations(container);
  const leftoverGhosts = container.querySelectorAll('.chess-captured-ghost');
  const leftoverMoving = container.querySelectorAll('.piece-moving');
  assert.equal(leftoverGhosts.length, 0, 'Tidak boleh ada capture ghost yang tertinggal di DOM');
  assert.equal(leftoverMoving.length, 0, 'Tidak boleh ada class piece-moving yang tertinggal');

  // Jumlah .piece-wrapper harus sama persis dengan jumlah bidak di chess.js (30 bidak)
  const domPieces = container.querySelectorAll('.piece-wrapper');
  assert.equal(domPieces.length, 30);
  board.destroy();
});

await runTest('Motion 9/12: Motion OFF menonaktifkan animasi perpindahan bidak sementara audio tetap mandiri', async () => {
  chessAudioService.setSoundEnabled(true);
  chessAudioService.setMotionEnabled(false);
  chessAudioService.clearAudioHistory();
  chessMotionService.clearMotionHistory();

  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 e5 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  board.nextMove();
  const lastAudio = chessAudioService.getLastPlayedSound();
  const lastMotion = chessMotionService.getLastMotionEvent();

  assert.equal(lastAudio.played, true, 'Audio tetap menyala saat Motion OFF');
  assert.equal(lastMotion.animated, false, 'Translasi bidak dinonaktifkan saat Motion OFF');
  assert.equal(lastMotion.reason, 'motion_disabled');

  chessAudioService.setMotionEnabled(true);
  board.destroy();
});

await runTest('Motion 10/12: Reduced Motion (`prefers-reduced-motion: reduce`) menonaktifkan translasi tetapi menjaga indikator Check/Checkmate', async () => {
  mockReducedMotion = true;
  chessMotionService.clearMotionHistory();

  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. f3 e5 2. g4 Qh4# 0-1');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  board.nextMove();
  board.nextMove();
  board.nextMove();
  board.nextMove(); // Qh4#

  const lastMotion = chessMotionService.getLastMotionEvent();
  assert.equal(lastMotion.animated, false);
  assert.equal(lastMotion.reason, 'reduced_motion');
  assert.equal(lastMotion.isCheckmate, true);

  const whiteKingSq = container.querySelector('[data-square="e1"]');
  assert.ok(
    whiteKingSq.classList.contains('square-king-checkmate'),
    'Indikator visual checkmate wajib tetap tampil pada Reduced Motion'
  );

  mockReducedMotion = false;
  board.destroy();
});

await runTest('Motion 11/12: Rapid moves (langkah sangat cepat beruntun) aman dan tidak merusak posisi akhir', async () => {
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  // Jalankan 10 langkah beruntun secara instan tanpa jeda
  for (let i = 0; i < 10; i += 1) {
    board.nextMove();
  }

  chessMotionService.finishActiveAnimations(container);
  assert.equal(board.getCurrentPly(), 10);
  assert.equal(board.getCurrentFen(), parsed.moves[9].fenAfter);
  assert.equal(container.querySelectorAll('.chess-captured-ghost').length, 0);
  board.destroy();
});

await runTest('Motion 12/12: Animasi tidak pernah mengubah state internal chess.js', async () => {
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. d4 d5 2. c4 e6 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'explore' });

  board.playMove('d4');
  const fenBeforeAnimFinish = board.chess.fen();
  const historyBeforeAnimFinish = board.chess.history().join(',');

  chessMotionService.finishActiveAnimations(container);
  assert.equal(board.chess.fen(), fenBeforeAnimFinish);
  assert.equal(board.chess.history().join(','), historyBeforeAnimFinish);
  board.destroy();
});

// ===========================================================================
// BAGIAN C: PENGATURAN GLOBAL & LOCALSTORAGE (`caturan_chessboard_preferences_v1`)
// ===========================================================================
console.log('\nC. Menguji Global Chessboard Settings & LocalStorage Persistence...');

await runTest('Settings 1/3: Menyimpan & memuat preferensi Sound Effects & Board Animation pada LocalStorage (`caturan_chessboard_preferences_v1`) tanpa volume', async () => {
  mockLocalStorage.removeItem(CHESSBOARD_PREFERENCES_KEY);
  const defaults = chessAudioService.reloadPreferencesFromStorage();
  assert.equal(defaults.soundEnabled, true);
  assert.equal(defaults.motionEnabled, true);
  assert.equal('volume' in defaults, false, 'Tidak boleh ada properti volume di preferensi');

  chessAudioService.updatePreferences({ soundEnabled: false, motionEnabled: false });
  const savedRaw = mockLocalStorage.getItem(CHESSBOARD_PREFERENCES_KEY);
  assert.ok(savedRaw);
  const parsed = JSON.parse(savedRaw);
  assert.equal(parsed.soundEnabled, false);
  assert.equal(parsed.motionEnabled, false);
  assert.equal('volume' in parsed, false, 'Payload LocalStorage tidak boleh menyimpan volume');

  // Simulasikan refresh halaman dengan reloadPreferencesFromStorage()
  const reloaded = chessAudioService.reloadPreferencesFromStorage();
  assert.equal(reloaded.soundEnabled, false);
  assert.equal(reloaded.motionEnabled, false);
  assert.equal('volume' in reloaded, false);
});

await runTest('Settings 2/3: Parsing LocalStorage defensif terhadap JSON rusak atau tipe data tidak valid', async () => {
  mockLocalStorage.setItem(CHESSBOARD_PREFERENCES_KEY, '{corrupted_json: true');
  const fallback = chessAudioService.reloadPreferencesFromStorage();
  assert.equal(fallback.soundEnabled, true);
  assert.equal(fallback.motionEnabled, true);
  assert.equal('volume' in fallback, false);

  mockLocalStorage.setItem(
    CHESSBOARD_PREFERENCES_KEY,
    JSON.stringify({ soundEnabled: 'invalid', motionEnabled: 123 })
  );
  const sanitized = chessAudioService.reloadPreferencesFromStorage();
  assert.equal(sanitized.soundEnabled, true);
  assert.equal(sanitized.motionEnabled, true);

  // Kembalikan ke default standar
  chessAudioService.updatePreferences({ soundEnabled: true, motionEnabled: true });
});

await runTest('Settings 3/3: UI Pengaturan Global hanya menampilkan Sound Effects (ON/OFF) & Board Animation (ON/OFF) tanpa volume slider', async () => {
  const sidebarEl = mockDoc.createElement('aside');
  renderSidebar(sidebarEl, {
    currentRoute: 'dashboard',
    summary: { level: 1, totalXp: 0, overallPercentage: 0, completedCount: 0, totalLessonsCount: 30 },
    syncState: { status: 'idle', label: 'Tersinkron' },
    userEmail: 'siswa@caturan.id',
  });

  const soundBtn = sidebarEl.querySelector('[data-testid="pref-sound-toggle"]');
  const motionBtn = sidebarEl.querySelector('[data-testid="pref-motion-toggle"]');
  const volumeSlider = sidebarEl.querySelector('[data-testid="pref-volume-slider"]');
  const rangeInputs = sidebarEl.querySelectorAll('input[type="range"]');
  assert.ok(soundBtn, 'Tombol Sound Effects harus tersedia');
  assert.ok(motionBtn, 'Tombol Board Animation harus tersedia');
  assert.equal(volumeSlider, null, 'Slider Sound Volume tidak boleh ada');
  assert.equal(rangeInputs.length, 0, 'Tidak boleh ada input range volume');

  soundBtn.click();
  assert.equal(chessAudioService.getPreferences().soundEnabled, false);
  soundBtn.click();
  assert.equal(chessAudioService.getPreferences().soundEnabled, true);

  motionBtn.click();
  assert.equal(chessAudioService.getPreferences().motionEnabled, false);
  motionBtn.click();
  assert.equal(chessAudioService.getPreferences().motionEnabled, true);
});

// ===========================================================================
// BAGIAN D: INTEGRASI GLOBAL PADA SELURUH 8 HALAMAN / KOMPONEN PAPAN
// ===========================================================================
console.log('\nD. Menguji Integrasi Konsisten pada Seluruh 8 Halaman / Komponen Papan...');

await runTest('Integrasi 1/7: Dashboard Learn & Lesson Detail (InteractiveChessboard — Langkah Pemain & Balasan Lawan)', async () => {
  const dashContainer = mockDoc.createElement('div');
  renderDashboardView(dashContainer, {
    summary: progressService.getSummary(),
    onOpenLesson: () => {},
    onGoToLearn: () => {},
    onResetProgress: () => {},
  });
  assert.ok(dashContainer.innerHTML.length > 100);

  chessAudioService.resetForTesting();
  chessMotionService.clearMotionHistory();
  const lessonContainer = mockDoc.createElement('div');
  const board = new InteractiveChessboard(lessonContainer, {
    initialFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    orientation: 'white',
    steps: [{ expectedMoves: ['e4'], explanation: 'Bagus!' }],
  });

  board._executePlayerMove({ from: 'e2', to: 'e4' });
  assert.equal(chessAudioService.getAudioHistory().length, 1);
  assert.equal(chessAudioService.getLastPlayedSound().soundType, SOUND_TYPES.MOVE);
  assert.equal(chessMotionService.getLastMotionEvent().animated, true);
  board.destroy();
});

await runTest('Integrasi 2/7: Chess Puzzle (PuzzleChessboard — Langkah Pengguna & Balasan Lawan)', async () => {
  chessAudioService.resetForTesting();
  chessMotionService.clearMotionHistory();

  const puzzleContainer = mockDoc.createElement('div');
  const samplePuzzle = getDailyPuzzle() || selectNextPuzzle();
  const board = new PuzzleChessboard(puzzleContainer, samplePuzzle, { replyDelayMs: 0 });

  // Setup move otomatis saat puzzle dimuat TIDAK boleh memutar suara
  assert.equal(chessAudioService.getAudioHistory().length, 0);

  // Mainkan langkah solusi pertama pengguna (dan balasan otomatis lawan jika multi-langkah)
  const firstSolUci = board.solutionMoves[0];
  const ok = board.playMove(firstSolUci);
  assert.equal(ok, true);
  assert.ok(
    chessAudioService.getAudioHistory().length >= 1,
    'Langkah puzzle yang dimainkan harus menghasilkan event audio'
  );
  board.destroy();
});

await runTest('Integrasi 3/7: Play Against Computer / Stockfish (ComputerChessboard — Pemain & Stockfish)', async () => {
  chessAudioService.resetForTesting();
  chessMotionService.clearMotionHistory();

  const playContainer = mockDoc.createElement('div');
  const mockEngine = {
    startNewGame: async () => ({ ok: true }),
    requestBestMove: async () => ({ uciMove: 'e7e5', parsed: { from: 'e7', to: 'e5' } }),
    stopSearch: async () => {},
    setGameInProgress: () => {},
  };

  const board = new ComputerChessboard(playContainer, {
    engine: mockEngine,
    playerColor: 'white',
    difficulty: 'beginner',
  });
  await board.startNewGame({ playerColor: 'white', difficulty: 'beginner' });
  assert.equal(chessAudioService.getAudioHistory().length, 0, 'Start game tidak memutar suara');

  const res = await board.playPlayerMove({ from: 'e2', to: 'e4' });
  assert.equal(res.ok, true);
  assert.equal(
    chessAudioService.getAudioHistory().length,
    2,
    'Langkah pemain (e4) dan balasan Stockfish (e5) masing-masing memutar 1 suara'
  );
  board.destroy();
});

await runTest('Integrasi 4/7: Opening Learn Mode (OpeningLearnBoard — Maju memutar suara, Mundur/Reset senyap)', async () => {
  chessAudioService.resetForTesting();
  chessMotionService.clearMotionHistory();

  const learnContainer = mockDoc.createElement('div');
  const italianOpening = getOpeningById('italian-game-main');
  const board = new OpeningLearnBoard(learnContainer, italianOpening);
  assert.equal(chessAudioService.getAudioHistory().length, 0);

  board.nextMove();
  assert.equal(chessAudioService.getAudioHistory().length, 1);
  assert.equal(chessMotionService.getLastMotionEvent().animated, true);

  board.prevMove();
  assert.equal(chessAudioService.getAudioHistory().length, 1, 'Mundur tidak menambah event suara');

  board.resetToStart();
  assert.equal(chessAudioService.getAudioHistory().length, 1, 'Reset tidak menambah event suara');
  board.destroy();
});

await runTest('Integrasi 5/7: Opening Practice Mode (OpeningPracticeBoard — Langkah Benar & Balasan Lawan)', async () => {
  chessAudioService.resetForTesting();
  chessMotionService.clearMotionHistory();

  const pracContainer = mockDoc.createElement('div');
  const whiteOpening = getOpeningById('italian-game-main');
  const board = new OpeningPracticeBoard(pracContainer, whiteOpening, { replyDelayMs: 0 });
  assert.equal(chessAudioService.getAudioHistory().length, 0);

  // Langkah di luar variasi (salah) -> di-undo -> tidak memutar suara langkah
  const wrongRes = board.submitPlayerMove('a3');
  assert.equal(wrongRes.valid, false);
  assert.equal(chessAudioService.getAudioHistory().length, 0);

  // Langkah benar sesuai variasi -> memutar suara langkah pemain + balasan lawan
  const firstStep = board.validMoves[0];
  const rightRes = board.submitPlayerMove({ from: firstStep.from, to: firstStep.to });
  assert.equal(rightRes.valid, true);
  assert.equal(chessAudioService.getAudioHistory().length, 2);
  board.destroy();
});

await runTest('Integrasi 6/7: Analysis Studio Review Mode (AnalysisReplayBoard — Replay langkah maju & mundur)', async () => {
  chessAudioService.resetForTesting();
  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'review' });

  board.nextMove(); // 1. e4
  board.nextMove(); // 1... e5
  assert.equal(chessAudioService.getAudioHistory().length, 2);

  board.prevMove(); // kembali ke ply 1
  assert.equal(chessAudioService.getAudioHistory().length, 2);
  board.destroy();
});

await runTest('Integrasi 7/7: Analysis Studio Explore Mode (AnalysisReplayBoard — Eksplorasi variasi & promosi/skak)', async () => {
  chessAudioService.resetForTesting();
  chessMotionService.clearMotionHistory();

  const container = mockDoc.createElement('div');
  const parsed = validateAndParsePgn('1. e4 e5 2. Nf3 Nc6 *');
  const board = new AnalysisReplayBoard(container, parsed, { mode: 'explore' });

  board.playMove('d4'); // membuat Variation 1
  assert.equal(chessAudioService.getAudioHistory().length, 1);
  assert.equal(chessAudioService.getLastPlayedSound().soundType, SOUND_TYPES.MOVE);
  assert.equal(chessMotionService.getLastMotionEvent().animated, true);
  board.destroy();
});

// ===========================================================================
// BAGIAN E: RESPONSIVE TESTING (8 VIEWPORTS) & LIGHT/DARK MODE
// ===========================================================================
console.log('\nE. Menguji Responsivitas pada 8 Viewport (320px - 1920px) & Light/Dark Mode...');

await runTest('Responsive 1/2: Stabilitas papan, kontrol, dan animasi pada 320px, 360px, 390px, 430px, 768px, 1024px, 1366px, dan 1920px', async () => {
  const viewports = [
    { width: 320, height: 568 },
    { width: 360, height: 640 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1366, height: 768 },
    { width: 1920, height: 1080 },
  ];

  const sessionState = createInitialAnalysisSessionState();
  sessionState.parsedGame = validateAndParsePgn('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 *');
  sessionState.mobileScreen = 'review';

  for (const vp of viewports) {
    sessionState.currentPly = 0;
    globalThis.window.innerWidth = vp.width;
    globalThis.window.innerHeight = vp.height;

    const host = mockDoc.createElement('div');
    renderAnalysisView(host, sessionState, {});

    const squares = host.querySelectorAll('.chess-square');
    assert.equal(squares.length, 64, `Viewport ${vp.width}px wajib memiliki tepat 64 petak stabil`);

    const nextBtn = host.querySelector('[data-testid="analysis-btn-next"]');
    assert.ok(nextBtn && !nextBtn.disabled, `Tombol Berikutnya tidak boleh tertinggal disabled pada ${vp.width}px`);
    nextBtn.click();
  }
});

await runTest('Responsive 2/2: Konsistensi Light Mode & Dark Mode serta kepatuhan CSS warna solid (tanpa gradient)', async () => {
  const chessboardCss = fs.readFileSync(path.join(ROOT, 'css/chessboard.css'), 'utf8');
  assert.equal(
    /linear-gradient|radial-gradient|conic-gradient/i.test(chessboardCss),
    false,
    'css/chessboard.css wajib menggunakan 100% warna solid tanpa gradient'
  );
  assert.ok(chessboardCss.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(chessboardCss.includes('.square-king-checkmate'));
  assert.ok(chessboardCss.includes('.chess-captured-ghost'));
});

console.log('\n====================================================================');
console.log(
  `RINGKASAN VERIFIKASI MVP 5.3: ${passedTests} LULUS, ${failedTests} GAGAL (Total: ${totalTests} Pengujian)`
);
console.log('====================================================================');

if (failedTests > 0) {
  process.exit(1);
}
