// Learning content: characters and the six missions. All plant data is fictional and labelled SIMULATED.
// Terms marked [TQM-VALIDATE] in README must be confirmed by JK Tyre's TQM cell before rollout.
(function () {
  const DWM = window.DWM;

  DWM.CHARACTERS = {
    arjun: { name: "Arjun", role: "Production Supervisor", color: "#2f5f9e", skin: "#b07a52", hair: "#1c1a1a", hat: "#e3a73a" },
    meera: { name: "Meera", role: "DWM Champion", color: "#1f7a6d", skin: "#c48c63", hair: "#231a17", hat: null },
    kabir: { name: "Kabir", role: "Problem-Solving Engineer", color: "#8a5a12", skin: "#a8714b", hair: "#2a2220", hat: "#f2f5fa" },
    asha:  { name: "Asha", role: "Quality Mentor", color: "#6b3f86", skin: "#bf8660", hair: "#1a1414", hat: null },
  };

  const SIM = '<span class="sim">SIMULATED DATA</span>';
  const tbl = (head, rows, flags = []) =>
    `<div class="tablewrap"><table><thead><tr>${head.map((h) => `<th${/^#|num:/.test(h) ? ' class="num"' : ""}>${h.replace(/^num:/, "")}</th>`).join("")}</tr></thead><tbody>${rows
      .map((r, i) => `<tr${flags.includes(i) ? ' class="flag"' : ""}>${r.map((c, j) => `<td${/^num:/.test(head[j]) ? ' class="num"' : ""}>${c}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></div>`;
  DWM.tbl = tbl;
  DWM.SIM = SIM;

  // ---------------------------------------------------------------- Mission 1
  const m1 = {
    id: "m1", n: 1, phase: "PLAN", title: "Build the DWM Foundation", guide: "meera",
    summary: "Connect objectives, roles, standards, the MP/CP Tree and the MP Planning Sheet to daily work.",
    steps: [
      { id: "intro", type: "dialog", speaker: "meera", say: "Welcome, Improvement Champion. DWM, Daily Work Management, is how every person runs their routine work to standard, checks it against targets and acts on abnormalities every day. It starts with PLAN: the structure that makes daily work measurable." },
      { id: "cards", type: "dialog", speaker: "meera",
        say: "Here are the six building blocks on our curing department wall. Read each card. In the next step you'll put them in the order an objective flows down to the shop floor.",
        panel: `<div class="grid2">${[
          ["Organisational objective", "Plant goal, e.g. improve curing output and on-time delivery this year."],
          ["Organisation structure & Role Sheet", "Who is responsible for what: each role's duties, MP/CPs and review responsibilities."],
          ["Standards", "Approved way of doing the work: SOPs, work instructions, control plans, PM checklists."],
          ["MP/CP Tree", "Breaks a result measure (Management Point) down into the process measures that drive it (Check Points)."],
          ["MP Planning Sheet", "For each MP/CP: unit, target, frequency, method, data source, owner, and the action when off-target."],
          ["Daily performance record", "The board/log where actuals are recorded against target at the defined frequency."],
        ].map(([t, d]) => `<div class="panel flat"><div class="label">${t}</div><p class="muted">${d}</p></div>`).join("")}</div>` },
      { id: "chain", type: "sequence", speaker: "meera",
        prompt: "Order the cards from the organisational objective down to the daily record.",
        items: ["Organisational objective", "Organisation structure & Role Sheet", "Standards", "MP/CP Tree", "MP Planning Sheet", "Daily performance record"],
        fbWrong: "Not quite. Ask: who owns it (Role Sheet), how is it done (Standards), which measures show it (MP/CP Tree), how and when each is tracked (MP Planning Sheet), and where it is recorded daily.",
        learn: "This matches the PLAN stage of our DWM flow: Organisation structure, Role Sheet and Standards, then the MP/CP Tree and the MP Planning Sheet. The daily record is where DO and CHECK happen." },
      { id: "tree-vs-sheet", type: "classify", speaker: "meera",
        prompt: "The MP/CP Tree and the MP Planning Sheet are different documents. Which one answers each question?",
        categories: ["MP/CP Tree", "MP Planning Sheet"],
        items: [
          { t: "Which process measures (e.g. press uptime, cure-cycle adherence) drive shift output?", a: "MP/CP Tree" },
          { t: "What is the target for press uptime and how often is it reviewed?", a: "MP Planning Sheet" },
          { t: "Who records the measure, from which data source?", a: "MP Planning Sheet" },
          { t: "How does a plant result break down into measures each role can control?", a: "MP/CP Tree" },
          { t: "What action is taken, and by whom, when the measure is off-target?", a: "MP Planning Sheet" },
        ],
        learn: "The Tree shows the cause-and-effect breakdown of measures. The Planning Sheet turns each measure into a routine: target, frequency, method, owner and response. Treating them as one document loses either the logic or the routine." },
      { id: "flowdown", type: "choice", speaker: "arjun",
        prompt: "Plant objective: \"Improve curing output and on-time delivery.\" Which is a measurable daily activity derived correctly from it?",
        options: [
          { t: "Shift Supervisor records curing-press uptime and output against the MP Planning Sheet target at each 2-hour checkpoint, and acts on deviations.", ok: true, fb: "Yes. It names the role, the measure, the target source, the frequency and the response. That is DWM." },
          { t: "Everyone tries harder to produce more tyres every day.", fb: "An intention, not a measurable activity. There is no measure, target, frequency or owner." },
          { t: "The plant manager reviews annual output at the year-end meeting.", fb: "Too infrequent to manage daily work. By year-end the losses have already happened." },
          { t: "Operators fill in a log sheet that no one reviews.", fb: "Recording without review and action is not management. DWM requires a defined review and response." },
        ],
        learn: "DWM translates objectives and standards into routine execution, monitoring and corrective action." },
      { id: "close", type: "dialog", speaker: "meera", say: "Good foundation. Remember the chain: objective → role → standard → measure → plan → daily record. If any link is missing, daily work drifts. Next, Arjun will show you how targets and review frequency are set." },
    ],
  };

  // ---------------------------------------------------------------- Mission 2
  const paceTable = tbl(["Checkpoint", "num:Expected (cum.)", "num:Actual (cum.)", "num:Gap"], [
    ["08:00 (2 h)", "250", "220", '<span class="bad-t">−30</span>'],
    ["10:00 (4 h)", "500", "390", '<span class="bad-t">−110</span>'],
    ["12:00 (6 h)", "750", "570", '<span class="bad-t">−180</span>'],
  ]);
  const m2 = {
    id: "m2", n: 2, phase: "PLAN · DO", title: "Set the Target and Review Frequency", guide: "arjun",
    summary: "Compare actual output with plan, set a sound target and choose how often to review.",
    steps: [
      { id: "intro", type: "dialog", speaker: "arjun", say: "Curing Line 2, Shift A, 06:00–14:00. Plan is 1,000 tyres per shift. Our MP Planning Sheet levels that at 125 tyres per hour, so we can judge pace at each 2-hour checkpoint instead of waiting for shift end." },
      { id: "gap", type: "choice", speaker: "arjun",
        panel: `<div class="row"><b>Curing Line 2 · Shift A · Plan 1,000 tyres</b>${SIM}</div>${paceTable}<p class="muted" style="margin-top:6px">Expected = 125 tyres/hour × hours elapsed (levelled plan, simulated).</p>`,
        prompt: "Actuals at successive checkpoints are 220, 390 and 570. What does the comparison tell you?",
        options: [
          { t: "The line is 180 tyres (24%) behind expected at 12:00 and the gap has widened at every checkpoint. Verify the data and investigate now.", ok: true, fb: "Correct. The gap grew from 30 to 110 to 180. A widening gap means something is still going wrong." },
          { t: "570 is 57% of 1,000 with 2 hours left, so the shift is roughly on track.", fb: "Two hours at plan pace adds only 250, giving at most 820. Comparing with the levelled expected figure shows the real gap." },
          { t: "Wait until shift end; output often catches up.", fb: "Waiting removes the chance to recover. The checkpoint review exists to act within the shift." },
          { t: "Reduce the shift target to 800 so the gap closes.", fb: "Changing a target to make actuals look acceptable hides the problem. Targets change only through the approved planning process." },
        ],
        learn: "Expected-to-date (not just the end-of-shift target) is how a checkpoint review detects a gap early." },
      { id: "target", type: "choice", speaker: "arjun",
        prompt: "Line 3 is starting a new tyre size. Which target-setting approach should the MP Planning Sheet use?",
        options: [
          { t: "Derive the target from customer demand and the approved production plan, then check it against demonstrated process capability (cycle time × presses × available time, less planned losses) and known constraints.", ok: true, fb: "Right. A good target is aligned to demand and plans, achievable by the process as it is, and challenging where capability allows." },
          { t: "Copy Line 2's target of 1,000 because the lines look similar.", fb: "Copying blindly ignores differences in cure time, press count, tyre size and constraints." },
          { t: "Set it 20% above last month's best, because stretch always motivates.", fb: "An arbitrary stretch with no link to demand or capability produces a target that is either meaningless or impossible." },
          { t: "Let each shift set its own target based on what it achieved yesterday.", fb: "That makes the target follow performance. A target must be set independently so gaps are visible." },
        ],
        learn: "Targets must be aligned with customer demand, approved plans, process capability and constraints, and approved by the right authority." },
      { id: "freq", type: "classify", speaker: "meera",
        prompt: "Choose a suitable review frequency for each situation.",
        categories: ["Continuous / near-real-time with alarm", "Each 1–2 h checkpoint in the shift", "Daily", "Monthly"],
        items: [
          { t: "Fast-moving tyre-building line with frequent small deviations in output and scrap.", a: "Each 1–2 h checkpoint in the shift" },
          { t: "Stable process: warehouse label stock level, changes slowly, low risk.", a: "Daily" },
          { t: "Critical parameter: curing platen temperature and pressure, with cure-quality and safety impact.", a: "Continuous / near-real-time with alarm" },
        ],
        fbWrong: "Match frequency to risk and speed of change: the faster things change and the higher the impact, the shorter the interval.",
        learn: "Review frequency depends on risk, speed of change, the time needed to respond, customer and safety impact, and the approved control plan. Critical cure parameters follow the control plan's monitoring requirements. [TQM-VALIDATE: confirm against JK Tyre control plans.]" },
      { id: "freq-why", type: "choice", speaker: "meera",
        prompt: "Why not simply review everything every 15 minutes?",
        options: [
          { t: "Over-frequent review of slow, low-risk measures wastes effort and buries the important signals. Effort should follow risk.", ok: true, fb: "Exactly. Frequency is a design choice that balances detection speed against effort." },
          { t: "Because frequent review is never useful.", fb: "Frequent review is essential for fast-changing or critical measures." },
          { t: "Because the board only has space for daily figures.", fb: "Board layout follows the MP Planning Sheet, not the other way round." },
        ] },
      { id: "close", type: "dialog", speaker: "arjun", say: "Good. Now let's go to the DWM station. The board should tell us what the team planned, what actually happened, where the gaps are, and who is following up." },
    ],
  };

  // ---------------------------------------------------------------- Mission 3 (DWM station, see station.js)
  const BOARD = {
    A: { t: "Shift target vs actual", v: "Plan 1,000 · Exp. 750 · Act. 570", alert: true,
      html: `<div class="row" style="justify-content:space-between"><b>A · Shift target and actual · Curing Line 2 · Shift A (06:00–14:00)</b>${SIM}</div>
      ${tbl(["Checkpoint", "num:Expected (cum.)", "num:Actual (cum.)", "num:Gap", "num:Gap %"], [["08:00", "250", "220", "−30", "−12%"], ["10:00", "500", "390", "−110", "−22%"], ["12:00 (current)", "750", "570", "−180", "−24%"]], [2])}
      <p style="margin-top:8px">Expected = levelled plan of 125 tyres/h. Shift plan = 1,000 tyres. Alert rule on MP Planning Sheet: act if gap &gt; 5% at any checkpoint.</p>` },
    B: { t: "MP / CP indicators", v: "Uptime 82% (tgt ≥ 95%)", alert: true,
      html: `<div class="row" style="justify-content:space-between"><b>B · MP/CP indicators (to 12:00)</b>${SIM}</div>
      ${tbl(["Indicator", "Type", "num:Target", "num:Actual", "Status"], [["Shift output (tyres)", "MP", "750 by 12:00", "570", '<span class="bad-t">Off target</span>'], ["Curing press uptime (6 presses)", "CP", "≥ 95%", "82%", '<span class="bad-t">Off target</span>'], ["Cure-cycle adherence", "CP", "100%", "100%", '<span class="ok-t">OK</span>'], ["Tyres on quality hold", "MP", "0", "48", '<span class="bad-t">Off target</span>'], ["First-pass yield", "MP", "≥ 98.5%", "98.9%", '<span class="ok-t">OK</span>']], [0, 1, 3])}` },
    C: { t: "Review frequency & time", v: "Next review 14:00", alert: false,
      html: `<div class="row" style="justify-content:space-between"><b>C · Review frequency and time</b>${SIM}</div>
      ${tbl(["Indicator", "Review frequency", "Reviewer (role)", "Last", "Next"], [["Shift output", "Every 2 h checkpoint", "Shift Supervisor", "12:00", "14:00 (handover)"], ["Press uptime / stops", "Shift end only", "Shift Supervisor", "06:00", "14:00"], ["Quality hold status", "Each checkpoint", "Quality Inspector", "12:00", "14:00"], ["Action tracker", "Daily 09:30 meeting", "Production Manager", "Today 09:30", "Tomorrow 09:30"]])}` },
    D: { t: "Abnormality / loss record", v: "CP-04: 5 stops · 46 min", alert: true,
      html: `<div class="row" style="justify-content:space-between"><b>D · Abnormality / loss record · Shift A</b>${SIM}</div>
      ${tbl(["Time", "Where", "What was observed", "num:Loss", "Source"], [["06:52", "CP-04", "Press stop, alarm: platen steam pressure low", "9 min", "Press PLC log"], ["08:31", "CP-04", "Press stop, same alarm", "8 min", "Press PLC log"], ["09:47", "CP-04", "Press stop, same alarm", "11 min", "Press PLC log"], ["10:58", "CP-04", "Press stop, same alarm", "9 min", "Press PLC log"], ["11:40", "CP-04", "Press stop, same alarm", "9 min", "Press PLC log"], ["11:45", "Quality hold", "48 tyres from CP-04 (cured 06:52–11:40) placed on hold pending cure-quality inspection", "48 tyres", "Quality hold tag QH-0412"]], [0, 1, 2, 3, 4])}
      <p style="margin-top:8px">Total CP-04 stoppage: 46 min. Other presses: no stops recorded.</p>` },
    E: { t: "Action tracker", v: "1 overdue action", alert: true,
      html: `<div class="row" style="justify-content:space-between"><b>E · Action tracker</b>${SIM}</div>
      ${tbl(["ID", "Action", "Owner (role)", "Due", "Status"], [["A-115", "Replace worn bladder on CP-02", "Maintenance Lead", "10 Oct", "Closed · effectiveness verified"], ["A-117", "Check CP-04 steam supply after low-pressure stops on previous shift", "Maintenance Lead", "Yesterday", '<span class="bad-t">Open · OVERDUE</span>'], ["A-118", "Refresher on green-tyre loading standard, Shift C", "Shift Supervisor", "+6 days", "In progress"]], [1])}` },
    F: { t: "Standard reference", v: "SOP-CUR-07 rev 4", alert: false,
      html: `<div class="row" style="justify-content:space-between"><b>F · Relevant standards</b>${SIM}</div>
      <ul><li><b>SOP-CUR-07 rev 4</b>: Curing press stop recovery. Operator may reset only after the alarm cause is cleared. Steam-side work needs Maintenance with lock-out/tag-out (LOTO).</li>
      <li><b>QP-HOLD-02</b>: Any tyre cured during a cure-parameter deviation is tagged and held. Release only by Quality after inspection.</li>
      <li><b>ESC-MAT-01</b>: Escalation matrix (see H).</li></ul>` },
    G: { t: "Previous shift / trend", v: "CP-04 stops ↑ 4 shifts", alert: true,
      html: `<div class="row" style="justify-content:space-between"><b>G · Previous shifts: low steam-pressure stops</b>${SIM}</div>
      ${tbl(["Shift", "num:CP-04 stops", "num:CP-04 min lost", "num:Other presses stops"], [["2 days ago · C (night)", "2", "17", "0"], ["Yesterday · A", "0", "0", "1"], ["Yesterday · B", "3", "28", "0"], ["Yesterday · C (night)", "4", "35", "0"], ["Today · A (to 12:00)", "5", "46", "0"]], [0, 2, 3, 4])}
      <p style="margin-top:8px">Each time the press was reset and production recovered, but the stops returned.</p>` },
    H: { t: "Escalation / support", v: "Matrix ESC-MAT-01", alert: false,
      html: `<div class="row" style="justify-content:space-between"><b>H · Escalation matrix (ESC-MAT-01)</b>${SIM}</div>
      ${tbl(["Condition", "Escalate to (role)", "Within"], [["Output gap > 5% at a checkpoint", "Shift Supervisor → Production Manager", "Same checkpoint"], ["Equipment stop repeating ≥ 3 times/shift", "Maintenance Lead", "Immediately"], ["Product on hold for a cure-parameter deviation", "Quality Engineer", "Immediately"], ["Action overdue", "Production Manager (daily meeting)", "Next daily review"], ["Any safety risk", "Stop, make safe, Safety Officer", "Immediately"]])}` },
  };

  const m3 = {
    id: "m3", n: 3, phase: "DO · CHECK", title: "DWM Station Walk-up", guide: "arjun", station: true,
    summary: "Walk to the DWM station beside the curing line, read the boards and run a structured review.",
    board: BOARD,
    steps: [
      { id: "walk", type: "walk", title: "Walk to the station", speaker: "arjun",
        say: "Before we act, let's go to the DWM station. The board should tell us what the team planned, what actually happened, where the gaps are, and who is following up.",
        arrive: { speaker: "meera", say: "Reviews happen here, at a fixed place and a fixed cadence, so the right people meet the facts on time. Nobody has to search for data or chase people. This board is our review point." } },
      { id: "target", title: "Review the target", requires: ["A"], type: "choice", speaker: "arjun",
        prompt: "Open board A. How is the line performing against plan?",
        options: [
          { t: "At 12:00 the line is 180 tyres (24%) behind the expected 750, and the gap has grown at every checkpoint.", ok: true, fb: "Right. You compared the actual with the expected-to-date figure, not just the shift total." },
          { t: "570 of 1,000 with two hours left: on track.", fb: "Two more hours at 125/h gives at most 820. Check the expected-to-date figure on board A." },
          { t: "The target of 1,000 is too high, so the gap isn't real.", fb: "The target comes from the approved plan. Questioning it is a planning topic, not a reason to ignore today's gap." },
        ] },
      { id: "freq", title: "Check review frequency", requires: ["C"], type: "choice", speaker: "meera",
        prompt: "Open board C. Is the review frequency suitable for what is happening on the line?",
        options: [
          { t: "Output review every 2 h is fine, but press stops are reviewed only at shift end. While stops repeat and output is falling, review them at each checkpoint (or sooner) so action isn't delayed.", ok: true, fb: "Yes. Frequency should match risk and speed of change. A shift-end review of a live, repeating problem is too slow." },
          { t: "Everything is fine as defined. The board says next review at 14:00.", fb: "A defined frequency still needs a sense check. Five stops by 12:00 with no review until 14:00 means delayed action." },
          { t: "Move all reviews to weekly to reduce meeting time.", fb: "Weekly review of a fast-changing line would miss shift-level losses entirely." },
          { t: "Review every indicator every 5 minutes from now on.", fb: "Over-reviewing stable indicators wastes effort. Increase frequency where risk is, not everywhere." },
        ] },
      { id: "spot", title: "Spot abnormalities", requires: ["B", "D"], type: "classify", speaker: "meera",
        prompt: "Open boards B and D. Sort each statement: is it an observed fact or an assumption?",
        categories: ["Observed fact", "Assumption"],
        items: [
          { t: "Output is 180 tyres below expected at 12:00.", a: "Observed fact" },
          { t: "CP-04 stopped 5 times this shift with 'platen steam pressure low', 46 min lost.", a: "Observed fact" },
          { t: "48 tyres from CP-04 are on quality hold pending inspection.", a: "Observed fact" },
          { t: "Action A-117 is past its due date.", a: "Observed fact" },
          { t: "The CP-04 operator is careless.", a: "Assumption" },
          { t: "The 48 held tyres are defective.", a: "Assumption" },
          { t: "The boiler house is supplying low steam pressure.", a: "Assumption" },
        ],
        fbWrong: "A fact is something the board, a log or a measurement shows. A judgement about people, or a cause nobody has checked, is an assumption.",
        learn: "Held tyres are 'suspect', not 'defective', until inspection decides. Blaming a person without evidence is an assumption, and it stops the team looking for the real cause." },
      { id: "record", title: "Open the record", type: "classify", speaker: "meera",
        prompt: "Build a concise problem statement for the abnormality record. Pick the best entry for each field.",
        items: [
          { t: "<b>What</b>", options: ["Press is bad", "Repeated press stops, alarm 'platen steam pressure low'", "Operator stopped the press"], a: "Repeated press stops, alarm 'platen steam pressure low'" },
          { t: "<b>Where</b>", options: ["Curing area somewhere", "Curing Line 2, press CP-04", "All presses"], a: "Curing Line 2, press CP-04" },
          { t: "<b>When</b>", options: ["Today, Shift A, 06:52–11:40 (5 stops)", "Always", "Sometimes in the morning"], a: "Today, Shift A, 06:52–11:40 (5 stops)" },
          { t: "<b>How big</b>", options: ["46 min lost, output −180 vs expected, 48 tyres on hold", "A lot of loss", "Not known"], a: "46 min lost, output −180 vs expected, 48 tyres on hold" },
          { t: "<b>Evidence</b>", options: ["Press PLC alarm log, board D, hold tag QH-0412", "Operator's opinion", "None needed"], a: "Press PLC alarm log, board D, hold tag QH-0412" },
        ],
        learn: "A good problem statement is specific (what, where, when, how big) and evidence-based, with no cause and no blame in it." },
      { id: "tracker", title: "Review the action tracker", requires: ["E", "H"], type: "choice", speaker: "arjun",
        prompt: "Open boards E and H. Action A-117 (Maintenance Lead, due yesterday) is overdue and linked to today's stops. What should the review do?",
        options: [
          { t: "Ask the owner for status and the reason for the delay, agree a realistic new date, record it, and escalate per the matrix because it is linked to a live, repeating abnormality.", ok: true, fb: "Correct. Ownership, due date and status are reviewed, not just displayed. Overdue actions linked to live problems are escalated." },
          { t: "Mark A-117 closed. The press restarts each time anyway.", fb: "Closing an action that has not been done hides the problem, and the stops are still happening." },
          { t: "Quietly move the due date to next week so the board looks green.", fb: "Silently changing dates removes accountability. Changes must be agreed and recorded." },
          { t: "Reassign it to the CP-04 operator.", fb: "Steam-side checks need Maintenance and LOTO. The owner must be a role with the authority and skills to act." },
        ] },
      { id: "next", title: "Decide the next step", requires: ["F"], type: "multi", speaker: "arjun",
        prompt: "Open board F. Select ALL appropriate immediate steps.",
        options: [
          { t: "Confirm the stop data against the press PLC log.", ok: true, fb: "Verify facts before acting." },
          { t: "Restore normal conditions per SOP-CUR-07: Maintenance clears the steam-side cause under LOTO before reset.", ok: true, fb: "Restore safely and to standard." },
          { t: "Keep the 48 tyres on hold until Quality inspects and decides, per QP-HOLD-02.", ok: true, fb: "Containment protects the customer." },
          { t: "Record the abnormality and escalate to the Maintenance Lead and Quality Engineer per ESC-MAT-01.", ok: true, fb: "Record and escalate as the matrix requires." },
          { t: "Release the held tyres to recover output.", ok: false, fb: "Never bypass quality controls to hit output." },
          { t: "Bypass the low-pressure interlock to stop the nuisance stops.", ok: false, fb: "Bypassing a safety or quality interlock is unsafe and prohibited." },
          { t: "Lower today's target to 600.", ok: false, fb: "Changing the target hides the gap." },
        ],
        learn: "Immediate correction restores normal conditions. Containment limits the impact while the issue is investigated. Neither removes the root cause." },
      { id: "history", title: "Check history", requires: ["G"], type: "choice", speaker: "kabir",
        prompt: "Open board G. Is this issue isolated or recurring, and what does that imply?",
        options: [
          { t: "Recurring: CP-04 has had the same low-pressure stops in 4 of the last 5 shifts while other presses are clean. Resetting hasn't fixed it, so a Why-Why / RCA is warranted.", ok: true, fb: "Yes. The same phenomenon keeps returning on one press. Correction alone has failed, so we need the root cause." },
          { t: "Isolated: production recovered each time.", fb: "Recovery each time is exactly why it keeps returning. The cause was never removed." },
          { t: "Recurring on all presses, so it must be the boiler.", fb: "Board G shows other presses with almost no stops. The pattern points to CP-04 specifically." },
        ] },
      { id: "summary", title: "Summarise the review", type: "summary", speaker: "meera",
        prompt: "Here is the review summary built from your decisions. Confirm the next review time and whether RCA is warranted.",
        fields: {
          nextReview: { label: "Next review of CP-04 stops", options: ["Next checkpoint (14:00), and at every checkpoint while the issue is open", "Tomorrow's daily meeting", "End of the month"], a: 0 },
          rca: { label: "Why-Why / RCA warranted?", options: ["Yes: recurring across shifts, correction alone has not worked", "No: production recovers each time"], a: 0 },
        } },
      { id: "close", type: "dialog", speaker: "meera", say: "Well done. The DWM station isn't just a display board. It is where we review, decide, assign owners, escalate and follow up. And we never change a target just to make the actual look acceptable." },
    ],
  };

  // ---------------------------------------------------------------- Mission 4
  const tbBoard = `<div class="board"><div class="board-title"><b>TYRE BUILDING · TB-2 · SHIFT B (14:00–22:00) · REVIEW AT 18:30</b>${SIM}</div>
    <div class="board-detail" style="margin-top:0">${tbl(["Measure", "Target / expected", "Actual", "Rule (MP Planning Sheet)"], [["Output (green tyres)", "540 by 18:30 (plan 960/shift)", "508", "Act if gap > 5%"], ["Downtime", "≤ 45 min per shift", "21 min so far", "Act if > 45 min"], ["Scrap", "≤ 1.0%", "Board: 9 tyres (1.8%)<br>MES log: 13 tyres (2.6%)", "Act if > 1.0%"], ["Green-tyre weight check", "Hourly, all in spec", "17:00 OK · 18:00: 2 of 5 underweight (drum 3)", "Out of spec ⇒ contain"]])}
    <div style="height:10px"></div>
    ${tbl(["Shift", "num:Output", "num:Scrap %"], [["Yesterday A", "958", "0.9"], ["Yesterday B", "961", "0.8"], ["Today A", "955", "1.0"], ["Today B (to 18:30)", "508", "2.6 (MES)"]])}</div></div>`;
  const m4 = {
    id: "m4", n: 4, phase: "CHECK", title: "Identify and Respond to Abnormalities", guide: "meera",
    summary: "Verify the data, identify the abnormality, contain, restore and escalate in proportion to the risk.",
    steps: [
      { id: "intro", type: "dialog", speaker: "meera", say: "A new board, a different area: tyre building line TB-2. CHECK means asking 'Is there an abnormality?' If not, we continue routine work. If yes, we restore normal conditions safely, then identify and record it." },
      { id: "verify", type: "choice", speaker: "meera", panel: tbBoard,
        prompt: "The board scrap count (9 tyres) and the MES scrap log (13 tyres) don't match. What first?",
        options: [
          { t: "Verify the figures at source (MES scrap log, scrap bin count) and correct the board before deciding.", ok: true, fb: "Right. Decisions on wrong data are wrong decisions. Verify first, quickly." },
          { t: "Use the board figure; it's what the team wrote.", fb: "When two sources disagree, check the source data before acting." },
          { t: "Ignore scrap until month-end reconciliation.", fb: "Either figure is above the 1.0% limit. Waiting for month-end means the loss keeps happening." },
        ] },
      { id: "identify", type: "multi", speaker: "meera", panel: tbBoard,
        prompt: "After verification (scrap confirmed at 13 tyres, 2.6%), which measures are abnormal against their rules? Select all.",
        options: [
          { t: "Output: 508 vs 540 expected (−5.9%)", ok: true, fb: "Gap > 5% rule ⇒ abnormal." },
          { t: "Downtime: 21 min vs ≤ 45 per shift", ok: false, fb: "Within its limit, so normal." },
          { t: "Scrap: 2.6% vs ≤ 1.0%", ok: true, fb: "Above limit ⇒ abnormal." },
          { t: "Green-tyre weight: 2 checks out of spec at 18:00", ok: true, fb: "Out-of-spec ⇒ abnormal and needs containment." },
        ],
        learn: "An abnormality is a deviation from the standard or target, judged by the rule on the MP Planning Sheet, not by feeling." },
      { id: "respond", type: "multi", speaker: "asha",
        prompt: "Two green tyres from building drum 3 were underweight at the 18:00 check; the 17:00 check was in spec. Select ALL appropriate immediate responses.",
        options: [
          { t: "Segregate and tag all tyres built on drum 3 since the last good check (17:00) and inform Quality, per the hold procedure.", ok: true, fb: "Contain everything that might be affected, back to the last good check." },
          { t: "Stop drum 3 and restore it to standard. Only authorised staff make adjustments, then verify with a check.", ok: true, fb: "Restore normal conditions safely, then confirm with data." },
          { t: "Record the abnormality and escalate to the Shift Supervisor and Quality as per the matrix.", ok: true, fb: "Record it and escalate it." },
          { t: "Send them to curing; final inspection will catch any bad ones.", ok: false, fb: "Passing suspect product downstream bypasses quality control." },
          { t: "Change the scrap target to 2.6% for this shift.", ok: false, fb: "Moving the target hides the abnormality." },
          { t: "Write 'operator error' as the cause in the log.", ok: false, fb: "No evidence yet. Recording blame closes the investigation before it starts." },
        ] },
      { id: "proportion", type: "classify", speaker: "kabir",
        prompt: "Responses must be proportionate. Choose the right level for each abnormality.",
        categories: ["Correct, record & monitor", "Contain, escalate & investigate (RCA)"],
        items: [
          { t: "Label printer jammed once for 3 minutes, cleared, no repeat in history.", a: "Correct, record & monitor" },
          { t: "Same curing press stopping with the same alarm across 4 shifts.", a: "Contain, escalate & investigate (RCA)" },
          { t: "Possible under-cure on tyres already shipped to a customer.", a: "Contain, escalate & investigate (RCA)" },
          { t: "One bead-wire spool changed 5 min late; output unaffected; first time.", a: "Correct, record & monitor" },
        ],
        learn: "Not every abnormality needs a full Why-Why or a standard revision. Severity, recurrence, risk and how systemic it is decide the response. Safety or customer-risk issues are always escalated immediately." },
      { id: "restored", type: "choice", speaker: "kabir",
        prompt: "Drum 3 is adjusted and the 19:00 weight check is in spec. Is the problem solved?",
        options: [
          { t: "Normal conditions are restored, but the cause isn't known. Keep the containment until Quality decides, monitor at each check, and check history. If it recurs, or the risk is high, investigate the root cause.", ok: true, fb: "Exactly. Restoring normal conditions doesn't automatically remove the underlying cause." },
          { t: "Yes, the check is in spec, so close it.", fb: "One good check shows restoration, not prevention. Without the cause, it can return." },
          { t: "Yes, and release the held tyres now.", fb: "Held product is released only by Quality after inspection." },
        ] },
      { id: "close", type: "dialog", speaker: "meera", say: "Good judgement. Now, back to curing press CP-04. Its stops keep returning, so Kabir needs your help finding the root cause." },
    ],
  };

  // ---------------------------------------------------------------- Mission 5
  const EVIDENCE = {
    E1: { t: "Shift records (5 shifts)", d: "CP-04: 14 stops, all with alarm 'platen steam pressure low'. Other 5 presses: 1 stop in total. Restart times after each stop: 7–11 min, same as the plant standard." },
    E2: { t: "Platen pressure trace", d: "CP-04 platen steam pressure dips from 15.2 bar to below the 14.0 bar interlock limit before each stop. Steam header pressure stays steady at 16.5 bar throughout." },
    E3: { t: "Header & other presses", d: "Presses CP-01 to CP-06 share the same steam header. Only CP-04 shows pressure dips." },
    E4: { t: "Maintenance inspection (today)", d: "CP-04 platen-line strainer found ~70% blocked with scale. Steam trap downstream sluggish, with condensate backing up into the line." },
    E5: { t: "Maintenance history", d: "CP-04 strainer last cleaned 14 months ago, during a breakdown. No record of routine strainer or trap inspection on any press." },
    E6: { t: "PM checklist PM-CUR-03 rev 2", d: "Covers bladder, seals, hydraulics, platen temperature calibration. Strainer and steam-trap inspection are not included." },
  };
  const m5 = {
    id: "m5", n: 5, phase: "ACT", title: "Why-Why Analysis and RCA", guide: "kabir",
    summary: "Build an evidence-backed Why-Why chain for CP-04's repeated stops and plan the corrective action.",
    evidence: EVIDENCE,
    steps: [
      { id: "intro", type: "dialog", speaker: "kabir", say: "Production recovered each time, but the stops came back. That's our signal for root-cause analysis. Rules: every 'why' must be backed by evidence, we stop when we reach a cause we can act on that explains all the facts, and we don't assume operator error." },
      { id: "w1", type: "why", speaker: "kabir", level: 1, phenomenon: "CP-04 stops repeatedly (14 stops in 5 shifts).",
        prompt: "Why 1: Why does CP-04 stop?",
        options: [
          { t: "Platen steam pressure falls below the 14.0 bar interlock limit, tripping the press.", ok: true, ev: ["E2", "E1"], fb: "Supported by the pressure trace (E2) and the alarm in every record (E1)." },
          { t: "Operators restart the press too slowly.", ev: null, fb: "E1 shows restart times are normal. And slow restarts don't explain why the press stops in the first place." },
          { t: "The press is old.", ev: null, fb: "Age is not a mechanism. It explains nothing that can be checked or acted on." },
        ] },
      { id: "w2", type: "why", speaker: "kabir", level: 2, phenomenon: "Platen steam pressure falls below 14.0 bar.",
        prompt: "Why 2: Why does the platen pressure drop?",
        options: [
          { t: "The boiler supplies low steam pressure.", ev: null, fb: "Contradicted: the header holds 16.5 bar (E2), and other presses on the same header don't dip (E3)." },
          { t: "Steam flow to CP-04's platen is restricted, and condensate backs up into the line.", ok: true, ev: "E4", fb: "Supported by today's inspection (E4), and consistent with only CP-04 dipping (E3)." },
          { t: "Pressure gauges are inaccurate.", ev: null, fb: "The interlock trips on its own transmitter, and the dip lines up with real stops. Nothing suggests a gauge fault." },
        ] },
      { id: "w3", type: "why", speaker: "kabir", level: 3, phenomenon: "Steam flow to the CP-04 platen is restricted.",
        prompt: "Why 3: Why is the flow restricted?",
        options: [
          { t: "The platen-line strainer is ~70% blocked with scale and the trap is sluggish.", ok: true, ev: "E4", fb: "Directly observed in the maintenance inspection (E4)." },
          { t: "Someone partly closed the steam valve.", ev: null, fb: "No evidence. An assumption about a person." },
          { t: "Bad luck: random variation.", ev: null, fb: "14 stops with one alarm on one press is a pattern, not random noise." },
        ] },
      { id: "w4", type: "why", speaker: "kabir", level: 4, phenomenon: "The strainer is ~70% blocked.",
        prompt: "Why 4: Why did the strainer block?",
        options: [
          { t: "It is only cleaned on breakdown (last done 14 months ago). No routine inspection exists.", ok: true, ev: "E5", fb: "Supported by the maintenance history (E5)." },
          { t: "Maintenance technicians are lazy.", ev: null, fb: "Blame, not a cause. The records show the task was never scheduled." },
        ] },
      { id: "w5", type: "why", speaker: "kabir", level: 5, phenomenon: "No routine strainer/trap inspection is done.",
        prompt: "Why 5: Why is there no routine inspection?",
        options: [
          { t: "The PM standard PM-CUR-03 doesn't include strainer and steam-trap inspection.", ok: true, ev: "E6", fb: "Confirmed by the checklist (E6). This is a system cause we can correct, and it explains all the evidence." },
          { t: "The maintenance budget is too small.", ev: null, fb: "No evidence links budget to this gap. The checklist itself never asked for the task." },
        ] },
      { id: "stop", type: "choice", speaker: "kabir",
        prompt: "We've reached 'PM standard omits strainer/trap inspection'. Ask another why, or stop?",
        options: [
          { t: "Stop here. It's a verified, controllable system cause that explains all the evidence. Then verify it by testing whether the countermeasure removes the stops.", ok: true, fb: "Right. There's no fixed number of whys. Stop at an actionable, evidenced root cause, and verify it." },
          { t: "Always continue to exactly five whys.", fb: "'Five' is a guide, not a rule. Going further without evidence leads to speculation." },
          { t: "Continue: 'Why was the standard written badly? Because the author was careless.'", fb: "That turns into blame without evidence. The actionable cause is the standard's content." },
        ] },
      { id: "types", type: "classify", speaker: "kabir",
        prompt: "Classify each action.",
        categories: ["Correction", "Containment", "Corrective action"],
        items: [
          { t: "Clean the CP-04 strainer and service the trap under LOTO, then restart.", a: "Correction" },
          { t: "Hold and inspect tyres cured during low-pressure events; review CP-04 pressure at every checkpoint until fixed.", a: "Containment" },
          { t: "Revise PM-CUR-03 to add monthly strainer and steam-trap inspection, with the method and acceptance criteria.", a: "Corrective action" },
        ],
        learn: "Correction restores normal conditions now. Containment limits impact while you investigate. Corrective action removes the verified cause to prevent recurrence." },
      { id: "plan", type: "classify", speaker: "asha",
        prompt: "Complete the corrective-action record for the PM standard revision.",
        items: [
          { t: "<b>Owner (role)</b>", options: ["Maintenance Lead (Curing)", "CP-04 operator", "Everyone"], a: "Maintenance Lead (Curing)" },
          { t: "<b>Due date</b>", options: ["Standard revised and approved within 7 days; first PM round within 14 days", "Whenever possible", "Next year"], a: "Standard revised and approved within 7 days; first PM round within 14 days" },
          { t: "<b>Verification of implementation</b>", options: ["PM records show the new task done on every press; spot check of strainer condition", "Owner says it's done"], a: "PM records show the new task done on every press; spot check of strainer condition" },
          { t: "<b>Effectiveness measure</b>", options: ["Zero low-pressure stops on CP-04 over the next 4 weeks (vs 2.8 per shift baseline)", "Action marked 'Closed' in tracker"], a: "Zero low-pressure stops on CP-04 over the next 4 weeks (vs 2.8 per shift baseline)" },
        ],
        learn: "An action is checked for effectiveness against the original problem measure. Marking it complete is not enough." },
      { id: "close", type: "dialog", speaker: "kabir", say: "Evidence-based and owned. Asha will take it from here: did it work, and where else could the same failure happen?" },
    ],
  };

  // ---------------------------------------------------------------- Mission 6
  const m6 = {
    id: "m6", n: 6, phase: "ACT", title: "Horizontal Deployment and Closing the Loop", guide: "asha",
    summary: "Verify effectiveness, deploy where it applies, revise standards, train and keep monitoring.",
    steps: [
      { id: "intro", type: "dialog", speaker: "asha",
        panel: `<div class="row"><b>CP-04 low steam-pressure stops per shift</b>${SIM}</div>${tbl(["Period", "num:Shifts", "num:Stops", "num:Stops / shift"], [["Before (baseline, 5 shifts)", "5", "14", "2.8"], ["Weeks 1–4 after revised PM", "84", "0", "0.0"]])}`,
        say: "Four weeks on, CP-04 has had zero low-pressure stops in 84 shifts. The PM records show the new task done on schedule. That's effectiveness verified with data, not just 'action closed'. Now, where else might the same failure mechanism exist?" },
      { id: "order", type: "sequence", speaker: "asha",
        prompt: "Put the horizontal-deployment steps in the right order.",
        items: ["Confirm root cause and countermeasure effectiveness", "Identify similar equipment and processes", "Assess applicability and local conditions", "Deploy where appropriate", "Revise relevant standards where justified", "Train affected teams", "Verify implementation and effectiveness", "Continue DWM monitoring and share learning"],
        fbWrong: "Start by proving it works, then find where else it could apply and check that it fits, before deploying, standardising, training and verifying.",
        learn: "Horizontal deployment spreads proven learning. It is not blind copying." },
      { id: "apply", type: "classify", speaker: "asha",
        prompt: "Decide for each candidate.",
        categories: ["Deploy", "Assess first", "Not applicable"],
        items: [
          { t: "CP-01 to CP-06, Line 2: same press model, same strainer and trap design, same PM standard.", a: "Deploy" },
          { t: "Bead-room autoclave: also uses steam strainers and traps, but different pressure and duty cycle.", a: "Assess first" },
          { t: "CP-07/08, Line 3: electrically heated platens, no steam strainer or trap.", a: "Not applicable" },
          { t: "Curing presses at a sister plant: same model, but water quality and PM system unknown.", a: "Assess first" },
          { t: "Mixing-mill cooling-water circuit: different failure mechanism (scaling of cooling channels).", a: "Not applicable" },
        ],
        learn: "Same failure mechanism + similar conditions ⇒ deploy. Similar mechanism, different conditions ⇒ assess first. Different mechanism ⇒ don't copy." },
      { id: "close-loop", type: "multi", speaker: "asha",
        prompt: "The tracker shows every action 'Closed'. Which steps still close the loop? Select all.",
        options: [
          { t: "Confirm the revised PM-CUR-03 is approved, issued and old copies withdrawn.", ok: true, fb: "Standard revision must be formally controlled." },
          { t: "Train maintenance technicians on the revised standard and record the training.", ok: true, fb: "A revised standard nobody is trained on doesn't change practice." },
          { t: "Keep monitoring press stops and pressure dips on the DWM board at the defined frequency.", ok: true, fb: "Sustain: DWM monitoring detects any return." },
          { t: "Share the learning (e.g. a one-point lesson) with other areas.", ok: true, fb: "Shared learning prevents repeats elsewhere." },
          { t: "Remove CP-04 stops from the board since they're solved.", ok: false, fb: "Removing the measure means you would not see recurrence." },
          { t: "Nothing more; 'Closed' proves it worked.", ok: false, fb: "Marking an action complete does not prove effectiveness or sustainment." },
        ] },
      { id: "close", type: "dialog", speaker: "asha", say: "That's the full DWM cycle: PLAN, DO, CHECK, ACT, and back to routine monitoring with a better standard. You're ready for the certification assessment." },
    ],
  };

  DWM.MISSIONS = [m1, m2, m3, m4, m5, m6];
  DWM.MISSION_BY_ID = Object.fromEntries(DWM.MISSIONS.map((m) => [m.id, m]));

  DWM.LEARNING_AREAS = {
    purpose: { label: "DWM purpose", mission: "m1" },
    alignment: { label: "Organisational alignment", mission: "m1" },
    roles: { label: "Role Sheets and standards", mission: "m1" },
    mpcp: { label: "MP/CP Tree and MP Planning Sheet", mission: "m1" },
    target: { label: "Target setting", mission: "m2" },
    frequency: { label: "Review frequency", mission: "m2" },
    monitoring: { label: "Performance monitoring", mission: "m2" },
    station: { label: "DWM station review", mission: "m3" },
    abnormality: { label: "Abnormality identification and recording", mission: "m4" },
    containment: { label: "Correction and containment", mission: "m4" },
    whywhy: { label: "Why-Why Analysis", mission: "m5" },
    rca: { label: "RCA and corrective action", mission: "m5" },
    standards: { label: "Standards revision and team training", mission: "m6" },
    horizontal: { label: "Horizontal deployment", mission: "m6" },
    effectiveness: { label: "Effectiveness verification", mission: "m6" },
  };
})();
