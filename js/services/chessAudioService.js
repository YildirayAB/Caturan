/**
 * Caturan MVP 5.3 — Chess Audio Service (Procedural Web Audio API)
 *
 * Generates natural, wooden-like chess sounds 100% locally using the
 * JavaScript Web Audio API:
 * - AudioContext
 * - OscillatorNode
 * - GainNode
 * - BiquadFilterNode
 * - AudioBuffer (locally generated noise transient buffer)
 *
 * Zero external audio files (no MP3/WAV/OGG), zero network requests,
 * and zero cloud storage overhead.
 */

export const CHESSBOARD_PREFERENCES_KEY = 'caturan_chessboard_preferences_v1';

export const SOUND_TYPES = Object.freeze({
  MOVE: 'move',
  CAPTURE: 'capture',
  CHECK: 'check',
  CHECKMATE: 'checkmate',
  CASTLING: 'castling',
  PROMOTION: 'promotion',
});

export const DEFAULT_CHESSBOARD_PREFERENCES = Object.freeze({
  soundEnabled: true,
  motionEnabled: true,
  respectReducedMotion: true,
});

export const MASTER_GAIN_DEFAULT = 1.0;

/**
 * Separate, tunable procedural acoustic presets for each chess move type.
 * Calibrated for a fixed 100% (1.0) master gain with peak limiter protection
 * so sounds never clip, distort, or become harsh.
 * Combines wooden transient noise (bandpass/highpass filtered AudioBuffer)
 * with warm body/tonal resonators (OscillatorNode + BiquadFilterNode + GainNode envelopes).
 */
