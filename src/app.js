import {
  TACTICAL_BRIEFINGS,
  PITCH_SIGNALS,
  TACTIC_BUILDERS,
  MATCH_STAGES
} from './matchData.js';
import {
  createMatchState,
  startStage,
  submitAnswer,
  nextQuestion,
  useVarHint,
  getStageSummary,
  getManagerRank,
  getMatchMinute,
  saveProgress,
  loadProgress,
  STORAGE_KEY
} from './matchEngine.js';
import {
  PITCH_WIDTH,
  PITCH_HEIGHT,
  GOAL_LEFT,
  GOAL_RIGHT,
  GOAL_TOP,
  GOAL_LINE_Y,
  PENALTY_X,
  PENALTY_Y,
  createShootoutState,
  applyQuestionOutcome,
  moveAim,
  stepKeeper,
  launchShot,
  stepBall,
  advanceShootoutRound
} from './pitchGame.js';

const $ = (id) => document.getElementById(id);

const views = {
  hub: $('view-hub'),
  briefing: $('view-briefing'),
  sorter: $('view-sorter'),
  builder: $('view-builder'),
  pitch: $('view-pitch'),
  quiz: $('view-quiz'),
  summary: $('view-summary')
};

let state = createMatchState(MATCH_STAGES, loadProgress(window.localStorage));
let activeView = 'hub';
let soundEnabled = true;
let audioCtx = null;
let sorterState = { index: 0, score: 0, answered: false };
let builderState = { index: 0, score: 0, answered: false, pool: [], chosenIndices: [] };
let arcadeState = createShootoutState(5);
let arcadeQuestions = [];
let arcadeRafId = null;
let arcadeLastTs = 0;
let confetti = [];

function playSound(kind) {
  if (!soundEnabled) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  try {
    if (!audioCtx) audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    if (kind === 'goal') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (kind === 'foul') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.setValueAtTime(165, now + 0.12);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (kind === 'fulltime') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, now);
      osc.frequency.setValueAtTime(783.99, now + 0.1);
      osc.frequency.setValueAtTime(1046.5, now + 0.22);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  } catch {
    // Ignore audio errors
  }
}

function showView(name) {
  if (name !== 'pitch' && arcadeRafId !== null) {
    cancelAnimationFrame(arcadeRafId);
    arcadeRafId = null;
  }
  activeView = name;
  for (const [key, el] of Object.entries(views)) {
    el.classList.toggle('hidden', key !== name);
  }
  $('btn-home').classList.toggle('hidden', name === 'hub');
  renderHud();
}

function renderHud() {
  const rank = getManagerRank(state.totalXp);
  const minute = getMatchMinute(state);
  $('hud-clock').textContent = `${String(minute).padStart(2, '0')}'`;
  $('hud-rank').textContent = rank.title;
  $('hud-xp').textContent = String(state.totalXp);
  $('hud-combo').textContent = String(state.combo);
  $('hud-stamina').textContent = '⚡'.repeat(state.stamina) + '·'.repeat(Math.max(0, 3 - state.stamina));
}

