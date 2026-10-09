"use client";
import { useState } from "react";
import { API, Auth, ymd } from "@/lib/api";
import { toast, niceDate, hh, span } from "@/lib/ui";
import { ArmButton, COUNTS, addDays } from "./helpers";

function Closure({ c, bookings, load }) {
  const [busy, setBusy] = useState(false);
  const affected = bookings.filter(b => b.date === c.date && COUNTS.includes(b.status) && (c.room == null || b.roomId === c.room) && (c.hour == null || (b.hour <= c.hour && c.hour < b.end))).length;
  async function reopen() {
    setBusy(true);
    try { await API.adminUnblock({ token: Auth.get().token, row: c.row, date: c.date }); toast("Reopened"); load(); }
    catch (err) { setBusy(false); toast(err.message); }
  }
  return (
    <li className="bitem">
      <div>
        <div className="when">{niceDate(c.date, true)} · {c.hour == null ? "All day" : span(c.hour, c.hour + 1)} · {c.room == null ? "All rooms" : "Room " + c.room}</div>
        <div className="what">{c.reason || "No reason given"}{affected ? <> · <b style={{ color: "var(--low)" }}>{affected} existing booking{affected === 1 ? "" : "s"} still in place</b></> : null}</div>
      </div>
      <ArmButton idleClass="cta-btn small ghost" idleText="Reopen" armedText="Tap again to reopen" disabled={busy} onConfirm={reopen} />
    </li>
  );
}

export default function ClosuresTab({ cfg, data, load }) {
  const [date, setDate] = useState(() => addDays(ymd(new Date()), 1));
  const [hour, setHour] = useState("");
  const [room, setRoom] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const today = ymd(new Date());
  const list = data.closures.filter(c => c.date >= today).sort((x, y) => (x.date + (x.hour ?? -1)).localeCompare(y.date + (y.hour ?? -1)));

  async function submit(e) {
    e.preventDefault(); setErr("");
    const body = { token: Auth.get().token, date, hour, room, reason: reason.trim() };
    if (!body.date) return setErr("Pick a date.");
    setBusy(true);
    try {
      await API.adminBlock(body);
      toast("Closed " + (body.room ? "Room " + body.room : "all rooms") + ", " + niceDate(body.date) + (body.hour === "" ? " (all day)" : ", " + hh(+body.hour)));
      setReason(""); load();
    } catch (x) { setErr(x.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <form id="cForm" className="panel" noValidate onSubmit={submit}>
        <div className="picked">Close a room or the whole lab</div>
        <div className="ad-form">
          <label htmlFor="cDate">Date<input id="cDate" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} /></label>
          <label htmlFor="cHour">Time<select id="cHour" value={hour} onChange={e => setHour(e.target.value)}>
            <option value="">All day</option>
            {cfg.hours.map(h => <option key={h} value={h}>{span(h, h + 1)}</option>)}
          </select></label>
          <label htmlFor="cRoom">Room<select id="cRoom" value={room} onChange={e => setRoom(e.target.value)}>
            <option value="">All rooms</option>
            {cfg.rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select></label>
          <label htmlFor="cReason">Reason <span className="hint">Optional</span><input id="cReason" maxLength={200} placeholder="e.g. Public holiday, maintenance" value={reason} onChange={e => setReason(e.target.value)} /></label>
        </div>
        {err && <p className="err" id="cErr" role="alert">{err}</p>}
        <div><button className="cta-btn" id="cAdd" type="submit" disabled={busy}>Close</button></div>
        <p className="help" style={{ margin: 0 }}>Closed times can&apos;t be booked. Existing bookings stay in place; cancel them from Bookings if needed.</p>
      </form>
      <div className="ad-sec">
        <span className="label">Upcoming closures</span>
        <div id="cList" style={{ marginTop: ".8rem" }}>
          {!list.length ? <p className="help" style={{ padding: "1rem 0" }}>No upcoming closures. Everything is open as normal.</p> : (
            <ul className="blist">
              {list.map(c => <Closure key={(c.row ?? "") + "|" + c.date + "|" + c.hour + "|" + c.room} c={c} bookings={data.bookings} load={load} />)}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
