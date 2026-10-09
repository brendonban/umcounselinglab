"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { API } from "@/lib/api";
import PageHero from "@/components/PageHero";
import DemoNotice from "@/components/DemoNotice";

// Five quick questions about the CURRENT booking method (the shared Google Sheet with one tab per day).
// Edit them here; the Survey tab in the sheet gets one column per question (named by the "id" below).
const Q = [
  { id: "level", type: "one", q: "What's your level of study?", o: ["Undergraduate", "Postgraduate", "Lecturer / supervisor"] },
  { id: "freq", type: "one", q: "How often do you book a counselling room?", o: ["Not yet", "A few times a semester", "About monthly", "Weekly", "Several times a week"] },
  { id: "ease", type: "scale", q: "How easy is booking with the current Google Sheet?", lo: "Very hard", hi: "Very easy" },
  { id: "issues", type: "many", q: "What's frustrating about it?", help: "Pick any.", o: [
    "Finding the right day tab",
    "Seeing which rooms are free",
    "My booking was overwritten or removed",
    "Everyone can see my phone number and email",
    "Cancelling through WhatsApp or the person in charge",
    "No reminder before my session",
    "Hard to use on my phone",
    "Nothing, it works fine",
  ] },
  { id: "other", type: "text", q: "What would make booking easier?", help: "Optional." },
  // Part 2: new feature ideas that can be built on this setup (website + Google Sheet), to see which to build next.
  { id: "want", part: "Part 2 · What you'd want", type: "many", max: 3, q: "Which of these would you most like to have?", help: "Pick up to 3.", o: [
    "Add my booking to my Google or Outlook calendar automatically",
    "Book the same room and time every week for the semester",
    "Get an email when a fully booked time becomes free",
    "Change my booking's time or room without cancelling first",
    "Extend my session by an hour if the room is still free",
    "See photos, size and equipment for each room before booking",
    "Email my practicum hours summary to my supervisor",
  ] },
  { id: "switch", type: "one", q: "Would you use an online booking website instead of the Google Sheet?", o: ["Yes", "Maybe", "No, the sheet is fine"] },
];

const blank = () => Object.fromEntries(Q.map(q => [q.id, q.type === "many" ? [] : ""]));

export default function SurveyPage() {
  const [ans, setAns] = useState(blank);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const pick = (id, v) => setAns(a => ({ ...a, [id]: v }));
  const toggle = (id, v, on) => setAns(a => {
    const q = Q.find(x => x.id === id);
    const cur = a[id].filter(x => x !== v);
    // Keep the ticked answers in the same order as the options.
    return { ...a, [id]: on ? q.o.filter(o => cur.includes(o) || o === v) : cur };
  });

  async function submit(e) {
    e.preventDefault();
    const a = {}, miss = [];
    Q.forEach((q, i) => {
      if (q.type === "many") a[q.id] = ans[q.id].join("; ");
      else if (q.type === "scale") a[q.id] = ans[q.id] ? +ans[q.id] : "";
      else a[q.id] = String(ans[q.id] || "").trim().slice(0, 1500);
      if ((q.type === "one" || q.type === "scale" || q.max) && !a[q.id]) miss.push(i + 1);
    });
    if (miss.length) {
      setErr("Please answer question" + (miss.length > 1 ? "s " : " ") + (miss.length > 1 ? miss.slice(0, -1).join(", ") + " and " + miss[miss.length - 1] : miss[0]) + ".");
      const el = document.getElementById("q-" + Q[miss[0] - 1].id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErr(""); setSending(true);
    try {
      await API.survey({ answers: a });
      setSent(true); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (x) {
      setErr(x.message || "Your feedback didn't send. Check your connection and try again.");
      setSending(false);
    }
  }

  return (
    <>
      <PageHero
        crumb="Feedback"
        title="How's booking a counselling room going?"
        label={<div className="chips"><span className="chip">7 questions</span><span className="chip">About 2 minutes</span><span className="chip">Anonymous</span></div>}
      >
        Part 1 is about booking with the current Google Sheet. Part 2 asks what would help you most. We don&apos;t ask for your name or ID.
      </PageHero>

      <main id="main" className="wrap narrow book-main">
        <DemoNotice style={{ marginBottom: "1.6rem" }} />
        {sent && (
          <div id="thanks" className="success">
            <span className="label">Feedback sent</span>
            <h2>Thanks, that really helps.</h2>
            <p style={{ margin: 0 }}>We&apos;ll use your answers to improve how counselling rooms are booked.</p>
            <div style={{ marginTop: ".6rem" }}><Link className="cta-btn ghost" href="/book">Book a room</Link></div>
          </div>
        )}
        <form id="survey" noValidate onSubmit={submit} hidden={sent}>
          {Q.map((q, i) => {
            const picked = q.type === "many" ? ans[q.id].length : 0;
            const help = q.max ? (picked ? `${picked} of ${q.max} picked` : `Pick up to ${q.max}.`) : q.help;
            return (
              <Fragment key={q.id}>
                {q.part ? <div className="spart"><span className="label">{q.part}</span></div>
                  : i === 0 ? <div className="spart"><span className="label">Part 1 · Booking today</span></div> : null}
                <fieldset id={"q-" + q.id}>
                  <legend><span className="qn">{String(i + 1).padStart(2, "0")}</span><span>{q.q}</span></legend>
                  {q.help && <p className="help">{help}</p>}
                  {(q.type === "one" || q.type === "many") && (
                    <div className="opts">
                      {q.o.map((o, j) => q.type === "one"
                        ? <label className="opt" key={o}><input type="radio" name={q.id} id={q.id + "-" + j} value={o} checked={ans[q.id] === o} onChange={() => pick(q.id, o)} /><span>{o}</span></label>
                        : (
                          <label className="opt" key={o}>
                            <input type="checkbox" name={q.id} id={q.id + "-" + j} value={o} checked={ans[q.id].includes(o)}
                              disabled={!!q.max && !ans[q.id].includes(o) && picked >= q.max}
                              onChange={e => toggle(q.id, o, e.target.checked)} />
                            <span>{o}</span>
                          </label>
                        ))}
                    </div>
                  )}
                  {q.type === "scale" && (
                    <>
                      <div className="scale scale5" role="radiogroup" aria-label={q.q}>
                        {[1, 2, 3, 4, 5].map(v => (
                          <label className="opt" key={v}><input type="radio" name={q.id} id={q.id + "-" + v} value={v} aria-label={v + " out of 5"} checked={ans[q.id] === String(v)} onChange={() => pick(q.id, String(v))} /><span>{v}</span></label>
                        ))}
                      </div>
                      <div className="scalekey"><span>{q.lo}</span><span>{q.hi}</span></div>
                    </>
                  )}
                  {q.type === "text" && (
                    <textarea id={q.id} name={q.id} maxLength={1500} placeholder="Anything you'd change about how rooms are booked" value={ans[q.id]} onChange={e => pick(q.id, e.target.value)}></textarea>
                  )}
                </fieldset>
              </Fragment>
            );
          })}
          {err && <p className="err" id="err" role="alert">{err}</p>}
          <div style={{ paddingTop: "1.6rem" }}><button className="cta-btn" id="submit" type="submit" disabled={sending}>{sending ? "Sending…" : "Send feedback"}</button></div>
        </form>
      </main>
    </>
  );
}