export const SOUND_PRESETS = Object.freeze({
  [SOUND_TYPES.MOVE]: Object.freeze({
    id: SOUND_TYPES.MOVE,
    label: 'Normal Move (Ketukan Kayu Natural)',
    durationMs: 75,
    maxGain: 0.36,
    transient: {
      durationSec: 0.018,
      filterType: 'bandpass',
      filterFreqHz: 1050,
      filterQ: 2.2,
      gain: 0.22,
      decaySec: 0.016,
    },
    voices: [
      {
        waveform: 'triangle',
        startFreqHz: 192,
        endFreqHz: 112,
        pitchSlideSec: 0.048,
        attackSec: 0.002,
        decaySec: 0.058,
        gain: 0.28,
        filterType: 'lowpass',
        filterFreqHz: 720,
        filterQ: 1.4,
        offsetSec: 0,
      },
      {
        waveform: 'sine',
        startFreqHz: 375,
        endFreqHz: 230,
        pitchSlideSec: 0.028,
        attackSec: 0.001,
        decaySec: 0.032,
        gain: 0.11,
        filterType: 'bandpass',
        filterFreqHz: 540,
        filterQ: 1.8,
        offsetSec: 0,
      },
    ],
  }),

  [SOUND_TYPES.CAPTURE]: Object.freeze({
    id: SOUND_TYPES.CAPTURE,
    label: 'Capture (Ketukan Tegas & Berat)',
    durationMs: 95,
    maxGain: 0.48,
    transient: {
      durationSec: 0.026,
      filterType: 'bandpass',
      filterFreqHz: 1280,
      filterQ: 1.6,
      gain: 0.32,
      decaySec: 0.024,
    },
    voices: [
      {
        waveform: 'triangle',
        startFreqHz: 148,
        endFreqHz: 74,
        pitchSlideSec: 0.068,
        attackSec: 0.002,
        decaySec: 0.082,
        gain: 0.38,
        filterType: 'lowpass',
        filterFreqHz: 560,
        filterQ: 1.8,
        offsetSec: 0,
      },
      {
        waveform: 'sine',
        startFreqHz: 310,
        endFreqHz: 132,
        pitchSlideSec: 0.042,
        attackSec: 0.001,
        decaySec: 0.048,
        gain: 0.18,
        filterType: 'lowpass',
        filterFreqHz: 880,
        filterQ: 1.3,
        offsetSec: 0,
      },
    ],
  }),

  [SOUND_TYPES.CASTLING]: Object.freeze({
    id: SOUND_TYPES.CASTLING,
    label: 'Castling (Ketukan Ganda Raja & Benteng Terkontrol)',
    durationMs: 145,
    maxGain: 0.38,
    transient: {
      durationSec: 0.022,
      filterType: 'bandpass',
      filterFreqHz: 1020,
      filterQ: 2.0,
      gain: 0.20,
      decaySec: 0.020,
      secondaryOffsetSec: 0.062,
      secondaryGain: 0.18,
    },
    voices: [
      // First tap: King placement
      {
        waveform: 'triangle',
        startFreqHz: 178,
        endFreqHz: 106,
        pitchSlideSec: 0.045,
        attackSec: 0.002,
        decaySec: 0.055,
        gain: 0.28,
        filterType: 'lowpass',
        filterFreqHz: 680,
        filterQ: 1.4,
        offsetSec: 0,
      },
      // Second tap: Rook placement (+62ms controlled sequence)
      {
        waveform: 'triangle',
        startFreqHz: 218,
        endFreqHz: 136,
        pitchSlideSec: 0.046,
        attackSec: 0.002,
        decaySec: 0.058,
        gain: 0.25,
        filterType: 'lowpass',
        filterFreqHz: 780,
        filterQ: 1.4,
        offsetSec: 0.062,
      },
    ],
  }),

  [SOUND_TYPES.PROMOTION]: Object.freeze({
    id: SOUND_TYPES.PROMOTION,
    label: 'Promotion (Ketukan Kayu & Resonansi Cerah)',
    durationMs: 185,
    maxGain: 0.40,
    transient: {
      durationSec: 0.020,
      filterType: 'bandpass',
      filterFreqHz: 1360,
      filterQ: 2.0,
      gain: 0.19,
      decaySec: 0.018,
    },
    voices: [
      {
        waveform: 'triangle',
        startFreqHz: 220,
        endFreqHz: 140,
        pitchSlideSec: 0.042,
        attackSec: 0.002,
        decaySec: 0.055,
        gain: 0.23,
        filterType: 'lowpass',
        filterFreqHz: 760,
        filterQ: 1.2,
        offsetSec: 0,
      },
      {
        waveform: 'triangle',
        startFreqHz: 392,
        endFreqHz: 392,
        pitchSlideSec: 0.08,
        attackSec: 0.004,
        decaySec: 0.11,
        gain: 0.18,
        filterType: 'lowpass',
        filterFreqHz: 1650,
        filterQ: 1.1,
        offsetSec: 0.012,
      },
      {
        waveform: 'sine',
        startFreqHz: 587.33,
        endFreqHz: 587.33,
        pitchSlideSec: 0.11,
        attackSec: 0.005,
        decaySec: 0.135,
        gain: 0.16,
        filterType: 'lowpass',
        filterFreqHz: 1950,
        filterQ: 1.0,
        offsetSec: 0.042,
      },
    ],
  }),

  [SOUND_TYPES.CHECK]: Object.freeze({
    id: SOUND_TYPES.CHECK,
    label: 'Check (Peringatan Harmonis Dua Nada)',
    durationMs: 175,
    maxGain: 0.42,
    transient: {
      durationSec: 0.020,
      filterType: 'bandpass',
      filterFreqHz: 1420,
      filterQ: 1.9,
      gain: 0.21,
      decaySec: 0.018,
    },
    voices: [
      // Wooden impact base
      {
        waveform: 'triangle',
        startFreqHz: 185,
        endFreqHz: 108,
        pitchSlideSec: 0.045,
        attackSec: 0.002,
        decaySec: 0.055,
        gain: 0.22,
        filterType: 'lowpass',
        filterFreqHz: 680,
        filterQ: 1.3,
        offsetSec: 0,
      },
      // Harmonious tone 1 (A4 = 440Hz)
      {
        waveform: 'triangle',
        startFreqHz: 440,
        endFreqHz: 436,
        pitchSlideSec: 0.12,
        attackSec: 0.004,
        decaySec: 0.145,
        gain: 0.20,
        filterType: 'lowpass',
        filterFreqHz: 1480,
        filterQ: 1.2,
        offsetSec: 0.005,
      },
      // Harmonious tone 2 (E5 = 659.25Hz, perfect fifth)
      {
        waveform: 'sine',
        startFreqHz: 659.25,
        endFreqHz: 654,
        pitchSlideSec: 0.13,
        attackSec: 0.006,
        decaySec: 0.155,
        gain: 0.15,
        filterType: 'lowpass',
        filterFreqHz: 1750,
        filterQ: 1.1,
        offsetSec: 0.018,
      },
    ],
  }),

  [SOUND_TYPES.CHECKMATE]: Object.freeze({
    id: SOUND_TYPES.CHECKMATE,
    label: 'Checkmate (Resolusi Tegas Tiga Komponen)',
    durationMs: 265,
    maxGain: 0.48,
    transient: {
      durationSec: 0.028,
      filterType: 'bandpass',
      filterFreqHz: 1320,
      filterQ: 1.6,
      gain: 0.28,
      decaySec: 0.025,
    },
    voices: [
      // Firm low wooden impact
      {
        waveform: 'triangle',
        startFreqHz: 138,
        endFreqHz: 68,
        pitchSlideSec: 0.075,
        attackSec: 0.002,
        decaySec: 0.092,
        gain: 0.34,
        filterType: 'lowpass',
        filterFreqHz: 520,
        filterQ: 1.6,
        offsetSec: 0,
      },
      // Resolved cadence root (G4 = 392Hz)
      {
        waveform: 'triangle',
        startFreqHz: 392,
        endFreqHz: 392,
        pitchSlideSec: 0.16,
        attackSec: 0.004,
        decaySec: 0.185,
        gain: 0.19,
        filterType: 'lowpass',
        filterFreqHz: 1520,
        filterQ: 1.2,
        offsetSec: 0.008,
      },
      // Resolved cadence fifth (D5 = 587.33Hz)
      {
        waveform: 'sine',
        startFreqHz: 587.33,
        endFreqHz: 587.33,
        pitchSlideSec: 0.18,
        attackSec: 0.005,
        decaySec: 0.195,
        gain: 0.16,
        filterType: 'lowpass',
        filterFreqHz: 1800,
        filterQ: 1.1,
        offsetSec: 0.042,
      },
      // Final octave resolution (G5 = 783.99Hz)
      {
        waveform: 'sine',
        startFreqHz: 783.99,
        endFreqHz: 780,
        pitchSlideSec: 0.17,
        attackSec: 0.006,
        decaySec: 0.18,
        gain: 0.14,
        filterType: 'lowpass',
        filterFreqHz: 2100,
        filterQ: 1.0,
        offsetSec: 0.082,
      },
    ],
  }),
});

