/**
 * Pure state machine for LGS Champions Cup (90-Minute Football Lesson).
 */

export const MAX_STAMINA = 3;
export const STORAGE_KEY = 'football_lgs_cup_v1';

const MANAGER_RANKS = [
  { threshold: 0, title: 'Academy Trainee' },
  { threshold: 200, title: 'Starting XI' },
  { threshold: 500, title: 'Team Captain' },
  { threshold: 900, title: 'Champions Coach' }
];

export function getManagerRank(totalXp) {
  const xp = Number.isFinite(totalXp) ? Math.max(0, totalXp) : 0;
  let current = MANAGER_RANKS[0];
  let next = null;

  for (let i = 0; i < MANAGER_RANKS.length; i += 1) {
    if (xp >= MANAGER_RANKS[i].threshold) {
      current = MANAGER_RANKS[i];
      next = MANAGER_RANKS[i + 1] ?? null;
    }
  }

  return {
    title: current.title,
    nextTitle: next ? next.title : null,
    nextThreshold: next ? next.threshold : null
  };
}

export function getMatchMinute(state) {
  const totalStages = state.stages.length || 4;
  const clearedCount = state.stages.filter(
    (s) => (state.completedStages[s.id] ?? 0) > 0
  ).length;
  return Math.round((clearedCount / totalStages) * 90);
}

export function createMatchState(stages, savedProgress = {}) {
  const totalXp = Number.isFinite(savedProgress?.totalXp) ? Math.max(0, savedProgress.totalXp) : 0;
  const completedStages =
    savedProgress?.completedStages && typeof savedProgress.completedStages === 'object'
      ? { ...savedProgress.completedStages }
      : {};

  return {
    stages,
    status: 'hub',
    activeStageId: null,
    questionIndex: 0,
    stamina: MAX_STAMINA,
    varHintsRemaining: 1,
    eliminatedOptions: [],
    combo: 0,
    goals: 0,
    stageXp: 0,
    totalXp,
    completedStages,
    mistakes: [],
    lastResult: null
  };
}

function findStage(state, stageId = state.activeStageId) {
  return state.stages.find((s) => s.id === stageId) ?? null;
}

export function startStage(state, stageId) {
  const stage = findStage(state, stageId);
  if (!stage) {
    throw new Error(`Unknown stage: ${stageId}`);
  }

  return {
    ...state,
    status: 'playing',
    activeStageId: stage.id,
    questionIndex: 0,
    stamina: MAX_STAMINA,
    varHintsRemaining: 1,
    eliminatedOptions: [],
    combo: 0,
    goals: 0,
    stageXp: 0,
    mistakes: [],
    lastResult: null
  };
}

export function useVarHint(state) {
  if (
    state.status !== 'playing' ||
    state.lastResult !== null ||
    state.varHintsRemaining <= 0 ||
    state.eliminatedOptions.length > 0
  ) {
    return state;
  }

  const stage = findStage(state);
  const question = stage?.questions[state.questionIndex];
  if (!question) return state;

  const wrongIndices = question.options
    .map((_, idx) => idx)
    .filter((idx) => idx !== question.correctIndex);

  return {
    ...state,
    varHintsRemaining: state.varHintsRemaining - 1,
    eliminatedOptions: wrongIndices.slice(0, 2)
  };
}

export function submitAnswer(state, optionIndex) {
  if (state.status !== 'playing' || state.lastResult !== null) {
    return state;
  }

  const stage = findStage(state);
  const question = stage?.questions[state.questionIndex];
  if (!question) return state;

  const isCorrect = optionIndex === question.correctIndex;
  const nextCombo = isCorrect ? state.combo + 1 : 0;
  const earnedXp = isCorrect ? stage.xpPerQuestion + Math.min(nextCombo, 4) * 5 : 0;
  const nextStamina = isCorrect ? state.stamina : Math.max(0, state.stamina - 1);
  const nextStatus = nextStamina === 0 ? 'gameover' : 'playing';
  const nextMistakes = isCorrect
    ? state.mistakes
    : [
        ...state.mistakes,
        {
          questionId: question.id,
          prompt: question.prompt,
          selectedOption: question.options[optionIndex] ?? '',
          correctOption: question.options[question.correctIndex],
          explanation: question.explanation
        }
      ];

  return {
    ...state,
    status: nextStatus,
    stamina: nextStamina,
    combo: nextCombo,
    goals: isCorrect ? state.goals + 1 : state.goals,
    stageXp: state.stageXp + earnedXp,
    totalXp: state.totalXp + earnedXp,
    mistakes: nextMistakes,
    lastResult: {
      selectedIndex: optionIndex,
      correctIndex: question.correctIndex,
      isCorrect,
      earnedXp,
      explanation: question.explanation
    }
  };
}

function computeTrophies(goals, totalCount, passingScore) {
  if (goals < passingScore) return 0;
  const ratio = totalCount > 0 ? goals / totalCount : 0;
  if (ratio >= 0.9) return 3;
  if (ratio >= 0.75) return 2;
  return 1;
}

export function nextQuestion(state) {
  if (state.status !== 'playing') {
    return state;
  }

  const stage = findStage(state);
  if (!stage) return state;

  const nextIndex = state.questionIndex + 1;
  if (nextIndex >= stage.questions.length) {
    const trophies = computeTrophies(state.goals, stage.questions.length, stage.passingScore);
    const prevBest = state.completedStages[stage.id] ?? 0;
    return {
      ...state,
      status: 'stage_complete',
      eliminatedOptions: [],
      lastResult: null,
      completedStages: {
        ...state.completedStages,
        [stage.id]: Math.max(prevBest, trophies)
      }
    };
  }

  return {
    ...state,
    questionIndex: nextIndex,
    eliminatedOptions: [],
    lastResult: null
  };
}

export function getStageSummary(state) {
  const stage = findStage(state);
  if (!stage) {
    return {
      stageId: '',
      goals: 0,
      totalCount: 0,
      accuracy: 0,
      passed: false,
      earnedXp: 0,
      trophies: 0,
      mistakes: []
    };
  }

  const totalCount = stage.questions.length;
  const accuracy = totalCount > 0 ? Math.round((state.goals / totalCount) * 100) : 0;
  const passed = state.stamina > 0 && state.goals >= stage.passingScore;
  const trophies = state.stamina > 0 ? computeTrophies(state.goals, totalCount, stage.passingScore) : 0;

  return {
    stageId: stage.id,
    goals: state.goals,
    totalCount,
    accuracy,
    passed,
    earnedXp: state.stageXp,
    trophies,
    mistakes: state.mistakes
  };
}

export function checkFillBlank(item, userInput) {
  if (!item || !Array.isArray(item.acceptedAnswers) || typeof userInput !== 'string') {
    return false;
  }
  const normalized = userInput.trim().toLowerCase().replace(/\s+/g, ' ');
  return item.acceptedAnswers.some(
    (ans) => ans.trim().toLowerCase().replace(/\s+/g, ' ') === normalized
  );
}

export function saveProgress(storage, state) {
  if (!storage || typeof storage.setItem !== 'function') return false;
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        totalXp: state.totalXp,
        completedStages: state.completedStages
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function loadProgress(storage) {
  const fallback = { totalXp: 0, completedStages: {} };
  if (!storage || typeof storage.getItem !== 'function') return fallback;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      totalXp: Number.isFinite(parsed?.totalXp) ? Math.max(0, parsed.totalXp) : 0,
      completedStages:
        parsed?.completedStages && typeof parsed.completedStages === 'object'
          ? parsed.completedStages
          : {}
    };
  } catch {
    return fallback;
  }
}
