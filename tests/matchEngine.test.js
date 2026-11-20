import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TACTICAL_BRIEFINGS,
  PITCH_SIGNALS,
  TACTIC_BUILDERS,
  MATCH_STAGES
} from '../src/matchData.js';
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
  loadProgress
} from '../src/matchEngine.js';
import {
  createShootoutState,
  applyQuestionOutcome,
  stepKeeper,
  launchShot,
  stepBall
} from '../src/pitchGame.js';

test('matchData has 2 briefings, 12 signals, 8 builders, and 4 stages (34 LGS questions)', () => {
  assert.equal(TACTICAL_BRIEFINGS.length, 2);
  assert.equal(PITCH_SIGNALS.length, 12);
  assert.equal(TACTIC_BUILDERS.length, 8);
  assert.equal(MATCH_STAGES.length, 4);

  let totalQuestions = 0;
  const seenIds = new Set();

  for (const stage of MATCH_STAGES) {
    assert.ok(stage.questions.length >= 8, `Stage ${stage.id} needs >= 8 questions`);
    for (const q of stage.questions) {
      totalQuestions += 1;
      assert.ok(!seenIds.has(q.id), `Duplicate question id: ${q.id}`);
      seenIds.add(q.id);
      assert.equal(q.options.length, 4, `Question ${q.id} must have 4 options`);
      assert.equal(new Set(q.options).size, 4, `Question ${q.id} options must be distinct`);
      assert.ok(q.correctIndex >= 0 && q.correctIndex <= 3);
      assert.ok(q.explanation.trim().length > 15);
    }
  }

  assert.equal(totalQuestions, 34);
});

test('startStage initializes stamina, VAR hint, and match status', () => {
  const initial = createMatchState(MATCH_STAGES);
  const playing = startStage(initial, 'stage-1');

  assert.equal(playing.status, 'playing');
  assert.equal(playing.activeStageId, 'stage-1');
  assert.equal(playing.stamina, 3);
  assert.equal(playing.varHintsRemaining, 1);
  assert.equal(playing.goals, 0);
  assert.throws(() => startStage(initial, 'nonexistent'), /Unknown stage/);
});

test('submitAnswer scores goals, awards XP with combo, and blocks double-submit', () => {
  let state = startStage(createMatchState(MATCH_STAGES), 'stage-1');
  const firstCorrect = MATCH_STAGES[0].questions[0].correctIndex;

  state = submitAnswer(state, firstCorrect);
  assert.equal(state.goals, 1);
  assert.equal(state.combo, 1);
  assert.equal(state.stageXp, 25); // 20 base + 5 combo
  assert.equal(state.lastResult.isCorrect, true);

  const afterDouble = submitAnswer(state, firstCorrect);
  assert.deepEqual(afterDouble, state);
});

test('wrong answers reduce stamina to 0 -> fulltime_loss and record mistakes', () => {
  let state = startStage(createMatchState(MATCH_STAGES), 'stage-1');

  for (let i = 0; i < 3; i += 1) {
    const q = MATCH_STAGES[0].questions[state.questionIndex];
    const wrongIdx = (q.correctIndex + 1) % 4;
    state = submitAnswer(state, wrongIdx);
    assert.equal(state.stamina, 2 - i);
    assert.equal(state.combo, 0);

    if (i < 2) {
      state = nextQuestion(state);
    } else {
      assert.equal(state.status, 'gameover');
    }
  }

  const summary = getStageSummary(state);
  assert.equal(summary.mistakes.length, 3);
  assert.equal(summary.passed, false);
});

test('useVarHint removes 2 wrong options once per stage', () => {
  let state = startStage(createMatchState(MATCH_STAGES), 'stage-2');
  const q = MATCH_STAGES[1].questions[0];

  state = useVarHint(state);
  assert.equal(state.varHintsRemaining, 0);
  assert.equal(state.eliminatedOptions.length, 2);
  assert.ok(!state.eliminatedOptions.includes(q.correctIndex));

  const second = useVarHint(state);
  assert.deepEqual(second, state);
});

test('getMatchMinute scales from 0 to 90 across completed stages', () => {
  const empty = createMatchState(MATCH_STAGES);
  assert.equal(getMatchMinute(empty), 0);

  const half = {
    ...empty,
    completedStages: { 'stage-1': 3, 'stage-2': 2 }
  };
  assert.equal(getMatchMinute(half), 45);

  const full = {
    ...empty,
    completedStages: { 'stage-1': 3, 'stage-2': 3, 'stage-3': 3, 'stage-4': 3 }
  };
  assert.equal(getMatchMinute(full), 90);
});

test('getManagerRank and storage helpers handle edge cases safely', () => {
  assert.equal(getManagerRank(0).title, 'Academy Trainee');
  assert.equal(getManagerRank(250).title, 'Starting XI');
  assert.equal(getManagerRank(600).title, 'Team Captain');
  assert.equal(getManagerRank(1000).title, 'Champions Coach');

  const broken = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('full'); }
  };
  assert.deepEqual(loadProgress(broken), { totalXp: 0, completedStages: {} });
  assert.equal(saveProgress(broken, createMatchState(MATCH_STAGES)), false);
});

test('pitchGame shootout initializes 5 rounds and adjusts keeper speed by question outcome', () => {
  const s0 = createShootoutState(5);
  assert.equal(s0.round, 1);
  assert.equal(s0.totalRounds, 5);
  assert.equal(s0.phase, 'question');

  const boosted = applyQuestionOutcome(s0, true);
  assert.equal(boosted.phase, 'aim');
  assert.equal(boosted.superShot, true);
  assert.ok(boosted.keeperSpeed < s0.keeperSpeed);

  const pressured = applyQuestionOutcome(s0, false);
  assert.equal(pressured.phase, 'aim');
  assert.equal(pressured.superShot, false);
  assert.ok(pressured.keeperSpeed > s0.keeperSpeed);
});

test('pitchGame ball scores when aimed away from keeper and advances round', () => {
  let s = applyQuestionOutcome(createShootoutState(5), true);
  // Place keeper and defender on the far left and aim far right with sweet-spot power
  s = { ...s, keeperX: 180, keeperWidth: 66, defenderX: 180, defenderWidth: 44, power: 0.7 };
  s = launchShot(s, 460, 70);
  assert.equal(s.phase, 'flying');

  for (let i = 0; i < 60 && s.phase === 'flying'; i += 1) {
    s = stepKeeper(s, 0.016);
    s = stepBall(s, 0.016);
  }

  assert.equal(s.phase, 'result');
  assert.equal(s.lastOutcome, 'goal');
  assert.equal(s.playerScore, 1);
});

test('pitchGame defender blocks shots in its path and round difficulty scales keeper speed', () => {
  const r1 = applyQuestionOutcome(createShootoutState(5), true);
  const r4 = applyQuestionOutcome({ ...createShootoutState(5), round: 4 }, true);
  assert.ok(r4.keeperSpeed > r1.keeperSpeed);

  let blocked = { ...r1, keeperX: 180, defenderX: 320, defenderY: 200, defenderWidth: 48, power: 0.7 };
  blocked = launchShot(blocked, 320, 75);
  for (let i = 0; i < 60 && blocked.phase === 'flying'; i += 1) {
    blocked = stepBall(blocked, 0.016);
  }
  assert.equal(blocked.phase, 'result');
  assert.equal(blocked.lastOutcome, 'blocked');
  assert.equal(blocked.playerScore, 0);
});