function renderHub() {
  const prepEl = $('hub-prep');
  prepEl.innerHTML = '';

  for (const b of TACTICAL_BRIEFINGS) {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <span class="pill pill-gold">${b.badge}</span>
        <h4>${b.title}</h4>
        <p>${b.rules[0]}</p>
      </div>
      <button class="btn btn-secondary" type="button">Read Briefing</button>
    `;
    card.querySelector('button').addEventListener('click', () => openBriefing(b.id));
    prepEl.appendChild(card);
  }

  const sorterCard = document.createElement('article');
  sorterCard.className = 'card';
  sorterCard.innerHTML = `
    <div>
      <span class="pill pill-pitch">Drill 1 • 12 Clues</span>
      <h4>Referee's Whistle</h4>
      <p>Sort matchday time signals into Present Simple or Present Continuous.</p>
    </div>
    <button class="btn btn-primary" type="button">Start Whistle Drill</button>
  `;
  sorterCard.querySelector('button').addEventListener('click', startSorter);
  prepEl.appendChild(sorterCard);

  const builderCard = document.createElement('article');
  builderCard.className = 'card';
  builderCard.innerHTML = `
    <div>
      <span class="pill pill-pitch">Drill 2 • ${TACTIC_BUILDERS.length} Tactics</span>
      <h4>Tactic Sentence Builder</h4>
      <p>Connect word tiles in the right order to build clean matchday sentences.</p>
    </div>
    <button class="btn btn-primary" type="button">Build Tactics</button>
  `;
  builderCard.querySelector('button').addEventListener('click', startBuilder);
  prepEl.appendChild(builderCard);

  const stagesEl = $('hub-stages');
  stagesEl.innerHTML = '';

  for (const stage of MATCH_STAGES) {
    const trophies = state.completedStages[stage.id] ?? 0;
    const badgeText = trophies > 0 ? '🏆'.repeat(trophies) : stage.halfLabel;
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div>
        <span class="pill ${trophies > 0 ? 'pill-gold' : 'pill-pitch'}">${badgeText}</span>
        <h4>${stage.title}</h4>
        <p>${stage.subtitle} (${stage.questions.length} questions)</p>
      </div>
      <button class="btn btn-primary" type="button">${trophies > 0 ? 'Replay Quarter' : 'Kick Off'}</button>
    `;
    card.querySelector('button').addEventListener('click', () => beginStage(stage.id));
    stagesEl.appendChild(card);
  }

  showView('hub');
}

function openBriefing(briefingId) {
  const b = TACTICAL_BRIEFINGS.find((item) => item.id === briefingId);
  if (!b) return;

  $('briefing-badge').textContent = b.badge;
  $('briefing-title').textContent = b.title;
  $('briefing-simple').textContent = b.formula.simple;
  $('briefing-cont').textContent = b.formula.continuous;
  $('briefing-stative').textContent = b.formula.stative;

  const rulesEl = $('briefing-rules');
  rulesEl.innerHTML = '';
  for (const rule of b.rules) {
    const li = document.createElement('li');
    li.textContent = rule;
    rulesEl.appendChild(li);
  }

  const signalsEl = $('briefing-signals');
  signalsEl.innerHTML = '';
  for (const sig of b.signals) {
    const span = document.createElement('span');
    span.className = 'chip';
    span.textContent = sig;
    signalsEl.appendChild(span);
  }

  const examplesEl = $('briefing-examples');
  examplesEl.innerHTML = '';
  for (const ex of b.examples) {
    const div = document.createElement('div');
    div.className = 'example-item';
    div.innerHTML = `<strong>${ex.en}</strong><small>${ex.note}</small>`;
    examplesEl.appendChild(div);
  }

  showView('briefing');
}

function startSorter() {
  sorterState = { index: 0, score: 0, answered: false };
  renderSorter();
  showView('sorter');
}

function renderSorter() {
  const item = PITCH_SIGNALS[sorterState.index];
  const pct = Math.round((sorterState.index / PITCH_SIGNALS.length) * 100);
  $('sorter-progress-bar').style.width = `${pct}%`;
  $('sorter-counter').textContent = `Clue ${sorterState.index + 1} of ${PITCH_SIGNALS.length}  •  Score: ${sorterState.score}`;
  $('sorter-phrase').textContent = item.phrase;

  const feedback = $('sorter-feedback');
  feedback.classList.add('hidden');
  feedback.classList.remove('is-correct', 'is-wrong');

  $('btn-sort-simple').disabled = false;
  $('btn-sort-continuous').disabled = false;
  $('btn-sort-simple').classList.remove('is-correct', 'is-wrong');
  $('btn-sort-continuous').classList.remove('is-correct', 'is-wrong');
}

