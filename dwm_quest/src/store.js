// Persistence layer.
//  - CENTRAL mode: claude.ai Artifact database. Identity comes from the viewer's claude.ai sign-in.
//    Access is enforced server-side by the db rules declared at publish (see README "Security model"):
//      participants/<uid>/...  each signed-in participant reads/writes only their own subtree
//      participants (all)      readable only by the artifact owner
//      audit/...               owner only
//  - DEMO mode: this browser's localStorage only. Not for real employee records.
(function () {
  const DWM = window.DWM;
  const L = DWM.logic;
  const listeners = new Set();
  let status = { state: "idle", text: "Not saved yet" };
  const S = { mode: "pending", uid: null, isOwner: false, db: null, user: null, canWrite: null };

  function setStatus(state, text) { status = { state, text }; listeners.forEach((f) => f(status)); }
  const STATUS_TEXT = { saving: "Saving…", saved: "Progress saved", offline: "Offline — changes pending", error: "Unable to save — retry required" };

  const ls = {
    get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
    set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }, // throws if storage is blocked; callers handle it
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const transient = (e) => !e || !e.code || ["unavailable", "resource_exhausted"].includes(e.code) || (typeof navigator !== "undefined" && navigator.onLine === false);

  async function withTimeout(p, ms) { return Promise.race([p, sleep(ms).then(() => null)]); }

  async function init() {
    const c = window.claude;
    if (c && typeof c.use === "function") {
      const [db, user] = await Promise.all([withTimeout(c.use("db"), 10000), withTimeout(c.use("user"), 10000)]);
      const uid = user ? await user.id() : null;
      if (db && uid) {
        S.mode = "central"; S.db = db; S.user = user; S.uid = uid;
        S.isOwner = await user.isOwner();
        try { S.canWrite = await user.can("data.write"); } catch { S.canWrite = null; }
        return S;
      }
      S.reason = !db ? "The results store is not available in this view." : "You are not signed in to claude.ai, so your progress can't be saved centrally.";
    } else {
      S.reason = "This copy is running outside claude.ai, so there is no central results store.";
    }
    S.mode = "demo"; S.uid = "demo-local"; S.isOwner = false;
    return S;
  }

  // ---------------- participant profile ----------------
  const profileRef = () => S.db.doc("participants/" + S.uid);

  async function loadProfile() {
    if (S.mode === "central") {
      let lastErr;
      for (let i = 0; i < 3; i++) {
        try {
          const snap = await profileRef().get();
          return snap.exists ? clone(snap.data()) : null;
        } catch (e) { lastErr = e; if (!transient(e)) break; await sleep(800 * (i + 1) + Math.random() * 400); }
      }
      throw lastErr || new Error("load failed");
    }
    return ls.get("dwmq.demo.profile");
  }

  let pending = null, inflight = false, retryTimer = null, backoff = 2000;
  function saveProfile(profile) {
    pending = clone(profile);
    kick();
  }
  async function kick() {
    if (inflight || !pending) return;
    clearTimeout(retryTimer);
    if (typeof navigator !== "undefined" && navigator.onLine === false && S.mode === "central") { setStatus("offline", STATUS_TEXT.offline); return; }
    inflight = true;
    const body = pending; pending = null;
    setStatus("saving", STATUS_TEXT.saving);
    try {
      if (S.mode === "central") await profileRef().set(body);
      else ls.set("dwmq.demo.profile", body);
      backoff = 2000;
      inflight = false;
      if (pending) return kick();
      setStatus("saved", STATUS_TEXT.saved + (S.mode === "demo" ? " (this browser only)" : ""));
    } catch (e) {
      inflight = false;
      if (!pending) pending = body;
      if (S.mode === "central" && transient(e)) {
        setStatus("offline", STATUS_TEXT.offline);
        retryTimer = setTimeout(kick, backoff);
        backoff = Math.min(backoff * 2, 60000);
      } else {
        S.lastError = e && e.code;
        setStatus("error", STATUS_TEXT.error);
      }
    }
  }
  function retry() { backoff = 2000; kick(); }
  const hasPending = () => !!pending || inflight;
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => kick());
    window.addEventListener("offline", () => { if (pending || inflight) setStatus("offline", STATUS_TEXT.offline); });
  }

  // ---------------- assessment attempts ----------------
  // Attempt ids are created when the attempt starts, so a retried or double-clicked submission writes
  // the same document instead of a second record.
  async function saveAttempt(attempt) {
    if (S.mode === "central") {
      const ref = S.db.doc(`participants/${S.uid}/attempts/${attempt.attemptId}`);
      for (let i = 0; ; i++) {
        try {
          const existing = await ref.get();
          if (existing.exists && existing.data().submittedAt) return { duplicate: true, attempt: clone(existing.data()) };
          await ref.set(attempt);
          return { duplicate: false, attempt };
        } catch (e) {
          if (!transient(e) || i >= 4) throw e;
          setStatus("offline", STATUS_TEXT.offline);
          await sleep(1500 * (i + 1));
        }
      }
    }
    const all = ls.get("dwmq.demo.attempts") || [];
    const dup = all.find((a) => a.attemptId === attempt.attemptId);
    if (dup) return { duplicate: true, attempt: dup };
    all.push(attempt);
    ls.set("dwmq.demo.attempts", all);
    return { duplicate: false, attempt };
  }

  async function listMyAttempts() {
    if (S.mode === "central") {
      const snap = await S.db.collection(`participants/${S.uid}/attempts`).get();
      return snap.docs.map((d) => clone(d.data()));
    }
    return ls.get("dwmq.demo.attempts") || [];
  }

  // ---------------- owner functions (server rules decide; the UI gate is only a convenience) ----------------
  async function listParticipants() {
    if (S.mode !== "central") return null;
    const out = [];
    let last = null;
    for (let page = 0; page < 50; page++) {
      let q = S.db.collection("participants").orderBy("createdAt", "asc").limit(500);
      if (last) q = q.where("createdAt", ">", last);
      let snap;
      for (let i = 0; ; i++) {
        try { snap = await q.get(); break; } catch (e) { if (!transient(e) || i >= 4) throw e; await sleep(1500 * (i + 1)); }
      }
      snap.docs.forEach((d) => out.push({ uid: d.id, ...clone(d.data()) }));
      if (snap.size < 500) break;
      last = snap.docs[snap.docs.length - 1].data().createdAt;
    }
    return out;
  }
  async function listAttemptsFor(uid) {
    if (S.mode !== "central") return [];
    const snap = await S.db.collection(`participants/${uid}/attempts`).get();
    return snap.docs.map((d) => clone(d.data()));
  }
  async function logAudit(action, detail) {
    if (S.mode !== "central") return;
    try { await S.db.collection("audit").doc(L.newId("audit")).set({ action, detail: detail || "", at: new Date().toISOString(), by: S.uid }); }
    catch { /* audit failure does not block the owner, but is not reported as logged */ }
  }

  async function resetDemo() { try { localStorage.removeItem("dwmq.demo.profile"); localStorage.removeItem("dwmq.demo.attempts"); } catch {} }

  DWM.store = { init, S, loadProfile, saveProfile, retry, hasPending, saveAttempt, listMyAttempts, listParticipants, listAttemptsFor, logAudit, resetDemo,
    onStatus(f) { listeners.add(f); f(status); return () => listeners.delete(f); }, get status() { return status; } };
})();
