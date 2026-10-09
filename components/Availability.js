"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { API, ymd, pad } from "@/lib/api";
import { DOW, MON, hh } from "@/lib/ui";

// Live room availability: a chip per room for right now, plus a day timeline.
// Uses the public availability data, which only says which hours are taken, never who booked them.
const typeLabel = t => (t === "group" ? "Group" : "Individual");

function next7Days() {
  const out = [], d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) { out.push(ymd(d)); d.setDate(d.getDate() + 1); }
  return out;
}

export default function Availability() {
  const [cfg, setCfg] = useState(null);
  const [data, setData] = useState({ taken: new Set(), blocked: new Set() });
  const [err, setErr] = useState(false);
  const [loaded, setLoaded] = useState(false); // true once the server has answered at least once
  const [days, setDays] = useState([]);
  const [day, setDay] = useState(null);
  const [now, setNow] = useState(null); // the time the chips were last worked out

  useEffect(() => {
    let alive = true, timer;
    async function refresh() {
      try {
        const a = await API.availability();
        if (!alive) return;
        setData({ taken: new Set(a.taken || []), blocked: new Set(a.blocked || []) });
        setErr(false); setLoaded(true); setNow(new Date());
      } catch (e) { if (alive) setErr(true); }
    }
    const onVis = () => { if (!document.hidden) refresh(); };
    (async () => {
      let c;
      try { c = await API.config(); } catch (e) { if (alive) setErr(true); return; }
      if (!alive) return;
      const ds = next7Days();
      setCfg(c); setDays(ds); setDay(ds[0]); setNow(new Date());
      await refresh();
      if (!alive) return;
      timer = setInterval(() => { if (!document.hidden) refresh(); }, 60000);
      document.addEventListener("visibilitychange", onVis);
    })();
    return () => { alive = false; clearInterval(timer); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  const { taken, blocked } = data;
  const isBlocked = (date, h, room) => {
    const k = pad(h);
    return blocked.has(date + "_" + k + "_" + room) || blocked.has(date + "_" + k + "_all") || blocked.has(date + "_all_" + room) || blocked.has(date + "_all_all");
  };
  const isTaken = (date, h, room) => taken.has(date + "_" + pad(h) + "_" + room);
  const busy = (date, h, room) => isTaken(date, h, room) || isBlocked(date, h, room);
  const openOn = date => { const [y, m, d] = date.split("-").map(Number); return cfg.openDays.includes(new Date(y, m - 1, d).getDay()); };

  function statusNow(room) {
    const today = ymd(now), h = now.getHours(), hrs = cfg.hours;
    const first = Math.min(...hrs), last = Math.max(...hrs) + 1;
    if (!openOn(today) || h >= last) return { cls: "closed", text: "Closed now", sub: "Opens " + hh(first) + (openOn(today) && h < first ? " today" : "") };
    if (h < first) return { cls: "closed", text: "Opens at " + hh(first), sub: busy(today, first, room.id) ? "Booked at opening" : "Free at opening" };
    if (busy(today, h, room.id)) {
      let n = h + 1; while (n < last && busy(today, n, room.id)) n++;
      return n < last ? { cls: "busy", text: isBlocked(today, h, room.id) ? "Closed" : "In use", sub: "Free from " + hh(n) } : { cls: "busy", text: "In use", sub: "Booked until closing" };
    }
    let n = h + 1; while (n < last && !busy(today, n, room.id)) n++;
    return { cls: "free", text: "Free now", sub: n < last ? "Until " + hh(n) : "Until closing (" + hh(last) + ")" };
  }

  // One compact chip per room: "Room 3 · Free until 15:00".
  // Until the server answers, show nothing rather than guessing that rooms are free.
  let chips = null, summary = err && !loaded ? "Room status unavailable" : "Loading room status…";
  if (cfg && now && loaded) {
    let free = 0;
    const rooms = cfg.rooms.slice().sort((a, b) => (a.type === b.type ? +a.id - +b.id : a.type === "individual" ? -1 : 1));
    chips = rooms.map(r => {
      const s = statusNow(r); if (s.cls === "free") free++;
      const sub = s.sub.replace(/^Until closing \((.*)\)$/, "until $1").replace(/^Until /, "until ").replace(/^Free from /, "until ").replace(/^Opens /, "opens ");
      const label = s.cls === "free" ? "Free " + sub : s.cls === "busy" ? "Busy " + sub : s.text;
      return (
        <li key={r.id} className={"avchip " + s.cls} title={r.name + " (" + typeLabel(r.type).toLowerCase() + "): " + s.text + ", " + s.sub}>
          <b>{r.name.replace("Room ", "")}</b><span><i>{r.type === "group" ? "Group" : "Indiv."}</i>{label}</span>
        </li>
      );
    });
    summary = <><b>{free} of {cfg.rooms.length}</b> rooms free now · {pad(now.getHours())}:{pad(now.getMinutes())}</>;
  }

  function grid() {
    if (!cfg || !day || !now || !loaded) return null;
    const hrs = cfg.hours, date = day, today = ymd(new Date()), nowH = new Date().getHours();
    return (
      <table className="avgrid">
        <thead><tr><th scope="col">Room</th>{hrs.map(x => <th scope="col" key={x}>{pad(x)}:00</th>)}</tr></thead>
        <tbody>
          {cfg.rooms.map(r => (
            <tr key={r.id}>
              <th scope="row">{r.name}<small>{typeLabel(r.type)}</small></th>
              {hrs.map(x => {
                let cls = "f", t = "Free";
                if (!openOn(date)) { cls = "c"; t = "Closed"; }
                else if (isBlocked(date, x, r.id)) { cls = "c"; t = "Closed"; }
                else if (isTaken(date, x, r.id)) { cls = "b"; t = "Booked"; }
                else if (date === today && x < nowH) { cls = "p"; t = "Past"; }
                return <td key={x} className={cls} title={`${r.name}, ${hh(x)}–${hh(x + 1)}: ${t}`}><span className="sr">{t}</span></td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <section id="availability" className="avsec">
      <div className="wrap">
        <div className="avtop2">
          <div><span className="label">Live status</span><h2>Room availability</h2></div>
          <div className="avside"><span className="avsum" id="avSummary">{summary}</span><Link className="link" href="/book">Book a free slot</Link></div>
        </div>
        <div className="notice" id="avErr" hidden={!err}>Couldn&apos;t load room availability. Check your connection and reload the page.</div>
        <ul className="avchips" id="avNow" aria-live="polite">{chips}</ul>
        <details className="avmore">
          <summary>See the full timeline for today and the next 6 days</summary>
          <div className="avtabs" id="avDays" role="group" aria-label="Day">
            {days.map((d, i) => {
              const [y, m, dd] = d.split("-").map(Number); const dt = new Date(y, m - 1, dd);
              return (
                <button key={d} type="button" className="avtab" aria-pressed={d === day} onClick={() => setDay(d)}>
                  {i === 0 ? "Today" : i === 1 ? "Tomorrow" : DOW[dt.getDay()] + " " + dd + " " + MON[m - 1]}
                </button>
              );
            })}
          </div>
          <div className="avscroll"><div id="avGrid">{grid()}</div></div>
          <div className="legend avlegend">
            <span style={{ "--sw": "#d7efe1" }}>Free</span>
            <span style={{ "--sw": "#c9c9c9" }}>Booked</span>
            <span style={{ "--sw": "#e6e6e6" }}>Closed</span>
            <span style={{ "--sw": "#f4f4f4" }}>Past</span>
          </div>
        </details>
      </div>
    </section>
  );
}
