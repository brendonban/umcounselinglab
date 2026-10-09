"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API, Auth } from "@/lib/api";
import { SITE } from "@/lib/settings";
import { toast } from "@/lib/ui";
import PageHero from "@/components/PageHero";
import DemoNotice from "@/components/DemoNotice";
import Icon from "@/components/Icon";

// Support: open a ticket (saved to Firebase and shown in the admin console), plus developer contact.
const TYPES = ["Bug or error", "Booking problem", "Sign-in problem", "Suggestion", "Other"];
const BUG_TYPES = ["Bug or error", "Booking problem", "Sign-in problem"];
const PAGES = ["Booking", "Home", "My profile", "Rules", "Sign-in", "Feedback survey", "Admin console", "Somewhere else"];
// The page people came from (same-origin referrers only).
const FROM = { "/": "Home", "/book": "Booking", "/profile": "My profile", "/rules": "Rules", "/admin": "Admin console", "/survey": "Feedback survey" };
const BLANK = { type: TYPES[0], page: PAGES[0], subject: "", message: "", steps: "", name: "", email: "", website: "" };

const devEmail = SITE.DEVELOPER_EMAIL || "";
const devName = SITE.DEVELOPER_NAME || "The developer";
const devInitials = (SITE.DEVELOPER_NAME || "D").split(/\s+/).map(w => w[0]).slice(0, 2).join("").toUpperCase();

