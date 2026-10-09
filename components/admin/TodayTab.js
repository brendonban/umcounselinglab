"use client";
import { useState } from "react";
import { API, Auth, ymd, pad } from "@/lib/api";
import { toast, niceDate, hh, span } from "@/lib/ui";
import { ArmButton, COUNTS, addDays, ended, short } from "./helpers";

function closedAt(closures, date, h, roomId) {
  return closures.some(c => c.date === date && (c.hour == null || c.hour === h) && (c.room == null || c.room === roomId));
}

export default function TodayTab({ cfg, data, attention, setStatus, patchBooking }) {
  const [day, setDay] = useState(() => ymd(new Date()));
  const [showAll, setShowAll] = useState(false);
  const [saving, setSaving] = useState(false);

  const today = ymd(new Date()), nowH = new Date().getHours();
  const live = data.bookings.filter(b => COUNTS.includes(b.status));
  const todays = live.filter(b => b.date === today);
  const inUse = new Set(todays.filter(b => b.hour <= nowH && nowH < b.end).map(b => b.roomId)).size;
  const wkStart = addDays(today, -((new Date().getDay() + 6) % 7));
  const weekHours = live.filter(b => b.date >= wkStart && b.date <= addDays(wkStart, 6)).reduce((t, b) => t + (b.end - b.hour), 0);
  const noShows = data.bookings.filter(b => b.status === "No-show" && b.date >= addDays(today, -30)).length;
  const closedToday = data.closures.filter(c => c.date === today).length;
  const stats = [
    [todays.length, "Bookings today"], [inUse + " / " + cfg.rooms.length, "Rooms in use now"], [weekHours, "Hours booked this week"],
    [noShows, "No-shows, last 30 days"], [closedToday, "Closures today"],
  ];

  // day schedule with names
  const hrs = cfg.hours;
  const dayB = live.filter(b => b.date === day);
  function row(r) {
    const cells = [];
    for (let i = 0; i < hrs.length; i++) {
      const x = hrs[i];
      const b = dayB.find(k => k.roomId === r.id && k.hour === x);
      if (b) {
        const n = b.end - b.hour;
        cells.push(
          <td key={x} className={"b " + (b.status === "Attended" ? "att" : "")} colSpan={n} title={`${b.name} · ${b.purpose} · ${span(b.hour, b.end)}`}>
            <span className="cell">{b.name.split(" ")[0]}<small>{short(b.purpose)}</small></span>
          </td>
        );
        i += n - 1; continue;
      }
      if (dayB.some(k => k.roomId === r.id && k.hour < x && x < k.end)) continue;
      const c = closedAt(data.closures, day, x, r.id) ? "c" : (day === today && x < nowH) || day < today ? "p" : "f";
      cells.push(<td key={x} className={c}><span className="sr">{c === "c" ? "Closed" : c === "p" ? "Past" : "Free"}</span></td>);
    }
    return (
      <tr key={r.id}>
        <th scope="row">{r.name}<small>{r.type === "group" ? "Group" : "Individual"}</small></th>
        {cells}
      </tr>
    );
  }

  // needs attention
  const pending = attention.filter(b => ended(b));
  const sorted = attention.slice().sort((x, y) => (x.date + pad(x.hour) < y.date + pad(y.hour) ? 1 : -1));

  async function markAll() {
    setSaving(true);
    const tok = Auth.get().token;
    for (const b of pending) {
      try { await API.adminSetStatus({ token: tok, code: b.code, status: "Attended" }); patchBooking(b.code, { status: "Attended" }); }
      catch (e) { toast(e.message); break; }
    }
    toast("Marked " + pending.length + " sessions attended");
    setSaving(false);
  }

  return (
    <>
      <div className="ad-stats" id="stats">
        {stats.map(([v, l]) => <div className="stat" key={l}><b>{v}</b><span>{l}</span></div>)}
      </div>
      <div className="ad-sec">
        <div className="avhead" style={{ margin: "0 0 .8rem" }}>
          <h2 id="dayLabel">{day === today ? "Today, " + niceDate(day) : niceDate(day, true)}</h2>
          <div className="ad-nav">
            <button className="cta-btn ghost small" id="dayPrev" type="button" aria-label="Previous day" onClick={() => setDay(d => addDays(d, -1))}>‹</button>
            <button className="cta-btn ghost small" id="dayToday" type="button" onClick={() => setDay(ymd(new Date()))}>Today</button>
            <button className="cta-btn ghost small" id="dayNext" type="button" aria-label="Next day" onClick={() => setDay(d => addDays(d, 1))}>›</button>
          </div>
        </div>
        <div className="avscroll">
          <div id="dayGrid">
            <table className="avgrid adgrid">
              <thead><tr><th scope="col">Room</th>{hrs.map(x => <th scope="col" key={x}>{hh(x)}</th>)}</tr></thead>
              <tbody>{cfg.rooms.map(row)}</tbody>
            </table>
          </div>
        </div>
        <div className="legend avlegend"><span style={{ "--sw": "#dbe3f8" }}>Booked</span><span style={{ "--sw": "#d7efe1" }}>Free</span><span style={{ "--sw": "#e6e6e6" }}>Closed</span><span style={{ "--sw": "#f4f4f4" }}>Past</span></div>
      </div>
      <div className="ad-sec">
        <span className="label">Needs attention</span>
        <h2 style={{ marginTop: ".6rem" }}>To check</h2>
        <p className="help">Sessions from the last two weeks with no attendance marked, and upcoming bookings over the time limit.</p>
        <div id="attention">
          {!attention.length ? (
            <p className="help" style={{ padding: "1rem 0" }}>Nothing to check. Every past session has a status, and no upcoming bookings need a look.</p>
          ) : (
            <>
              {pending.length > 1 && (
                <div className="avhead" style={{ margin: "0 0 .6rem" }}>
                  <span className="help">{pending.length} past sessions without attendance</span>
                  <ArmButton
                    key={pending.length}
                    idleClass="cta-btn ghost small"
                    idleText={"Mark all " + pending.length + " attended"}
                    armedText="Tap again to mark all attended"
                    busy={saving} busyText="Saving…"
                    onConfirm={markAll}
                  />
                </div>
              )}
              <ul className="blist">
                {(showAll ? sorted : sorted.slice(0, 5)).map(b => {
                  const done = ended(b);
                  const why = done ? "Session ended. Mark attended or no-show." : "Over the time limit: " + b.justification;
                  return (
                    <li className="bitem" key={b.code}>
                      <div>
                        <div className="when">{niceDate(b.date)} · {span(b.hour, b.end)} · {b.room}</div>
                        <div className="what"><b style={{ color: "var(--ink)", fontWeight: 600 }}>{b.name}</b> ({b.studentId}) · {b.purpose}</div>
                        <div className="what">{why}</div>
                      </div>
                      <div className="ad-acts">
                        {done ? (
                          [["Attended", "cta-btn small"], ["No-show", "cta-btn small ghost"]].map(([st, c]) => (
                            <button key={st} type="button" className={c} onClick={() => setStatus(b.code, st)}>{st}</button>
                          ))
                        ) : (
                          <>
                            <button type="button" className="cta-btn small ghost" onClick={() => { patchBooking(b.code, { justification: "" }); toast("Noted"); }}>Looks fine</button>
                            <ArmButton idleClass="cta-btn small ghost" idleText="Cancel booking" armedText="Tap again to cancel" onConfirm={() => setStatus(b.code, "Cancelled")} />
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {sorted.length > 5 && (
                <button type="button" className="linkbtn" style={{ marginTop: "1rem" }} onClick={() => setShowAll(s => !s)}>
                  {showAll ? "Show fewer" : "Show all " + sorted.length}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