function answerSorter(choice) {
  if (sorterState.answered) return;
  sorterState.answered = true;

  const item = PITCH_SIGNALS[sorterState.index];
  const isCorrect = item.tense === choice;
  if (isCorrect) {
    sorterState.score += 1;
    state = { ...state, totalXp: state.totalXp + 5 };
    saveProgress(window.localStorage, state);
    renderHud();
    playSound('goal');
  } else {
    playSound('foul');
  }

  const chosenBtn = choice === 'simple' ? $('btn-sort-simple') : $('btn-sort-continuous');
  chosenBtn.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
  $('btn-sort-simple').disabled = true;
  $('btn-sort-continuous').disabled = true;

  const feedback = $('sorter-feedback');
  feedback.classList.remove('hidden');
  feedback.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
  $('sorter-feedback-text').textContent = `${isCorrect ? 'Clean tackle (+5 XP)!' : 'Offside!'} ${item.hint}`;
  $('btn-sorter-next').textContent =
    sorterState.index + 1 >= PITCH_SIGNALS.length ? 'Finish Drill' : 'Next Clue';
}

function advanceSorter() {
  if (!sorterState.answered) return;
  if (sorterState.index + 1 >= PITCH_SIGNALS.length) {
    renderHub();
    return;
  }
  sorterState.index += 1;
  sorterState.answered = false;
  renderSorter();
}

function shuffleTokens(tokens) {
  const arr = [...tokens];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  if (arr.join(' ') === tokens.join(' ') && arr.length > 1) {
    [arr[0], arr[1]] = [arr[1], arr[0]];
  }
  return arr;
}

function startBuilder() {
  const first = TACTIC_BUILDERS[0];
  builderState = {
    index: 0,
    score: 0,
    answered: false,
    pool: shuffleTokens(first.tokens),
    chosenIndices: []
  };
  renderBuilder();
  showView('builder');
}

function renderBuilder() {
  const item = TACTIC_BUILDERS[builderState.index];
  const pct = Math.round((builderState.index / TACTIC_BUILDERS.length) * 100);
  $('builder-tense-badge').textContent = item.tense;
  $('builder-prompt').textContent = item.prompt;
  $('builder-progress-bar').style.width = `${pct}%`;
  $('builder-counter').textContent = `Tactic ${builderState.index + 1} of ${TACTIC_BUILDERS.length}  •  Score: ${builderState.score}`;

  const selectedEl = $('builder-selected');
  selectedEl.innerHTML = '';
  if (builderState.chosenIndices.length === 0) {
    const hint = document.createElement('span');
    hint.className = 'muted';
    hint.textContent = 'Tap word tiles below in order...';
    selectedEl.appendChild(hint);
  } else {
    builderState.chosenIndices.forEach((poolIdx, pos) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'token-btn is-selected';
      btn.textContent = builderState.pool[poolIdx];
      btn.disabled = builderState.answered;
      btn.addEventListener('click', () => {
        if (builderState.answered) return;
        builderState.chosenIndices.splice(pos, 1);
        renderBuilder();
      });
      selectedEl.appendChild(btn);
    });
  }

  const bankEl = $('builder-bank');
  bankEl.innerHTML = '';
  builderState.pool.forEach((word, poolIdx) => {
    if (builderState.chosenIndices.includes(poolIdx)) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'token-btn';
    btn.textContent = word;
    btn.disabled = builderState.answered;
    btn.addEventListener('click', () => {
      if (builderState.answered) return;
      builderState.chosenIndices.push(poolIdx);
      renderBuilder();
    });
    bankEl.appendChild(btn);
  });

  $('btn-builder-clear').disabled = builderState.answered || builderState.chosenIndices.length === 0;
  $('btn-builder-check').disabled =
    builderState.answered || builderState.chosenIndices.length !== item.tokens.length;

  const feedback = $('builder-feedback');
  if (!builderState.answered) {
    feedback.classList.add('hidden');
    feedback.classList.remove('is-correct', 'is-wrong');
  }
}

