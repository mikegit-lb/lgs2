# LGS Champions Cup — 90' Football English Quest

A 90-minute, football-themed, LGS-style gamified English lesson for 13-year-old (8th-grade) students covering **Present Simple**, **Present Continuous**, **Stative Verbs**, and **LGS New-Generation Reading / Table / Dialogue Inference**.

## 90-Minute Session Structure (54 Interactive Challenges)

| Block | Activity | Est. Time |
| --- | --- | --- |
| **00'–15'** | **Locker Room Briefings (2 Decks):** Habits vs. Live Pitch Action + LGS Table/Dialogue Playbook | 15 min |
| **15'–25'** | **Warm-Up Drill 1 — Referee's Whistle:** 12 football time-signal sorting clues | 10 min |
| **25'–35'** | **Warm-Up Drill 2 — Tactic Sentence Builder:** 8 word-tile sentence construction challenges | 10 min |
| **35'–50'** | **Quarter 1 (00'–22'):** Training Ground Routines (8 LGS questions) | 15 min |
| **50'–65'** | **Quarter 2 (23'–45'):** Live Match Commentary (8 LGS questions) | 15 min |
| **65'–80'** | **Quarter 3 (46'–70'):** Derby Clash, Stats Cards & Stative Traps (10 LGS questions) | 15 min |
| **80'–90'+** | **Quarter 4 (71'–90'+):** Championship Final Reading & Inference Boss (8 LGS questions) + Post-Match Video Analysis | 10–15 min |

## How to Play

Serve the `football-lgs-cup` folder with a local static server:

```powershell
cd football-lgs-cup
python -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

### Controls
- `1`–`4`: Select answer options (or `1`/`2` in Referee's Whistle)
- `Enter`: Advance to the next play after feedback appears
- **VAR 50/50**: 1 free lifeline per quarter to eliminate two wrong options

## Running Unit Tests

```powershell
cd football-lgs-cup
node --test tests/matchEngine.test.js
```
