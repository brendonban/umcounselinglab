"use client";
import { useEffect, useRef, useState } from "react";
import { ymd } from "@/lib/api";
import { downloadCsv } from "@/lib/ui";

export const STATUSES = ["Confirmed", "Attended", "No-show", "Cancelled"];
export const COUNTS = ["Confirmed", "Attended"]; // statuses that hold a room / count as hours

export const addDays = (s, n) => { const [y, m, d] = s.split("-").map(Number); return ymd(new Date(y, m - 1, d + n)); };
export const ended = b => { const [y, m, d] = b.date.split("-").map(Number); return new Date(y, m - 1, d, b.end) <= new Date(); };
export const started = b => { const [y, m, d] = b.date.split("-").map(Number); return new Date(y, m - 1, d, b.hour) <= new Date(); };
export const short = t => t.replace(" counselling session", "").replace(" session", "").replace(" / skills practice", "");
export const expired = err => /sign in again/i.test((err && err.message) || "");
export const cls = s => String(s).replace(/\W/g, "");

// Past sessions nobody has marked yet, and upcoming over-limit bookings.
export function needsAttention(bookings) {
  const since = addDays(ymd(new Date()), -14);
  return bookings.filter(b => (b.status === "Confirmed" && ended(b) && b.date >= since) || (b.status === "Confirmed" && !started(b) && b.justification));
}

// counseling-lab-<name>-<yyyy-mm-dd>.csv
export function csv(name, head, rows) {
  downloadCsv("counseling-lab-" + name + "-" + ymd(new Date()) + ".csv", [head].concat(rows));
}

// Text with line breaks kept.
export function Lines({ text }) {
  const parts = String(text == null ? "" : text).split("\n");
  return parts.map((p, i) => <span key={i}>{i > 0 && <br />}{p}</span>);
}

// A button that needs a second tap within 4 seconds before it acts.
export function ArmButton({ idleClass, idleText, armedText, onConfirm, disabled, busyText, busy, style }) {
  const [armed, setArmed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  function click() {
    if (!armed) {
      setArmed(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setArmed(false), 4000);
      return;
    }
    onConfirm();
  }
  return (
    <button type="button" className={armed ? "cta-btn small danger" : idleClass} style={style} disabled={disabled || busy} onClick={click}>
      {busy && busyText ? busyText : armed ? armedText : idleText}
    </button>
  );
}