function checkBuilder() {
  if (builderState.answered) return;
  const item = TACTIC_BUILDERS[builderState.index];
  if (builderState.chosenIndices.length !== item.tokens.length) return;

  builderState.answered = true;
  const built = builderState.chosenIndices.map((idx) => builderState.pool[idx]).join(' ');
  const target = item.tokens.join(' ');
  const isCorrect = built === target;

  if (isCorrect) {
    builderState.score += 1;
    state = { ...state, totalXp: state.totalXp + 15 };
    saveProgress(window.localStorage, state);
    renderHud();
    playSound('goal');
  } else {
    playSound('foul');
  }

  const feedback = $('builder-feedback');
  feedback.classList.remove('hidden', 'is-correct', 'is-wrong');
  feedback.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
  $('builder-feedback-text').textContent = isCorrect
    ? `Great pass (+15 XP)! ${item.explanation}`
    : `Expected: "${target}" — ${item.explanation}`;
  $('btn-builder-next').textContent =
    builderState.index + 1 >= TACTIC_BUILDERS.length ? 'Finish Drill' : 'Next Tactic';

  renderBuilder();
}

function advanceBuilder() {
  if (!builderState.answered) return;
  if (builderState.index + 1 >= TACTIC_BUILDERS.length) {
    renderHub();
    return;
  }
  const nextIdx = builderState.index + 1;
  builderState = {
    ...builderState,
    index: nextIdx,
    answered: false,
    pool: shuffleTokens(TACTIC_BUILDERS[nextIdx].tokens),
    chosenIndices: []
  };
  renderBuilder();
}

function pickArcadeQuestions(count) {
  const all = MATCH_STAGES.flatMap((s) => s.questions);
  const copy = [...all];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

function spawnGoalConfetti() {
  confetti = Array.from({ length: 36 }, () => ({
    x: PENALTY_X + (Math.random() - 0.5) * 260,
    y: GOAL_LINE_Y,
    vx: (Math.random() - 0.5) * 260,
    vy: -120 - Math.random() * 180,
    color: ['#facc15', '#4ade80', '#38bdf8', '#f472b6'][Math.floor(Math.random() * 4)],
    life: 1.4
  }));
}

function startArcadeMatch() {
  arcadeQuestions = pickArcadeQuestions(5);
  arcadeState = createShootoutState(5);
  confetti = [];
  renderArcadeUI();
  showView('pitch');
  arcadeLastTs = performance.now();
  if (arcadeRafId !== null) cancelAnimationFrame(arcadeRafId);
  arcadeRafId = requestAnimationFrame(arcadeLoop);
}

function renderArcadeUI() {
  $('arcade-player-score').textContent = String(arcadeState.playerScore);
  $('arcade-rival-score').textContent = String(arcadeState.rivalScore);
  $('arcade-round-label').textContent = `Round ${arcadeState.round} / ${arcadeState.totalRounds}`;

  const qBox = $('arcade-question-box');
  const hintBar = $('arcade-controls-hint');
  const resBar = $('arcade-result-bar');

  if (arcadeState.phase === 'question') {
    $('arcade-status-text').textContent = 'Answer the LGS question to power up your shot!';
    qBox.classList.remove('hidden');
    hintBar.classList.add('hidden');
    resBar.classList.add('hidden');

    const q = arcadeQuestions[arcadeState.round - 1];
    const ctxEl = $('arcade-context');
    if (q.context) {
      ctxEl.textContent = q.context;
      ctxEl.classList.remove('hidden');
    } else {
      ctxEl.classList.add('hidden');
    }
    $('arcade-prompt').textContent = q.prompt;

    const optsEl = $('arcade-options');
    optsEl.innerHTML = '';
    q.options.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-choice';
      btn.innerHTML = `<span class="choice-key">${idx + 1}</span><span>${opt}</span>`;
      btn.addEventListener('click', () => handleArcadeAnswer(idx));
      optsEl.appendChild(btn);
    });
  } else if (arcadeState.phase === 'aim' || arcadeState.phase === 'flying') {
    $('arcade-status-text').textContent = arcadeState.superShot
      ? '🔥 SUPER SHOT READY! Aim & Shoot!'
      : '⚠️ PRESSURE SHOT! Beat the fast keeper!';
    qBox.classList.add('hidden');
    hintBar.classList.remove('hidden');
    resBar.classList.add('hidden');
  } else if (arcadeState.phase === 'result') {
    qBox.classList.add('hidden');
    hintBar.classList.add('hidden');
    resBar.classList.remove('hidden', 'is-correct', 'is-wrong');
    const isGoal = arcadeState.lastOutcome === 'goal';
    resBar.classList.add(isGoal ? 'is-correct' : 'is-wrong');
    $('arcade-result-title').textContent = isGoal
      ? 'GOOOAL! What a strike!'
      : arcadeState.lastOutcome === 'saved'
        ? 'SAVED by the Goalkeeper!'
        : 'WIDE! Missed the goal!';
    $('arcade-result-desc').textContent = isGoal
      ? '+35 XP earned! Ready for the next round?'
      : arcadeState.superShot
        ? 'Your English answer protected you from a Rival counter-goal.'
        : 'Rival FC scored on the counter-attack!';
    $('btn-arcade-next').textContent =
      arcadeState.round >= arcadeState.totalRounds ? 'See Final Score (Enter)' : 'Next Round (Enter)';
  } else if (arcadeState.phase === 'finished') {
    qBox.classList.add('hidden');
    hintBar.classList.add('hidden');
    resBar.classList.remove('hidden', 'is-correct', 'is-wrong');
    const won = arcadeState.playerScore > arcadeState.rivalScore;
    const draw = arcadeState.playerScore === arcadeState.rivalScore;
    resBar.classList.add(won || draw ? 'is-correct' : 'is-wrong');
    $('arcade-result-title').textContent = won
      ? `🏆 FULL TIME: Anatolia United Wins ${arcadeState.playerScore}-${arcadeState.rivalScore}!`
      : draw
        ? `🤝 FULL TIME: Draw ${arcadeState.playerScore}-${arcadeState.rivalScore}!`
        : `⚽ FULL TIME: Rival FC Wins ${arcadeState.rivalScore}-${arcadeState.playerScore}`;
    $('arcade-result-desc').textContent = 'Play again or return to the Locker Room for more quarters.';
    $('btn-arcade-next').textContent = 'Play Again';
  }
}

