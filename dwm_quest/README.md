# DWM QUEST: The Daily Excellence Challenge

An interactive Daily Work Management (DWM) learning and certification game for JK Tyre & Industries Ltd.
Players join a fictional tyre plant as its DWM Improvement Champion. They work through six missions (PLAN → DO → CHECK → ACT),
walk to a DWM station and review its boards, and finish with a 15-question assessment. It takes about 12–18 minutes.

All plant data, people and records in the game are fictional and labelled **SIMULATED**. Official JK Tyre branding is not used
(prototype identity) until authorised assets are supplied. No official certificate is issued.

**Live (private) link:** https://claude.ai/artifact/By85U2AadEn3MFuUtkQJXM

---

## How it is hosted and where data is stored

The game is published as a **claude.ai Artifact**. The results are stored in that artifact's own server-side database, under these rules:

| Path | Who can read | Who can write |
|---|---|---|
| `participants/<user-id>` and its `attempts/*` | that participant **and** the owner | that participant (Contributor access or higher) |
| `participants` (all records) | **owner only** | owner only |
| `audit/*` and everything else | owner only | owner only |

* "Owner" means the claude.ai account that owns the artifact (the account that published it). The platform's database rules enforce this on the server for every read and write. Hidden URLs and front-end checks play no part.
* Editors, and anyone granted "Owner" in the Share menu, hold the `admin` level, **not** `owner`. They cannot read other employees' records either.
* Participants are identified by their claude.ai sign-in, so resume works across devices. Nobody can make themselves owner by editing the page or its requests.

### Sharing it with employees

1. Open the link, then use **Share**. Employees need **Contributor** (interact) access so their progress can be saved.
2. **What employees need:** each employee must sign in to claude.ai.
   * On a Claude **Team/Enterprise** plan, organisation members can be given Contributor access (or general access for the organisation).
   * On a **personal** plan, people outside your organisation can only save if you invite them **by email**, and only while the artifact is not also shared by public link. Visitors from a public link get view-only access. The game still plays for them, but it shows **"Unable to save — retry required"**, and their results will not reach you.
3. Paste the link into your email. Don't promise "no login needed": employees without a claude.ai account cannot save results.

If many employees don't have claude.ai accounts, deploy on company infrastructure instead (see *Production alternative* below).

### Owner dashboard
When the owner opens the link, the Mission Hub shows **Results dashboard**. It includes:
- totals (started, in progress, completed, passed, eligible, need retake)
- filters (ID/name/email, start dates, progress, pass/fail, eligibility)
- per-employee detail (mission history, every attempt, recommended areas)
- CSV exports for all results, filtered results and all attempts. Exports are Excel-compatible (UTF-8 BOM) and protected against formula injection.

Dashboard views and exports are logged to `audit/`.

---

## Feature status

| Feature | Status |
|---|---|
| Welcome, registration (validated), resume screen, Mission Hub | Implemented, e2e-tested (demo mode) |
| Missions 1–6, with feedback explaining why each choice is right or wrong | Implemented, e2e-tested |
| Walkable curing department and DWM station: keyboard, click/tap, D-pad, "Walk to the DWM station" button | Implemented, e2e-tested |
| DWM board hotspots A–H, nine-step station review, review summary built from the player's choices | Implemented, e2e-tested |
| 15-question assessment, 80% pass, attempts kept separately, eligibility = pass AND all 6 missions | Implemented, unit + e2e-tested |
| Autosave after every decision, mission, transition and submission; 60 s periodic save; status pill (Saving… / Progress saved / Offline — changes pending / Unable to save — retry required) | Implemented. The failure path is e2e-tested in demo mode. |
| Resume after closing the browser (Mission 2 done → resumes in Mission 3), and mid-mission resume | e2e-tested in demo mode |
| Central persistence with owner-only access (claude.ai Artifact database) | Implemented. Rules verified by server probe (see Tests). **Not yet tested with a real second participant account.** |
| Cross-device resume | Supported by design (record keyed to the claude.ai account). Untested. |
| Owner dashboard, filters, CSV exports, audit log | Implemented. Dashboard and CSV e2e-tested with **synthetic demo data**. Central-mode dashboard untested until real records exist. |
| Duplicate submissions | Attempt id is fixed when the attempt starts; resubmitting writes the same record. A double-click is e2e-tested. |
| Official certificates | Not issued (not authorised) |

---

## Data model

`participants/<claude-user-id>` (one document per employee):
`employeeId, employeeName, email, gameStartAt, gameCompletedAt, currentMission, progressPct, latestScorePct, assessmentAttempts,
assessmentStatus, eligible, lastActivityAt, totalTimeSec, createdAt, updatedAt, attemptHistory[], missionLog[], recommended[], points, state{…}`

