# Customising the Simulator

No build step is needed: edit a file, save, and reload the browser (restart `run.py` after editing Python or
`quiz_bank.json`). Run `python run_tests.py` afterwards.

## Final assessment questions: `tqm_server/quiz_bank.json`

Each question looks like this:

```json
{
  "id": "q34",
  "core": false,
  "topic": "Control charts",
  "type": "mcq",
  "prompt": "Your question?",
  "scenario": "Optional short scenario shown above the question.",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": 2,
  "explanation": "Shown after submission."
}
```

- `answer` is the **0-based** position of the correct option (0 = first option).
- `core: true` questions make up the default assessment. Keep exactly 20 core questions, or change the default
  `question_count` in `tqm_server/scoring.py` and the host settings.
- `type` is informational (`mcq`, `scenario`, `chart`). Chart questions add a `chart` object:
  - Pareto: `{"type": "pareto", "title": "...", "labels": [...], "values": [...]}`
  - Control chart: `{"type": "control", "title": "...", "points": [...], "cl": 0, "ucl": 0, "lcl": 0, "unit": "..."}`
- Use unique `id`s. Avoid "all of the above" options.
- Answers are never sent to the browser before submission, so participants cannot read them in developer tools.

## Levels and practice activities: `web/js/levels/*.js`

Each level exports `level = { id, title, briefing, debrief, badge, reward, kpiEffect, tasks }`.
A task is `{ id, title, station, prompt, requires, run(ctx) }`:

- `station`: where the task is triggered (ids are listed in `web/js/world.js`, `STATIONS`).
- `requires`: ids of tasks that must be completed first.
- `run(ctx)`: builds the activity in `ctx.body` and calls `ctx.finish({ points, max })` when done.
  `ctx.evidence({ id, title, text })` adds an item to the evidence folder.

Most activities use the widgets in `web/js/activities.js`:

- `decisionSequence(container, steps, onDone)`: steps of options with `correct` and `feedback`.
- `classifyItems(container, { items, categories }, onDone)`: sort items into categories.
- `multiSelect(container, { prompt, options }, onDone)`: select all that apply.
- `dialogue(container, lines, onDone)`, `orderItems(...)`.

## Data: `web/js/data.js`

Defect counts, check-sheet records and process measurements. The Level 2 story expects that tread width is in
control but not capable, and that bladder pressure shifts after sample 20. `tests/js/logic.test.mjs` checks this,
so run the tests after changing the data.

## Names, characters and branding

- Characters: `NPCS` in `web/js/art.js`.
- Factory areas and stations: `AREAS` and `STATIONS` in `web/js/world.js`.
- Colours: CSS variables at the top of `web/css/style.css`.
- Company name: search for "Qualitrax".