function handleArcadeAnswer(idx) {
  if (arcadeState.phase !== 'question') return;
  const q = arcadeQuestions[arcadeState.round - 1];
  const isCorrect = idx === q.correctIndex;
  if (isCorrect) {
    state = { ...state, totalXp: state.totalXp + 15 };
    saveProgress(window.localStorage, state);
    renderHud();
    playSound('goal');
  } else {
    playSound('foul');
  }
  arcadeState = applyQuestionOutcome(arcadeState, isCorrect);
  renderArcadeUI();
}

function handleArcadeAdvance() {
  if (arcadeState.phase === 'finished') {
    startArcadeMatch();
    return;
  }
  if (arcadeState.phase !== 'result') return;
  arcadeState = advanceShootoutRound(arcadeState);
  if (arcadeState.phase === 'finished') {
    playSound('fulltime');
  }
  renderArcadeUI();
}

function drawPitch() {
  const canvas = $('pitch-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Grass stripes
  for (let i = 0; i < 8; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#166534';
    ctx.fillRect(0, i * (PITCH_HEIGHT / 8), PITCH_WIDTH, PITCH_HEIGHT / 8);
  }

  // Penalty box lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 3;
  ctx.strokeRect(80, GOAL_LINE_Y, 480, 220);
  ctx.strokeRect(200, GOAL_LINE_Y, 240, 86);

  // Penalty spot
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(PENALTY_X, PENALTY_Y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Goal net & posts
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.fillRect(GOAL_LEFT, GOAL_TOP, GOAL_RIGHT - GOAL_LEFT, GOAL_LINE_Y - GOAL_TOP);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(GOAL_LEFT, GOAL_LINE_Y);
  ctx.lineTo(GOAL_LEFT, GOAL_TOP);
  ctx.lineTo(GOAL_RIGHT, GOAL_TOP);
  ctx.lineTo(GOAL_RIGHT, GOAL_LINE_Y);
  ctx.stroke();

  // Goalkeeper
  const kx = arcadeState.keeperX;
  const ky = GOAL_LINE_Y - 12;
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(kx - arcadeState.keeperWidth / 2, ky - 24, arcadeState.keeperWidth, 24);
  ctx.fillStyle = '#fef08a';
  ctx.beginPath();
  ctx.arc(kx, ky - 34, 11, 0, Math.PI * 2);
  ctx.fill();
  // Gloves
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(kx - arcadeState.keeperWidth / 2 - 4, ky - 14, 7, 0, Math.PI * 2);
  ctx.arc(kx + arcadeState.keeperWidth / 2 + 4, ky - 14, 7, 0, Math.PI * 2);
  ctx.fill();

  // Aiming reticle during 'aim' phase
  if (arcadeState.phase === 'aim') {
    ctx.strokeStyle = arcadeState.superShot ? '#facc15' : '#f87171';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(arcadeState.aimX, arcadeState.aimY, 16, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(arcadeState.aimX - 22, arcadeState.aimY);
    ctx.lineTo(arcadeState.aimX + 22, arcadeState.aimY);
    ctx.moveTo(arcadeState.aimX, arcadeState.aimY - 22);
    ctx.lineTo(arcadeState.aimX, arcadeState.aimY + 22);
    ctx.stroke();
  }

  // Soccer ball
  const ballScale = arcadeState.phase === 'flying'
    ? Math.max(0.62, 1 - (PENALTY_Y - arcadeState.ballY) / 360)
    : 1;
  const r = 13 * ballScale;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(arcadeState.ballX, arcadeState.ballY, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Confetti
  for (const p of confetti) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 7, 7);
  }
}

function arcadeLoop(now) {
  if (activeView !== 'pitch') return;
  const dt = Math.min(0.05, (now - arcadeLastTs) / 1000);
  arcadeLastTs = now;

  const prevPhase = arcadeState.phase;
  arcadeState = stepKeeper(arcadeState, dt);
  arcadeState = stepBall(arcadeState, dt);

  if (prevPhase === 'flying' && arcadeState.phase === 'result') {
    if (arcadeState.lastOutcome === 'goal') {
      state = { ...state, totalXp: state.totalXp + 35 };
      saveProgress(window.localStorage, state);
      renderHud();
      spawnGoalConfetti();
      playSound('fulltime');
    } else {
      playSound('foul');
    }
    renderArcadeUI();
  }

  confetti = confetti
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vy: p.vy + 320 * dt,
      life: p.life - dt
    }))
    .filter((p) => p.life > 0);

  drawPitch();
  arcadeRafId = requestAnimationFrame(arcadeLoop);
}

