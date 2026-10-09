"use client";
import { useState } from "react";
import { API, Auth } from "@/lib/api";
import { toast } from "@/lib/ui";
import { Lines, cls } from "./helpers";

const TK_STATUSES = ["Open", "In progress", "Closed"];

function Ticket({ t, setTickets, load }) {
  const [pend, setPend] = useState(null);
  const subj = "Re: [" + t.id + "] " + t.subject;

  async function change(e) {
    const v = e.target.value;
    setPend(v);
    try {
      await API.adminSetTicket({ token: Auth.get().token, row: t.row, id: t.id, status: v });
      setTickets(list => list.map(x => (x.id === t.id ? { ...x, status: v } : x)));
      toast(t.id + " marked " + v.toLowerCase());
    } catch (err) { toast(err.message); load(); }
    finally { setPend(null); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(t.email); toast("Email copied"); } catch (e) { toast(t.email); }
  }

  return (
    <details className={"tk tk-" + cls(t.status)}>
      <summary>
        <div className="tk-main">
          <span className="tk-id">{t.id}</span>
          <b>{t.subject}</b>
          <small>{t.type} · {t.page || "–"} · {t.name || t.email} · {String(t.at).slice(0, 16)}</small>
        </div>
        <select className={"st tks-" + cls(t.status)} data-row={t.row} data-id={t.id} aria-label={"Status for " + t.id} value={pend ?? t.status} onClick={e => e.stopPropagation()} onChange={change}>
          {TK_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </summary>
      <div className="tk-body">
        <p><Lines text={t.message} /></p>
        {t.steps ? <><span className="label">Steps</span><p><Lines text={t.steps} /></p></> : null}
        <dl className="tk-meta">
          <dt>From</dt><dd>{t.name ? t.name + " · " : ""}{t.email}</dd>
          {t.signedIn ? <><dt>Signed in as</dt><dd>{t.signedIn}</dd></> : null}
          {t.ua ? <><dt>Device</dt><dd>{t.ua}</dd></> : null}
        </dl>
        <div className="ad-acts">
          <a className="cta-btn small" href={"mailto:" + t.email + "?subject=" + encodeURIComponent(subj)}>Reply by email</a>
          <button className="cta-btn small ghost" type="button" onClick={copy}>Copy email</button>
        </div>
      </div>
    </details>
  );
}

export default function TicketsTab({ tickets, setTickets, load }) {
  const [tq, setTq] = useState("");
  const [tstatus, setTstatus] = useState("open");
  const cnt = st => tickets.filter(t => t.status === st).length;
  const stats = [["Open", cnt("Open")], ["In progress", cnt("In progress")], ["Closed", cnt("Closed")], ["All tickets", tickets.length]];
  const q = tq.toLowerCase();
  const list = tickets.filter(t => (tstatus === "all" || (tstatus === "open" ? t.status !== "Closed" : t.status === tstatus)) &&
    (!q || [t.id, t.subject, t.message, t.name, t.email, t.type, t.page].join(" ").toLowerCase().includes(q)))
    .sort((x, y) => (x.status === "Closed") - (y.status === "Closed") || String(y.at).localeCompare(String(x.at)));

  return (
    <>
      <div className="ad-stats" id="tkStats">
        {stats.map(([l, v]) => <div className="stat" key={l}><b>{v}</b><span>{l}</span></div>)}
      </div>
      <div className="ad-tools" style={{ marginTop: "1.4rem" }}>
        <input id="tkSearch" type="search" placeholder="Search ticket number, subject, name or email" aria-label="Search tickets" value={tq} onChange={e => setTq(e.target.value)} />
        <select id="tkStatus" aria-label="Status" value={tstatus} onChange={e => setTstatus(e.target.value)}><option value="open">Open &amp; in progress</option><option value="Open">Open</option><option value="In progress">In progress</option><option value="Closed">Closed</option><option value="all">All tickets</option></select>
      </div>
      <div id="tkList" className="tklist">
        {!list.length ? <p className="ad-empty">No tickets here. {tstatus === "open" ? "Everything's been handled." : ""}</p> :
          list.map(t => <Ticket key={t.id} t={t} setTickets={setTickets} load={load} />)}
      </div>
      <p className="help" style={{ marginTop: "1rem" }}>Tickets come from the Support page. Tap a ticket to see the details and reply.</p>
    </>
  );
}