* `gameStartAt` is set on first registration and never overwritten. If a record already exists, registering again resumes it.
* `gameCompletedAt` stays empty until all six missions are done **and** an assessment has been submitted. It is then set once and kept.
* `lastActivityAt` is updated only when a meaningful action is saved. Periodic time-only saves don't change it.
* `totalTimeSec` counts active time: page visible, with input in the last 2 minutes.
* All timestamps are UTC ISO-8601. The UI shows local time; set `displayTimeZone: "Asia/Kolkata"` in `config.js` to fix the zone.
* `state` holds per-mission status, current step, every decision, tries and points. `migrateState()` merges older saves, so new missions or fields don't break saved progress (`schemaVersion`).

`participants/<id>/attempts/<attemptId>` holds one document per attempt, never overwritten:
`attemptId, employeeId, assessmentVersion, startedAt, submittedAt, scorePct, correct, incorrect, total, passed, eligibleAtAttempt, wrongAreas, answers`.

---

## Configuration — `src/config.js`
`passPercent` (80), `questionCount` (15), `maxAttempts` (3, 0 = unlimited), `requireAllMissions`, `allowedEmailDomains`
(empty: **set your real company domains**, e.g. `["jkmail.com"]`), `ownerContactEmail` (shown to people who run out of attempts; it grants nothing),
`displayTimeZone`, `periodicSaveSeconds`.

Questions live in `content/assessment_bank.json`. Edit them there, then rebuild.

## Build, run and test

```
python dwm_quest/build.py                 # writes dist/dwm-quest.html (artifact) and dist/dwm-quest-standalone.html
node dwm_quest/tests/logic.test.mjs       # unit tests: scoring, 12/15 pass, 11/15 fail, eligibility, hashing, CSV, content integrity
node dwm_quest/tests/e2e.cjs              # Playwright playthrough of the standalone page in demo mode
```

To try it locally, open `dist/dwm-quest-standalone.html` in a browser. It runs in **DEMO MODE**: progress stays in that browser only, and the dashboard shows synthetic records.

To republish after changes: rebuild, then publish `dist/dwm-quest.html` to the same artifact URL. The database and its rules are kept.

### Tests actually run (14 Oct 2026)
* Unit: 10/10 passed.
* E2E (Chromium, demo mode): registration validation; all six missions including the walk; leave after Mission 2 → resume lands in Mission 3 with progress and start time intact; mid-mission reload resumes at the same step; completion time blank until assessment; 12/15 → 80%, passed, eligible, one attempt stored despite double-click; 11/15 → 73.3%, Not Yet Eligible, retake offered; failed save shows "Unable to save — retry required"; dashboard filter + CSV export; no horizontal scroll at 390 px. **Passed.**
* Server access rules (live artifact): a probe record in `participants` was readable by the owner, **invisible** at participant (`interact`) and editor (`admin`) level. A participant-level write to another person's record was **refused**. The probe was deleted afterwards.
* Not yet tested: a real employee account saving its own record, cross-device resume, and owner dashboard with real records. Do one pilot with a colleague's account before mass rollout.

## Known limitations (read before rollout)
* **Assessment integrity.** In artifact mode there is no separate application server, so scoring runs in the participant's browser. Answer keys ship as salted hashes, not plain text, but a determined technical user could work them out, and could also write a false score into their own record. They still cannot see or change anyone else's record. For high-stakes certification, use server-side scoring (below).
* `content/assessment_bank.json` contains the plain answers. Keep this repository private.
* The browser clock supplies timestamps.
* The artifact database holds at most 25,000 documents. That allows roughly 8,000+ employees at about 3 documents each.

## Production alternative (company-hosted)
For employees without claude.ai accounts, host the standalone build on approved infrastructure (e.g. Vercel) with a real backend (e.g. Supabase/PostgreSQL). It needs:
* company SSO or email OTP
* row-level security mirroring the table above
* an owner allow-list holding the verified owner identity (replace placeholder `tqmcell@jkmail.com`)
* server-side scoring.

`src/store.js` is the only module that touches storage, so a new backend replaces that one file.

## Terminology for JK Tyre's TQM cell to validate [TQM-VALIDATE]
* MP = Management Point (result measure), CP = Check Point (process/cause measure). Also confirm the split between the MP/CP Tree and the MP Planning Sheet.
* Role Sheet contents; flow order Objective → Structure/Role Sheet → Standards → MP/CP Tree → MP Planning Sheet → daily record.
* Review-frequency examples (cure temperature/pressure monitoring must follow the actual control plans).
* Document names SOP-CUR-07, QP-HOLD-02, ESC-MAT-01 and PM-CUR-03, and the escalation matrix. These are fictional placeholders.
* Hold/release authority (Quality), LOTO for steam-side work, and the 5% gap alert rule.