function beginStage(stageId) {
  state = startStage(state, stageId);
  renderQuiz();
  showView('quiz');
}

function formatTypeBadge(type) {
  if (type === 'dialogue') return 'Locker Dialogue';
  if (type === 'spot_error') return 'Spot & Fix Error';
  if (type === 'table') return 'Stats / Table';
  if (type === 'reading') return 'Match Reading';
  return 'Multiple Choice';
}

function renderQuiz() {
  const stage = state.stages.find((s) => s.id === state.activeStageId);
  if (!stage) return;

  const q = stage.questions[state.questionIndex];
  const pct = Math.round((state.questionIndex / stage.questions.length) * 100);

  $('quiz-stage-label').textContent = `${stage.halfLabel} • ${stage.title}`;
  $('quiz-type-badge').textContent = formatTypeBadge(q.type);
  $('quiz-progress-bar').style.width = `${pct}%`;
  $('quiz-counter').textContent = `Play ${state.questionIndex + 1} of ${stage.questions.length}  •  Goals: ${state.goals}`;

  const varBtn = $('btn-quiz-var');
  varBtn.textContent = `VAR 50/50 (${state.varHintsRemaining})`;
  varBtn.disabled =
    state.varHintsRemaining <= 0 || state.lastResult !== null || state.eliminatedOptions.length > 0;

  const contextEl = $('quiz-context');
  if (q.context) {
    contextEl.textContent = q.context;
    contextEl.classList.remove('hidden');
  } else {
    contextEl.textContent = '';
    contextEl.classList.add('hidden');
  }

  $('quiz-prompt').textContent = q.prompt;

  const optionsEl = $('quiz-options');
  optionsEl.innerHTML = '';

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-choice';
    btn.innerHTML = `<span class="choice-key">${idx + 1}</span><span>${opt}</span>`;

    const isEliminated = state.eliminatedOptions.includes(idx);

    if (state.lastResult) {
      btn.disabled = true;
      if (idx === state.lastResult.correctIndex) {
        btn.classList.add('is-correct');
      } else if (idx === state.lastResult.selectedIndex && !state.lastResult.isCorrect) {
        btn.classList.add('is-wrong');
      }
    } else if (isEliminated) {
      btn.disabled = true;
      btn.classList.add('is-eliminated');
    } else {
      btn.addEventListener('click', () => handleAnswer(idx));
    }

    optionsEl.appendChild(btn);
  });

  const feedbackEl = $('quiz-feedback');
  if (state.lastResult) {
    feedbackEl.classList.remove('hidden', 'is-correct', 'is-wrong');
    feedbackEl.classList.add(state.lastResult.isCorrect ? 'is-correct' : 'is-wrong');
    $('quiz-feedback-title').textContent = state.lastResult.isCorrect
      ? `GOOOAL! +${state.lastResult.earnedXp} XP`
      : 'Yellow Card! -1 Stamina';
    $('quiz-feedback-explanation').textContent = state.lastResult.explanation;
    $('btn-quiz-next').textContent =
      state.status === 'gameover' ? 'Full-Time Report (Enter)' : 'Next Play (Enter)';
  } else {
    feedbackEl.classList.add('hidden');
  }

  renderHud();
}

