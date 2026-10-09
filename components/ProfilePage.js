"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API, Auth, pad } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";
import { toast, niceDate, span } from "@/lib/ui";
import SignInBox from "@/components/SignInBox";
import DemoNotice from "@/components/DemoNotice";

// My profile: details, upcoming bookings (with cancel) and practicum hours for the signed-in person.
const unit = n => (n === 1 ? "hour" : "hours");
const expired = err => /sign in again/i.test((err && err.message) || "");
const EXPIRED_MSG = "Your sign-in has expired. Sign in again.";
const FIELDS = [["p-name", "name"], ["p-sid", "studentId"], ["p-phone", "phone"], ["p-prog", "programme"], ["p-sup", "supervisor"]];
const EMPTY = { name: "", studentId: "", phone: "", programme: "", supervisor: "" };

function initials(name, email) {
  const src = (name || email.split("@")[0]).replace(/[^A-Za-z ]/g, " ").trim().split(/\s+/);
  return ((src[0] || "?")[0] + (src.length > 1 ? src[src.length - 1][0] : "")).toUpperCase();
}

// Fill the details form from a saved profile: only empty fields, unless overwrite.
function fill(cur, p, overwrite) {
  if (!p) return cur;
  const out = { ...cur };
  FIELDS.forEach(([, k]) => { if (overwrite || !out[k]) out[k] = p[k] || ""; });
  return out;
}

// The two-tap cancel button on an upcoming booking.
function CancelButton({ booking, onExpired, onCancelled }) {
  const [state, setState] = useState("idle"); // idle | armed | busy
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function click() {
    if (state === "idle") {
      setState("armed");
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setState(s => (s === "armed" ? "idle" : s)), 4000);
      return;
    }
    if (state !== "armed") return;
    clearTimeout(timer.current);
    setState("busy");
    const a = Auth.get();
    try {
      await API.cancel({ token: a && a.token, code: booking.code });
      toast("Booking cancelled. " + (booking.room || "The room") + " is free for others now.");
      onCancelled();
    } catch (err) {
      setState("idle");
      if (expired(err)) onExpired(); else toast(err.message || "Couldn't cancel. Try again.");
    }
  }

  return (
    <button type="button" className={state === "idle" ? "cta-btn small ghost" : "cta-btn small danger"} disabled={state === "busy"} onClick={click}>
      {state === "idle" ? "Cancel" : state === "armed" ? "Tap again to cancel" : "Cancelling…"}
    </button>
  );
}

