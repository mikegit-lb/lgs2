/**
 * 90-Minute Football-Themed LGS English Lesson Data (8th Grade MEB Aligned).
 * Covers Present Simple, Present Continuous, Stative Verbs, and LGS Visual/Dialogue Reasoning.
 */

export const TACTICAL_BRIEFINGS = [
  {
    id: 'briefing-tenses',
    title: 'Tactical Briefing 1: Routines vs. Live Pitch Action',
    badge: 'Formation 4-3-3',
    formula: {
      simple: 'Habits / Schedules: S + V1 (he/she/it + V-s/-es/-ies) | don\'t / doesn\'t + V1',
      continuous: 'Live Action / Temporary: S + am/is/are + V-ing | am not / isn\'t / aren\'t + V-ing',
      stative: 'Stative Verbs (NO -ing): know, want, like, love, hate, need, prefer, believe, understand'
    },
    rules: [
      'Training schedules, matchday routines, and league rules always use Present Simple.',
      'Actions happening right now on the pitch ("Look!", "Listen!", "at the moment", "in the 85th minute") use Present Continuous.',
      'Even in the middle of a match, stative verbs like "want", "know", "prefer", and "need" stay in Present Simple!'
    ],
    signals: [
      'every training',
      'before matches',
      'twice a week',
      'usually',
      'right now',
      'at the moment',
      'Look!',
      'currently',
      'this week'
    ],
    examples: [
      {
        en: 'Our striker always warms up for 20 minutes before kickoff.',
        note: 'Matchday routine -> Present Simple (warms up).'
      },
      {
        en: 'Look! The goalkeeper is diving to save the penalty!',
        note: 'Live action right before our eyes -> Present Continuous (is diving).'
      },
      {
        en: 'The coach knows the opponent\'s tactic right now. (NOT: is knowing)',
        note: '"Know" is a stative verb -> stays Present Simple.'
      }
    ]
  },
  {
    id: 'briefing-lgs',
    title: 'Tactical Briefing 2: LGS Match-Card & Dialogue Strategy',
    badge: 'Exam Playbook',
    formula: {
      simple: 'Step 1: Spot the time marker or frequency word in the table / chat.',
      continuous: 'Step 2: Check subject-verb agreement (squad = singular/plural, players = plural).',
      stative: 'Step 3: Eliminate distractors that break logic in schedules, WhatsApp chats, or stats.'
    },
    rules: [
      'In LGS table questions, compare "Usually / Always" columns against "Today / This Week" columns.',
      'In dialogue questions, read BOTH speakers carefully—one clue is often hidden in the reply!',
      'Watch for spelling traps in short answers: "studying", "running", "making", "passes", "tries".'
    ],
    signals: [
      'Which is NOT true?',
      'According to the table',
      'Complete the dialogue',
      'Spot the error',
      'Best title / inference'
    ],
    examples: [
      {
        en: 'Table says: Monday = Passing Drills | Today (Special) = Penalty Practice.',
        note: 'Contrast "We usually do passing drills on Mondays, but today we are practicing penalties."'
      },
      {
        en: 'Does the captain train on Sundays? -> No, he doesn\'t.',
        note: 'Short answers match the auxiliary verb (Do/Does or Am/Is/Are).'
      }
    ]
  }
];

export const PITCH_SIGNALS = [
  { id: 'ps-1', phrase: 'before every match', tense: 'simple', hint: 'Repeated pre-match routine -> Present Simple.' },
  { id: 'ps-2', phrase: 'right now in the 89th minute', tense: 'continuous', hint: 'Happening at this exact moment -> Present Continuous.' },
  { id: 'ps-3', phrase: 'three times a week', tense: 'simple', hint: 'Training frequency -> Present Simple.' },
  { id: 'ps-4', phrase: 'Look! The winger...', tense: 'continuous', hint: '"Look!" points to live action on the pitch -> Present Continuous.' },
  { id: 'ps-5', phrase: 'on Saturday mornings', tense: 'simple', hint: 'Regular weekend schedule -> Present Simple.' },
  { id: 'ps-6', phrase: 'at the moment', tense: 'continuous', hint: 'Action in progress right now -> Present Continuous.' },
  { id: 'ps-7', phrase: 'never misses training', tense: 'simple', hint: '"Never" is a frequency adverb -> Present Simple.' },
  { id: 'ps-8', phrase: 'Listen! The fans...', tense: 'continuous', hint: '"Listen!" signals stadium noise happening now -> Present Continuous.' },
  { id: 'ps-9', phrase: 'usually', tense: 'simple', hint: 'Habit / normal tactic -> Present Simple.' },
  { id: 'ps-10', phrase: 'this week only', tense: 'continuous', hint: 'Temporary training change -> Present Continuous.' },
  { id: 'ps-11', phrase: 'always', tense: 'simple', hint: 'Permanent habit -> Present Simple.' },
  { id: 'ps-12', phrase: 'currently', tense: 'continuous', hint: 'Ongoing right now -> Present Continuous.' }
];

