/**
 * Realistic 2D Football Match Engine for LGS Champions Cup.
 * Supports: Penalty Kicks, Free Kicks (3-man wall + ball curve), and Through-Ball Pass Plays.
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

export function getPlayTypeForRound(round) {
  const mod = ((round - 1) % 3);
  if (mod === 0) return 'penalty';
  if (mod === 1) return 'freekick';
  return 'pass_play';
}

function buildScenario(playType, round, isCorrect) {
  const roundBonus = (round - 1) * 18;
  const keeperSpeed = (isCorrect ? 210 : 330) + roundBonus;
  const baseDefSpeed = (isCorrect ? 130 : 210) + roundBonus * 0.6;

  if (playType === 'freekick') {
    const startX = round % 2 === 0 ? 250 : 390;
    const wallCenter = startX < PENALTY_X ? 285 : 355;
    return {
      phase: 'aim',
      startX,
      startY: 332,
      keeperSpeed,
      keeperX: startX < PENALTY_X ? 370 : 270,
      teammateX: null,
      teammateY: null,
      teammateDir: 1,
      defenders: [
        { x: wallCenter - 34, y: 215, width: 32, dir: 1, speed: isCorrect ? 18 : 34 },
        { x: wallCenter, y: 215, width: 32, dir: 1, speed: isCorrect ? 18 : 34 },
        { x: wallCenter + 34, y: 215, width: 32, dir: 1, speed: isCorrect ? 18 : 34 }
      ]
    };
  }

  if (playType === 'pass_play') {
    return {
      phase: 'pass',
      startX: PENALTY_X,
      startY: 342,
      keeperSpeed,
      keeperX: PENALTY_X,
      teammateX: 250,
      teammateY: 222,
      teammateDir: 1,
      defenders: [
        { x: 240, y: 280, width: 40, dir: 1, speed: baseDefSpeed },
        { x: 400, y: 250, width: 40, dir: -1, speed: baseDefSpeed * 0.9 }
      ]
    };
  }

  // Default: penalty kick
  return {
    phase: 'aim',
    startX: PENALTY_X,
    startY: PENALTY_Y,
    keeperSpeed: keeperSpeed + 20,
    keeperX: PENALTY_X,
    teammateX: null,
    teammateY: null,
    teammateDir: 1,
    defenders: []
  };
}

export function createShootoutState(totalRounds = 6) {
  return {
    round: 1,
    totalRounds,
    playType: getPlayTypeForRound(1),
    phase: 'question', // 'question' | 'pass' | 'passing' | 'aim' | 'flying' | 'result' | 'finished'
    playerScore: 0,
    rivalScore: 0,
    superShot: false,
    startX: PENALTY_X,
    startY: PENALTY_Y,
    aimX: PENALTY_X,
    aimY: 82,
    curve: 0, // -1 (curl left) to +1 (curl right)
    power: 0.65,
    powerDir: 1,
    powerSpeed: 1.35,
    keeperX: PENALTY_X,
    keeperDir: 1,
    keeperSpeed: 240,
    keeperWidth: 66,
    defenders: [],
    teammateX: null,
    teammateY: null,
    teammateDir: 1,
    ballX: PENALTY_X,
    ballY: PENALTY_Y,
    targetX: PENALTY_X,
    targetY: 82,
    ballVx: 0,
    ballVy: 0,
    ballSpin: 0,
    ballTrail: [],
    lastOutcome: null // 'goal' | 'saved' | 'blocked' | 'intercepted' | 'miss'
  };
}

export function applyQuestionOutcome(state, isCorrect) {
  const ok = Boolean(isCorrect);
  const playType = getPlayTypeForRound(state.round);
  const scenario = buildScenario(playType, state.round, ok);

  return {
    ...state,
    playType,
    phase: scenario.phase,
    superShot: ok,
    startX: scenario.startX,
    startY: scenario.startY,
    ballX: scenario.startX,
    ballY: scenario.startY,
    keeperX: scenario.keeperX,
    keeperSpeed: scenario.keeperSpeed,
    defenders: scenario.defenders,
    teammateX: scenario.teammateX,
    teammateY: scenario.teammateY,
    teammateDir: scenario.teammateDir,
    curve: 0,
    power: 0.55,
    powerDir: 1,
    ballTrail: [],
    lastOutcome: null
  };
}

export function setCurve(state, value) {
  const clamped = Math.max(-1, Math.min(1, Number(value) || 0));
  return { ...state, curve: Math.round(clamped * 10) / 10 };
}

export function moveAim(state, dx, dy) {
  if (state.phase !== 'aim' && state.phase !== 'pass') return state;
  const minY = state.phase === 'pass' ? 190 : GOAL_TOP - 10;
  const maxY = state.phase === 'pass' ? 255 : GOAL_LINE_Y - 6;
  const nextX = Math.max(GOAL_LEFT - 20, Math.min(GOAL_RIGHT + 20, state.aimX + dx));
  const nextY = Math.max(minY, Math.min(maxY, state.aimY + dy));
  return { ...state, aimX: nextX, aimY: nextY };
}

export function stepKeeper(state, dt) {
  if (!['pass', 'passing', 'aim', 'flying'].includes(state.phase)) return state;

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

  // Move defenders
  const nextDefenders = state.defenders.map((d) => {
    const halfD = d.width / 2;
    const minD = GOAL_LEFT + 10 + halfD;
    const maxD = GOAL_RIGHT - 10 - halfD;
    let nx = d.x + d.dir * d.speed * dt;
    let ndir = d.dir;
    if (nx >= maxD) {
      nx = maxD;
      ndir = -1;
    } else if (nx <= minD) {
      nx = minD;
      ndir = 1;
    }
    return { ...d, x: nx, dir: ndir };
  });

  // Move teammate striker during pass phase
  let nextMateX = state.teammateX;
  let nextMateDir = state.teammateDir;
  if (state.teammateX !== null && (state.phase === 'pass' || state.phase === 'passing')) {
    const mateSpeed = state.superShot ? 85 : 135;
    nextMateX += state.teammateDir * mateSpeed * dt;
    if (nextMateX >= 450) {
      nextMateX = 450;
      nextMateDir = -1;
    } else if (nextMateX <= 190) {
      nextMateX = 190;
      nextMateDir = 1;
    }
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
    defenders: nextDefenders,
    teammateX: nextMateX,
    teammateDir: nextMateDir,
    power: nextPower,
    powerDir: nextPowerDir
  };
}

export function launchPass(state, targetX = state.aimX, targetY = state.teammateY ?? 222) {
  if (state.phase !== 'pass') return state;
  const tx = Math.max(150, Math.min(490, targetX));
  const ty = state.teammateY ?? targetY;
  const dx = tx - state.ballX;
  const dy = ty - state.ballY;
  const dist = Math.hypot(dx, dy) || 1;
  const speed = 480;

  return {
    ...state,
    phase: 'passing',
    targetX: tx,
    targetY: ty,
    ballVx: (dx / dist) * speed,
    ballVy: (dy / dist) * speed,
    ballTrail: [{ x: state.ballX, y: state.ballY }]
  };
}

export function launchShot(state, targetX = state.aimX, targetY = state.aimY) {
  if (state.phase !== 'aim') return state;

  let adjX = Math.max(GOAL_LEFT - 24, Math.min(GOAL_RIGHT + 24, targetX));
  let adjY = Math.max(GOAL_TOP - 12, Math.min(GOAL_LINE_Y - 4, targetY));

  if (state.power > 0.86) {
    const excess = (state.power - 0.86) / 0.14;
    adjY -= excess * 34;
    adjX += (adjX >= PENALTY_X ? 1 : -1) * excess * 20;
  }

  const dx = adjX - state.ballX;
  const dy = adjY - state.ballY;
  const dist = Math.hypot(dx, dy) || 1;
  const baseSpeed = state.superShot ? 640 : 490;
  const powerFactor = state.power < 0.35 ? 0.65 : state.power > 0.86 ? 1.15 : 1.0;
  const speed = baseSpeed * powerFactor;

  // Offset initial horizontal velocity slightly opposite to curve so the ball bends toward target
  const curveLead = -state.curve * 115;

  return {
    ...state,
    phase: 'flying',
    aimX: adjX,
    aimY: adjY,
    targetX: adjX,
    targetY: adjY,
    ballVx: (dx / dist) * speed + curveLead,
    ballVy: (dy / dist) * speed,
    ballSpin: 0,
    ballTrail: [{ x: state.ballX, y: state.ballY }]
  };
}

export function stepBall(state, dt) {
  if (state.phase !== 'flying' && state.phase !== 'passing') return state;

  const prevY = state.ballY;
  const nextVx = state.phase === 'flying' ? state.ballVx + state.curve * 460 * dt : state.ballVx;
  const nextX = state.ballX + nextVx * dt;
  const nextY = state.ballY + state.ballVy * dt;
  const nextSpin = state.ballSpin + dt * (14 + Math.abs(state.curve) * 16);
  const nextTrail = [...state.ballTrail.slice(-14), { x: nextX, y: nextY }];

  // Check collisions with all defenders
  for (const def of state.defenders) {
    if (prevY > def.y && nextY <= def.y) {
      const hitDef = Math.abs(nextX - def.x) <= def.width / 2 + 8;
      if (hitDef) {
        const rivalScored = !state.superShot || state.round % 2 === 0;
        return {
          ...state,
          ballX: nextX,
          ballY: def.y,
          ballVx: nextVx,
          ballSpin: nextSpin,
          ballTrail: nextTrail,
          phase: 'result',
          lastOutcome: state.phase === 'passing' ? 'intercepted' : 'blocked',
          rivalScore: rivalScored ? state.rivalScore + 1 : state.rivalScore
        };
      }
    }
  }

  // Handle through-ball pass arrival
  if (state.phase === 'passing') {
    if (nextY <= state.targetY) {
      const caught = state.teammateX !== null && Math.abs(nextX - state.teammateX) <= 46;
      if (caught) {
        return {
          ...state,
          phase: 'aim',
          startX: state.teammateX,
          startY: state.teammateY,
          ballX: state.teammateX,
          ballY: state.teammateY,
          ballVx: 0,
          ballVy: 0,
          aimX: PENALTY_X,
          aimY: 82,
          defenders: [{ x: PENALTY_X, y: 175, width: 42, dir: -1, speed: state.superShot ? 110 : 180 }],
          ballTrail: []
        };
      }
      const rivalScored = !state.superShot || state.round % 2 === 0;
      return {
        ...state,
        ballX: nextX,
        ballY: nextY,
        ballTrail: nextTrail,
        phase: 'result',
        lastOutcome: 'intercepted',
        rivalScore: rivalScored ? state.rivalScore + 1 : state.rivalScore
      };
    }
    return { ...state, ballX: nextX, ballY: nextY, ballVx: nextVx, ballSpin: nextSpin, ballTrail: nextTrail };
  }

  // Handle shot reaching goal line
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
      ballVx: nextVx,
      ballSpin: nextSpin,
      ballTrail: nextTrail,
      phase: 'result',
      lastOutcome: outcome,
      playerScore: scored ? state.playerScore + 1 : state.playerScore,
      rivalScore: rivalScored ? state.rivalScore + 1 : state.rivalScore
    };
  }

  return {
    ...state,
    ballX: nextX,
    ballY: nextY,
    ballVx: nextVx,
    ballSpin: nextSpin,
    ballTrail: nextTrail
  };
}

export function advanceShootoutRound(state) {
  if (state.round >= state.totalRounds) {
    return { ...state, phase: 'finished' };
  }
  const nextRound = state.round + 1;
  return {
    ...state,
    round: nextRound,
    playType: getPlayTypeForRound(nextRound),
    phase: 'question',
    ballX: PENALTY_X,
    ballY: PENALTY_Y,
    curve: 0,
    ballTrail: [],
    lastOutcome: null
  };
}