const MIN_FREQ_HZ = 24;
const MAX_FREQ_HZ = 6000;
const MAX_MASTER_GAIN = 1.0;
const MAX_ACTIVE_VOICES = 6;
const DEDUPE_WINDOW_MS = 35;

function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

/**
 * Detects whether the OS/browser currently requests reduced motion.
 */
export function isReducedMotionPreferred() {
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
      return Boolean(mql && mql.matches);
    }
  } catch {
    // Ignore matchMedia errors in headless/older browsers
  }
  return false;
}

/**
 * Classify a chess move into a single primary sound type based strictly
 * on the actual chess.js move result and post-move game status.
 *
 * Priority Order:
 * 1. Checkmate
 * 2. Check
 * 3. Promotion
 * 4. Castling
 * 5. Capture
 * 6. Normal Move
 *
 * Never uses SAN string parsing or DOM inspection.
 *
 * @param {object|null} move - Move object returned by chess.js
 * @param {object|null} chessOrState - Chess instance or { inCheck, isCheckmate }
 * @returns {string|null} One of SOUND_TYPES or null if move is invalid
 */
export function classifyChessMoveSound(move, chessOrState = null) {
  if (!move || typeof move !== 'object') {
    return null;
  }
  if (typeof move.from !== 'string' || typeof move.to !== 'string' || !move.from || !move.to) {
    return null;
  }

  let isCheckmate = false;
  let inCheck = false;

  if (chessOrState && typeof chessOrState === 'object') {
    if (typeof chessOrState.isCheckmate === 'function') {
      try {
        isCheckmate = Boolean(chessOrState.isCheckmate());
      } catch {
        isCheckmate = false;
      }
    } else if (typeof chessOrState.in_checkmate === 'function') {
      try {
        isCheckmate = Boolean(chessOrState.in_checkmate());
      } catch {
        isCheckmate = false;
      }
    } else if (typeof chessOrState.isCheckmate === 'boolean') {
      isCheckmate = chessOrState.isCheckmate;
    }

    if (typeof chessOrState.inCheck === 'function') {
      try {
        inCheck = Boolean(chessOrState.inCheck());
      } catch {
        inCheck = false;
      }
    } else if (typeof chessOrState.in_check === 'function') {
      try {
        inCheck = Boolean(chessOrState.in_check());
      } catch {
        inCheck = false;
      }
    } else if (typeof chessOrState.inCheck === 'boolean') {
      inCheck = chessOrState.inCheck;
    }
  }

  // 1. Checkmate (highest priority)
  if (isCheckmate) {
    return SOUND_TYPES.CHECKMATE;
  }

  // 2. Check
  if (inCheck) {
    return SOUND_TYPES.CHECK;
  }

  const flags = typeof move.flags === 'string' ? move.flags : '';

  // 3. Promotion
  if (Boolean(move.promotion) || flags.includes('p')) {
    return SOUND_TYPES.PROMOTION;
  }

  // 4. Castling (kingside 'k' or queenside 'q')
  if (flags.includes('k') || flags.includes('q')) {
    return SOUND_TYPES.CASTLING;
  }

  // 5. Capture (standard capture 'c', en-passant 'e', or move.captured piece code)
  if (Boolean(move.captured) || flags.includes('c') || flags.includes('e')) {
    return SOUND_TYPES.CAPTURE;
  }

  // 6. Normal Move
  return SOUND_TYPES.MOVE;
}

class ChessAudioService {
  constructor() {
    this._audioCtx = null;
    this._masterGain = null;
    this._peakLimiter = null;
    this._noiseBuffer = null;
    this._userInteracted = false;
    this._activeVoices = [];
    this._listeners = new Set();
    this._audioHistory = [];
    this._lastDedupeKey = null;
    this._lastDedupeTime = 0;
    this._customAudioContextFactory = null;
    this._lifecycleBound = false;

    this._preferences = this._loadPreferencesFromStorage();
    this._bindBrowserLifecycle();
  }

  _getDefaultPreferences() {
    const reducedMotion = isReducedMotionPreferred();
    return {
      soundEnabled: DEFAULT_CHESSBOARD_PREFERENCES.soundEnabled,
      motionEnabled: reducedMotion ? false : DEFAULT_CHESSBOARD_PREFERENCES.motionEnabled,
      respectReducedMotion: DEFAULT_CHESSBOARD_PREFERENCES.respectReducedMotion,
      hasExplicitMotionPreference: false,
    };
  }

