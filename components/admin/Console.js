"use client";
/* Admin console: Today, Bookings, Closures, Students & hours. Only emails listed in Firestore › admins get data. */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { API, Auth, ymd, pad } from "@/lib/api";
import { SETTINGS } from "@/lib/settings";
import { useAuth } from "@/lib/useAuth";
import { toast } from "@/lib/ui";
import DemoNotice from "@/components/DemoNotice";
import SignInBox from "@/components/SignInBox";
import { COUNTS, expired, needsAttention } from "./helpers";
import TodayTab from "./TodayTab";
import BookingsTab from "./BookingsTab";
import ClosuresTab from "./ClosuresTab";
import StudentsTab from "./StudentsTab";
import TicketsTab from "./TicketsTab";
import FeedbackTab from "./FeedbackTab";

const TABS = ["today", "bookings", "closures", "students", "tickets", "feedback"];

export default function Console() {
  const [auth, ready] = useAuth();
  const token = auth && auth.token;
  const cfg = SETTINGS;
  const [data, setData] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [survey, setSurvey] = useState([]);
  const [notAdmin, setNotAdmin] = useState("");
  const [loading, setLoading] = useState(false);
  const [updated, setUpdated] = useState("");
  const [tab, setTab] = useState("today");
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const signedOut = useCallback(msg => {
    Auth.clear();
    if (msg) toast(msg);
  }, []);

  const load = useCallback(async () => {
    const a = Auth.get(); if (!a || !a.token) return;
    setLoading(true);
    try {
      const d = await API.adminData({ token: a.token });
      const [tk, sv] = await Promise.all([
        API.adminTickets({ token: a.token }).catch(() => ({ tickets: [] })),
        API.adminSurvey({ token: a.token }).catch(() => ({ responses: [] })),
      ]);
      if (tokenRef.current !== a.token) return; // signed out or switched account meanwhile
      setData(d); setTickets(tk.tickets || []); setSurvey(sv.responses || []);
      setNotAdmin("");
      const now = new Date(); setUpdated("Updated " + pad(now.getHours()) + ":" + pad(now.getMinutes()));
    } catch (err) {
      if (expired(err)) return signedOut("Your sign-in has expired. Sign in again.");
      if (/isn't a lab admin/i.test(err.message || "")) { setData(null); setNotAdmin(err.message); return; }
      toast(err.message || "Couldn't load the console.");
    } finally { setLoading(false); }
  }, [signedOut]);

  // Load when someone signs in; forget everything when they sign out.
  useEffect(() => {
    setData(null); setNotAdmin(""); setTickets([]); setSurvey([]); setUpdated("");
    if (token) load();
  }, [token, load]);

  // Refresh every 2 minutes while the console is on screen.
  const showing = !!data;
  useEffect(() => {
    if (!showing) return;
    const id = setInterval(() => { if (!document.hidden && Auth.get()) load(); }, 120000);
    return () => clearInterval(id);
  }, [showing, load]);

  const patchBooking = useCallback((code, patch) => {
    setData(d => d && { ...d, bookings: d.bookings.map(b => (b.code === code ? { ...b, ...patch } : b)) });
  }, []);

  // Returns true when saved; on failure the caller's select falls back to the stored status.
  const setStatus = useCallback(async (code, status) => {
    try {
      await API.adminSetStatus({ token: Auth.get().token, code, status });
      patchBooking(code, { status });
      toast("Marked " + status.toLowerCase());
      return true;
    } catch (err) {
      if (expired(err)) signedOut("Your sign-in has expired."); else toast(err.message);
      return false;
    }
  }, [patchBooking, signedOut]);

  const signOut = async () => { await API.signOut(); };

  let pills = null;
  if (data) {
    const today = ymd(new Date());
    const open = tickets.filter(t => t.status === "Open").length;
    const todayCount = data.bookings.filter(b => COUNTS.includes(b.status) && b.date === today).length;
    const attention = needsAttention(data.bookings);
    pills = { open, todayCount, attention };
  }

  return (
    <main id="main" className="wrap admin">
      <DemoNotice style={{ marginBottom: "1.6rem" }} />

      {ready && !token && (
        <SignInBox
          title={<><span className="label">Staff only</span><div className="picked" style={{ fontSize: "1.3rem" }}>Admin console sign-in</div></>}
          help="Sign in with the Google account your admin access was set up for."
          placeholder="you@um.edu.my"
          className="panel narrow"
          style={{ margin: "2rem auto" }}
        />
      )}

      {token && notAdmin && !data && (
        <div id="notAdmin" className="panel narrow" style={{ margin: "2rem auto" }}>
          <span className="label">No access</span>
          <div className="picked" style={{ fontSize: "1.2rem" }}>This account can&apos;t open the admin console</div>
          <p className="help" id="notAdminMsg">{notAdmin}</p>
          <div><button className="linkbtn" type="button" onClick={signOut}>Sign in with a different account</button></div>
        </div>
      )}

      {token && data && (
        <div id="console">
          <div className="ad-bar">
            <div><span className="label">Counseling Lab</span><h1>Admin console</h1></div>
            <div className="ad-user">
              <Link className="link" href="/guide#staff">Console guide</Link>
              <span id="updated">{updated}</span>
              <button className="cta-btn ghost small" id="refresh" type="button" disabled={loading} onClick={load}>Refresh</button>
              <span><strong id="who">{auth.email}</strong> · <button className="linkbtn" type="button" onClick={signOut}>Sign out</button></span>
            </div>
          </div>
          <div className="notice" id="sampleNote" hidden={!data.sample} style={{ marginBottom: "1.2rem" }}><strong>Demo sample.</strong> These bookings and names are made up so you can try the console. Changes are saved only in this browser.</div>

          <div className="ad-tabs" role="tablist">
            {TABS.map(k => (
              <button key={k} className="ad-tab" role="tab" data-tab={k} type="button" aria-selected={tab === k} onClick={() => setTab(k)}>
                {k === "today" && <>Today <span className="pill soft" id="pillToday">{pills.todayCount}</span></>}
                {k === "bookings" && <>Bookings <span className="pill" id="pillBook" hidden={!pills.attention.length}>{pills.attention.length}</span></>}
                {k === "closures" && "Closures"}
                {k === "students" && "Students & hours"}
                {k === "tickets" && <>Tickets <span className="pill" id="pillTickets" hidden={!pills.open}>{pills.open}</span></>}
                {k === "feedback" && "Feedback"}
              </button>
            ))}
          </div>

          <div id="t-today" role="tabpanel" hidden={tab !== "today"}>
            <TodayTab cfg={cfg} data={data} attention={pills.attention} setStatus={setStatus} patchBooking={patchBooking} />
          </div>
          <div id="t-bookings" role="tabpanel" hidden={tab !== "bookings"}>
            <BookingsTab cfg={cfg} data={data} setStatus={setStatus} />
          </div>
          <div id="t-closures" role="tabpanel" hidden={tab !== "closures"}>
            <ClosuresTab cfg={cfg} data={data} load={load} />
          </div>
          <div id="t-students" role="tabpanel" hidden={tab !== "students"}>
            <StudentsTab cfg={cfg} data={data} />
          </div>
          <div id="t-tickets" role="tabpanel" hidden={tab !== "tickets"}>
            <TicketsTab tickets={tickets} setTickets={setTickets} load={load} />
          </div>
          <div id="t-feedback" role="tabpanel" hidden={tab !== "feedback"}>
            <FeedbackTab survey={survey} />
          </div>
        </div>
      )}
    </main>
  );
}