export const TACTIC_BUILDERS = [
  {
    id: 'tb-1',
    tense: 'Present Simple (Question)',
    prompt: 'Ask if your teammate trains every afternoon.',
    tokens: ['Do', 'you', 'train', 'every', 'afternoon?'],
    explanation: 'Questions with "you" in Present Simple start with "Do" + base verb "train".'
  },
  {
    id: 'tb-2',
    tense: 'Present Continuous (Live Action)',
    prompt: 'Say that Arda is dribbling past two defenders right now.',
    tokens: ['Arda', 'is', 'dribbling', 'past', 'two', 'defenders', 'right', 'now.'],
    explanation: 'Singular subject "Arda" + "is" + "dribbling" (drop silent -e) for live action.'
  },
  {
    id: 'tb-3',
    tense: 'Present Simple (Negative)',
    prompt: 'Say that our goalkeeper doesn\'t play as a striker.',
    tokens: ['Our', 'goalkeeper', 'doesn\'t', 'play', 'as', 'a', 'striker.'],
    explanation: 'Singular subject + "doesn\'t" + base verb "play".'
  },
  {
    id: 'tb-4',
    tense: 'Present Continuous (Question)',
    prompt: 'Ask why the referee is checking the VAR screen.',
    tokens: ['Why', 'is', 'the', 'referee', 'checking', 'the', 'VAR', 'screen?'],
    explanation: 'Wh-question in Present Continuous: Why + is + subject + V-ing.'
  },
  {
    id: 'tb-5',
    tense: 'Stative Verb Trap',
    prompt: 'Say that the fans want a winning goal now.',
    tokens: ['The', 'fans', 'want', 'a', 'winning', 'goal', 'now.'],
    explanation: '"Want" is a stative verb, so it stays Present Simple even with "now".'
  },
  {
    id: 'tb-6',
    tense: 'Present Continuous (Negative)',
    prompt: 'Say that the defenders aren\'t sleeping at the moment.',
    tokens: ['The', 'defenders', 'aren\'t', 'sleeping', 'at', 'the', 'moment.'],
    explanation: 'Plural "The defenders" takes "aren\'t" + "sleeping".'
  },
  {
    id: 'tb-7',
    tense: 'Present Simple (3rd Person)',
    prompt: 'Say that Coach Emre watches match videos every night.',
    tokens: ['Coach', 'Emre', 'watches', 'match', 'videos', 'every', 'night.'],
    explanation: 'Verbs ending in -ch take -es for he/she/it -> "watches".'
  },
  {
    id: 'tb-8',
    tense: 'Contrast (Habit vs. Today)',
    prompt: 'Say that Yusuf usually passes, but today he is shooting.',
    tokens: ['Yusuf', 'usually', 'passes,', 'but', 'today', 'he', 'is', 'shooting.'],
    explanation: '"Usually" = Present Simple (passes); "today" = Present Continuous (is shooting).'
  }
];

export const FILL_IN_BLANKS = [
  {
    id: 'fib-1',
    tenseHint: 'Present Continuous (right now)',
    sentence: 'Look! The winger ____ (run) down the right side of the pitch!',
    acceptedAnswers: ['is running'],
    explanation: '"Look!" signals an action happening right now; "run" doubles the "n" -> "is running".'
  },
  {
    id: 'fib-2',
    tenseHint: 'Present Simple (habit)',
    sentence: 'Our goalkeeper always ____ (wear) bright orange gloves on matchdays.',
    acceptedAnswers: ['wears'],
    explanation: '"Always" signals a routine; singular subject "Our goalkeeper" takes -s -> "wears".'
  },
  {
    id: 'fib-3',
    tenseHint: 'Present Simple (negative)',
    sentence: 'Efe ____ (not / like) playing in the rain, so he prefers indoor futsal.',
    acceptedAnswers: ['doesn\'t like', 'does not like'],
    explanation: 'Negative Present Simple with "Efe" (he) uses "doesn\'t" + base verb "like".'
  },
  {
    id: 'fib-4',
    tenseHint: 'Present Continuous (temporary)',
    sentence: 'We ____ (practice) curved free kicks this week before the cup final.',
    acceptedAnswers: ['are practicing', 'are practising'],
    explanation: '"This week" is a temporary training focus; "We" takes "are practicing".'
  },
  {
    id: 'fib-5',
    tenseHint: 'Stative Verb Trap!',
    sentence: 'Listen to the fans! They ____ (want) a winning goal in the 90th minute!',
    acceptedAnswers: ['want'],
    explanation: '"Want" is a stative verb and stays in Present Simple ("want"), never "are wanting".'
  },
  {
    id: 'fib-6',
    tenseHint: 'Present Simple (3rd person -es)',
    sentence: 'Coach Emre ____ (watch) every opponent\'s match video twice a week.',
    acceptedAnswers: ['watches'],
    explanation: 'Verbs ending in -ch add -es for he/she/it -> "watches".'
  },
  {
    id: 'fib-7',
    tenseHint: 'Present Continuous (negative)',
    sentence: 'The defenders ____ (not / sleep) at the moment; they are blocking every shot!',
    acceptedAnswers: ['aren\'t sleeping', 'are not sleeping'],
    explanation: '"At the moment" + plural "The defenders" -> "aren\'t sleeping".'
  },
  {
    id: 'fib-8',
    tenseHint: 'Present Simple (3rd person -ies)',
    sentence: 'Our striker ____ (try) to score from the penalty spot after every training.',
    acceptedAnswers: ['tries'],
    explanation: 'Consonant + y (try) changes to -ies -> "tries".'
  },
  {
    id: 'fib-9',
    tenseHint: 'Stative Verb Trap!',
    sentence: 'Coach, I ____ (not / understand) the offside rule yet. Can you explain?',
    acceptedAnswers: ['don\'t understand', 'do not understand'],
    explanation: '"Understand" is a stative verb -> "don\'t understand" (not "am not understanding").'
  },
  {
    id: 'fib-10',
    tenseHint: 'Present Continuous (silent -e)',
    sentence: 'Watch Arda! He ____ (make) an amazing through-ball pass right now!',
    acceptedAnswers: ['is making'],
    explanation: 'Drop the silent -e in "make" before adding -ing -> "is making".'
  }
];

