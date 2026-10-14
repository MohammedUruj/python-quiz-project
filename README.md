# TQM Tyre Factory Simulator: The Quality Champion Challenge

> Also in this repository: **[DWM QUEST: The Daily Excellence Challenge](dwm_quest/README.md)**, a Daily Work Management learning game and assessment (`dwm_quest/`).

An interactive, gamified **Total Quality Management (TQM)** training game set in a fictional tyre factory.
Players join *Qualitrax Tyres* as a new **Quality Improvement Engineer**, walk a 2D factory floor, interview
workers, inspect tyres, collect evidence, analyse data with the 7 QC tools, find and verify root causes,
run PDCA improvements, handle a customer complaint, lead a kaizen and finish with a formal assessment whose
results are saved for the trainer.

*All companies, people and data in the game are fictional and for training only.*

---

## Quick start (no programming needed)

You only need **Python 3.9 or newer**. Nothing else needs to be installed.

1. **Install Python** (skip if you already have it): download it from <https://www.python.org/downloads/>.
   On Windows, tick **"Add Python to PATH"** during installation.
2. **Download this project**: on GitHub click **Code → Download ZIP**, then unzip it.
3. **Open a terminal in the project folder**
   - Windows: open the folder, click the address bar, type `cmd` and press Enter.
   - macOS: right-click the folder → *New Terminal at Folder*.
4. **Start the game:**

   ```
   python run.py
   ```

   (On macOS/Linux you may need `python3 run.py`.)

Your browser opens at **http://localhost:8000**. The terminal window shows:

```
 TQM TYRE FACTORY SIMULATOR is running
   Play:            http://localhost:8000/
   Host dashboard:  http://localhost:8000/host
   Host PIN:        48213907
```

Keep the terminal open while people play. Press **Ctrl+C** to stop.

### Running a training session for a group

```
python run.py --lan
```

The window prints an address such as `http://192.168.1.20:8000/`. Participants on the same network open that
address in their browser (computer, tablet or phone). If it does not load, allow Python through your
computer's firewall when asked.

### The host (trainer) dashboard

Open **http://localhost:8000/host** and enter the **Host PIN** printed in the terminal (also saved in
`data/host_pin.txt`). You can:

- see every participant's score, percentage, band, pass/fail, practice points and time taken;
- see which questions were hardest, to focus your debrief;
- **export results to CSV** (opens in Excel);
- change the **passing threshold**, number of questions, whether participants can **review answers before
  submitting**, question shuffling, and the performance band labels;
- delete individual results or clear all results.

To choose your own PIN, set the `TQM_HOST_PIN` environment variable before starting
(Windows: `set TQM_HOST_PIN=yourpin`; macOS/Linux: `export TQM_HOST_PIN=yourpin`), or edit `data/host_pin.txt`.

See [docs/HOST_GUIDE.md](docs/HOST_GUIDE.md) for a full facilitator guide.

---

## What players do

| Mission | Learning focus | Gameplay |
|---|---|---|
| **Tutorial: Welcome to the Factory** | Controls, KPIs, quality at every stage | Meet the plant manager, read the KPI board (calculate the rejection rate), spot defective tyres |
| **1. The Defective Tyre Mystery** | Customer focus, quality at the source, prevention vs detection, containment, cost of poor quality | Classify suspect tyres and choose inspection methods (not every defect is visible), interview 4 colleagues and separate evidence from opinion, make a containment and investigation decision |
| **2. The 7 QC Tools Challenge** | Check sheet, Pareto, fishbone, histogram, control chart, scatter, stratification | Fill in a working stratified check sheet, pick the right tool for 7 problems, build a Pareto chart from live data, explore a histogram and control chart (control vs specification limits, stability vs capability) |
| **3. The Root Cause Investigation** | RCA, 5 Whys, Ishikawa, evidence, correlation vs causation | Examine 5 evidence sources that support or contradict hypotheses, build a fishbone diagram, run a 5 Whys with dead ends, design and interpret a verification test |
| **4. The PDCA Improvement Lab** | Plan-Do-Check-Act | Define problem, baseline and SMART target, choose a countermeasure, run pilot and extended trials whose results depend on your choice (success, inconclusive, trade-off, no improvement), then standardise, modify or reverse |
| **5. The Customer Complaint Crisis** | Voice of the customer, escalation, traceability, correction vs containment vs corrective vs preventive action | Review a complaint, identify missing information, escalate a potentially safety-critical issue (required, not scored), assign cross-functional tasks, trace serial numbers, define actions and effectiveness checks |
| **6. The Kaizen Factory Transformation** | Kaizen, Muda/Mura/Muri, employee involvement, standardisation | Waste walk, rearrange a building cell in a simulator that penalises shifting problems downstream, run a team huddle to evaluate ideas |
| **Final Challenge: The Quality Championship** | Integration and prioritisation | Prioritise four simultaneous problems, choose methods, get a final factory performance report |
| **Final Assessment** | Formal check of learning | 20 questions (configurable), one at a time, review before submit, explanations, saved result |

