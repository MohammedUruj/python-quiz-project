# Host / Facilitator Guide

## Before the session

1. Run `python run_tests.py` once to confirm everything works on your computer (it should end with
   `ALL TESTS PASSED`).
2. Start the server: `python run.py --lan` (or `python run.py` if everyone plays on this one computer).
3. Note the **Play** address and **Host PIN** printed in the terminal.
4. Open the host dashboard (`/host`), log in, and check **Assessment settings**:
   - **Passing threshold** (default 75%).
   - **Number of questions** (default 20). The 20 "core" questions cover every topic. Choosing more adds extra
     questions from the bank; choosing fewer takes a random subset of the core questions.
   - **Allow review before submitting** (default on).
   - **Shuffle question order** (default on).
   - **Require the final challenge before the assessment** (default on). Turn off if you want people to take
     the assessment as a pre-test.
   - **Performance bands**: labels and minimum percentages. One band must start at 0%.
5. Settings apply to assessments **started after** you save. Completed results are never re-scored.

## Suggested agenda (about 2.5–3 hours)

| Time | Activity |
|---|---|
| 10 min | Introduce TQM and the game; everyone creates a profile |
| 15 min | Tutorial |
| 20 min each | Levels 1–6 (pause after Levels 2, 4 and 6 for group discussion) |
| 15 min | Final challenge |
| 15 min | Final assessment |
| 15 min | Debrief using the dashboard's "Hardest questions" list |

Players can stop and continue later: progress is saved in their browser on that device.

## Discussion prompts

- Level 1: Where in our own process do we "inspect quality in" instead of building it in?
- Level 2: Which of the 7 QC tools do we use well, and which do we skip?
- Level 3: When did we last close a problem with "operator error"? What would a 5 Whys have found?
- Level 4: How do we decide when a trial result is conclusive?
- Level 5: Do our complaint responses separate correction, containment, corrective and preventive action?
- Level 6: Where do we shift waste or defects downstream and call it an improvement?

## Results

- The **Results** table shows name, team, employee ID (if entered), score, %, band, pass/fail, practice QIP,
  missions completed and time taken.
- **Export CSV** downloads all results for Excel or your LMS.
- Results are stored in `data/tqm_results.sqlite3`. Back up this file to keep a permanent record.
- Each participant can submit the assessment once per profile. Repeated clicks or network retries cannot create
  duplicates: the server recognises the submission ID and returns the original result.
- A participant who resets their progress (Menu → Reset) can take the assessment again as a new attempt; both
  attempts then appear in the table with their timestamps.

## Privacy

The game stores only the name, optional team and optional employee ID that participants type, their answers and
scores. Tell participants how results will be used. Delete results from the dashboard when they are no longer
needed.

## Troubleshooting

| Problem | Fix |
|---|---|
| `python` is not recognised | Reinstall Python and tick "Add Python to PATH", or try `py run.py` (Windows) / `python3 run.py` (macOS/Linux). |
| "Could not start on port 8000" | Another program uses that port: `python run.py --port 8080`. |
| Participants cannot open the address | Use `--lan`, make sure everyone is on the same network, and allow Python through the firewall. Some guest Wi-Fi networks block device-to-device traffic. |
| Forgotten host PIN | Look in `data/host_pin.txt`, or restart with `TQM_HOST_PIN` set. |
| "Too many attempts" at login | Wait five minutes (protects the PIN from guessing). |
| The assessment says the server cannot be reached | The terminal running `run.py` was closed. Start it again; participants' progress is kept in their browsers. |
| A participant wants to restart | Menu → *Reset my progress on this device*. |
