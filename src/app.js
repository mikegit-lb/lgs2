import {
  TACTICAL_BRIEFINGS,
  PITCH_SIGNALS,
  TACTIC_BUILDERS,
  FILL_IN_BLANKS,
  MATCHING_ROUNDS,
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
  checkFillBlank,
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
  setCurve,
  moveAim,
  stepKeeper,
  launchPass,
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
  fill: $('view-fill'),
  matching: $('view-matching'),
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
let fillState = { index: 0, score: 0, answered: false };
let matchState = { roundIndex: 0, selectedLeftId: null, matchedIds: new Set(), rightOrder: [], wrongRightId: null };
let arcadeState = createShootoutState(6);
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

  const fillCard = document.createElement('article');
  fillCard.className = 'card';
  fillCard.innerHTML = `
    <div>
      <span class="pill pill-gold">Drill 3 • ${FILL_IN_BLANKS.length} Blanks</span>
      <h4>Fill in the Blanks</h4>
      <p>Type the exact Present Simple or Continuous verb form to complete football plays.</p>
    </div>
    <button class="btn btn-primary" type="button">Start Fill-in-Blanks</button>
  `;
  fillCard.querySelector('button').addEventListener('click', startFill);
  prepEl.appendChild(fillCard);

  const matchCard = document.createElement('article');
  matchCard.className = 'card';
  matchCard.innerHTML = `
    <div>
      <span class="pill pill-gold">Drill 4 • ${MATCHING_ROUNDS.length} Boards</span>
      <h4>Match the Pairs</h4>
      <p>Link time clues, Q&amp;As, and stative verbs to their matching pitch endings.</p>
    </div>
    <button class="btn btn-primary" type="button">Play Matching</button>
  `;
  matchCard.querySelector('button').addEventListener('click', startMatching);
  prepEl.appendChild(matchCard);

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

function startFill() {
  fillState = { index: 0, score: 0, answered: false };
  renderFill();
  showView('fill');
}

function renderFill() {
  const item = FILL_IN_BLANKS[fillState.index];
  const pct = Math.round((fillState.index / FILL_IN_BLANKS.length) * 100);
  $('fill-hint-badge').textContent = item.tenseHint;
  $('fill-progress-bar').style.width = `${pct}%`;
  $('fill-counter').textContent = `Blank ${fillState.index + 1} of ${FILL_IN_BLANKS.length}  •  Score: ${fillState.score}`;
  $('fill-sentence').textContent = item.sentence;

  const input = $('fill-input');
  input.value = '';
  input.disabled = false;
  $('btn-fill-check').disabled = false;

  const fb = $('fill-feedback');
  fb.classList.add('hidden');
  fb.classList.remove('is-correct', 'is-wrong');
  setTimeout(() => input.focus(), 0);
}

function submitFill() {
  if (fillState.answered) return;
  const input = $('fill-input');
  const raw = input.value.trim();
  if (!raw) return;

  fillState.answered = true;
  input.disabled = true;
  $('btn-fill-check').disabled = true;

  const item = FILL_IN_BLANKS[fillState.index];
  const isCorrect = checkFillBlank(item, raw);
  if (isCorrect) {
    fillState.score += 1;
    state = { ...state, totalXp: state.totalXp + 15 };
    saveProgress(window.localStorage, state);
    renderHud();
    playSound('goal');
  } else {
    playSound('foul');
  }

  const fb = $('fill-feedback');
  fb.classList.remove('hidden', 'is-correct', 'is-wrong');
  fb.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
  $('fill-feedback-text').textContent = isCorrect
    ? `Correct (+15 XP)! ${item.explanation}`
    : `Expected: "${item.acceptedAnswers[0]}" — ${item.explanation}`;
  $('btn-fill-next').textContent =
    fillState.index + 1 >= FILL_IN_BLANKS.length ? 'Finish Fill-in-Blanks' : 'Next Blank (Enter)';
}

function advanceFill() {
  if (!fillState.answered) return;
  if (fillState.index + 1 >= FILL_IN_BLANKS.length) {
    renderHub();
    return;
  }
  fillState.index += 1;
  fillState.answered = false;
  renderFill();
}

function startMatching() {
  matchState = {
    roundIndex: 0,
    selectedLeftId: null,
    matchedIds: new Set(),
    rightOrder: shuffleTokens(MATCHING_ROUNDS[0].pairs),
    wrongRightId: null
  };
  renderMatching();
  showView('matching');
}

function renderMatching() {
  const round = MATCHING_ROUNDS[matchState.roundIndex];
  $('match-title').textContent = round.title;
  $('match-subtitle').textContent = round.subtitle;
  $('match-counter').textContent = `Board ${matchState.roundIndex + 1} of ${MATCHING_ROUNDS.length}  •  Matched: ${matchState.matchedIds.size} / ${round.pairs.length}`;

  const leftCol = $('match-left-col');
  leftCol.innerHTML = '';
  for (const pair of round.pairs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'match-card';
    btn.textContent = pair.left;
    if (matchState.matchedIds.has(pair.id)) {
      btn.classList.add('is-matched');
      btn.disabled = true;
    } else {
      if (matchState.selectedLeftId === pair.id) btn.classList.add('is-selected');
      btn.addEventListener('click', () => {
        matchState.selectedLeftId = pair.id;
        matchState.wrongRightId = null;
        renderMatching();
      });
    }
    leftCol.appendChild(btn);
  }

  const rightCol = $('match-right-col');
  rightCol.innerHTML = '';
  for (const pair of matchState.rightOrder) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'match-card';
    btn.textContent = pair.right;
    if (matchState.matchedIds.has(pair.id)) {
      btn.classList.add('is-matched');
      btn.disabled = true;
    } else {
      if (matchState.wrongRightId === pair.id) btn.classList.add('is-wrong');
      btn.addEventListener('click', () => handleMatchRight(pair.id));
    }
    rightCol.appendChild(btn);
  }

  const fb = $('match-feedback');
  if (matchState.matchedIds.size === round.pairs.length) {
    fb.classList.remove('hidden', 'is-wrong');
    fb.classList.add('is-correct');
    $('match-feedback-text').textContent = 'Board cleared! +25 XP earned!';
    $('btn-match-next').textContent =
      matchState.roundIndex + 1 >= MATCHING_ROUNDS.length ? 'Finish Matching' : 'Next Board';
  } else {
    fb.classList.add('hidden');
  }
}