function handleAnswer(optionIndex) {
  if (state.eliminatedOptions.includes(optionIndex)) return;
  state = submitAnswer(state, optionIndex);
  saveProgress(window.localStorage, state);
  playSound(state.lastResult?.isCorrect ? 'goal' : 'foul');
  renderQuiz();
}

function handleAdvanceQuiz() {
  if (!state.lastResult) return;
  if (state.status === 'gameover') {
    renderSummary();
    return;
  }

  state = nextQuestion(state);
  saveProgress(window.localStorage, state);

  if (state.status === 'stage_complete') {
    playSound('fulltime');
    renderSummary();
  } else {
    renderQuiz();
  }
}

function renderSummary() {
  const summary = getStageSummary(state);
  const isGameOver = state.status === 'gameover';

  $('summary-trophies').textContent = isGameOver
    ? '🟥'
    : summary.trophies > 0
      ? '🏆'.repeat(summary.trophies)
      : '⚽';
  $('summary-title').textContent = isGameOver
    ? 'Out of Stamina!'
    : summary.passed
      ? 'Quarter Won!'
      : 'Full Time — Try Again!';
  $('summary-subtitle').textContent = isGameOver
    ? 'Review the video analysis below, then replay this quarter.'
    : `You scored ${summary.goals} goals out of ${summary.totalCount} plays.`;

  $('summary-goals').textContent = `${summary.goals}/${summary.totalCount}`;
  $('summary-accuracy').textContent = `${summary.accuracy}%`;
  $('summary-xp').textContent = `+${summary.earnedXp}`;

  const mistakesBox = $('summary-mistakes');
  const mistakesList = $('summary-mistakes-list');
  mistakesList.innerHTML = '';

  if (summary.mistakes.length > 0) {
    mistakesBox.classList.remove('hidden');
    for (const m of summary.mistakes) {
      const div = document.createElement('div');
      div.className = 'mistake-item';
      div.innerHTML = `
        <strong>${m.prompt}</strong>
        <div>Your play: <em>${m.selectedOption}</em> &nbsp;|&nbsp; Winning play: <strong>${m.correctOption}</strong></div>
        <small>${m.explanation}</small>
      `;
      mistakesList.appendChild(div);
    }
  } else {
    mistakesBox.classList.add('hidden');
  }

  showView('summary');
}