export const MATCHING_ROUNDS = [
  {
    id: 'match-1',
    title: 'Round 1: Match the Time Clue to the Right Verb',
    subtitle: 'Connect each football time expression on the left with the sentence ending on the right.',
    pairs: [
      { id: 'm1-1', left: 'Every Saturday morning,', right: 'our U-14 squad trains at the academy.' },
      { id: 'm1-2', left: 'Look! Right now,', right: 'the captain is curving the free kick!' },
      { id: 'm1-3', left: 'Usually before kickoff,', right: 'the goalkeeper stretches for 15 minutes.' },
      { id: 'm1-4', left: 'At the moment,', right: 'two defenders are blocking the penalty box.' }
    ]
  },
  {
    id: 'match-2',
    title: 'Round 2: Locker Room Q&A Match',
    subtitle: 'Pair each coach or reporter question with its grammatically accurate short answer.',
    pairs: [
      { id: 'm2-1', left: 'Does Kerem take the free kicks?', right: 'Yes, he does. He bends them well!' },
      { id: 'm2-2', left: 'Are the substitutes warming up now?', right: 'No, they aren\'t. They are watching the corner.' },
      { id: 'm2-3', left: 'Do you train on Sundays?', right: 'No, we don\'t. Sunday is our rest day.' },
      { id: 'm2-4', left: 'Is the referee checking VAR right now?', right: 'Yes, he is! Wait for the whistle.' }
    ]
  },
  {
    id: 'match-3',
    title: 'Round 3: Stative vs. Action Match',
    subtitle: 'Match each football subject/clue with the natural Present Simple or Continuous form.',
    pairs: [
      { id: 'm3-1', left: 'Our coach (know — right now)', right: 'knows the rival team\'s weakness.' },
      { id: 'm3-2', left: 'The stadium fans (sing — right now)', right: 'are singing the club anthem loudly.' },
      { id: 'm3-3', left: 'The midfielder (prefer — always)', right: 'prefers passing to shooting from far.' },
      { id: 'm3-4', left: 'Our striker (shoot — at this second)', right: 'is shooting toward the top corner!' }
    ]
  }
];

export const TURKISH_TEAMS = [
  { id: 'gs', name: 'Galatasaray', short: 'GS', jersey: '#dc2626', accent: '#facc15', shorts: '#ffffff' },
  { id: 'fb', name: 'Fenerbahçe', short: 'FB', jersey: '#facc15', accent: '#1e3a8a', shorts: '#1e3a8a' },
  { id: 'bjk', name: 'Beşiktaş', short: 'BJK', jersey: '#111827', accent: '#f8fafc', shorts: '#111827' },
  { id: 'ts', name: 'Trabzonspor', short: 'TS', jersey: '#881337', accent: '#38bdf8', shorts: '#38bdf8' },
  { id: 'bfk', name: 'Başakşehir', short: 'BFK', jersey: '#f97316', accent: '#1e3a8a', shorts: '#1e3a8a' },
  { id: 'sam', name: 'Samsunspor', short: 'SAM', jersey: '#dc2626', accent: '#ffffff', shorts: '#ffffff' }
];