function handleMatchRight(rightId) {
  if (!matchState.selectedLeftId) return;
  const round = MATCHING_ROUNDS[matchState.roundIndex];
  if (matchState.selectedLeftId === rightId) {
    matchState.matchedIds.add(rightId);
    matchState.selectedLeftId = null;
    matchState.wrongRightId = null;
    playSound('goal');
    if (matchState.matchedIds.size === round.pairs.length) {
      state = { ...state, totalXp: state.totalXp + 25 };
      saveProgress(window.localStorage, state);
      renderHud();
      playSound('fulltime');
    }
  } else {
    matchState.wrongRightId = rightId;
    playSound('foul');
  }
  renderMatching();
}

function advanceMatching() {
  if (matchState.roundIndex + 1 >= MATCHING_ROUNDS.length) {
    renderHub();
    return;
  }
  const nextIdx = matchState.roundIndex + 1;
  matchState = {
    roundIndex: nextIdx,
    selectedLeftId: null,
    matchedIds: new Set(),
    rightOrder: shuffleTokens(MATCHING_ROUNDS[nextIdx].pairs),
    wrongRightId: null
  };
  renderMatching();
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

function formatPlayType(playType) {
  if (playType === 'freekick') return '🌀 Free Kick (3-Man Wall)';
  if (playType === 'pass_play') return '🎯 Through-Ball Pass';
  return '⚽ Penalty Kick';
}

function startArcadeMatch() {
  arcadeQuestions = pickArcadeQuestions(6);
  arcadeState = createShootoutState(6);
  confetti = [];
  renderArcadeUI();
  showView('pitch');
  arcadeLastTs = performance.now();
  if (arcadeRafId !== null) cancelAnimationFrame(arcadeRafId);
  arcadeRafId = requestAnimationFrame(arcadeLoop);
}

function renderCurveButtons() {
  $('btn-curve-left').classList.toggle('is-active', arcadeState.curve < -0.1);
  $('btn-curve-zero').classList.toggle('is-active', Math.abs(arcadeState.curve) <= 0.1);
  $('btn-curve-right').classList.toggle('is-active', arcadeState.curve > 0.1);
}

function renderArcadeUI() {
  $('arcade-player-score').textContent = String(arcadeState.playerScore);
  $('arcade-rival-score').textContent = String(arcadeState.rivalScore);
  $('arcade-round-label').textContent = `Round ${arcadeState.round} / ${arcadeState.totalRounds} • ${formatPlayType(arcadeState.playType)}`;

  const qBox = $('arcade-question-box');
  const hintBar = $('arcade-controls-hint');
  const curveBar = $('curve-controls');
  const resBar = $('arcade-result-bar');

  if (arcadeState.phase === 'question') {
    $('arcade-status-text').textContent = 'Answer the LGS question to power up your play!';
    qBox.classList.remove('hidden');
    hintBar.classList.add('hidden');
    curveBar.classList.add('hidden');
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
  } else if (arcadeState.phase === 'pass' || arcadeState.phase === 'passing') {
    $('arcade-status-text').textContent = '🎯 STEP 1: Pass past the 2 defenders to your teammate!';
    $('arcade-hint-line').innerHTML = 'Aim at your <strong>blue Striker teammate</strong> • <strong>Click / Space</strong> to PASS!';
    qBox.classList.add('hidden');
    hintBar.classList.remove('hidden');
    curveBar.classList.add('hidden');
    resBar.classList.add('hidden');
  } else if (arcadeState.phase === 'aim' || arcadeState.phase === 'flying') {
    $('arcade-status-text').textContent = arcadeState.playType === 'freekick'
      ? '🌀 FREE KICK! Use Curl Left/Right (Q/E) to bend it around the wall!'
      : arcadeState.superShot
        ? '🔥 SUPER SHOT READY! Time the green PWR zone & Shoot!'
        : '⚠️ PRESSURE SHOT! Beat the fast keeper!';
    $('arcade-hint-line').innerHTML = 'Aim with <strong>Mouse / Touch / Arrows</strong> • <strong>Q/E</strong> to Curve • <strong>Click / Space</strong> to SHOOT!';
    qBox.classList.add('hidden');
    hintBar.classList.remove('hidden');
    curveBar.classList.remove('hidden');
    renderCurveButtons();
    resBar.classList.add('hidden');
  } else if (arcadeState.phase === 'result') {
    qBox.classList.add('hidden');
    hintBar.classList.add('hidden');
    curveBar.classList.add('hidden');
    resBar.classList.remove('hidden', 'is-correct', 'is-wrong');
    const isGoal = arcadeState.lastOutcome === 'goal';
    resBar.classList.add(isGoal ? 'is-correct' : 'is-wrong');
    $('arcade-result-title').textContent = isGoal
      ? 'GOOOAL! Unstoppable finish!'
      : arcadeState.lastOutcome === 'intercepted'
        ? 'INTERCEPTED! The defender cut off your pass!'
        : arcadeState.lastOutcome === 'blocked'
          ? 'BLOCKED by the Defender Wall!'
          : arcadeState.lastOutcome === 'saved'
            ? 'SAVED by the Goalkeeper!'
            : 'WIDE / OVER THE BAR!';
    $('arcade-result-desc').textContent = isGoal
      ? '+35 XP earned! Ready for the next play?'
      : arcadeState.superShot && arcadeState.round % 2 !== 0
        ? 'Your English answer protected you from a Rival counter-goal.'
        : 'Rival FC scored on the counter-attack!';
    $('btn-arcade-next').textContent =
      arcadeState.round >= arcadeState.totalRounds ? 'See Final Score (Enter)' : 'Next Play (Enter)';
  } else if (arcadeState.phase === 'finished') {
    qBox.classList.add('hidden');
    hintBar.classList.add('hidden');
    curveBar.classList.add('hidden');
    resBar.classList.remove('hidden', 'is-correct', 'is-wrong');
    const won = arcadeState.playerScore > arcadeState.rivalScore;
    const draw = arcadeState.playerScore === arcadeState.rivalScore;
    resBar.classList.add(won || draw ? 'is-correct' : 'is-wrong');
    $('arcade-result-title').textContent = won
      ? `🏆 FULL TIME: Anatolia United Wins ${arcadeState.playerScore}-${arcadeState.rivalScore}!`
      : draw
        ? `🤝 FULL TIME: Draw ${arcadeState.playerScore}-${arcadeState.rivalScore}!`
        : `⚽ FULL TIME: Rival FC Wins ${arcadeState.rivalScore}-${arcadeState.playerScore}`;
    $('arcade-result-desc').textContent = 'Play again or return to the Locker Room for more drills.';
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

  // Stadium stands & floodlights top strip
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, PITCH_WIDTH, GOAL_LINE_Y);
  const crowdColors = ['#ef4444', '#facc15', '#38bdf8', '#4ade80', '#f472b6'];
  for (let row = 0; row < 3; row += 1) {
    for (let cx = 14; cx < PITCH_WIDTH; cx += 22) {
      ctx.fillStyle = crowdColors[(cx + row * 7) % crowdColors.length];
      ctx.beginPath();
      ctx.arc(cx, 12 + row * 12, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Floodlight glow
  const glow = ctx.createRadialGradient(PENALTY_X, 0, 20, PENALTY_X, 80, 320);
  glow.addColorStop(0, 'rgba(254, 240, 138, 0.22)');
  glow.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, PITCH_WIDTH, PITCH_HEIGHT);

  // Grass stripes from goal line down
  const turfTop = GOAL_LINE_Y;
  const stripeH = (PITCH_HEIGHT - turfTop) / 6;
  for (let i = 0; i < 6; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#16a34a' : '#15803d';
    ctx.fillRect(0, turfTop + i * stripeH, PITCH_WIDTH, stripeH);
  }

  // Penalty box lines & D-arc
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.82)';
  ctx.lineWidth = 3;
  ctx.strokeRect(80, GOAL_LINE_Y, 480, 224);
  ctx.strokeRect(200, GOAL_LINE_Y, 240, 88);
  ctx.beginPath();
  ctx.arc(PENALTY_X, PENALTY_Y - 12, 48, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();

  // Penalty spot
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(PENALTY_X, PENALTY_Y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Goal net mesh & posts
  ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.fillRect(GOAL_LEFT, GOAL_TOP, GOAL_RIGHT - GOAL_LEFT, GOAL_LINE_Y - GOAL_TOP);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  for (let nx = GOAL_LEFT + 18; nx < GOAL_RIGHT; nx += 18) {
    ctx.beginPath();
    ctx.moveTo(nx, GOAL_TOP);
    ctx.lineTo(nx, GOAL_LINE_Y);
    ctx.stroke();
  }
  for (let ny = GOAL_TOP + 16; ny < GOAL_LINE_Y; ny += 16) {
    ctx.beginPath();
    ctx.moveTo(GOAL_LEFT, ny);
    ctx.lineTo(GOAL_RIGHT, ny);
    ctx.stroke();
  }
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(GOAL_LEFT, GOAL_LINE_Y);
  ctx.lineTo(GOAL_LEFT, GOAL_TOP);
  ctx.lineTo(GOAL_RIGHT, GOAL_TOP);
  ctx.lineTo(GOAL_RIGHT, GOAL_LINE_Y);
  ctx.stroke();

  // Goalkeeper (gold/black kit)
  const kx = arcadeState.keeperX;
  const ky = GOAL_LINE_Y - 8;
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(kx - arcadeState.keeperWidth / 2, ky - 26, arcadeState.keeperWidth, 24);
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(kx - 14, ky - 4, 28, 6);
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(kx, ky - 36, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(kx - arcadeState.keeperWidth / 2 - 4, ky - 16, 7.5, 0, Math.PI * 2);
  ctx.arc(kx + arcadeState.keeperWidth / 2 + 4, ky - 16, 7.5, 0, Math.PI * 2);
  ctx.fill();

  // Moving Defenders (3-man freekick wall or 2 midfielders)
  for (const def of arcadeState.defenders) {
    const dx = def.x;
    const dy = def.y;
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(dx - def.width / 2, dy - 26, def.width, 24);
    ctx.fillStyle = '#991b1b';
    ctx.fillRect(dx - 11, dy - 2, 22, 8);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(dx, dy - 35, 9.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('DEF', dx, dy - 10);
  }

  // Teammate striker during pass_play
  if (arcadeState.teammateX !== null && (arcadeState.phase === 'pass' || arcadeState.phase === 'passing')) {
    const mx = arcadeState.teammateX;
    const my = arcadeState.teammateY;
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.arc(mx, my - 10, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#0284c7';
    ctx.fillRect(mx - 14, my - 22, 28, 22);
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.arc(mx, my - 31, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PASS', mx, my - 7);
  }

  // Striker / Kicker at ball start position
  ctx.fillStyle = '#0284c7';
  ctx.fillRect(arcadeState.startX - 14, arcadeState.startY + 14, 28, 22);
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(arcadeState.startX, arcadeState.startY + 6, 9, 0, Math.PI * 2);
  ctx.fill();

  // Dotted curved flight preview during 'aim' or 'pass'
  if (arcadeState.phase === 'aim' || arcadeState.phase === 'pass') {
    const targetY = arcadeState.phase === 'pass' ? (arcadeState.teammateY ?? 222) : arcadeState.aimY;
    const midX = (arcadeState.ballX + arcadeState.aimX) / 2 - (arcadeState.phase === 'aim' ? arcadeState.curve * 75 : 0);
    const midY = (arcadeState.ballY + targetY) / 2;

    ctx.strokeStyle = arcadeState.phase === 'pass' ? 'rgba(74, 222, 128, 0.85)' : 'rgba(250, 204, 21, 0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(arcadeState.ballX, arcadeState.ballY);
    ctx.quadraticCurveTo(midX, midY, arcadeState.aimX, targetY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = arcadeState.superShot ? '#facc15' : '#f87171';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(arcadeState.aimX, targetY, 15, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Power Meter during 'aim' phase
  if (arcadeState.phase === 'aim') {
    const barX = 576;
    const barY = 175;
    const barW = 24;
    const barH = 150;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(barX - 4, barY - 22, barW + 8, barH + 30);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PWR', barX + barW / 2, barY - 7);

    ctx.fillStyle = '#dc2626';
    ctx.fillRect(barX, barY, barW, barH * 0.14);
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(barX, barY + barH * 0.14, barW, barH * 0.51);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(barX, barY + barH * 0.65, barW, barH * 0.35);

    const markerY = barY + (1 - arcadeState.power) * barH;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(barX - 4, markerY - 3, barW + 8, 6);
  }

  // Smooth curved ball trail
  if (arcadeState.ballTrail && arcadeState.ballTrail.length > 1) {
    ctx.strokeStyle = arcadeState.superShot ? 'rgba(250, 204, 21, 0.6)' : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(arcadeState.ballTrail[0].x, arcadeState.ballTrail[0].y);
    for (let i = 1; i < arcadeState.ballTrail.length; i += 1) {
      ctx.lineTo(arcadeState.ballTrail[i].x, arcadeState.ballTrail[i].y);
    }
    ctx.stroke();
  }

  // Spinning Soccer Ball
  const ballScale = arcadeState.phase === 'flying'
    ? Math.max(0.62, 1 - (PENALTY_Y - arcadeState.ballY) / 360)
    : 1;
  const r = 13 * ballScale;
  ctx.save();
  ctx.translate(arcadeState.ballX, arcadeState.ballY);
  ctx.rotate(arcadeState.ballSpin || 0);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Confetti
  for (const p of confetti) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 8, 8);
  }
}

function arcadeLoop(now) {
  if (activeView !== 'pitch') return;
  const dt = Math.min(0.05, (now - arcadeLastTs) / 1000);
  arcadeLastTs = now;

  const prevPhase = arcadeState.phase;
  arcadeState = stepKeeper(arcadeState, dt);
  arcadeState = stepBall(arcadeState, dt);

  if ((prevPhase === 'flying' || prevPhase === 'passing') && arcadeState.phase === 'result') {
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
  } else if (prevPhase === 'passing' && arcadeState.phase === 'aim') {
    playSound('goal');
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
$('btn-fill-check').addEventListener('click', submitFill);
$('btn-fill-next').addEventListener('click', advanceFill);
$('btn-match-next').addEventListener('click', advanceMatching);

$('btn-curve-left').addEventListener('click', () => {
  arcadeState = setCurve(arcadeState, -0.8);
  renderCurveButtons();
});
$('btn-curve-zero').addEventListener('click', () => {
  arcadeState = setCurve(arcadeState, 0);
  renderCurveButtons();
});
$('btn-curve-right').addEventListener('click', () => {
  arcadeState = setCurve(arcadeState, 0.8);
  renderCurveButtons();
});

const pitchCanvas = $('pitch-canvas');
if (pitchCanvas) {
  const updateAimFromPointer = (clientX, clientY) => {
    if (arcadeState.phase !== 'aim' && arcadeState.phase !== 'pass') return;
    const rect = pitchCanvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * PITCH_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * PITCH_HEIGHT;
    const minY = arcadeState.phase === 'pass' ? 190 : GOAL_TOP - 8;
    const maxY = arcadeState.phase === 'pass' ? 255 : GOAL_LINE_Y - 6;
    arcadeState = {
      ...arcadeState,
      aimX: Math.max(GOAL_LEFT - 18, Math.min(GOAL_RIGHT + 18, x)),
      aimY: Math.max(minY, Math.min(maxY, y))
    };
  };

  pitchCanvas.addEventListener('pointermove', (e) => updateAimFromPointer(e.clientX, e.clientY));
  pitchCanvas.addEventListener('pointerdown', (e) => {
    if (arcadeState.phase === 'pass') {
      updateAimFromPointer(e.clientX, e.clientY);
      arcadeState = launchPass(arcadeState);
      renderArcadeUI();
    } else if (arcadeState.phase === 'aim') {
      updateAimFromPointer(e.clientX, e.clientY);
      arcadeState = launchShot(arcadeState);
      renderArcadeUI();
    }
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
  } else if (activeView === 'fill') {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (!fillState.answered) submitFill();
      else advanceFill();
    }
  } else if (activeView === 'pitch') {
    if (arcadeState.phase === 'question' && ['1', '2', '3', '4'].includes(event.key)) {
      handleArcadeAnswer(Number(event.key) - 1);
    } else if (arcadeState.phase === 'pass' || arcadeState.phase === 'aim') {
      if (event.key === 'ArrowLeft') { event.preventDefault(); arcadeState = moveAim(arcadeState, -22, 0); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); arcadeState = moveAim(arcadeState, 22, 0); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); arcadeState = moveAim(arcadeState, 0, -14); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); arcadeState = moveAim(arcadeState, 0, 14); }
      else if (arcadeState.phase === 'aim' && (event.key === 'q' || event.key === 'Q')) {
        arcadeState = setCurve(arcadeState, arcadeState.curve - 0.4);
        renderCurveButtons();
      } else if (arcadeState.phase === 'aim' && (event.key === 'e' || event.key === 'E')) {
        arcadeState = setCurve(arcadeState, arcadeState.curve + 0.4);
        renderCurveButtons();
      } else if (event.key === ' ') {
        event.preventDefault();
        arcadeState = arcadeState.phase === 'pass' ? launchPass(arcadeState) : launchShot(arcadeState);
        renderArcadeUI();
      }
    } else if ((arcadeState.phase === 'result' || arcadeState.phase === 'finished') && event.key === 'Enter') {
      event.preventDefault();
      handleArcadeAdvance();
    }
  }
});

renderHub();