$('btn-sound').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  $('btn-sound').textContent = soundEnabled ? 'Sound: On' : 'Sound: Off';
  $('btn-sound').setAttribute('aria-pressed', String(!soundEnabled));
});

$('btn-home').addEventListener('click', renderHub);
$('btn-play-arcade').addEventListener('click', startArcadeMatch);
$('btn-arcade-next').addEventListener('click', handleArcadeAdvance);

const pitchCanvas = $('pitch-canvas');
if (pitchCanvas) {
  const updateAimFromPointer = (clientX, clientY) => {
    if (arcadeState.phase !== 'aim') return;
    const rect = pitchCanvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * PITCH_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * PITCH_HEIGHT;
    arcadeState = {
      ...arcadeState,
      aimX: Math.max(GOAL_LEFT - 18, Math.min(GOAL_RIGHT + 18, x)),
      aimY: Math.max(GOAL_TOP - 8, Math.min(GOAL_LINE_Y - 6, y))
    };
  };

  pitchCanvas.addEventListener('pointermove', (e) => updateAimFromPointer(e.clientX, e.clientY));
  pitchCanvas.addEventListener('pointerdown', (e) => {
    if (arcadeState.phase !== 'aim') return;
    updateAimFromPointer(e.clientX, e.clientY);
    arcadeState = launchShot(arcadeState);
    renderArcadeUI();
  });
}
$('btn-briefing-back').addEventListener('click', renderHub);
$('btn-briefing-drill').addEventListener('click', startSorter);
$('btn-sort-simple').addEventListener('click', () => answerSorter('simple'));
$('btn-sort-continuous').addEventListener('click', () => answerSorter('continuous'));
$('btn-sorter-next').addEventListener('click', advanceSorter);

$('btn-builder-clear').addEventListener('click', () => {
  if (builderState.answered) return;
  builderState.chosenIndices = [];
  renderBuilder();
});
$('btn-builder-check').addEventListener('click', checkBuilder);
$('btn-builder-next').addEventListener('click', advanceBuilder);

$('btn-quiz-var').addEventListener('click', () => {
  state = useVarHint(state);
  renderQuiz();
});
$('btn-quiz-next').addEventListener('click', handleAdvanceQuiz);
$('btn-summary-retry').addEventListener('click', () => {
  if (state.activeStageId) beginStage(state.activeStageId);
});
$('btn-summary-map').addEventListener('click', renderHub);

$('btn-reset-progress').addEventListener('click', () => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
  state = createMatchState(MATCH_STAGES);
  renderHub();
});

document.addEventListener('keydown', (event) => {
  if (activeView === 'quiz') {
    if (!state.lastResult && ['1', '2', '3', '4'].includes(event.key)) {
      handleAnswer(Number(event.key) - 1);
    } else if (state.lastResult && event.key === 'Enter') {
      event.preventDefault();
      handleAdvanceQuiz();
    }
  } else if (activeView === 'sorter') {
    if (!sorterState.answered && event.key === '1') answerSorter('simple');
    else if (!sorterState.answered && event.key === '2') answerSorter('continuous');
    else if (sorterState.answered && event.key === 'Enter') {
      event.preventDefault();
      advanceSorter();
    }
  } else if (activeView === 'pitch') {
    if (arcadeState.phase === 'question' && ['1', '2', '3', '4'].includes(event.key)) {
      handleArcadeAnswer(Number(event.key) - 1);
    } else if (arcadeState.phase === 'aim') {
      if (event.key === 'ArrowLeft') { event.preventDefault(); arcadeState = moveAim(arcadeState, -22, 0); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); arcadeState = moveAim(arcadeState, 22, 0); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); arcadeState = moveAim(arcadeState, 0, -14); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); arcadeState = moveAim(arcadeState, 0, 14); }
      else if (event.key === ' ') {
        event.preventDefault();
        arcadeState = launchShot(arcadeState);
        renderArcadeUI();
      }
    } else if ((arcadeState.phase === 'result' || arcadeState.phase === 'finished') && event.key === 'Enter') {
      event.preventDefault();
      handleArcadeAdvance();
    }
  }
});

renderHub();
