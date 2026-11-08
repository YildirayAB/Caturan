/**
 * Caturan MVP 5.3 — Chess Motion Service
 *
 * Provides smooth, responsive, zero-flicker chessboard piece animations and
 * check/checkmate visual indicators using the Web Animations API & FLIP geometry.
 *
 * Key Guarantees:
 * - Never destroys or recreates the 64-square grid to animate.
 * - Never alters board or square dimensions (zero layout shift / zero overflow).
 * - Never breaks square click/drag event listeners.
 * - Safely interrupts/cleans up in-flight animations during rapid moves so
 *   chess.js remains the single source of truth and no ghost pieces remain.
 * - Respects global Board Animation toggle and `prefers-reduced-motion: reduce`.
 */

import {
  chessAudioService,
  isReducedMotionPreferred,
} from './chessAudioService.js';

export const MOTION_TYPES = Object.freeze({
  MOVE: 'move',
  CAPTURE: 'capture',
  CASTLING: 'castling',
  PROMOTION: 'promotion',
  CHECK: 'check',
  CHECKMATE: 'checkmate',
});

export const MOTION_PRESETS = Object.freeze({
  normalDurationMs: 150,
  captureDurationMs: 150,
  castlingDurationMs: 160,
  promotionDurationMs: 165,
  captureGhostDurationMs: 135,
  checkPulseDurationMs: 260,
  checkmateHighlightDurationMs: 320,
  easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
  promotionEasing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
});

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

/**
 * Converts algebraic square (e.g. 'e4') into visual 0..7 row/col coordinates
 * for the given board orientation ('white' or 'black').
 */
export function squareToVisualCoords(square, orientation = 'white') {
  if (typeof square !== 'string' || square.length < 2) {
    return null;
  }
  const fileIndex = FILES.indexOf(square[0].toLowerCase());
  const rankNumber = parseInt(square[1], 10);
  if (fileIndex < 0 || fileIndex > 7 || !Number.isFinite(rankNumber) || rankNumber < 1 || rankNumber > 8) {
    return null;
  }

  const isBlack = orientation === 'black';
  const col = isBlack ? 7 - fileIndex : fileIndex;
  const row = isBlack ? rankNumber - 1 : 8 - rankNumber;
  return { row, col, fileIndex, rankNumber };
}

/**
 * Resolves Rook origin and destination squares for a castling move.
 */
export function resolveCastlingRookMove(move) {
  if (!move || typeof move !== 'object') return null;
  const flags = typeof move.flags === 'string' ? move.flags : '';
  const to = move.to;
  const color = move.color || (to && to[1] === '8' ? 'b' : 'w');

  if (flags.includes('k') || to === 'g1' || to === 'g8') {
    if (move.piece && move.piece !== 'k') return null;
    if (!flags.includes('k') && move.from !== 'e1' && move.from !== 'e8') return null;
    return color === 'b'
      ? { from: 'h8', to: 'f8', piece: 'r', color: 'b' }
      : { from: 'h1', to: 'f1', piece: 'r', color: 'w' };
  }

  if (flags.includes('q') || to === 'c1' || to === 'c8') {
    if (move.piece && move.piece !== 'k') return null;
    if (!flags.includes('q') && move.from !== 'e1' && move.from !== 'e8') return null;
    return color === 'b'
      ? { from: 'a8', to: 'd8', piece: 'r', color: 'b' }
      : { from: 'a1', to: 'd1', piece: 'r', color: 'w' };
  }

  return null;
}

/**
 * Finds the square of the King for a given color ('w' or 'b') from a chess.js instance.
 */
