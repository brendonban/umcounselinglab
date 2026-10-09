"use client";
import { useState } from "react";
import { niceDate } from "@/lib/ui";
import { COUNTS, csv, ended, short } from "./helpers";

function students(cfg, data) {
  const people = {}, types = cfg.purposes.map(p => p.name);
  data.bookings.forEach(b => {
    const k = b.email.toLowerCase();
    const pr = (data.profiles || {})[k] || {};
    const p = people[k] || (people[k] = { email: b.email, name: pr.name || b.name, studentId: pr.studentId || b.studentId, programme: pr.programme || "", by: {}, total: 0, n: 0, noShow: 0, upcoming: 0, last: "" });
    if (b.status === "No-show") p.noShow++;
    if (b.status === "Confirmed" && !ended(b)) p.upcoming++;
    if (COUNTS.includes(b.status) && ended(b)) { const h = b.end - b.hour; p.by[b.purpose] = (p.by[b.purpose] || 0) + h; p.total += h; p.n++; if (b.date > p.last) p.last = b.date; }
  });
  return { types, list: Object.values(people).sort((x, y) => y.total - x.total || x.name.localeCompare(y.name)) };
}

export default function StudentsTab({ cfg, data }) {
  const [sq, setSq] = useState("");
  const { types, list } = students(cfg, data), q = sq.toLowerCase();
  const rows = list.filter(p => !q || [p.name, p.studentId, p.email, p.programme].join(" ").toLowerCase().includes(q));

  const download = () => csv("hours", ["Name", "Matric no.", "Email", "Programme"].concat(types.map(t => t + " (hours)"), ["Total hours", "Sessions", "No-shows", "Last session"]),
    list.map(p => [p.name, p.studentId, p.email, p.programme].concat(types.map(t => p.by[t] || 0), [p.total, p.n, p.noShow, p.last])));

  return (
    <>
      <div className="ad-tools"><input id="sSearch" type="search" placeholder="Search name, matric, email or programme" aria-label="Search students" value={sq} onChange={e => setSq(e.target.value)} /></div>
      <div className="avhead"><span className="help" id="sCount">{rows.length + " student" + (rows.length === 1 ? "" : "s") + " · " + rows.reduce((t, p) => t + p.total, 0) + " hours completed"}</span><button className="cta-btn ghost small" id="sCsv" type="button" onClick={download}>Download CSV</button></div>
      <div className="hscroll" id="sTable">
        {!rows.length ? <p className="ad-empty">No students match.</p> : (
          <table className="htable adtable">
            <thead><tr><th>Student</th>{types.map(t => <th className="num" key={t}>{short(t)}</th>)}<th className="num">Total</th><th className="num">No-shows</th><th>Last session</th></tr></thead>
            <tbody>
              {rows.map(p => (
                <tr key={p.email.toLowerCase()}>
                  <td><b>{p.name}</b><small>{p.studentId}{p.programme ? " · " + p.programme : ""}</small><small>{p.email}{p.upcoming ? " · " + p.upcoming + " upcoming" : ""}</small></td>
                  {types.map(t => <td className="num" key={t}>{p.by[t] || <span className="z">0</span>}</td>)}
                  <td className="num"><b>{p.total}</b></td>
                  <td className="num">{p.noShow ? <span className="ns">{p.noShow}</span> : <span className="z">0</span>}</td>
                  <td>{p.last ? niceDate(p.last, true) : "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="help" style={{ marginTop: "1rem" }}>Completed hours count sessions that have ended and are Confirmed or Attended. No-shows and cancellations aren&apos;t counted.</p>
    </>
  );
}
