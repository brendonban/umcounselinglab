"use client";
import { useState } from "react";
import { ymd, pad } from "@/lib/api";
import { niceDate, hh, span } from "@/lib/ui";
import { COUNTS, STATUSES, addDays, cls, csv, ended } from "./helpers";

function filterBookings(bookings, { q, range, status, room }) {
  const today = ymd(new Date()), ql = q.toLowerCase();
  return bookings.filter(b => {
    if (range === "upcoming" && (b.date < today || ended(b))) return false;
    if (range === "today" && b.date !== today) return false;
    if (range === "past7" && !(ended(b) && b.date >= addDays(today, -7))) return false;
    if (range === "past30" && !(ended(b) && b.date >= addDays(today, -30))) return false;
    if (status !== "all" && b.status !== status) return false;
    if (room !== "all" && b.roomId !== room) return false;
    if (ql && ![b.name, b.studentId, b.email, b.code, b.purpose, b.supervisor].join(" ").toLowerCase().includes(ql)) return false;
    return true;
  }).sort((x, y) => {
    const k = (x.date + pad(x.hour)).localeCompare(y.date + pad(y.hour));
    return range.startsWith("past") ? -k : k;
  });
}

// The status menu shows the new choice while it saves, and goes back to the stored status if saving fails.
function StatusSelect({ b, setStatus }) {
  const [pend, setPend] = useState(null);
  async function change(e) {
    const v = e.target.value;
    setPend(v);
    await setStatus(b.code, v);
    setPend(null);
  }
  return (
    <select className={"st st-" + cls(b.status)} aria-label={`Status for ${b.name}, ${niceDate(b.date)}`} value={pend ?? b.status} onChange={change}>
      {STATUSES.map(s => <option key={s}>{s}</option>)}
    </select>
  );
}

export default function BookingsTab({ cfg, data, setStatus }) {
  const [q, setQ] = useState("");
  const [range, setRange] = useState("upcoming");
  const [status, setStatusF] = useState("all");
  const [room, setRoom] = useState("all");
  const rows = filterBookings(data.bookings, { q, range, status, room });
  const hours = rows.filter(b => COUNTS.includes(b.status)).reduce((t, b) => t + b.end - b.hour, 0);

  const download = () => csv("bookings", ["Date", "Start", "End", "Room", "Name", "Matric no.", "Email", "Session type", "People", "Supervisor", "Status", "Booking code", "Justification", "Notes"],
    rows.map(b => [b.date, hh(b.hour), hh(b.end), b.room, b.name, b.studentId, b.email, b.purpose, b.people, b.supervisor, b.status, b.code, b.justification, b.notes]));

  return (
    <>
      <div className="ad-tools">
        <input id="bSearch" type="search" placeholder="Search name, matric, email or code" aria-label="Search bookings" value={q} onChange={e => setQ(e.target.value)} />
        <select id="bRange" aria-label="Date range" value={range} onChange={e => setRange(e.target.value)}><option value="upcoming">Upcoming</option><option value="today">Today</option><option value="past7">Past 7 days</option><option value="past30">Past 30 days</option><option value="all">All dates</option></select>
        <select id="bStatus" aria-label="Status" value={status} onChange={e => setStatusF(e.target.value)}><option value="all">Any status</option><option>Confirmed</option><option>Attended</option><option>No-show</option><option>Cancelled</option></select>
        <select id="bRoom" aria-label="Room" value={room} onChange={e => setRoom(e.target.value)}>
          <option value="all">All rooms</option>
          {cfg.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div className="avhead"><span className="help" id="bCount">{rows.length + " booking" + (rows.length === 1 ? "" : "s") + " · " + hours + " hours"}</span><button className="cta-btn ghost small" id="bCsv" type="button" onClick={download}>Download CSV</button></div>
      <div className="hscroll" id="bTable">
        {!rows.length ? <p className="ad-empty">No bookings match these filters.</p> : (
          <table className="htable adtable">
            <thead><tr><th>When</th><th>Room</th><th>Student</th><th>Session</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(b => (
                <tr key={b.code} data-code={b.code}>
                  <td><b>{niceDate(b.date)}</b><small>{span(b.hour, b.end)}</small></td>
                  <td>{b.room}</td>
                  <td><b>{b.name}</b><small>{b.studentId} · {b.email}</small></td>
                  <td>
                    {b.purpose}
                    <small>{b.people} {b.people === 1 ? "person" : "people"}{b.supervisor ? " · Sup: " + b.supervisor : ""} · Code {b.code}</small>
                    {b.justification ? <small className="flag">Over limit: {b.justification}</small> : null}
                    {b.notes ? <small>Note: {b.notes}</small> : null}
                  </td>
                  <td><StatusSelect b={b} setStatus={setStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="help" style={{ marginTop: "1rem" }}>Change a status with the menu in each row. Cancelling frees the room straight away (no email is sent, so let the student know). Marking Attended or No-show decides whether the session counts towards their hours.</p>
    </>
  );
}