export default function SupportPage() {
  const [f, setF] = useState(BLANK);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(null); // { id, note } once sent
  const doneRef = useRef(null);
  const emailRef = useRef(null);
  const set = k => e => setF(cur => ({ ...cur, [k]: e.target.value }));
  const bug = BUG_TYPES.includes(f.type);

  // Prefill from sign-in and the page people came from.
  useEffect(() => {
    const pre = {};
    const a = Auth.get();
    if (a && a.email) {
      pre.email = a.email;
      if (a.profile && a.profile.name) pre.name = a.profile.name;
    }
    try {
      if (document.referrer) {
        const u = new URL(document.referrer);
        const path = u.pathname.replace(/\/+$/, "") || "/";
        if (u.origin === location.origin && FROM[path]) pre.page = FROM[path];
      }
    } catch (e) { /* bad referrer: leave the default */ }
    setF(cur => ({ ...cur, ...pre }));
  }, []);

  useEffect(() => {
    if (done && doneRef.current) doneRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [done]);

  async function submit(e) {
    e.preventDefault(); setErr("");
    const body = {
      type: f.type, page: f.page, subject: f.subject.trim(),
      message: f.message.trim(), steps: bug ? f.steps.trim() : "",
      name: f.name.trim(), email: f.email.trim(), website: f.website,
      ua: navigator.userAgent.slice(0, 300), token: (Auth.get() || {}).token || "",
    };
    if (body.subject.length < 3) return setErr("Add a short subject.");
    if (body.message.length < 10) return setErr("Tell us a bit more about what happened.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) return setErr("Enter an email so we can reply to you.");
    setSending(true);
    try {
      const r = await API.ticket(body);
      setDone({ id: r.id, note: r.demo ? "Demo mode: the ticket is saved only in this browser and no email is sent." : "The developer will reply to " + body.email + "." });
    } catch (x) { setErr(x.message || "The ticket didn't send. Try again, or email the developer directly."); }
    finally { setSending(false); }
  }

  function again() {
    setF(cur => ({ ...cur, subject: "", message: "", steps: "" }));
    setDone(null);
  }

  async function copy() {
    try { await navigator.clipboard.writeText(devEmail); toast("Email copied"); }
    catch (e) {
      const r = document.createRange(); r.selectNodeContents(emailRef.current);
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast("Email selected. Copy it from here.");
    }
  }

  return (
    <>
      <PageHero
        crumb="Support"
        title="Support"
        label={<div className="chips"><a className="chip" href="#report">Report a problem</a><a className="chip" href="#developer">Contact the developer</a><Link className="chip" href="/guide">Step-by-step guide</Link><Link className="chip" href="/rules#cancel">FAQ</Link></div>}
      >
        Something not working, or an idea to make booking better? Open a ticket and the developer will get back to you by email.
      </PageHero>
      <main id="main" className="wrap book-main">
        <DemoNotice style={{ marginBottom: "1.6rem" }} />
        <div className="sup-grid">
          <div id="report">
            <span className="label">Open a ticket</span>
            <h2 style={{ margin: ".6rem 0 1.2rem", fontSize: "1.5rem" }}>Report a problem</h2>

            <form id="ticket" className="panel" noValidate onSubmit={submit} hidden={!!done}>
              <div className="grid2">
                <label htmlFor="tType">What&apos;s it about?<select id="tType" value={f.type} onChange={set("type")}>{TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
                <label htmlFor="tPage">Where did it happen?<select id="tPage" value={f.page} onChange={set("page")}>{PAGES.map(t => <option key={t}>{t}</option>)}</select></label>
              </div>
              <label htmlFor="tSubject">Subject<input id="tSubject" maxLength={120} placeholder="e.g. Confirm booking button does nothing" value={f.subject} onChange={set("subject")} /></label>
              <label htmlFor="tMsg">What happened? <span className="hint">What you expected, and what you saw instead. Don&apos;t include client details.</span><textarea id="tMsg" maxLength={3000} value={f.message} onChange={set("message")}></textarea></label>
              <label htmlFor="tSteps" id="stepsWrap" hidden={!bug}>Steps to make it happen again <span className="hint">Optional, but it helps fix bugs faster</span><textarea id="tSteps" maxLength={2000} placeholder={"1. Chose Room 3 at 10:00\n2. Tapped Confirm booking\n3. ..."} value={f.steps} onChange={set("steps")}></textarea></label>
              <div className="grid2">
                <label htmlFor="tName">Your name <span className="hint">Optional</span><input id="tName" autoComplete="name" maxLength={120} value={f.name} onChange={set("name")} /></label>
                <label htmlFor="tEmail">Email for the reply<input id="tEmail" type="email" autoComplete="email" maxLength={160} value={f.email} onChange={set("email")} /></label>
              </div>
              <label className="hp" aria-hidden="true">Website<input id="tWebsite" tabIndex={-1} autoComplete="off" value={f.website} onChange={set("website")} /></label>
              {err && <p className="err" id="tErr" role="alert">{err}</p>}
              <div className="actions-row"><button className="cta-btn" id="tSend" type="submit" disabled={sending}>{sending ? "Sending…" : "Send ticket"}</button><span className="help">Your device and browser type are attached to help with bugs.</span></div>
            </form>

            {done && (
              <div id="tDone" className="success" style={{ marginTop: 0 }} ref={doneRef}>
                <Icon name="check" />
                <span className="label">Ticket opened</span>
                <h2>Thanks, we&apos;ve got it.</h2>
                <div><span className="label">Ticket number</span><div className="code" id="tId">{done.id}</div></div>
                <p id="tDoneNote" style={{ margin: 0 }}>{done.note}</p>
                <div style={{ marginTop: ".6rem" }}><button className="cta-btn ghost" id="tAgain" type="button" onClick={again}>Open another ticket</button></div>
              </div>
            )}
          </div>

          <aside id="developer" className="sup-side">
            <div className="panel devcard">
              <span className="label">Contact the developer</span>
              <div className="devrow"><div className="avatar sm" id="devInitials" aria-hidden="true">{devInitials}</div><div><b id="devName">{devName}</b><small>Designed &amp; built the booking site</small></div></div>
              <div className="devmail"><span id="devEmail" ref={emailRef}>{devEmail}</span><button className="cta-btn ghost small" id="devCopy" type="button" onClick={copy}>Copy</button></div>
              <a className="cta-btn" id="devMail" href={"mailto:" + devEmail + "?subject=" + encodeURIComponent("UM Counseling Lab booking site")}>Email the developer</a>
              <p className="help" style={{ margin: 0 }}>Best for bugs, ideas and anything about how the website works.</p>
            </div>
            <div className="panel">
              <span className="label">Questions about bookings?</span>
              <p className="help" style={{ margin: 0 }}>For rooms, rules or a booking you can&apos;t cancel online, contact the lab&apos;s person in charge: <b style={{ color: "var(--ink)" }}>{SITE.CONTACT || "see the Rules page"}</b>.</p>
              <Link className="link" href="/rules" style={{ justifySelf: "start" }}>Rules &amp; FAQ</Link>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
