import {
  TACTICAL_BRIEFINGS,
  PITCH_SIGNALS,
  TACTIC_BUILDERS,
  FILL_IN_BLANKS,
  MATCHING_ROUNDS,
  TURKISH_TEAMS,
  ARCADE_BONUS_QUESTIONS,
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
  movePlayerKeeper,
  diveKeeper,
  moveDribbler,
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
let selectedTeam = TURKISH_TEAMS[0];
let rivalTeam = TURKISH_TEAMS[1];
let cameraView = 'third_person'; // 'third_person' | 'first_person'
const keysHeld = new Set();
let pointerDragging = false;
let arcadeState = createShootoutState(10);
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

function selectTeamById(teamId) {
  const chosen = TURKISH_TEAMS.find((t) => t.id === teamId) ?? TURKISH_TEAMS[0];
  selectedTeam = chosen;
  if (chosen.id === 'gs') rivalTeam = TURKISH_TEAMS.find((t) => t.id === 'fb') ?? TURKISH_TEAMS[1];
  else if (chosen.id === 'fb') rivalTeam = TURKISH_TEAMS.find((t) => t.id === 'gs') ?? TURKISH_TEAMS[0];
  else rivalTeam = TURKISH_TEAMS.find((t) => t.id !== chosen.id) ?? TURKISH_TEAMS[0];
  renderTeamPicker();
}

function renderTeamPicker() {
  const picker = $('team-picker');
  if (!picker) return;
  picker.innerHTML = '';
  for (const team of TURKISH_TEAMS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `team-pill-btn ${team.id === selectedTeam.id ? 'is-selected' : ''}`;
    btn.innerHTML = `<span class="team-swatch" style="background:${team.jersey};box-shadow:inset 0 0 0 3px ${team.accent}"></span>${team.name}`;
    btn.addEventListener('click', () => selectTeamById(team.id));
    picker.appendChild(btn);
  }
}

function renderHub() {
  renderTeamPicker();
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
  const all = [...MATCH_STAGES.flatMap((s) => s.questions), ...ARCADE_BONUS_QUESTIONS];
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
  if (playType === 'gk_save') return '🧤 Defend as Goalkeeper!';
  if (playType === 'dribble_run') return '🏃 Dribble & Run Attack!';
  return '⚽ Penalty Kick';
}

function startArcadeMatch() {
  arcadeQuestions = pickArcadeQuestions(10);
  arcadeState = createShootoutState(10);
  confetti = [];
  keysHeld.clear();
  renderArcadeUI();
  showView('pitch');
  arcadeLastTs = performance.now();
  if (arcadeRafId !== null) cancelAnimationFrame(arcadeRafId);
  arcadeRafId = requestAnimationFrame(arcadeLoop);
}

function toggleCameraView() {
  cameraView = cameraView === 'third_person' ? 'first_person' : 'third_person';
  $('btn-camera-view').textContent = cameraView === 'first_person' ? '👁️ 1st Person (V)' : '🎥 3rd Person (V)';
}

function renderCurveButtons() {
  $('btn-curve-left').classList.toggle('is-active', arcadeState.curve < -0.1);
  $('btn-curve-zero').classList.toggle('is-active', Math.abs(arcadeState.curve) <= 0.1);
  $('btn-curve-right').classList.toggle('is-active', arcadeState.curve > 0.1);
}

function renderArcadeUI() {
  $('arcade-player-team').textContent = selectedTeam.name;
  $('arcade-rival-team').textContent = rivalTeam.name;
  $('arcade-player-score').textContent = String(arcadeState.playerScore);
  $('arcade-rival-score').textContent = String(arcadeState.rivalScore);
  $('arcade-round-label').textContent = `Round ${arcadeState.round} / ${arcadeState.totalRounds} • ${formatPlayType(arcadeState.playType)}`;
  $('btn-camera-view').textContent = cameraView === 'first_person' ? '👁️ 1st Person (V)' : '🎥 3rd Person (V)';

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
  } else if (arcadeState.phase === 'dribble') {
    $('arcade-status-text').textContent = '🏃 DRIBBLE RUN! Weave past all 3 defenders into the green box!';
    $('arcade-hint-line').innerHTML = 'Run with <strong>W A S D / Arrow Keys</strong> or <strong>Drag on Pitch</strong> to beat the defenders!';
    qBox.classList.add('hidden');
    hintBar.classList.remove('hidden');
    curveBar.classList.add('hidden');
    resBar.classList.add('hidden');
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
  } else if (arcadeState.phase === 'gk_incoming') {
    $('arcade-status-text').textContent = arcadeState.superShot
      ? '🧤 EAGLE-EYE GLOVES! Slide & Click/Space to DIVE and save!'
      : '🧤 DEFEND THE GOAL! Slide fast & Click/Space to DIVE!';
    $('arcade-hint-line').innerHTML = 'YOU are the <strong>Goalkeeper</strong>! Move with <strong>Mouse / Touch / Arrows</strong> • <strong>Click / Space</strong> to DIVE!';
    qBox.classList.add('hidden');
    hintBar.classList.remove('hidden');
    curveBar.classList.add('hidden');
    resBar.classList.add('hidden');
  } else if (arcadeState.phase === 'result') {
    qBox.classList.add('hidden');
    hintBar.classList.add('hidden');
    curveBar.classList.add('hidden');
    resBar.classList.remove('hidden', 'is-correct', 'is-wrong');
    const isPositive = arcadeState.lastOutcome === 'goal' || arcadeState.lastOutcome === 'gk_saved';
    resBar.classList.add(isPositive ? 'is-correct' : 'is-wrong');
    $('arcade-result-title').textContent = arcadeState.lastOutcome === 'goal'
      ? 'GOOOAL! Unstoppable finish!'
      : arcadeState.lastOutcome === 'gk_saved'
        ? '🧤 WORLD-CLASS SAVE! You denied Rival FC!'
        : arcadeState.lastOutcome === 'conceded'
          ? `⚽ ${rivalTeam.name.toUpperCase()} GOAL! The striker beat your dive!`
          : arcadeState.lastOutcome === 'tackled'
            ? '💥 TACKLED! The defender stole the ball on your run!'
            : arcadeState.lastOutcome === 'intercepted'
            ? 'INTERCEPTED! The defender cut off your pass!'
            : arcadeState.lastOutcome === 'blocked'
              ? 'BLOCKED by the Defender Wall!'
              : arcadeState.lastOutcome === 'saved'
                ? 'SAVED by the Goalkeeper!'
                : 'WIDE / OVER THE BAR!';
    $('arcade-result-desc').textContent = arcadeState.lastOutcome === 'goal'
      ? '+35 XP earned! Ready for the next play?'
      : arcadeState.lastOutcome === 'gk_saved'
        ? '+40 XP earned for that fingertip save!'
        : arcadeState.lastOutcome === 'conceded'
          ? 'Rival FC scored! Time to strike back.'
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
      ? `🏆 FULL TIME: ${selectedTeam.name} Wins ${arcadeState.playerScore}-${arcadeState.rivalScore}!`
      : draw
        ? `🤝 FULL TIME: Derby Draw ${arcadeState.playerScore}-${arcadeState.rivalScore}!`
        : `⚽ FULL TIME: ${rivalTeam.name} Wins ${arcadeState.rivalScore}-${arcadeState.playerScore}`;
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

function drawPlayerSprite(ctx, x, y, jerseyColor, shortsColor, number, stridePhase = 0) {
  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 15, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  const legOffset = Math.sin(stridePhase) * 4;
  // Legs & boots
  ctx.strokeStyle = '#fde68a';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 4);
  ctx.lineTo(x - 6, y + 6 + legOffset);
  ctx.moveTo(x + 5, y - 4);
  ctx.lineTo(x + 6, y + 6 - legOffset);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.fillRect(x - 9, y + 4 + legOffset, 6, 4);
  ctx.fillRect(x + 3, y + 4 - legOffset, 6, 4);

  // Shorts
  ctx.fillStyle = shortsColor;
  ctx.fillRect(x - 11, y - 10, 22, 8);

  // Jersey torso
  ctx.fillStyle = jerseyColor;
  ctx.beginPath();
  ctx.roundRect(x - 13, y - 28, 26, 20, 5);
  ctx.fill();

  // Arms
  ctx.strokeStyle = jerseyColor;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 24);
  ctx.lineTo(x - 18, y - 14 - legOffset * 0.5);
  ctx.moveTo(x + 13, y - 24);
  ctx.lineTo(x + 18, y - 14 + legOffset * 0.5);
  ctx.stroke();

  // Head & hair
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(x, y - 36, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1e293b';
  ctx.beginPath();
  ctx.arc(x, y - 39, 9, Math.PI, Math.PI * 2);
  ctx.fill();

  // Jersey number
  if (number) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(number), x, y - 14);
  }
}