export const ARCADE_BONUS_QUESTIONS = [
  {
    id: 'ab-1',
    type: 'choice',
    prompt: 'The derby fans in Istanbul ____ their team\'s scarf to every home game.',
    options: ['wear', 'wears', 'are wearing', 'wearing'],
    correctIndex: 0,
    explanation: '"Every home game" is a habit; plural "The derby fans" takes base verb "wear".'
  },
  {
    id: 'ab-2',
    type: 'choice',
    prompt: 'Look at the replay! The midfielder ____ a brilliant through-ball pass right now!',
    options: ['makes', 'make', 'is making', 'are making'],
    correctIndex: 2,
    explanation: '"Look!" + "right now" signals Present Continuous -> "is making" (drop silent -e).'
  },
  {
    id: 'ab-3',
    type: 'dialogue',
    context: 'Commentator: Does the Turkish goalkeeper usually dive to the left?\nAnalyst: Yes, he ____! He saves most penalties on that side.',
    prompt: 'Choose the correct short answer.',
    options: ['do', 'is', 'does', 'dives'],
    correctIndex: 2,
    explanation: 'Questions with "Does" take the short affirmative answer "Yes, he does."'
  },
  {
    id: 'ab-4',
    type: 'choice',
    prompt: 'Right now, three defenders ____ a wall in front of the free-kick spot.',
    options: ['build', 'builds', 'are building', 'is building'],
    correctIndex: 2,
    explanation: '"Right now" + plural "three defenders" -> "are building".'
  },
  {
    id: 'ab-5',
    type: 'choice',
    prompt: 'Our coach ____ that teamwork is more important than individual tricks.',
    options: ['is believing', 'believes', 'believe', 'are believing'],
    correctIndex: 1,
    explanation: '"Believe" is a stative verb (no -ing); singular "Our coach" takes "believes".'
  },
  {
    id: 'ab-6',
    type: 'spot_error',
    context: 'Match Report:\n"Every Sunday, our left winger carrys the ball 60 meters up the touchline."',
    prompt: 'Which fix corrects the spelling error?',
    options: ['carrys -> carries', 'carrys -> carry', 'carrys -> is carrying', 'carrys -> carryes'],
    correctIndex: 0,
    explanation: 'Consonant + y (carry) drops -y and adds -ies -> "carries".'
  },
  {
    id: 'ab-7',
    type: 'dialogue',
    context: 'Striker: Why ____ the referee ____ a yellow card right now?\nCaptain: Because their defender pulled your shirt!',
    prompt: 'Complete the Striker\'s question.',
    options: ['does / show', 'is / showing', 'are / showing', 'is / show'],
    correctIndex: 1,
    explanation: '"Right now" + singular "the referee" requires "is / showing".'
  },
  {
    id: 'ab-8',
    type: 'choice',
    prompt: 'Our academy squad ____ on grass normally, but today we ____ on artificial turf.',
    options: ['trains / are playing', 'is training / play', 'train / are playing', 'trains / play'],
    correctIndex: 0,
    explanation: '"Normally" habit (trains) contrasted with "today" temporary action (are playing).'
  },
  {
    id: 'ab-9',
    type: 'choice',
    prompt: '____ your favorite Süper Lig club ____ in Europe this season?',
    options: ['Do / compete', 'Does / competes', 'Is / competing', 'Are / competing'],
    correctIndex: 2,
    explanation: '"This season" (ongoing temporary period) + singular club -> "Is / competing".'
  },
  {
    id: 'ab-10',
    type: 'choice',
    prompt: 'My little brother ____ football cards, and he currently ____ over 200 of them.',
    options: ['collects / has', 'is collecting / is having', 'collect / has', 'collects / is having'],
    correctIndex: 0,
    explanation: 'General hobby ("collects") + stative possession ("has", never "is having").'
  },
  {
    id: 'ab-11',
    type: 'dialogue',
    context: 'Mom: Turn down the TV, Kerem!\nKerem: Wait a second, Mom! Our keeper ____ a crucial penalty right now!',
    prompt: 'Complete Kerem\'s reply.',
    options: ['faces', 'face', 'is facing', 'facing'],
    correctIndex: 2,
    explanation: '"Right now" + singular "Our keeper" -> "is facing" (drop silent -e).'
  },
  {
    id: 'ab-12',
    type: 'choice',
    prompt: 'The stadium lights always ____ on automatically at sunset.',
    options: ['turn', 'turns', 'are turning', 'turning'],
    correctIndex: 0,
    explanation: '"Always" habit + plural "The stadium lights" -> "turn".'
  },
  {
    id: 'ab-13',
    type: 'choice',
    prompt: 'Listen! The coach ____ tactical instructions from the sideline!',
    options: ['shouts', 'shout', 'is shouting', 'are shouting'],
    correctIndex: 2,
    explanation: '"Listen!" signals an action happening right now -> "is shouting".'
  },
  {
    id: 'ab-14',
    type: 'choice',
    prompt: 'Our team ____ any matches at home this year; our defense is super strong!',
    options: ['doesn\'t lose', 'don\'t lose', 'isn\'t losing', 'not loses'],
    correctIndex: 0,
    explanation: 'General/habitual record with singular "Our team" -> "doesn\'t lose".'
  },
  {
    id: 'ab-15',
    type: 'spot_error',
    context: 'Live Commentary:\n"Minute 78: The defender is runing back quickly to stop the counter-attack!"',
    prompt: 'Choose the correct spelling fix.',
    options: ['runing -> runs', 'runing -> running', 'runing -> run', 'runing -> runeing'],
    correctIndex: 1,
    explanation: 'CVC verb "run" doubles the final "n" before -ing -> "running".'
  },
  {
    id: 'ab-16',
    type: 'dialogue',
    context: 'Scout: What ____ you ____ of our new goalkeeper?\nCoach: I think he has amazing reflexes!',
    prompt: 'Choose the stative verb question form for asking an opinion.',
    options: ['are / thinking', 'do / think', 'does / think', 'are / think'],
    correctIndex: 1,
    explanation: '"Think" meaning "have an opinion" is stative -> "What do you think...?"'
  },
  {
    id: 'ab-17',
    type: 'choice',
    prompt: 'The captain never ____ up, even when the team is losing 2-0.',
    options: ['give', 'gives', 'is giving', 'giving'],
    correctIndex: 1,
    explanation: '"Never" + singular "The captain" takes Present Simple "gives".'
  },
  {
    id: 'ab-18',
    type: 'choice',
    prompt: 'Look! The ball ____ around the three-man wall into the top corner!',
    options: ['curves', 'curve', 'is curving', 'curving'],
    correctIndex: 2,
    explanation: '"Look!" signals live flight right now -> "is curving" (drop silent -e).'
  },
  {
    id: 'ab-19',
    type: 'table',
    context: 'DERBY TRAINING STATS\n• Arda: Usually shoots with left foot | Today: Practicing right-foot volleys.\n• Can: Usually defends | Today: Practicing penalties.',
    prompt: 'Which sentence matches the table?',
    options: [
      'Arda never uses his left foot.',
      'Can is practicing penalties today.',
      'Arda is defending the goal today.',
      'Can usually practices right-foot volleys.'
    ],
    correctIndex: 1,
    explanation: 'The table explicitly shows Can\'s today focus is practicing penalties.'
  },
  {
    id: 'ab-20',
    type: 'choice',
    prompt: 'We ____ extra stamina drills this month because the finals start soon.',
    options: ['do', 'does', 'are doing', 'is doing'],
    correctIndex: 2,
    explanation: '"This month" signals a temporary training routine -> "are doing".'
  },
  {
    id: 'ab-21',
    type: 'dialogue',
    context: 'Fan 1: Why aren\'t the players leaving the pitch?\nFan 2: Because they ____ the fans in the stands right now!',
    prompt: 'Complete Fan 2\'s answer.',
    options: ['applaud', 'applauds', 'are applauding', 'is applauding'],
    correctIndex: 2,
    explanation: '"Right now" + plural "they" -> "are applauding".'
  },
  {
    id: 'ab-22',
    type: 'choice',
    prompt: 'A football match ____ 90 minutes, plus stoppage time.',
    options: ['last', 'lasts', 'is lasting', 'lasting'],
    correctIndex: 1,
    explanation: 'Permanent sport rule/fact with singular "A football match" -> "lasts".'
  },
  {
    id: 'ab-23',
    type: 'choice',
    prompt: 'Right now, our defenders ____ the striker closely so he can\'t shoot.',
    options: ['mark', 'marks', 'are marking', 'is marking'],
    correctIndex: 2,
    explanation: '"Right now" + plural "our defenders" -> "are marking".'
  },
  {
    id: 'ab-24',
    type: 'choice',
    prompt: '____ the fans ____ the team\'s new jersey this season?',
    options: ['Are / liking', 'Do / like', 'Does / like', 'Is / liking'],
    correctIndex: 1,
    explanation: '"Like" is a stative verb; plural "the fans" takes "Do / like".'
  },
  {
    id: 'ab-25',
    type: 'choice',
    prompt: 'Watch the goalkeeper! He ____ across the goal line to make a fingertip save!',
    options: ['dives', 'dive', 'is diving', 'are diving'],
    correctIndex: 2,
    explanation: '"Watch!" signals live action happening right now -> "is diving" (drop silent -e).'
  }
];

