"use client";
import { useEffect, useRef, useState } from "react";
import { API, pad } from "@/lib/api";
import { niceDate, span, toast } from "@/lib/ui";
import { expired } from "./schedule";

// One upcoming booking with a two-tap Cancel: the first tap arms it, the second cancels (no pop-up dialogs).
function BookingItem({ b, token, onCancelled, onExpired }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function click() {
    if (!armed) {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    clearTimeout(timer.current);
    setBusy(true);
    try {
      await API.cancel({ token, code: b.code });
      toast("Booking cancelled. " + (b.room || "The room") + " is free for others now.");
      onCancelled();
    } catch (err) {
      setBusy(false); setArmed(false);
      if (expired(err)) onExpired("Your sign-in has expired. Sign in again.");
      else toast(err.message || "Couldn't cancel. Try again.");
    }
  }

  return (
    <li className="bitem">
      <div>
        <div className="when">{niceDate(b.date)} · {span(b.hour, b.end || b.hour + 1)} · {b.room || ""}</div>
        <div className="what">{b.purpose} · Code {b.code}</div>
      </div>
      <button type="button" className={armed ? "cta-btn small danger" : "cta-btn small ghost"} disabled={busy} onClick={click}>
        {busy ? "Cancelling…" : armed ? "Tap again to cancel" : "Cancel"}
      </button>
    </li>
  );
}

// "My bookings": mine is null (signed out), "loading", or an array of bookings.
export default function MyBookings({ token, mine, error, onCancelled, onExpired }) {
  const sorted = Array.isArray(mine) ? [...mine].sort((x, y) => (x.date + pad(x.hour) < y.date + pad(y.hour) ? -1 : 1)) : [];
  return (
    <div className="bstep" aria-labelledby="h-manage" id="mybookings">
      <span className="label">Your account</span>
      <h2 id="h-manage">My bookings</h2>
      <p className="help" id="mineHelp" hidden={mine !== null}>Sign in above to see your upcoming bookings.</p>
      <p className="err" id="lerr" role="alert" hidden={!error}>{error}</p>
      <div id="mine">
        {mine === "loading" && <p className="loading">Loading your bookings…</p>}
        {Array.isArray(mine) && !mine.length && <p className="muted">You have no upcoming bookings.</p>}
        {sorted.length > 0 && (
          <ul className="blist">
            {sorted.map(b => <BookingItem key={b.code} b={b} token={token} onCancelled={onCancelled} onExpired={onExpired} />)}
          </ul>
        )}
      </div>
      <p className="help">Can&apos;t make it? Cancel before your session starts and the room opens up for others straight away.</p>
    </div>
  );
}