  _loadPreferencesFromStorage() {
    const defaults = this._getDefaultPreferences();
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return defaults;
      }
      const raw = localStorage.getItem(CHESSBOARD_PREFERENCES_KEY);
      if (!raw || typeof raw !== 'string') {
        return defaults;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return defaults;
      }

      const soundEnabled = typeof parsed.soundEnabled === 'boolean'
        ? parsed.soundEnabled
        : defaults.soundEnabled;

      const hasExplicitMotionPreference = typeof parsed.hasExplicitMotionPreference === 'boolean'
        ? parsed.hasExplicitMotionPreference
        : typeof parsed.motionEnabled === 'boolean';

      const respectReducedMotion = typeof parsed.respectReducedMotion === 'boolean'
        ? parsed.respectReducedMotion
        : defaults.respectReducedMotion;

      let motionEnabled = typeof parsed.motionEnabled === 'boolean'
        ? parsed.motionEnabled
        : defaults.motionEnabled;

      if (respectReducedMotion && isReducedMotionPreferred() && !hasExplicitMotionPreference) {
        motionEnabled = false;
      }

      return {
        soundEnabled,
        motionEnabled,
        respectReducedMotion,
        hasExplicitMotionPreference,
      };
    } catch {
      // Defensive fallback if LocalStorage is unavailable or JSON is corrupted
      return defaults;
    }
  }

  _savePreferencesToStorage() {
    try {
      if (typeof localStorage === 'undefined' || !localStorage) {
        return;
      }
      const payload = {
        soundEnabled: Boolean(this._preferences.soundEnabled),
        motionEnabled: Boolean(this._preferences.motionEnabled),
        respectReducedMotion: Boolean(this._preferences.respectReducedMotion),
        hasExplicitMotionPreference: Boolean(this._preferences.hasExplicitMotionPreference),
      };
      localStorage.setItem(CHESSBOARD_PREFERENCES_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota or storage security errors
    }
  }

  _bindBrowserLifecycle() {
    if (this._lifecycleBound) return;
    if (typeof document === 'undefined' && typeof window === 'undefined') return;
    this._lifecycleBound = true;

    const unlockHandler = () => {
      this.markUserInteraction();
    };

    try {
      if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
        document.addEventListener('pointerdown', unlockHandler, { passive: true });
        document.addEventListener('touchstart', unlockHandler, { passive: true });
        document.addEventListener('keydown', unlockHandler, { passive: true });
        document.addEventListener('click', unlockHandler, { passive: true });

        document.addEventListener('visibilitychange', () => {
          this._handleVisibilityChange();
        });
      }

      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mql && typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', () => {
            this._notifyListeners();
          });
        }
      }
    } catch {
      // Safe fallback in non-browser or restricted test environments
    }
  }

  _handleVisibilityChange() {
    try {
      if (typeof document !== 'undefined' && document.hidden) {
        this.stopAllActiveVoices();
        if (this._audioCtx && this._audioCtx.state === 'running' && typeof this._audioCtx.suspend === 'function') {
          const suspendPromise = this._audioCtx.suspend();
          if (suspendPromise && typeof suspendPromise.catch === 'function') {
            suspendPromise.catch(() => {});
          }
        }
      }
    } catch {
      // Ignore visibility errors
    }
  }

  /**
   * Marks that a valid user gesture has occurred, allowing AudioContext
   * initialization and resuming on desktop/mobile browsers (Chrome, Android, iOS Safari).
   */
  markUserInteraction() {
    this._userInteracted = true;
    if (this._audioCtx && this._audioCtx.state === 'suspended' && typeof this._audioCtx.resume === 'function') {
      try {
        const resumeResult = this._audioCtx.resume();
        if (resumeResult && typeof resumeResult.catch === 'function') {
          resumeResult.catch(() => {});
        }
      } catch {
        // Ignore resume failure
      }
    }
  }

  hasUserInteracted() {
    return this._userInteracted;
  }

  /**
   * Returns current global chessboard preferences.
   */
  getPreferences() {
    const reducedMotionActive = isReducedMotionPreferred();
    const effectiveMotionEnabled = Boolean(
      this._preferences.motionEnabled &&
      !(this._preferences.respectReducedMotion && reducedMotionActive)
    );
    return {
      soundEnabled: Boolean(this._preferences.soundEnabled),
      motionEnabled: Boolean(this._preferences.motionEnabled),
      effectiveMotionEnabled,
      respectReducedMotion: Boolean(this._preferences.respectReducedMotion),
      reducedMotionActive,
    };
  }

  /**
   * Updates one or more global chessboard preferences and persists to LocalStorage.
   */
  updatePreferences(partial = {}) {
    if (!partial || typeof partial !== 'object') {
      return this.getPreferences();
    }

    if (typeof partial.soundEnabled === 'boolean') {
      this._preferences.soundEnabled = partial.soundEnabled;
      if (!partial.soundEnabled) {
        this.stopAllActiveVoices();
      }
      this._syncMasterGain();
    }

    if (typeof partial.motionEnabled === 'boolean') {
      this._preferences.motionEnabled = partial.motionEnabled;
      this._preferences.hasExplicitMotionPreference = true;
    }

    if (typeof partial.respectReducedMotion === 'boolean') {
      this._preferences.respectReducedMotion = partial.respectReducedMotion;
    }

    this._savePreferencesToStorage();
    this._notifyListeners();
    return this.getPreferences();
  }

  setSoundEnabled(enabled) {
    return this.updatePreferences({ soundEnabled: Boolean(enabled) });
  }

  setMotionEnabled(enabled) {
    return this.updatePreferences({ motionEnabled: Boolean(enabled) });
  }

  isSoundEnabled() {
    return Boolean(this._preferences.soundEnabled);
  }

  isMotionEnabled() {
    const prefs = this.getPreferences();
    return prefs.effectiveMotionEnabled;
  }

  getMasterGainValue() {
    return this._preferences.soundEnabled ? MASTER_GAIN_DEFAULT : 0;
  }

  subscribePreferences(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  _notifyListeners() {
    const snapshot = this.getPreferences();
    for (const listener of this._listeners) {
      try {
        listener(snapshot);
      } catch {
        // Ignore subscriber error
      }
    }
  }

  reloadPreferencesFromStorage() {
    this._preferences = this._loadPreferencesFromStorage();
    this._syncMasterGain();
    this._notifyListeners();
    return this.getPreferences();
  }

  setAudioContextFactoryForTesting(factoryFn) {
    this._customAudioContextFactory = typeof factoryFn === 'function' ? factoryFn : null;
    this._audioCtx = null;
    this._masterGain = null;
    this._peakLimiter = null;
    this._noiseBuffer = null;
  }

  getAudioContext() {
    return this._audioCtx;
  }

  _resolveAudioContextConstructor() {
    if (typeof globalThis !== 'undefined') {
      if (typeof globalThis.AudioContext === 'function') return globalThis.AudioContext;
      if (typeof globalThis.webkitAudioContext === 'function') return globalThis.webkitAudioContext;
    }
    if (typeof window !== 'undefined') {
      if (typeof window.AudioContext === 'function') return window.AudioContext;
      if (typeof window.webkitAudioContext === 'function') return window.webkitAudioContext;
    }
    return null;
  }

  /**
   * Configures a transparent peak limiter (DynamicsCompressorNode) to prevent
   * clipping or distortion at 100% (1.0) master gain.
   */
  _createPeakLimiter(ctx) {
    if (!ctx || typeof ctx.createDynamicsCompressor !== 'function') {
      return null;
    }
    try {
      const limiter = ctx.createDynamicsCompressor();
      const now = Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0;
      const setParam = (param, value) => {
        if (!param) return;
        if (typeof param.setValueAtTime === 'function') {
          param.setValueAtTime(value, now);
        } else {
          param.value = value;
        }
      };
      setParam(limiter.threshold, -3.0);
      setParam(limiter.knee, 6.0);
      setParam(limiter.ratio, 12.0);
      setParam(limiter.attack, 0.002);
      setParam(limiter.release, 0.08);
      return limiter;
    } catch {
      return null;
    }
  }

  /**
   * Lazily initializes or resumes AudioContext only when needed.
   */
  _ensureAudioContext() {
    try {
      if (!this._audioCtx) {
        if (this._customAudioContextFactory) {
          this._audioCtx = this._customAudioContextFactory();
        } else {
          const AudioCtxClass = this._resolveAudioContextConstructor();
          if (!AudioCtxClass) {
            return null;
          }
          this._audioCtx = new AudioCtxClass();
        }

        if (this._audioCtx && typeof this._audioCtx.createGain === 'function') {
          this._masterGain = this._audioCtx.createGain();
          this._peakLimiter = this._createPeakLimiter(this._audioCtx);
          this._syncMasterGain();
          if (this._audioCtx.destination && typeof this._masterGain.connect === 'function') {
            if (this._peakLimiter && typeof this._peakLimiter.connect === 'function') {
              this._masterGain.connect(this._peakLimiter);
              this._peakLimiter.connect(this._audioCtx.destination);
            } else {
              this._masterGain.connect(this._audioCtx.destination);
            }
          }
        }
      }

      if (this._audioCtx && this._audioCtx.state === 'suspended' && typeof this._audioCtx.resume === 'function') {
        const res = this._audioCtx.resume();
        if (res && typeof res.catch === 'function') {
          res.catch(() => {});
        }
      }

      this._syncMasterGain();
      return this._audioCtx;
    } catch {
      this._audioCtx = null;
      this._masterGain = null;
      this._peakLimiter = null;
      return null;
    }
  }

  _syncMasterGain() {
    if (!this._masterGain || !this._audioCtx) return;
    try {
      const targetGain = this.getMasterGainValue();
      const now = Number.isFinite(this._audioCtx.currentTime) ? this._audioCtx.currentTime : 0;
      if (this._masterGain.gain) {
        if (typeof this._masterGain.gain.setValueAtTime === 'function') {
          this._masterGain.gain.setValueAtTime(targetGain, now);
        } else {
          this._masterGain.gain.value = targetGain;
        }
      }
    } catch {
      // Ignore gain update errors
    }
  }

  /**
   * Generates a procedural wooden click noise AudioBuffer locally in memory.
   * Zero external files or network requests.
   */
  _getOrCreateNoiseBuffer(ctx) {
    if (this._noiseBuffer) {
      return this._noiseBuffer;
    }
    if (!ctx || typeof ctx.createBuffer !== 'function') {
      return null;
    }
    try {
      const sampleRate = clampNumber(ctx.sampleRate, 8000, 96000, 44100);
      const length = Math.max(256, Math.floor(sampleRate * 0.05)); // 50ms procedural buffer
      const buffer = ctx.createBuffer(1, length, sampleRate);
      if (typeof buffer.getChannelData === 'function') {
        const channel = buffer.getChannelData(0);
        // Deterministic pseudo-random wooden grain impulse so it sounds clean and consistent
        let seed = 20260503;
        for (let i = 0; i < channel.length; i += 1) {
          seed = (seed * 1664525 + 1013904223) >>> 0;
          const white = (seed / 0xffffffff) * 2 - 1;
          const envelope = Math.exp(-i / (sampleRate * 0.008));
          channel[i] = white * envelope;
        }
      }
      this._noiseBuffer = buffer;
      return buffer;
    } catch {
      return null;
    }
  }

  /**
   * Enforces polyphony limit so rapid moves never stack uncontrollably.
   */
  _registerVoiceCleanup(voiceGroup) {
    const now = Date.now();
    this._activeVoices = this._activeVoices.filter((v) => !v.stopped && v.expiresAt > now);

    while (this._activeVoices.length >= MAX_ACTIVE_VOICES) {
      const oldest = this._activeVoices.shift();
      if (oldest) {
        this._stopVoiceGroup(oldest);
      }
    }

    this._activeVoices.push(voiceGroup);
  }

  _stopVoiceGroup(voiceGroup) {
    if (!voiceGroup || voiceGroup.stopped) return;
    voiceGroup.stopped = true;
    for (const node of voiceGroup.sources || []) {
      try {
        if (node && typeof node.stop === 'function') {
          node.stop();
        }
        if (node && typeof node.disconnect === 'function') {
          node.disconnect();
        }
      } catch {
        // Ignore already-stopped source errors
      }
    }
  }

  stopAllActiveVoices() {
    for (const group of this._activeVoices) {
      this._stopVoiceGroup(group);
    }
    this._activeVoices = [];
  }

  _synthesizeTransient(ctx, destination, transientCfg, startTime, voiceGroup) {
    if (!transientCfg || !ctx || typeof ctx.createBufferSource !== 'function') {
      return;
    }
    const buffer = this._getOrCreateNoiseBuffer(ctx);
    if (!buffer) return;

    const triggerTransientBurst = (offsetSec, burstGain) => {
      try {
        const source = ctx.createBufferSource();
        source.buffer = buffer;

        const filter = typeof ctx.createBiquadFilter === 'function' ? ctx.createBiquadFilter() : null;
        const gainNode = typeof ctx.createGain === 'function' ? ctx.createGain() : null;

        const t0 = startTime + Math.max(0, Number(offsetSec) || 0);
        const dur = clampNumber(transientCfg.durationSec, 0.005, 0.08, 0.02);
        const peakGain = clampNumber(burstGain, 0.001, 0.85, 0.25);

        if (filter) {
          filter.type = transientCfg.filterType || 'bandpass';
          const freq = clampNumber(transientCfg.filterFreqHz, MIN_FREQ_HZ, MAX_FREQ_HZ, 1050);
          const q = clampNumber(transientCfg.filterQ, 0.2, 12, 1.8);
          if (filter.frequency && typeof filter.frequency.setValueAtTime === 'function') {
            filter.frequency.setValueAtTime(freq, t0);
          } else if (filter.frequency) {
            filter.frequency.value = freq;
          }
          if (filter.Q && typeof filter.Q.setValueAtTime === 'function') {
            filter.Q.setValueAtTime(q, t0);
          } else if (filter.Q) {
            filter.Q.value = q;
          }
        }

        if (gainNode && gainNode.gain) {
          if (typeof gainNode.gain.setValueAtTime === 'function') {
            gainNode.gain.setValueAtTime(0.0001, t0);
            if (typeof gainNode.gain.linearRampToValueAtTime === 'function') {
              gainNode.gain.linearRampToValueAtTime(peakGain, t0 + 0.0015);
            }
            if (typeof gainNode.gain.exponentialRampToValueAtTime === 'function') {
              gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            }
          } else {
            gainNode.gain.value = peakGain;
          }
        }

        if (filter && gainNode) {
          source.connect(filter);
          filter.connect(gainNode);
          gainNode.connect(destination);
        } else if (gainNode) {
          source.connect(gainNode);
          gainNode.connect(destination);
        } else {
          source.connect(destination);
        }

        if (typeof source.start === 'function') {
          source.start(t0);
        }
        if (typeof source.stop === 'function') {
          source.stop(t0 + dur + 0.005);
        }

        voiceGroup.sources.push(source);
        voiceGroup.nodesCreated.bufferSources += 1;
        if (filter) voiceGroup.nodesCreated.filters += 1;
        if (gainNode) voiceGroup.nodesCreated.gains += 1;
      } catch {
        // Ignore transient synthesis error
      }
    };

    triggerTransientBurst(0, transientCfg.gain);
    if (Number.isFinite(transientCfg.secondaryOffsetSec) && transientCfg.secondaryOffsetSec > 0) {
      triggerTransientBurst(
        transientCfg.secondaryOffsetSec,
        transientCfg.secondaryGain || transientCfg.gain * 0.85
      );
    }
  }

  _synthesizeOscillatorVoice(ctx, destination, voiceCfg, presetMaxGain, startTime, voiceGroup) {
    if (!voiceCfg || !ctx || typeof ctx.createOscillator !== 'function') {
      return;
    }
    try {
      const osc = ctx.createOscillator();
      const filter = typeof ctx.createBiquadFilter === 'function' ? ctx.createBiquadFilter() : null;
      const gainNode = typeof ctx.createGain === 'function' ? ctx.createGain() : null;

      const t0 = startTime + Math.max(0, Number(voiceCfg.offsetSec) || 0);
      const attackSec = clampNumber(voiceCfg.attackSec, 0.001, 0.05, 0.003);
      const decaySec = clampNumber(voiceCfg.decaySec, 0.015, 0.35, 0.06);
      const slideSec = clampNumber(voiceCfg.pitchSlideSec, 0.01, 0.35, decaySec);

      const startFreq = clampNumber(voiceCfg.startFreqHz, MIN_FREQ_HZ, MAX_FREQ_HZ, 180);
      const endFreq = clampNumber(voiceCfg.endFreqHz, MIN_FREQ_HZ, MAX_FREQ_HZ, startFreq);
      const peakGain = clampNumber(voiceCfg.gain, 0.001, presetMaxGain || 0.6, 0.25);

      osc.type = voiceCfg.waveform || 'triangle';
      if (osc.frequency) {
        if (typeof osc.frequency.setValueAtTime === 'function') {
          osc.frequency.setValueAtTime(startFreq, t0);
          if (endFreq !== startFreq && typeof osc.frequency.exponentialRampToValueAtTime === 'function') {
            osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + slideSec);
          }
        } else {
          osc.frequency.value = startFreq;
        }
      }

      if (filter) {
        filter.type = voiceCfg.filterType || 'lowpass';
        const filterFreq = clampNumber(voiceCfg.filterFreqHz, MIN_FREQ_HZ, MAX_FREQ_HZ, 900);
        const filterQ = clampNumber(voiceCfg.filterQ, 0.2, 12, 1.2);
        if (filter.frequency && typeof filter.frequency.setValueAtTime === 'function') {
          filter.frequency.setValueAtTime(filterFreq, t0);
        } else if (filter.frequency) {
          filter.frequency.value = filterFreq;
        }
        if (filter.Q && typeof filter.Q.setValueAtTime === 'function') {
          filter.Q.setValueAtTime(filterQ, t0);
        } else if (filter.Q) {
          filter.Q.value = filterQ;
        }
      }

      if (gainNode && gainNode.gain) {
        if (typeof gainNode.gain.setValueAtTime === 'function') {
          gainNode.gain.setValueAtTime(0.0001, t0);
          if (typeof gainNode.gain.linearRampToValueAtTime === 'function') {
            gainNode.gain.linearRampToValueAtTime(peakGain, t0 + attackSec);
          }
          if (typeof gainNode.gain.exponentialRampToValueAtTime === 'function') {
            gainNode.gain.exponentialRampToValueAtTime(0.0001, t0 + attackSec + decaySec);
          }
        } else {
          gainNode.gain.value = peakGain;
        }
      }

      if (filter && gainNode) {
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(destination);
      } else if (gainNode) {
        osc.connect(gainNode);
        gainNode.connect(destination);
      } else {
        osc.connect(destination);
      }

      if (typeof osc.start === 'function') {
        osc.start(t0);
      }
      if (typeof osc.stop === 'function') {
        osc.stop(t0 + attackSec + decaySec + 0.01);
      }

      voiceGroup.sources.push(osc);
      voiceGroup.nodesCreated.oscillators += 1;
      if (filter) voiceGroup.nodesCreated.filters += 1;
      if (gainNode) voiceGroup.nodesCreated.gains += 1;
    } catch {
      // Ignore oscillator synthesis error
    }
  }

  /**
   * Plays a specific chess sound preset by type ('move', 'capture', 'check',
   * 'checkmate', 'castling', 'promotion').
   *
   * @param {string} soundType - One of SOUND_TYPES
   * @param {object} [options] - Optional metadata ({ dedupeKey, source, move })
   * @returns {object} Result summary of the sound playback attempt
   */
  playSound(soundType, options = {}) {
    const preset = SOUND_PRESETS[soundType];
    if (!preset) {
      return { played: false, reason: 'invalid_preset', soundType: null };
    }

    // Check mute / sound disabled
    if (!this.isSoundEnabled()) {
      return { played: false, reason: 'muted', soundType };
    }

    // Anti-double-audio deduplication
    const nowMs = Date.now();
    const dedupeKey = options && typeof options.dedupeKey === 'string' && options.dedupeKey
      ? options.dedupeKey
      : null;

    if (dedupeKey && this._lastDedupeKey === dedupeKey && (nowMs - this._lastDedupeTime) < 250) {
      return { played: false, reason: 'deduplicated', soundType, dedupeKey };
    }

    if (
      !dedupeKey &&
      options &&
      options.preventRapidDuplicate &&
      this._lastDedupeKey === `__type:${soundType}` &&
      (nowMs - this._lastDedupeTime) < DEDUPE_WINDOW_MS
    ) {
      return { played: false, reason: 'deduplicated_window', soundType };
    }

    // Mark interaction when sound is triggered by a board move
    this._userInteracted = true;

    const ctx = this._ensureAudioContext();
    const masterGainValue = this.getMasterGainValue();

    const voiceGroup = {
      soundType,
      presetId: preset.id,
      startedAt: nowMs,
      expiresAt: nowMs + preset.durationMs + 40,
      stopped: false,
      sources: [],
      nodesCreated: {
        oscillators: 0,
        gains: 0,
        filters: 0,
        bufferSources: 0,
      },
    };

    if (ctx) {
      try {
        const destination = this._masterGain || ctx.destination;
        const startTime = Number.isFinite(ctx.currentTime) ? ctx.currentTime : 0;

        this._registerVoiceCleanup(voiceGroup);
        this._synthesizeTransient(ctx, destination, preset.transient, startTime, voiceGroup);

        for (const voiceCfg of preset.voices) {
          this._synthesizeOscillatorVoice(
            ctx,
            destination,
            voiceCfg,
            preset.maxGain,
            startTime,
            voiceGroup
          );
        }
      } catch {
        // Never allow AudioContext errors to break chess gameplay
      }
    }

    this._lastDedupeKey = dedupeKey || `__type:${soundType}`;
    this._lastDedupeTime = nowMs;

    const record = {
      played: Boolean(ctx),
      soundType,
      presetId: preset.id,
      durationMs: preset.durationMs,
      masterGain: masterGainValue,
      peakLimiterActive: Boolean(this._peakLimiter),
      nodesCreated: { ...voiceGroup.nodesCreated },
      source: options.source || 'board',
      dedupeKey: dedupeKey || null,
      timestamp: nowMs,
      audioContextAvailable: Boolean(ctx),
    };

    this._audioHistory.push(record);
    if (this._audioHistory.length > 100) {
      this._audioHistory.shift();
    }

    return record;
  }

  /**
   * Classifies a chess.js move result and plays the corresponding single preset sound.
   *
   * @param {object} move - Actual move result from chess.js
   * @param {object} chessOrState - Chess instance or { inCheck, isCheckmate }
   * @param {object} [options] - Optional { dedupeKey, source }
   */
  playSoundForMove(move, chessOrState = null, options = {}) {
    const soundType = classifyChessMoveSound(move, chessOrState);
    if (!soundType) {
      return { played: false, reason: 'invalid_move', soundType: null };
    }

    // Build a deterministic dedupe key from move + FEN/state if not explicitly provided
    let dedupeKey = options && options.dedupeKey ? options.dedupeKey : null;
    if (!dedupeKey && move && typeof move === 'object') {
      let fenPart = '';
      if (chessOrState && typeof chessOrState.fen === 'function') {
        try {
          fenPart = chessOrState.fen();
        } catch {
          fenPart = '';
        }
      } else if (move.after) {
        fenPart = move.after;
      }
      if (fenPart) {
        dedupeKey = `${ options.source || 'board' }:${ move.color || '' }:${ move.from }-${ move.to }:${ move.promotion || '' }:${ fenPart }`;
      }
    }

    return this.playSound(soundType, {
      ...options,
      dedupeKey,
      move,
    });
  }

  getAudioHistory() {
    return [...this._audioHistory];
  }

  getLastPlayedSound() {
    return this._audioHistory.length > 0
      ? this._audioHistory[this._audioHistory.length - 1]
      : null;
  }

  clearAudioHistory() {
    this._audioHistory = [];
    this._lastDedupeKey = null;
    this._lastDedupeTime = 0;
  }

  resetForTesting() {
    this.stopAllActiveVoices();
    this.clearAudioHistory();
    this._preferences = this._loadPreferencesFromStorage();
    this._syncMasterGain();
  }
}

export const chessAudioService = new ChessAudioService();
export default chessAudioService;
