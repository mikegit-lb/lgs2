/**
 * Pure 2D Penalty & Striker Shootout state & physics for LGS Champions Cup.
 * Coordinate space: 640x380 canvas.
 */

export const PITCH_WIDTH = 640;
export const PITCH_HEIGHT = 380;
export const GOAL_LEFT = 140;
export const GOAL_RIGHT = 500;
export const GOAL_TOP = 44;
export const GOAL_LINE_Y = 124;
export const PENALTY_X = 320;
export const PENALTY_Y = 315;

export function createShootoutState(totalRounds = 5) {
  return {
    round: 1,
    totalRounds,
    phase: 'question', // 'question' | 'aim' | 'flying' | 'result' | 'finished'
    playerScore: 0,
    rivalScore: 0,
    superShot: false,
    aimX: PENALTY_X,
    aimY: 82,
    keeperX: PENALTY_X,
    keeperDir: 1,
    keeperSpeed: 190,
    keeperWidth: 58,
    ballX: PENALTY_X,
    ballY: PENALTY_Y,
    targetX: PENALTY_X,
    targetY: 82,
    ballVx: 0,
    ballVy: 0,
    lastOutcome: null // 'goal' | 'saved' | 'miss'
  };
}

export function applyQuestionOutcome(state, isCorrect) {
  return {
    ...state,
    phase: 'aim',
    superShot: Boolean(isCorrect),
    keeperSpeed: isCorrect ? 135 : 265,
    ballX: PENALTY_X,
    ballY: PENALTY_Y,
    lastOutcome: null
  };
}

export function moveAim(state, dx, dy) {
  if (state.phase !== 'aim') return state;
  const nextX = Math.max(GOAL_LEFT - 18, Math.min(GOAL_RIGHT + 18, state.aimX + dx));
  const nextY = Math.max(GOAL_TOP - 8, Math.min(GOAL_LINE_Y - 6, state.aimY + dy));
  return { ...state, aimX: nextX, aimY: nextY };
}

export function stepKeeper(state, dt) {
  if (state.phase !== 'aim' && state.phase !== 'flying') return state;
  const halfW = state.keeperWidth / 2;
  const minX = GOAL_LEFT + halfW + 4;
  const maxX = GOAL_RIGHT - halfW - 4;

  let nextX = state.keeperX + state.keeperDir * state.keeperSpeed * dt;
  let nextDir = state.keeperDir;

  if (nextX >= maxX) {
    nextX = maxX;
    nextDir = -1;
  } else if (nextX <= minX) {
    nextX = minX;
    nextDir = 1;
  }

  return { ...state, keeperX: nextX, keeperDir: nextDir };
}

export function launchShot(state, targetX = state.aimX, targetY = state.aimY) {
  if (state.phase !== 'aim') return state;
  const clampedX = Math.max(GOAL_LEFT - 24, Math.min(GOAL_RIGHT + 24, targetX));
  const clampedY = Math.max(GOAL_TOP - 10, Math.min(GOAL_LINE_Y - 4, targetY));

  const dx = clampedX - PENALTY_X;
  const dy = clampedY - PENALTY_Y;
  const dist = Math.hypot(dx, dy) || 1;
  const speed = state.superShot ? 680 : 510;

  return {
    ...state,
    phase: 'flying',
    aimX: clampedX,
    aimY: clampedY,
    targetX: clampedX,
    targetY: clampedY,
    ballVx: (dx / dist) * speed,
    ballVy: (dy / dist) * speed
  };
}

export function stepBall(state, dt) {
  if (state.phase !== 'flying') return state;
  const nextX = state.ballX + state.ballVx * dt;
  const nextY = state.ballY + state.ballVy * dt;

  // Check if ball reached the target plane or goal line
  if (nextY <= state.targetY || nextY <= GOAL_LINE_Y - 12) {
    const insidePosts = nextX > GOAL_LEFT + 8 && nextX < GOAL_RIGHT - 8 && nextY >= GOAL_TOP;
    const halfKeeper = state.keeperWidth / 2 + 8;
    const savedByKeeper = Math.abs(nextX - state.keeperX) <= halfKeeper;

    let outcome = 'miss';
    if (insidePosts) {
      outcome = savedByKeeper ? 'saved' : 'goal';
    }

    const scored = outcome === 'goal';
    const rivalScored = !scored && !state.superShot;

    return {
      ...state,
      ballX: nextX,
      ballY: nextY,
      phase: 'result',
      lastOutcome: outcome,
      playerScore: scored ? state.playerScore + 1 : state.playerScore,
      rivalScore: rivalScored ? state.rivalScore + 1 : state.rivalScore
    };
  }

  return { ...state, ballX: nextX, ballY: nextY };
}

export function advanceShootoutRound(state) {
  if (state.round >= state.totalRounds) {
    return { ...state, phase: 'finished' };
  }
  return {
    ...state,
    round: state.round + 1,
    phase: 'question',
    ballX: PENALTY_X,
    ballY: PENALTY_Y,
    lastOutcome: null
  };
}