**Controls:** WASD / arrow keys to move, **E** to interact, **L** mission log (with quick travel), **I** evidence,
**M** map, **K** KPI dashboard, **B** badges, **H** help, **Esc** to close. Click or tap the floor to walk.
On phones and tablets an on-screen pad and ● button appear.

**Scoring:** Quality Improvement Points (QIP) reward sound decisions in practice activities. Wrong answers explain
*why* and can be retried (for fewer points); replays keep the best score. The final assessment is scored separately
on the server. Default bands: 90–100% *Quality Champion*, 75–89% *Quality Practitioner*, 60–74% *Developing Quality
Skills*, below 60% *Further Learning Recommended*. These are gamification labels, not formal qualifications.

---

## Project structure

```
run.py                 Start the server (python run.py)
run_tests.py           Run all automated tests (python run_tests.py)
tqm_server/            Backend (Python standard library only)
  app.py               Web server + JSON API (results, host dashboard, settings)
  scoring.py           Question selection, scoring, bands, settings validation
  storage.py           SQLite database for results and settings
  quiz_bank.json       Final-assessment questions + answer key (never sent to browsers before submission)
web/                   Frontend (plain HTML/CSS/JavaScript, no build step)
  index.html, host.html
  css/                 Styles
  js/main.js           Title screen, profile, game start
  js/world.js          2D factory floor (canvas): movement, stations, NPCs
  js/game.js           Missions, HUD, mission log, map, evidence, KPI dashboard
  js/levels/*.js       Tutorial, Levels 1–6 and the final challenge
  js/activities.js     Reusable interactive widgets
  js/charts.js         SVG charts (Pareto, histogram, control chart…)
  js/stats.js          Statistics (Pareto, I-MR control limits, Cp/Cpk…)
  js/quiz.js           Final assessment
  js/host.js           Host dashboard
tests/                 Automated tests (Python + optional Node.js)
docs/                  Host guide, design notes, customisation, deployment, asset licences
data/                  Created on first run: results database and host PIN (not committed)
```

The original console quiz (`quiz game.py`) is kept unchanged.

## Testing

```
python run_tests.py
```

Runs the server tests (scoring, duplicate-submission protection, host authentication, CSV export, settings).
If Node.js 18+ is installed it also runs the game-logic tests (statistics, datasets, simulation models).

Optional: `tests/e2e/playthrough.cjs` drives a real browser through every level, the assessment and the host
dashboard (needs Node.js and Playwright; instructions at the top of the file).

## More documentation

- [docs/HOST_GUIDE.md](docs/HOST_GUIDE.md): running a session, settings, results, troubleshooting
- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md): learning design, TQM content map, formulas and statistical methods
- [docs/CUSTOMIZING.md](docs/CUSTOMIZING.md): editing questions, levels, data and branding
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): hosting on a server or in Docker
- [docs/ASSETS_AND_LICENSES.md](docs/ASSETS_AND_LICENSES.md): art and asset sources