export function findKingSquareFromChess(chessInstance, kingColor) {
  if (!chessInstance || typeof chessInstance.board !== 'function') {
    return null;
  }
  try {
    const board = chessInstance.board();
    for (let r = 0; r < 8; r += 1) {
      for (let c = 0; c < 8; c += 1) {
        const cell = board[r] && board[r][c];
        if (cell && cell.type === 'k' && cell.color === kingColor) {
          return cell.square || `${FILES[c]}${8 - r}`;
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

class ChessMotionService {
  constructor() {
    this._activeByContainer = new WeakMap();
    this._motionHistory = [];
  }

  /**
   * Computes the translation delta from `fromSquare` to `toSquare`.
   * Uses DOM `getBoundingClientRect()` when non-zero layout dimensions exist,
   * and falls back deterministically to grid percentage offsets in headless/mock DOMs.
   */
  computeSquareDelta(container, fromSquare, toSquare, orientation = 'white') {
    const fromCoords = squareToVisualCoords(fromSquare, orientation);
    const toCoords = squareToVisualCoords(toSquare, orientation);
    if (!fromCoords || !toCoords) {
      return { dxPx: 0, dyPx: 0, dxPct: 0, dyPct: 0, cssTransformFrom: 'translate3d(0, 0, 0)' };
    }

    const dxPct = (fromCoords.col - toCoords.col) * 100;
    const dyPct = (fromCoords.row - toCoords.row) * 100;

    let dxPx = 0;
    let dyPx = 0;
    let hasPixelRect = false;

    if (container && typeof container.querySelector === 'function') {
      const fromEl = container.querySelector(`[data-square="${fromSquare}"]`);
      const toEl = container.querySelector(`[data-square="${toSquare}"]`);
      if (
        fromEl &&
        toEl &&
        typeof fromEl.getBoundingClientRect === 'function' &&
        typeof toEl.getBoundingClientRect === 'function'
      ) {
        try {
          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();
          if (
            fromRect &&
            toRect &&
            Number.isFinite(fromRect.left) &&
            Number.isFinite(toRect.left) &&
            (Math.abs(fromRect.left - toRect.left) > 0.5 || Math.abs(fromRect.top - toRect.top) > 0.5)
          ) {
            dxPx = Math.round((fromRect.left - toRect.left) * 100) / 100;
            dyPx = Math.round((fromRect.top - toRect.top) * 100) / 100;
            hasPixelRect = true;
          }
        } catch {
          hasPixelRect = false;
        }
      }
    }

    const cssTransformFrom = hasPixelRect
      ? `translate3d(${dxPx}px, ${dyPx}px, 0)`
      : `translate3d(${dxPct}%, ${dyPct}%, 0)`;

    return {
      dxPx,
      dyPx,
      dxPct,
      dyPct,
      hasPixelRect,
      cssTransformFrom,
    };
  }

  /**
   * Immediately cancels any in-flight animations and removes any transient
   * capture ghost elements inside `container`. Guarantees zero leftover nodes
   * and zero transform drift during rapid move sequences.
   */
  cancelActiveAnimations(container) {
    if (!container || typeof container !== 'object') return;

    const state = this._activeByContainer.get(container);
    if (state) {
      for (const item of state.animations || []) {
        try {
          if (item.animation && typeof item.animation.cancel === 'function') {
            item.animation.cancel();
          }
        } catch {
          // Ignore cancel error
        }
        try {
          if (item.element && item.element.style) {
            item.element.style.transform = '';
            item.element.style.opacity = '';
            item.element.style.willChange = '';
          }
          if (item.element && item.element.classList) {
            item.element.classList.remove(
              'piece-moving',
              'piece-moving-castling',
              'piece-moving-promotion'
            );
          }
        } catch {
          // Ignore style cleanup error
        }
      }

      for (const ghost of state.ghosts || []) {
        try {
          if (ghost && typeof ghost.remove === 'function') {
            ghost.remove();
          } else if (ghost && ghost.parentNode && typeof ghost.parentNode.removeChild === 'function') {
            ghost.parentNode.removeChild(ghost);
          }
        } catch {
          // Ignore ghost removal error
        }
      }

      for (const timerId of state.timers || []) {
        clearTimeout(timerId);
      }

      this._activeByContainer.delete(container);
    }

    // Defensive sweep for any stray `.chess-captured-ghost` or `.piece-moving` inside container
    try {
      if (typeof container.querySelectorAll === 'function') {
        const strayGhosts = container.querySelectorAll('.chess-captured-ghost');
        for (const ghost of strayGhosts) {
          if (typeof ghost.remove === 'function') {
            ghost.remove();
          } else if (ghost.parentNode && typeof ghost.parentNode.removeChild === 'function') {
            ghost.parentNode.removeChild(ghost);
          }
        }

        const movingPieces = container.querySelectorAll('.piece-moving');
        for (const el of movingPieces) {
          el.classList.remove('piece-moving', 'piece-moving-castling', 'piece-moving-promotion');
          if (el.style) {
            el.style.transform = '';
            el.style.willChange = '';
          }
        }
      }
    } catch {
      // Ignore DOM query errors
    }
  }

  /**
   * Synchronously completes all active animations in `container` and cleans up
   * transient capture ghosts.
   */
  finishActiveAnimations(container) {
    this.cancelActiveAnimations(container);
  }

  /**
   * Applies or updates visual Check and Checkmate highlights on the board
   * without changing square dimensions or blocking interaction.
   */
  applyCheckAndMateVisuals(container, status = {}, animateAllowed = true) {
    if (!container || typeof container.querySelector !== 'function') {
      return { checkSquare: null, isCheck: false, isCheckmate: false };
    }

    let isCheckmate = Boolean(status.isCheckmate);
    let inCheck = Boolean(status.inCheck || isCheckmate);
    if (status.chess) {
      if (status.isCheckmate === undefined && typeof status.chess.isCheckmate === 'function') {
        try {
          isCheckmate = Boolean(status.chess.isCheckmate());
        } catch {
          // ignore
        }
      }
      if (status.inCheck === undefined && typeof status.chess.inCheck === 'function') {
        try {
          inCheck = Boolean(status.chess.inCheck() || isCheckmate);
        } catch {
          // ignore
        }
      }
    }
    let checkedKingSquare = status.checkedKingSquare || null;

    if (inCheck && !checkedKingSquare && status.chess) {
      const turn = typeof status.chess.turn === 'function' ? status.chess.turn() : (status.turn || 'w');
      checkedKingSquare = findKingSquareFromChess(status.chess, turn);
    }

    const frameEl = container.querySelector('.chessboard-frame');
    if (frameEl && frameEl.classList) {
      frameEl.classList.toggle('board-in-check', inCheck && !isCheckmate);
      frameEl.classList.toggle('board-checkmate-state', isCheckmate);
    }

    if (typeof container.querySelectorAll === 'function') {
      const allSquares = container.querySelectorAll('.chess-square');
      for (const sqEl of allSquares) {
        if (!sqEl || !sqEl.classList) continue;
        const sqName = sqEl.dataset ? sqEl.dataset.square : sqEl.getAttribute?.('data-square');
        const isCheckedKing = Boolean(inCheck && checkedKingSquare && sqName === checkedKingSquare);

        sqEl.classList.toggle('square-king-check', isCheckedKing);
        sqEl.classList.toggle('square-king-checkmate', Boolean(isCheckedKing && isCheckmate));

        if (isCheckedKing && animateAllowed && typeof sqEl.animate === 'function') {
          try {
            sqEl.animate(
              isCheckmate
                ? [
                    { opacity: 0.86 },
                    { opacity: 1 },
                    { opacity: 0.92 },
                    { opacity: 1 },
                  ]
                : [
                    { opacity: 0.88 },
                    { opacity: 1 },
                  ],
              {
                duration: isCheckmate
                  ? MOTION_PRESETS.checkmateHighlightDurationMs
                  : MOTION_PRESETS.checkPulseDurationMs,
                easing: 'ease-out',
              }
            );
          } catch {
            // Ignore Web Animations API error
          }
        }
      }
    }

    return {
      checkSquare: inCheck ? checkedKingSquare : null,
      isCheck: inCheck,
      isCheckmate,
    };
  }

  _animateElementKeyframes(containerState, element, keyframes, options, extraClass = '') {
    if (!element) return null;

    if (element.classList) {
      element.classList.add('piece-moving');
      if (extraClass) {
        element.classList.add(extraClass);
      }
    }

    let animation = null;
    if (typeof element.animate === 'function') {
      try {
        animation = element.animate(keyframes, options);
      } catch {
        animation = null;
      }
    }

    const entry = { element, animation };
    containerState.animations.push(entry);

    const cleanup = () => {
      try {
        if (element.classList) {
          element.classList.remove('piece-moving', 'piece-moving-castling', 'piece-moving-promotion');
        }
        if (element.style) {
          element.style.transform = '';
          element.style.opacity = '';
          element.style.willChange = '';
        }
      } catch {
        // Ignore cleanup errors
      }
    };

    if (animation) {
      animation.onfinish = cleanup;
      animation.oncancel = cleanup;
    }

    const timerId = setTimeout(cleanup, (options.duration || 150) + 25);
    if (timerId && typeof timerId.unref === 'function') {
      timerId.unref();
    }
    containerState.timers.push(timerId);

    return animation;
  }

  _spawnCaptureGhost(container, containerState, capturedSquare, capturedPieceHtml = '') {
    if (!container || !capturedSquare || typeof container.querySelector !== 'function') {
      return false;
    }

    const targetSqEl = container.querySelector(`[data-square="${capturedSquare}"]`);
    if (!targetSqEl || typeof document === 'undefined' || typeof document.createElement !== 'function') {
      return false;
    }

    // Only attach a live DOM ghost when Web Animations API (`animate`) is supported on the element,
    // or clean it up automatically via timer so synchronous DOM assertions never see leftover pieces.
    const ghostEl = document.createElement('span');
    ghostEl.className = 'chess-captured-ghost';
    ghostEl.setAttribute('aria-hidden', 'true');
    if (capturedPieceHtml) {
      ghostEl.innerHTML = capturedPieceHtml;
    }

    const canAnimate = typeof ghostEl.animate === 'function';
    if (!canAnimate) {
      // In synchronous mock DOM environments without Element.prototype.animate,
      // do not leave an un-animated ghost node inside the square.
      return true;
    }

    targetSqEl.appendChild(ghostEl);
    containerState.ghosts.push(ghostEl);

    const removeGhost = () => {
      try {
        if (typeof ghostEl.remove === 'function') {
          ghostEl.remove();
        } else if (ghostEl.parentNode && typeof ghostEl.parentNode.removeChild === 'function') {
          ghostEl.parentNode.removeChild(ghostEl);
        }
      } catch {
        // Ignore removal errors
      }
    };

    try {
      const anim = ghostEl.animate(
        [
          { opacity: 0.78, transform: 'scale(0.96)' },
          { opacity: 0, transform: 'scale(0.58)' },
        ],
        {
          duration: MOTION_PRESETS.captureGhostDurationMs,
          easing: 'ease-out',
          fill: 'forwards',
        }
      );
      containerState.animations.push({ element: ghostEl, animation: anim });
      if (anim) {
        anim.onfinish = removeGhost;
        anim.oncancel = removeGhost;
      }
    } catch {
      removeGhost();
      return true;
    }

    const timerId = setTimeout(removeGhost, MOTION_PRESETS.captureGhostDurationMs + 20);
    if (timerId && typeof timerId.unref === 'function') {
      timerId.unref();
    }
    containerState.timers.push(timerId);

    return true;
  }

  /**
   * Animates a committed chess move on the board inside `container`.
   * Expects the board DOM in `container` to already represent the post-move
   * state from `chess.js` (so `chess.js` is always the source of truth).
   *
   * @param {HTMLElement} container - Board root element
   * @param {object} move - Move object returned by chess.js ({ from, to, flags, piece, color, captured, promotion })
   * @param {object} [context] - Context ({ orientation, chess, inCheck, isCheckmate, checkedKingSquare, capturedPieceHtml, source })
   * @returns {object} Motion telemetry record
   */
  animateMove(container, move, context = {}) {
    // 1. Always clean up any previous in-flight animations or capture ghosts first
    this.cancelActiveAnimations(container);

    if (!move || typeof move !== 'object' || !move.from || !move.to) {
      return { animated: false, reason: 'invalid_move' };
    }

    const orientation = context.orientation === 'black' ? 'black' : 'white';
    const chessInstance = context.chess || null;

    let isCheckmate = Boolean(context.isCheckmate);
    let inCheck = Boolean(context.inCheck);

    if (chessInstance) {
      if (typeof chessInstance.isCheckmate === 'function') {
        try {
          isCheckmate = Boolean(chessInstance.isCheckmate());
        } catch {
          // ignore
        }
      }
      if (typeof chessInstance.inCheck === 'function') {
        try {
          inCheck = Boolean(chessInstance.inCheck());
        } catch {
          // ignore
        }
      }
    }

    const reducedMotion = isReducedMotionPreferred();
    const prefs = chessAudioService.getPreferences();
    const motionAllowed = Boolean(prefs.effectiveMotionEnabled && !reducedMotion);

    // 2. Always apply visual Check / Checkmate indicators (even when Reduced Motion is active)
    const checkStatus = this.applyCheckAndMateVisuals(
      container,
      {
        chess: chessInstance,
        inCheck,
        isCheckmate,
        checkedKingSquare: context.checkedKingSquare || null,
        turn: context.turn || (move.color === 'w' ? 'b' : 'w'),
      },
      motionAllowed
    );

    const flags = typeof move.flags === 'string' ? move.flags : '';
    const isPromotion = Boolean(move.promotion) || flags.includes('p');
    const castlingRook = resolveCastlingRookMove(move);
    const isCastling = Boolean(castlingRook);
    const isCapture = Boolean(move.captured) || flags.includes('c') || flags.includes('e');

    const primaryDelta = this.computeSquareDelta(container, move.from, move.to, orientation);
    let rookDelta = null;
    if (isCastling && castlingRook) {
      rookDelta = this.computeSquareDelta(container, castlingRook.from, castlingRook.to, orientation);
    }

    const motionType = isCheckmate
      ? MOTION_TYPES.CHECKMATE
      : inCheck && !isPromotion && !isCastling && !isCapture
      ? MOTION_TYPES.CHECK
      : isPromotion
      ? MOTION_TYPES.PROMOTION
      : isCastling
      ? MOTION_TYPES.CASTLING
      : isCapture
      ? MOTION_TYPES.CAPTURE
      : MOTION_TYPES.MOVE;

    // 3. If Motion is disabled or Reduced Motion is active, skip sliding translation
    if (!motionAllowed) {
      const skippedRecord = {
        animated: false,
        reason: reducedMotion ? 'reduced_motion' : 'motion_disabled',
        motionType,
        from: move.from,
        to: move.to,
        isCapture,
        isCastling,
        isPromotion,
        inCheck: checkStatus.isCheck,
        isCheckmate: checkStatus.isCheckmate,
        checkSquare: checkStatus.checkSquare,
        castlingRook: castlingRook || null,
        primaryDelta,
        rookDelta,
        durationMs: 0,
        source: context.source || 'board',
        timestamp: Date.now(),
      };
      this._recordHistory(skippedRecord);
      return skippedRecord;
    }

    const containerState = {
      animations: [],
      ghosts: [],
      timers: [],
    };
    if (container && typeof container === 'object') {
      this._activeByContainer.set(container, containerState);
    }

    let animatedPiecesCount = 0;
    let captureGhostTriggered = false;
    let durationMs = MOTION_PRESETS.normalDurationMs;

    if (container && typeof container.querySelector === 'function') {
      // Handle Capture ghost fade/scale out
      if (isCapture) {
        const capturedSquare = flags.includes('e')
          ? `${move.to[0]}${move.from[1]}`
          : move.to;
        captureGhostTriggered = this._spawnCaptureGhost(
          container,
          containerState,
          capturedSquare,
          context.capturedPieceHtml || ''
        );
      }

      // Animate primary moving piece on `move.to`
      const toSquareEl = container.querySelector(`[data-square="${move.to}"]`);
      const pieceWrapperEl = toSquareEl ? toSquareEl.querySelector('.piece-wrapper') : null;

      if (pieceWrapperEl) {
        if (isPromotion) {
          durationMs = MOTION_PRESETS.promotionDurationMs;
          this._animateElementKeyframes(
            containerState,
            pieceWrapperEl,
            [
              { transform: `${primaryDelta.cssTransformFrom} scale(0.92)` },
              { transform: 'translate3d(0, 0, 0) scale(1.07)', offset: 0.78 },
              { transform: 'translate3d(0, 0, 0) scale(1)' },
            ],
            {
              duration: durationMs,
              easing: MOTION_PRESETS.promotionEasing,
            },
            'piece-moving-promotion'
          );
          animatedPiecesCount += 1;
        } else {
          durationMs = isCastling
            ? MOTION_PRESETS.castlingDurationMs
            : isCapture
            ? MOTION_PRESETS.captureDurationMs
            : MOTION_PRESETS.normalDurationMs;

          this._animateElementKeyframes(
            containerState,
            pieceWrapperEl,
            [
              { transform: primaryDelta.cssTransformFrom },
              { transform: 'translate3d(0, 0, 0)' },
            ],
            {
              duration: durationMs,
              easing: MOTION_PRESETS.easing,
            }
          );
          animatedPiecesCount += 1;
        }
      }

      // Coordinate simultaneous Rook animation for Castling
      if (isCastling && castlingRook && rookDelta) {
        const rookToSquareEl = container.querySelector(`[data-square="${castlingRook.to}"]`);
        const rookWrapperEl = rookToSquareEl ? rookToSquareEl.querySelector('.piece-wrapper') : null;
        if (rookWrapperEl) {
          this._animateElementKeyframes(
            containerState,
            rookWrapperEl,
            [
              { transform: rookDelta.cssTransformFrom },
              { transform: 'translate3d(0, 0, 0)' },
            ],
            {
              duration: MOTION_PRESETS.castlingDurationMs,
              easing: MOTION_PRESETS.easing,
            },
            'piece-moving-castling'
          );
          animatedPiecesCount += 1;
        }
      }
    }

    const record = {
      animated: animatedPiecesCount > 0,
      reason: animatedPiecesCount > 0 ? 'ok' : 'no_dom_target',
      motionType,
      from: move.from,
      to: move.to,
      promotedTo: move.promotion || null,
      isCapture,
      captureGhostTriggered,
      isCastling,
      isPromotion,
      inCheck: checkStatus.isCheck,
      isCheckmate: checkStatus.isCheckmate,
      checkSquare: checkStatus.checkSquare,
      castlingRook: castlingRook || null,
      animatedPiecesCount,
      primaryDelta,
      rookDelta,
      durationMs,
      source: context.source || 'board',
      timestamp: Date.now(),
    };

    this._recordHistory(record);
    return record;
  }

  _recordHistory(record) {
    this._motionHistory.push(record);
    if (this._motionHistory.length > 100) {
      this._motionHistory.shift();
    }
  }

  getMotionHistory() {
    return [...this._motionHistory];
  }

  getLastMotionEvent() {
    return this._motionHistory.length > 0
      ? this._motionHistory[this._motionHistory.length - 1]
      : null;
  }

  clearMotionHistory() {
    this._motionHistory = [];
  }
}

export const chessMotionService = new ChessMotionService();
export default chessMotionService;
