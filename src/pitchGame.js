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
    power: 0.65,
    powerDir: 1,
    powerSpeed: 1.35,
    keeperX: PENALTY_X,
    keeperDir: 1,
    keeperSpeed: 240,
    keeperWidth: 66,
    defenderX: 230,
    defenderY: 200,
    defenderDir: -1,
    defenderSpeed: 165,
    defenderWidth: 46,
    ballX: PENALTY_X,
    ballY: PENALTY_Y,
    targetX: PENALTY_X,
    targetY: 82,
    ballVx: 0,
    ballVy: 0,
    ballSpin: 0,
    lastOutcome: null // 'goal' | 'saved' | 'blocked' | 'miss'
  };
}

export function applyQuestionOutcome(state, isCorrect) {
  const roundBonus = (state.round - 1) * 22;
  const ok = Boolean(isCorrect);
  return {
    ...state,
    phase: 'aim',
    superShot: ok,
    keeperSpeed: (ok ? 210 : 335) + roundBonus,
    defenderSpeed: (ok ? 140 : 225) + roundBonus * 0.7,
    power: 0.55,
    powerDir: 1,
    ballX: PENALTY_X,
    ballY: PENALTY_Y,
    lastOutcome: null
  };
}

export function moveAim(state, dx, dy) {
  if (state.phase !== 'aim') return state;
  const nextX = Math.max(GOAL_LEFT - 20, Math.min(GOAL_RIGHT + 20, state.aimX + dx));
  const nextY = Math.max(GOAL_TOP - 10, Math.min(GOAL_LINE_Y - 6, state.aimY + dy));
  return { ...state, aimX: nextX, aimY: nextY };
}

export function stepKeeper(state, dt) {
  if (state.phase !== 'aim' && state.phase !== 'flying') return state;

  // Move goalkeeper
  const halfK = state.keeperWidth / 2;
  const minK = GOAL_LEFT + halfK + 4;
  const maxK = GOAL_RIGHT - halfK - 4;
  let nextKeeperX = state.keeperX + state.keeperDir * state.keeperSpeed * dt;
  let nextKeeperDir = state.keeperDir;
  if (nextKeeperX >= maxK) {
    nextKeeperX = maxK;
    nextKeeperDir = -1;
  } else if (nextKeeperX <= minK) {
    nextKeeperX = minK;
    nextKeeperDir = 1;
  }

  // Move defender wall
  const halfD = state.defenderWidth / 2;
  const minD = GOAL_LEFT + 18 + halfD;
  const maxD = GOAL_RIGHT - 18 - halfD;
  let nextDefX = state.defenderX + state.defenderDir * state.defenderSpeed * dt;
  let nextDefDir = state.defenderDir;
  if (nextDefX >= maxD) {
    nextDefX = maxD;
    nextDefDir = -1;
  } else if (nextDefX <= minD) {
    nextDefX = minD;
    nextDefDir = 1;
  }

  // Oscillate power bar during aim
  let nextPower = state.power;
  let nextPowerDir = state.powerDir;
  if (state.phase === 'aim') {
    nextPower += state.powerDir * state.powerSpeed * dt;
    if (nextPower >= 1) {
      nextPower = 1;
      nextPowerDir = -1;
    } else if (nextPower <= 0.15) {
      nextPower = 0.15;
      nextPowerDir = 1;
    }
  }

  return {
    ...state,
    keeperX: nextKeeperX,
    keeperDir: nextKeeperDir,
    defenderX: nextDefX,
    defenderDir: nextDefDir,
    power: nextPower,
    powerDir: nextPowerDir
  };
}

export function launchShot(state, targetX = state.aimX, targetY = state.aimY) {
  if (state.phase !== 'aim') return state;

  let adjX = Math.max(GOAL_LEFT - 24, Math.min(GOAL_RIGHT + 24, targetX));
  let adjY = Math.max(GOAL_TOP - 12, Math.min(GOAL_LINE_Y - 4, targetY));

  // Overpower (> 0.86) skies the shot upward and slightly off-line
  if (state.power > 0.86) {
    const excess = (state.power - 0.86) / 0.14;
    adjY -= excess * 34;
    adjX += (adjX >= PENALTY_X ? 1 : -1) * excess * 22;
  }

  const dx = adjX - PENALTY_X;
  const dy = adjY - PENALTY_Y;
  const dist = Math.hypot(dx, dy) || 1;
  const baseSpeed = state.superShot ? 660 : 500;
  const powerFactor = state.power < 0.35 ? 0.65 : state.power > 0.86 ? 1.15 : 1.0;
  const speed = baseSpeed * powerFactor;

  return {
    ...state,
    phase: 'flying',
    aimX: adjX,
    aimY: adjY,
    targetX: adjX,
    targetY: adjY,
    ballVx: (dx / dist) * speed,
    ballVy: (dy / dist) * speed,
    ballSpin: 0
  };
}

export function stepBall(state, dt) {
  if (state.phase !== 'flying') return state;
  const prevY = state.ballY;
  const nextX = state.ballX + state.ballVx * dt;
  const nextY = state.ballY + state.ballVy * dt;
  const nextSpin = state.ballSpin + dt * 14;

  // Check defender wall block when crossing defenderY
  if (prevY > state.defenderY && nextY <= state.defenderY) {
    const hitDefender = Math.abs(nextX - state.defenderX) <= state.defenderWidth / 2 + 8;
    if (hitDefender) {
      const rivalScored = !state.superShot || state.round % 2 === 0;
      return {
        ...state,
        ballX: nextX,
        ballY: state.defenderY,
        ballSpin: nextSpin,
        phase: 'result',
        lastOutcome: 'blocked',
        rivalScore: rivalScored ? state.rivalScore + 1 : state.rivalScore
      };
    }
  }

  // Check goal line / target plane
  if (nextY <= state.targetY || nextY <= GOAL_LINE_Y - 12) {
    const insidePosts = nextX > GOAL_LEFT + 10 && nextX < GOAL_RIGHT - 10 && nextY >= GOAL_TOP + 2;
    const halfKeeper = state.keeperWidth / 2 + 6;
    const savedByKeeper = Math.abs(nextX - state.keeperX) <= halfKeeper;

    let outcome = 'miss';
    if (insidePosts) {
      outcome = savedByKeeper ? 'saved' : 'goal';
    }

    const scored = outcome === 'goal';
    const rivalScored = !scored && (!state.superShot || state.round % 2 === 0);

    return {
      ...state,
      ballX: nextX,
      ballY: nextY,
      ballSpin: nextSpin,
      phase: 'result',
      lastOutcome: outcome,
      playerScore: scored ? state.playerScore + 1 : state.playerScore,
      rivalScore: rivalScored ? state.rivalScore + 1 : state.rivalScore
    };
  }

  return { ...state, ballX: nextX, ballY: nextY, ballSpin: nextSpin };
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