export default function ProfilePage() {
  const [auth, ready] = useAuth();
  const token = auth && auth.token;
  const [signInMsg, setSignInMsg] = useState("");

  const [details, setDetails] = useState(EMPTY);
  const [derr, setDerr] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef(null);

  const [upcoming, setUpcoming] = useState(null); // null while loading, else the list
  const [uerr, setUerr] = useState("");
  const [nextCount, setNextCount] = useState(null); // from the last successful load

  const [hours, setHours] = useState(null);
  const [hoursLoading, setHoursLoading] = useState(false);
  const [lerr, setLerr] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => () => clearTimeout(savedTimer.current), []);

  function signedOut(msg) {
    Auth.clear();
    if (msg) setSignInMsg(msg);
    window.scrollTo({ top: 0 });
  }

  async function loadUpcoming() {
    const a = Auth.get(); if (!a) return;
    setUpcoming(null); setUerr("");
    try {
      const r = await API.lookup({ token: a.token });
      if ((Auth.get() || {}).token !== a.token) return; // signed out meanwhile
      setUpcoming(r.bookings.slice().sort((x, y) => (x.date + pad(x.hour) < y.date + pad(y.hour) ? -1 : 1)));
      setNextCount(r.bookings.length);
    } catch (err) {
      setUpcoming([]);
      if (expired(err)) signedOut(EXPIRED_MSG); else setUerr(err.message || "Couldn't load your bookings.");
    }
  }

  // Whenever someone signs in (or a different person does), load everything for them.
  useEffect(() => {
    // Start from a clean slate for each person.
    setDetails(EMPTY); setDerr(""); setSaved(false);
    setUpcoming(null); setUerr(""); setNextCount(null);
    setHours(null); setLerr(""); setHoursLoading(false); setFilter("all");
    if (!token) return;
    let alive = true;
    const a = Auth.get();
    setDetails(fill(EMPTY, a && a.profile));
    setHoursLoading(true);

    (async () => {
      try {
        const m = await API.me({ token });
        if (!alive) return;
        const cur = Auth.get() || a;
        Auth.set({ ...cur, email: m.email, profile: m.profile || cur.profile });
        setDetails(d => fill(d, m.profile, true));
      } catch (err) { if (alive && expired(err)) signedOut(EXPIRED_MSG); }
    })();

    loadUpcoming();

    (async () => {
      try {
        const h = await API.hours({ token });
        if (alive) setHours(h);
      } catch (err) {
        if (!alive) return;
        if (expired(err)) signedOut(EXPIRED_MSG); else setLerr(err.message || "Couldn't load your hours.");
      } finally { if (alive) setHoursLoading(false); }
    })();

    return () => { alive = false; };
  }, [token]);

  async function saveDetails(e) {
    e.preventDefault(); setDerr("");
    const a = Auth.get(); if (!a) return signedOut("Please sign in.");
    const body = { token: a.token };
    FIELDS.forEach(([, k]) => (body[k] = details[k].trim()));
    if (!body.name || !body.studentId) return setDerr("Fill in your name and matric number.");
    setSaving(true);
    try {
      const r = await API.saveProfile(body);
      Auth.set({ ...a, profile: r.profile });
      toast("Profile saved"); setSaved(true);
      clearTimeout(savedTimer.current); savedTimer.current = setTimeout(() => setSaved(false), 3000);
    } catch (err) { if (expired(err)) signedOut(EXPIRED_MSG); else setDerr(err.message || "Couldn't save. Try again."); }
    finally { setSaving(false); }
  }

  function downloadCsv() {
    const d = hours; if (!d) return;
    const a = Auth.get() || {}, p = a.profile || {};
    const q = v => '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
    const lines = [];
    lines.push([q("Name"), q(p.name)].join(","), [q("Matric no."), q(p.studentId)].join(","), [q("Programme"), q(p.programme)].join(","), [q("Email"), q(d.email)].join(","), "");
    lines.push(["Date", "Start", "End", "Hours", "Session type", "Room", "Status", "Booking code"].map(q).join(","));
    d.sessions.forEach(s => lines.push([s.date, pad(s.hour) + ":00", pad(s.end) + ":00", s.hours, s.purpose, s.room, s.status === "Attended" ? "Attended" : "Completed", s.code].map(q).join(",")));
    lines.push("", q("Totals"));
    Object.keys(d.totals).forEach(t => lines.push([q(t), d.totals[t].hours].join(",")));
    lines.push([q("All sessions"), d.total].join(","));
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const el = document.createElement("a");
    el.href = URL.createObjectURL(blob);
    el.download = "counseling-lab-hours-" + (p.studentId || (d.email || "me").split("@")[0]) + ".csv";
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(el.href), 2000);
  }

  const on = ready && !!token;
  const p = (auth && auth.profile) || {};
  const metaBits = [p.studentId && "Matric " + p.studentId, p.programme].filter(Boolean);
  const types = hours ? Object.keys(hours.totals) : [];
  const list = hours ? hours.sessions.filter(s => filter === "all" || s.purpose === filter) : [];

  return (
    <main id="main">
      <div className="page-hero">
        <div className="wrap">
          <span className="crumb"><Link href="/">Home</Link> / My profile</span>
          <div className="rule"></div>
          <h1>My profile</h1>
          <p>Your details, upcoming bookings and practicum hours in one place.</p>
        </div>
      </div>

      <div className="wrap book-main">
        <DemoNotice style={{ marginBottom: "1.6rem" }} />

        {ready && !on && (
          <SignInBox
            error={signInMsg}
            title={<div className="picked">Sign in to see your profile</div>}
            className="panel narrow"
            onSignedIn={() => setSignInMsg("")}
          />
        )}

        {on && (
          <div id="profile">
            <div className="pcard-head">
              <div className="avatar" id="pAvatar" aria-hidden="true">{initials(p.name, auth.email)}</div>
              <div className="pinfo">
                <h2 id="pName">{p.name || "Add your name below"}</h2>
                <p id="pEmail">{auth.email}</p>
                <p id="pMeta" className="help">{metaBits.join(" · ") || "Complete your details so bookings fill in automatically."}</p>
              </div>
              <div className="pstats">
                <span className="chip" id="pNext">{nextCount === null ? "Loading…" : nextCount ? nextCount + " upcoming" : "No upcoming bookings"}</span>
                <span className="chip" id="pTotal">{hours ? hours.total + " " + unit(hours.total) + " logged" : "Loading…"}</span>
                <button className="linkbtn" type="button" onClick={() => API.signOut()}>Sign out</button>
              </div>
            </div>

            <div className="bstep" id="sec-details">
              <span className="label">Your details</span>
              <h2>Profile</h2>
              <p className="help" style={{ marginTop: "-.6rem" }}>Saved details fill in the booking form for you.</p>
              <form id="details" className="panel" noValidate onSubmit={saveDetails}>
                <div className="grid2">
                  <label htmlFor="p-name">Full name<input id="p-name" autoComplete="name" maxLength={120} value={details.name} onChange={e => setDetails({ ...details, name: e.target.value })} /></label>
                  <label htmlFor="p-sid">Matric number<input id="p-sid" maxLength={40} value={details.studentId} onChange={e => setDetails({ ...details, studentId: e.target.value })} /></label>
                  <label htmlFor="p-phone">Phone <span className="hint">Optional</span><input id="p-phone" type="tel" autoComplete="tel" maxLength={40} value={details.phone} onChange={e => setDetails({ ...details, phone: e.target.value })} /></label>
                  <label htmlFor="p-prog">Programme <span className="hint">e.g. Master of Counseling</span><input id="p-prog" maxLength={120} value={details.programme} onChange={e => setDetails({ ...details, programme: e.target.value })} /></label>
                </div>
                <label htmlFor="p-sup">Supervisor <span className="hint">Optional</span><input id="p-sup" maxLength={120} value={details.supervisor} onChange={e => setDetails({ ...details, supervisor: e.target.value })} /></label>
                {derr && <p className="err" id="derr" role="alert">{derr}</p>}
                <div className="actions-row"><button className="cta-btn" id="dSave" type="submit" disabled={saving}>{saving ? "Saving…" : "Save details"}</button>{saved && <span className="help" id="dSaved">Saved.</span>}</div>
              </form>
            </div>

            <div className="bstep" id="sec-bookings">
              <span className="label">Bookings</span>
              <div className="avhead" style={{ margin: 0 }}><h2>Upcoming bookings</h2><Link className="link" href="/book">Book a room</Link></div>
              {uerr && <p className="err" id="uerr" role="alert">{uerr}</p>}
              <div id="upcoming">
                {upcoming === null ? <p className="loading">Loading your bookings…</p>
                  : uerr ? null
                  : !upcoming.length ? <p className="help" style={{ padding: "1rem 0" }}>No upcoming bookings. <Link className="link" href="/book">Book a room</Link></p>
                  : (
                    <ul className="blist">
                      {upcoming.map(b => (
                        <li className="bitem" key={b.code}>
                          <div><div className="when">{niceDate(b.date)} · {span(b.hour, b.end || b.hour + 1)} · {b.room || ""}</div><div className="what">{b.purpose} · Code {b.code}</div></div>
                          <CancelButton booking={b} onCancelled={loadUpcoming} onExpired={() => signedOut(EXPIRED_MSG)} />
                        </li>
                      ))}
                    </ul>
                  )}
              </div>
              <p className="help">Can&apos;t make it? Cancel before the session starts and the room opens up for others straight away.</p>
            </div>

            <div className="bstep" id="sec-hours" style={{ borderBottom: 0 }}>
              <span className="label">Practicum hours</span>
              <h2>Hours by session type</h2>
              {hours && hours.sample && <div className="notice" id="sampleNote"><strong>Demo sample.</strong> You have no completed sessions in this browser yet, so these hours are made up to show how the page looks.</div>}
              <ul className="hsums" id="summary">
                {hoursLoading && <li className="loading">Loading your hours…</li>}
                {hours && <>
                  <li className="hsum total"><span className="label">Total</span><b>{hours.total}</b><span>{unit(hours.total)} · {hours.sessions.length} session{hours.sessions.length === 1 ? "" : "s"}</span></li>
                  {types.map(t => {
                    const x = hours.totals[t];
                    return <li key={t} className={"hsum" + (x.sessions ? "" : " zero")}><span className="label">{t.replace(" session", "")}</span><b>{x.hours}</b><span>{unit(x.hours)} · {x.sessions} session{x.sessions === 1 ? "" : "s"}</span></li>;
                  })}
                </>}
              </ul>
              {lerr && <p className="err" id="lerr" role="alert">{lerr}</p>}
              <div className="avhead" style={{ margin: "1rem 0 0" }}>
                <h3>Session log</h3>
                <div className="hactions">
                  <label htmlFor="hFilter" className="sr">Filter by session type</label>
                  <select id="hFilter" value={filter} onChange={e => setFilter(e.target.value)}>
                    {hours && <option value="all">All session types</option>}
                    {types.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button className="cta-btn ghost small" id="csv" type="button" hidden={!!hours && !hours.sessions.length} onClick={downloadCsv}>Download CSV</button>
                </div>
              </div>
              <div id="rows">
                {hours && (!hours.sessions.length
                  ? <p className="help" style={{ padding: "1.2rem 0" }}>No completed sessions yet. Hours appear here once a booked session has ended.</p>
                  : (
                    <div className="hscroll">
                      <table className="htable">
                        <thead><tr><th>Date</th><th>Time</th><th>Session type</th><th>Room</th><th className="num">Hours</th><th>Status</th></tr></thead>
                        <tbody>
                          {list.map((s, i) => (
                            <tr key={s.code || i}>
                              <td>{niceDate(s.date, true)}</td><td>{span(s.hour, s.end)}</td><td>{s.purpose}</td><td>{s.room}</td><td className="num">{s.hours}</td>
                              <td><span className={"hstat " + (s.status === "Attended" ? "ok" : "")}>{s.status === "Attended" ? "Attended" : "Completed"}</span></td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot><tr><td colSpan={4}>{filter === "all" ? "Total" : filter + " total"}</td><td className="num">{list.reduce((t, s) => t + s.hours, 0)}</td><td></td></tr></tfoot>
                      </table>
                    </div>
                  ))}
              </div>
              <p className="help">Hours count once a booked session has ended. Sessions marked no-show or cancelled aren&apos;t counted. If something&apos;s wrong, ask the person in charge to correct the booking.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
