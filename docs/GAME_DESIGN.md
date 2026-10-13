# Game Design and TQM Content

## Core loop

Every mission follows **discover → investigate → collect data → analyse → identify potential causes → verify →
improve → measure → learn**. Players cannot progress by clicking through text: each task requires a correct
classification, decision, calculation or interpretation. Wrong answers show why they are weak and can be retried.

## Structure

| Mission | Tasks (station) | Completion condition |
|---|---|---|
| Tutorial | Meet Elena (control room); read KPI board; spot defective tyres (final inspection) | All three tasks |
| L1 Defective Tyre Mystery | Classify 6 suspect tyres + inspection method; interview supervisor, operator, inspector, maintenance; report decision | Correct problem classification, containment and next investigative step |
| L2 7 QC Tools | Stratified check sheet; tool selection (7 scenarios); Pareto builder; histogram/control chart explorer | All four activities |
| L3 Root Cause | 5 evidence records; fishbone; 5 Whys (needs all evidence); verification (needs 5 Whys + fishbone) | Verification and investigation summary |
| L4 PDCA | Plan; Do-Check-Act loop at Press 4 (repeats until a sustainable result); standardise | Standardised improvement |
| L5 Complaint | Review; escalate (not scored); cross-functional team; traceability; actions + effectiveness checks | Complaint closed |
| L6 Kaizen | Waste walk; layout simulator; team huddle | All three |
| Final challenge | Prioritise four issues; respond to each | Report generated |
| Final assessment | 20 questions | Submitted |

## Design decisions that keep the content technically correct

- **Not every defect is visible.** Level 1 includes uniformity, internal and cure-related nonconformities that
  require measurement, X-ray or laboratory testing.
- **Containment is not optional.** Level 1 rewards proportionate containment *and* investigation; indefinite
  plant-wide stoppage and "inspect harder" are both explained as weaker choices.
- **Pareto ≠ root cause.** Every Pareto question states that ranking prioritises and does not diagnose.
- **Control limits ≠ specification limits; stable ≠ capable.** The tread-width dataset is in control but has
  Cpk ≈ 0.91 (off-centre, Cp ≈ 1.44). The bladder-pressure dataset is out of control while every value is inside
  the specification.
- **Correlation ≠ causation.** Humidity correlates with blisters, but the timing and the unaffected presses show
  it is not the cause.
- **5 Whys is not always five.** The chain includes dead ends that evidence contradicts, and the closing step
  explains that the stopping point is a verified, actionable cause.
- **Plausible ≠ verified.** Level 3 asks which tests would verify or refute the hypothesis and then interprets a
  controlled one-factor trial.
- **Countermeasures can fail.** Level 4 outcomes depend on the chosen countermeasure: a systemic fix succeeds;
  replacing the part alone looks good but leaves the cause open; raising pressure creates a trade-off (flash rises
  every week); extra inspection does not prevent anything. The 60-tyre pilot is always inconclusive.
- **Safety is not a points puzzle.** The Level 5 escalation step is required but awards no points, and the game
  repeatedly states that approved safety, traceability, escalation and nonconformity procedures govern real
  decisions.
- **No problem-shifting.** The Level 6 simulator shows downstream splice defects and penalises "remove the
  check" and "run faster" cards.
- **People are not villains.** Opinions are labelled as opinions, and blame-based answers are explained as
  closing the investigation too early.

## Lean and TQM

Level 6 introduces Muda (waste), Mura (unevenness) and Muri (overburden) as Lean concepts. The debrief explains
that Lean contributes methods for flow and waste, while TQM is the broader management system (customer focus,
process management, fact-based decisions, involvement of everyone, continuous improvement).

## Scoring

- **Practice (QIP):** each task has a maximum. Single-choice steps award full points on the first attempt, half on
  the second and none after that, but the player can always continue. Classification items work the same way per
  item. Multi-select awards 100% / 60% / 30% by attempt. Replays keep the best score.
- **Final assessment:** scored on the server from the answer key in `tqm_server/quiz_bank.json`.
  Score = correct ÷ number of questions. Unanswered questions count as incorrect.
- **Badges:** Defect Detective (L1), Pareto Pro (L2), Root Cause Investigator (L3), PDCA Master (L4), Customer
  Champion (L5), Kaizen Innovator (L6), Quality Champion (top band in the final assessment).

## Factory KPIs (fictional, weekly, at final inspection)

| Indicator | Formula |
|---|---|
| Rejection rate | rejected units ÷ inspected units × 100 |
| Rework rate | reworked units ÷ inspected units × 100 |
| First-pass yield | (inspected − rejected − reworked) ÷ inspected × 100. Numerator: units that pass first time with no rework or rejection, always a subset of the denominator. Rejected and reworked units are counted separately (a tyre that is reworked and then passes counts only as reworked). |
| Good output | inspected − rejected |
| Customer confidence | Fictional 0–100 simulation index |

Baseline: 12,000 inspected, 588 rejected (4.90%), 744 reworked (6.20%), FPY 88.90%, 14 complaints/month.
Each completed level improves these in proportion to the level score; the final challenge applies the
consequences of the player's priorities and decisions.

## Statistical methods

- **Pareto:** categories sorted descending (ties keep input order); share = value ÷ total; cumulative % running
  sum ÷ total. "Vital few" = the categories needed to reach 80%.
- **Histogram:** equal-width bins defined per dataset.
- **Control chart:** individuals (I-MR) chart. Centre line = mean of the baseline samples;
  σ̂ = MR̄ ÷ d₂ with d₂ = 1.128; UCL/LCL = CL ± 3σ̂. Signals: a point beyond a limit (rule 1) or 8 consecutive
  points on one side of the centre line (Western Electric run rule). Limits for the pressure data use the first 20
  samples (phase I baseline).
- **Capability:** Cp = (USL − LSL) ÷ 6σ̂, Cpk = min(USL − μ, μ − LSL) ÷ 3σ̂ using the within-process σ̂ above,
  reported only for the stable dataset. The 1.33 target is described as a common convention, not a universal rule.
- **Data generation:** datasets use a fixed-seed pseudo-random generator, so every participant sees identical
  numbers. Tests in `tests/js/logic.test.mjs` assert the properties the story relies on.

## Accessibility

Keyboard play and keyboard shortcuts, visible focus rings, ARIA labels on interactive controls, colour plus text
for correct/incorrect feedback (✔/✖ and wording, not colour alone), the title animation stops when the
operating system's reduced-motion setting is on, touch controls on coarse
pointers, and responsive layouts down to phone width.
