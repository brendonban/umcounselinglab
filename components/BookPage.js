"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { API, Auth } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { niceDate, span } from "@/lib/ui";
import PageHero from "@/components/PageHero";
import DemoNotice from "@/components/DemoNotice";
import SignInBox from "@/components/SignInBox";
import { DayPicker, SlotPicker, RoomPicker } from "@/components/book/Pickers";
import MyBookings from "@/components/book/MyBookings";
import { purposeOf, roomsOf, roomById, listRooms, makeSchedule, buildDays, facts, expired } from "@/components/book/schedule";

const EMPTY_FORM = { name: "", sid: "", phone: "", people: "2", sup: "", notes: "", student: false, agree: false };
const NO_PICK = "No time selected yet. Pick a start time and room above.";

export default function BookPage() {
  const [auth, ready] = useAuth();
  const [cfg, setCfg] = useState(null);
  const [days, setDays] = useState([]);
  const [avail, setAvail] = useState({ taken: new Set(), blocked: new Set() });
  const [loadErr, setLoadErr] = useState("");

  // Steps 1–3
  const [type, setType] = useState("");
  const [hoursVal, setHoursVal] = useState("1");
  const [just, setJust] = useState("");
  const [sel, setSel] = useState(null);
  const [start, setStart] = useState(null);
  const [room, setRoom] = useState(null);
  const [scrollTick, setScrollTick] = useState(0);

  // Step 4 and the result
  const [form, setForm] = useState(EMPTY_FORM);
  const [err, setErr] = useState("");
  const [signinErr, setSigninErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { when, code }

  // My bookings: null (signed out), "loading", "error" or an array
  const [mine, setMine] = useState(null);
  const [lerr, setLerr] = useState("");

  const pickRef = useRef(null);
  const justRef = useRef(null);
  const mineReq = useRef(0);
  const meDone = useRef(false);

  const token = auth && auth.token ? auth.token : null;

  // ------------------------------------------------------------ data loading
  const signedOut = useCallback(msg => {
    Auth.clear();
    if (msg) setSigninErr(msg);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const a = await API.availability();
      setAvail({ taken: new Set(a.taken || []), blocked: new Set(a.blocked || []) });
      setLoadErr("");
    } catch (e) {
      setLoadErr("Couldn't load the schedule. Check your connection and reload the page.");
    }
  }, []);

  const loadMine = useCallback(async () => {
    const a = Auth.get(); if (!a || !a.token) return;
    const req = ++mineReq.current;
    setLerr(""); setMine("loading");
    try {
      const r = await API.lookup({ token: a.token });
      if (req === mineReq.current) setMine(r.bookings);
    } catch (e) {
      if (req !== mineReq.current) return;
      setMine("error");
      if (expired(e)) signedOut("Your sign-in has expired. Sign in again.");
      else setLerr(e.message || "Couldn't load your bookings. Try again.");
    }
  }, [signedOut]);

  // Settings, days, then availability (refreshed every minute and when the tab comes back).
  useEffect(() => {
    let alive = true;
    API.config().then(c => {
      if (!alive) return;
      const ds = buildDays(c);
      setCfg(c); setType(c.purposes[0].name); setDays(ds); setSel(ds[0]);
    }, () => alive && setLoadErr("Couldn't reach the booking system. Check your connection and reload the page."));
    return () => { alive = false; };
  }, []);

  const haveDays = days.length > 0;
  useEffect(() => {
    if (!haveDays) return;
    refresh();
    const t = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    const vis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [haveDays, refresh]);

  // Signed in: load my bookings. Signed out: clear them.
  useEffect(() => {
    if (!ready) return;
    if (token) { setSigninErr(""); loadMine(); }
    else { mineReq.current++; setMine(null); setLerr(""); }
  }, [ready, token, loadMine]);

  // Once per visit, refresh the stored email and profile from the server.
  useEffect(() => {
    if (!ready || meDone.current) return;
    meDone.current = true;
    const a = Auth.get();
    if (!a || !a.token) return;
    API.me({ token: a.token })
      .then(m => Auth.set({ ...a, email: m.email, profile: m.profile || a.profile }))
      .catch(e => { if (expired(e)) signedOut("Your sign-in has expired. Sign in again to book."); });
  }, [ready, signedOut]);

  // Prefill empty fields from the signed-in profile.
  const profile = auth && auth.token ? auth.profile : null;
  useEffect(() => {
    if (!profile) return;
    setForm(f => ({
      ...f,
      name: f.name || profile.name || "",
      sid: f.sid || profile.studentId || "",
      phone: f.phone || profile.phone || "",
      sup: f.sup || profile.supervisor || "",
    }));
  }, [profile]);

  // Bring the room picker into view after picking a start time.
  useEffect(() => {
    if (scrollTick && pickRef.current) pickRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [scrollTick]);

  // ------------------------------------------------------------ derived
  const n = parseInt(hoursVal, 10) || 1;
  const p = cfg ? purposeOf(cfg, type) : null;
  const rooms = cfg ? roomsOf(cfg, p) : [];
  const sched = cfg ? makeSchedule(cfg, avail, rooms) : null;
  // A start with no room free for the whole span drops out; a taken room falls back to the first free one.
  const curStart = sched && sel && start !== null && sched.freeRooms(sel, start, n).length ? start : null;
  const ok = curStart !== null ? sched.freeRooms(sel, curStart, n).map(r => r.id) : [];
  const curRoom = curStart === null ? null : ok.includes(room) ? room : ok[0] || null;
  const over = p ? n > p.maxHours : false;

  const set = key => e => {
    const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm(f => ({ ...f, [key]: v }));
  };

  // ------------------------------------------------------------ booking
  async function submit(e) {
    e.preventDefault(); setErr("");
    const a = Auth.get();
    if (!a || !a.token) return signedOut("Please sign in to book.");
    if (curStart === null || !curRoom) return setErr("Pick a start time and a room first.");
    const body = {
      token: a.token,
      date: sel, hour: curStart, hours: n, room: curRoom, purpose: p.name,
      name: form.name.trim(), studentId: form.sid.trim(),
      phone: form.phone.trim(),
      people: Math.max(1, Math.min(12, parseInt(form.people, 10) || 1)),
      supervisor: form.sup.trim(), notes: form.notes.trim(),
      justification: over ? just.trim() : "",
      agreeStudent: form.student,
    };
    if (!body.name || !body.studentId) return setErr("Fill in your name and matric number.");
    if (over && body.justification.length < 10) { setErr("Explain why you need " + n + " hours (step 1)."); justRef.current && justRef.current.focus(); return; }
    if (!body.agreeStudent) return setErr("Only counseling students may book the lab, for academic or practicum purposes. Tick the box to confirm.");
    if (!form.agree) return setErr("Tick the room etiquette box to confirm.");
    setBusy(true);
    try {
      const r = await API.book(body);
      setDone({
        when: (r.room || roomById(cfg, body.room).name) + " · " + niceDate(body.date) + ", " + span(body.hour, body.hour + n) + " · " + p.name,
        code: r.code,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      Auth.set({ ...a, profile: { name: body.name, studentId: body.studentId, phone: body.phone } });
      setStart(null); setRoom(null);
      setForm(f => ({ ...f, student: false, agree: false, notes: "" })); setJust("");
      refresh(); loadMine();
    } catch (x) {
      if (expired(x)) signedOut("Your sign-in has expired. Sign in again to book.");
      else setErr(x.message || "The booking didn't go through. Try again.");
      refresh();
    } finally { setBusy(false); }
  }

  // ------------------------------------------------------------ render
  const signedIn = ready && !!token;
  return (
    <>
      <PageHero crumb="Book a room" title="Book a counseling room"
        label={<div className="chips" id="facts">{cfg && facts(cfg).map(t => <span key={t} className="chip">{t}</span>)}</div>}>
        For counseling students&apos; academic and practicum work. Book at least one day ahead, and sign in with your UM Google account to confirm. <Link className="link" href="/guide#students">How to book</Link> · <Link className="link" href="/rules">Rules</Link>
      </PageHero>

      <main id="main" className="wrap narrow book-main">
        <DemoNotice />
        <div id="loadErr" className="notice" hidden={!loadErr}>{loadErr}</div>

        <div id="done" className="success" hidden={!done} aria-live="polite">
          <span className="ic" aria-hidden="true"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
          <span className="label">Booking confirmed</span>
          <h2>You&apos;re booked.</h2>
          <p id="doneWhen" style={{ margin: 0, color: "var(--ink)" }}>{done && done.when}</p>
          <div style={{ marginTop: ".6rem" }}><span className="label">Booking code</span><div className="code" id="doneCode">{done && done.code}</div></div>
          <p id="doneNote" style={{ margin: 0 }}>{done && "No email is sent, so keep this code. You can see or cancel the booking any time under My bookings or My profile."}</p>
          <p style={{ margin: 0 }}>Can&apos;t make it? Cancel under &quot;My bookings&quot; below so someone else can use the room.</p>
          <div style={{ marginTop: ".6rem" }}><button className="cta-btn ghost" id="again" type="button" onClick={() => setDone(null)}>Book another room</button></div>
        </div>

        <div id="flow" hidden={!!done}>
          <div className="bstep" aria-labelledby="h-type">
            <span className="label">Step 1</span>
            <h2 id="h-type">Session type and length</h2>
            <div className="grid2">
              <label htmlFor="f-type">Purpose
                <select id="f-type" value={type} onChange={e => { setType(e.target.value); setRoom(null); }}>
                  {cfg && cfg.purposes.map(x => <option key={x.name} value={x.name}>{x.name} (up to {x.maxHours} h)</option>)}
                </select>
              </label>
              <label htmlFor="f-hours">How long
                <select id="f-hours" value={hoursVal} onChange={e => setHoursVal(e.target.value)}>
                  {cfg && Array.from({ length: cfg.maxHours }, (_, i) => <option key={i} value={i + 1}>{i + 1} hour{i ? "s" : ""}</option>)}
                </select>
              </label>
            </div>
            <p className="help" id="limitNote" style={{ marginTop: "-.4rem" }}>
              {p && p.name + ": up to " + p.maxHours + " hour" + (p.maxHours > 1 ? "s" : "") + ", in " + listRooms(rooms) + ". " +
                (over ? "You've picked " + n + " hours, so explain why below." : "Longer bookings need a justification.")}
            </p>
            <label htmlFor="f-just" id="justWrap" hidden={!over}>Why do you need longer than the limit? <span className="hint">Required for bookings over the limit (rule 4.3). The person in charge will see this.</span>
              <textarea id="f-just" ref={justRef} maxLength={1000} value={just} onChange={e => setJust(e.target.value)} />
            </label>
          </div>

          <div className="bstep" aria-labelledby="h-day">
            <span className="label">Step 2</span>
            <h2 id="h-day">Choose a day</h2>
            {cfg ? (
              <DayPicker days={days} sel={sel}
                freeStarts={date => cfg.hours.filter(h => sched.freeRooms(date, h, n).length).length}
                onPick={date => { setSel(date); setStart(null); setRoom(null); }} />
            ) : (
              <div id="days" className="days" role="group" aria-label="Days"><span className="loading">Loading days…</span></div>
            )}
          </div>

          <div className="bstep" aria-labelledby="h-time">
            <span className="label">Step 3</span>
            <h2 id="h-time">Choose a time and room</h2>
            <p className="help" id="roomNote">{p && (p.roomType === "group" ? "Group sessions use " : "Individual sessions use ") + listRooms(rooms) + "."}</p>
            {cfg ? (
              <SlotPicker hours={cfg.hours} sel={sel} n={n} start={curStart} rooms={rooms} sched={sched}
                onPick={h => { setStart(h); setScrollTick(t => t + 1); }} />
            ) : (
              <div id="slots" className="slots"><span className="loading">Loading availability…</span></div>
            )}
            <div className="legend">
              <span style={{ "--sw": "#bfe3cf" }}>Rooms free</span>
              <span style={{ "--sw": "#f3d29a" }}>Only 1–2 rooms left</span>
              <span style={{ "--sw": "#223e99" }}>Your selection</span>
              <span style={{ "--sw": "#ececec" }}>Fully booked or closed</span>
            </div>
            <RoomPicker pickRef={pickRef} sel={sel} start={curStart} n={n} rooms={rooms} ok={ok} room={curRoom} onPick={setRoom} />
          </div>

          <div className="bstep" aria-labelledby="h-form">
            <span className="label">Step 4</span>
            <h2 id="h-form">Your details</h2>

            {ready && !signedIn && (
              <SignInBox className="panel" onSignedIn={() => setSigninErr("")}
                error={signinErr}
                title={<div className="picked">Sign in to book</div>} />
            )}

            <form id="form" className="panel" noValidate hidden={!signedIn} onSubmit={submit}>
              <div className="whoami">Signed in as <strong id="who">{signedIn ? auth.email : ""}</strong> · <button className="linkbtn" type="button" onClick={() => API.signOut()}>Sign out</button></div>
              <div className="picked" id="picked">
                {curStart !== null && curRoom ? roomById(cfg, curRoom).name + " · " + niceDate(sel) + ", " + span(curStart, curStart + n) + " · " + p.name : NO_PICK}
              </div>
              <div className="grid2">
                <label htmlFor="f-name">Full name<input id="f-name" autoComplete="name" required maxLength={120} value={form.name} onChange={set("name")} /></label>
                <label htmlFor="f-sid">Matric number<input id="f-sid" required maxLength={40} value={form.sid} onChange={set("sid")} /></label>
                <label htmlFor="f-phone">Phone <span className="hint">Optional</span><input id="f-phone" type="tel" autoComplete="tel" maxLength={40} value={form.phone} onChange={set("phone")} /></label>
                <label htmlFor="f-people">People attending<input id="f-people" type="number" min="1" max="12" value={form.people} onChange={set("people")} /></label>
              </div>
              <label htmlFor="f-sup">Supervisor <span className="hint">Practicum sessions may need approval or presence</span><input id="f-sup" maxLength={120} value={form.sup} onChange={set("sup")} /></label>
              <label htmlFor="f-notes">Notes for the person in charge <span className="hint">Optional. Don&apos;t include client details.</span><textarea id="f-notes" maxLength={1000} value={form.notes} onChange={set("notes")} /></label>
              <label className="check" htmlFor="f-student"><input id="f-student" type="checkbox" checked={form.student} onChange={set("student")} /> I&apos;m a counseling student and this booking is for an academic or practicum purpose.</label>
              <label className="check" htmlFor="f-agree"><input id="f-agree" type="checkbox" checked={form.agree} onChange={set("agree")} /> I&apos;ll keep the room clean, bring no food or drinks except candy and mineral water, and leave promptly when my slot ends.</label>
              <p className="err" id="err" role="alert" hidden={!err}>{err}</p>
              <div><button className="cta-btn" id="submit" type="submit" disabled={busy || curStart === null || !curRoom}>{busy ? "Booking…" : "Confirm booking"}</button></div>
            </form>
          </div>
        </div>

        <MyBookings token={token} mine={mine} error={lerr}
          onCancelled={() => { refresh(); loadMine(); }}
          onExpired={signedOut} />
      </main>
    </>
  );
}
