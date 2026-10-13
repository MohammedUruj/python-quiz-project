// End-to-end playthrough: plays every level via the UI, takes the final assessment, checks the host dashboard.
// Optional browser playthrough. Needs Playwright (npm i -g playwright) and a running server:
//   python run.py --no-browser   (with TQM_HOST_PIN=12345678)
//   BASE=http://localhost:8000 node tests/e2e/playthrough.cjs
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright')); }
const BASE = process.env.BASE || 'http://localhost:8000';
const SHOTS = process.env.SHOTS || 'e2e-shots';
require('fs').mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 860 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('dialog', (d) => (d.type() === 'prompt' ? d.accept('DELETE') : d.accept()));

  await page.goto(BASE);
  await page.screenshot({ path: `${SHOTS}/01-title.png` });
  await page.click('text=Start your first shift');
  await page.fill('input[name=name]', 'Test Engineer');
  await page.fill('input[name=team]', 'Curing B');
  await page.click('.avatar-opt >> nth=2');
  await page.screenshot({ path: `${SHOTS}/02-create.png` });
  await page.click('text=Enter the factory');
  await page.waitForSelector('.modal');
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/03-briefing.png` });

  let shotN = 10;
  const modalOpen = () => page.$('.overlay');
  const top = '.overlay >> nth=-1';

  // Walk test: move with keyboard after closing the briefing (accept mission)
  await page.click('text=Accept mission');
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(400); await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: `${SHOTS}/04-factory.png` });

  const pressNear = async () => { await page.keyboard.press('e'); await page.waitForTimeout(250); };

  async function solveStep() {
    const ovs = await page.$$('.overlay'); const body = ovs.length ? await ovs[ovs.length - 1].$('.modal-body') : null;
    if (!body) return 'nomodal';
    // tyre spotting
    if (await body.$('.tyre-grid')) {
      const cards = await body.$$('.tyre-card');
      if (cards.length && !(await cards[0].isDisabled())) {
        const want = ['B', 'D', 'E', 'G', 'H'];
        for (const c of cards) {
          const id = (await c.$eval('.tyre-id', (e) => e.textContent)).replace('Tyre ', '').replace(' · flagged', '').trim();
          const pressed = (await c.getAttribute('aria-pressed')) === 'true';
          if (want.includes(id) !== pressed) await c.click();
        }
        await body.$('button:has-text("Check my selection")').then((b) => b && b.click());
        return 'tyres';
      }
    }
    // check sheet
    const rec = await body.$('.record-card .rec');
    if (rec) {
      const t = await rec.textContent();
      const m = t.match(/·\s*(Press \d)\s*·\s*Shift \w\s*·\s*Defect:\s*(.+)$/);
      if (m) { await (await body.$(`button[aria-label="Record ${m[2].trim()} on ${m[1]}"]`)).click(); return 'check'; }
    }
    // pareto builder chips "(n)"
    const pchips = await body.$$('.chips.wrap > button.chip.big');
    const vals = [];
    for (const c of pchips) { const t = await c.textContent(); const m = t.match(/\((\d+)\)$/); if (m) vals.push([+m[1], c]); }
    if (vals.length) { vals.sort((a, b) => b[0] - a[0]); await vals[0][1].click(); return 'pareto'; }
    // order items (final challenge)
    if (await body.$('.order-list')) {
      const order = ['OEM vibration complaint', 'Press 7 temperature drift', 'Splice-open defects rising', 'Line 1 kaizen: uncertain result'];
      for (const o of order) { const b = await body.$(`button.chip.big:has-text("${o}"):not([disabled])`); if (b) { await b.click(); return 'order'; } }
    }
    // fishbone
    if (await body.$('.fish-pool')) {
      const unplaced = await body.$$('.fish-pool .chip.cause');
      if (unplaced.length) {
        await unplaced[0].click();
        const txt = await unplaced[0].textContent().catch(() => '');
        await (await body.$('.bone h5')).click();
        return 'fish-place';
      }
      const red = await body.$$('.bone .chip.cause.no');
      if (red.length) {
        // move each red chip to the next bone
        const chip = red[0];
        const bones = await body.$$('.bone');
        let idx = 0;
        for (let i = 0; i < bones.length; i++) { if (await bones[i].$('.chip.cause.no')) { idx = i; break; } }
        await chip.click();
        await (await (await body.$$('.bone'))[(idx + 1) % 7].$('h5')).click();
        // any more reds? then check after all moved
        if ((await body.$$('.bone .chip.cause.no')).length === 0) await (await body.$('button:has-text("Check diagram")')).click();
        return 'fish-move';
      }
      const chk = await body.$('button:has-text("Check diagram")');
      if (chk) { await chk.click(); return 'fish-check'; }
    }
    // layout simulator
    if (await body.$('.layout-grid')) {
      if (!(await body.$('.chart-box svg'))) {
        const rows = await body.$$('.layout-row:not(.head)');
        // bead -> P1, carrier -> P2 (free P1/P2 first: tools to P3 is default)
        await (await rows[0].$$('.slot'))[0].click();
        await (await (await body.$$('.layout-row:not(.head)'))[1].$$('.slot'))[1].click();
        for (const name of ['5S shadow', 'Visual standard work', 'Lift assist']) await (await body.$(`button.option.check:has-text("${name}")`)).click();
        await (await body.$('button:has-text("Run simulation")')).click();
        await page.screenshot({ path: `${SHOTS}/${shotN++}-layout.png` });
        return 'layout';
      }
    }
    // trace buttons
    const tr = await body.$('button:has-text("Trace QX"):not([disabled])');
    if (tr) { await tr.click(); return 'trace'; }
    // PDCA countermeasure chooser
    const cm = await body.$('button.option:has-text("Replace the Press 4 bladder now"):not(.tried)');
    const cmSys = await body.$('button.option:has-text("AND move bladder PM")');
    if (cmSys && !(await body.$('.option.correct'))) {
      if (cm && !(await page.evaluate(() => window.__triedReplace))) { await page.evaluate(() => { window.__triedReplace = true; }); await cm.click(); return 'cm-replace'; }
      await cmSys.click(); return 'cm-system';
    }
    // classify rows
    const rows = await body.$$('.classify-row:not(.ok)');
    if (rows.length) {
      for (const r of rows) {
        const chips = await r.$$('.chip');
        if (!chips.length || await chips[0].isDisabled()) continue;
        const attempt = Number(await r.getAttribute('data-try') || '0');
        await chips[attempt % chips.length].click();
        await r.evaluate((el, a) => el.setAttribute('data-try', String(a + 1)), attempt);
      }
      const b = await body.$('button:has-text("Check my classification")');
      if (b) { await b.click(); return 'classify'; }
    }
    // multi select
    const checks = await body.$$('.option.check:not([disabled])');
    if (checks.length && !(await body.$('.layout-grid'))) {
      const wrong = await body.$$('.option.check.wrong[aria-pressed="true"]');
      if (wrong.length) { for (const w of wrong) await w.click(); }
      else { for (const c of checks) if ((await c.getAttribute('aria-pressed')) !== 'true') await c.click(); }
      const b = await body.$('button.btn.primary:has-text("Check")');
      if (b) { await b.click(); return 'multi'; }
    }
    // quiz
    if (await body.$('.quiz-opts')) {
      const sel = await body.$('.quiz-opt.selected');
      if (!sel) { await (await body.$('.quiz-opt >> nth=1')).click(); return 'quiz-answer'; }
    }
    // single-choice options
    const solved = await body.$('.options .option.correct');
    const opts = await body.$$('.options > button.option:not(.check):not([disabled])');
    if (!solved && opts.length && !(await body.$('a.option'))) {
      await opts[0].click(); return 'option';
    }
    // dialogue / continue buttons
    const btns = await body.$$('.actions button.btn.primary:not([disabled])');
    if (btns.length) { await btns[btns.length - 1].click(); return 'primary'; }
    const plain = await body.$$('.actions button.btn:not([disabled])');
    if (plain.length) { await plain[plain.length - 1].click(); return 'btn'; }
    return 'stuck';
  }

  async function solveAll(label) {
    let stuck = 0;
    for (let i = 0; i < 600; i++) {
      const r = await solveStep();
      if (r === 'nomodal') return;
      if (r === 'stuck') { stuck++; if (stuck > 5) { await page.screenshot({ path: `${SHOTS}/stuck-${label}.png` }); throw new Error(`stuck in ${label}`); } await page.waitForTimeout(200); }
      else stuck = 0;
      await page.waitForTimeout(40);
      if (i === 3) await page.screenshot({ path: `${SHOTS}/${shotN++}-${label}.png` });
    }
    await page.screenshot({ path: `${SHOTS}/limit-${label}.png` });
    throw new Error(`loop limit in ${label}`);
  }

  // Play: repeatedly take the first ready task from the mission log via Go, press E, solve.
  for (let guard = 0; guard < 80; guard++) {
    // close any debrief/briefing by clicking primary
    if (await modalOpen()) {
      const ovs = await page.$$('.overlay'); const title = await ovs[ovs.length - 1].$eval('h2', (e) => e.textContent);
      if (/complete$/.test(title)) await page.screenshot({ path: `${SHOTS}/${shotN++}-debrief.png` });
      if (/Assessment/.test(title)) break;
      await solveAll(`modal-${guard}`);
      continue;
    }
    const hudObj = await page.textContent('#hud-objective');
    if (/final assessment/i.test(hudObj)) break;
    await page.keyboard.press('l');
    await page.waitForSelector('.overlay');
    const go = await page.$('.log-level[open] li.ready button:has-text("Go")');
    if (!go) {
      const brief = await page.$('button:has-text("Open mission briefing")');
      if (brief) { await brief.click(); continue; }
      await page.screenshot({ path: `${SHOTS}/no-go-${guard}.png` });
      throw new Error('no ready task');
    }
    const taskName = await page.$eval('.log-level[open] li.ready .task-title', (e) => e.textContent);
    await go.click();
    await page.waitForTimeout(150);
    await pressNear();
    if (!(await modalOpen())) {
      await page.screenshot({ path: `${SHOTS}/no-interact-${guard}.png` });
      throw new Error(`interaction failed for ${taskName}; prompt=${await page.textContent('#interact-prompt')}`);
    }
    console.log('task:', taskName.split('·')[0].trim());
    await solveAll(taskName.slice(0, 20).replace(/\W+/g, '_'));
  }

  await page.screenshot({ path: `${SHOTS}/80-before-quiz.png` });
  // KPI + map + evidence panels
  for (const k of ['k', 'm', 'i', 'b']) { await page.keyboard.press(k); await page.waitForTimeout(250); await page.screenshot({ path: `${SHOTS}/81-panel-${k}.png` }); await page.keyboard.press('Escape'); }

  // Final assessment
  if (await modalOpen()) await page.keyboard.press('Escape');
  await page.click('#btn-menu'); await page.click('.modal button.option:has-text("Final assessment")');
  await page.waitForSelector('button:has-text("Start the assessment"):not([disabled])');
  await page.click('text=Start the assessment');
  for (let i = 0; i < 25; i++) {
    await page.waitForSelector('.quiz-opts, .review-list');
    if (await page.$('.review-list')) break;
    await page.click('.quiz-opt >> nth=1');
    if (i === 5) await page.screenshot({ path: `${SHOTS}/85-quiz.png` });
    const next = await page.$('button:has-text("Next →")');
    if (next) await next.click(); else { await page.click('button:has-text("Review answers")'); }
  }
  await page.screenshot({ path: `${SHOTS}/86-review.png` });
  const submit = await page.$('button:has-text("Submit final answers")');
  await submit.dblclick(); // double click must not create duplicate results
  await page.waitForSelector('.result-hero');
  await page.screenshot({ path: `${SHOTS}/87-result.png`, fullPage: false });
  const resultText = await page.textContent('.result-hero');
  console.log('RESULT:', resultText.replace(/\s+/g, ' ').slice(0, 160));
  await page.click('.result-hero ~ .actions button');

  // reopen: result must be identical
  await page.click('#btn-menu'); await page.click('.modal button.option:has-text("Final assessment")');
  await page.waitForSelector('.result-hero');
  const again = await page.textContent('.result-hero');
  console.log('same result on revisit:', again === resultText);

  // Mobile viewport check
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m.goto(BASE);
  await m.screenshot({ path: `${SHOTS}/90-mobile-title.png` });

  // Host dashboard
  const host = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  host.on('dialog', (d) => d.accept());
  await host.goto(`${BASE}/host`);
  await host.fill('input[name=pin]', '00000000');
  await host.click('text=Log in');
  await host.waitForSelector('#login-error:not([hidden])');
  await host.fill('input[name=pin]', process.env.TQM_HOST_PIN || '12345678');
  await host.click('text=Log in');
  await host.waitForSelector('#results table');
  await host.screenshot({ path: `${SHOTS}/95-host.png`, fullPage: true });
  const rows = await host.$$eval('#results tbody tr', (r) => r.length);
  console.log('host result rows:', rows);

  console.log('ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})().catch((e) => { console.error('E2E FAILED:', e); process.exit(1); });
