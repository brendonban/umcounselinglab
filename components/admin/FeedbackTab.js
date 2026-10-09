"use client";
import { useState } from "react";
import { ymd } from "@/lib/api";
import { addDays, csv } from "./helpers";

const FB = {
  level: ["Undergraduate", "Postgraduate", "Lecturer / supervisor"],
  freq: ["Not yet", "A few times a semester", "About monthly", "Weekly", "Several times a week"],
  switch: ["Yes", "Maybe", "No, the sheet is fine"],
};

function fbRows(survey, frange) {
  const since = frange === "30" ? addDays(ymd(new Date()), -30) : frange === "7" ? addDays(ymd(new Date()), -7) : "";
  return survey.filter(r => (r.level || r.ease || r.issues) && (!since || String(r["Submitted at"]).slice(0, 10) >= since));
}

function Bars({ items, total, tone }) {
  const max = Math.max(1, ...items.map(i => i[1]));
  return (
    <div className="fbars">
      {items.map(([label, v]) => (
        <div className="fbar" key={label}>
          <div className="fl"><span>{label}</span><span>{v} · {total ? Math.round(v / total * 100) : 0}%</span></div>
          <div className="ft"><div className={"ff" + (tone ? " " + tone : "")} style={{ width: (v / max * 100).toFixed(1) + "%" }}></div></div>
        </div>
      ))}
    </div>
  );
}

export default function FeedbackTab({ survey }) {
  const [frange, setFrange] = useState("all");
  const [fbAll, setFbAll] = useState(false);
  const rows = fbRows(survey, frange), n = rows.length;
  const eases = rows.map(r => +r.ease).filter(x => x >= 1 && x <= 5);
  const avg = eases.length ? eases.reduce((t, x) => t + x, 0) / eases.length : 0;
  const easy = eases.filter(x => x >= 4).length, hard = eases.filter(x => x <= 2).length;
  const switchers = rows.filter(r => r.switch), yes = switchers.filter(r => r.switch === "Yes").length;
  const stats = [[n, "Responses"], [avg ? avg.toFixed(1) + " / 5" : "–", "Average ease"], [eases.length ? Math.round(hard / eases.length * 100) + "%" : "–", "Find it hard (1–2)"], [eases.length ? Math.round(easy / eases.length * 100) + "%" : "–", "Find it easy (4–5)"], [switchers.length ? Math.round(yes / switchers.length * 100) + "%" : "–", "Would use a booking website"]];

  const download = () => csv("feedback", ["Submitted at", "Level of study", "How often", "Ease (1–5)", "Frustrations", "Comment", "Wanted features", "Would use a website"], rows.map(r => [r["Submitted at"], r.level, r.freq, r.ease, r.issues, r.other, r.want, r["switch"]]));

  let body;
  if (!n) {
    body = <p className="ad-empty">No survey responses yet. Share the feedback page (Give feedback in the footer) to collect some.</p>;
  } else {
    const count = (key, order) => order.map(o => [o, rows.filter(r => r[key] === o).length]);
    const tally = key => { const c = {}; rows.forEach(r => String(r[key] || "").split(";").map(x => x.trim()).filter(Boolean).forEach(x => (c[x] = (c[x] || 0) + 1))); return Object.entries(c).sort((x, y) => y[1] - x[1]); };
    const issues = tally("issues"), wants = tally("want");
    const easeDist = [1, 2, 3, 4, 5].map(v => [v + (v === 1 ? " (very hard)" : v === 5 ? " (very easy)" : ""), eases.filter(x => x === v).length]);
    const comments = rows.filter(r => String(r.other || "").trim()).sort((x, y) => String(y["Submitted at"]).localeCompare(String(x["Submitted at"])));
    body = (
      <div className="fbgrid">
        <div className="panel fbwide"><span className="label">Biggest frustrations with the current Google Sheet</span><Bars items={issues} total={n} tone="low" /></div>
        <div className="panel fbwide"><span className="label">Most wanted new features (each person picks up to 3)</span>{wants.length ? <Bars items={wants} total={rows.filter(r => r.want).length} tone="ok" /> : <p className="help">No answers to this question yet.</p>}</div>
        <div className="panel"><span className="label">How easy is booking now?</span><Bars items={easeDist} total={eases.length} /></div>
        <div className="panel"><span className="label">Level of study</span><Bars items={count("level", FB.level)} total={n} /></div>
        <div className="panel"><span className="label">How often they book</span><Bars items={count("freq", FB.freq)} total={n} /></div>
        <div className="panel"><span className="label">Would use a booking website</span><Bars items={count("switch", FB.switch)} total={switchers.length} /></div>
        <div className="panel fbwide"><span className="label">What would make booking easier ({comments.length})</span>
          {comments.length ? (
            <>
              <ul className="fbcomments">
                {(fbAll ? comments : comments.slice(0, 6)).map((r, i) => (
                  <li key={i}><p>{r.other}</p><small>{r.level || ""}{r.ease ? " · rated ease " + r.ease + "/5" : ""} · {String(r["Submitted at"]).slice(0, 10)}</small></li>
                ))}
              </ul>
              {comments.length > 6 && <button className="linkbtn" type="button" id="fbMore" style={{ justifySelf: "start" }} onClick={() => setFbAll(s => !s)}>{fbAll ? "Show fewer" : "Show all " + comments.length}</button>}
            </>
          ) : <p className="help">No written comments yet.</p>}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="avhead" style={{ margin: "0 0 1rem" }}><span className="help">Answers from the feedback survey about booking with the old Google Sheet.</span>
        <div className="hactions"><select id="fbRange" aria-label="Period" value={frange} onChange={e => setFrange(e.target.value)}><option value="all">All time</option><option value="30">Last 30 days</option><option value="7">Last 7 days</option></select><button className="cta-btn ghost small" id="fbCsv" type="button" onClick={download}>Download CSV</button></div></div>
      <div className="ad-stats" id="fbStats">
        {stats.map(([v, l]) => <div className="stat" key={l}><b>{v}</b><span>{l}</span></div>)}
      </div>
      <div id="fbBody" style={{ marginTop: "1.4rem" }}>{body}</div>
    </>
  );
}