function drawGoalkeeperSprite(ctx, x, y, width, diveDir, isPlayerControlled) {
  ctx.save();
  ctx.translate(x, y - 14);
  if (diveDir !== 0) {
    ctx.rotate(diveDir * 0.85);
  }

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 18, width * 0.45, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso
  ctx.fillStyle = isPlayerControlled ? '#10b981' : '#f59e0b';
  ctx.beginPath();
  ctx.roundRect(-16, -14, 32, 24, 6);
  ctx.fill();

  // Outstretched arms
  const span = diveDir !== 0 ? width * 0.68 : width * 0.48;
  ctx.strokeStyle = isPlayerControlled ? '#059669' : '#d97706';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-14, -6);
  ctx.lineTo(-span, -12);
  ctx.moveTo(14, -6);
  ctx.lineTo(span, -12);
  ctx.stroke();

  // Bright keeper gloves
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(-span, -12, 8, 0, Math.PI * 2);
  ctx.arc(span, -12, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Head
  ctx.fillStyle = '#fde68a';
  ctx.beginPath();
  ctx.arc(0, -24, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, -27, 10, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPitch() {
  const canvas = $('pitch-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const t = arcadeState.animTime || 0;

  // Stadium stands & animated crowd
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, PITCH_WIDTH, GOAL_LINE_Y);
  const crowdColors = ['#ef4444', '#facc15', '#38bdf8', '#4ade80', '#f472b6', '#ffffff'];
  for (let row = 0; row < 3; row += 1) {
    for (let cx = 14; cx < PITCH_WIDTH; cx += 20) {
      const cheerBounce = arcadeState.lastOutcome === 'goal' || arcadeState.lastOutcome === 'gk_saved'
        ? Math.sin(t * 14 + cx) * 3
        : 0;
      ctx.fillStyle = crowdColors[(cx + row * 7) % crowdColors.length];
      ctx.beginPath();
      ctx.arc(cx, 12 + row * 12 + cheerBounce, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Stadium LED ad board
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, GOAL_LINE_Y - 18, PITCH_WIDTH, 18);
  ctx.fillStyle = selectedTeam.accent;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `SÜPER LİG DERBY   •   ${selectedTeam.name.toUpperCase()} vs ${rivalTeam.name.toUpperCase()}   •   LGS CUP 2026`,
    PENALTY_X,
    GOAL_LINE_Y - 6
  );

  // Dual stadium floodlight beams
  for (const fx of [110, 530]) {
    const beam = ctx.createRadialGradient(fx, 0, 10, fx, 140, 290);
    beam.addColorStop(0, 'rgba(254, 249, 195, 0.24)');
    beam.addColorStop(1, 'rgba(15, 23, 42, 0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, PITCH_WIDTH, PITCH_HEIGHT);
  }

  // Perspective mowed grass stripes
  const turfTop = GOAL_LINE_Y;
  const stripeH = (PITCH_HEIGHT - turfTop) / 7;
  for (let i = 0; i < 7; i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#16a34a' : '#15803d';
    ctx.fillRect(0, turfTop + i * stripeH, PITCH_WIDTH, stripeH + 1);
  }

  // Perspective Penalty Box & Goal Area
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, GOAL_LINE_Y);
  ctx.lineTo(PITCH_WIDTH, GOAL_LINE_Y);
  ctx.stroke();

  // Outer 18-yard box (trapezoid perspective)
  ctx.beginPath();
  ctx.moveTo(95, GOAL_LINE_Y);
  ctx.lineTo(52, 345);
  ctx.lineTo(588, 345);
  ctx.lineTo(545, GOAL_LINE_Y);
  ctx.stroke();

  // Inner 6-yard box
  ctx.beginPath();
  ctx.moveTo(195, GOAL_LINE_Y);
  ctx.lineTo(182, 206);
  ctx.lineTo(458, 206);
  ctx.lineTo(445, GOAL_LINE_Y);
  ctx.stroke();

  // Penalty D-arc & spot
  ctx.beginPath();
  ctx.arc(PENALTY_X, PENALTY_Y - 6, 52, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(PENALTY_X, PENALTY_Y, 5, 0, Math.PI * 2);
  ctx.fill();

  // 3D Goal frame & animated net ripple
  const ripple = Math.sin(t * 28) * (arcadeState.netRipple || 0) * 6;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
  ctx.beginPath();
  ctx.moveTo(GOAL_LEFT, GOAL_LINE_Y);
  ctx.lineTo(GOAL_LEFT + 14, GOAL_TOP + 8);
  ctx.lineTo(GOAL_RIGHT - 14, GOAL_TOP + 8);
  ctx.lineTo(GOAL_RIGHT, GOAL_LINE_Y);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 1;
  for (let nx = GOAL_LEFT + 16; nx < GOAL_RIGHT; nx += 16) {
    ctx.beginPath();
    ctx.moveTo(nx, GOAL_TOP);
    ctx.lineTo(nx + ripple, GOAL_LINE_Y);
    ctx.stroke();
  }
  for (let ny = GOAL_TOP + 14; ny < GOAL_LINE_Y; ny += 14) {
    ctx.beginPath();
    ctx.moveTo(GOAL_LEFT, ny);
    ctx.lineTo(GOAL_RIGHT, ny + ripple * 0.4);
    ctx.stroke();
  }

  // Goal posts & crossbar
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(GOAL_LEFT, GOAL_LINE_Y);
  ctx.lineTo(GOAL_LEFT, GOAL_TOP);
  ctx.lineTo(GOAL_RIGHT, GOAL_TOP);
  ctx.lineTo(GOAL_RIGHT, GOAL_LINE_Y);
  ctx.stroke();

  // Eagle-Eye hint flash during GK defense if player answered LGS question correctly
  if (arcadeState.phase === 'gk_incoming' && arcadeState.superShot && !arcadeState.gkShotFired) {
    ctx.strokeStyle = 'rgba(74, 222, 128, 0.85)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(arcadeState.targetX, arcadeState.targetY, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Goalkeeper (player controls during gk_save!)
  const isPlayerGk = arcadeState.playType === 'gk_save';
  drawGoalkeeperSprite(
    ctx,
    arcadeState.keeperX,
    GOAL_LINE_Y - 2,
    arcadeState.keeperWidth,
    arcadeState.keeperDiveDir,
    isPlayerGk
  );

  // Shooting box highlight during dribble_run
  if (arcadeState.phase === 'dribble') {
    ctx.fillStyle = 'rgba(74, 222, 128, 0.22)';
    ctx.fillRect(140, GOAL_LINE_Y, 360, 91);
    ctx.fillStyle = '#fef08a';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⬆ DRIBBLE INTO THIS SHOOTING ZONE! ⬆', PENALTY_X, 198);
  }

  // Moving Defenders (Rival Turkish club colors!)
  arcadeState.defenders.forEach((def, idx) => {
    drawPlayerSprite(ctx, def.x, def.y, rivalTeam.jersey, rivalTeam.shorts, 4 + idx, t * 8 + idx);
  });

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
    drawPlayerSprite(ctx, mx, my, selectedTeam.jersey, selectedTeam.shorts, 9, t * 10);
  }

  // Kicker (Selected Turkish team on attack, Rival striker running up on GK defense!)
  if (isPlayerGk) {
    const runupY = PENALTY_Y + 20 + (arcadeState.gkRunup || 0) * 45;
    drawPlayerSprite(ctx, PENALTY_X, runupY, rivalTeam.jersey, rivalTeam.shorts, 10, t * 12);
  } else {
    drawPlayerSprite(ctx, arcadeState.startX, arcadeState.startY + 26, selectedTeam.jersey, selectedTeam.shorts, 10, t * 6);
  }

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
    const barX = 580;
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

  // Curved ball trail
  if (arcadeState.ballTrail && arcadeState.ballTrail.length > 1) {
    ctx.strokeStyle = isPlayerGk
      ? 'rgba(248, 113, 113, 0.55)'
      : arcadeState.superShot
        ? 'rgba(250, 204, 21, 0.6)'
        : 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(arcadeState.ballTrail[0].x, arcadeState.ballTrail[0].y);
    for (let i = 1; i < arcadeState.ballTrail.length; i += 1) {
      ctx.lineTo(arcadeState.ballTrail[i].x, arcadeState.ballTrail[i].y);
    }
    ctx.stroke();
  }

  // Lifelike 3D ball with ground shadow & arc elevation
  const inAir = arcadeState.phase === 'flying' || (arcadeState.phase === 'gk_incoming' && arcadeState.gkShotFired);
  const progress = inAir ? Math.max(0, Math.min(1, (PENALTY_Y - arcadeState.ballY) / (PENALTY_Y - GOAL_LINE_Y))) : 0;
  const arcLift = inAir ? Math.sin(progress * Math.PI) * 24 : 0;
  const ballScale = inAir ? Math.max(0.62, 1 - progress * 0.36) : 1;
  const r = 12.5 * ballScale;

  // Ground shadow below ball
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(arcadeState.ballX, arcadeState.ballY + 8, r * 0.9, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Spinning ball body
  ctx.save();
  ctx.translate(arcadeState.ballX, arcadeState.ballY - arcLift);
  ctx.rotate(arcadeState.ballSpin || 0);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Classic pentagon patches
  ctx.fillStyle = '#0f172a';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  for (let a = 0; a < 5; a += 1) {
    const ang = (a * Math.PI * 2) / 5;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * r * 0.72, Math.sin(ang) * r * 0.72, r * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // Confetti
  for (const p of confetti) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 8, 8);
  }
}

function drawPitchFirstPerson() {
  const canvas = $('pitch-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const t = arcadeState.animTime || 0;
  const isPlayerGk = arcadeState.playType === 'gk_save';

  // Night stadium sky & glowing floodlights
  const sky = ctx.createLinearGradient(0, 0, 0, 155);
  sky.addColorStop(0, '#020617');
  sky.addColorStop(1, '#1e293b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, PITCH_WIDTH, 155);

  // Stadium stands + cheering crowd
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 75, PITCH_WIDTH, 75);
  const crowdColors = [selectedTeam.jersey, selectedTeam.accent, rivalTeam.jersey, '#ffffff', '#38bdf8'];
  for (let row = 0; row < 4; row += 1) {
    for (let cx = 10; cx < PITCH_WIDTH; cx += 18) {
      const bounce = arcadeState.lastOutcome === 'goal' || arcadeState.lastOutcome === 'gk_saved' ? Math.sin(t * 16 + cx) * 3 : 0;
      ctx.fillStyle = crowdColors[(cx + row * 5) % crowdColors.length];
      ctx.beginPath();
      ctx.arc(cx, 84 + row * 14 + bounce, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Horizon perspective pitch turf
  for (let i = 0; i < 6; i += 1) {
    const y0 = 150 + i * 39;
    ctx.fillStyle = i % 2 === 0 ? '#16a34a' : '#15803d';
    ctx.fillRect(0, y0, PITCH_WIDTH, 40);
  }

  // Perspective pitch lines converging toward horizon
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 150);
  ctx.lineTo(PITCH_WIDTH, 150);
  ctx.moveTo(150, 150);
  ctx.lineTo(20, PITCH_HEIGHT);
  ctx.moveTo(490, 150);
  ctx.lineTo(620, PITCH_HEIGHT);
  ctx.stroke();

  if (isPlayerGk) {
    // FIRST-PERSON GOALKEEPER VIEW: Looking OUT from inside the goal!
    const camShift = (PENALTY_X - arcadeState.keeperX) * 0.7;

    // Rival striker running straight toward camera
    const strikerDist = Math.max(0.2, 1 - (arcadeState.gkRunup || 0) * 0.6);
    const strikerX = PENALTY_X + camShift;
    const strikerY = 175 + strikerDist * 45;
    ctx.save();
    ctx.translate(strikerX, strikerY);
    ctx.scale(1.1 + strikerDist * 0.4, 1.1 + strikerDist * 0.4);
    drawPlayerSprite(ctx, 0, 0, rivalTeam.jersey, rivalTeam.shorts, 10, t * 12);
    ctx.restore();

    // Incoming soccer ball growing HUGE as it flies toward your gloves!
    const progress = arcadeState.gkShotFired
      ? Math.max(0, Math.min(1, (PENALTY_Y - arcadeState.ballY) / (PENALTY_Y - GOAL_LINE_Y)))
      : 0;
    const bx = PENALTY_X + (arcadeState.ballX - PENALTY_X) * (0.4 + progress * 1.1) + camShift;
    const by = 205 + progress * 115 - Math.sin(progress * Math.PI) * 55;
    const br = 9 + progress * 24;

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Giant foreground Goalkeeper Gloves!
    const diveOffsetX = arcadeState.keeperDiveDir * (arcadeState.keeperDiveTimer > 0 ? 110 : 0);
    const diveOffsetY = arcadeState.keeperDiveTimer > 0 ? -45 : 0;
    for (const side of [-1, 1]) {
      const gx = PENALTY_X + side * 88 + diveOffsetX;
      const gy = 322 + diveOffsetY + Math.sin(t * 4) * 4;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(gx - 28, gy - 34, 56, 62, 16);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(selectedTeam.short, gx, gy + 4);
    }

    // FPV HUD badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(14, 14, 210, 30);
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('👁️ FPV GOALKEEPER CAM', 24, 33);
  } else {
    // FIRST-PERSON STRIKER VIEW: Looming giant goal ahead + perspective defenders + boots at bottom!
    const camShift = (PENALTY_X - arcadeState.startX) * 0.45;
    const gLeft = 90 + camShift;
    const gRight = 550 + camShift;
    const gTop = 58;
    const gBottom = 165;

    // Giant perspective goal net
    ctx.fillStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.fillRect(gLeft, gTop, gRight - gLeft, gBottom - gTop);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    for (let nx = gLeft + 20; nx < gRight; nx += 20) {
      ctx.beginPath();
      ctx.moveTo(nx, gTop);
      ctx.lineTo(nx, gBottom);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(gLeft, gBottom);
    ctx.lineTo(gLeft, gTop);
    ctx.lineTo(gRight, gTop);
    ctx.lineTo(gRight, gBottom);
    ctx.stroke();

    // Goalkeeper scaled up in FPV
    const kx = gLeft + ((arcadeState.keeperX - GOAL_LEFT) / (GOAL_RIGHT - GOAL_LEFT)) * (gRight - gLeft);
    ctx.save();
    ctx.translate(kx, gBottom + 4);
    ctx.scale(1.35, 1.35);
    drawGoalkeeperSprite(ctx, 0, 0, arcadeState.keeperWidth, arcadeState.keeperDiveDir, false);
    ctx.restore();

    // Defenders looming in perspective
    arcadeState.defenders.forEach((def, idx) => {
      const depth = Math.max(0, Math.min(1, (def.y - GOAL_LINE_Y) / (PENALTY_Y - GOAL_LINE_Y)));
      const dy = gBottom + 20 + depth * 125;
      const dx = PENALTY_X + (def.x - PENALTY_X) * (1 + depth * 0.4) + camShift;
      const scale = 1.0 + depth * 0.75;
      ctx.save();
      ctx.translate(dx, dy);
      ctx.scale(scale, scale);
      drawPlayerSprite(ctx, 0, 0, rivalTeam.jersey, rivalTeam.shorts, 4 + idx, t * 8 + idx);
      ctx.restore();
    });

    // Aim reticle in FPV
    if (arcadeState.phase === 'aim' || arcadeState.phase === 'pass') {
      const rx = gLeft + ((arcadeState.aimX - GOAL_LEFT) / (GOAL_RIGHT - GOAL_LEFT)) * (gRight - gLeft);
      const ry = gTop + ((arcadeState.aimY - GOAL_TOP) / (GOAL_LINE_Y - GOAL_TOP)) * (gBottom - gTop);
      ctx.strokeStyle = arcadeState.superShot ? '#facc15' : '#f87171';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(rx, ry, 18, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Power Meter in FPV
    if (arcadeState.phase === 'aim') {
      const barX = 584;
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

    // Ball in FPV (starts big at your boots, shrinks into the goal!)
    const prog = arcadeState.phase === 'flying'
      ? Math.max(0, Math.min(1, (arcadeState.startY - arcadeState.ballY) / (arcadeState.startY - GOAL_LINE_Y)))
      : 0;
    const bx = PENALTY_X + (arcadeState.ballX - PENALTY_X) * (1.2 - prog * 0.2) + camShift;
    const by = 335 - prog * 225 - Math.sin(prog * Math.PI) * 45;
    const br = Math.max(10, 26 - prog * 15);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Striker boots in bottom foreground
    ctx.fillStyle = selectedTeam.jersey;
    ctx.beginPath();
    ctx.roundRect(PENALTY_X - 75, 348, 42, 34, 12);
    ctx.roundRect(PENALTY_X + 33, 348, 42, 34, 12);
    ctx.fill();

    // FPV HUD badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
    ctx.fillRect(14, 14, 190, 30);
    ctx.fillStyle = '#facc15';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`👁️ FPV ${selectedTeam.short} STRIKER`, 24, 33);
  }

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

  // Smooth continuous running/dribbling when WASD or Arrow keys are held
  if (arcadeState.phase === 'dribble') {
    const runSpeed = arcadeState.superShot ? 210 : 165;
    let dx = 0;
    let dy = 0;
    if (keysHeld.has('ArrowLeft') || keysHeld.has('a') || keysHeld.has('A')) dx -= runSpeed * dt;
    if (keysHeld.has('ArrowRight') || keysHeld.has('d') || keysHeld.has('D')) dx += runSpeed * dt;
    if (keysHeld.has('ArrowUp') || keysHeld.has('w') || keysHeld.has('W')) dy -= runSpeed * dt;
    if (keysHeld.has('ArrowDown') || keysHeld.has('s') || keysHeld.has('S')) dy += runSpeed * dt;
    if (dx !== 0 || dy !== 0) {
      arcadeState = moveDribbler(arcadeState, dx, dy);
    }
  }

  arcadeState = stepKeeper(arcadeState, dt);
  arcadeState = stepBall(arcadeState, dt);

  if ((prevPhase === 'dribble' || prevPhase === 'flying' || prevPhase === 'passing' || prevPhase === 'gk_incoming') && arcadeState.phase === 'result') {
    if (arcadeState.lastOutcome === 'goal' || arcadeState.lastOutcome === 'gk_saved') {
      const bonus = arcadeState.lastOutcome === 'gk_saved' ? 40 : 35;
      state = { ...state, totalXp: state.totalXp + bonus };
      saveProgress(window.localStorage, state);
      renderHud();
      spawnGoalConfetti();
      playSound('fulltime');
    } else {
      playSound('foul');
    }
    renderArcadeUI();
  } else if ((prevPhase === 'passing' || prevPhase === 'dribble') && arcadeState.phase === 'aim') {
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

  if (cameraView === 'first_person') {
    drawPitchFirstPerson();
  } else {
    drawPitch();
  }
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
$('btn-camera-view').addEventListener('click', toggleCameraView);
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

  pitchCanvas.addEventListener('pointermove', (e) => {
    const rect = pitchCanvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * PITCH_WIDTH;
    const y = ((e.clientY - rect.top) / rect.height) * PITCH_HEIGHT;
    if (arcadeState.phase === 'gk_incoming') {
      arcadeState = movePlayerKeeper(arcadeState, x);
      return;
    }
    if (arcadeState.phase === 'dribble' && pointerDragging) {
      arcadeState = moveDribbler(arcadeState, (x - arcadeState.ballX) * 0.22, (y - arcadeState.ballY) * 0.22);
      if (arcadeState.phase !== 'dribble') {
        pointerDragging = false;
        renderArcadeUI();
      }
      return;
    }
    updateAimFromPointer(e.clientX, e.clientY);
  });
  pitchCanvas.addEventListener('pointerup', () => { pointerDragging = false; });
  pitchCanvas.addEventListener('pointerdown', (e) => {
    if (arcadeState.phase === 'dribble') {
      pointerDragging = true;
      return;
    }
    if (arcadeState.phase === 'gk_incoming') {
      const rect = pitchCanvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * PITCH_WIDTH;
      const dir = x < arcadeState.keeperX - 10 ? -1 : x > arcadeState.keeperX + 10 ? 1 : 0;
      arcadeState = diveKeeper(arcadeState, dir);
      return;
    }
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
    keysHeld.add(event.key);
    if (event.key === 'v' || event.key === 'V') {
      toggleCameraView();
      return;
    }
    if (arcadeState.phase === 'dribble') {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
        event.preventDefault();
      }
      return;
    }
    if (arcadeState.phase === 'question' && ['1', '2', '3', '4'].includes(event.key)) {
      handleArcadeAnswer(Number(event.key) - 1);
    } else if (arcadeState.phase === 'gk_incoming') {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        event.preventDefault();
        arcadeState = movePlayerKeeper(arcadeState, arcadeState.keeperX - 28);
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault();
        arcadeState = movePlayerKeeper(arcadeState, arcadeState.keeperX + 28);
      } else if (event.key === ' ') {
        event.preventDefault();
        const dir = arcadeState.ballX < arcadeState.keeperX ? -1 : 1;
        arcadeState = diveKeeper(arcadeState, dir);
      }
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

document.addEventListener('keyup', (event) => {
  keysHeld.delete(event.key);
});

renderHub();