export const MATCH_STAGES = [
  {
    id: 'stage-1',
    number: 1,
    halfLabel: '1st Half • 00\'–22\'',
    title: 'Quarter 1: Training Ground Routines',
    subtitle: 'Present Simple habits, 3rd-person -s/-es/-ies, and weekly schedules.',
    passingScore: 6,
    xpPerQuestion: 20,
    questions: [
      {
        id: 'f1-q1',
        type: 'choice',
        prompt: 'Our team captain ____ stretching exercises before every training session.',
        options: ['do', 'does', 'is doing', 'doing'],
        correctIndex: 1,
        explanation: '"Before every training session" is a routine. "Our team captain" (he/she) takes "does".'
      },
      {
        id: 'f1-q2',
        type: 'dialogue',
        context: 'Reporter: How often does Kerem practice free kicks?\nCoach: He ____ them for 30 minutes every Tuesday and Thursday.',
        prompt: 'Choose the correct verb for the Coach\'s answer.',
        options: ['practices', 'practice', 'is practicing', 'practicing'],
        correctIndex: 0,
        explanation: 'Regular schedule ("every Tuesday and Thursday") with "He" requires Present Simple + -s ("practices").'
      },
      {
        id: 'f1-q3',
        type: 'choice',
        prompt: '____ your teammates ____ to the stadium together on matchdays?',
        options: ['Does / travel', 'Do / travels', 'Do / travel', 'Are / traveling'],
        correctIndex: 2,
        explanation: 'Plural subject "your teammates" takes "Do" + base verb "travel" for a matchday routine.'
      },
      {
        id: 'f1-q4',
        type: 'spot_error',
        context: 'Read the Academy Noticeboard:\n"Every Friday, our goalkeeper Mert tryes to save 50 penalty shots after school."',
        prompt: 'Which correction fixes the spelling error?',
        options: ['tryes -> trys', 'tryes -> tries', 'tryes -> is trying', 'tryes -> try'],
        correctIndex: 1,
        explanation: 'Verbs ending in consonant + y (try) drop -y and add -ies -> "tries".'
      },
      {
        id: 'f1-q5',
        type: 'dialogue',
        context: 'Ege: Do you eat fast food before a big tournament?\nBatu: No, never! My nutritionist ____ me to eat pasta and fruit.',
        prompt: 'Complete Batu\'s reply.',
        options: ['tell', 'is telling', 'tells', 'telling'],
        correctIndex: 2,
        explanation: '"My nutritionist" is singular (he/she) and this is a general rule -> "tells".'
      },
      {
        id: 'f1-q6',
        type: 'choice',
        prompt: 'The youth league ____ in September and finishes in May every year.',
        options: ['start', 'is starting', 'starts', 'starting'],
        correctIndex: 2,
        explanation: 'Official schedules and annual facts use Present Simple; "the youth league" (it) takes "starts".'
      },
      {
        id: 'f1-q7',
        type: 'dialogue',
        context: 'Scout: Does your younger brother play in the defense?\nAlper: No, he ____. He plays as a fast right winger.',
        prompt: 'Choose the correct short answer.',
        options: ['don\'t', 'isn\'t', 'doesn\'t', 'not'],
        correctIndex: 2,
        explanation: 'Questions starting with "Does" are answered negatively with "doesn\'t".'
      },
      {
        id: 'f1-q8',
        type: 'table',
        context: 'ANATOLIA U-14 WEEKLY TRAINING PLAN\n• Mon: Fitness & Sprint\n• Wed: Passing Drills\n• Fri: Team Tactics\n• Sun: Rest Day (No Training)',
        prompt: 'According to the plan, which sentence is TRUE?',
        options: [
          'The players train seven days a week.',
          'The team doesn\'t train on Sundays.',
          'They practice passing drills on Mondays.',
          'The coach cancels tactics every Friday.'
        ],
        correctIndex: 1,
        explanation: 'The table lists Sunday as "Rest Day (No Training)", so "The team doesn\'t train on Sundays" is true.'
      }
    ]
  },
  {
    id: 'stage-2',
    number: 2,
    halfLabel: '1st Half • 23\'–45\'',
    title: 'Quarter 2: Live Match Commentary',
    subtitle: 'Present Continuous for live pitch action, temporary tactics, and -ing spelling.',
    passingScore: 6,
    xpPerQuestion: 25,
    questions: [
      {
        id: 'f2-q1',
        type: 'choice',
        prompt: 'Look at the scoreboard! We ____ 2-1 in the final minute!',
        options: ['win', 'wins', 'are winning', 'is winning'],
        correctIndex: 2,
        explanation: '"Look!" + "in the final minute" = happening right now. "We" takes "are winning" (double n).'
      },
      {
        id: 'f2-q2',
        type: 'dialogue',
        context: 'Commentator 1: Where is the captain?\nCommentator 2: Look near the touchline! He ____ to the coach right now.',
        prompt: 'Complete the live commentary.',
        options: ['talks', 'is talking', 'talk', 'are talking'],
        correctIndex: 1,
        explanation: '"Right now" + singular "He" requires "is talking".'
      },
      {
        id: 'f2-q3',
        type: 'spot_error',
        context: 'Live Match Ticker:\n"Minute 34: The defenders are stoping the counter-attack near the penalty box!"',
        prompt: 'Which correction fixes the spelling mistake in the ticker?',
        options: ['stoping -> stops', 'stoping -> stopping', 'stoping -> stop', 'stoping -> stopes'],
        correctIndex: 1,
        explanation: 'Short CVC verb "stop" doubles the final consonant before -ing -> "stopping".'
      },
      {
        id: 'f2-q4',
        type: 'choice',
        prompt: 'Listen! The stadium crowd ____ the team\'s anthem so loudly!',
        options: ['sing', 'sings', 'is singing', 'are sing'],
        correctIndex: 2,
        explanation: '"Listen!" signals an action in progress right now. "The stadium crowd" takes "is singing".'
      },
      {
        id: 'f2-q5',
        type: 'dialogue',
        context: 'Coach: Why ____ you ____ your boots off, Deniz? The second half starts in 2 minutes!\nDeniz: My laces broke, Coach!',
        prompt: 'Choose the correct question form.',
        options: ['do / take', 'are / taking', 'is / taking', 'are / take'],
        correctIndex: 1,
        explanation: 'Asking about an action happening right now with "you" uses "are" + "taking" (drop silent -e).'
      },
      {
        id: 'f2-q6',
        type: 'choice',
        prompt: 'Our main striker is injured this week, so a U-13 player ____ in his place today.',
        options: ['plays', 'play', 'is playing', 'playing'],
        correctIndex: 2,
        explanation: '"This week" and "today" describe a temporary lineup change -> Present Continuous ("is playing").'
      },
      {
        id: 'f2-q7',
        type: 'choice',
        prompt: 'It ____ heavily right now, so the ball is moving fast on the wet grass.',
        options: ['rains', 'is raining', 'rain', 'doesn\'t rain'],
        correctIndex: 1,
        explanation: '"Right now" + "wet grass" shows ongoing rain -> "is raining".'
      },
      {
        id: 'f2-q8',
        type: 'dialogue',
        context: 'Assistant Coach: Are the substitutes warming up?\nTrainer: No, they ____. They are watching the corner kick.',
        prompt: 'Complete the Trainer\'s reply.',
        options: ['don\'t', 'isn\'t', 'aren\'t', 'doesn\'t'],
        correctIndex: 2,
        explanation: 'Present Continuous question with "Are the substitutes" takes negative short answer "aren\'t".'
      }
    ]
  },
  {
    id: 'stage-3',
    number: 3,
    halfLabel: '2nd Half • 46\'–70\'',
    title: 'Quarter 3: Derby Clash & Stative Traps',
    subtitle: 'Contrast habits vs. live action, decode match tables, and dodge stative verb traps.',
    passingScore: 7,
    xpPerQuestion: 30,
    questions: [
      {
        id: 'f3-q1',
        type: 'choice',
        prompt: 'Normally our team ____ in a 4-4-2 formation, but today we ____ 3-5-2.',
        options: ['plays / are playing', 'is playing / plays', 'play / play', 'plays / play'],
        correctIndex: 0,
        explanation: '"Normally" signals a habit (plays), while "today" signals a temporary tactical change (are playing).'
      },
      {
        id: 'f3-q2',
        type: 'dialogue',
        context: 'Mert: Look at the new midfielder!\nKaan: Yes, I ____ him! He scored twice against us last season.',
        prompt: 'Watch out for the stative verb! Choose the right option.',
        options: ['am knowing', 'know', 'knows', 'is knowing'],
        correctIndex: 1,
        explanation: '"Know" is a stative verb; we never use "am knowing".'
      },
      {
        id: 'f3-q3',
        type: 'choice',
        prompt: 'The fans ____ a goal right now! Listen to them shouting!',
        options: ['are wanting', 'wants', 'want', 'is wanting'],
        correctIndex: 2,
        explanation: '"Want" is a stative verb expressing desire; plural "The fans" takes "want" (not "are wanting").'
      },
      {
        id: 'f3-q4',
        type: 'table',
        context: 'MATCHDAY STATS CARD — 65th MINUTE\n• Anatolia United: 62% Possession | 8 Shots | 2 Goals\n• Rival FC: 38% Possession | 3 Shots | 1 Goal\nNote: Anatolia\'s winger Emre is currently resting on the bench.',
        prompt: 'Which statement is CORRECT according to the stats card?',
        options: [
          'Rival FC is winning the match at the 65th minute.',
          'Emre is playing on the pitch right now.',
          'Anatolia United has more shots than Rival FC.',
          'Rival FC usually has 62% possession.'
        ],
        correctIndex: 2,
        explanation: 'Anatolia United has 8 shots vs. Rival FC\'s 3 shots. Emre is resting on the bench, and Anatolia leads 2-1.'
      },
      {
        id: 'f3-q5',
        type: 'dialogue',
        context: 'WhatsApp Team Chat:\nCoach: Where is Berat? Training starts in 5 minutes!\nBerat: Sorry Coach, I ____ the bus right now. I usually ____ by bike, but it has a flat tire.',
        prompt: 'Fill in both blanks accurately.',
        options: ['take / am coming', 'am taking / come', 'am taking / comes', 'take / come'],
        correctIndex: 1,
        explanation: '"Right now" takes "am taking", and "usually" takes Present Simple "come".'
      },
      {
        id: 'f3-q6',
        type: 'spot_error',
        context: 'Post-match tweet by a young fan:\n"Our team is playing amazing football tonight, and I am loving every second of this derby!"',
        prompt: 'Which fix follows strict LGS grammar rules?',
        options: [
          'is playing -> plays',
          'am loving -> love',
          'am loving -> loves',
          'is playing -> are playing'
        ],
        correctIndex: 1,
        explanation: '"is playing" is fine for tonight\'s match, but "love" is a stative verb -> "love".'
      },
      {
        id: 'f3-q7',
        type: 'choice',
        prompt: 'Why ____ the referee ____ to the linesman? He never ____ during a corner kick!',
        options: [
          'does / talk / stops',
          'is / talking / stops',
          'is / talking / is stopping',
          'does / talking / stop'
        ],
        correctIndex: 1,
        explanation: 'Live action ("is talking") contrasted with a general rule ("never stops").'
      },
      {
        id: 'f3-q8',
        type: 'dialogue',
        context: 'Arda: Do you prefer playing as a striker or a midfielder?\nTuna: I ____ midfield because I like making assists.',
        prompt: 'Choose the correct stative verb form.',
        options: ['am preferring', 'prefer', 'prefers', 'is preferring'],
        correctIndex: 1,
        explanation: '"Prefer" is a stative verb; with "I", use "prefer".'
      },
      {
        id: 'f3-q9',
        type: 'choice',
        prompt: 'At the moment, the coach ____ the players\' positions on the tactical board.',
        options: ['explain', 'explains', 'is explaining', 'are explaining'],
        correctIndex: 2,
        explanation: '"At the moment" + singular "the coach" -> "is explaining".'
      },
      {
        id: 'f3-q10',
        type: 'choice',
        prompt: 'Our club ____ three youth teams, and all of them ____ hard this month for the cup.',
        options: [
          'has / are training',
          'is having / train',
          'have / are training',
          'has / trains'
        ],
        correctIndex: 0,
        explanation: 'Possession uses stative "has" ("Our club has"), while "this month" temporary prep uses "are training".'
      }
    ]
  },
  {
    id: 'stage-4',
    number: 4,
    halfLabel: 'Full Time • 71\'–90\'+',
    title: 'Quarter 4: Championship Final (LGS Boss)',
    subtitle: 'Full LGS reading passages, multi-clue inference, and tournament logic.',
    passingScore: 6,
    xpPerQuestion: 40,
    questions: [
      {
        id: 'f4-q1',
        type: 'reading',
        context: 'TOURNAMENT DIARY — DAY 3\n"Hi everyone! Our U-14 team is staying at a sports camp in Antalya this week. Every morning we wake up at 7:00 and run along the beach. Right now, my teammates are resting in the lounge, and I am writing this blog post. We believe we can win tomorrow\'s final!"',
        prompt: 'Which question CANNOT be answered from the diary?',
        options: [
          'Where is the team staying this week?',
          'What time do they wake up every morning?',
          'What are the teammates doing right now?',
          'Who is their opponent in tomorrow\'s final?'
        ],
        correctIndex: 3,
        explanation: 'The text mentions Antalya, 7:00 a.m., and resting in the lounge, but never names tomorrow\'s opponent.'
      },
      {
        id: 'f4-q2',
        type: 'reading',
        context: 'TOURNAMENT DIARY — DAY 3\n"...Every morning we wake up at 7:00 and run along the beach. Right now, my teammates are resting in the lounge, and I am writing this blog post. We believe we can win tomorrow\'s final!"',
        prompt: 'Why did the writer use "believe" instead of "are believing"?',
        options: [
          'Because "believe" is a stative verb that doesn\'t take -ing.',
          'Because the tournament finished yesterday.',
          'Because "we" is a singular pronoun.',
          'Because "believe" only works in negative sentences.'
        ],
        correctIndex: 0,
        explanation: '"Believe" expresses a mental state/opinion (stative verb), so it stays in Present Simple.'
      },
      {
        id: 'f4-q3',
        type: 'dialogue',
        context: 'Player: Coach, I ____ the offside trap drill yet. Can you show it again?\nCoach: Sure! Watch closely—I ____ the cones on the line right now.',
        prompt: 'Choose the best pair to complete the conversation.',
        options: [
          'am not understanding / put',
          'don\'t understand / am putting',
          'doesn\'t understand / am putting',
          'don\'t understand / put'
        ],
        correctIndex: 1,
        explanation: '"Understand" is stative ("don\'t understand"), while moving the cones right now is "am putting".'
      },
      {
        id: 'f4-q4',
        type: 'table',
        context: 'PENALTY SHOOTOUT SCOUTING REPORT\n• Player A (Ali): Usually shoots left (80%) | Today: Looking at the right corner.\n• Player B (Berk): Never misses target | Today: Wearing new boots.\n• Player C (Can): Rarely takes penalties | Today: Stepping up first.',
        prompt: 'Which inference is BEST supported by the scouting report?',
        options: [
          'Ali always looks at the right corner before shooting.',
          'Can takes the first penalty in every single match.',
          'Berk is wearing new boots today, and he usually hits the target.',
          'Ali never shoots to the left side.'
        ],
        correctIndex: 2,
        explanation: 'The report states Berk never misses target (habit) and is wearing new boots today.'
      },
      {
        id: 'f4-q5',
        type: 'choice',
        prompt: 'Look! The referee ____ his watch. The match ____ in a few seconds!',
        options: [
          'checks / ends',
          'is checking / is ending',
          'is checking / ends',
          'checks / is ending'
        ],
        correctIndex: 1,
        explanation: 'Both actions are unfolding live right now in front of the viewer ("is checking / is ending").'
      },
      {
        id: 'f4-q6',
        type: 'spot_error',
        context: 'Sports Magazine Interview:\n"(1) Our academy trains young players from 12 cities. (2) Right now, 40 teenagers are competing for a spot. (3) Everyone is needing strong teamwork to succeed. (4) Coaches watch every pass carefully."',
        prompt: 'Which numbered sentence contains a grammar mistake?',
        options: ['Sentence 1', 'Sentence 2', 'Sentence 3', 'Sentence 4'],
        correctIndex: 2,
        explanation: 'Sentence 3 uses "is needing", but "need" is a stative verb -> "Everyone needs strong teamwork".'
      },
      {
        id: 'f4-q7',
        type: 'dialogue',
        context: 'Mom: Why aren\'t you eating your sandwich, Efe?\nEfe: ____! The penalty shootout is starting on TV right now!',
        prompt: 'Which reply fits Efe\'s excitement naturally?',
        options: [
          'I usually eat at 8 p.m.',
          'I am not hungry because I\'m watching the final',
          'I don\'t like football at all',
          'My team never plays on weekends'
        ],
        correctIndex: 1,
        explanation: 'Efe explains why he isn\'t eating right now: he is too focused watching the penalty shootout.'
      },
      {
        id: 'f4-q8',
        type: 'choice',
        prompt: 'A great midfielder always ____ the pitch before passing, and right now Arda ____ the open space!',
        options: [
          'scans / is finding',
          'is scanning / finds',
          'scan / is finding',
          'scans / find'
        ],
        correctIndex: 0,
        explanation: '"Always" habit with singular "A great midfielder" -> "scans"; live action "right now" -> "is finding".'
      }
    ]
  }
];
